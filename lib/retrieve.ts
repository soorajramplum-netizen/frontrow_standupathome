// BM25 search over the reply pool (lib/pool/replies.json), built once per server instance.
// A line that was a reply to a similar message (its "context") is the strongest match:
// that is how real crowdwork lines get reused for a new person.

import replies from './pool/replies.json';
import type {PersonaId} from './personas';
import {STOP as BASE_STOP} from './text';

type Reply = {t: string; c: string; p: string; f: number[]; q: number; k: string[]; o: number};
const PERSONA_INDEX: Record<PersonaId, number> = {house: 0, checkmate: 1, corporate: 2, nofilter: 3, wit: 4};

const STOP = new Set([...BASE_STOP, ...'say says said got make made know think thing want really'.split(' ')]);

export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map((w) => (w.length > 4 ? w.replace(/(ing|ed|es|s)$/, '') : w));
}

type Doc = {r: Reply; tf: Map<string, number>; ctx: Set<string>; len: number};
let index: {docs: Doc[]; df: Map<string, number>; avg: number} | null = null;

function build() {
  const docs: Doc[] = (replies as Reply[]).map((r) => {
    // context counts twice: matching what the line was a reply TO matters most
    const toks = [...tokens(r.c), ...tokens(r.c), ...tokens(r.t)];
    const tf = new Map<string, number>();
    for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
    return {r, tf, ctx: new Set(tokens(r.c)), len: toks.length || 1};
  });
  const df = new Map<string, number>();
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const avg = docs.reduce((s, d) => s + d.len, 0) / docs.length;
  index = {docs, df, avg};
  return index;
}

export type Hit = {text: string; context: string; score: number; original: boolean};

export function search(persona: PersonaId, query: string, opts: {k?: number; exclude?: string[]} = {}): Hit[] {
  const {docs, df, avg} = index ?? build();
  const q = [...new Set(tokens(query))];
  if (!q.length) return [];
  const N = docs.length;
  const pi = PERSONA_INDEX[persona];
  const exclude = new Set((opts.exclude ?? []).map((e) => e.slice(0, 40)));
  const hits: Hit[] = [];
  for (const d of docs) {
    // House gets his own lines; other personas get shared lines that fit their voice
    if (d.r.p && d.r.p !== persona) continue;
    if (!d.r.p && d.r.f[pi] < 0.12) continue;
    let s = 0;
    let matched = 0;
    let inContext = 0;
    for (const t of q) {
      const f = d.tf.get(t);
      if (!f) continue;
      matched += 1;
      if (d.ctx.has(t)) inContext += 1;
      const idf = Math.log(1 + (N - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
      s += idf * ((f * 2.2) / (f + 1.2 * (0.25 + 0.75 * (d.len / avg))));
    }
    // A reused line must fit what they said. Lines with a context (what they were a reply to) need two
    // of the user's words in that context; lines without one need three shared words. One shared word
    // ("work") is a coincidence, not a match.
    const enough = d.r.c ? inContext >= Math.min(2, q.length) : matched >= Math.min(3, q.length + 1);
    if (s <= 0 || !enough || exclude.has(d.r.t.slice(0, 40))) continue;
    const personaBoost = d.r.p === persona ? 1.25 : 0.7 + d.r.f[pi];
    hits.push({text: d.r.t, context: d.r.c, score: s * personaBoost * (0.7 + 0.3 * d.r.q), original: d.r.o === 1});
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, opts.k ?? 5);
}
