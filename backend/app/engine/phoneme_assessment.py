"""Adapter interface for a future validated acoustic / phoneme assessment model.

No phoneme scores are fabricated. The default provider reports that phoneme
evidence is unavailable; a forced aligner plus validated scoring model can be
plugged in by implementing PhonemeAssessor."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol


@dataclass
class PhonemeEvidence:
    available: bool
    provider: str
    phonemes: list[dict] = field(default_factory=list)
    confidence: float | None = None
    note: str = ""


class PhonemeAssessor(Protocol):
    def assess(self, reference_text: str, audio: bytes, language: str, phonetic_reference: dict | None) -> PhonemeEvidence: ...


class UnavailablePhonemeAssessor:
    def assess(self, reference_text: str, audio: bytes, language: str, phonetic_reference: dict | None = None) -> PhonemeEvidence:
        return PhonemeEvidence(
            available=False,
            provider="none",
            note="Phoneme-level feedback requires a validated forced aligner and scoring model, which is not configured.",
        )


phoneme_assessor: PhonemeAssessor = UnavailablePhonemeAssessor()
