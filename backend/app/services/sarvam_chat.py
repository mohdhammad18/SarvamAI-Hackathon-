"""Sarvam-105B tutor messages. The model receives the structured assessment
and may only explain or encourage; it never produces scores. Output is
validated with Pydantic and falls back to deterministic templates."""

from __future__ import annotations

import json
import logging
import re

from pydantic import BaseModel, Field, ValidationError

from ..config import settings
from .sarvam_client import SarvamError, sarvam_request

log = logging.getLogger("bolobuddy.chat")


class TutorFeedback(BaseModel):
    message: str = Field(max_length=400)
    tip: str = Field(max_length=300)
    example_sentence: str | None = Field(default=None, max_length=200)
    source: str = "template"


SYSTEM = (
    "You are BoloBuddy, a warm reading tutor for children aged {age}. "
    "Reply ONLY with a JSON object with keys \"message\", \"tip\" and \"example_sentence\" (all strings). "
    "message: 1-2 short encouraging sentences. tip: one concrete practice tip. "
    "example_sentence: a short new sentence using the first word in words_to_practise_next, in {lang}, or an empty string. "
    "words_to_practise_next are words the child may need more practice on, not words they read well. "
    "Use only the evidence given. Never invent scores. Never say a word was mispronounced; "
    "say 'let's practise' instead. If confidence is low, gently ask the child to try again."
)


def template_feedback(result: dict, name: str) -> TutorFeedback:
    acc = result["word_accuracy_percent"]
    words = result.get("practice_candidates") or []
    if result["assessment_confidence"] == "low":
        return TutorFeedback(
            message=f"Thanks for reading, {name}! I couldn't hear everything clearly.",
            tip="Let's try again in a quiet spot, a little closer to the microphone.",
        )
    msg = (
        f"Wonderful reading, {name}!" if acc >= 90
        else f"Good effort, {name}! You're getting better." if acc >= 70
        else f"Nice try, {name}! Every reading makes you stronger."
    )
    tip = (f"Let's practise the word '{words[0]}' together. Listen first, then say it." if words
           else "Try reading it once more a little faster and smoothly.")
    return TutorFeedback(message=msg, tip=tip)


async def tutor_feedback(result: dict, passage: dict, learner: dict) -> TutorFeedback:
    if not settings.live:
        return template_feedback(result, learner["name"])
    evidence = {
        "passage_title": passage["title"],
        "word_accuracy_percent": result["word_accuracy_percent"],
        "wcpm": result["wcpm"],
        "confidence": result["assessment_confidence"],
        "words_to_practise_next": result["practice_candidates"],
        "warnings": result["warnings"],
    }
    try:
        res = await sarvam_request(
            "POST",
            "/v1/chat/completions",
            json={
                "model": settings.chat_model,
                "messages": [
                    {"role": "system", "content": SYSTEM.format(age=learner["age_band"], lang=passage["language"])},
                    {"role": "user", "content": f"Learner name: {learner['name']}. Evidence: {json.dumps(evidence, ensure_ascii=False)}"},
                ],
                "temperature": 0.4,
                "max_tokens": 600,
                "reasoning_effort": None,
                "response_format": {"type": "json_object"},
            },
            timeout=40,
            retries=1,
        )
        content = res["choices"][0]["message"]["content"] or ""
        match = re.search(r"\{.*\}", content, re.S)
        data = json.loads(match.group(0) if match else content)
        fb = TutorFeedback(message=data["message"], tip=data["tip"],
                           example_sentence=data.get("example_sentence") or None, source=f"sarvam:{settings.chat_model}")
        return fb
    except (SarvamError, ValidationError, ValueError, KeyError, TypeError) as exc:
        log.warning("Tutor LLM fell back to template: %s", type(exc).__name__)
        return template_feedback(result, learner["name"])
