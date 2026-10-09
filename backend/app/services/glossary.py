"""Picks hard words without AI (wordfreq), then gets simple English + Urdu explanations. Terms stay in English."""
from __future__ import annotations

import json
import re

from wordfreq import zipf_frequency

from ..config import fill, load_prompt
from .llm_clients import text_json

MAX_TERMS = 10
ZIPF_HARD = 3.6
STOP = {"however", "therefore", "although", "because", "another", "between", "through", "without", "different",
        "important", "example", "including", "something", "everything", "products", "customers"}


def candidates(text: str, limit: int = MAX_TERMS) -> list[str]:
    seen: dict[str, float] = {}
    for word in re.findall(r"[A-Za-z][A-Za-z\-]{5,}", text):
        w = word.lower().strip("-")
        if w in STOP or w in seen:
            continue
        z = zipf_frequency(w, "en")
        if z < ZIPF_HARD:
            seen[w] = z
    return [w for w, _ in sorted(seen.items(), key=lambda kv: kv[1])[:limit]]


def build(sections: list[dict]) -> tuple[list[dict], str]:
    text = "\n".join(s["text"] for s in sections)
    words = candidates(text)
    if not words:
        return [], ""
    data, model = text_json(fill(load_prompt("glossary.txt"), words=json.dumps(words), section_text=text[:6000]), "rewrite", max_tokens=3000)
    items = []
    for it in data.get("items") or []:
        if not isinstance(it, dict) or not it.get("term"):
            continue
        term = str(it["term"]).strip()
        section = next((s["id"] for s in sections if term.lower() in s["text"].lower()), sections[0]["id"] if sections else "")
        items.append({"term": term, "simple_en": (it.get("simple_en") or "").strip(), "urdu": (it.get("urdu") or "").strip(),
                      "example": (it.get("example") or "").strip(), "section_id": section})
    return items, model
