"""Shared helpers for the evaluation scripts: backend imports, cached lessons, result writing."""
from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.config import get_settings  # noqa: E402

RESULTS = ROOT / "eval" / "results"
OPENSTAX = ROOT / "data" / "openstax"


def lessons(samples_only: bool = True) -> list[dict]:
    folder = get_settings().cache_path / "lessons"
    out = []
    for p in sorted(folder.glob("*.json")):
        d = json.loads(p.read_text(encoding="utf-8"))
        if not samples_only or d.get("sample"):
            out.append(d)
    return out


def original_sections(lesson: dict) -> list[dict]:
    return [{"id": s["id"], "heading": s.get("heading", ""), "text": s["text"]} for s in lesson["sections"] if s.get("text", "").strip()]


def write(metric: str, **fields) -> dict:
    RESULTS.mkdir(parents=True, exist_ok=True)
    result = {"metric": metric, "date": date.today().isoformat(), **fields}
    (RESULTS / f"{metric}.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return result
