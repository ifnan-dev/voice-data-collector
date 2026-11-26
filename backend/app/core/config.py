from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Server
    host: str = "0.0.0.0"
    port: int = 8000

    # Supabase (backend only - keep secret)
    # Accepts either the legacy service_role JWT key or a new sb_secret_... secret key.
    # Both provide elevated privileges and bypass Row Level Security.
    # Used for the speech_records metadata table.
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    # Cloudflare R2 object storage (backend only - keep secret).
    # Audio files live in R2; Supabase holds only metadata.
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket_name: str = "speech-recordings"
    # Optional public base URL for a public bucket (e.g. https://pub-xxx.r2.dev).
    # Leave empty to use short-lived presigned URLs for a private bucket.
    r2_public_base_url: str = ""

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
