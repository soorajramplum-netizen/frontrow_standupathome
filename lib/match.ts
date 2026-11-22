import {COMEBACKS, type Comeback, type Topic} from './library';
import type {Persona, PersonaId} from './personas';
import {search} from './retrieve';
import {contentWords, extractThing} from './text';
import type {Beat} from './beats';

export {contentWords, extractThing};

const LEXICON: Record<Exclude<Topic, 'any'>, string[]> = {
  work: ['work', 'job', 'office', 'meeting', 'deadline', 'appraisal', 'hike', 'promotion', 'resign', 'layoff', 'laid off', 'startup', 'mnc', 'linkedin', 'standup', 'kpi', 'client', 'wfh', 'colleague', 'team', 'project', 'interview', 'salary', 'notice period'],
  boss: ['boss', 'manager', 'hr', 'lead', 'ceo', 'founder', 'senior', 'reporting'],
  money: ['money', 'salary', 'hike', 'percent', 'increment', 'bonus', 'broke', 'rent', 'emi', 'loan', 'bank', 'credit card', 'savings', 'expensive', 'paisa', 'rupees', '₹', 'budget', 'bill'],
  love: ['love', 'crush', 'girlfriend', 'boyfriend', 'gf', 'bf', 'date', 'dating', 'breakup', 'broke up', 'ex', 'tinder', 'bumble', 'hinge', 'situationship', 'ghosted', 'single', 'relationship'],
  parents: ['mom', 'mum', 'mummy', 'dad', 'papa', 'parents', 'family', 'relatives', 'aunty', 'uncle', 'sharmaji'],
  marriage: ['marriage', 'married', 'wedding', 'wife', 'husband', 'arranged', 'shaadi', 'in-laws', 'rishta'],
  food: ['food', 'eat', 'ate', 'biryani', 'pizza', 'maggi', 'diet', 'hungry', 'swiggy', 'zomato', 'chai', 'coffee', 'samosa', 'dosa', 'lunch', 'dinner', 'breakfast'],
  gym: ['gym', 'workout', 'protein', 'fat', 'weight', 'abs', 'run', 'fitness', 'trainer'],
  sleep: ['sleep', 'tired', 'insomnia', 'nap', 'awake', 'alarm', 'night'],
  tech: ['ai', 'chatgpt', 'social media', 'social', 'internet', 'online', 'laptop', 'code', 'coding', 'bug', 'app', 'wifi', 'internet', 'software', 'computer'],
  study: ['exam', 'study', 'college', 'school', 'marks', 'grades', 'engineering', 'mba', 'professor', 'assignment', 'semester', 'jee', 'neet', 'cat'],
  traffic: ['traffic', 'commute', 'auto', 'uber', 'ola', 'metro', 'bus', 'silk board', 'drive', 'bike'],
  friends: ['friend', 'friends', 'bestie', 'bro', 'gang', 'group chat', 'party', 'roommate'],
  phone: ['phone', 'instagram', 'insta', 'reels', 'scroll', 'whatsapp', 'screen time', 'battery', 'notification'],
  self: ['i am', "i'm", 'im ', 'myself', 'my life', 'me ', 'confidence', 'ugly', 'lazy', 'smart', 'genius'],
};

export function detectTopics(text: string): Topic[] {
  const t = ` ${text.toLowerCase().replace(/[^a-z0-9₹'\s-]/g, ' ')} `;
  // whole words only: "girlfriend" must not count as "friend"
  const hits = (Object.keys(LEXICON) as Exclude<Topic, 'any'>[]).filter((topic) =>
    LEXICON[topic].some((w) => t.includes(` ${w.trim()} `) || t.includes(` ${w.trim()}s `)),
  );
  return hits.length ? hits : ['any'];
}

/**
 * The no-AI reply, built to feel like a conversation rather than a joke vending machine:
 *  1. the best pool line for what they said (a reply to a similar message wins)
 *  2. otherwise a hand-written persona line with their own words slotted in
 *  3. early in the chat, sometimes a crowdwork question to keep it going
 *  4. now and then, a callback to something they said earlier
 */
export function composeLibraryReply(
  persona: Persona,
  text: string,
  recent: string[],
  facts: string[],
  turn: number,
  beat: Beat = 'land',
): string {
  const unused = <T extends string>(list: T[]) => list.filter((l) => !recent.some((r) => r.includes(l.slice(0, 24))));
  if (beat !== 'land') {
    // Warm up: react and ask for more, no punchline yet.
    // Echo back a real detail (a name, a company, "your manager"); a bare keyword like "pretty" reads badly.
    const thing = extractThing(text);
    if (thing && !thing.startsWith('"')) {
      const fresh = unused(persona.probes);
      const options = fresh.length ? fresh : persona.probes;
      const probe = options[Math.floor(Math.random() * options.length)];
      return probe.replace('{thing}', capitalise(thing));
    }
    const q = unused(persona.followUps)[0];
    if (q) return q;
  }

  // Without AI, only lines already in the comic's own voice are said word for word: their hand-written
  // lines, and House's real lines where what was said to him matches (only the non-hospital ones: he roasts
  // people about anything, he doesn't play doctor). Other pool lines are AI material only.
  const hits = search(persona.id, text, {k: 6, exclude: recent}).filter(
    (h) => h.original || (persona.id === 'house' && h.context && !MEDICAL.test(h.text) && !MEDICAL.test(h.context)),
  );
  let line: string;
  if (hits.length && hits[0].score >= 6) {
    const top = hits.filter((h) => h.score >= hits[0].score * 0.8);
    line = top[Math.floor(Math.random() * top.length)].text;
  } else {
    line = libraryReply(persona.id, text, recent);
  }

  const older = facts.filter((f) => !text.toLowerCase().includes(f.replace(/^your /, '').replace(/"/g, '')));
  if (turn >= 3 && older.length && Math.random() < 0.3) {
    line += ` ${CALLBACKS[Math.floor(Math.random() * CALLBACKS.length)].replace('{fact}', older[older.length - 1])}`;
  }
  return line;
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const MEDICAL =
  /\b(patients?|diagnos\w*|symptoms?|hospital|surgery|surgeon|biopsy|mri|ct scan|blood|tumou?r|lupus|treat\w*|dose|meds?|medicine|clinic|nurses?|doctors?|cancer|infection|brain|heart|liver|kidneys?|lungs?|virus|morphine|vicodin|pills?|sick|disease|ward|cuddy|wilson|foreman|chase|cameron|taub|thirteen)\b/i;

const CALLBACKS = [
  'And honestly, still thinking about {fact}.',
  'Which, by the way, explains {fact}.',
  'This is the same energy as {fact}, isn\'t it?',
];

/** Pick the best hand-written comeback for this persona and message. */
export function libraryReply(persona: PersonaId, text: string, recent: string[] = []): string {
  const topics = detectTopics(text);
  // Only fill a {thing} slot with a real detail (a name, a company, "your manager"), never a bare keyword.
  const found = extractThing(text);
  const thing = found && !found.startsWith('"') ? found : null;
  const pool = COMEBACKS.filter((c) => c.persona === persona);
  const scored = pool
    .map((c) => ({c, score: score(c, topics, Boolean(thing), recent)}))
    .sort((a, b) => b.score - a.score);
  const best = scored.filter((s) => s.score === scored[0].score);
  const pick = best[Math.floor(Math.random() * best.length)].c;
  return fill(pick.line, thing);
}

function score(c: Comeback, topics: Topic[], hasThing: boolean, recent: string[]) {
  let s = 0;
  for (const t of topics) if (c.topics.includes(t)) s += 3;
  if (c.topics.includes('any')) s += 1;
  if (c.line.includes('{thing}')) s += hasThing ? 2 : -10;
  if (recent.some((r) => r.startsWith(c.line.slice(0, 24)))) s -= 20;
  return s + Math.random() * 0.5;
}

function fill(line: string, thing: string | null) {
  return line.replace('{thing}', thing ?? 'that');
}

/** Library lines that fit this message, used as style examples for the LLM. */
export function examplesFor(persona: PersonaId, text: string, n = 5): string[] {
  const topics = detectTopics(text);
  return COMEBACKS.filter((c) => c.persona === persona)
    .map((c) => ({c, s: c.topics.filter((t) => topics.includes(t)).length + Math.random()}))
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map(({c}) => c.line.replace('{thing}', '…'));
}

const DISTRESS =
  /\b(kill myself|end it all|suicid|want to die|wanna die|self[- ]?harm|hurt myself|no reason to live|cut myself|being abused)\b/i;

export const isDistress = (text: string) => DISTRESS.test(text);

export const HELPLINE_REPLY =
  'Okay, dropping the act for a second. That sounds really heavy, and you deserve a real person, not a bit. ' +
  'In India you can call Tele-MANAS on 14416 (free, 24x7) or iCall on 9152987821. ' +
  'If you are outside India, findahelpline.com lists free lines near you. I will be here for jokes when you are ready.';
