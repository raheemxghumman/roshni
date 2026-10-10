"""Rewrites a lesson at a target level (Qwen on Groq), then runs Fact Guard with up to two repair rounds."""
from __future__ import annotations

import json
import re

from ..config import fill, load_prompt
from ..errors import AppError
from . import factguard, normalize
from .llm_clients import family, text_json
from .readability import stats

LEVELS = {
    "easier": {"level_name": "Easier", "target_grade": "6 to 7", "max_words": 14},
    "simplest": {"level_name": "Simplest", "target_grade": "4 to 5", "max_words": 10},
}
MAX_REPAIR_ROUNDS = 2


def _clean(text: str) -> str:
    text = re.sub(r"^\s*#+\s*", "", text or "", flags=re.M)
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    return re.sub(r"[ \t]+", " ", text).strip()


def _payload(sections: list[dict]) -> str:
    return json.dumps([{"id": s["id"], "heading": s.get("heading", ""), "text": s["text"],
                        "protected_items": normalize.protected_tokens(s["text"])} for s in sections], ensure_ascii=False)


def rewrite(original_sections: list[dict], level: str) -> tuple[list[dict], str]:
    cfg = LEVELS[level]
    out: dict[str, str] = {}
    model = ""
    for chunk in factguard.chunk_sections(original_sections):
        data, model = text_json(fill(load_prompt("simplify_sections.txt"), sections_json=_payload(chunk), **cfg), "rewrite", max_tokens=6000)
        for s in data.get("sections") or []:
            if isinstance(s, dict) and s.get("id") and (s.get("text") or "").strip():
                out[str(s["id"])] = _clean(s["text"])
    missing = [s for s in original_sections if s["id"] not in out]
    if out and missing:  # the model skipped some sections: ask again for just those
        data, _ = text_json(fill(load_prompt("simplify_sections.txt"), sections_json=_payload(missing), **cfg), "rewrite", max_tokens=6000)
        for s in data.get("sections") or []:
            if isinstance(s, dict) and s.get("id") and (s.get("text") or "").strip():
                out[str(s["id"])] = _clean(s["text"])
    sections = []
    for s in original_sections:
        text = out.get(s["id"])
        sections.append({"id": s["id"], "heading": s.get("heading", ""), "text": text or s["text"], "simplified": bool(text)})
    if not out:
        raise AppError("MODEL_UNAVAILABLE", "The rewrite came back empty. Please try again.", 502, True)
    return sections, model


def repair(original_sections: list[dict], rewrite_sections: list[dict], problems: dict[str, dict], level: str, rewriter_model: str) -> list[dict]:
    cfg = LEVELS[level]
    targets = [s for s in rewrite_sections if s["id"] in problems]
    if not targets:
        return rewrite_sections
    originals = {s["id"]: s for s in original_sections}
    payload = json.dumps([{"id": s["id"], "original": originals[s["id"]]["text"], "current_rewrite": s["text"],
                           "protected_items": normalize.protected_tokens(originals[s["id"]]["text"])} for s in targets], ensure_ascii=False)
    data, _ = text_json(fill(load_prompt("repair.txt"), problems_json=json.dumps(problems, ensure_ascii=False), sections_json=payload, **cfg),
                        "rewrite", max_tokens=6000)
    fixed = {str(s["id"]): _clean(s["text"]) for s in data.get("sections") or [] if isinstance(s, dict) and s.get("id") and s.get("text")}
    return [{**s, "text": fixed.get(s["id"], s["text"])} for s in rewrite_sections]


def simplify_with_guard(original_sections: list[dict], level: str) -> dict:
    if level not in LEVELS:
        raise AppError("BAD_REQUEST", "Unknown reading level.")
    sections, rewriter_model = rewrite(original_sections, level)
    avoid = family(rewriter_model)

    extracted = factguard.ensure_available(factguard.extract_facts, original_sections, avoid)
    rounds: list[dict] = []
    if extracted is None:
        report = factguard.unavailable_report("No independent checking model was available, so this rewrite is unverified.")
        extractor_model = ""
    else:
        facts, extractor_model = extracted
        report = factguard.audit(facts, original_sections, sections, avoid)
        rounds.append(factguard.round_summary(report, 1, "Checked the first rewrite"))
        round_no = 1
        while report["status"] == "amber" and round_no <= MAX_REPAIR_ROUNDS:
            sections = repair(original_sections, sections, factguard.problems_by_section(report), level, rewriter_model)
            report = factguard.audit(facts, original_sections, sections, avoid)
            round_no += 1
            rounds.append(factguard.round_summary(report, round_no, "Repaired the flagged sentences and checked again"))

    before = stats(" ".join(s["text"] for s in original_sections))
    after = stats(" ".join(s["text"] for s in sections))
    return {
        "level": level,
        "sections": sections,
        "readability": {"before": before, "after": after},
        "factguard": {**report, "rounds": rounds, "rewriter_model": rewriter_model, "extractor_model": extractor_model},
    }
