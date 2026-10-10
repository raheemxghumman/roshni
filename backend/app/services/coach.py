"""Checked AI coach v2: model phrases a short note; code owns every number and the missed fact."""
from __future__ import annotations

import re

from ..config import fill, load_prompt
from ..errors import AppError
from . import cache
from .llm_clients import text_json

DIGITS = re.compile(r"\d")


def _no_digits(text: str) -> bool:
    return not DIGITS.search(text or "")


def _parts(report: dict) -> tuple[str, str, str]:
    plan = report.get("plan") or []
    plan_title = next((p.get("title") for p in plan if p.get("title")), "Practise your weak areas")
    for s in report.get("sections") or []:
        facts = s.get("missed_facts") or []
        if facts:
            return str(facts[0]).strip(), s.get("heading") or "This page", plan_title
    return "", "", plan_title


def _cache_key(quiz: dict, report: dict, missed: str, plan_title: str) -> str:
    return cache.make_key("coach", quiz["id"], report.get("correct"), report.get("total"), missed[:80], plan_title)


def cached_note(quiz: dict, report: dict) -> dict | None:
    missed, _, plan_title = _parts(report)
    if not missed:
        return None
    if hit := cache.get_json("coaches", _cache_key(quiz, report, missed, plan_title)):
        return {**hit, "cached": True}
    return None


def build_note(quiz: dict, report: dict) -> dict:
    """Returns {text, checked, cached} or raises. Never invents numbers."""
    missed, section, plan_title = _parts(report)
    if not missed:
        raise AppError("BAD_REQUEST", "There is nothing to coach on for this result.")

    key = _cache_key(quiz, report, missed, plan_title)
    if cached := cache.get_json("coaches", key):
        return {**cached, "cached": True}

    data, model = text_json(
        fill(load_prompt("coach.txt"), section_heading=section[:120], missed_fact=missed[:280], plan_title=plan_title[:160]),
        "coach",
        max_tokens=400,
    )
    lines = []
    for raw in data.get("lines") or []:
        line = re.sub(r"\s+", " ", str(raw)).strip()
        if line and _no_digits(line) and len(line) <= 220:
            lines.append(line)
        if len(lines) >= 2:
            break
    if not lines:
        raise AppError("MODEL_UNAVAILABLE", "The coach note couldn't be checked. Showing the plain note instead.", 503, True)

    # Force the next-step line to copy the study-plan title exactly; drop any model inventing a different one.
    next_line = f"Next: {plan_title}"
    body = [ln for ln in lines if not ln.lower().startswith("next:")]
    if not body:
        raise AppError("MODEL_UNAVAILABLE", "The coach note couldn't be checked. Showing the plain note instead.", 503, True)

    correct = report.get("correct", 0)
    total = report.get("total", 0)
    # Code writes every number and inserts the missed fact word-for-word.
    lead = f"You scored {correct} of {total}."
    middle = body[0]
    if missed.lower() not in middle.lower():
        middle = f"{middle} Remember: {missed.replace(chr(10), ' ').strip().rstrip('.') }."
    text = " ".join([lead, middle, next_line])
    result = {"text": text, "checked": True, "model": model, "plan_title": plan_title}
    cache.put_json("coaches", key, result)
    return {**result, "cached": False}
