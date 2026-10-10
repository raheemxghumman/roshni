"""Practice tab: make a quiz from verified facts, check one answer at a time, grade with weak areas and a study plan,
and understand spoken answers for the voice quiz."""
from __future__ import annotations

import json
import re

from fastapi import APIRouter, File, Form, Header, UploadFile

from ..config import get_settings
from ..errors import AppError
from ..schemas import CoachRequest, QuizAnswers, QuizCheck, QuizRequest
from ..services import cache, coach, profiles, quiz, transcribe, voice
from ..services.llm_clients import transcribe as whisper
from .lessons import demo_guard, load_lesson, now

router = APIRouter(prefix="/api", tags=["practice"])

MAX_VOICE_BYTES = 3 * 1024 * 1024  # a spoken answer is a few seconds; this is generous


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


def _clean_fact_ids(raw: list[str], valid: set[str]) -> list[str]:
    out: list[str] = []
    for item in raw:
        fid = str(item or "").strip()
        if re.fullmatch(r"\d+", fid):
            fid = f"f{fid}"
        if fid in valid and fid not in out:
            out.append(fid)
        if len(out) >= 15:
            break
    return out


def _cached_questions(lesson: dict, wanted: set[str]) -> dict[str, dict]:
    """Reuse questions already written for these facts from any cached quiz on this lesson."""
    found: dict[str, dict] = {}
    for ids in (lesson.get("quizzes") or {}).values():
        for qid in reversed(ids or []):
            stored = cache.get_json("quizzes", qid)
            if not stored:
                continue
            for q in stored.get("questions") or []:
                fid = q.get("fact_id")
                if fid in wanted and fid not in found:
                    found[fid] = {k: v for k, v in q.items() if k != "id"}
            if len(found) == len(wanted):
                return found
    return found


def _save_quiz(lesson_id: str, key: str, stored: dict) -> dict:
    cache.put_json("quizzes", stored["id"], stored)
    lesson = load_lesson(lesson_id)
    lesson.setdefault("quizzes", {}).setdefault(key, []).append(stored["id"])
    lesson["quizzes"][key] = lesson["quizzes"][key][-5:]
    cache.put_json("lessons", lesson_id, lesson)
    return quiz.public(stored)


@router.post("/lessons/{lesson_id}/quiz")
def make_quiz(lesson_id: str, body: QuizRequest) -> dict:
    lesson = load_lesson(lesson_id)
    valid_sections = {s["id"] for s in lesson["sections"]}
    sections = sorted({s for s in body.section_ids if s in valid_sections})
    facts = quiz.verified_facts(lesson, body.level)
    if not facts:
        already = lesson.get("simplified", {}).get(body.level)
        if already:
            raise AppError(
                "NOT_ENOUGH_FACTS",
                "Fact Guard checked this page but kept no facts to quiz on. Try another reading level, or open a sample lesson.",
                422,
            )
        raise AppError("NEEDS_CHECK", "Fact Guard hasn't checked this page yet, so there are no verified facts to ask about.", 409, True)
    fact_ids = _clean_fact_ids(body.fact_ids, {f["id"] for f in facts})

    if fact_ids:
        # Review quiz: one question per missed fact; reuse the bank before calling AI.
        key = cache.make_key(lesson_id, "review", body.level, ",".join(fact_ids), get_settings().prompt_version)
        index = lesson.get("quizzes") or {}
        if not body.fresh and (existing := index.get(key)):
            if stored := cache.get_json("quizzes", existing[-1]):
                return quiz.public(stored)
        reused = _cached_questions(lesson, set(fact_ids))
        questions = []
        for i, fid in enumerate(fact_ids, start=1):
            if fid in reused:
                q = dict(reused[fid])
                q["id"] = f"q{i}"
                questions.append(q)
        missing = [f for f in facts if f["id"] in fact_ids and f["id"] not in {q["fact_id"] for q in questions}]
        model = "cache"
        if missing:
            if get_settings().demo_mode:
                if not questions:
                    raise AppError("DEMO_CACHE_MISS", "Demo mode is on and no review questions were prepared for these facts.", 404)
            else:
                generated, model = quiz.generate(
                    missing, body.level, len(missing), None, seed=cache.make_key(key, now()), min_facts=1
                )
                for j, q in enumerate(generated, start=len(questions) + 1):
                    q = dict(q)
                    q["id"] = f"q{j}"
                    questions.append(q)
        if len(questions) < 1:
            raise AppError("NOT_ENOUGH_FACTS", "There aren't enough checked facts left to review yet.", 422)
        # Keep only one question per requested fact, in the review order.
        by_id = {q["fact_id"]: q for q in questions}
        ordered = []
        for i, fid in enumerate(fact_ids, start=1):
            if fid in by_id:
                q = dict(by_id[fid])
                q["id"] = f"q{i}"
                ordered.append(q)
        quiz_id = cache.make_key(key, now())
        stored = {"id": quiz_id, "version": 2, "lesson_id": lesson_id, "level": body.level, "count": len(ordered),
                  "section_ids": [], "fact_ids": fact_ids, "questions": ordered, "model": model, "created_at": now()}
        return _save_quiz(lesson_id, key, stored)

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
    quiz_id = cache.make_key(key, now())
    questions, model = quiz.generate(facts, body.level, body.count, sections, seed=quiz_id)
    stored = {"id": quiz_id, "version": 2, "lesson_id": lesson_id, "level": body.level, "count": body.count,
              "section_ids": sections, "questions": questions, "model": model, "created_at": now()}
    return _save_quiz(lesson_id, key, stored)


@router.post("/quiz/{quiz_id}/check")
def check_answer(quiz_id: str, body: QuizCheck) -> dict:
    return quiz.check_one(load_quiz(quiz_id), body.question_id, body.answer)


@router.post("/quiz/{quiz_id}/coach")
def quiz_coach(quiz_id: str, body: CoachRequest) -> dict:
    """AI coach note after results. Never blocks grading — the browser already shows the plain-code note."""
    stored = load_quiz(quiz_id)
    report = {"correct": body.correct, "total": body.total, "sections": body.sections or [], "plan": body.plan or []}
    if hit := coach.cached_note(stored, report):
        return hit
    demo_guard("a coach note")
    return coach.build_note(stored, report)


def own_history(learner: str | None, lesson: dict, attempt: dict | None = None) -> list[dict]:
    """This learner's attempts on this lesson. With no id or no database, history is kept only for this answer
    (the browser keeps its own copy), so one visitor never sees another visitor's scores."""
    if learner and profiles.ID_RE.fullmatch(learner):
        try:
            if attempt:
                profiles.add_attempt(learner, {**attempt, "lesson_id": lesson["id"]})
            return profiles.attempts(learner, lesson["id"])
        except AppError:
            pass
    return [attempt] if attempt else []


@router.post("/quiz/{quiz_id}/answers")
def finish_quiz(quiz_id: str, body: QuizAnswers, x_learner_id: str | None = Header(default=None)) -> dict:
    stored = load_quiz(quiz_id)
    lesson = load_lesson(stored["lesson_id"])
    ids = {q["id"] for q in stored["questions"]}
    answers = {k: v for k, v in body.answers.items() if k in ids}
    report = quiz.grade(stored, answers, [t for t in body.timed_out if t in ids], lesson, attached_videos(lesson))
    attempt = {"quiz_id": quiz_id, "at": now(), "score": report["score"], "correct": report["correct"], "total": report["total"],
               "level": stored["level"], "mode": body.mode, "weak": [s["heading"] for s in report["sections"] if s["weak"]],
               "focus": bool(stored.get("section_ids"))}
    report["history"] = own_history(x_learner_id, lesson, attempt)
    return report


@router.get("/lessons/{lesson_id}/practice")
def practice_history(lesson_id: str, x_learner_id: str | None = Header(default=None)) -> dict:
    lesson = load_lesson(lesson_id)
    return {"history": own_history(x_learner_id, lesson), "facts": len(quiz.verified_facts(lesson, "easier")),
            "saved_on_server": bool(x_learner_id) and profiles.available()}


@router.post("/voice/answer")
def voice_answer(file: UploadFile = File(...), options: str = Form(...), language: str = Form("en")) -> dict:
    """A few seconds of speech -> which option the student chose (or repeat / skip / stop)."""
    if get_settings().demo_mode:
        raise AppError(
            "DEMO_CACHE_MISS",
            "Demo mode is on, so voice answers are off. Press 1–4 (or say nothing and tap an option) instead.",
            404,
        )
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
