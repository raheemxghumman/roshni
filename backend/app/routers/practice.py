"""Practice tab: make a quiz from verified facts, check one answer at a time, grade with weak areas and a study plan,
and understand spoken answers for the voice quiz."""
from __future__ import annotations

import json

from fastapi import APIRouter, File, Form, UploadFile

from ..config import get_settings
from ..errors import AppError
from ..schemas import QuizAnswers, QuizCheck, QuizRequest
from ..services import cache, quiz, transcribe, voice
from ..services.llm_clients import transcribe as whisper
from .lessons import load_lesson, now

router = APIRouter(prefix="/api", tags=["practice"])

MAX_VOICE_BYTES = 3 * 1024 * 1024  # a spoken answer is a few seconds; this is generous
HISTORY = 20


def load_quiz(quiz_id: str) -> dict:
    stored = cache.get_json("quizzes", quiz_id)
    if not stored or stored.get("version") != 2:
        raise AppError("NOT_FOUND", "This quiz has expired. Please start a new one.", 404)
    return stored


def attached_videos(lesson: dict) -> list[dict]:
    videos = []
    for v in lesson.get("videos") or []:
        if stored := cache.get_json("videos", v["id"]):
            videos.append(stored)
    return videos


@router.post("/lessons/{lesson_id}/quiz")
def make_quiz(lesson_id: str, body: QuizRequest) -> dict:
    lesson = load_lesson(lesson_id)
    valid_sections = {s["id"] for s in lesson["sections"]}
    sections = sorted({s for s in body.section_ids if s in valid_sections})
    key = cache.make_key(lesson_id, body.level, str(body.count), ",".join(sections), get_settings().prompt_version)
    index = lesson.get("quizzes") or {}
    if not body.fresh and (existing := index.get(key)):
        if stored := cache.get_json("quizzes", existing[-1]):
            return quiz.public(stored)
    if get_settings().demo_mode:
        # demo mode makes no AI calls: reuse the closest quiz already made for this lesson
        for ids in [index.get(key, [])] + list(index.values()):
            for qid in reversed(ids):
                if stored := cache.get_json("quizzes", qid):
                    return quiz.public(stored)
        raise AppError("DEMO_CACHE_MISS", "Demo mode is on and no quiz was prepared for this lesson. Open a sample lesson instead.", 404)
    facts = quiz.verified_facts(lesson, body.level)
    if not facts:
        raise AppError("NEEDS_CHECK", "Fact Guard hasn't checked this page yet, so there are no verified facts to ask about.", 409, True)
    quiz_id = cache.make_key(key, now())
    questions, model = quiz.generate(facts, body.level, body.count, sections, seed=quiz_id)
    stored = {"id": quiz_id, "version": 2, "lesson_id": lesson_id, "level": body.level, "count": body.count,
              "section_ids": sections, "questions": questions, "model": model, "created_at": now()}
    cache.put_json("quizzes", quiz_id, stored)
    lesson = load_lesson(lesson_id)
    lesson.setdefault("quizzes", {}).setdefault(key, []).append(quiz_id)
    lesson["quizzes"][key] = lesson["quizzes"][key][-5:]
    cache.put_json("lessons", lesson_id, lesson)
    return quiz.public(stored)


@router.post("/quiz/{quiz_id}/check")
def check_answer(quiz_id: str, body: QuizCheck) -> dict:
    return quiz.check_one(load_quiz(quiz_id), body.question_id, body.answer)


@router.post("/quiz/{quiz_id}/answers")
def finish_quiz(quiz_id: str, body: QuizAnswers) -> dict:
    stored = load_quiz(quiz_id)
    lesson = load_lesson(stored["lesson_id"])
    ids = {q["id"] for q in stored["questions"]}
    answers = {k: v for k, v in body.answers.items() if k in ids}
    report = quiz.grade(stored, answers, [t for t in body.timed_out if t in ids], lesson, attached_videos(lesson))
    attempt = {"quiz_id": quiz_id, "at": now(), "score": report["score"], "correct": report["correct"], "total": report["total"],
               "level": stored["level"], "mode": body.mode, "weak": [s["heading"] for s in report["sections"] if s["weak"]],
               "focus": bool(stored.get("section_ids"))}
    lesson = load_lesson(stored["lesson_id"])
    lesson["practice"] = (lesson.get("practice") or [])[-(HISTORY - 1):] + [attempt]
    cache.put_json("lessons", lesson["id"], lesson)
    report["history"] = lesson["practice"]
    return report


@router.get("/lessons/{lesson_id}/practice")
def practice_history(lesson_id: str) -> dict:
    lesson = load_lesson(lesson_id)
    return {"history": lesson.get("practice") or [], "facts": len(quiz.verified_facts(lesson, "easier"))}


@router.post("/voice/answer")
def voice_answer(file: UploadFile = File(...), options: str = Form(...), language: str = Form("en")) -> dict:
    """A few seconds of speech -> which option the student chose (or repeat / skip / stop)."""
    try:
        opts = [str(o) for o in json.loads(options)][:6]
    except (ValueError, TypeError) as e:
        raise AppError("BAD_REQUEST", "The answer options were missing.") from e
    if len(opts) < 2:
        raise AppError("BAD_REQUEST", "The answer options were missing.")
    data = file.file.read(MAX_VOICE_BYTES + 1)
    if not data:
        raise AppError("NO_SPEECH", "No sound was recorded. Check the microphone and try again.")
    if len(data) > MAX_VOICE_BYTES:
        raise AppError("FILE_TOO_LARGE", "That recording was too long. Just say the letter of your answer.", 413)
    kind = transcribe.audio_kind(data)
    if kind is None:
        raise AppError("UNSUPPORTED_FILE", "This browser recorded audio in a format the speech service can't read.")
    hint = "A. B. C. D. One, two, three, four. Repeat. Skip. " + " ".join(f"{'ABCD'[i] if i < 4 else i + 1}. {o}." for i, o in enumerate(opts))
    lang = language if language in ("en", "ur", "ps", "hi") else None
    result = whisper(data, f"answer.{kind}", lang, prompt=hint)
    heard = (result.get("text") or "").strip()
    return {"heard": heard, **voice.match(heard, opts), "model": result.get("model", "")}
