'use client';

// Runs all-MiniLM-L6-v2 (about 23 MB, Apache-2.0) in the visitor's browser with transformers.js.
// It turns a message into 384 numbers that capture its meaning; the server compares those with the
// line bank (lib/semantic.ts). Free, no API, no rate limit. Downloaded once, then cached by the browser.
// If it can't load (old phone, no WASM), everything still works with word matching.

type Embedder = (text: string) => Promise<string | null>;

let loading: Promise<Embedder | null> | null = null;

export function loadEmbedder(): Promise<Embedder | null> {
  if (loading) return loading;
  loading = (async () => {
    try {
      const {pipeline} = await import('@huggingface/transformers');
      const extract = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {dtype: 'q8'});
      return async (text: string) => {
        try {
          const out = await extract(text, {pooling: 'mean', normalize: true});
          return toBase64Int8(out.data as Float32Array);
        } catch {
          return null;
        }
      };
    } catch {
      return null;
    }
  })();
  return loading;
}

/** Same packing the server expects: each number × 127, as signed bytes, base64. */
function toBase64Int8(v: Float32Array): string {
  let bin = '';
  for (let i = 0; i < v.length; i++) {
    const q = Math.max(-127, Math.min(127, Math.round(v[i] * 127)));
    bin += String.fromCharCode(q & 0xff);
  }
  return btoa(bin);
}

// ---- lines this visitor has already been shown, kept across visits so jokes don't repeat ----

const SEEN_KEY = 'fr-seen';

export function getSeen(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function markSeen(id: string) {
  try {
    const seen = getSeen().filter((s) => s !== id);
    seen.push(id);
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen.slice(-400)));
  } catch {}
}
