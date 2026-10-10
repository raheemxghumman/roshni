"""Re-applies Fact Guard's plain-code quote check to cached results, without new AI calls.

Each stored fact keeps the checker's quote. Facts that were overturned only by the quote check
("The quoted words don't state this fact") are re-tested with the current rule, and each report's
totals and status are recomputed. Use this after changing factguard.supports().
Usage: python scripts/recheck_quotes.py
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from app.config import get_settings  # noqa: E402
from app.services.factguard import supports  # noqa: E402

NOTE = "The quoted words don't state this fact, so it was not verified."


def recheck(report: dict) -> int:
    flipped = 0
    for f in report.get("facts", []):
        if f.get("status") == "missing" and f.get("note") == NOTE and supports(f.get("evidence", ""), f["text"]):
            f["status"], f["note"] = "kept", ""
            flipped += 1
    if report.get("facts"):
        report["kept"] = sum(1 for f in report["facts"] if f["status"] == "kept")
        clean = report["kept"] == report["total"] and not report.get("added_claims") and not report.get("missing_tokens")
        report["status"] = "green" if clean else "amber"
        if report.get("rounds"):
            report["rounds"][-1].update(kept=report["kept"], status=report["status"])
    return flipped


for path in (get_settings().cache_path / "lessons").glob("*.json"):
    lesson = json.loads(path.read_text(encoding="utf-8"))
    total = 0
    for level, result in lesson.get("simplified", {}).items():
        total += recheck(result["factguard"])
    for level, stress in lesson.get("stress", {}).items():
        total += recheck(stress["repaired_report"])
    path.write_text(json.dumps(lesson, ensure_ascii=False, indent=1), encoding="utf-8")
    summary = {lvl: f"{r['factguard']['status']} {r['factguard']['kept']}/{r['factguard']['total']}" for lvl, r in lesson.get("simplified", {}).items()}
    print(f"{lesson['title'][:38]:38} re-verified {total:2} fact(s) -> {summary}")
