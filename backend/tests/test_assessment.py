from app.engine.assessment_engine import assess
from app.engine.text_alignment import align, normalize_token, normalized_tokens

P = "The small bird flew away. She picked the red flower."


def test_perfect_reading():
    r = assess(P, "the small bird flew away she picked the red flower", 6, "en-IN")
    assert r.expected_word_count == 10
    assert r.likely_correct_word_count == 10
    assert r.word_accuracy_percent == 100.0
    assert r.wcpm == 100.0  # 10 words / 0.1 min
    assert r.assessment_confidence == "high"


def test_omission_detected():
    r = assess(P, "the bird flew away she picked the red flower", 6, "en-IN")
    statuses = {w.expected: w.status for w in r.words}
    assert statuses["small"] == "likely_omission"
    assert r.error_summary["likely_omissions"] == 1
    assert r.word_accuracy_percent == 90.0
    assert "small" in r.practice_candidates


def test_near_match_is_uncertain_not_error():
    r = assess(P, "the small bird flew away she picked the red flowers", 6, "en-IN")
    flower = next(w for w in r.words if w.expected == "flower")
    assert flower.status == "uncertain"
    assert "flower" not in r.practice_candidates


def test_substitution_and_insertion():
    r = assess(P, "the small bird flew away she kicked the big red flower", 6, "en-IN")
    statuses = {w.expected: w.status for w in r.words}
    assert statuses["picked"] in ("likely_substitution", "uncertain")
    assert r.error_summary["possible_insertions"] == 1


def test_partial_attempt_marks_not_attempted():
    r = assess(P, "the small bird flew away", 4, "en-IN")
    assert r.error_summary["not_attempted"] == 5
    assert r.error_summary["likely_omissions"] == 0
    assert r.attempted_accuracy_percent == 100.0
    assert r.word_accuracy_percent == 50.0


def test_empty_transcript_low_confidence():
    r = assess(P, "", 5, "en-IN")
    assert r.assessment_confidence == "low"
    assert r.wcpm == 0
    assert r.practice_candidates == []
    assert r.warnings


def test_fillers_ignored_and_repetition_is_insertion():
    r = assess("The child ran home.", "the child um ran ran home", 3, "en-IN")
    assert r.likely_correct_word_count == 4
    assert r.error_summary["fillers"] == 1
    assert r.error_summary["possible_insertions"] == 1


def test_hindi_normalisation_preserves_matras():
    assert normalize_token("आम।", "hi-IN") == "आम"
    assert normalize_token("पीला", "hi-IN") != normalize_token("पिला", "hi-IN")
    r = assess("राम के पास एक आम है।", "राम के पास एक आम है", 3, "hi-IN")
    assert r.word_accuracy_percent == 100.0


def test_english_case_and_punctuation():
    assert normalized_tokens("Hello, World!", "en-IN") == ["hello", "world"]


def test_align_counts():
    pairs = align(["a", "b", "c"], ["a", "c"])
    assert [p.op for p in pairs] == ["correct", "omission", "correct"]
