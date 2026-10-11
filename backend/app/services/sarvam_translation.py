"""Mayura translation and Sarvam transliteration. Outputs are kept in
separate fields and never replace the canonical passage used for scoring."""

from __future__ import annotations

from ..languages import MAYURA_LANGS
from .sarvam_client import sarvam_request


async def translate(text: str, source: str, target: str) -> str:
    if source == target or target not in MAYURA_LANGS or source not in MAYURA_LANGS:
        return text
    res = await sarvam_request(
        "POST",
        "/translate",
        json={
            "input": text[:1000],
            "source_language_code": source,
            "target_language_code": target,
            "model": "mayura:v1",
            "mode": "formal",
        },
    )
    return res.get("translated_text", text)


async def transliterate_to_roman(text: str, source: str) -> str | None:
    if source == "en-IN":
        return None
    res = await sarvam_request(
        "POST",
        "/transliterate",
        json={"input": text[:1000], "source_language_code": source, "target_language_code": "en-IN"},
    )
    return res.get("transliterated_text")
