"""Language-aware normalisation and word-level sequence alignment.

Normalisation is deliberately conservative: Unicode NFC, punctuation removal
and (for Latin-script English only) case folding. Diacritics, matras and
nukta are preserved so distinct Indic words are never merged."""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from difflib import SequenceMatcher

# Punctuation including the Devanagari danda/double danda.
_PUNCT = re.compile(r"[\"'“”‘’.,!?;:()\[\]{}\-–—…।॥/\\]")
_SPACE = re.compile(r"\s+")


def normalize_token(token: str, language: str) -> str:
    t = unicodedata.normalize("NFC", token)
    t = _PUNCT.sub("", t)
    if language.startswith("en"):
        t = t.lower()
    return t.strip()


def tokenize(text: str, language: str) -> list[str]:
    """Returns display tokens (original form, punctuation attached)."""
    return [t for t in _SPACE.split(unicodedata.normalize("NFC", text).strip()) if t]


def normalized_tokens(text: str, language: str) -> list[str]:
    out = []
    for tok in tokenize(text, language):
        n = normalize_token(tok, language)
        if n:
            out.append(n)
    return out


FILLERS = {"en-IN": {"um", "uh", "umm", "hmm", "er", "ah"}, "hi-IN": {"अं", "हम्म", "उम"}}


@dataclass
class AlignedPair:
    op: str  # correct | substitution | omission | insertion | near_match
    expected: str | None
    recognized: str | None
    expected_index: int | None


def similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def align(expected: list[str], recognized: list[str]) -> list[AlignedPair]:
    """Levenshtein alignment over word tokens with a reduced substitution cost
    for near matches (e.g. 'flower' vs 'flowers'), which are reported as
    near_match so the assessment layer can treat them as uncertain."""
    n, m = len(expected), len(recognized)
    INF = float("inf")
    cost = [[INF] * (m + 1) for _ in range(n + 1)]
    back: list[list[str | None]] = [[None] * (m + 1) for _ in range(n + 1)]
    cost[0][0] = 0
    for i in range(1, n + 1):
        cost[i][0], back[i][0] = i, "del"
    for j in range(1, m + 1):
        cost[0][j], back[0][j] = j, "ins"

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            e, r = expected[i - 1], recognized[j - 1]
            if e == r:
                sub = 0.0
            elif similarity(e, r) >= 0.75 and min(len(e), len(r)) >= 3:
                sub = 0.5
            else:
                sub = 1.0
            choices = [
                (cost[i - 1][j - 1] + sub, "diag"),
                (cost[i - 1][j] + 1, "del"),
                (cost[i][j - 1] + 1, "ins"),
            ]
            cost[i][j], back[i][j] = min(choices, key=lambda c: c[0])

    pairs: list[AlignedPair] = []
    i, j = n, m
    while i > 0 or j > 0:
        move = back[i][j]
        if move == "diag":
            e, r = expected[i - 1], recognized[j - 1]
            if e == r:
                op = "correct"
            elif similarity(e, r) >= 0.75 and min(len(e), len(r)) >= 3:
                op = "near_match"
            else:
                op = "substitution"
            pairs.append(AlignedPair(op, e, r, i - 1))
            i, j = i - 1, j - 1
        elif move == "del":
            pairs.append(AlignedPair("omission", expected[i - 1], None, i - 1))
            i -= 1
        else:
            pairs.append(AlignedPair("insertion", None, recognized[j - 1], None))
            j -= 1
    pairs.reverse()
    return pairs
