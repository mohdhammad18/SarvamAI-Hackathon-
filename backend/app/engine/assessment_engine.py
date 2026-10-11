"""Deterministic reading assessment built on the text alignment.

Conventions:
- wcpm = likely-correct expected words / (reading_duration_seconds / 60)
- word_accuracy_percent = likely-correct expected words / expected words * 100
- attempted_accuracy_percent = likely-correct / attempted expected words * 100
- A trailing run of omissions after the last recognised word is classed as
  not_attempted (the reader stopped), not as omissions.
- near_match results are 'uncertain': they are neither counted as correct nor
  reported as reading errors because ASR, accent or grammar variation may
  explain them.
All flagged words are candidate miscues, not confirmed errors."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field

from .text_alignment import FILLERS, align, normalize_token, normalized_tokens, tokenize


@dataclass
class WordResult:
    index: int
    expected: str
    display: str
    recognized: str | None
    status: str  # correct | likely_substitution | likely_omission | uncertain | not_attempted


@dataclass
class AssessmentResult:
    expected_word_count: int
    matched_word_count: int
    likely_correct_word_count: int
    attempted_word_count: int
    reading_duration_seconds: float
    wcpm: float
    word_accuracy_percent: float
    attempted_accuracy_percent: float
    assessment_confidence: str  # high | medium | low
    confidence_score: float
    error_summary: dict
    words: list[WordResult]
    insertions: list[str]
    warnings: list[str] = field(default_factory=list)
    practice_candidates: list[str] = field(default_factory=list)
    limitations: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        d = asdict(self)
        return d


def assess(
    passage_text: str,
    transcript: str,
    duration_seconds: float,
    language: str,
) -> AssessmentResult:
    display_tokens = [t for t in tokenize(passage_text, language) if normalize_token(t, language)]
    expected = [normalize_token(t, language) for t in display_tokens]
    fillers = FILLERS.get(language, set())
    recognized_all = normalized_tokens(transcript or "", language)
    filler_count = sum(1 for r in recognized_all if r in fillers)
    recognized = [r for r in recognized_all if r not in fillers]

    pairs = align(expected, recognized)

    words: list[WordResult] = []
    insertions: list[str] = []
    for p in pairs:
        if p.op == "insertion":
            insertions.append(p.recognized or "")
            continue
        idx = p.expected_index or 0
        status = {
            "correct": "correct",
            "substitution": "likely_substitution",
            "omission": "likely_omission",
            "near_match": "uncertain",
        }[p.op]
        words.append(WordResult(idx, expected[idx], display_tokens[idx], p.recognized, status))
    words.sort(key=lambda w: w.index)

    # Trailing omissions => reader stopped; treat as not attempted.
    last_heard = max((w.index for w in words if w.status != "likely_omission"), default=-1)
    for w in words:
        if w.index > last_heard and w.status == "likely_omission":
            w.status = "not_attempted"

    n_expected = len(expected)
    correct = sum(1 for w in words if w.status == "correct")
    attempted = sum(1 for w in words if w.status != "not_attempted")
    subs = [w.expected for w in words if w.status == "likely_substitution"]
    omis = [w.expected for w in words if w.status == "likely_omission"]
    uncertain = [w.expected for w in words if w.status == "uncertain"]
    not_attempted = sum(1 for w in words if w.status == "not_attempted")

    duration = max(float(duration_seconds or 0), 0.0)
    minutes = duration / 60 if duration > 0 else 0
    wcpm = round(correct / minutes, 1) if minutes > 0 else 0.0
    accuracy = round(correct / n_expected * 100, 1) if n_expected else 0.0
    attempted_acc = round(correct / attempted * 100, 1) if attempted else 0.0

    warnings: list[str] = []
    score = 1.0
    if not recognized:
        warnings.append("No speech was recognised. Please try again in a quieter place, closer to the microphone.")
        score = 0.0
    else:
        if duration < 2:
            warnings.append("The recording was very short.")
            score -= 0.4
        words_per_sec = len(recognized) / duration if duration > 0 else 99
        if words_per_sec > 5:
            warnings.append("The recording timing looks unusual, so speed estimates may be unreliable.")
            score -= 0.3
        if attempted and attempted < n_expected * 0.5:
            warnings.append("Only part of the passage was read, so scores cover a partial attempt.")
            score -= 0.2
        if len(insertions) > max(3, n_expected * 0.3):
            warnings.append("Many extra words were heard. Background speech or noise may have been picked up.")
            score -= 0.3
        error_rate = (len(subs) + len(omis)) / max(attempted, 1)
        if error_rate > 0.5:
            warnings.append("Many words did not match. This can happen with noise or unclear audio, so another attempt is recommended.")
            score -= 0.3
    score = round(max(0.0, min(1.0, score)), 2)
    level = "high" if score >= 0.75 else "medium" if score >= 0.45 else "low"

    candidates: list[str] = []
    if level != "low":
        for w in subs + omis:
            if w not in candidates:
                candidates.append(w)

    return AssessmentResult(
        expected_word_count=n_expected,
        matched_word_count=correct,
        likely_correct_word_count=correct,
        attempted_word_count=attempted,
        reading_duration_seconds=round(duration, 2),
        wcpm=wcpm,
        word_accuracy_percent=accuracy,
        attempted_accuracy_percent=attempted_acc,
        assessment_confidence=level,
        confidence_score=score,
        error_summary={
            "likely_substitutions": len(subs),
            "likely_omissions": len(omis),
            "possible_insertions": len(insertions),
            "uncertain": len(uncertain),
            "not_attempted": not_attempted,
            "fillers": filler_count,
        },
        words=words,
        insertions=insertions,
        warnings=warnings,
        practice_candidates=candidates[:5],
        limitations=[
            "Scores are automated estimates from speech recognition, not a validated assessment.",
            "A mismatch may be caused by recognition error, accent or disfluency rather than a reading error.",
            "Phoneme-level pronunciation scoring is not available in this version.",
        ],
    )
