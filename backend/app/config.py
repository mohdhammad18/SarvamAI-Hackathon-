import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
BACKEND = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
load_dotenv(BACKEND / ".env")


class Settings:
    sarvam_api_key: str = os.getenv("SARVAM_API_KEY", "").strip()
    sarvam_base_url: str = os.getenv("SARVAM_API_BASE_URL", "https://api.sarvam.ai")
    force_demo: bool = os.getenv("BOLOBUDDY_DEMO_MODE", "false").lower() == "true"
    db_path: Path = Path(os.getenv("BOLOBUDDY_DB", str(BACKEND / "bolobuddy.db")))
    tts_cache_dir: Path = BACKEND / "cache" / "tts"
    cors_origins: list[str] = os.getenv(
        "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    ).split(",")
    max_audio_bytes: int = 5 * 1024 * 1024
    max_audio_seconds: float = 30.0  # Sarvam REST STT limit
    min_audio_seconds: float = 1.0
    stt_model: str = "saaras:v4"
    tts_model: str = "bulbul:v3"
    tts_speaker: str = os.getenv("BOLOBUDDY_TTS_SPEAKER", "ritu")
    chat_model: str = "sarvam-105b"

    @property
    def live(self) -> bool:
        return bool(self.sarvam_api_key) and not self.force_demo


settings = Settings()
