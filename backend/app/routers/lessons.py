"""Lesson endpoints: upload a page, read it, simplify with Fact Guard, stress-test Fact Guard, glossary, quiz, audio."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, File, Query, UploadFile
from fastapi.responses import FileResponse

from ..config import get_settings
from ..errors import AppError
from ..schemas import LevelRequest, QuizAnswers, QuizRequest
from ..services import cache, factguard, glossary, ingest, ocr, quiz, simplify, structure, tts
from ..services.llm_clients import family

router = APIRouter(prefix="/api", tags=["lessons"])


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def load_lesson(lesson_id: str) -> dict:
    lesson = cache.get_json("lessons", lesson_id)
    if not lesson:
        raise AppError("NOT_FOUND", "This lesson doesn't exist any more. Please upload the page again.", 404)
    return lesson


def demo_guard(what: str) -> None:
    if get_settings().demo_mode:
        raise AppError("DEMO_CACHE_MISS", f"Demo mode is on and {what} wasn't prepared in advance. Open a sample lesson instead.", 404)


def originals(lesson: dict) -> list[dict]:
    return [{"id": s["id"], "heading": s.get("heading", ""), "text": s["text"]} for s in lesson["sections"] if s.get("text", "").strip()]


def summary_card(lesson: dict) -> dict:
    return {
        "id": lesson["id"], "title": lesson["title"], "created_at": lesson["created_at"], "sample": lesson.get("sample", False),
        "source_type": lesson["source"]["type"], "thumbnail": lesson["source"]["images"][0] if lesson["source"]["images"] else None,
        "sections": len(lesson["sections"]), "levels": sorted(lesson.get("simplified", {}).keys()),
        "factguard": {lvl: {"status": r["factguard"]["status"], "kept": r["factguard"]["kept"], "total": r["factguard"]["total"]}
                      for lvl, r in lesson.get("simplified", {}).items()},
        "has_lecture": bool(lesson.get("lecture_id")),
    }


@router.get("/lessons")
def list_lessons() -> list[dict]:
    return [summary_card(item) for item in cache.list_json("lessons") if item.get("id")]


@router.post("/lessons")
def create_lesson(file: UploadFile = File(...)) -> dict:
    s = get_settings()
    data = file.file.read()
    lesson_id = cache.make_key(data, s.prompt_version)
    existing = cache.get_json("lessons", lesson_id)
    if existing:
        return {**existing, "from_cache": True}
    demo_guard("this page")

    prepared = ingest.prepare(data, file.filename or "")
    read = ocr.read_page(prepared)
    title, sections, warnings = structure.build_sections(read["blocks"])
    for sec in sections:
        sec["text"] = structure.section_text(sec)
    if not any(sec["text"].strip() for sec in sections) and not any(b["type"] == "figure" for b in read["blocks"]):
        raise AppError("NO_TEXT_FOUND", "No readable text was found. Try a clearer, closer photo of the page.", 422)

    images = []
    for i, img in enumerate(prepared.images, start=1):
        cache.put_bytes("uploads", f"{lesson_id}_p{i}.jpg", img)
        images.append(f"/api/lessons/{lesson_id}/image/{i}")

    lesson = {
        "id": lesson_id,
        "title": title,
        "created_at": now(),
        "sample": False,
        "source": {"type": prepared.kind, "filename": file.filename or "", "pages": prepared.pages,
                   "text_layer": bool(prepared.text_layer), "images": images},
        "language": structure.detect_language(read["blocks"]) if read["language"] == "en" else read["language"],
        "sections": sections,
        "warnings": list(dict.fromkeys(read["warnings"] + warnings)),
        "models": {"reader": read["models"]},
        "simplified": {},
        "stress": {},
        "glossary": None,
        "quiz": {},
        "lecture_id": None,
        "prompt_version": s.prompt_version,
    }
    cache.put_json("lessons", lesson_id, lesson)
    return lesson


@router.get("/lessons/{lesson_id}")
def get_lesson(lesson_id: str) -> dict:
    return load_lesson(lesson_id)


@router.delete("/lessons/{lesson_id}")
def delete_lesson(lesson_id: str) -> dict:
    load_lesson(lesson_id)
    cache.delete("lessons", lesson_id)
    cache.delete("uploads", lesson_id)
    return {"deleted": True}


@router.get("/lessons/{lesson_id}/image/{page}")
def lesson_image(lesson_id: str, page: int) -> FileResponse:
    path = cache.path_for("uploads", f"{lesson_id}_p{page}.jpg")
    if not path.exists():
        raise AppError("NOT_FOUND", "Image not found.", 404)
    return FileResponse(path, media_type="image/jpeg")


@router.post("/lessons/{lesson_id}/simplify")
def simplify_lesson(lesson_id: str, body: LevelRequest) -> dict:
    lesson = load_lesson(lesson_id)
    if body.level in lesson.get("simplified", {}):
        return lesson["simplified"][body.level]
    demo_guard("this reading level")
    source = originals(lesson)
    if not source:
        raise AppError("NO_TEXT_FOUND", "This page has no text to simplify, only figures. Try Listen mode for the figure descriptions.", 422)
    result = simplify.simplify_with_guard(source, body.level)
    result["created_at"] = now()
    lesson = load_lesson(lesson_id)
    lesson.setdefault("simplified", {})[body.level] = result
    cache.put_json("lessons", lesson_id, lesson)
    return result


@router.post("/lessons/{lesson_id}/factguard/stress")
def stress_test(lesson_id: str, body: LevelRequest) -> dict:
    """Plants known errors in the rewrite and shows whether Fact Guard catches and repairs them."""
    lesson = load_lesson(lesson_id)
    if body.level in lesson.get("stress", {}):
        return lesson["stress"][body.level]
    simplified = lesson.get("simplified", {}).get(body.level)
    if not simplified:
        raise AppError("BAD_REQUEST", "Simplify the page first, then run the Fact Guard test.")
    if simplified["factguard"]["status"] == "unavailable" or not simplified["factguard"]["facts"]:
        raise AppError("FACTGUARD_UNAVAILABLE", "Fact Guard wasn't available for this rewrite, so it can't be tested.", 503, True)
    demo_guard("this Fact Guard test")

    source = originals(lesson)
    facts = [{k: f[k] for k in ("id", "section_id", "text", "source_sentence")} for f in simplified["factguard"]["facts"]]
    rewriter = simplified["factguard"]["rewriter_model"]
    avoid = family(rewriter)
    sabotaged, planted = factguard.sabotage(simplified["sections"], seed=lesson_id + body.level, facts=facts)
    report = factguard.audit(facts, source, sabotaged, avoid)
    planted = factguard.caught(planted, report)
    repaired = simplify.repair(source, sabotaged, factguard.problems_by_section(report), body.level, rewriter)
    repaired_report = factguard.audit(facts, source, repaired, avoid)
    result = {
        "level": body.level, "created_at": now(), "planted": planted,
        "caught": sum(p["caught"] for p in planted), "total_planted": len(planted),
        "sabotaged_sections": sabotaged, "sabotaged_report": report,
        "repaired_sections": repaired, "repaired_report": repaired_report,
    }
    lesson = load_lesson(lesson_id)
    lesson.setdefault("stress", {})[body.level] = result
    cache.put_json("lessons", lesson_id, lesson)
    return result


@router.post("/lessons/{lesson_id}/glossary")
def lesson_glossary(lesson_id: str) -> dict:
    lesson = load_lesson(lesson_id)
    if lesson.get("glossary"):
        return lesson["glossary"]
    demo_guard("the glossary")
    items, model = glossary.build(originals(lesson))
    result = {"items": items, "model": model, "created_at": now()}
    lesson = load_lesson(lesson_id)
    lesson["glossary"] = result
    cache.put_json("lessons", lesson_id, lesson)
    return result


def _public(q: dict) -> dict:
    return {"id": q["id"], "level": q["level"], "questions": [{k: v for k, v in item.items() if k != "answer"} for item in q["questions"]]}


@router.post("/lessons/{lesson_id}/quiz")
def make_quiz(lesson_id: str, body: QuizRequest) -> dict:
    lesson = load_lesson(lesson_id)
    existing = lesson.get("quiz", {}).get(body.level)
    if existing and (stored := cache.get_json("quizzes", existing)):
        return _public(stored)
    simplified = lesson.get("simplified", {}).get(body.level)
    if not simplified:
        raise AppError("BAD_REQUEST", "Simplify the page first, then take the quiz.")
    demo_guard("this quiz")
    questions, model = quiz.generate(simplified["factguard"]["facts"], body.level)
    quiz_id = cache.make_key(lesson_id, body.level, now())
    stored = {"id": quiz_id, "lesson_id": lesson_id, "level": body.level, "questions": questions, "model": model}
    cache.put_json("quizzes", quiz_id, stored)
    lesson = load_lesson(lesson_id)
    lesson.setdefault("quiz", {})[body.level] = quiz_id
    cache.put_json("lessons", lesson_id, lesson)
    return _public(stored)


@router.post("/quiz/{quiz_id}/answers")
def answer_quiz(quiz_id: str, body: QuizAnswers) -> dict:
    stored = cache.get_json("quizzes", quiz_id)
    if not stored:
        raise AppError("NOT_FOUND", "This quiz has expired. Please start a new one.", 404)
    return quiz.grade(stored["questions"], body.answers, stored["level"])


@router.get("/tts")
async def text_to_speech(text: str = Query(..., max_length=1500), lang: str = Query("ur", pattern="^(ur|en)$")) -> FileResponse:
    path = await tts.speak(text, lang)
    return FileResponse(path, media_type="audio/mpeg", headers={"Cache-Control": "public, max-age=86400"})
