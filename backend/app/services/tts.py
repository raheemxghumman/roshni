"""Server-side audio: edge-tts (Urdu/Pashto/English) -> gTTS fallback (Urdu/English only). Each clip is cached as an MP3 by content hash."""
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

# Learner-chosen voices, labelled by name (never as male/female). Short keys + full Neural names both accepted.
VOICE_CHOICES = {
    "ur": {
        "uzma": "ur-PK-UzmaNeural",
        "asad": "ur-PK-AsadNeural",
        "ur-PK-UzmaNeural": "ur-PK-UzmaNeural",
        "ur-PK-AsadNeural": "ur-PK-AsadNeural",
    },
    "ps": {
        "latifa": "ps-AF-LatifaNeural",
        "gulnawaz": "ps-AF-GulNawazNeural",
        "ps-AF-LatifaNeural": "ps-AF-LatifaNeural",
        "ps-AF-GulNawazNeural": "ps-AF-GulNawazNeural",
    },
    "en": {
        "aria": "en-US-AriaNeural",
        "en-US-AriaNeural": "en-US-AriaNeural",
    },
}


def resolve_voice(lang: str, voice: str | None = None) -> str:
    s = get_settings()
    defaults = {"ur": s.tts_urdu_voice, "ps": s.tts_pashto_voice, "en": s.tts_english_voice}
    lang = lang if lang in VOICE_CHOICES else "en"
    if voice:
        key = voice.strip()
        resolved = VOICE_CHOICES[lang].get(key) or VOICE_CHOICES[lang].get(key.lower())
        if resolved:
            return resolved
        raise AppError("BAD_REQUEST", "That voice isn't available. Pick one of the listed voices.")
    return defaults.get(lang, s.tts_english_voice)


async def speak(text: str, lang: str = "ur", rate: str = "+0%", voice: str | None = None) -> Path:
    text = (text or "").strip()
    if not text:
        raise AppError("BAD_REQUEST", "Nothing to read aloud.")
    text = text[:MAX_CHARS]
    s = get_settings()
    chosen = resolve_voice(lang, voice)
    key = cache.make_key("tts", chosen, rate, text)
    path = cache.path_for("audio", f"{key}.mp3")
    if path.exists() and path.stat().st_size > 0:
        return path
    if s.demo_mode:
        raise AppError("DEMO_CACHE_MISS", "Demo mode is on and this audio wasn't prepared in advance.", 404)
    try:
        await edge_tts.Communicate(text, chosen, rate=rate).save(str(path))
        if path.stat().st_size > 0:
            return path
    except Exception as e:  # noqa: BLE001 - fall back to gTTS
        log.warning("edge-tts failed (%s), falling back to gTTS", e)
    if lang == "ps":
        path.unlink(missing_ok=True)
        raise AppError("MODEL_UNAVAILABLE", "The Pashto voice isn't available right now. Please try again in a minute.", 503, True)
    try:
        await asyncio.to_thread(lambda: gTTS(text=text, lang="ur" if lang == "ur" else "en").save(str(path)))
        return path
    except Exception as e:  # noqa: BLE001
        path.unlink(missing_ok=True)
        raise AppError("MODEL_UNAVAILABLE", "The voice service isn't available right now. The browser voice can still read English.", 503, True) from e
