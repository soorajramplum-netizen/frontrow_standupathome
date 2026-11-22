"""Score, filter and tag everything in the pool, offline, with free Hugging Face models.

  python scripts/pool/enrich.py          # only items not enriched yet
  python scripts/pool/enrich.py --all    # redo everything

Adds to each record:
  tox        toxicity scores (unitary/unbiased-toxic-roberta): toxicity, identity_attack, sexual_explicit, threat, insult
  humor      probability the text is a joke (mohameddhiab/humor-no-humor)
  topics     up to 2 topics by embedding similarity to topic prototypes
  fit        persona fit 0-1 for each persona (similarity to that persona's seed lines and voice)
  safe       False if it punches at identity, is sexual, threatening, or very toxic
  quality    one 0-1 number used for ranking (source score, humor, length)
Embeddings are stored separately by export.py.
"""
import json, sys
from pathlib import Path

import numpy as np
import torch
from sentence_transformers import SentenceTransformer
from transformers import pipeline

sys.path.insert(0, str(Path(__file__).parent))
import pool as P

EMBED = "sentence-transformers/all-MiniLM-L6-v2"  # same model the app runs (Xenova/all-MiniLM-L6-v2)
TOX = "unitary/unbiased-toxic-roberta"
HUMOR = "mohameddhiab/humor-no-humor"

TOPICS = {
    "work": "office job, boss, manager, meetings, salary hike, appraisal, layoffs, colleagues, startup, corporate life",
    "money": "money, being broke, rent, loans, savings, bills, expensive, bank balance",
    "love": "dating, crush, girlfriend, boyfriend, breakup, relationships, being single, ex",
    "family": "mom, dad, parents, relatives, siblings, family pressure, aunties",
    "marriage": "marriage, wife, husband, wedding, in-laws, arranged marriage",
    "food": "food, eating, diet, cooking, restaurants, hunger, snacks",
    "health": "doctor, hospital, sick, medicine, pain, symptoms, diagnosis, body",
    "tech": "phone, computer, internet, apps, social media, AI, coding",
    "school": "school, college, exams, teachers, studying, grades, students",
    "self": "self esteem, being lazy, looks, personality, life choices, getting old",
    "friends": "friends, parties, group chats, roommates, hanging out",
    "animals": "dogs, cats, pets, animals, zoo",
    "wordplay": "puns, wordplay, dad jokes, play on words",
}

PERSONA_VOICE = {
    "house": "sarcastic misanthropic doctor diagnosing patients, everybody lies, medicine, symptoms, blunt clinical insult",
    "checkmate": "deadpan dark humour, death, failure, bleak life, awkward pause, chess blunders, losing",
    "corporate": "jokes about office life and not caring: bosses, meetings, appraisals, salary, layoffs, Mondays, naps, snacks, lazy, unbothered, whatever",
    "nofilter": "savage roast, brutal insult comeback, heckler put-down, mocking someone's brag, swearing",
    "wit": "intellectual wit, elegant epigram, paradox, science facts, physics, taking words literally, pedantic correction, clever puns",
}


def is_safe(r) -> bool:
    """Never: identity attacks, sexual content, threats. Swearing is fine for No Filter's own lines only."""
    x = r["tox"]
    if x["identity_attack"] > 0.15 or x["sexual_explicit"] > 0.3 or x["threat"] > 0.3:
        return False
    limit = 0.98 if r.get("persona") == "nofilter" else 0.85
    return x["toxicity"] <= limit


def fit_only(pool):
    """Recompute persona fit for every item (fast: embeddings only)."""
    emb = SentenceTransformer(EMBED, device="cpu")
    items = list(pool.values())
    vec = emb.encode([r["text"] for r in items], batch_size=64, normalize_embeddings=True, show_progress_bar=False)
    persona_vec = {}
    for p, voice in PERSONA_VOICE.items():
        seeds = [r["text"] for r in items if r.get("persona") == p and r["source"] == "original"]
        v = emb.encode([voice] + seeds, normalize_embeddings=True)
        c = v.mean(axis=0)
        persona_vec[p] = c / np.linalg.norm(c)
    for r, v in zip(items, vec):
        r["fit"] = {p: round(float(max(0.0, c @ v)), 3) for p, c in persona_vec.items()}
    P.save(pool)
    print(f"fit recomputed for {len(items)} items")


def main():
    redo = "--all" in sys.argv
    pool = P.load()
    if "--fit-only" in sys.argv:
        return fit_only(pool)
    todo = [r for r in pool.values() if redo or "quality" not in r]
    print(f"{len(todo)} items to enrich (pool {len(pool)})")
    if not todo:
        return
    torch.set_num_threads(max(1, torch.get_num_threads()))
    texts = [r["text"] for r in todo]

    print("toxicity…")
    tox = pipeline("text-classification", model=TOX, top_k=None, truncation=True, max_length=128, device=-1)
    tox_out = tox(texts, batch_size=32)
    print("humor…")
    hum = pipeline("text-classification", model=HUMOR, truncation=True, max_length=128, device=-1)
    hum_out = hum(texts, batch_size=32)

    print("embeddings…")
    emb = SentenceTransformer(EMBED, device="cpu")
    vec = emb.encode(texts, batch_size=64, normalize_embeddings=True, show_progress_bar=False)
    topic_names = list(TOPICS)
    topic_vec = emb.encode(list(TOPICS.values()), normalize_embeddings=True)
    seeds = {p: [r["text"] for r in pool.values() if r.get("persona") == p and r["source"] == "original"] for p in PERSONA_VOICE}
    persona_vec = {}
    for p, voice in PERSONA_VOICE.items():
        v = emb.encode([voice] + seeds[p], normalize_embeddings=True)
        c = v.mean(axis=0)
        persona_vec[p] = c / np.linalg.norm(c)

    for r, t, h, v in zip(todo, tox_out, hum_out, vec):
        scores = {d["label"]: round(float(d["score"]), 3) for d in t}
        r["tox"] = {k: scores.get(k, 0.0) for k in ["toxicity", "identity_attack", "sexual_explicit", "threat", "insult", "obscene"]}
        label = h["label"].lower()
        p_humor = float(h["score"]) if label in ("humor", "label_1", "1", "funny") else 1 - float(h["score"])
        r["humor"] = round(p_humor, 3)
        sims = topic_vec @ v
        order = np.argsort(-sims)
        r["topics"] = sorted(set((r.get("topics") or []) + [topic_names[i] for i in order[:2] if sims[i] > 0.25]))
        r["fit"] = {p: round(float(max(0.0, c @ v)), 3) for p, c in persona_vec.items()}
        x = r["tox"]
        r["safe"] = is_safe(r)
        length = len(r["text"])
        length_ok = 1.0 if length <= 180 else max(0.3, 1 - (length - 180) / 300)
        base = r["score"] if r.get("score") is not None else 0.5
        orig = 0.25 if r["source"] == "original" else 0.0
        r["quality"] = round(min(1.0, 0.45 * p_humor + 0.35 * base + 0.2 * length_ok + orig), 3)

    P.save(pool)
    kept = sum(1 for r in pool.values() if r.get("safe"))
    print(f"done: {len(todo)} enriched; safe {kept} of {len(pool)}")


if __name__ == "__main__":
    main()
