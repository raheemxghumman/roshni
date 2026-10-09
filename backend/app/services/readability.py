"""Flesch-Kincaid grade, average sentence length and hard-word share (textstat), plus sentence splitting."""
from __future__ import annotations

import re

import textstat

_ABBREV = r"(?:e\.g|i\.e|etc|Fig|fig|Dr|Mr|Mrs|Ms|vs|approx|No)\."


def split_sentences(text: str) -> list[str]:
    text = re.sub(r"\s+", " ", (text or "").strip())
    if not text:
        return []
    protected = re.sub(_ABBREV, lambda m: m.group(0).replace(".", "§"), text)
    parts = re.split(r"(?<=[.!?])[\"')\]]?\s+(?=[A-Z0-9\"'(\[])", protected)
    return [p.replace("§", ".").strip() for p in parts if p.strip()]


def stats(text: str) -> dict:
    text = (text or "").strip()
    if not text:
        return {"grade": 0.0, "avg_sentence_words": 0.0, "hard_word_share": 0.0, "words": 0}
    words = textstat.lexicon_count(text, removepunct=True)
    sentences = max(1, len(split_sentences(text)))
    hard = textstat.difficult_words(text)
    return {
        "grade": round(max(0.0, textstat.flesch_kincaid_grade(text)), 1),
        "avg_sentence_words": round(words / sentences, 1),
        "hard_word_share": round(hard / max(1, words), 3),
        "words": words,
    }
