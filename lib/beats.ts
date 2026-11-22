// Conversation pacing. A good crowdwork comic doesn't joke on every line:
// they react, ask, learn something, and THEN land the joke (often with a callback).
//
//   probe  quick reaction + one question, to get material (early in the chat)
//   riff   short reaction + a deeper question, after a joke has landed
//   land   the joke, built on what they've said so far

export type Beat = 'probe' | 'riff' | 'land';

export function decideBeat(text: string, turn: number, beats: Beat[], factCount: number): Beat {
  const words = text.trim().split(/\s+/).length;
  const last = beats.at(-1);
  const sinceLand = beats.length - 1 - beats.lastIndexOf('land');
  const asksPersona = /\?\s*$/.test(text) && words <= 14; // they asked us something: answer it in character

  if (asksPersona) return 'land';
  if (last === 'probe' || last === 'riff') return 'land'; // the comic asked; they answered: pay it off now
  if (sinceLand >= 2) return 'land'; // never warm up for more than two lines in a row
  if (beats.length === 0) return words >= 14 ? 'land' : 'probe'; // a rich first message is enough material
  if (turn === 2 && factCount < 2 && words < 10) return 'probe';
  if (last === 'land') return Math.random() < 0.4 ? 'riff' : 'land';
  return 'land';
}

export const BEAT_INSTRUCTION: Record<Beat, string> = {
  probe:
    "This turn, don't do a big joke yet. Like a comic warming up the room: one quick playful reaction (a light jab is fine) " +
    'and ONE specific question about what they just said, to get material. Under 25 words.',
  riff:
    'This turn: a short playful reaction to what they said, then one follow-up question that digs into a detail ' +
    'and sets up a bigger joke. Under 30 words.',
  land:
    "Now land a proper joke built on what they've told you. If something from earlier fits, call it back. " +
    'No question unless it naturally sets up the next bit. Under 40 words.',
};
