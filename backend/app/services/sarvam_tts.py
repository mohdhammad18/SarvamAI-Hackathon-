"""Bulbul text-to-speech with an on-disk cache keyed by text, language,
model, speaker and pace so reference audio is not re-synthesised."""

from __future__ import annotations

import base64
import hashlib

from ..config import settings
from ..languages import BULBUL_LANGS
from .sarvam_client import SarvamError, sarvam_request


def cache_key(text: str, language: str, model: str, speaker: str, pace: float) -> str:
    raw = f"{model}|{speaker}|{language}|{pace:.2f}|{text}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


async def synthesize(text: str, language: str, pace: float = 0.9) -> tuple[bytes, bool]:
    """Returns (wav_bytes, cache_hit)."""
    if language not in BULBUL_LANGS:
        raise SarvamError(f"Bulbul does not support {language}", status=400, code="unsupported_language")
    key = cache_key(text, language, settings.tts_model, settings.tts_speaker, pace)
    settings.tts_cache_dir.mkdir(parents=True, exist_ok=True)
    path = settings.tts_cache_dir / f"{key}.wav"
    if path.exists():
        return path.read_bytes(), True
    res = await sarvam_request(
        "POST",
        "/text-to-speech",
        json={
            "text": text[:2500],
            "language_code": language,
            "model": settings.tts_model,
            "speaker": settings.tts_speaker,
            "pace": pace,
            "speech_sample_rate": 22050,
        },
        timeout=45,
    )
    audios = res.get("audios") or []
    if not audios:
        raise SarvamError("Bulbul returned no audio")
    wav = base64.b64decode("".join(audios))
    path.write_bytes(wav)
    return wav, False
