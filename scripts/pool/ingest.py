"""Pull jokes, comebacks and quotes into the data pool.

Usage (from the project folder):
  python scripts/pool/ingest.py original        # hand-written seed lines (lib/library.ts)
  python scripts/pool/ingest.py jokeapi         # v2.jokeapi.dev, safe flags only
  python scripts/pool/ingest.py dadjokes        # icanhazdadjoke.com
  python scripts/pool/ingest.py officialjokes   # 15Dkatz/official_joke_api
  python scripts/pool/ingest.py house           # Wikiquote: House (TV series) and season pages
  python scripts/pool/ingest.py humorchains     # HF ZSvedic/humor-chains (line -> witty reply)
  python scripts/pool/ingest.py redditjokes     # HF SocialGrep/one-million-reddit-jokes (top by score)
  python scripts/pool/ingest.py all

Each run only adds what is new, so it is safe to re-run.
"""
import csv, html, json, re, sys, time, urllib.parse, urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import pool as P

UA = {"User-Agent": "FrontRow-hobby-joke-app (github; non-commercial)", "Accept": "application/json"}
SRC = P.DATA / "sources"


def get_json(url, headers=None):
    req = urllib.request.Request(url, headers={**UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


# ---------------------------------------------------------------- original
def original(pool):
    ts = (P.ROOT / "lib" / "library.ts").read_text(encoding="utf-8")
    n = 0
    current = set()
    quoted = r"(?:'((?:[^'\\]|\\.)*)'|\"((?:[^\"\\]|\\.)*)\")"
    for topic, sq, dq in re.findall(r"\{topic: '(\w+)', text: " + quoted + r"\}", ts):
        text = (sq or dq).replace("\\'", "'").replace('\\"', '"')
        current.add(P.make_id(text))
        n += P.add(pool, text, kind="joke", source="original", source_url="",
                   license="original (Front Row)", extra={"topics": [topic]})
    for persona, topics, sq, dq in re.findall(r"\{persona: '(\w+)', topics: \[([^\]]*)\], line: " + quoted + r"\}", ts):
        tps = re.findall(r"'(\w+)'", topics)
        line = (sq or dq).replace("\\'", "'").replace('\\"', '"')
        i = P.make_id(line)
        current.add(i)
        if i in pool:  # a line that moved persona or topic keeps its scores but takes the new labels
            pool[i]["persona"], pool[i]["topics"] = persona, tps
        n += P.add(pool, line, kind="comeback", source="original", source_url="",
                   license="original (Front Row)", persona=persona, extra={"topics": tps})
    # lines deleted from library.ts leave the pool too
    for i in [i for i, r in pool.items() if r["source"] == "original" and i not in current]:
        del pool[i]
    return n


# ---------------------------------------------------------------- jokeapi
def jokeapi(pool, calls=180):
    """Random batches of 10 safe jokes until we stop seeing new ones."""
    flags = "nsfw,religious,political,racist,sexist,explicit"
    n, seen, dry = 0, set(), 0
    for _ in range(calls):
        try:
            data = get_json(f"https://v2.jokeapi.dev/joke/Any?blacklistFlags={flags}&amount=10&lang=en")
        except Exception as e:
            print("  jokeapi", type(e).__name__)
            time.sleep(5)
            continue
        new = 0
        for j in data.get("jokes", []):
            if j["id"] in seen:
                continue
            seen.add(j["id"])
            new += 1
            text = j["joke"] if j["type"] == "single" else j["setup"] + "\n" + j["delivery"]
            n += P.add(pool, text, kind="joke", source="jokeapi", source_url=f"https://v2.jokeapi.dev/joke/Any?idRange={j['id']}",
                       license="JokeAPI (MIT)", extra={"src_category": j.get("category")})
        dry = dry + 1 if new == 0 else 0
        if dry >= 8:
            break
        time.sleep(0.6)  # their limit is 120 requests a minute
    print(f"  jokeapi: {len(seen)} unique jokes seen")
    return n


# ---------------------------------------------------------------- icanhazdadjoke
def dadjokes(pool):
    n, page = 0, 1
    while True:
        data = get_json(f"https://icanhazdadjoke.com/search?limit=30&page={page}")
        for j in data["results"]:
            n += P.add(pool, j["joke"], kind="joke", source="icanhazdadjoke", source_url=f"https://icanhazdadjoke.com/j/{j['id']}",
                       license="icanhazdadjoke.com (free API, credit requested)")
        if page >= data["total_pages"]:
            return n
        page += 1
        time.sleep(1)


# ---------------------------------------------------------------- official joke api
def officialjokes(pool):
    url = "https://raw.githubusercontent.com/15Dkatz/official_joke_api/master/jokes/index.json"
    req = urllib.request.Request(url, headers=UA)
    data = json.loads(urllib.request.urlopen(req, timeout=30).read().decode("utf-8"))
    n = 0
    for j in data:
        n += P.add(pool, f"{j['setup']}\n{j['punchline']}", kind="joke", source="official-joke-api",
                   source_url="https://github.com/15Dkatz/official_joke_api", license="MIT",
                   extra={"src_category": j.get("type")})
    return n


# ---------------------------------------------------------------- wikiquote house
def strip_wiki(s):
    s = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"", s)
    s = re.sub(r"\{\{[^}]*\}\}", "", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = s.replace("'''", "").replace("''", "")
    return html.unescape(re.sub(r"\s+", " ", s)).strip()


def house(pool):
    pages = [f"House_(Season_{i})" for i in range(1, 9)]
    n = 0
    for page in pages:
        url = f"https://en.wikiquote.org/w/index.php?title={page}&action=raw"
        req = urllib.request.Request(url, headers={"User-Agent": "FrontRowHobbyBot/0.1 (non-commercial joke app)"})
        try:
            wt = urllib.request.urlopen(req, timeout=30).read().decode("utf-8")
        except Exception as e:
            print("  ", page, type(e).__name__)
            time.sleep(10)
            continue
        src = "https://en.wikiquote.org/wiki/" + page
        prev = None  # (speaker, text) of the line before, used as context
        for line in wt.splitlines():
            m = re.match(r"^[:*]+\s*'''(.+?)'''\s*:\s*(.+)$", line)
            if not m:
                if not line.startswith(":"):
                    prev = None
                continue
            speaker = strip_wiki(m.group(1))
            text = re.sub(r"\[[^\]]*\]", "", strip_wiki(m.group(2))).strip()
            if "House" in speaker and 25 <= len(text) <= 220:
                ctx = prev[1] if prev and "House" not in prev[0] and len(prev[1]) <= 220 else None
                n += P.add(pool, text, kind="quote", source="wikiquote-house", source_url=src,
                           license="CC BY-SA 4.0 (Wikiquote)", persona="house",
                           extra={"context": ctx} if ctx else None)
            prev = (speaker, text)
        time.sleep(3)
    return n


# ---------------------------------------------------------------- humor-chains
def humorchains(pool):
    n = 0
    for f in ["humor-chains-train.jsonl", "humor-chains-test.jsonl"]:
        for line in (SRC / f).read_text(encoding="utf-8").splitlines():
            r = json.loads(line)
            conv = r["conversations"]
            if len(conv) < 2:
                continue
            ctx = html.unescape(conv[0]["value"]).strip()
            reply = html.unescape(conv[1]["value"]).strip()
            if "http" in ctx or "http" in reply or len(ctx) > 300 or len(reply) > 240:
                continue
            n += P.add(pool, reply, kind="comeback", source="humor-chains", source_url=r.get("url", ""),
                       license="CC BY 4.0 (ZSvedic/humor-chains)", extra={"context": ctx, "subreddit": r.get("subreddit")})
    return n


# ---------------------------------------------------------------- one million reddit jokes
def redditjokes(pool, keep=6000):
    path = SRC / "one-million-reddit-jokes.csv"
    csv.field_size_limit(10_000_000)
    rows = []
    with path.open(encoding="utf-8", errors="ignore", newline="") as f:
        for r in csv.DictReader(f):
            if r.get("subreddit.nsfw") == "true" or r.get("selftext") in ("[removed]", "[deleted]"):
                continue
            try:
                score = int(r.get("score") or 0)
            except ValueError:
                continue
            if score < 50:
                continue
            title, body = (r.get("title") or "").strip(), (r.get("selftext") or "").strip()
            if "http" in title or "http" in body or "edit:" in body.lower():
                continue
            text = f"{title}\n{body}" if body else title
            if 20 <= len(text) <= 300:
                rows.append((score, text, r.get("permalink", "")))
    rows.sort(reverse=True)
    top = rows[0][0] if rows else 1
    n = 0
    for score, text, link in rows[:keep]:
        n += P.add(pool, text, kind="joke", source="reddit-jokes", source_url=link,
                   license="CC BY 4.0 (SocialGrep/one-million-reddit-jokes)", score=round(min(1, (score / top) ** 0.3), 3))
    return n


SOURCES = {"original": original, "jokeapi": jokeapi, "dadjokes": dadjokes, "officialjokes": officialjokes,
           "house": house, "humorchains": humorchains, "redditjokes": redditjokes}

if __name__ == "__main__":
    names = sys.argv[1:] or ["all"]
    if names == ["all"]:
        names = list(SOURCES)
    pool = P.load()
    for name in names:
        before = len(pool)
        try:
            added = SOURCES[name](pool)
            print(f"{name:14} +{added:5}  (pool {before} -> {len(pool)})")
        except Exception as e:
            print(f"{name:14} FAILED: {type(e).__name__}: {e}")
        P.save(pool)
