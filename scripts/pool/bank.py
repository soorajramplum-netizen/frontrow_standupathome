"""Bank new lines in each comic's voice, using spare free AI quota (run it at night, when nobody's chatting).

  python scripts/pool/bank.py                 # 20 requests (about 120 lines), then enrich + export
  python scripts/pool/bank.py --requests 40
  python scripts/pool/bank.py --no-export     # just add to the pool

Each request asks one comic for 6 replies to one everyday situation. Every line is stored with that situation
as its "context", so the meaning search (lib/semantic.ts) can match it to what a visitor says. Lines then go
through the same safety and humour checks as everything else (enrich.py) before the app can use them.

Reads OPENROUTER_API_KEY and OPENROUTER_MODELS from .env.local. It shares the same daily free allowance
as the live app, so keep --requests well under it.
"""
import json, random, re, subprocess, sys, time, urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import pool as P

SITUATIONS = [
    # work
    "I work in marketing", "I'm a software engineer", "my manager called me on a Sunday", "we got a 3% hike",
    "I have back-to-back meetings all day", "I'm on my notice period", "my startup calls itself a family",
    "I got laid off last month", "my appraisal was yesterday", "I work from home", "I commute two hours a day",
    "my colleague takes credit for my work", "I'm an intern", "I just got promoted", "I work in HR",
    # love
    "I'm single", "my ex texted me", "I've been talking to someone for months", "my girlfriend says I never listen",
    "my parents want me to get married", "I went on a bad first date", "I got ghosted", "I'm in a long-distance relationship",
    "my boyfriend forgot my birthday", "I just got engaged",
    # family
    "my mom calls me five times a day", "my dad forwards WhatsApp messages", "relatives keep asking about my salary",
    "I still live with my parents", "my sibling is the favourite", "my parents want me to be an engineer",
    # money
    "I'm broke before the month ends", "I put my savings in crypto", "I can't stop ordering food online",
    "rent just went up again", "I bought something I can't afford", "I'm saving for a house",
    # tech
    "my screen time is 9 hours a day", "I spend all night watching reels", "my phone battery dies by noon",
    "I use ChatGPT for everything", "I post on LinkedIn every day",
    # life
    "I joined a gym in January", "I can't sleep at night", "I start a new diet every Monday", "I'm turning 30",
    "I have no hobbies", "I'm always late", "I overthink everything", "I talk to my plants",
]


def env_local():
    vals = {}
    f = P.ROOT / ".env.local"
    if f.exists():
        for line in f.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                vals[k.strip()] = v.strip().strip('"')
    return vals


def persona_voices():
    """Read each comic's name and voice from lib/personas.ts so there's one source of truth."""
    ts = (P.ROOT / "lib" / "personas.ts").read_text(encoding="utf-8")
    out = {}
    for block in re.split(r"\n  \{\n", ts)[1:]:
        pid = re.search(r"id: '(\w+)'", block)
        name = re.search(r"name: ['\"](.+?)['\"],", block)
        voice = re.search(r"voice:\s*((?:'(?:[^'\\]|\\.)*'|\"(?:[^\"\\]|\\.)*\"|\s|\+)+),", block)
        if pid and name and voice:
            parts = re.findall(r"'((?:[^'\\]|\\.)*)'|\"((?:[^\"\\]|\\.)*)\"", voice.group(1))
            out[pid.group(1)] = (name.group(1), "".join(a or b for a, b in parts).replace("\\'", "'"))
    return out


def ask(key, model, messages):
    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=json.dumps({"model": model, "messages": messages, "max_tokens": 700, "temperature": 1.0,
                         "reasoning": {"exclude": True}}).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json", "X-Title": "Front Row (banking)"},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())["choices"][0]["message"]["content"]


def main():
    n_requests = int(sys.argv[sys.argv.index("--requests") + 1]) if "--requests" in sys.argv else 20
    env = env_local()
    key, models = env.get("OPENROUTER_API_KEY"), [m for m in env.get("OPENROUTER_MODELS", "").split(",") if m]
    if not key or not models:
        sys.exit("Set OPENROUTER_API_KEY and OPENROUTER_MODELS in .env.local first.")
    voices = persona_voices()
    pool = P.load()
    already = {(r.get("persona"), r.get("context")) for r in pool.values() if r["source"] == "banked"}
    jobs = [(p, s) for p in voices for s in SITUATIONS if (p, s) not in already]
    random.shuffle(jobs)
    added = 0
    for pid, situation in jobs[:n_requests]:
        name, voice = voices[pid]
        prompt = [
            {"role": "system", "content":
                f'You write lines for "{name}", a comedy persona in a crowdwork app. Voice: {voice}\n'
                "Rules: each line reacts to what the person said and pokes fun at the situation, never at religion, caste, "
                "race, gender, sexuality, disability or body. 1-2 sentences, under 35 words each. No emojis, no hashtags, "
                "no 'Why did the' jokes, no setups with Q&A. Six different angles, not six versions of one joke."},
            {"role": "user", "content":
                f'Someone in the front row says: "{situation}". Write 6 different replies {name} could say. '
                'Answer ONLY with a JSON array of 6 strings.'},
        ]
        text = None
        for model in models:
            try:
                text = ask(key, model, prompt)
                break
            except Exception as e:
                print(f"  {model}: {type(e).__name__}")
                time.sleep(2)
        if not text:
            print("All models busy; stopping for now.")
            break
        m = re.search(r"\[[\s\S]*\]", text)
        try:
            lines = json.loads(m.group(0)) if m else []
        except json.JSONDecodeError:
            lines = []
        n = 0
        for line in lines:
            if isinstance(line, str) and 15 <= len(line) <= 260:
                n += P.add(pool, line.strip().strip('"'), kind="comeback", source="banked", source_url="",
                           license="generated for Front Row", persona=pid, extra={"context": situation})
        added += n
        print(f"{name:18} | {situation[:40]:40} | +{n}")
        P.save(pool)
        time.sleep(3)
    print(f"\nbanked {added} new lines")
    if added and "--no-export" not in sys.argv:
        subprocess.run([sys.executable, "-X", "utf8", str(Path(__file__).parent / "enrich.py")], check=False)
        subprocess.run([sys.executable, "-X", "utf8", str(Path(__file__).parent / "export.py")], check=False)


if __name__ == "__main__":
    main()
