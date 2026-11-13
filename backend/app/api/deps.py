"""API dependency providers (singletons for services)."""

from app.services.database import SpeechDatabase
from app.services.storage import SupabaseStorage


_database: SpeechDatabase | None = None
_storage: SupabaseStorage | None = None


def get_database() -> SpeechDatabase:
    global _database
    if _database is None:
        _database = SpeechDatabase()
    return _database


def get_storage() -> SupabaseStorage:
    global _storage
    if _storage is None:
        _storage = SupabaseStorage()
    return _storage
