// A chain of free AI providers, one key each. All speak the same "OpenAI-style" chat API.
// The reply route tries them in order; a busy model or a used-up provider just moves on to the next.
//
// Add a provider by filling its two env vars (key + models). Providers without both are skipped.
// One key per provider: opening several accounts on the same provider to multiply free quota
// usually breaks their terms, so this chain doesn't support that.

export type Provider = {
  name: string;
  url: string;
  key?: string;
  models: string[];
  dailyBudget: number;
  extraHeaders?: Record<string, string>;
  /** OpenRouter-only extras (fine to omit elsewhere). */
  openrouter?: boolean;
};

const list = (v?: string) =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const num = (v: string | undefined, fallback: number) => (v && !Number.isNaN(Number(v)) ? Number(v) : fallback);

export function providers(): Provider[] {
  const env = process.env;
  const all: Provider[] = [
    {
      name: 'openrouter',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      key: env.OPENROUTER_API_KEY,
      models: list(env.OPENROUTER_MODELS),
      dailyBudget: num(env.OPENROUTER_DAILY_BUDGET ?? env.DAILY_AI_BUDGET, 45),
      extraHeaders: {'X-Title': 'Front Row'},
      openrouter: true,
    },
    {
      name: 'gemini',
      url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      key: env.GEMINI_API_KEY,
      models: list(env.GEMINI_MODELS),
      dailyBudget: num(env.GEMINI_DAILY_BUDGET, 200),
    },
    {
      name: 'groq',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      key: env.GROQ_API_KEY,
      models: list(env.GROQ_MODELS),
      dailyBudget: num(env.GROQ_DAILY_BUDGET, 200),
    },
    {
      name: 'cerebras',
      url: 'https://api.cerebras.ai/v1/chat/completions',
      key: env.CEREBRAS_API_KEY,
      models: list(env.CEREBRAS_MODELS),
      dailyBudget: num(env.CEREBRAS_DAILY_BUDGET, 200),
    },
    {
      name: 'mistral',
      url: 'https://api.mistral.ai/v1/chat/completions',
      key: env.MISTRAL_API_KEY,
      models: list(env.MISTRAL_MODELS),
      dailyBudget: num(env.MISTRAL_DAILY_BUDGET, 100),
    },
  ];
  // AI_PROVIDER_ORDER (e.g. "groq,gemini,openrouter") puts the biggest free allowance first.
  const order = list(env.AI_PROVIDER_ORDER);
  const rank = (name: string) => (order.includes(name) ? order.indexOf(name) : order.length + all.findIndex((p) => p.name === name));
  return all.filter((p) => p.key && p.models.length).sort((a, b) => rank(a.name) - rank(b.name));
}

// In-memory daily counters (reset when Vercel recycles the function; good enough as a guard rail).
const state = {day: '', used: new Map<string, number>(), exhausted: new Set<string>()};

function roll() {
  const d = new Date().toISOString().slice(0, 10);
  if (state.day !== d) {
    state.day = d;
    state.used.clear();
    state.exhausted.clear();
  }
}

export function anyAvailable(): boolean {
  roll();
  return providers().some((p) => !state.exhausted.has(p.name) && (state.used.get(p.name) ?? 0) < p.dailyBudget);
}

type ChatMessage = {role: string; content: string};

/**
 * Ask the chain for one reply. `accept` decides whether a reply is good enough (e.g. it must reuse the
 * user's words); a rejected reply moves on to the next model. Gives up after `totalMs`.
 */
export async function chat(
  messages: ChatMessage[],
  accept: (raw: string) => string | null,
  opts: {maxTokens?: number; temperature?: number; totalMs?: number} = {},
): Promise<{text: string; provider: string; model: string} | null> {
  roll();
  const deadline = Date.now() + (opts.totalMs ?? 15000);
  for (const p of providers()) {
    if (state.exhausted.has(p.name) || (state.used.get(p.name) ?? 0) >= p.dailyBudget) continue;
    for (const model of p.models.slice(0, 4)) {
      const left = deadline - Date.now();
      if (left < 2000) return null;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(8000, left));
      state.used.set(p.name, (state.used.get(p.name) ?? 0) + 1);
      try {
        const res = await fetch(p.url, {
          method: 'POST',
          signal: controller.signal,
          headers: {Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json', ...p.extraHeaders},
          body: JSON.stringify({
            model,
            messages,
            max_tokens: opts.maxTokens ?? 300, // room for models that think before answering
            temperature: opts.temperature ?? 0.95,
            ...(p.openrouter ? {reasoning: {exclude: true}} : {}),
          }),
        });
        if (res.status === 429) {
          const body = await res.text();
          // A busy model ("upstream") means try the next one; OUR daily allowance being gone means skip this provider today.
          if (/per[- ]day|daily|quota|free-models-per|exceeded/i.test(body) && !/upstream|temporarily/i.test(body)) {
            state.exhausted.add(p.name);
            break;
          }
          continue;
        }
        if (res.status === 401 || res.status === 403) {
          state.exhausted.add(p.name); // bad key: don't keep trying it
          break;
        }
        if (!res.ok) continue;
        const data = await res.json();
        const raw: string | undefined = data?.choices?.[0]?.message?.content;
        const out = raw ? accept(raw) : null;
        if (out) return {text: out, provider: p.name, model};
      } catch {
        // timeout or network error on this model: try the next
      } finally {
        clearTimeout(timer);
      }
    }
  }
  return null;
}
