from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Server
    host: str = "0.0.0.0"
    port: int = 8000

    # Supabase (service-role key - backend only)
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    # Cloudflare R2 (S3-compatible) - backend only
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_endpoint: str = ""
    r2_bucket: str = ""
    r2_region: str = "auto"
    r2_public_url: str | None = None

    # Transcription
    transcription_engine: str = "stub"  # whisper | stub | custom-asr
    whisper_model: str = "base"
    whisper_device: str = "cpu"  # cpu | cuda
    whisper_compute_type: str = "int8"

    # Upload limits
    max_upload_size_mb: int = 50
    allowed_audio_extensions: list[str] = [".wav", ".mp3", ".m4a", ".ogg", ".webm"]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
