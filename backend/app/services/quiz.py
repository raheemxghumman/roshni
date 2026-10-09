"""Generates questions from Fact Guard's verified facts only, grades answers and moves the reading level."""
from __future__ import annotations

import json

from ..config import fill, load_prompt
from ..errors import AppError
from .llm_clients import text_json

LEVEL_ORDER = ["original", "easier", "simplest"]


def generate(facts: list[dict], level: str, n: int = 4) -> tuple[list[dict], str]:
    kept = [{"id": f["id"], "text": f["text"]} for f in facts if f.get("status") == "kept"][:20]
    if len(kept) < 2:
        raise AppError("NO_TEXT_FOUND", "There aren't enough checked facts on this page to make a quiz.")
    data, model = text_json(fill(load_prompt("quiz.txt"), n=min(n, len(kept)), level_name=level, facts_json=json.dumps(kept, ensure_ascii=False)),
                            "rewrite", max_tokens=3000)
    questions = []
    for i, q in enumerate(data.get("questions") or [], start=1):
        if not isinstance(q, dict) or not q.get("question") or not q.get("answer"):
            continue
        qtype = q.get("type") if q.get("type") in ("mcq", "true_false") else "mcq"
        options = [str(o) for o in q.get("options") or []] if qtype == "mcq" else ["True", "False"]
        answer = str(q["answer"])
        if qtype == "mcq" and answer not in options:
            continue  # drop malformed questions rather than show a wrong key
        questions.append({"id": f"q{i}", "type": qtype, "question": q["question"], "options": options, "answer": answer, "fact_id": q.get("fact_id", "")})
    if not questions:
        raise AppError("MODEL_UNAVAILABLE", "The quiz couldn't be made right now. Please try again.", 503, True)
    return questions, model


def grade(questions: list[dict], answers: dict[str, str], level: str) -> dict:
    results = []
    for q in questions:
        given = answers.get(q["id"], "")
        results.append({"id": q["id"], "correct": given.strip().lower() == q["answer"].strip().lower(), "given": given, "answer": q["answer"]})
    score = sum(r["correct"] for r in results) / max(1, len(results))
    idx = LEVEL_ORDER.index(level) if level in LEVEL_ORDER else 1
    if score >= 0.8 and idx > 0:
        new_level, advice = LEVEL_ORDER[idx - 1], "Great work! Try the next level up."
    elif score < 0.5 and idx < len(LEVEL_ORDER) - 1:
        new_level, advice = LEVEL_ORDER[idx + 1], "Let's make it simpler. You can also try Listen mode."
    else:
        new_level, advice = level, "Good. Stay at this level for now."
    return {"results": results, "score": round(score, 2), "new_level": new_level, "advice": advice}
