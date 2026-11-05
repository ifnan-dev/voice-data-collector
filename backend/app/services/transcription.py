"""Modular transcription engine.

The transcription engine is intentionally pluggable so Whisper can later be
replaced with a custom Afaan Oromo ASR model without touching the API layer.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional

from app.core.config import get_settings


@dataclass
class TranscriptionResult:
    text: str
    language: str
    engine: str


class ASREngine(ABC):
    """Abstract base class for automatic speech recognition engines."""

    @abstractmethod
    def transcribe(self, audio_path: str, language: Optional[str] = None) -> TranscriptionResult:
        """Transcribe an audio file and return the result."""
        ...


class WhisperEngine(ASREngine):
    """Whisper-based transcription using faster-whisper."""

    def __init__(self) -> None:
        settings = get_settings()
        try:
            from faster_whisper import WhisperModel
        except ImportError as exc:  # pragma: no cover - depends on install
            raise RuntimeError(
                "faster-whisper is not installed. Install it to use the whisper engine."
            ) from exc

        self._model = WhisperModel(
            settings.whisper_model,
            device=settings.whisper_device,
            compute_type=settings.whisper_compute_type,
        )
        self._engine_name = "whisper"

    def transcribe(self, audio_path: str, language: Optional[str] = None) -> TranscriptionResult:
        segments, info = self._model.transcribe(
            audio_path,
            language=language or "om",
            beam_size=5,
            vad_filter=True,
        )
        text = "".join(segment.text for segment in segments).strip()
        return TranscriptionResult(
            text=text,
            language=info.language or (language or "om"),
            engine=self._engine_name,
        )


class StubEngine(ASREngine):
    """Stub engine for local development/testing without Whisper installed.

    Returns a deterministic placeholder so the full record -> transcribe ->
    review -> save flow can be exercised offline.
    """

    def __init__(self) -> None:
        self._engine_name = "stub"

    def transcribe(self, audio_path: str, language: Optional[str] = None) -> TranscriptionResult:
        import os

        name = os.path.basename(audio_path)
        return TranscriptionResult(
            text=f"[stub transcription] {name}",
            language=language or "om",
            engine=self._engine_name,
        )


class CustomAfarOromoEngine(ASREngine):
    """Placeholder for a future custom Afaan Oromo ASR model.

    Implement the real model here and wire it into get_engine() by setting
    TRANSCRIPTION_ENGINE=custom-asr in the backend .env.
    """

    def __init__(self) -> None:
        self._engine_name = "custom-afaan-oromo"
        raise NotImplementedError(
            "Custom Afaan Oromo ASR engine is not implemented yet. "
            "Implement CustomAfarOromoEngine.transcribe() and set "
            "TRANSCRIPTION_ENGINE=custom-asr."
        )

    def transcribe(self, audio_path: str, language: Optional[str] = None) -> TranscriptionResult:
        raise NotImplementedError("Custom Afaan Oromo ASR engine is not implemented.")


_ENGINE_REGISTRY = {
    "whisper": WhisperEngine,
    "stub": StubEngine,
    "custom-asr": CustomAfarOromoEngine,
}


def get_engine() -> ASREngine:
    settings = get_settings()
    engine_cls = _ENGINE_REGISTRY.get(settings.transcription_engine)
    if engine_cls is None:
        raise ValueError(
            f"Unknown transcription engine: {settings.transcription_engine}. "
            f"Available: {list(_ENGINE_REGISTRY)}"
        )
    return engine_cls()
