"""Before/after Flesch-Kincaid grade and sentence length across every cached sample rewrite (both levels).

Usage: python eval/readability_eval.py   (run scripts/warm_cache.py first)
"""
from statistics import mean

from common import lessons, write

rows = []
for lesson in lessons():
    for level, r in lesson.get("simplified", {}).items():
        rows.append((level, r["readability"]["before"], r["readability"]["after"], r["factguard"]))

if not rows:
    raise SystemExit("No simplified sample lessons found. Run scripts/warm_cache.py first.")

by_level = {}
for level in ("easier", "simplest"):
    sub = [r for r in rows if r[0] == level]
    if sub:
        by_level[level] = (mean(b["grade"] for _, b, _, _ in sub), mean(a["grade"] for _, _, a, _ in sub),
                           mean(b["avg_sentence_words"] for _, b, _, _ in sub), mean(a["avg_sentence_words"] for _, _, a, _ in sub), len(sub))

e = by_level.get("easier")
write(
    "readability",
    title="Reading level lowered",
    display=f"Grade {e[0]:.1f} → {e[1]:.1f}" if e else "—",
    value=round(e[0] - e[1], 2) if e else None,
    detail="; ".join(f"{lvl.title()}: grade {b:.1f} → {a:.1f}, {sb:.0f} → {sa:.0f} words per sentence ({n} pages)" for lvl, (b, a, sb, sa, n) in by_level.items()),
    dataset="OpenStax textbook pages (CC BY 4.0)",
    n=f"{len(rows)} rewrites of {len(lessons())} pages",
    method="Flesch-Kincaid grade (textstat), original vs Fact-Guarded rewrite",
    models="rewriter: " + ", ".join(sorted({fg.get("rewriter_model", "") for *_, fg in rows if fg.get("rewriter_model")})),
    data_type="real",
)

kept = sum(fg["kept"] for *_, fg in rows)
total = sum(fg["total"] for *_, fg in rows)
write(
    "factguard_facts_kept",
    title="Facts kept after Fact Guard",
    display=f"{kept / total:.0%}" if total else "—",
    value=round(kept / total, 4) if total else None,
    detail=f"{kept} of {total} extracted facts verified with a quote from the final rewrite; {sum(1 for *_, fg in rows if fg['status'] == 'green')} of {len(rows)} rewrites fully green.",
    dataset="OpenStax textbook pages (CC BY 4.0)",
    n=f"{total} facts, {len(rows)} rewrites",
    method="Independent checker extracts facts, audits rewrite, repairs up to 2 rounds",
    models="checker: " + ", ".join(sorted({fg["checker_model"] for *_, fg in rows if fg.get("checker_model")})),
    data_type="real",
)
