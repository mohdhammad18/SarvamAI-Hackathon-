"""Curated passage library. Passage text is the ground truth for scoring and
is never replaced by a translation or transliteration. All passages are
original text written for this project. Passages are kept short so a reading
fits inside the 30-second Sarvam REST STT limit."""

PASSAGES: list[dict] = [
    {
        "id": "en-1-cat",
        "language": "en-IN",
        "level": 1,
        "title": "The Red Hat",
        "text": "Sam has a red hat. The hat is on the mat. A cat sat on the hat. Sam is sad.",
        "skills": ["en:short_a", "en:cvc_words"],
        "target_words": ["hat", "mat", "cat", "sad"],
        "review_status": "internal-draft",
    },
    {
        "id": "en-1-ship",
        "language": "en-IN",
        "level": 1,
        "title": "The Big Ship",
        "text": "Look at the big ship. It is in the sea. The fish swim near the ship. We wave and shout.",
        "skills": ["en:digraph_sh", "en:long_ee"],
        "target_words": ["ship", "sea", "fish", "shout"],
        "review_status": "internal-draft",
    },
    {
        "id": "en-2-bird",
        "language": "en-IN",
        "level": 2,
        "title": "The Small Bird",
        "text": "The small bird flew away from the tree. She picked the red flower near the gate. Then she sang a sweet song.",
        "skills": ["en:blend_fl", "en:long_ee", "en:blend_sw"],
        "target_words": ["flew", "flower", "sweet", "tree"],
        "review_status": "internal-draft",
    },
    {
        "id": "en-2-rain",
        "language": "en-IN",
        "level": 2,
        "title": "Rainy Day",
        "text": "The rain fell on the roof all day. Maya and her brother played a game. They drank hot milk and watched the clouds.",
        "skills": ["en:vowel_ai", "en:blend_br", "en:digraph_ch"],
        "target_words": ["rain", "brother", "played", "clouds"],
        "review_status": "internal-draft",
    },
    {
        "id": "en-3-thunder",
        "language": "en-IN",
        "level": 3,
        "title": "Thunder in the Hills",
        "text": "Thunder rolled through the quiet hills. The three children gathered their things and hurried home. Their mother was waiting with a warm smile.",
        "skills": ["en:digraph_th", "en:suffix_ed"],
        "target_words": ["thunder", "three", "gathered", "hurried"],
        "review_status": "internal-draft",
    },
    {
        "id": "hi-1-aam",
        "language": "hi-IN",
        "level": 1,
        "title": "मीठा आम",
        "text": "राम के पास एक आम है। आम पीला और मीठा है। राम आम खाता है। वह खुश है।",
        "skills": ["hi:aa_matra", "hi:ii_matra"],
        "target_words": ["आम", "पीला", "मीठा", "खुश"],
        "review_status": "internal-draft",
    },
    {
        "id": "hi-2-baarish",
        "language": "hi-IN",
        "level": 2,
        "title": "बारिश का दिन",
        "text": "आज सुबह से बारिश हो रही है। बच्चे खिड़की से बादल देख रहे हैं। माँ ने गरम पकौड़े बनाए।",
        "skills": ["hi:conjuncts", "hi:nasalisation"],
        "target_words": ["बारिश", "खिड़की", "बादल", "पकौड़े"],
        "review_status": "internal-draft",
    },
]

SKILLS: dict[str, dict] = {
    "en:cvc_words": {"label": "CVC words", "pattern": "consonant-vowel-consonant", "level": 1},
    "en:short_a": {"label": "Short 'a' sound", "pattern": "a as in cat", "level": 1},
    "en:digraph_sh": {"label": "'sh' sound", "pattern": "sh", "level": 1},
    "en:long_ee": {"label": "Long 'ee' sound", "pattern": "ee / ea", "level": 1},
    "en:blend_fl": {"label": "'fl' blend", "pattern": "fl", "level": 2},
    "en:blend_sw": {"label": "'sw' blend", "pattern": "sw", "level": 2},
    "en:blend_br": {"label": "'br' blend", "pattern": "br", "level": 2},
    "en:vowel_ai": {"label": "'ai' sound", "pattern": "ai / ay", "level": 2},
    "en:digraph_ch": {"label": "'ch' sound", "pattern": "ch", "level": 2},
    "en:digraph_th": {"label": "'th' sound", "pattern": "th", "level": 3},
    "en:suffix_ed": {"label": "'-ed' endings", "pattern": "-ed", "level": 3},
    "hi:aa_matra": {"label": "आ की मात्रा (ा)", "pattern": "ा", "level": 1},
    "hi:ii_matra": {"label": "ई की मात्रा (ी)", "pattern": "ी", "level": 1},
    "hi:conjuncts": {"label": "संयुक्त अक्षर", "pattern": "conjuncts", "level": 2},
    "hi:nasalisation": {"label": "अनुनासिक (ँ / ं)", "pattern": "ँ ं", "level": 2},
}

# Grapheme patterns used to map individual words onto pattern skills.
PATTERN_RULES: dict[str, list[tuple[str, str]]] = {
    "en-IN": [
        ("en:digraph_th", "th"), ("en:digraph_sh", "sh"), ("en:digraph_ch", "ch"),
        ("en:blend_fl", "fl"), ("en:blend_sw", "sw"), ("en:blend_br", "br"),
        ("en:long_ee", "ee"), ("en:long_ee", "ea"), ("en:vowel_ai", "ai"), ("en:vowel_ai", "ay"),
    ],
    "hi-IN": [
        ("hi:aa_matra", "ा"), ("hi:ii_matra", "ी"), ("hi:nasalisation", "ँ"),
        ("hi:nasalisation", "ं"), ("hi:conjuncts", "्"),
    ],
}


def get_passage(passage_id: str) -> dict | None:
    return next((p for p in PASSAGES if p["id"] == passage_id), None)


def skills_for_word(word: str, language: str) -> list[str]:
    w = word.lower()
    found = []
    for skill, pattern in PATTERN_RULES.get(language, []):
        if pattern in w and skill not in found:
            found.append(skill)
    if language == "en-IN" and w.endswith("ed") and len(w) > 4:
        found.append("en:suffix_ed")
    return found
