"""Practice quizzes.

Questions are written only from facts Fact Guard verified, in small batches, and every one is validated in code
(4 distinct options, exactly one correct, tied to a real fact and section). Options are shuffled so the answer isn't
always A. Grading, weak areas and the study plan are plain code: no AI, so the advice can't be made up.
"""
from __future__ import annotations

import json
import random
import re
from concurrent.futures import ThreadPoolExecutor

from ..config import fill, load_prompt
from ..errors import AppError
from .llm_clients import text_json

LEVEL_ORDER = ["original", "easier", "simplest"]
SIZES = (5, 10, 15)
BATCH = 5  # questions per AI call: small enough for the free per-minute output limits
MIN_FACTS = 3
WEAK_BELOW = 0.7  # a section is weak when less than 70% of its questions were right
BANNED_OPTIONS = re.compile(r"\b(all|none|both|neither) of (the|these) (above|options)\b|^(all|none) of them$", re.I)


# ---------------------------------------------------------------- facts

def verified_facts(lesson: dict, level: str) -> list[dict]:
    """Kept facts from the requested level's Fact Guard report, or from the other level (facts describe the original page)."""
    simplified = lesson.get("simplified") or {}
    for lvl in [level] + [l for l in ("easier", "simplest") if l != level]:
        report = (simplified.get(lvl) or {}).get("factguard") or {}
        facts = [f for f in report.get("facts") or [] if f.get("status") == "kept" and (f.get("text") or "").strip()]
        if facts:
            return facts
    return []


def pick_facts(facts: list[dict], n: int, section_ids: list[str] | None, seed: str) -> list[dict]:
    """Up to n facts, interleaved across sections so every part of the page is tested."""
    pool = [f for f in facts if not section_ids or f.get("section_id") in section_ids]
    rng = random.Random(seed)
    by_section: dict[str, list[dict]] = {}
    for f in pool:
        by_section.setdefault(f.get("section_id", ""), []).append(f)
    for group in by_section.values():
        rng.shuffle(group)
    chosen: list[dict] = []
    while len(chosen) < n and any(by_section.values()):
        for sid in list(by_section):
            if by_section[sid] and len(chosen) < n:
                chosen.append(by_section[sid].pop())
    return chosen


# ---------------------------------------------------------------- generation + validation

def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", str(text)).strip().lower().rstrip(".")


def _fact_id(raw, valid: set[str]) -> str | None:
    fid = str(raw or "").strip()
    if re.fullmatch(r"\d+", fid):
        fid = f"f{fid}"
    return fid if fid in valid else None


def clean_question(q: dict, facts_by_id: dict[str, dict], seen: set[str]) -> dict | None:
    """Returns a valid 4-option question tied to one verified fact, or None. Never guesses a wrong answer key."""
    if not isinstance(q, dict):
        return None
    question = re.sub(r"\s+", " ", str(q.get("question") or "")).strip()
    fid = _fact_id(q.get("fact_id"), set(facts_by_id))
    if not question or len(question) > 300 or not fid or _norm(question) in seen:
        return None
    options: list[str] = []
    for o in q.get("options") or []:
        text = re.sub(r"^\s*(?:[A-Da-d]|[1-4])[.)]\s+", "", re.sub(r"\s+", " ", str(o))).strip()  # drop "A) " prefixes
        if text and _norm(text) not in {_norm(x) for x in options} and len(text) <= 160:
            options.append(text)
    if len(options) != 4 or any(BANNED_OPTIONS.search(o) for o in options):
        return None  # "all of the above" breaks once options are shuffled
    raw_answer = str(q.get("answer") or "").strip()
    answer = next((o for o in options if _norm(o) == _norm(raw_answer)), None)
    if answer is None and re.fullmatch(r"[A-Da-d]", raw_answer) and "ABCD".index(raw_answer.upper()) < len(options):
        answer = options["ABCD".index(raw_answer.upper())]
    if answer is None:
        return None  # drop it rather than risk marking a right answer wrong
    options = [answer] + [o for o in options if o != answer][:3]
    random.Random(question).shuffle(options)  # stable per question, so a reload shows the same order
    seen.add(_norm(question))
    fact = facts_by_id[fid]
    explanation = re.sub(r"\s+", " ", str(q.get("explanation") or "")).strip()[:240]
    return {"question": question, "options": options, "answer": answer, "answer_index": options.index(answer),
            "fact_id": fid, "section_id": fact.get("section_id", ""), "fact": fact["text"], "explanation": explanation}


def generate(facts: list[dict], level: str, n: int, section_ids: list[str] | None = None, seed: str = "",
             min_facts: int | None = None) -> tuple[list[dict], str]:
    need = MIN_FACTS if min_facts is None else max(1, min_facts)
    pool = [f for f in facts if not section_ids or f.get("section_id") in section_ids]
    if len(pool) < need:
        raise AppError("NOT_ENOUGH_FACTS", "There aren't enough checked facts in this part of the page for a quiz. Try the whole page.", 422)
    chosen = pick_facts(facts, min(n, len(pool)), section_ids, seed)
    facts_by_id = {f["id"]: f for f in chosen}
    questions: list[dict] = []
    seen: set[str] = set()
    model = ""
    todo = list(chosen)
    def ask(batch: list[dict]) -> tuple[list[dict], dict, str]:
        try:
            data, used = text_json(fill(load_prompt("quiz.txt"), n=len(batch), level_name=level,
                                        facts_json=json.dumps([{"id": f["id"], "text": f["text"]} for f in batch], ensure_ascii=False)),
                                   "quiz", max_tokens=1600)
            return batch, data, used
        except AppError:
            return batch, {}, ""  # one failed batch shouldn't sink the quiz; its facts are retried in round 2

    for round_no in range(2):  # second round only tops up facts whose question was missing or rejected
        batches = [todo[i : i + BATCH] for i in range(0, len(todo), BATCH)]
        with ThreadPoolExecutor(max_workers=3) as pool:  # batches in parallel: 15 questions take as long as 5
            replies = list(pool.map(ask, batches))
        for batch, data, used in replies:
            model = used or model
            batch_ids = {f["id"] for f in batch}
            for raw in data.get("questions") or []:
                q = clean_question(raw, {k: v for k, v in facts_by_id.items() if k in batch_ids}, seen)
                if q and q["fact_id"] not in {x["fact_id"] for x in questions}:
                    questions.append(q)
        done = {q["fact_id"] for q in questions}
        todo = [f for f in chosen if f["id"] not in done]
        if not todo or round_no == 1:
            break
    if len(questions) < min(need, len(chosen)):
        raise AppError("MODEL_UNAVAILABLE", "The quiz couldn't be made right now. Please try again.", 503, True)
    order = {f["id"]: i for i, f in enumerate(chosen)}
    questions.sort(key=lambda q: order[q["fact_id"]])
    for i, q in enumerate(questions, start=1):
        q["id"] = f"q{i}"
    return questions, model


def public(quiz: dict) -> dict:
    """What the browser sees before answering: no answer keys."""
    hidden = {"answer", "answer_index", "fact", "explanation"}
    return {"id": quiz["id"], "level": quiz["level"], "section_ids": quiz.get("section_ids") or [],
            "questions": [{k: v for k, v in q.items() if k not in hidden} for q in quiz["questions"]]}


def check_one(quiz: dict, question_id: str, answer: str) -> dict:
    q = next((x for x in quiz["questions"] if x["id"] == question_id), None)
    if not q:
        raise AppError("NOT_FOUND", "This question isn't part of the quiz.", 404)
    return {"id": q["id"], "correct": bool(answer) and _norm(answer) == _norm(q["answer"]), "answer": q["answer"],
            "answer_index": q["answer_index"], "explanation": q["explanation"], "fact": q["fact"],
            "fact_id": q.get("fact_id", ""), "section_id": q.get("section_id", "")}


# ---------------------------------------------------------------- grading, weak areas, study plan

def grade(quiz: dict, answers: dict[str, str], timed_out: list[str], lesson: dict, videos: list[dict]) -> dict:
    results = []
    for q in quiz["questions"]:
        given = str(answers.get(q["id"]) or "").strip()
        r = check_one(quiz, q["id"], given)
        r.update({"question": q["question"], "given": given, "section_id": q["section_id"],
                  "timed_out": q["id"] in timed_out and not given, "skipped": not given and q["id"] not in timed_out})
        results.append(r)
    total = len(results)
    correct = sum(r["correct"] for r in results)
    score = correct / max(1, total)

    headings = {s["id"]: s.get("heading") or f"Section {i + 1}" for i, s in enumerate(lesson.get("sections") or [])}
    order = list(headings)
    sections = []
    for sid in sorted({r["section_id"] for r in results}, key=lambda s: order.index(s) if s in order else 99):
        rs = [r for r in results if r["section_id"] == sid]
        right = sum(r["correct"] for r in rs)
        sections.append({"id": sid, "heading": headings.get(sid, "This page"), "correct": right, "total": len(rs),
                         "weak": right / len(rs) < WEAK_BELOW,
                         "missed_facts": [r["fact"] for r in rs if not r["correct"]]})
    weak = sorted([s for s in sections if s["weak"]], key=lambda s: s["correct"] / s["total"])

    level = quiz["level"]
    idx = LEVEL_ORDER.index(level) if level in LEVEL_ORDER else 1
    if score >= 0.8 and idx > 0:
        new_level, advice = LEVEL_ORDER[idx - 1], "Great work! You're ready for the next level up."
    elif score < 0.5 and idx < len(LEVEL_ORDER) - 1:
        new_level, advice = LEVEL_ORDER[idx + 1], "Let's make it simpler first, then try again."
    else:
        new_level, advice = level, "Good progress. Practise your weak areas, then try again."
    timeouts = sum(r["timed_out"] for r in results)
    return {"score": round(score, 2), "correct": correct, "total": total, "timed_out": timeouts,
            "skipped": sum(r["skipped"] for r in results), "results": results, "sections": sections,
            "weak_sections": [s["id"] for s in weak], "plan": study_plan(weak, lesson, videos, timeouts / max(1, total), score),
            "new_level": new_level, "advice": advice}


STOP = set("the a an and or of to in on for with is are was were be by as at from that this it its into than then their there these those which who what when how why can will also not".split())


def keywords(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z][a-z\-]{3,}", text.lower()) if w not in STOP}


def study_plan(weak: list[dict], lesson: dict, videos: list[dict], timeout_share: float, score: float) -> list[dict]:
    """Concrete steps that point back to this lesson's own materials. Each step has an action the app can open."""
    plan: list[dict] = []
    glossary = (lesson.get("glossary") or {}).get("items") or []
    for s in weak[:3]:
        sid, heading = s["id"], s["heading"]
        plan.append({"kind": "read", "section_id": sid, "title": f"Re-read “{heading}” at the Simplest level",
                     "detail": "Shorter sentences, same facts. Tap a sentence to hear it.", "action": {"tab": "read", "level": "simplest", "section": sid}})
        listen_level = "simplest" if (lesson.get("simplified") or {}).get("simplest") else "easier"
        plan.append({"kind": "listen", "section_id": sid, "title": f"Listen to “{heading}”",
                     "detail": "Hearing it once more helps it stick. Slow the voice down if you need to.",
                     "action": {"tab": "listen", "section": sid, "level": listen_level, "simple": True}})
        words = [g["term"] for g in glossary if g.get("section_id") == sid][:4]
        if words:
            plan.append({"kind": "words", "section_id": sid, "title": "Learn the hard words: " + ", ".join(words),
                         "detail": "Each word has a simple explanation in English, Urdu and Pashto.", "action": {"tab": "read", "section": sid, "term": words[0].lower()}})
        wanted = keywords(heading + " " + " ".join(s["missed_facts"]) + " " + " ".join(words))
        for v in videos:
            hit = best_video_moment(v, wanted)
            if hit:
                plan.append({"kind": "video", "section_id": sid, "title": f"Watch {fmt_time(hit['start'])} in “{v.get('title', 'your video')}”",
                             "detail": hit["text"][:140], "action": {"tab": "videos", "video": v["id"], "t": int(hit["start"])}})
                break
    if weak and lesson.get("lecture_id"):
        plan.append({"kind": "lecture", "title": "Review the class recording", "detail": "Read the captions and the checked summary.", "action": {"tab": "captions"}})
    if timeout_share >= 0.3:
        plan.append({"kind": "timer", "title": "Give yourself more time", "detail": "Several questions ran out of time. Try the 30-second timer, or switch the timer off.", "action": {"practice": "setup"}})
    if weak:
        plan.append({"kind": "retry", "title": "Practise only your weak areas", "detail": "A short quiz on just these parts of the page.", "action": {"practice": "weak"}})
    elif score >= 0.8:
        plan.append({"kind": "retry", "title": "Try a harder quiz", "detail": "Take 15 questions, or switch to the Original level.", "action": {"practice": "setup"}})
    return plan


def best_video_moment(video: dict, wanted: set[str]) -> dict | None:
    """The note in an attached video that shares the most key words with what the student missed."""
    best, best_score = None, 0
    for sec in video.get("notes") or []:
        for note in sec.get("notes") or []:
            if note.get("status") not in (None, "supported"):
                continue
            score = len(keywords(note["text"] + " " + sec.get("heading", "")) & wanted)
            if score > best_score:
                best, best_score = {"start": note.get("start", sec.get("start", 0)), "text": note["text"]}, score
    return best if best_score >= 2 else None


def fmt_time(seconds: float) -> str:
    s = int(seconds)
    return f"{s // 3600}:{s % 3600 // 60:02d}:{s % 60:02d}" if s >= 3600 else f"{s // 60}:{s % 60:02d}"
