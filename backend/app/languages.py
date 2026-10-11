"""Language support matrix. Saaras (STT), Bulbul (TTS) and Mayura (translation)
do not support identical language sets, so reading languages are restricted to
those supported by both STT and TTS."""

SAARAS_LANGS = {
    "hi-IN", "bn-IN", "kn-IN", "ml-IN", "mr-IN", "od-IN", "pa-IN", "ta-IN", "te-IN",
    "en-IN", "gu-IN", "as-IN", "ur-IN", "ne-IN", "kok-IN", "ks-IN", "sd-IN", "sa-IN",
    "sat-IN", "mni-IN", "brx-IN", "mai-IN", "doi-IN",
}
BULBUL_LANGS = {
    "bn-IN", "en-IN", "gu-IN", "hi-IN", "kn-IN", "ml-IN", "mr-IN", "od-IN", "pa-IN", "ta-IN", "te-IN",
}
MAYURA_LANGS = set(BULBUL_LANGS)

LANGUAGE_NAMES = {
    "en-IN": "English", "hi-IN": "Hindi", "bn-IN": "Bengali", "ta-IN": "Tamil",
    "te-IN": "Telugu", "kn-IN": "Kannada", "ml-IN": "Malayalam", "mr-IN": "Marathi",
    "gu-IN": "Gujarati", "pa-IN": "Punjabi", "od-IN": "Odia",
}

READING_LANGS = sorted(SAARAS_LANGS & BULBUL_LANGS)


def language_matrix() -> list[dict]:
    return [
        {
            "code": code,
            "name": LANGUAGE_NAMES.get(code, code),
            "stt": code in SAARAS_LANGS,
            "tts": code in BULBUL_LANGS,
            "translation": code in MAYURA_LANGS,
        }
        for code in READING_LANGS
    ]
