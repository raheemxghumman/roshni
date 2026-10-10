"""YouTube link -> checked study notes. Videos can stand alone or be attached to a lesson (several per lesson)."""
from __future__ import annotations

from fastapi import APIRouter

from ..config import get_settings
from ..errors import AppError
from ..schemas import VideoRequest
from ..services import cache, youtube
from .lessons import demo_guard, load_lesson, now

router = APIRouter(prefix="/api", tags=["videos"])
MAX_PER_LESSON = 5


def card(video: dict) -> dict:
    return {"id": video["id"], "video_id": video["video_id"], "title": video["title"], "author": video["author"],
            "duration": video["duration"], "factguard": {k: video["factguard"][k] for k in ("status", "kept", "total")}}


@router.post("/videos")
def create_video(body: VideoRequest) -> dict:
    vid = youtube.video_id(body.url)
    key = cache.make_key("video", vid, body.language, get_settings().prompt_version)
    video = cache.get_json("videos", key)
    if not video:
        demo_guard("notes for this video")
        meta = youtube.metadata(vid)
        caps = youtube.captions_or_transcript(vid, body.language)  # YouTube captions, or Gemini's transcript if blocked
        notes = youtube.make_notes(caps["segments"])
        video = {"id": key, "video_id": vid, "url": f"https://www.youtube.com/watch?v={vid}", "created_at": now(), **meta,
                 "language": caps["language"], "language_name": caps["language_name"], "generated_captions": caps["generated"],
                 "caption_source": caps.get("source", "youtube"),
                 "duration": caps["duration"], "words": caps["words"], "segments": caps["segments"], **notes}
        if caps.get("truncated_at"):
            video["truncated"], video["covered_until"] = True, caps["truncated_at"]
        cache.put_json("videos", key, video)
    result = dict(video)
    if body.lesson_id:
        lesson = load_lesson(body.lesson_id)
        attached = [v for v in lesson.get("videos") or [] if v["id"] != key]
        if len(attached) >= MAX_PER_LESSON:
            raise AppError("TOO_MANY_VIDEOS", f"A lesson can have up to {MAX_PER_LESSON} videos. Remove one first.", 409)
        rel = youtube.relevance(video, lesson)
        lesson["videos"] = attached + [{**card(video), "relevance": rel, "added_at": now()}]
        cache.put_json("lessons", body.lesson_id, lesson)
        result["relevance"] = rel
    return result


@router.get("/videos/{video_key}")
def get_video(video_key: str) -> dict:
    video = cache.get_json("videos", video_key)
    if not video:
        raise AppError("NOT_FOUND", "These video notes don't exist any more. Paste the link again.", 404)
    return video


@router.delete("/lessons/{lesson_id}/videos/{video_key}")
def detach_video(lesson_id: str, video_key: str) -> dict:
    lesson = load_lesson(lesson_id)
    before = len(lesson.get("videos") or [])
    lesson["videos"] = [v for v in lesson.get("videos") or [] if v["id"] != video_key]
    if len(lesson["videos"]) == before:
        raise AppError("NOT_FOUND", "That video isn't attached to this lesson.", 404)
    cache.put_json("lessons", lesson_id, lesson)
    return {"removed": True}
