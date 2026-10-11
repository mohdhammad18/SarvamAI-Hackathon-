import uuid

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import settings


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "db_path", tmp_path / "test.db")
    monkeypatch.setattr(settings, "force_demo", True)
    from app.main import app
    with TestClient(app) as c:
        yield c


def make_learner(client):
    r = client.post("/api/v1/learners", json={"name": "Asha", "age_band": "6-8", "reading_language": "en-IN", "tutor_language": "en-IN"})
    assert r.status_code == 201
    return r.json()["id"]


AUDIO = ("r.webm", b"\x1a\x45\xdf\xa3" + b"0" * 4000, "audio/webm")


def test_health_reports_demo(client):
    assert client.get("/api/v1/health").json()["mode"] == "demo"


def test_invalid_learner_rejected(client):
    r = client.post("/api/v1/learners", json={"name": "", "age_band": "6-8", "reading_language": "xx", "tutor_language": "en-IN"})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "validation_error"


def test_audio_validation(client):
    lid = make_learner(client)
    base = {"learner_id": lid, "passage_id": "en-1-cat"}
    r = client.post("/api/v1/sessions/assess", data={**base, "duration_seconds": "0.3"}, files={"file": AUDIO})
    assert r.json()["error"]["code"] == "audio_too_short"
    r = client.post("/api/v1/sessions/assess", data={**base, "duration_seconds": "60"}, files={"file": AUDIO})
    assert r.json()["error"]["code"] == "audio_too_long"
    r = client.post("/api/v1/sessions/assess", data={**base, "duration_seconds": "5"}, files={"file": ("a.txt", b"x" * 2000, "text/plain")})
    assert r.status_code == 415


def test_demo_session_is_labelled_and_awards_xp_once(client):
    lid = make_learner(client)
    r = client.post("/api/v1/sessions/assess", data={"learner_id": lid, "passage_id": "en-1-cat", "duration_seconds": "8"}, files={"file": AUDIO})
    body = r.json()
    assert r.status_code == 200
    assert body["is_demo"] is True and body["stt_source"] == "demo-mock"
    assert body["xp_awarded"] > 0
    d1 = client.get(f"/api/v1/learners/{lid}/dashboard").json()
    d2 = client.get(f"/api/v1/learners/{lid}/dashboard").json()
    assert d1["xp"] == d2["xp"]  # refreshing does not re-grant quest XP
    assert d1["sessions_count"] == 1
    assert any(a["id"] == "first_read" for a in d1["achievements"])


def test_practice_attempt_idempotent(client):
    lid = make_learner(client)
    items = client.get(f"/api/v1/learners/{lid}/practice").json()["items"]
    pick = next(i for i in items if i["type"] == "pick_word")
    attempt = {"attempt_id": str(uuid.uuid4()), "learner_id": lid, "item_id": pick["id"], "answer": pick["payload"]["word"]}
    first = client.post("/api/v1/practice/choice", json=attempt).json()
    second = client.post("/api/v1/practice/choice", json=attempt).json()
    assert first["correct"] and first["xp_awarded"] == 5
    assert second["duplicate"] and second["xp_awarded"] == 0


def test_practice_item_scoped_to_learner(client):
    a, b = make_learner(client), make_learner(client)
    item = client.get(f"/api/v1/learners/{a}/practice").json()["items"][0]
    r = client.post("/api/v1/practice/choice", json={"attempt_id": str(uuid.uuid4()), "learner_id": b, "item_id": item["id"], "answer": "x"})
    assert r.status_code == 404


def test_tts_unavailable_in_demo(client):
    r = client.post("/api/v1/tts", json={"text": "hat", "language_code": "en-IN"})
    assert r.status_code == 503 and r.json()["error"]["code"] == "tts_demo_mode"


@pytest.mark.asyncio
async def test_sarvam_retries_then_errors(monkeypatch):
    from app.services import sarvam_client

    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        return httpx.Response(503, json={"error": {"message": "overloaded", "code": "internal_server_error"}})

    monkeypatch.setattr(settings, "sarvam_api_key", "test")
    monkeypatch.setattr(sarvam_client.asyncio, "sleep", lambda *_: _noop())
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as c:
        with pytest.raises(sarvam_client.SarvamError) as exc:
            await sarvam_client.sarvam_request("POST", "/translate", json={}, client=c, retries=2)
    assert calls["n"] == 3 and exc.value.status == 503


async def _noop():
    return None
