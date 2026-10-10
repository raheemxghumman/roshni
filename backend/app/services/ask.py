"""Grounded sentence tutor: answers only from the section that holds the tapped sentence."""
from __future__ import annotations

import re
import time
from collections import defaultdict

from ..config import fill, load_prompt
from ..errors import AppError
from . import factguard
from .llm_clients import text_json

ASK_LIMIT_PER_HOUR = 20
_hits: dict[str, list[float]] = defaultdict(list)
DIGITS = re.compile(r"\d+(?:\.\d+)?")


def _rate_ok(lesson_id: str) -> bool:
    now = time.time()
    window = _hits[lesson_id] = [t for t in _hits[lesson_id] if now - t < 3600]
    if len(window) >= ASK_LIMIT_PER_HOUR:
        return False
    window.append(now)
    return True


def _numbers_in_quote(sentence: str, quote: str) -> bool:
    nums = set(DIGITS.findall(sentence.replace(",", "")))
    if not nums:
        return True
    return nums <= set(DIGITS.findall(quote.replace(",", "")))


def find_section(lesson: dict, sentence: str) -> dict | None:
    needle = re.sub(r"\s+", " ", (sentence or "").strip())
    if not needle:
        return None
    for s in lesson.get("sections") or []:
        text = s.get("text") or ""
        if needle in text:
            return s
        # also match against simplified versions when the learner tapped those
        for lvl in ("easier", "simplest"):
            for sec in ((lesson.get("simplified") or {}).get(lvl) or {}).get("sections") or []:
                if sec.get("id") == s["id"] and needle in (sec.get("text") or ""):
                    return {**s, "text": sec.get("text") or text}
    return None


def answer(lesson: dict, sentence: str, question: str) -> dict:
    if not _rate_ok(lesson["id"]):
        raise AppError("RATE_LIMITED", "You've asked quite a few questions on this page. Please try again in a little while.", 429, True)
    section = find_section(lesson, sentence)
    if not section:
        return {"answerable": False, "answer": "The page doesn't say that.", "sentences": [], "quotes": []}
    q = re.sub(r"\s+", " ", (question or "").strip())[:400]
    if len(q) < 2:
        raise AppError("BAD_REQUEST", "Please type a short question about this sentence.")
    data, model = text_json(
        fill(load_prompt("ask.txt"), section_text=section.get("text", "")[:4000], sentence=sentence[:500], question=q),
        "ask",
        max_tokens=800,
    )
    if not data.get("answerable"):
        return {"answerable": False, "answer": "The page doesn't say that.", "sentences": [], "quotes": [], "model": model}

    kept: list[dict] = []
    body = section.get("text") or ""
    for raw in data.get("sentences") or []:
        if not isinstance(raw, dict):
            continue
        text = re.sub(r"\s+", " ", str(raw.get("text") or "")).strip()
        quote = re.sub(r"\s+", " ", str(raw.get("quote") or "")).strip()
        if not text or not quote or not factguard.evidence_ok(quote, body) or not _numbers_in_quote(text, quote):
            continue
        kept.append({"text": text[:300], "quote": quote[:400]})
        if len(kept) >= 2:
            break
    if not kept:
        return {"answerable": False, "answer": "The page doesn't say that.", "sentences": [], "quotes": [], "model": model}
    return {
        "answerable": True,
        "answer": " ".join(s["text"] for s in kept),
        "sentences": kept,
        "quotes": [s["quote"] for s in kept],
        "section_id": section.get("id"),
        "model": model,
    }
