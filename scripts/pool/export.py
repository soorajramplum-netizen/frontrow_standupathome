"""Build the files the app reads from the enriched pool.

  python scripts/pool/export.py

Writes
  public/pool/jokes.json     jokes for the home-page sets (fetched by the browser, cached, no API)
  lib/pool/replies.json      comebacks and House lines for chat retrieval (server side)
  lib/pool/credits.json      sources and licences shown on the site
"""
import html, json, re, sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import pool as P

PERSONAS = ["house", "checkmate", "corporate", "nofilter", "wit"]
MAX_JOKES = 3000
SOURCE_LABEL = {
    "original": "Front Row",
    "jokeapi": "JokeAPI",
    "icanhazdadjoke": "icanhazdadjoke",
    "official-joke-api": "Official Joke API",
    "reddit-jokes": "r/Jokes via SocialGrep",
    "humor-chains": "Reddit via humor-chains",
    "wikiquote-house": "Wikiquote · House M.D.",
}
CREDITS = [
    {"name": "JokeAPI", "url": "https://v2.jokeapi.dev", "license": "MIT"},
    {"name": "icanhazdadjoke", "url": "https://icanhazdadjoke.com", "license": "Free API"},
    {"name": "Official Joke API", "url": "https://github.com/15Dkatz/official_joke_api", "license": "MIT"},
    {"name": "One Million Reddit Jokes (SocialGrep)", "url": "https://huggingface.co/datasets/SocialGrep/one-million-reddit-jokes", "license": "CC BY 4.0"},
    {"name": "humor-chains (ZSvedic)", "url": "https://huggingface.co/datasets/ZSvedic/humor-chains", "license": "CC BY 4.0"},
    {"name": "Wikiquote: House M.D.", "url": "https://en.wikiquote.org/wiki/House_(TV_series)", "license": "CC BY-SA 4.0"},
]

# Themes we never serve, whatever the model scores say.
BLOCK = re.compile(
    r"\b(kkk|nazi|hitler|holocaust|auschwitz|rape[ds]?|raping|molest|incest|pedo|paedo|slave|slavery|n[i1]gg\w*|"
    r"jews?|jewish|muslims?|islam|terroris\w*|isis|black (?:guy|man|woman|people|kid)|blacks|mexicans?|racis\w*|"
    r"gay|lesbian|trans(?:gender)?|retard\w*|autis\w*|down syndrome|cancer|suicide|abortion|"
    r"homeless|disabled|wheelchair|fat (?:girl|woman|chick|wife)|anorexi\w*|shoot\w*|"
    r"genocide|dead bab\w*|whore|slut|hooker|prostitut\w*|blowjob|dick|penis|vagina|boobs?|tits?|sex\w*|trump|porn\w*|condoms?|poop\w*|virgin\w*|naked|nude|orgasm|erection|masturbat\w*|piranha)\b",
    re.I,
)
# Dark or bleak themes: allowed in chat replies, kept off the home-page sets.
DARK = re.compile(
    r"\b(died|dies|dead|death|kill\w*|murder\w*|prison|jail|drugs?|cocaine|cheat\w*|affair|divorce\w*|"
    r"funeral|coffin|grave|blood|guns?|bomb\w*|war|police|cops?|crime|stab\w*|electric chair|dying)\b",
    re.I,
)

META = re.compile(
    r"\b(lol|lmao|rofl|haha\w*|hehe|OP|reddit|upvote\w*|repost\w*|this one|that one|good one|nice one|well played|"
    r"underrated|take my|came here|laughed|made me|i see what you did|thanks|thank you|underrated|comment\w*|thread|sub|"
    r"punchline|the joke|this joke|that joke|so funny|hilarious|groan|dad joke|pun)\b|r/",
    re.I,
)

# Home-page sets: our topic ids, matched first from the pool tags, then from keywords.
SET_TOPICS = {
    "work": ["work"], "love": ["love", "marriage"], "family": ["family", "marriage"],
    "money": ["money"], "tech": ["tech"], "life": ["self", "food", "friends", "health", "school"],
}
KEYWORDS = {
    "work": r"boss|job|office|work|coworker|colleague|manager|interview|fired|hired|salary|meeting|employee",
    "love": r"girlfriend|boyfriend|date|dating|wife|husband|married|marriage|wedding|tinder|crush|kiss",
    "family": r"mom|mum|mother|dad|father|parents?|son|daughter|kids?|grandma|grandpa|uncle|aunt|brother|sister",
    "money": r"money|bank|rich|poor|broke|rent|tax|taxes|bills?|loan|dollars?|rupees?|wallet|price",
    "tech": r"phone|computer|internet|wifi|app|google|facebook|instagram|email|password|laptop|robot|programmer",
    "life": r"doctor|gym|diet|food|eat|sleep|coffee|friends?|school|teacher|exam|birthday|beer|drunk",
}
PUN_SOURCES = {"icanhazdadjoke", "official-joke-api"}


def set_topic(r):
    if r["source"] in PUN_SOURCES or "wordplay" in (r.get("topics") or []) or r.get("src_category") == "Pun":
        return "puns"
    tags = r.get("topics") or []
    for tid, names in SET_TOPICS.items():
        if any(t in names for t in tags):
            return tid
    for tid, words in KEYWORDS.items():
        if re.search(r"\b(?:" + words + r")\b", r["text"], re.I):
            return tid
    return "any"


MEDICAL = re.compile(
    r"\b(patients?|diagnos\w*|symptoms?|hospital|surgery|surgeon|biopsy|mri|blood|tumou?r|lupus|treat\w*|dose|meds?|"
    r"medicine|clinic|nurses?|doctors?|infection|brain|heart|liver|kidneys?|lungs?|virus|vicodin|pills?|sick|disease|"
    r"ward|cuddy|wilson|foreman|chase|cameron|taub|thirteen|kutner)\b",
    re.I,
)


def in_voice(r) -> bool:
    """Can this line be said word for word by a comic, without AI rewriting it?"""
    if r["source"] in ("original", "banked"):
        return True
    if r["source"] == "wikiquote-house":
        return bool(r.get("context")) and not MEDICAL.search(r["text"]) and not MEDICAL.search(r.get("context") or "")
    # Reddit replies (humor-chains) are real people, not our comics: tested, they read flat when said word for
    # word ("I'm about to quit it."). They stay as AI material; nightly banking grows the in-voice set instead.
    return False


def write_bank(pool, path):
    """Chat lines + their meaning vectors (all-MiniLM-L6-v2, same model the browser runs) for lib/semantic.ts."""
    import base64
    import numpy as np
    from sentence_transformers import SentenceTransformer

    rows = []
    for r in pool:
        if r["kind"] not in ("comeback", "quote"):
            continue
        if r["source"] not in ("original", "banked") and r["humor"] < 0.5:
            continue
        if r["source"] == "humor-chains" and META.search(r["text"]):
            continue
        rows.append(r)
    model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2", device="cpu")
    # The key is what the line was a reply TO when we know it: that's what a new message should resemble.
    keys = [html.unescape(r.get("context") or r["text"]) for r in rows]
    vecs = model.encode(keys, batch_size=64, normalize_embeddings=True, show_progress_bar=False)
    q = np.clip(np.round(vecs * 127), -127, 127).astype(np.int8)
    items = [{
        "id": r["id"],
        "t": html.unescape(r["text"]),
        "c": html.unescape(r.get("context") or ""),
        "p": r.get("persona") or "",
        "f": [round(r["fit"].get(p, 0.0), 2) for p in PERSONAS],
        "q": r["quality"],
        "v": 1 if in_voice(r) else 0,
        "e": base64.b64encode(q[i].tobytes()).decode("ascii"),
    } for i, r in enumerate(rows)]
    path.write_text(json.dumps({"model": "all-MiniLM-L6-v2", "dim": 384, "items": items}, ensure_ascii=False,
                               separators=(",", ":")), encoding="utf-8")
    print(f"bank    {len(items):5}  in-voice {sum(i['v'] for i in items)}  ({path.stat().st_size // 1024} KB)")


def main():
    pool = [r for r in P.load().values() if r.get("safe") and "quality" in r and not BLOCK.search(r["text"])]

    jokes = [r for r in pool if r["kind"] == "joke" and r["source"] != "original" and r["humor"] >= 0.6
             and not DARK.search(r["text"]) and len(r["text"]) <= 220]
    jokes.sort(key=lambda r: r["quality"], reverse=True)
    jokes = jokes[:MAX_JOKES]
    out_jokes = [{"t": html.unescape(r["text"]), "k": set_topic(r), "s": SOURCE_LABEL.get(r["source"], r["source"])} for r in jokes]

    replies = []
    for r in pool:
        if r["kind"] not in ("comeback", "quote"):
            continue
        if r["source"] not in ("original", "banked") and r["humor"] < 0.5:
            continue
        # Reddit reaction comments ("lol this one got me, thanks OP") are not comebacks
        if r["source"] == "humor-chains" and (r["humor"] < 0.7 or META.search(r["text"])):
            continue
        replies.append({
            "t": html.unescape(r["text"]),
            "c": html.unescape(r.get("context") or ""),
            "p": r.get("persona") or "",
            "f": [round(r["fit"].get(p, 0.0), 2) for p in PERSONAS],
            "q": r["quality"],
            "k": r.get("topics") or [],
            "o": 1 if r["source"] in ("original", "banked") else 0,
        })

    pub = P.ROOT / "public" / "pool"
    lib = P.ROOT / "lib" / "pool"
    pub.mkdir(parents=True, exist_ok=True)
    lib.mkdir(parents=True, exist_ok=True)
    write_bank(pool, lib / "bank.json")
    (pub / "jokes.json").write_text(json.dumps(out_jokes, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (lib / "replies.json").write_text(json.dumps(replies, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (lib / "credits.json").write_text(json.dumps(CREDITS, indent=1), encoding="utf-8")

    print(f"jokes   {len(out_jokes):5}  by topic {Counter(j['k'] for j in out_jokes).most_common()}")
    print(f"replies {len(replies):5}  House-only {sum(1 for r in replies if r['p']=='house')}, with context {sum(1 for r in replies if r['c'])}")
    print(f"sizes   jokes.json {(pub/'jokes.json').stat().st_size//1024} KB, replies.json {(lib/'replies.json').stat().st_size//1024} KB")


if __name__ == "__main__":
    main()
