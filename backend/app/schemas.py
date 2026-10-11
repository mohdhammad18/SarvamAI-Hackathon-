from typing import Literal

from pydantic import BaseModel, Field, field_validator

from .languages import BULBUL_LANGS, READING_LANGS


class LearnerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    age_band: Literal["4-6", "6-8", "8-10", "10-12"]
    reading_language: str
    tutor_language: str
    level: int = Field(ge=1, le=5, default=1)
    daily_goal_minutes: int = Field(ge=5, le=60, default=10)

    @field_validator("reading_language", "tutor_language")
    @classmethod
    def supported(cls, v: str) -> str:
        if v not in READING_LANGS:
            raise ValueError("unsupported language")
        return v


class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1000)
    language_code: str
    pace: float = Field(ge=0.5, le=1.5, default=0.9)

    @field_validator("language_code")
    @classmethod
    def supported(cls, v: str) -> str:
        if v not in BULBUL_LANGS:
            raise ValueError("language not supported by Bulbul")
        return v


class ChoiceAttempt(BaseModel):
    attempt_id: str = Field(min_length=8, max_length=64)
    learner_id: str
    item_id: str
    answer: str = Field(max_length=100)
