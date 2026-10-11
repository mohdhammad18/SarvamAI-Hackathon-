"""End-to-end journey against the running backend (live Sarvam).
Uses Bulbul speech as a stand-in for a child's recorded voice.
Run: python scripts/e2e_live.py  (backend must be on :8000)"""

import base64
import sys
import uuid
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.config import settings  # noqa: E402

API = "http://localhost:8000/api/v1"
c = httpx.Client(timeout=90)


def say(text: str, lang: str = "en-IN") -> bytes:
    r = httpx.post(f"{settings.sarvam_base_url}/text-to-speech", timeout=60,
                   headers={"api-subscription-key": settings.sarvam_api_key},
                   json={"text": text, "language_code": lang, "model": "bulbul:v3", "speaker": "aditya", "pace": 1.0})
    r.raise_for_status()
    return base64.b64decode("".join(r.json()["audios"]))


def check(label: str, ok: bool, detail: str = "") -> None:
    print(f"[{'PASS' if ok else 'FAIL'}] {label} {detail}")


learner = c.post(f"{API}/learners", json={"name": "Tester", "age_band": "6-8", "reading_language": "en-IN", "tutor_language": "hi-IN"}).json()
lid = learner["id"]
check("create learner", "id" in learner)

passage = c.get(f"{API}/passages/en-1-cat").json()

# 1. Full correct reading
r = c.post(f"{API}/sessions/assess", data={"learner_id": lid, "passage_id": passage["id"], "duration_seconds": "8"},
           files={"file": ("read.wav", say(passage["text"]), "audio/wav")}).json()
res = r["result"]
check("live STT source", r["stt_source"] == "sarvam:saaras:v4", r["stt_source"])
check("full reading accuracy >= 85%", res["word_accuracy_percent"] >= 85,
      f"acc={res['word_accuracy_percent']} wcpm={res['wcpm']} conf={res['assessment_confidence']} transcript='{r['transcript']}'")
check("tutor feedback", bool(r["feedback"]["message"]), f"source={r['feedback']['source']} msg='{r['feedback']['message']}'")
check("Hindi translated message", bool(r["feedback"].get("translated_message")), r["feedback"].get("translated_message", ""))
check("XP awarded", r["xp_awarded"] > 0, f"+{r['xp_awarded']}")

# 2. Reading with a skipped word ("red")
skipped = passage["text"].replace(" red", "")
r2 = c.post(f"{API}/sessions/assess", data={"learner_id": lid, "passage_id": passage["id"], "duration_seconds": "8"},
            files={"file": ("read2.wav", say(skipped), "audio/wav")}).json()
words = {w["expected"]: w["status"] for w in r2["result"]["words"]}
check("omission detected for 'red'", words.get("red") == "likely_omission", f"status={words.get('red')} transcript='{r2['transcript']}'")

# 3. Hindi reading
hp = c.get(f"{API}/passages/hi-1-aam").json()
hl = c.post(f"{API}/learners", json={"name": "Hindi", "age_band": "6-8", "reading_language": "hi-IN", "tutor_language": "hi-IN"}).json()
r3 = c.post(f"{API}/sessions/assess", data={"learner_id": hl["id"], "passage_id": hp["id"], "duration_seconds": "8"},
            files={"file": ("hi.wav", say(hp["text"], "hi-IN"), "audio/wav")}).json()
check("Hindi reading accuracy >= 80%", r3["result"]["word_accuracy_percent"] >= 80, f"acc={r3['result']['word_accuracy_percent']}")

# 4. TTS endpoint + cache
t1 = c.post(f"{API}/tts", json={"text": "hat", "language_code": "en-IN"})
t2 = c.post(f"{API}/tts", json={"text": "hat", "language_code": "en-IN"})
check("TTS endpoint returns audio", t1.status_code == 200 and len(t1.content) > 1000, f"{len(t1.content)} bytes")
check("TTS cache hit on repeat", t2.headers.get("x-cache") == "HIT")

# 5. Practice: generated from weak words, spoken + choice attempts
pr = c.get(f"{API}/learners/{lid}/practice").json()
check("practice targets weak word", "red" in pr["words"], f"words={pr['words']} source={pr['source']}")
item = next(i for i in pr["items"] if i["type"] == "listen_repeat")
sp = c.post(f"{API}/practice/spoken", data={"attempt_id": str(uuid.uuid4()), "learner_id": lid, "item_id": item["id"], "duration_seconds": "2"},
            files={"file": ("w.wav", say(item["payload"]["word"]), "audio/wav")}).json()
check("spoken practice graded", sp.get("correct") is True, f"heard='{sp.get('heard')}'")
pick = next(i for i in pr["items"] if i["type"] == "pick_word")
aid = str(uuid.uuid4())
body = {"attempt_id": aid, "learner_id": lid, "item_id": pick["id"], "answer": pick["payload"]["word"]}
a1, a2 = c.post(f"{API}/practice/choice", json=body).json(), c.post(f"{API}/practice/choice", json=body).json()
check("choice correct + no double XP", a1["correct"] and a1["xp_awarded"] > 0 and a2["xp_awarded"] == 0)

# 6. Aids, dashboard, parent
aids = c.get(f"{API}/passages/hi-1-aam/aids?tutor_language=en-IN").json()
check("transliteration + translation", bool(aids["transliteration"]) and bool(aids["translation"]),
      f"'{aids['transliteration']}' / '{aids['translation']}'")
d = c.get(f"{API}/learners/{lid}/dashboard").json()
check("dashboard state", d["sessions_count"] == 2 and d["xp"] > 0, f"xp={d['xp']} streak={d['streak']} badges={[a['id'] for a in d['achievements']]}")
check("recommendation", d["recommended"] is not None, d["recommended"]["reason"] if d["recommended"] else "")
p = c.get(f"{API}/parent/overview").json()
check("parent overview", any(x["learner"]["id"] == lid for x in p["learners"]))

# 7. Error handling
bad = c.post(f"{API}/sessions/assess", data={"learner_id": lid, "passage_id": "en-1-cat", "duration_seconds": "0.2"},
             files={"file": ("x.wav", b"0" * 2000, "audio/wav")})
check("rejects too-short audio", bad.status_code == 422, bad.json()["error"]["code"])

for x in (lid, hl["id"]):
    c.delete(f"{API}/learners/{x}")
