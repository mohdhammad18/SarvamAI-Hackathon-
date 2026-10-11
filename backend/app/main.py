from __future__ import annotations

import json
import logging
import random
import re
import time
import uuid
from collections import defaultdict, deque
from datetime import date, datetime, timedelta, timezone

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from .config import settings
from .data.passages import PASSAGES, SKILLS, get_passage, skills_for_word
from .db import award_xp, connect, init_db
from .engine import adaptive_learning as adaptive
from .engine import gamification as game
from .engine.assessment_engine import assess
from .engine.phoneme_assessment import phoneme_assessor
from .engine.text_alignment import normalize_token, normalized_tokens
from .languages import BULBUL_LANGS, LANGUAGE_NAMES, language_matrix
from .schemas import ChoiceAttempt, LearnerCreate, TTSRequest
from .services import sarvam_chat, sarvam_stt, sarvam_translation, sarvam_tts
from .services.sarvam_client import SarvamError

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("bolobuddy")

app = FastAPI(title="BoloBuddy API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_MIME = {"audio/webm", "audio/ogg", "audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp4", "audio/aac"}
_rate: dict[str, deque] = defaultdict(deque)
_aid_cache: dict[str, dict] = {}


@app.on_event("startup")
def _startup() -> None:
    init_db()
    log.info("BoloBuddy started. Sarvam live mode: %s", settings.live)


def err(status: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status, detail={"code": code, "message": message})


@app.exception_handler(HTTPException)
async def http_exc(_: Request, exc: HTTPException):
    detail = exc.detail if isinstance(exc.detail, dict) else {"code": "error", "message": str(exc.detail)}
    return JSONResponse(status_code=exc.status_code, content={"error": detail})


@app.exception_handler(RequestValidationError)
async def validation_exc(_: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    return JSONResponse(status_code=422, content={"error": {"code": "validation_error", "message": f"{'.'.join(map(str, first.get('loc', [])))}: {first.get('msg', 'invalid')}"}})


def rate_limit(request: Request, bucket: str, limit: int = 30, window: int = 60) -> None:
    key = f"{bucket}:{request.client.host if request.client else 'x'}"
    q, now = _rate[key], time.time()
    while q and q[0] < now - window:
        q.popleft()
    if len(q) >= limit:
        raise err(429, "rate_limited", "Too many requests. Please wait a moment.")
    q.append(now)


def get_learner(conn, learner_id: str) -> dict:
    row = conn.execute("SELECT * FROM learners WHERE id=?", (learner_id,)).fetchone()
    if not row:
        raise err(404, "learner_not_found", "Learner not found")
    return dict(row)


async def read_audio(file: UploadFile, duration_seconds: float) -> tuple[bytes, str]:
    mime = (file.content_type or "").split(";")[0]
    if mime not in ALLOWED_MIME:
        raise err(415, "unsupported_audio", f"Unsupported audio type: {mime or 'unknown'}")
    if duration_seconds < settings.min_audio_seconds:
        raise err(422, "audio_too_short", "The recording is too short. Please read the passage aloud and try again.")
    if duration_seconds > settings.max_audio_seconds + 1:
        raise err(422, "audio_too_long", f"Recordings must be under {int(settings.max_audio_seconds)} seconds.")
    audio = await file.read(settings.max_audio_bytes + 1)
    if len(audio) > settings.max_audio_bytes:
        raise err(413, "audio_too_large", "The recording file is too large.")
    if len(audio) < 1000:
        raise err(422, "audio_empty", "The recording appears to be empty. Check your microphone.")
    return audio, mime


def stt_error(exc: SarvamError) -> HTTPException:
    if exc.status == 429:
        return err(503, "stt_rate_limited", "The speech service is busy. Please try again in a moment.")
    return err(502, "stt_failed", "We couldn't process the recording. No score was recorded. Please try again.")


# ---------------- Meta ----------------

@app.get("/api/v1/health")
def health():
    return {"ok": True, "mode": "live" if settings.live else "demo", "stt_model": settings.stt_model,
            "tts_model": settings.tts_model, "chat_model": settings.chat_model}


@app.get("/api/v1/languages")
def languages():
    return {"languages": language_matrix()}


@app.get("/api/v1/passages")
def passages(language: str | None = None):
    items = [p for p in PASSAGES if not language or p["language"] == language]
    return {"passages": [{**p, "word_count": len(normalized_tokens(p["text"], p["language"]))} for p in items]}


@app.get("/api/v1/passages/{passage_id}")
def passage(passage_id: str):
    p = get_passage(passage_id)
    if not p:
        raise err(404, "passage_not_found", "Passage not found")
    return {**p, "word_count": len(normalized_tokens(p["text"], p["language"])),
            "sentences": [s.strip() for s in re.split(r"(?<=[.!?।])\s+", p["text"]) if s.strip()]}


@app.get("/api/v1/passages/{passage_id}/aids")
async def passage_aids(passage_id: str, tutor_language: str = "en-IN"):
    """Translation and transliteration shown beside (never instead of) the canonical text."""
    p = get_passage(passage_id)
    if not p:
        raise err(404, "passage_not_found", "Passage not found")
    key = f"{passage_id}:{tutor_language}"
    if key in _aid_cache:
        return _aid_cache[key]
    out = {"canonical_text": p["text"], "translation": None, "transliteration": None, "source": "none"}
    if settings.live:
        try:
            if tutor_language != p["language"]:
                out["translation"] = await sarvam_translation.translate(p["text"], p["language"], tutor_language)
            out["transliteration"] = await sarvam_translation.transliterate_to_roman(p["text"], p["language"])
            out["source"] = "sarvam"
        except SarvamError as exc:
            out["source"] = f"unavailable: {exc}"
    _aid_cache[key] = out
    return out


# ---------------- Learners ----------------

@app.post("/api/v1/learners", status_code=201)
def create_learner(body: LearnerCreate):
    lid = str(uuid.uuid4())
    with connect() as c:
        c.execute(
            "INSERT INTO learners (id,name,age_band,reading_language,tutor_language,level,daily_goal_minutes) VALUES (?,?,?,?,?,?,?)",
            (lid, body.name.strip(), body.age_band, body.reading_language, body.tutor_language, body.level, body.daily_goal_minutes),
        )
        return get_learner(c, lid)


@app.get("/api/v1/learners")
def list_learners():
    with connect() as c:
        return {"learners": [dict(r) for r in c.execute("SELECT * FROM learners ORDER BY created_at DESC")]}


@app.delete("/api/v1/learners/{learner_id}")
def delete_learner(learner_id: str):
    with connect() as c:
        get_learner(c, learner_id)
        c.execute("DELETE FROM learners WHERE id=?", (learner_id,))
    return {"deleted": True}


GREETINGS = {
    "morning": "Good morning, {name}! Ready to read a story with me today?",
    "default": "Hi {name}! I'm BoloBuddy. Let's read something fun together!",
}


@app.get("/api/v1/learners/{learner_id}/greeting")
async def greeting(learner_id: str):
    with connect() as c:
        learner = get_learner(c, learner_id)
    text = GREETINGS["morning" if datetime.now().hour < 12 else "default"].format(name=learner["name"])
    lang = learner["tutor_language"]
    source = "template"
    if settings.live and lang != "en-IN":
        key = f"greet:{text}:{lang}"
        try:
            if key not in _aid_cache:
                _aid_cache[key] = {"t": await sarvam_translation.translate(text, "en-IN", lang)}
            text, source = _aid_cache[key]["t"], "sarvam:mayura:v1"
        except SarvamError:
            lang = "en-IN"
    return {"text": text, "language": lang if lang in BULBUL_LANGS else "en-IN", "source": source}


def learner_stats(c, learner_id: str) -> dict:
    sessions = [dict(r) for r in c.execute(
        "SELECT * FROM practice_sessions WHERE learner_id=? AND status='complete' ORDER BY created_at DESC", (learner_id,))]
    attempts = [dict(r) for r in c.execute("SELECT * FROM practice_attempts WHERE learner_id=?", (learner_id,))]
    xp = c.execute("SELECT COALESCE(SUM(amount),0) FROM xp_transactions WHERE learner_id=?", (learner_id,)).fetchone()[0]
    days = {datetime.fromisoformat(s["created_at"]).date() for s in sessions} | {
        datetime.fromisoformat(a["created_at"]).date() for a in attempts}
    today = datetime.now(timezone.utc).date()
    results = [(s, json.loads(s["result_json"])) for s in sessions]
    confident = [r for _, r in results if r["assessment_confidence"] != "low"]
    today_conf = [r for s, r in results if datetime.fromisoformat(s["created_at"]).date() == today and r["assessment_confidence"] != "low"]
    return {
        "sessions_list": sessions, "results": results, "xp": xp,
        "sessions": len(sessions), "practice_attempts": len(attempts),
        "streak": game.streak(days, today),
        "best_confident_accuracy": max((r["word_accuracy_percent"] for r in confident), default=0),
        "practice_seconds": sum(s["duration_seconds"] or 0 for s in sessions),
        "today": {
            "sessions": sum(1 for s in sessions if datetime.fromisoformat(s["created_at"]).date() == today),
            "practice_attempts": sum(1 for a in attempts if datetime.fromisoformat(a["created_at"]).date() == today),
            "best_confident_accuracy": max((r["word_accuracy_percent"] for r in today_conf), default=0),
        },
        "days": days,
    }


def sync_rewards(c, learner_id: str, stats: dict) -> None:
    """Grant achievements and quest XP derived from persisted activity (idempotent)."""
    for aid in game.earned_achievements(stats):
        c.execute("INSERT OR IGNORE INTO learner_achievements (learner_id, achievement_id) VALUES (?,?)", (learner_id, aid))
    day = datetime.now(timezone.utc).date().isoformat()
    for q in game.quest_progress(stats["today"]):
        if q["done"]:
            award_xp(c, learner_id, q["xp"], f"Quest: {q['title']}", f"quest:{q['id']}:{day}")


@app.get("/api/v1/learners/{learner_id}/dashboard")
def dashboard(learner_id: str):
    with connect() as c:
        learner = get_learner(c, learner_id)
        stats = learner_stats(c, learner_id)
        sync_rewards(c, learner_id, stats)
        stats["xp"] = c.execute("SELECT COALESCE(SUM(amount),0) FROM xp_transactions WHERE learner_id=?", (learner_id,)).fetchone()[0]
        skills = [dict(r) for r in c.execute("SELECT * FROM learner_skill_mastery WHERE learner_id=?", (learner_id,))]
        achievements = [dict(r) for r in c.execute("SELECT * FROM learner_achievements WHERE learner_id=? ORDER BY earned_at DESC", (learner_id,))]

    lang = learner["reading_language"]
    last_acc = next((r["word_accuracy_percent"] for _, r in stats["results"] if r["assessment_confidence"] != "low"), None)
    recent_ids = [s["passage_id"] for s in stats["sessions_list"]]
    rec, reason = adaptive.recommend_passage(lang, learner["level"], skills, recent_ids, last_acc)

    by_skill = {s["skill_id"]: s for s in skills}
    skill_map = [
        {"id": sid, "label": meta["label"], "level": meta["level"],
         "mastery": by_skill[sid]["mastery"] if sid in by_skill else None,
         "state": adaptive.skill_state(by_skill[sid]["mastery"] if sid in by_skill else None)}
        for sid, meta in SKILLS.items() if sid.startswith(lang.split("-")[0] + ":")
    ]
    today = datetime.now(timezone.utc).date()
    week = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        day_results = [r for s, r in stats["results"] if datetime.fromisoformat(s["created_at"]).date() == d]
        week.append({"day": d.strftime("%a"), "date": d.isoformat(), "readings": len(day_results),
                     "minutes": round(sum(r["reading_duration_seconds"] for r in day_results) / 60, 1)})
    trend = [
        {"date": s["created_at"][:16], "passage": s["passage_id"], "accuracy": r["word_accuracy_percent"],
         "wcpm": r["wcpm"], "confidence": r["assessment_confidence"]}
        for s, r in reversed(stats["results"][:20])
    ]
    weak_words = [s["skill_id"].split(":", 2)[2] for s in sorted(skills, key=lambda s: s["mastery"])
                  if s["skill_id"].startswith("word:") and s["mastery"] < adaptive.MASTERED][:8]
    return {
        "learner": learner,
        "xp": stats["xp"], **game.level_for(stats["xp"]),
        "streak": stats["streak"],
        "total_practice_minutes": round(stats["practice_seconds"] / 60, 1),
        "sessions_count": stats["sessions"],
        "practice_attempts": stats["practice_attempts"],
        "quests": game.quest_progress(stats["today"]),
        "achievements": [{**game.ACHIEVEMENTS[a["achievement_id"]], "id": a["achievement_id"], "earned_at": a["earned_at"]} for a in achievements],
        "all_achievements": [{"id": k, **v} for k, v in game.ACHIEVEMENTS.items()],
        "recommended": {"passage": rec, "reason": reason, "estimated_minutes": 3} if rec else None,
        "skills": skill_map,
        "weak_words": weak_words,
        "week": week,
        "trend": trend,
        "active_days": sorted(d.isoformat() for d in stats["days"]),
        "recent_sessions": [
            {"id": s["id"], "passage_id": s["passage_id"], "title": (get_passage(s["passage_id"]) or {}).get("title"),
             "created_at": s["created_at"], "accuracy": r["word_accuracy_percent"], "wcpm": r["wcpm"],
             "confidence": r["assessment_confidence"], "source": s["stt_source"]}
            for s, r in stats["results"][:10]
        ],
    }


# ---------------- Reading assessment ----------------

def update_skills_from_assessment(c, learner_id: str, language: str, result: dict) -> None:
    if result["assessment_confidence"] == "low":
        return
    now = datetime.now(timezone.utc)
    per_skill: dict[str, list[bool]] = defaultdict(list)
    existing_words = {r[0] for r in c.execute(
        "SELECT skill_id FROM learner_skill_mastery WHERE learner_id=? AND skill_id LIKE 'word:%'", (learner_id,))}
    for w in result["words"]:
        if w["status"] in ("uncertain", "not_attempted"):
            continue
        ok = w["status"] == "correct"
        for sk in skills_for_word(w["expected"], language):
            per_skill[sk].append(ok)
        word_skill = f"word:{language}:{w['expected']}"
        if not ok or word_skill in existing_words:
            per_skill[word_skill].append(ok)
    for sk, outcomes in per_skill.items():
        success = sum(outcomes) / len(outcomes) >= 0.8
        apply_mastery(c, learner_id, sk, language, success, now)


def apply_mastery(c, learner_id: str, skill_id: str, language: str, success: bool, now: datetime) -> None:
    row = c.execute("SELECT * FROM learner_skill_mastery WHERE learner_id=? AND skill_id=?", (learner_id, skill_id)).fetchone()
    m = row["mastery"] if row else 0.3
    new_m = adaptive.update_mastery(m, success)
    nxt = adaptive.next_review(new_m, success, now).isoformat()
    c.execute(
        """INSERT INTO learner_skill_mastery (learner_id, skill_id, language, mastery, attempts, successes, last_practiced_at, next_review_at)
           VALUES (?,?,?,?,1,?,?,?)
           ON CONFLICT(learner_id, skill_id) DO UPDATE SET mastery=excluded.mastery, attempts=attempts+1,
           successes=successes+excluded.successes, last_practiced_at=excluded.last_practiced_at, next_review_at=excluded.next_review_at""",
        (learner_id, skill_id, language, new_m, int(success), now.isoformat(), nxt),
    )


@app.post("/api/v1/sessions/assess")
async def assess_reading(
    request: Request,
    learner_id: str = Form(...),
    passage_id: str = Form(...),
    duration_seconds: float = Form(...),
    file: UploadFile = File(...),
):
    rate_limit(request, "assess", 20)
    p = get_passage(passage_id)
    if not p:
        raise err(404, "passage_not_found", "Passage not found")
    with connect() as c:
        learner = get_learner(c, learner_id)
    audio, mime = await read_audio(file, duration_seconds)

    if settings.live:
        try:
            tr = await sarvam_stt.transcribe(audio, file.filename or "reading.webm", mime, p["language"], p["target_words"])
        except SarvamError as exc:
            raise stt_error(exc)
    else:
        tr = sarvam_stt.mock_transcribe(passage_id)
    del audio  # raw audio is processed in memory and never stored

    # Prefer the speech span from STT timestamps over the client timer.
    duration = tr.speech_duration_seconds if tr.speech_duration_seconds and tr.speech_duration_seconds > 1 else duration_seconds
    result = assess(p["text"], tr.transcript, duration, p["language"]).to_dict()
    result["phoneme_evidence"] = phoneme_assessor.assess(p["text"], b"", p["language"], None).__dict__
    feedback = (await sarvam_chat.tutor_feedback(result, p, learner)).model_dump()
    if settings.live and learner["tutor_language"] != "en-IN" and feedback["source"] == "template":
        try:
            feedback["translated_message"] = await sarvam_translation.translate(
                f"{feedback['message']} {feedback['tip']}", "en-IN", learner["tutor_language"])
        except SarvamError:
            pass

    sid = str(uuid.uuid4())
    with connect() as c:
        c.execute(
            "INSERT INTO practice_sessions (id, learner_id, passage_id, status, transcript, stt_source, duration_seconds, result_json, feedback_json) VALUES (?,?,?,?,?,?,?,?,?)",
            (sid, learner_id, passage_id, "complete", tr.transcript, tr.source, duration, json.dumps(result, ensure_ascii=False), json.dumps(feedback, ensure_ascii=False)),
        )
        c.executemany(
            "INSERT INTO word_assessments (session_id, word_index, expected, recognized, status) VALUES (?,?,?,?,?)",
            [(sid, w["index"], w["expected"], w["recognized"], w["status"]) for w in result["words"]],
        )
        update_skills_from_assessment(c, learner_id, p["language"], result)
        xp = game.reading_xp(result["word_accuracy_percent"], result["assessment_confidence"])
        granted = award_xp(c, learner_id, xp, f"Read '{p['title']}'", f"session:{sid}")
        stats = learner_stats(c, learner_id)
        before = {r[0] for r in c.execute("SELECT achievement_id FROM learner_achievements WHERE learner_id=?", (learner_id,))}
        sync_rewards(c, learner_id, stats)
        after = {r[0] for r in c.execute("SELECT achievement_id FROM learner_achievements WHERE learner_id=?", (learner_id,))}

    return {
        "session_id": sid, "passage": p, "transcript": tr.transcript, "stt_source": tr.source,
        "is_demo": tr.source == "demo-mock", "result": result, "feedback": feedback,
        "xp_awarded": xp if granted else 0,
        "new_achievements": [{"id": a, **game.ACHIEVEMENTS[a]} for a in after - before],
    }


@app.get("/api/v1/sessions/{session_id}")
def get_session(session_id: str):
    with connect() as c:
        row = c.execute("SELECT * FROM practice_sessions WHERE id=?", (session_id,)).fetchone()
    if not row:
        raise err(404, "session_not_found", "Session not found")
    s = dict(row)
    return {"session_id": s["id"], "passage": get_passage(s["passage_id"]), "transcript": s["transcript"],
            "stt_source": s["stt_source"], "is_demo": s["stt_source"] == "demo-mock",
            "result": json.loads(s["result_json"]), "feedback": json.loads(s["feedback_json"]), "xp_awarded": 0, "new_achievements": []}


# ---------------- TTS ----------------

@app.post("/api/v1/tts")
async def tts(body: TTSRequest, request: Request):
    rate_limit(request, "tts", 60)
    if not settings.live:
        raise err(503, "tts_demo_mode", "Sarvam voice is unavailable in demo mode.")
    try:
        wav, hit = await sarvam_tts.synthesize(body.text, body.language_code, body.pace)
    except SarvamError as exc:
        raise err(502, "tts_failed", f"Could not generate speech: {exc}")
    return Response(content=wav, media_type="audio/wav", headers={"X-Cache": "HIT" if hit else "MISS"})


# ---------------- Practice ----------------

def sentence_with(word: str, language: str) -> str | None:
    for p in PASSAGES:
        if p["language"] != language:
            continue
        for s in re.split(r"(?<=[.!?।])\s+", p["text"]):
            if word in normalized_tokens(s, language):
                return s.strip()
    return None


@app.get("/api/v1/learners/{learner_id}/practice")
def generate_practice(learner_id: str):
    with connect() as c:
        learner = get_learner(c, learner_id)
        lang = learner["reading_language"]
        rows = [dict(r) for r in c.execute(
            "SELECT * FROM learner_skill_mastery WHERE learner_id=? AND skill_id LIKE 'word:%' AND mastery < ? ORDER BY next_review_at, mastery LIMIT 3",
            (learner_id, adaptive.MASTERED))]
        words = [r["skill_id"].split(":", 2)[2] for r in rows]
        source = "your recent readings"
        if not words:
            pool = [w for p in PASSAGES if p["language"] == lang and p["level"] <= learner["level"] + 1 for w in p["target_words"]]
            words = random.sample(pool, min(3, len(pool)))
            source = "starter word list"
        vocab = list({w for p in PASSAGES if p["language"] == lang for w in normalized_tokens(p["text"], lang) if len(w) > 2})
        items = []
        for w in words:
            distractors = sorted((v for v in vocab if v != w), key=lambda v: (abs(len(v) - len(w)), random.random()))[:2]
            options = random.sample([w, *distractors], k=len(distractors) + 1)
            sent = sentence_with(w, lang)
            specs = [("listen_repeat", {"word": w})]
            specs.append(("pick_word", {"options": options}))
            if sent:
                blanked = " ".join("____" if normalize_token(t, lang) == w else t for t in sent.split())
                specs.append(("missing_word", {"sentence": blanked, "full_sentence": sent, "options": options}))
                specs.append(("read_sentence", {"sentence": sent}))
            for typ, payload in specs:
                iid = str(uuid.uuid4())
                payload = {**payload, "word": w}
                c.execute("INSERT INTO practice_items (id, learner_id, type, target_word, language, payload_json, answer) VALUES (?,?,?,?,?,?,?)",
                          (iid, learner_id, typ, w, lang, json.dumps(payload, ensure_ascii=False), w))
                items.append({"id": iid, "type": typ, "language": lang, "payload": payload})
    order = {"listen_repeat": 0, "pick_word": 1, "missing_word": 2, "read_sentence": 3}
    items.sort(key=lambda i: order[i["type"]])
    return {"items": items, "words": words, "source": source,
            "phoneme_feedback": "unavailable — requires a validated acoustic model"}


def record_attempt(c, learner_id: str, attempt_id: str, item: dict, correct: bool, response: str, source: str) -> dict:
    existing = c.execute("SELECT * FROM practice_attempts WHERE id=?", (attempt_id,)).fetchone()
    if existing:
        return {"correct": bool(existing["correct"]), "xp_awarded": 0, "duplicate": True}
    c.execute("INSERT INTO practice_attempts (id, learner_id, item_id, correct, response, source) VALUES (?,?,?,?,?,?)",
              (attempt_id, learner_id, item["id"], int(correct), response, source))
    if source != "demo-mock":
        apply_mastery(c, learner_id, f"word:{item['language']}:{item['target_word']}", item["language"], correct, datetime.now(timezone.utc))
    xp = game.practice_xp(correct)
    granted = award_xp(c, learner_id, xp, f"Practice: {item['target_word']}", f"practice:{attempt_id}")
    sync_rewards(c, learner_id, learner_stats(c, learner_id))
    return {"correct": correct, "xp_awarded": xp if granted else 0, "duplicate": False}


def get_item(c, item_id: str, learner_id: str) -> dict:
    row = c.execute("SELECT * FROM practice_items WHERE id=? AND learner_id=?", (item_id, learner_id)).fetchone()
    if not row:
        raise err(404, "item_not_found", "Practice item not found")
    return dict(row)


@app.post("/api/v1/practice/choice")
def practice_choice(body: ChoiceAttempt):
    with connect() as c:
        get_learner(c, body.learner_id)
        item = get_item(c, body.item_id, body.learner_id)
        correct = normalize_token(body.answer, item["language"]) == item["answer"]
        out = record_attempt(c, body.learner_id, body.attempt_id, item, correct, body.answer, "choice")
    return {**out, "answer": item["answer"]}


@app.post("/api/v1/practice/spoken")
async def practice_spoken(
    request: Request,
    attempt_id: str = Form(...),
    learner_id: str = Form(...),
    item_id: str = Form(...),
    duration_seconds: float = Form(...),
    file: UploadFile = File(...),
):
    rate_limit(request, "assess", 30)
    with connect() as c:
        get_learner(c, learner_id)
        item = get_item(c, item_id, learner_id)
    payload = json.loads(item["payload_json"])
    audio, mime = await read_audio(file, duration_seconds)
    if settings.live:
        try:
            tr = await sarvam_stt.transcribe(audio, file.filename or "attempt.webm", mime, item["language"], [item["target_word"]])
        except SarvamError as exc:
            raise stt_error(exc)
        heard, source = tr.transcript, tr.source
    else:
        heard, source = payload.get("sentence", item["target_word"]), "demo-mock"
    tokens = normalized_tokens(heard, item["language"])
    if item["type"] == "read_sentence":
        r = assess(payload["sentence"], heard, duration_seconds, item["language"])
        correct = r.word_accuracy_percent >= 80 and r.assessment_confidence != "low"
        detail = {"accuracy": r.word_accuracy_percent, "confidence": r.assessment_confidence}
    else:
        correct = item["target_word"] in tokens
        detail = {}
    uncertain = not tokens
    with connect() as c:
        out = record_attempt(c, learner_id, attempt_id, item, correct, heard, source) if not uncertain else {"correct": False, "xp_awarded": 0, "duplicate": False}
    return {**out, "heard": heard, "uncertain": uncertain, "source": source, "is_demo": source == "demo-mock", **detail}


# ---------------- Parent / teacher ----------------

@app.get("/api/v1/parent/overview")
def parent_overview():
    out = []
    with connect() as c:
        for l in c.execute("SELECT * FROM learners ORDER BY created_at DESC").fetchall():
            l = dict(l)
            stats = learner_stats(c, l["id"])
            results = stats["results"]
            difficult = [dict(r) for r in c.execute(
                "SELECT skill_id, mastery, attempts FROM learner_skill_mastery WHERE learner_id=? AND mastery < ? ORDER BY mastery LIMIT 8",
                (l["id"], adaptive.MASTERED))]
            week_ago = datetime.now(timezone.utc).date() - timedelta(days=7)
            out.append({
                "learner": l,
                "xp": stats["xp"], "streak": stats["streak"],
                "sessions_total": stats["sessions"],
                "sessions_last_7_days": sum(1 for s, _ in results if datetime.fromisoformat(s["created_at"]).date() >= week_ago),
                "practice_attempts": stats["practice_attempts"],
                "trend": [{"date": s["created_at"][:10], "accuracy": r["word_accuracy_percent"], "wcpm": r["wcpm"],
                           "confidence": r["assessment_confidence"], "passage": s["passage_id"], "source": s["stt_source"]}
                          for s, r in reversed(results[:15])],
                "difficult_words": [d["skill_id"].split(":", 2)[2] for d in difficult if d["skill_id"].startswith("word:")],
                "developing_skills": [SKILLS[d["skill_id"]]["label"] for d in difficult if d["skill_id"] in SKILLS],
                "recommended": adaptive.recommend_passage(
                    l["reading_language"], l["level"],
                    [dict(r) for r in c.execute("SELECT * FROM learner_skill_mastery WHERE learner_id=?", (l["id"],))],
                    [s["passage_id"] for s, _ in results],
                    next((r["word_accuracy_percent"] for _, r in results if r["assessment_confidence"] != "low"), None),
                )[1],
            })
    return {"learners": out, "note": "All scores are automated estimates from speech recognition, not validated educator assessments."}
