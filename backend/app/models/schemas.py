from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict


class TranscribeRequest(BaseModel):
    language: str | None = Field(default="om", max_length=10)


class TranscribeResponse(BaseModel):
    transcription: str
    language: str
    engine: str


class RecordingBase(BaseModel):
    audio_path: str
    transcription: str
    language: str = "om"
    duration_seconds: float | None = None


class RecordingCreate(RecordingBase):
    id: UUID


class RecordingOut(RecordingBase):
    id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ErrorResponse(BaseModel):
    detail: str
