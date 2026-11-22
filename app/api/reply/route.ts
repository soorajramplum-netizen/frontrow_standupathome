import {getPersona, type Persona} from '@/lib/personas';
import {getTopic} from '@/lib/topics';
import {AI_REPLIES_PER_VISITOR_PER_DAY, APP_NAME} from '@/lib/config';
import {HELPLINE_REPLY, composeLibraryReply, contentWords, examplesFor, isDistress} from '@/lib/match';
import {search} from '@/lib/retrieve';
import {decodeVector, semanticPick, semanticSearch} from '@/lib/semantic';
import {BEAT_INSTRUCTION, decideBeat, type Beat} from '@/lib/beats';
import {anyAvailable, chat} from '@/lib/providers';

// Where a reply comes from, in order:
//   1. safety: real distress gets a helpline, never a joke
//   2. fresh AI, from a chain of free providers (lib/providers.ts), while their daily allowances last
//   3. the line bank, picked by MEANING: the browser embeds the message (all-MiniLM-L6-v2) and we find the
//      closest unseen line in this comic's voice (lib/semantic.ts)
//   4. hand-written lines picked by words, the last resort (e.g. an old phone that can't run the embedder)

type Msg = {role: 'user' | 'assistant'; content: string};

// Per-visitor guard rail, in memory.
const perVisitor = {day: '', used: new Map<string, number>()};

export async function POST(request: Request) {
  let body: {
    persona?: string;
    messages?: Msg[];
    facts?: string[];
    beats?: Beat[];
    topic?: string;
    vec?: string; // the user's message as a vector, from the browser (base64 int8)
    seen?: string[]; // ids of lines this visitor has already been shown (any visit)
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({error: 'bad request'}, {status: 400});
  }

  const persona = getPersona(body.persona ?? '');
  const messages = (body.messages ?? [])
    .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string')
    .slice(-12)
    .map((m) => ({role: m.role, content: m.content.slice(0, 600)}));
  const last = messages.at(-1);
  if (!persona || !last || last.role !== 'user') {
    return Response.json({error: 'bad request'}, {status: 400});
  }
  const text = last.content;
  const facts = (body.facts ?? []).filter((f) => typeof f === 'string').slice(-6).map((f) => f.slice(0, 80));
  const recent = messages.filter((m) => m.role === 'assistant').map((m) => m.content);
  const turn = messages.filter((m) => m.role === 'user').length;
  const beats = (body.beats ?? []).filter((b): b is Beat => b === 'probe' || b === 'riff' || b === 'land').slice(-8);
  const beat = decideBeat(text, turn, beats, facts.length);
  const vec = typeof body.vec === 'string' ? decodeVector(body.vec) : null;
  const seen = new Set((body.seen ?? []).filter((s) => typeof s === 'string').slice(-400));

  if (isDistress(text)) {
    return Response.json({reply: HELPLINE_REPLY, source: 'safety'});
  }

  // 2. fresh AI
  const d = new Date().toISOString().slice(0, 10);
  if (perVisitor.day !== d) {
    perVisitor.day = d;
    perVisitor.used.clear();
  }
  const visitor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const used = perVisitor.used.get(visitor) ?? 0;
  if (used < AI_REPLIES_PER_VISITOR_PER_DAY && anyAvailable()) {
    perVisitor.used.set(visitor, used + 1);
    const topic = getTopic(body.topic ?? '')?.label;
    const ai = await askAI(persona, messages, text, facts, beat, vec, topic);
    if (ai) return Response.json({reply: ai.text, source: 'ai', via: ai.provider, beat});
  }

  // 3. line bank by meaning (only for joke beats; warm-up questions come from the persona)
  if (beat === 'land' && vec) {
    const pick = semanticPick(persona.id, vec, seen, recent);
    if (pick) return Response.json({reply: pick.text, source: 'bank', id: pick.id, beat});
  }

  // 4. words
  return Response.json({reply: composeLibraryReply(persona, text, recent, facts, turn, beat), source: 'library', beat});
}

async function askAI(
  persona: Persona,
  history: Msg[],
  text: string,
  facts: string[],
  beat: Beat,
  vec: Float32Array | null,
  topic?: string,
) {
  // Material: lines that worked on similar messages, by meaning when we have it, else by words.
  const material = vec ? semanticSearch(persona.id, vec, {k: 3, anyVoice: true}) : search(persona.id, text, {k: 3});
  const system = [
    `You are "${persona.name}", a comedy persona doing private crowdwork with one audience member in an app called ${APP_NAME}. It is parody, not a real person.`,
    `Voice: ${persona.voice}`,
    topic ? `Tonight's topic, chosen by them: ${topic}.` : '',
    '',
    'How crowdwork flows:',
    '- React to what they just said first. Pick up a specific word or detail from their last message.',
    '- Build on the conversation: if something they said earlier fits, call it back.',
    '- Not every line is a joke. Good crowdwork reacts, asks, learns something, then lands the joke.',
    '- One bit at a time. No setup-punchline templates, no lists, no "Why did the…" jokes.',
    '- Make fun of situations and choices, never religion, caste, race, gender, sexuality, disability or body.',
    persona.swears ? '- Swearing is allowed when it makes the line land. Never slurs.' : '- Keep it clean: no swearing.',
    '- No emojis, no hashtags, no stage directions, no explaining the joke, never say you are an AI.',
    facts.length ? `\nThings they have told you so far: ${facts.join('; ')}.` : '',
    material.length
      ? '\nOptional material (lines that worked on similar messages). Rework the idea in your own voice; never quote them:\n' +
        material.map((m) => `- ${m.context ? `To "${m.context.slice(0, 120)}": ` : ''}${m.text.slice(0, 200)}`).join('\n')
      : '',
    '\nStyle reference for your voice:',
    ...examplesFor(persona.id, text, 3).map((e) => `- ${e}`),
  ]
    .filter(Boolean)
    .join('\n');

  return chat(
    [
      {role: 'system', content: system},
      ...history,
      {role: 'system', content: `Stay in character as ${persona.name}. ${BEAT_INSTRUCTION[beat]}`},
    ],
    (raw) => clean(raw, text),
  );
}

function clean(raw: string, userText: string): string | null {
  let out = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^\s*\*[^*]+\*\s*/g, '') // stage directions like *sighs*
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .replace(/^[A-Za-z.' ]{2,24}:\s+/, '')
    .trim();
  if (!out) return null;
  if (out.length > 320) out = out.slice(0, out.lastIndexOf('.', 320) + 1 || 320);
  // Relevance check: the reply must reuse something the user said (or be a short reply to a short message).
  const said = contentWords(userText);
  const reused = [...contentWords(out)].some((w) => said.has(w) || said.has(w.replace(/s$/, '')));
  return said.size === 0 || reused ? out : null;
}
