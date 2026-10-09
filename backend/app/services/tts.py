"""Server-side audio: edge-tts (Urdu/English) -> gTTS fallback. Each clip is cached as an MP3 by content hash."""
from __future__ import annotations

import asyncio
import logging
from pathlib import Path

import edge_tts
from gtts import gTTS

from ..config import get_settings
from ..errors import AppError
from . import cache

log = logging.getLogger("roshni.tts")
MAX_CHARS = 1200


async def speak(text: str, lang: str = "ur", rate: str = "+0%") -> Path:
    text = (text or "").strip()
    if not text:
        raise AppError("BAD_REQUEST", "Nothing to read aloud.")
    text = text[:MAX_CHARS]
    s = get_settings()
    voice = s.tts_urdu_voice if lang == "ur" else s.tts_english_voice
    key = cache.make_key("tts", voice, rate, text)
    path = cache.path_for("audio", f"{key}.mp3")
    if path.exists() and path.stat().st_size > 0:
        return path
    if s.demo_mode:
        raise AppError("DEMO_CACHE_MISS", "Demo mode is on and this audio wasn't prepared in advance.", 404)
    try:
        await edge_tts.Communicate(text, voice, rate=rate).save(str(path))
        if path.stat().st_size > 0:
            return path
    except Exception as e:  # noqa: BLE001 - fall back to gTTS
        log.warning("edge-tts failed (%s), falling back to gTTS", e)
    try:
        await asyncio.to_thread(lambda: gTTS(text=text, lang="ur" if lang == "ur" else "en").save(str(path)))
        return path
    except Exception as e:  # noqa: BLE001
        path.unlink(missing_ok=True)
        raise AppError("MODEL_UNAVAILABLE", "The voice service isn't available right now. The browser voice can still read English.", 503, True) from e
