"""Supabase Storage object storage service (replaces Cloudflare R2)."""

import uuid
from typing import Optional

from app.core.config import get_settings


class SupabaseStorage:
    """Uploads audio recordings to a private Supabase Storage bucket.

    Uses the Supabase service-role key (backend only) so the mobile app
    never sees storage credentials. Audio playback uses temporary signed URLs.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self._bucket = settings.supabase_storage_bucket
        self._client = None

    @property
    def client(self):
        if self._client is None:
            from supabase import create_client
            settings = get_settings()
            self._client = create_client(settings.supabase_url, settings.supabase_service_role_key)
        return self._client

    def object_key(self, recording_id: uuid.UUID, extension: str = ".m4a") -> str:
        """Return the Supabase Storage object path for a recording."""
        return f"recordings/{recording_id}{extension}"

    def upload(self, file_path: str, recording_id: uuid.UUID, extension: str = ".m4a") -> str:
        """Upload a local audio file to Supabase Storage and return the object path.

        Raises on failure so the caller can handle it without losing the
        recording (the local temp file is left in place).
        """
        key = self.object_key(recording_id, extension)
        content_type = "audio/m4a" if extension == ".m4a" else "application/octet-stream"

        try:
            with open(file_path, "rb") as f:
                self.client.storage.from_(self._bucket).upload(
                    path=key,
                    file=f,
                    file_options={"content-type": content_type, "upsert": False},
                )
        except Exception as exc:
            raise RuntimeError(f"Failed to upload audio to Supabase Storage: {exc}") from exc

        return key

    def get_signed_url(self, object_key: str, expires_in: int = 3600) -> str:
        """Generate a temporary signed URL for private bucket playback."""
        try:
            result = self.client.storage.from_(self._bucket).create_signed_url(
                path=object_key,
                expires_in=expires_in,
            )
            # Supabase returns a dict with 'signedUrl' key
            signed_url = result.get("signedUrl") if isinstance(result, dict) else None
            if not signed_url:
                raise RuntimeError("Supabase Storage returned no signed URL")
            return signed_url
        except Exception as exc:
            raise RuntimeError(f"Failed to generate signed URL: {exc}") from exc

    def delete(self, object_key: str) -> None:
        """Delete an object from Supabase Storage (best-effort cleanup on failure paths)."""
        try:
            self.client.storage.from_(self._bucket).remove([object_key])
        except Exception:
            pass

    def health_check(self) -> bool:
        """Return True if the storage bucket is accessible."""
        try:
            self.client.storage.from_(self._bucket).list()
            return True
        except Exception:
            return False
