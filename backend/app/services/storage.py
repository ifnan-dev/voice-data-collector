"""Cloudflare R2 object storage service (S3-compatible).

Replaces Supabase Storage. R2 speaks the S3 API, so we use boto3 pointed at the
account's R2 endpoint. Audio playback uses either a public base URL (if the
bucket is public) or short-lived presigned URLs (private bucket).
"""

import uuid
from typing import Optional

from app.core.config import get_settings

# Content type stored alongside the object so browsers/players can stream the
# file without sniffing. WAV is the app's lossless format.
CONTENT_TYPES = {
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".webm": "audio/webm",
}


class R2Storage:
    """Uploads audio recordings to a Cloudflare R2 bucket.

    Credentials are backend-only; the mobile app never sees them. Playback uses
    a public URL when `R2_PUBLIC_BASE_URL` is set, otherwise a presigned URL.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self._bucket = settings.r2_bucket_name
        self._public_base_url = settings.r2_public_base_url.rstrip("/")
        self._client = None

    @property
    def client(self):
        if self._client is None:
            # Imported lazily so the module still imports if boto3 is missing;
            # a clear error is raised the first time storage is actually used.
            import boto3
            from botocore.config import Config

            settings = get_settings()
            if not settings.r2_account_id:
                raise RuntimeError(
                    "Cloudflare R2 is not configured. Set R2_ACCOUNT_ID in the "
                    "backend .env."
                )
            endpoint = f"https://{settings.r2_account_id}.r2.cloudflarestorage.com"
            self._client = boto3.client(
                "s3",
                endpoint_url=endpoint,
                aws_access_key_id=settings.r2_access_key_id,
                aws_secret_access_key=settings.r2_secret_access_key,
                region_name="auto",
                config=Config(
                    signature_version="s3v4",
                    retries={"max_attempts": 2, "mode": "standard"},
                ),
            )
        return self._client

    def object_key(self, recording_id: uuid.UUID, extension: str = ".wav") -> str:
        """Return the R2 object path for a recording."""
        return f"recordings/{recording_id}{extension}"

    def upload(self, file_path: str, recording_id: uuid.UUID, extension: str = ".wav") -> str:
        """Upload a local audio file to R2 and return the object path.

        Raises on failure so the caller can handle it without losing the
        recording (the local temp file is left in place).
        """
        key = self.object_key(recording_id, extension)
        content_type = CONTENT_TYPES.get(extension.lower(), "application/octet-stream")

        try:
            self.client.upload_file(
                file_path,
                self._bucket,
                key,
                ExtraArgs={"ContentType": content_type},
            )
        except Exception as exc:
            raise RuntimeError(f"Failed to upload audio to Cloudflare R2: {exc}") from exc

        return key

    def get_signed_url(self, object_key: str, expires_in: int = 3600) -> str:
        """Return a playable URL for private-bucket playback.

        If a public base URL is configured, returns the public object URL.
        Otherwise generates a presigned GET URL that expires after `expires_in`.
        """
        if self._public_base_url:
            return f"{self._public_base_url}/{object_key}"
        try:
            return self.client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self._bucket, "Key": object_key},
                ExpiresIn=expires_in,
            )
        except Exception as exc:
            raise RuntimeError(f"Failed to generate signed URL: {exc}") from exc

    def delete(self, object_key: str) -> None:
        """Delete an object from R2 (best-effort cleanup on failure paths)."""
        try:
            self.client.delete_object(Bucket=self._bucket, Key=object_key)
        except Exception:
            pass

    def health_check(self) -> bool:
        """Return True if the R2 bucket is accessible."""
        try:
            self.client.head_bucket(Bucket=self._bucket)
            return True
        except Exception:
            return False