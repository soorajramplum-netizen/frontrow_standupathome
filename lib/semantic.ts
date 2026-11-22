// Meaning-based search over the line bank (lib/pool/bank.json, built by scripts/pool/export.py).
//
// Every line carries a 384-number "meaning" vector from all-MiniLM-L6-v2, made offline from the message it
// originally answered (or from the line itself). The browser embeds the visitor's message with the same model,
// so "my boss yelled at me in standup" finds lines about a manager screaming in a meeting, no shared words needed.

import bank from './pool/bank.json';
import type {PersonaId} from './personas';

type Item = {
  id: string;
  t: string; // the line
  c: string; // what it originally answered ('' if nothing)
  p: string; // persona that owns it ('' = shared)
  f: number[]; // persona fit, in the order of PERSONAS below
  q: number; // quality 0-1
  v: number; // 1 = in a comic's voice, safe to say word for word; 0 = AI material only
  e: string; // meaning vector, base64 int8
};

const PERSONAS: PersonaId[] = ['house', 'checkmate', 'corporate', 'nofilter', 'wit'];
const DIM = 384;

let items: (Item & {vec: Int8Array})[] | null = null;

function load() {
  items = (bank as {items: Item[]}).items.map((it) => ({...it, vec: base64ToInt8(it.e)}));
  return items;
}

function base64ToInt8(b64: string): Int8Array {
  const bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const out = new Int8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = (bin.charCodeAt(i) << 24) >> 24;
  return out;
}

/** The browser sends the message vector as base64 int8 (each number × 127). */
export function decodeVector(b64: string): Float32Array | null {
  try {
    const q = base64ToInt8(b64);
    if (q.length !== DIM) return null;
    const v = new Float32Array(DIM);
    let n = 0;
    for (let i = 0; i < DIM; i++) {
      v[i] = q[i] / 127;
      n += v[i] * v[i];
    }
    n = Math.sqrt(n) || 1;
    for (let i = 0; i < DIM; i++) v[i] /= n;
    return v;
  } catch {
    return null;
  }
}

function cosine(a: Float32Array, b: Int8Array) {
  let s = 0;
  for (let i = 0; i < DIM; i++) s += a[i] * b[i];
  return s / 127; // bank vectors were normalised before being scaled to int8
}

export type SemanticHit = {id: string; text: string; context: string; sim: number};

function ranked(persona: PersonaId, vec: Float32Array, anyVoice: boolean) {
  const pi = PERSONAS.indexOf(persona);
  const out: (SemanticHit & {score: number})[] = [];
  for (const it of items ?? load()) {
    if (it.p && it.p !== persona) continue; // another comic's own line
    if (!it.p && it.f[pi] < 0.12) continue; // shared line that doesn't fit this comic's voice
    if (!anyVoice && !it.v) continue;
    const sim = cosine(vec, it.vec);
    const own = it.p === persona ? 0.04 : 0;
    out.push({id: it.id, text: it.t, context: it.c, sim, score: sim + own + 0.05 * it.q});
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Lines that fit this message by meaning; `anyVoice` includes AI-only material (for the AI prompt). */
export function semanticSearch(persona: PersonaId, vec: Float32Array, opts: {k?: number; anyVoice?: boolean} = {}) {
  return ranked(persona, vec, opts.anyVoice ?? false).slice(0, opts.k ?? 5);
}

/**
 * The reply when AI isn't available: the best line in this comic's voice that this visitor has NOT seen
 * (any visit), picked at random among the close contenders so the same message doesn't always get the
 * same joke. Returns null if nothing is a good enough match; the caller falls back further.
 */
export function semanticPick(persona: PersonaId, vec: Float32Array, seen: Set<string>, recent: string[]) {
  const said = new Set(recent.map((r) => r.slice(0, 40)));
  const fresh = ranked(persona, vec, false).filter((h) => !seen.has(h.id) && !said.has(h.text.slice(0, 40)));
  if (!fresh.length || fresh[0].sim < 0.35) return null;
  const close = fresh.filter((h) => h.score >= fresh[0].score - 0.04).slice(0, 4);
  return close[Math.floor(Math.random() * close.length)];
}
