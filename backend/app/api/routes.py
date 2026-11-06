"""REST API routes for speech recording collection."""

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
    transcription: str = Form(...),
    language: str = Form(default="om"),
    duration_seconds: Optional[float] = Form(default=None),
    database=Depends(get_database),
    storage=Depends(get_storage),
):
    """Upload audio to R2 and save the matching record to Supabase.

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
        # 1. Upload audio to R2.
        try:
            storage.upload(tmp_path, recording_id, ext)
        except RuntimeError as exc:
            # Upload failed: keep the temp file, surface the error.
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Audio upload failed: {exc}",
            )

        # 2. Insert record into Supabase with the same UUID + object path.
        try:
            record = database.insert(
                recording_id=recording_id,
                audio_path=object_key,
                transcription=transcription,
                language=language,
                duration_seconds=duration_seconds,
            )
        except Exception as exc:
            # Insert failed: attempt to clean up the R2 object we just uploaded
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
    """Provide a temporary signed URL for private R2 audio playback."""
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

    # Prefer a signed URL for private buckets; fall back to public URL if configured.
    try:
        signed_url = storage.get_signed_url(record.audio_path)
        return JSONResponse({"audio_url": signed_url, "expires_in": 3600})
    except RuntimeError:
        public_url = storage.public_url(record.audio_path)
        if public_url:
            return JSONResponse({"audio_url": public_url, "expires_in": None})
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to provide audio playback URL",
        )


@router.get("/health")
async def health():
    r2 = False
    supabase = False
    try:
        storage = R2Storage()
        r2 = storage.health_check()
    except Exception:
        r2 = False
    try:
        database = SpeechDatabase()
        supabase = database.health_check()
    except Exception:
        supabase = False
    return {"r2": r2, "supabase": supabase}
