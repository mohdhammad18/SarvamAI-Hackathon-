"""Explainable mastery model and lesson selection.

mastery in [0, 1]:
  success: m += 0.25 * (1 - m)
  failure: m -= 0.30 * m
Updates are skipped for low-confidence assessments so one noisy recording
does not mark a learner as weak. Review intervals grow with mastery."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from ..data.passages import PASSAGES, SKILLS

MASTERED = 0.8
DEVELOPING = 0.3


def update_mastery(mastery: float, success: bool) -> float:
    if success:
        return round(mastery + 0.25 * (1 - mastery), 4)
    return round(mastery - 0.30 * mastery, 4)


def next_review(mastery: float, success: bool, now: datetime | None = None) -> datetime:
    now = now or datetime.now(timezone.utc)
    if not success:
        return now + timedelta(minutes=10)
    if mastery < 0.4:
        return now + timedelta(days=1)
    if mastery < MASTERED:
        return now + timedelta(days=2)
    return now + timedelta(days=5)


def skill_state(mastery: float | None) -> str:
    if mastery is None:
        return "upcoming"
    if mastery >= MASTERED:
        return "mastered"
    return "developing"


def recommend_passage(
    language: str,
    level: int,
    skill_rows: list[dict],
    recent_passage_ids: list[str],
    last_accuracy: float | None,
) -> tuple[dict | None, str]:
    """Returns (passage, reason). Priority: weak skills, due reviews, next difficulty."""
    candidates = [p for p in PASSAGES if p["language"] == language]
    if not candidates:
        return None, "No passages available for this language yet."

    target_level = level
    if last_accuracy is not None and last_accuracy >= 95:
        target_level = level + 1
    elif last_accuracy is not None and last_accuracy < 70:
        target_level = max(1, level - 1)

    now = datetime.now(timezone.utc).isoformat()
    weak = {r["skill_id"] for r in skill_rows if r["mastery"] < 0.5 and r["attempts"] >= 2}
    due = {r["skill_id"] for r in skill_rows if r["next_review_at"] and r["next_review_at"] <= now}

    def score(p: dict) -> tuple:
        skills = set(p["skills"])
        return (
            len(skills & weak) * 3 + len(skills & due) * 2,
            -abs(p["level"] - target_level),
            p["id"] not in recent_passage_ids[:2],
        )

    best = max(candidates, key=score)
    hits_weak = set(best["skills"]) & weak
    hits_due = set(best["skills"]) & due
    if hits_weak:
        reason = "Targets a skill you're still building: " + ", ".join(SKILLS[s]["label"] for s in hits_weak if s in SKILLS)
    elif hits_due:
        reason = "Time to review: " + ", ".join(SKILLS[s]["label"] for s in hits_due if s in SKILLS)
    elif best["level"] > level:
        reason = "Great progress! Ready for a slightly harder passage."
    else:
        reason = f"A level {best['level']} passage that matches your reading level."
    return best, reason
