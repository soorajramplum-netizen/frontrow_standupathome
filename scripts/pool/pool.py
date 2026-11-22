"""The data pool: one growing JSONL file every source writes into.

data/pool/pool.jsonl   one line per joke / comeback / quote, de-duplicated by text
Every ingest script calls add(); enrich.py scores and tags; export.py builds what the app reads.

Record fields
  id          stable hash of the normalised text
  text        the full joke (setup + punchline joined with a line break when two-part)
  kind        joke | comeback | quote
  source      jokeapi | icanhazdadjoke | official-joke-api | reddit-jokes | wikiquote-house | original | ...
  source_url  where it came from
  license     licence or terms note
  score       0-1 quality signal from the source if any (upvotes etc.), else null
  persona     a persona id if the source fixes it (e.g. House quotes), else null
  added       date added
  (enrich.py adds: topics, toxic, persona_fit, quality)
"""
import hashlib, json, os, re, unicodedata
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def find_data(root: Path) -> Path:
    """Build-only data (scrapes, big CSVs, pool.jsonl, logs) lives in the project's own data/ folder,
    which .gitignore keeps off GitHub. Override with the FRONTROW_DATA env var."""
    if os.environ.get("FRONTROW_DATA"):
        return Path(os.environ["FRONTROW_DATA"])
    return root / "data"


DATA = find_data(ROOT)
POOL = DATA / "pool" / "pool.jsonl"


def norm(text: str) -> str:
    t = unicodedata.normalize("NFKC", text).lower()
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


def make_id(text: str) -> str:
    return hashlib.sha1(norm(text).encode()).hexdigest()[:12]


def load() -> dict:
    if not POOL.exists():
        return {}
    out = {}
    with POOL.open(encoding="utf-8") as f:
        for line in f:
            if line.strip():
                r = json.loads(line)
                out[r["id"]] = r
    return out


def save(pool: dict) -> None:
    POOL.parent.mkdir(parents=True, exist_ok=True)
    tmp = POOL.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        for r in pool.values():
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    tmp.replace(POOL)


def clean(text: str) -> str:
    text = re.sub(r"\s+\n", "\n", text.replace("\r", "")).strip()
    return re.sub(r"[ \t]+", " ", text)


def add(pool: dict, text: str, *, kind: str, source: str, source_url: str, license: str,
        score=None, persona=None, extra=None) -> bool:
    """Add one item; returns True if new. Existing items keep their enrichment."""
    text = clean(text)
    if len(text) < 12 or len(text) > 400:
        return False
    i = make_id(text)
    if i in pool:
        return False
    pool[i] = {"id": i, "text": text, "kind": kind, "source": source, "source_url": source_url,
               "license": license, "score": score, "persona": persona, "added": str(date.today()),
               **(extra or {})}
    return True
