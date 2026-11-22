# Front Row (working name)

Random jokes and private crowdwork with five comedy personas: Dr. House, Checkmate,
Corporate Hater, Couldn't Care Less and No Filter. Built with Next.js and Meta's
[Astryx](https://github.com/meta/astryx) design system (Butter theme).

## How replies work (and why it won't break)
1. **Safety first:** messages that show real distress get a helpline, never a joke.
2. **Fresh AI from a chain of free providers** (`lib/providers.ts`): OpenRouter, then Gemini, Groq, Cerebras,
   Mistral, whichever have a key in `.env.local`. A busy model is skipped; a provider whose daily allowance is
   used up is skipped until tomorrow. Each reply must reuse a word from what the user typed, or it's thrown away.
3. **The line bank, picked by meaning** (`lib/semantic.ts`): the visitor's browser runs all-MiniLM-L6-v2
   (Hugging Face, ~23 MB, cached after the first visit) to turn the message into a meaning vector; the server
   finds the closest line in that comic's voice that this visitor hasn't seen before (seen lines are remembered
   in the browser, across visits, so jokes don't repeat).
4. **Hand-written lines picked by words**, the last resort (e.g. an old phone that can't run the model).

Warm-up questions and topic openers come from each persona (`lib/personas.ts`); `lib/beats.ts` decides
whether the comic asks first or lands a joke.

## Growing the line bank (run at night)
```
python scripts/pool/bank.py --requests 30
```
Uses spare free AI quota to write new lines in each comic's voice for ~50 everyday situations, checks them
(safety, humour), and rebuilds the bank. It shares the daily free allowance with the live site, so run it
when nobody's chatting.

## Run locally
```
npm install
npm run dev
```
Open http://localhost:3000. To use AI replies, copy `.env.example` to `.env.local` and fill it in.

## Deploy
1. Create an empty GitHub repo and push this folder.
2. On vercel.com: Add New > Project > import the repo (framework: Next.js, no changes needed).
3. Add the environment variables from `.env.example` (optional), then Deploy.

## Project map
| Path | What it is |
|---|---|
| `app/home.tsx` | Home: the joke card and persona grid |
| `app/chat/[persona]/chat-room.tsx` | The chat window |
| `app/api/reply/route.ts` | Reply API: safety, AI, library fallback |
| `lib/personas.ts` | The five personas: voice, opener, avatar |
| `lib/library.ts` | Original jokes and comebacks |
| `lib/match.ts` | Topic detection, word pick-up, safety check |
| `lib/config.ts` | App name, credit line, per-visitor AI cap |
| `public/avatars/` | Persona avatars (original SVGs) |
| `scripts/collect.py` | Pulls standup transcripts for inspiration (raw data goes to `data/raw`, kept off GitHub) |
| `docs/personas.md` | Persona design notes |

## The data pool
Everything the app says comes from one growing file, `data/pool/pool.jsonl` (the `data/` folder stays on your computer; .gitignore keeps it off GitHub). Sources are added,
scored and exported in three steps (run from this folder):
```
python scripts/pool/ingest.py all      # pull every source (re-runs only add what is new)
python scripts/pool/enrich.py          # free Hugging Face models: toxicity, humour, topics, persona fit
python scripts/pool/export.py          # writes public/pool/jokes.json and lib/pool/replies.json
```
| Source | What it adds | Licence |
|---|---|---|
| Front Row originals (`lib/library.ts`) | jokes and persona comebacks | own |
| JokeAPI | safe-flagged jokes | MIT |
| icanhazdadjoke | dad jokes | free API, credited |
| Official Joke API | setup and punchline jokes | MIT |
| SocialGrep one-million-reddit-jokes (HF) | top Reddit jokes by upvotes, NSFW removed | CC BY 4.0 |
| ZSvedic/humor-chains (HF) | a person's line and the witty reply to it | CC BY 4.0 |
| Wikiquote, House M.D. seasons 1-8 | House's lines, with the line said to him | CC BY-SA 4.0 |

To add a source: write a function in `scripts/pool/ingest.py` that calls `add(...)`, then run the three steps.
Credits on the site come from `lib/pool/credits.json` (set in `export.py`).

## Adding content
- More jokes or comebacks: add lines to `lib/library.ts` (`{thing}` = the user's own words).
- Transcripts: run `scripts/collect.bat`; they land in the workbench `data/raw/` and are mined for new
  library lines, never served word for word.
