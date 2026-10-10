"""Planted-error test for Fact Guard, plus a false-alarm test.

1. Recall: for every cached sample rewrite, plant 3 known errors (changed number, deleted fact sentence,
   invented claim) with several seeds, run the audit, and count how many were caught.
2. False alarms: audit each ORIGINAL page against itself. Nothing changed, so every fact should be
   "kept" and no claim should be flagged; anything flagged is a false alarm.

Usage: python eval/factguard_planted_errors.py [--seeds 2]   (run scripts/warm_cache.py first)
"""
import argparse
import time

from common import lessons, original_sections, write
from app.services import factguard
from app.services.llm_clients import family

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
        sabotaged, planted = factguard.sabotage(simplified["sections"], seed=f"{lesson['id']}-{seed}", facts=facts)
        report = factguard.audit(facts, source, sabotaged, avoid)
        checkers.add(report['checker_model'])
        for p in factguard.caught(planted, report):
            planted_total += 1
            caught_total += p["caught"]
            by_type.setdefault(p["type"], [0, 0])
            by_type[p["type"]][0] += p["caught"]
            by_type[p["type"]][1] += 1
        print(f"{lesson['title'][:40]:40} seed {seed}: caught {sum(p['caught'] for p in factguard.caught(planted, report))}/{len(planted)}")
        time.sleep(3)
    # false alarms: original vs itself
    identity = factguard.audit(facts, source, [{"id": s["id"], "text": s["text"]} for s in source], avoid)
    checkers.add(identity["checker_model"])
    flags = (identity["total"] - identity["kept"]) + len(identity["added_claims"]) + len(identity["missing_tokens"])
    fa_flags += flags
    fa_facts += identity["total"]
    print(f"{lesson['title'][:40]:40} identity check: {flags} false flag(s) over {identity['total']} facts")
    time.sleep(3)

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
