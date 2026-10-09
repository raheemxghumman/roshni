"""Lecture audio -> timestamped transcript via Groq Whisper, with size and type checks."""
from __future__ import annotations

from ..config import get_settings
from ..errors import AppError
from .llm_clients import transcribe as whisper

AUDIO_TYPES = {
    b"ID3": "mp3", b"\xff\xfb": "mp3", b"\xff\xf3": "mp3", b"\xff\xf2": "mp3",
    b"RIFF": "wav", b"OggS": "ogg", b"fLaC": "flac", b"\x1aE\xdf\xa3": "webm",
}


def audio_kind(data: bytes) -> str | None:
    for magic, kind in AUDIO_TYPES.items():
        if data.startswith(magic):
            return kind
    if data[4:8] == b"ftyp":
        return "m4a"
    return None


def run(data: bytes, filename: str, language: str | None) -> dict:
    s = get_settings()
    if not data:
        raise AppError("UNSUPPORTED_FILE", "The audio file is empty.")
    if len(data) > s.max_audio_mb * 1024 * 1024:
        raise AppError("FILE_TOO_LARGE", f"This recording is over {s.max_audio_mb} MB. Please trim it to about 10 minutes.", 413)
    kind = audio_kind(data)
    if kind is None:
        raise AppError("UNSUPPORTED_FILE", "This audio type isn't supported. Use MP3, M4A, WAV, OGG or WEBM.")
    result = whisper(data, filename if "." in filename else f"lecture.{kind}", language)
    segments = [{"start": round(float(seg.get("start", 0)), 2), "end": round(float(seg.get("end", 0)), 2), "text": (seg.get("text") or "").strip()}
                for seg in result.get("segments") or [] if (seg.get("text") or "").strip()]
    text = (result.get("text") or " ".join(seg["text"] for seg in segments)).strip()
    if not text:
        raise AppError("NO_TEXT_FOUND", "No speech was found in this recording.")
    return {"segments": segments, "text": text, "language": result.get("language") or language or "auto",
            "duration": float(result.get("duration") or (segments[-1]["end"] if segments else 0)), "model": result.get("model", "")}
