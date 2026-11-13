"""Supabase PostgreSQL database service (backend only).

Uses either the legacy service_role key or a new sb_secret_... secret key.
Both provide elevated privileges and bypass Row Level Security.
The key must never be exposed to the mobile app.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from supabase import create_client, Client

from app.core.config import get_settings
from app.models.schemas import RecordingOut


class SpeechDatabase:
    """Wrapper around Supabase for speech recording records."""

    def __init__(self) -> None:
        settings = get_settings()
        self._url = settings.supabase_url
        self._key = settings.supabase_service_role_key
        self._table = "speech_records"
        self._client: Client | None = None

    @property
    def client(self) -> Client:
        if self._client is None:
            if not self._url:
                raise RuntimeError("Supabase URL is not configured. Set SUPABASE_URL in the backend .env.")
            self._client = create_client(self._url, self._key)
        return self._client

    def insert(
        self,
        recording_id: UUID,
        audio_path: str,
        transcription: str,
        language: str = "om",
        duration_seconds: Optional[float] = None,
    ) -> RecordingOut:
        payload = {
            "id": str(recording_id),
            "audio_path": audio_path,
            "transcription": transcription,
            "language": language,
            "duration_seconds": duration_seconds,
        }
        response = self.client.table(self._table).insert(payload).execute()
        if not response.data:
            raise RuntimeError("Supabase insert returned no data")
        return RecordingOut.model_validate(response.data[0])

    def get(self, recording_id: UUID) -> Optional[RecordingOut]:
        response = (
            self.client.table(self._table)
            .select("*")
            .eq("id", str(recording_id))
            .maybe_single()
            .execute()
        )
        if response.data is None:
            return None
        return RecordingOut.model_validate(response.data)

    def list(self, limit: int = 50, offset: int = 0) -> list[RecordingOut]:
        response = (
            self.client.table(self._table)
            .select("*")
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return [RecordingOut.model_validate(item) for item in (response.data or [])]

    def delete(self, recording_id: UUID) -> bool:
        response = (
            self.client.table(self._table)
            .delete()
            .eq("id", str(recording_id))
            .execute()
        )
        return bool(response.data)

    def health_check(self) -> bool:
        try:
            self.client.table(self._table).select("id").limit(1).execute()
            return True
        except Exception:
            return False
