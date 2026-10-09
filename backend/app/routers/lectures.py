"""POST /api/lectures (upload lecture audio) -> transcript + summary + Fact Guard support check."""
from __future__ import annotations

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import FileResponse

from ..config import get_settings
from ..errors import AppError
from ..services import cache, summarize, transcribe
from .lessons import demo_guard, now

router = APIRouter(prefix="/api", tags=["lectures"])

MEDIA = {"mp3": "audio/mpeg", "wav": "audio/wav", "ogg": "audio/ogg", "flac": "audio/flac", "webm": "audio/webm", "m4a": "audio/mp4"}


@router.post("/lectures")
def create_lecture(file: UploadFile = File(...), language: str = Form("auto"), lesson_id: str | None = Form(None)) -> dict:
    s = get_settings()
    data = file.file.read()
    lecture_id = cache.make_key(data, language, s.prompt_version)
    lecture = cache.get_json("lectures", lecture_id)
    if not lecture:
        demo_guard("this recording")
        kind = transcribe.audio_kind(data) or "mp3"
        tr = transcribe.run(data, file.filename or f"lecture.{kind}", language)
        summary, check, summarizer = summarize.summarize_checked(tr["text"])
        cache.put_bytes("lectures", f"{lecture_id}.{kind}", data)
        lecture = {
            "id": lecture_id, "created_at": now(), "filename": file.filename or "", "language": tr["language"],
            "duration": tr["duration"], "segments": tr["segments"], "text": tr["text"], **summary,
            "factguard": check, "audio_url": f"/api/lectures/{lecture_id}/audio", "audio_type": kind,
            "models": {"speech_to_text": tr["model"], "summary": summarizer, "checker": check.get("checker_model", "")},
        }
        cache.put_json("lectures", lecture_id, lecture)
    if lesson_id and (lesson := cache.get_json("lessons", lesson_id)):
        lesson["lecture_id"] = lecture_id
        cache.put_json("lessons", lesson_id, lesson)
    return lecture


@router.get("/lectures/{lecture_id}")
def get_lecture(lecture_id: str) -> dict:
    lecture = cache.get_json("lectures", lecture_id)
    if not lecture:
        raise AppError("NOT_FOUND", "This lecture doesn't exist any more. Please upload it again.", 404)
    return lecture


@router.get("/lectures/{lecture_id}/audio")
def lecture_audio(lecture_id: str) -> FileResponse:
    lecture = get_lecture(lecture_id)
    path = cache.path_for("lectures", f"{lecture_id}.{lecture['audio_type']}")
    if not path.exists():
        raise AppError("NOT_FOUND", "Audio not found.", 404)
    return FileResponse(path, media_type=MEDIA.get(lecture["audio_type"], "application/octet-stream"))
