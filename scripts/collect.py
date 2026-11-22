"""Find the top videos per comic and pull their transcripts (with timestamps).

Raw transcripts stay in data/raw (git-ignored): they are inspiration only and
are never served as-is by the app.

Run:  python scripts/collect.py            (find + fetch, resumes where it stopped)
      python scripts/collect.py --find     (only build data/videos.json)
"""
import json, random, re, sys, time
from pathlib import Path

import yt_dlp
from youtube_transcript_api import YouTubeTranscriptApi

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "pool"))
from pool import DATA  # build data lives in this project's data/ folder (kept off GitHub)

RAW = DATA / "raw"
VIDEOS = DATA / "videos.json"
PER_COMIC = 10

# match = lowercase substrings that must appear in the channel name (None = any channel)
COMICS = [
    # India
    {"id": "gautam-govindan", "name": "Gautam Govindan", "q": ["Gautham Govindan stand up comedy", "Gautham Govindan comedy"], "match": ["gautham govindan"], "region": "india"},
    {"id": "tarang-hardikar", "name": "Tarang Hardikar", "q": ["Tarang Hardikar stand up comedy"], "match": ["tarang"], "region": "india"},
    {"id": "kenny-sebastian", "name": "Kenny Sebastian", "q": ["Kenny Sebastian stand up comedy"], "match": ["kenny sebastian"], "region": "india"},
    {"id": "anubhav-bassi", "name": "Anubhav Singh Bassi", "q": ["Anubhav Singh Bassi stand up comedy"], "match": ["bassi"], "region": "india"},
    {"id": "rahul-subramanian", "name": "Rahul Subramanian", "q": ["Rahul Subramanian stand up comedy"], "match": ["rahul subramanian"], "region": "india"},
    {"id": "samay-raina", "name": "Samay Raina", "q": ["Samay Raina stand up comedy", "Samay Raina standup", "Samay Raina comedy premium league"], "match": ["samay raina", "netflix india", "prime video india"], "min_sec": 90, "region": "india"},
    {"id": "aakash-gupta", "name": "Aakash Gupta", "q": ["Aakash Gupta stand up comedy"], "match": ["aakash gupta"], "region": "india"},
    {"id": "good-work", "name": "Good Work (office parody)", "channel": "https://www.youtube.com/channel/UC_-hYjoNe4PJNFa9iZ4lraA/videos", "q": [], "match": None, "region": "india"},
    # International
    {"id": "akaash-singh", "name": "Akaash Singh", "q": ["Akaash Singh stand up", "Akaash Singh crowd work"], "match": ["akaash singh"], "region": "intl"},
    {"id": "jimmy-carr", "name": "Jimmy Carr", "q": ["Jimmy Carr heckler crowd work", "Jimmy Carr stand up"], "match": ["jimmy carr"], "region": "intl"},
    {"id": "trevor-noah", "name": "Trevor Noah", "q": ["Trevor Noah stand up comedy"], "match": ["trevor noah", "netflix is a joke"], "region": "intl"},
    {"id": "russell-peters", "name": "Russell Peters", "q": ["Russell Peters stand up comedy"], "match": ["russell peters"], "region": "intl"},
    {"id": "bill-burr", "name": "Bill Burr", "q": ["Bill Burr stand up comedy"], "match": ["bill burr", "netflix is a joke", "comedy central"], "region": "intl"},
    {"id": "john-mulaney", "name": "John Mulaney", "q": ["John Mulaney stand up comedy"], "match": ["mulaney", "netflix is a joke", "comedy central", "saturday night live", "respect"], "title_has": ["mulaney"], "region": "intl"},
    {"id": "dr-house", "name": "Dr. House (House MD)", "q": ["House MD best comebacks", "House MD savage moments", "Dr House sarcasm compilation"], "match": None, "region": "intl", "title_has": ["house"]},
]

MIN_SEC, MAX_SEC = 150, 3 * 3600  # skip Shorts and multi-hour streams
SKIP_TITLE = re.compile(r"podcast|reaction|interview|trailer|#shorts|live stream|latent", re.I)


def search(query, n=60):
    opts = {"quiet": True, "extract_flat": True, "skip_download": True, "noplaylist": True}
    with yt_dlp.YoutubeDL(opts) as ydl:
        res = ydl.extract_info(f"ytsearch{n}:{query}", download=False)
    return res.get("entries") or []


def find_videos():
    found = json.loads(VIDEOS.read_text(encoding="utf-8")) if VIDEOS.exists() else {}
    for c in COMICS:
        if len(found.get(c["id"], [])) >= PER_COMIC:
            continue
        pool = {}
        lists = [search(q) for q in c["q"]]
        if c.get("channel"):
            with yt_dlp.YoutubeDL({"quiet": True, "extract_flat": True, "playlistend": 200}) as ydl:
                lists.append(ydl.extract_info(c["channel"], download=False).get("entries") or [])
        for entries in lists:
            for e in entries:
                vid, ch, title = e.get("id"), (e.get("channel") or "").lower(), e.get("title") or ""
                dur, views = e.get("duration") or 0, e.get("view_count") or 0
                if not vid or not (c.get("min_sec", MIN_SEC) <= dur <= MAX_SEC) or SKIP_TITLE.search(title):
                    continue
                if c["match"] and not any(m in ch for m in c["match"]):
                    continue
                if c.get("title_has") and not any(t in title.lower() for t in c["title_has"]):
                    continue
                pool[vid] = {"id": vid, "title": title, "channel": e.get("channel"), "views": views, "duration": dur}
            time.sleep(random.uniform(2, 4))
        top = sorted(pool.values(), key=lambda v: v["views"], reverse=True)[:PER_COMIC]
        found[c["id"]] = top
        print(f"{c['name']:28} {len(top):2} videos  (top: {top[0]['views']:,} views)" if top else f"{c['name']:28}  0 videos")
        VIDEOS.write_text(json.dumps(found, indent=1, ensure_ascii=False), encoding="utf-8")
    return found


def fetch_transcript(vid):
    tracks = YouTubeTranscriptApi().list(vid)
    langs = [t.language_code for t in tracks]
    pick = next((l for l in ["en", "en-IN", "en-US", "en-GB"] if l in langs), None)
    tr = tracks.find_transcript([pick]) if pick else tracks.find_transcript([langs[0]])
    original = tr.language_code
    if not original.startswith("en") and tr.is_translatable:
        try:
            tr = tr.translate("en")
        except Exception:
            pass
    segs = [{"t": round(s.start, 1), "d": round(s.duration, 1), "text": s.text} for s in tr.fetch()]
    return {"lang": original, "translated": tr.language_code != original, "generated": tr.is_generated, "segments": segs}


def fetch_all(found):
    todo = [(cid, v) for cid, vs in found.items() for v in vs if not (RAW / cid / f"{v['id']}.json").exists()]
    print(f"\n{len(todo)} transcripts to fetch")
    ok = fail = 0
    for i, (cid, v) in enumerate(todo, 1):
        out = RAW / cid / f"{v['id']}.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        try:
            data = fetch_transcript(v["id"])
            laughs = sum(len(re.findall(r"\[(laughter|laughs|applause|audience laughing)\]", s["text"], re.I)) for s in data["segments"])
            out.write_text(json.dumps({**v, "comic": cid, **data, "laugh_tags": laughs}, ensure_ascii=False), encoding="utf-8")
            ok += 1
            print(f"[{i}/{len(todo)}] ok   {cid:18} {v['id']} {data['lang']:5} laughs={laughs:3}  {v['title'][:50]}")
        except Exception as e:
            fail += 1
            print(f"[{i}/{len(todo)}] FAIL {cid:18} {v['id']} {type(e).__name__}")
            if "IpBlocked" in type(e).__name__ or "RequestBlocked" in type(e).__name__:
                print("YouTube is blocking requests from this IP. Stopping; rerun later to resume.")
                break
        time.sleep(random.uniform(15, 30))  # slower after an IP block on 22 Nov at ~20 fetches
    print(f"\ndone: {ok} ok, {fail} failed")


if __name__ == "__main__":
    vids = find_videos()
    if "--find" not in sys.argv:
        fetch_all(vids)
