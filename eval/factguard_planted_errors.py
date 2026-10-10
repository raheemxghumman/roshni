"""Planted-error test for Fact Guard, plus a false-alarm test.

1. Recall: for every cached sample rewrite, plant 3 known errors (changed number, deleted fact sentence,
   invented claim) with several seeds, run the audit, and count how many were caught.
2. False alarms: audit each ORIGINAL page against itself. Nothing changed, so every fact should be
   "kept" and no claim should be flagged; anything flagged is a false alarm.

Usage: python eval/factguard_planted_errors.py [--seeds 2]   (run scripts/warm_cache.py first)
"""
import argparse
import json
import time

from common import lessons, original_sections, write
from app.services import factguard
from app.errors import AppError
from app.services.llm_clients import family

PROGRESS = __import__("common").RESULTS / "_planted_progress.json"


def audit_patiently(*args):
    """Free tiers can all be busy at once; wait and retry rather than crash."""
    for attempt in range(8):
        try:
            return factguard.audit(*args)
        except AppError as e:
            if e.code not in ("FACTGUARD_UNAVAILABLE", "RATE_LIMITED"):
                raise
            print(f"   all checkers busy, waiting 60 s (attempt {attempt + 1})", flush=True)
            time.sleep(60)
    raise SystemExit("Checkers stayed unavailable; re-run later to resume.")


progress = json.loads(PROGRESS.read_text(encoding="utf-8")) if PROGRESS.exists() else {}


def save():
    PROGRESS.write_text(json.dumps(progress, indent=1), encoding="utf-8")

ap = argparse.ArgumentParser()
ap.add_argument("--seeds", type=int, default=2)
args = ap.parse_args()

planted_total = caught_total = 0
by_type: dict[str, list[int]] = {}
fa_flags = fa_facts = 0
pages = 0
checkers: set[str] = set()
for lesson in lessons():
    source = original_sections(lesson)
    simplified = lesson.get("simplified", {}).get("easier")
    if not simplified or not simplified["factguard"]["facts"]:
        continue
    pages += 1
    facts = [{k: f[k] for k in ("id", "section_id", "text", "source_sentence")} for f in simplified["factguard"]["facts"]]
    avoid = family(simplified["factguard"]["rewriter_model"])
    for seed in range(args.seeds):
        key = f"{lesson['id']}-{seed}"
        if key not in progress:
            sabotaged, planted = factguard.sabotage(simplified["sections"], seed=key, facts=facts)
            report = audit_patiently(facts, source, sabotaged, avoid)
            progress[key] = {"caught": factguard.caught(planted, report), "checker": report["checker_model"]}
            save()
            time.sleep(3)
        checkers.add(progress[key]["checker"])
        for p in progress[key]["caught"]:
            planted_total += 1
            caught_total += p["caught"]
            by_type.setdefault(p["type"], [0, 0])
            by_type[p["type"]][0] += p["caught"]
            by_type[p["type"]][1] += 1
        print(f"{lesson['title'][:40]:40} seed {seed}: caught {sum(p['caught'] for p in progress[key]['caught'])}/{len(progress[key]['caught'])}", flush=True)
    # false alarms: original vs itself
    key = f"{lesson['id']}-identity"
    if key not in progress:
        identity = audit_patiently(facts, source, [{"id": s["id"], "text": s["text"]} for s in source], avoid)
        progress[key] = {"flags": (identity["total"] - identity["kept"]) + len(identity["added_claims"]) + len(identity["missing_tokens"]),
                         "facts": identity["total"], "checker": identity["checker_model"]}
        save()
        time.sleep(3)
    checkers.add(progress[key]["checker"])
    fa_flags += progress[key]["flags"]
    fa_facts += progress[key]["facts"]
    print(f"{lesson['title'][:40]:40} identity check: {progress[key]['flags']} false flag(s) over {progress[key]['facts']} facts", flush=True)

if not planted_total:
    raise SystemExit("No sample rewrites found. Run scripts/warm_cache.py first.")

labels = {"changed_number": "changed numbers", "deleted_fact": "deleted facts", "added_claim": "invented claims"}
write(
    "factguard_planted_errors",
    title="Planted errors caught by Fact Guard",
    display=f"{caught_total}/{planted_total}",
    value=round(caught_total / planted_total, 4),
    detail="; ".join(f"{labels[t]}: {c}/{n}" for t, (c, n) in by_type.items()) + f". Errors are planted by code, so the right answer is known in advance.",
    dataset="Sabotaged rewrites of OpenStax pages (synthetic errors, real text)",
    n=f"{planted_total} planted errors on {pages} pages × {args.seeds} seeds",
    method="Plant changed number + deleted fact + invented claim, run the audit, check each was flagged",
    models="checker: " + ", ".join(sorted(m for m in checkers if m)),
    data_type="synthetic",
)
write(
    "factguard_false_alarms",
    title="False alarms on unchanged text",
    display=f"{fa_flags / fa_facts:.1%}" if fa_facts else "—",
    value=round(fa_flags / fa_facts, 4) if fa_facts else None,
    detail=f"Each original page was audited against itself. {fa_flags} flag(s) were raised across {fa_facts} facts where nothing had changed.",
    dataset="OpenStax textbook pages (CC BY 4.0)",
    n=f"{fa_facts} facts on {pages} pages",
    method="Audit the original text against itself; every flag is a false alarm",
    models="checker: " + ", ".join(sorted(m for m in checkers if m)),
    data_type="real",
)
