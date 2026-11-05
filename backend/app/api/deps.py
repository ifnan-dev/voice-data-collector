"""API dependency providers (singletons for services)."""

from app.services.database import SpeechDatabase
from app.services.storage import R2Storage
from app.services.transcription import get_engine as build_engine


_database: SpeechDatabase | None = None
_storage: R2Storage | None = None
_engine = None


def get_database() -> SpeechDatabase:
    global _database
    if _database is None:
        _database = SpeechDatabase()
    return _database


def get_storage() -> R2Storage:
    global _storage
    if _storage is None:
        _storage = R2Storage()
    return _storage


def get_engine():
    global _engine
    if _engine is None:
        _engine = build_engine()
    return _engine
