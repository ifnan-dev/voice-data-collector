"""REST API routes for speech recording collection."""

import asyncio
import os
import tempfile
import uuid
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse

from app.api.deps import get_database, get_storage
from app.services.database import SpeechDatabase
from app.services.storage import R2Storage
from app.core.config import get_settings
from app.models.schemas import (
    ErrorResponse,
    RecordingCreate,
    RecordingOut,
)

router = APIRouter()
settings = get_settings()

MAX_UPLOAD_BYTES = settings.max_upload_size_mb * 1024 * 1024
ALLOWED_EXTENSIONS = tuple(settings.allowed_audio_extensions)

# R2/Supabase calls are blocking and have no built-in timeout. Run them in a
# worker thread with a hard cap so one slow request cannot stall the event loop
# or leave the mobile app waiting until its own 120s timeout.
STORAGE_TIMEOUT_SECONDS = 30


def _validate_audio(file: UploadFile) -> str:
    """Validate the uploaded audio file and return its extension."""
    if file.size is not None and file.size > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Max size is {settings.max_upload_size_mb} MB.",
        )
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Unsupported file extension '{ext}'. "
                f"Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
            ),
        )
    return ext


@router.post(
    "/recordings",
    response_model=RecordingOut,
    status_code=status.HTTP_201_CREATED,
    responses={400: {"model": ErrorResponse}, 413: {"model": ErrorResponse}, 502: {"model": ErrorResponse}},
)
async def create_recording(
    file: UploadFile = File(...),
    transcription: str = Form(default=""),
    language: str = Form(default="om"),
    duration_seconds: float | None = Form(default=None),
    database=Depends(get_database),
    storage=Depends(get_storage),
):
    """Upload audio to Cloudflare R2 and save the matching record to Supabase.

    The UUID is generated server-side so the audio object path and the
    database row share the same identifier. If either the R2 upload or the
    Supabase insert fails, an error is raised and the local temp file is
    preserved so nothing is silently lost.
    """
    ext = _validate_audio(file)

    recording_id = uuid.uuid4()
    object_key = storage.object_key(recording_id, ext)

    # Save upload to a temp file first.
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        # 1. Upload audio to Cloudflare R2 (offloaded + timed out).
        try:
            await asyncio.wait_for(
                asyncio.to_thread(storage.upload, tmp_path, recording_id, ext),
                timeout=STORAGE_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError:
            storage.delete(object_key)
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail=(
                    "Audio upload to storage timed out. Check the server's "
                    "connection to Cloudflare R2."
                ),
            )
        except RuntimeError as exc:
            # Upload failed: keep the temp file, surface the error.
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Audio upload failed: {exc}",
            )

        # 2. Insert record into Supabase with the same UUID + object path.
        try:
            record = await asyncio.wait_for(
                asyncio.to_thread(
                    database.insert,
                    recording_id,
                    object_key,
                    transcription,
                    language,
                    duration_seconds,
                ),
                timeout=STORAGE_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError:
            storage.delete(object_key)
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail=(
                    "Database save timed out. Check the server's connection "
                    "to Supabase."
                ),
            )
        except Exception as exc:
            # Insert failed: attempt to clean up the Storage object we just uploaded
            # so we don't orphan storage, then surface the error. The local
            # temp file is preserved so the user can retry.
            storage.delete(object_key)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to save recording to database: {exc}",
            )

        return record
    finally:
        # Clean up the temp file after upload/insert are attempted.
        try:
            os.remove(tmp_path)
        except OSError:
            pass


@router.get(
    "/recordings",
    response_model=list[RecordingOut],
    responses={502: {"model": ErrorResponse}},
)
async def list_recordings(
    limit: int = 50,
    offset: int = 0,
    database=Depends(get_database),
):
    """List previously saved recordings, newest first."""
    try:
        return database.list(limit=limit, offset=offset)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to retrieve recordings: {exc}",
        )


@router.get(
    "/recordings/{recording_id}",
    response_model=RecordingOut,
    responses={404: {"model": ErrorResponse}, 502: {"model": ErrorResponse}},
)
async def get_recording(
    recording_id: UUID,
    database=Depends(get_database),
):
    """Retrieve a specific recording by its UUID."""
    try:
        record = database.get(recording_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to retrieve recording: {exc}",
        )
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recording {recording_id} not found",
        )
    return record


@router.get(
    "/recordings/{recording_id}/audio",
    responses={404: {"model": ErrorResponse}, 502: {"model": ErrorResponse}},
)
async def get_recording_audio(
    recording_id: UUID,
    database=Depends(get_database),
    storage=Depends(get_storage),
):
    """Provide a temporary signed URL for private Cloudflare R2 audio playback."""
    try:
        record = database.get(recording_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to retrieve recording: {exc}",
        )
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recording {recording_id} not found",
        )

    try:
        signed_url = storage.get_signed_url(record.audio_path)
        return JSONResponse({"audio_url": signed_url, "expires_in": 3600})
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Unable to provide audio playback URL: {exc}",
        )


@router.get("/health")
async def health():
    storage_ok = False
    supabase_ok = False
    try:
        storage = R2Storage()
        storage_ok = storage.health_check()
    except Exception:
        storage_ok = False
    try:
        database = SpeechDatabase()
        supabase_ok = database.health_check()
    except Exception:
        supabase_ok = False
    return {"storage": storage_ok, "supabase": supabase_ok}
