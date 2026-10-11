"""Server-side reward rules. XP is only granted through idempotency keys tied
to completed activities, so refreshing or replaying a request cannot claim
the same reward twice."""

from __future__ import annotations

from datetime import date, timedelta

XP_PER_LEVEL = 100

ACHIEVEMENTS = {
    "first_read": {"title": "First Steps", "description": "Completed your first reading."},
    "five_reads": {"title": "Bookworm", "description": "Completed five readings."},
    "accuracy_90": {"title": "Sharp Reader", "description": "Scored 90% accuracy on a confident reading."},
    "streak_3": {"title": "On a Roll", "description": "Practised three days in a row."},
    "practice_10": {"title": "Word Wizard", "description": "Completed ten practice exercises."},
}

DAILY_QUESTS = {
    "read_1": {"title": "Read one passage", "target": 1, "xp": 10},
    "practice_3": {"title": "Practise three words", "target": 3, "xp": 10},
    "accuracy_85": {"title": "Read with 85% accuracy", "target": 1, "xp": 15},
}


def reading_xp(accuracy: float, confidence: str) -> int:
    base = 20
    if confidence == "low":
        return 5  # effort reward only; no score bonus for unreliable results
    return base + int(accuracy // 10)


def practice_xp(correct: bool) -> int:
    return 5 if correct else 2


def level_for(xp: int) -> dict:
    lvl = xp // XP_PER_LEVEL + 1
    return {"level": lvl, "xp_into_level": xp % XP_PER_LEVEL, "xp_for_next": XP_PER_LEVEL}


def streak(active_days: set[date], today: date | None = None) -> int:
    today = today or date.today()
    day = today if today in active_days else today - timedelta(days=1)
    count = 0
    while day in active_days:
        count += 1
        day -= timedelta(days=1)
    return count


def earned_achievements(stats: dict) -> list[str]:
    earned = []
    if stats["sessions"] >= 1:
        earned.append("first_read")
    if stats["sessions"] >= 5:
        earned.append("five_reads")
    if stats["best_confident_accuracy"] >= 90:
        earned.append("accuracy_90")
    if stats["streak"] >= 3:
        earned.append("streak_3")
    if stats["practice_attempts"] >= 10:
        earned.append("practice_10")
    return earned


def quest_progress(today_stats: dict) -> list[dict]:
    values = {
        "read_1": today_stats["sessions"],
        "practice_3": today_stats["practice_attempts"],
        "accuracy_85": 1 if today_stats["best_confident_accuracy"] >= 85 else 0,
    }
    return [
        {"id": qid, **q, "progress": min(values[qid], q["target"]), "done": values[qid] >= q["target"]}
        for qid, q in DAILY_QUESTS.items()
    ]
