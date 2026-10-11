"""Saaras speech-to-text. Uses the synchronous REST endpoint (<=30 s audio)
in verbatim mode so repetitions and fillers are preserved for assessment.
The response contains a transcript and optional phrase-level timestamps;
it does not contain word timestamps or phoneme scores."""

from __future__ import annotations

import json
from dataclasses import dataclass

from ..config import settings
from ..data.passages import get_passage
from .sarvam_client import SarvamError, sarvam_request


@dataclass
class Transcription:
    transcript: str
    language_code: str | None
    speech_duration_seconds: float | None
    source: str  # "sarvam:saaras:v4" | "demo-mock"
    request_id: str | None = None


async def transcribe(audio: bytes, filename: str, mime: str, language: str, keyterms: list[str] | None = None) -> Transcription:
    data = {
        "model": settings.stt_model,
        "mode": "verbatim",
        "language_code": language,
        "with_timestamps": "true",
    }
    if keyterms:
        data["keyterms"] = json.dumps(keyterms[:50], ensure_ascii=False)
    files = {"file": (filename, audio, mime)}
    try:
        res = await sarvam_request("POST", "/speech-to-text", data=data, files=files, timeout=45)
    except SarvamError as exc:
        if exc.status in (400, 422) and "mode" in data:
            data.pop("mode")
            res = await sarvam_request("POST", "/speech-to-text", data=data, files=files, timeout=45)
        else:
            raise
    ts = res.get("timestamps") or {}
    starts, ends = ts.get("start_time_seconds") or [], ts.get("end_time_seconds") or []
    speech = round(max(ends) - min(starts), 2) if starts and ends else None
    return Transcription(
        transcript=res.get("transcript", ""),
        language_code=res.get("language_code"),
        speech_duration_seconds=speech,
        source=f"sarvam:{settings.stt_model}",
        request_id=res.get("request_id"),
    )


def mock_transcribe(passage_id: str) -> Transcription:
    """Demo-mode stand-in. Clearly labelled; drops one word and swaps another
    so the results screen can be explored without live speech recognition."""
    passage = get_passage(passage_id)
    words = passage["text"].split() if passage else []
    if len(words) > 6:
        words.pop(2)
        words[5] = "the"
    return Transcription(" ".join(words), passage["language"] if passage else None, None, "demo-mock")
