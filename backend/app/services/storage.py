"""Cloudflare R2 (S3-compatible) object storage service."""

import os
import uuid
from typing import Optional

from app.core.config import get_settings


class R2Storage:
    """Uploads audio recordings to a private Cloudflare R2 bucket."""

    def __init__(self) -> None:
        settings = get_settings()
        self._bucket = settings.r2_bucket
        self._region = settings.r2_region
        self._public_url = settings.r2_public_url
        self._endpoint = settings.r2_endpoint
        self._access_key_id = settings.r2_access_key_id
        self._secret_access_key = settings.r2_secret_access_key
        self._s3 = None

    @property
    def s3(self):
        if self._s3 is None:
            import boto3
            from botocore.config import Config
            self._s3 = boto3.client(
                "s3",
                endpoint_url=self._endpoint,
                aws_access_key_id=self._access_key_id,
                aws_secret_access_key=self._secret_access_key,
                region_name=self._region,
                config=Config(
                    signature_version="s3v4",
                    retries={"max_attempts": 3, "mode": "standard"},
                ),
            )
        return self._s3

    def object_key(self, recording_id: uuid.UUID, extension: str = ".wav") -> str:
        """Return the R2 object key for a recording."""
        return f"recordings/{recording_id}{extension}"

    def upload(self, file_path: str, recording_id: uuid.UUID, extension: str = ".wav") -> str:
        """Upload a local audio file to R2 and return the object path.

        Raises on failure so the caller can handle it without losing the
        recording (the local temp file is left in place).
        """
        key = self.object_key(recording_id, extension)
        extra_args = {"ContentType": "audio/wav" if extension == ".wav" else "application/octet-stream"}

        try:
            self.s3.upload_file(
                Filename=file_path,
                Bucket=self._bucket,
                Key=key,
                ExtraArgs=extra_args,
            )
        except Exception as exc:
            raise RuntimeError(f"Failed to upload audio to R2: {exc}") from exc

        return key

    def get_signed_url(self, object_key: str, expires_in: int = 3600) -> str:
        """Generate a temporary signed URL for private bucket playback."""
        try:
            url = self.s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": self._bucket, "Key": object_key},
                ExpiresIn=expires_in,
            )
        except Exception as exc:
            raise RuntimeError(f"Failed to generate signed URL: {exc}") from exc
        return url

    def public_url(self, object_key: str) -> Optional[str]:
        """Return a direct public URL if the bucket/object is publicly readable."""
        if not self._public_url:
            return None
        return f"{self._public_url.rstrip('/')}/{object_key}"

    def delete(self, object_key: str) -> None:
        """Delete an object from R2 (best-effort cleanup on failure paths)."""
        try:
            self.s3.delete_object(Bucket=self._bucket, Key=object_key)
        except Exception:
            pass

    def health_check(self) -> bool:
        """Return True if the bucket is accessible."""
        try:
            self.s3.head_bucket(Bucket=self._bucket)
            return True
        except Exception:
            return False
