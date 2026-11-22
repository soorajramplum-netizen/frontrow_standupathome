// Small text helpers, safe to import in the browser (no data pool here).

export const STOP = new Set(
  'i me my mine we our you your he she they them it its a an the and or but so to of in on at for with from by is am are was were be been being have has had do does did not no yes this that these those there here what which who whom how why when where just very really too also then than im ive dont cant wont didnt isnt its thats about like get got go going want need feel felt today yesterday tomorrow always never ever some any all one lot much more most can could would should will shall may might must please okay ok yeah hey hi hello lol haha own every single whole entire day days time times thing things stuff kind sort literally actually basically'.split(' '),
);

const NAME = String.raw`([A-Z][\w&.'-]*(?:\s+[A-Z][\w&.'-]*){0,3})`;

/**
 * The most specific thing the user mentioned, as it can be said back to them:
 *   "I work at CavinKare"   -> CavinKare
 *   "I'm a data analyst"    -> a data analyst
 *   "I'm from Chennai"      -> Chennai
 *   "my manager hates me"   -> your manager
 *   otherwise a name-like word, else the longest content word.
 */
export function extractThing(text: string): string | null {
  const t = text.trim();
  const company = t.match(new RegExp(String.raw`\b(?:work|working|job|intern(?:ing)?|employed)\s+(?:at|in|for|with)\s+` + NAME));
  if (company) return company[1];
  const companyLower = t.match(/\b(?:work|working|job|intern(?:ing)?)\s+(?:at|in|for|with)\s+([a-z][\w&.-]{2,})/i);
  if (companyLower && !STOP.has(companyLower[1].toLowerCase())) return companyLower[1];
  const place2 = t.match(/\b(?:go|going|went|been)\s+to\s+(?:the\s+)?([a-z]{3,})/i);
  if (place2 && !STOP.has(place2[1].toLowerCase())) return `the ${place2[1].toLowerCase()}`;
  const role = t.match(/\bi(?:'m| am)\s+(?:a|an)\s+((?:[a-z-]+\s){0,2}[a-z-]+)/i);
  if (role) {
    const words = role[1].toLowerCase().split(/\s+/);
    const cut = words.findIndex((w) => STOP.has(w));
    const kept = cut === -1 ? words : words.slice(0, cut);
    if (kept.length) return `a ${kept.join(' ')}`;
  }
  const place = t.match(new RegExp(String.raw`\b(?:from|in|live in|living in|moved to)\s+` + NAME));
  if (place) return place[1];
  // a capitalised word that isn't the first word of a sentence is usually a name
  const proper = t.match(/(?<![.!?]\s|^)\b([A-Z][a-zA-Z]{2,}(?:\s+[A-Z][a-zA-Z]+){0,2})/);
  if (proper && !STOP.has(proper[1].toLowerCase())) return proper[1];
  const my = t.match(/\bmy\s+([a-z'-]+)/i);
  if (my && !STOP.has(my[1].toLowerCase())) return `your ${my[1].toLowerCase()}`;
  const words = text
    .replace(/[^a-z0-9'\s-]/gi, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 3 && !STOP.has(w.toLowerCase()));
  if (!words.length) return null;
  return `"${words.sort((a, b) => b.length - a.length)[0].toLowerCase()}"`;
}

export function contentWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP.has(w)),
  );
}

