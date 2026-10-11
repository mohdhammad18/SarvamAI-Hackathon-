from datetime import date, timedelta

from app.engine import adaptive_learning as ad
from app.engine import gamification as g


def test_mastery_moves_in_right_direction():
    assert ad.update_mastery(0.3, True) > 0.3
    assert ad.update_mastery(0.3, False) < 0.3
    m = 0.3
    for _ in range(10):
        m = ad.update_mastery(m, True)
    assert m <= 1.0 and ad.skill_state(m) == "mastered"


def test_recommend_prioritises_weak_skill():
    skills = [{"skill_id": "en:digraph_sh", "mastery": 0.2, "attempts": 3, "next_review_at": None}]
    p, reason = ad.recommend_passage("en-IN", 1, skills, [], None)
    assert "en:digraph_sh" in p["skills"]
    assert "still building" in reason


def test_recommend_levels_up_after_high_accuracy():
    p, _ = ad.recommend_passage("en-IN", 1, [], [], 98)
    assert p["level"] == 2


def test_streak():
    today = date(2026, 10, 11)
    days = {today, today - timedelta(days=1), today - timedelta(days=2), today - timedelta(days=4)}
    assert g.streak(days, today) == 3
    assert g.streak(set(), today) == 0


def test_low_confidence_gets_effort_xp_only():
    assert g.reading_xp(100, "low") == 5
    assert g.reading_xp(90, "high") == 29
