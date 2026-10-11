"""Live smoke test against Sarvam APIs (requires SARVAM_API_KEY).
Run: python scripts/smoke_live.py"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import settings  # noqa: E402
from app.services import sarvam_chat, sarvam_stt, sarvam_translation, sarvam_tts  # noqa: E402


async def main() -> None:
    print("live:", settings.live)
    wav, hit = await sarvam_tts.synthesize("The small bird flew away.", "en-IN")
    print("TTS bytes:", len(wav), "cache hit:", hit)
    tr = await sarvam_stt.transcribe(wav, "ref.wav", "audio/wav", "en-IN")
    print("STT transcript:", tr.transcript, "| speech secs:", tr.speech_duration_seconds, "| source:", tr.source)
    print("Translate:", await sarvam_translation.translate("Great reading!", "en-IN", "hi-IN"))
    print("Transliterate:", await sarvam_translation.transliterate_to_roman("राम के पास एक आम है।", "hi-IN"))
    fb = await sarvam_chat.tutor_feedback(
        {"word_accuracy_percent": 90, "wcpm": 60, "assessment_confidence": "high",
         "practice_candidates": ["flew"], "warnings": []},
        {"title": "The Small Bird", "language": "en-IN"},
        {"name": "Asha", "age_band": "6-8"},
    )
    print("Chat:", fb.model_dump())


asyncio.run(main())
