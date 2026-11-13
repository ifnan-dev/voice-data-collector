from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Server
    host: str = "0.0.0.0"
    port: int = 8000

    # Supabase (backend only - keep secret)
    # Accepts either the legacy service_role JWT key or a new sb_secret_... secret key.
    # Both provide elevated privileges and bypass Row Level Security.
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    # Supabase Storage (private bucket for audio files - backend only)
    supabase_storage_bucket: str = "speech-recordings"

    # Transcription (manual only - no auto-transcription)
    # Kept for future use if you want to add ASR later
    transcription_engine: str = "stub"
    whisper_model: str = "base"
    whisper_device: str = "cpu"
    whisper_compute_type: str = "int8"

    # Upload limits
    max_upload_size_mb: int = 50
    allowed_audio_extensions: list[str] = [".wav", ".mp3", ".m4a", ".ogg", ".webm"]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
