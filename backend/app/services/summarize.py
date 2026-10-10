"""Transcript -> summary + key terms; Fact Guard then checks every summary claim against the transcript."""
from __future__ import annotations

import json

from ..config import fill, load_prompt
from ..errors import AppError
from . import factguard
from .llm_clients import family, text_json

VALID = {"supported", "unsupported", "changed"}


def summarize(transcript: str) -> tuple[dict, str]:
    data, model = text_json(fill(load_prompt("lecture_summary.txt"), transcript=transcript[:14000]), "rewrite", max_tokens=3000)
    summary = [str(b).strip() for b in data.get("summary") or [] if str(b).strip()][:6]
    terms = [t for t in data.get("key_terms") or [] if isinstance(t, dict) and t.get("term")]
    actions = [str(a).strip() for a in data.get("homework_or_actions") or [] if str(a).strip()]
    return {"summary": summary, "key_terms": terms, "actions": actions}, model


def summarize_checked(transcript: str) -> tuple[dict, dict, str]:
    """Summary + support check, with up to two repair rounds when Fact Guard flags claims."""
    summary, model = summarize(transcript)
    check = check_support(transcript, summary["summary"], model)
    rounds = [{"round": 1, "action": "Checked the first summary", "status": check["status"], "kept": check["kept"], "total": check["total"]}]
    for round_no in (2, 3):
        if check["status"] != "amber":
            break
        flagged = [{"claim": c["claim"], "problem": c["status"], "note": c["note"]} for c in check["claims"] if c["status"] != "supported"]
        data, _ = text_json(fill(load_prompt("summary_repair.txt"), flagged_json=json.dumps(flagged, ensure_ascii=False),
                                 summary_json=json.dumps(summary["summary"], ensure_ascii=False), transcript=transcript[:14000]),
                            "rewrite", max_tokens=2000)
        fixed = [str(b).strip() for b in data.get("summary") or [] if str(b).strip()][:6]
        if not fixed:
            break
        summary["summary"] = fixed
        previous = check
        check = check_support(transcript, fixed, model)
        if check.get("status") == "unavailable" and previous.get("claims"):
            # Keep the last successful check instead of wiping claims on a transient checker failure
            check = {**previous, "note": check.get("note") or previous.get("note", "")}
        rounds.append({"round": round_no, "action": "Fixed the flagged bullets and checked again", "status": check["status"], "kept": check["kept"], "total": check["total"]})
    check["rounds"] = rounds
    return summary, check, model


def check_support(transcript: str, summary: list[str], summarizer_model: str) -> dict:
    try:
        data, model = text_json(fill(load_prompt("support_check.txt"), transcript=transcript[:14000], summary="\n".join(f"- {b}" for b in summary)),
                                "check", avoid_family=family(summarizer_model), max_tokens=5000)
    except AppError as e:
        if e.code == "FACTGUARD_UNAVAILABLE":
            report = factguard.unavailable_report(e.message)
            report.setdefault("claims", [])
            return report
        raise
    claims = []
    for n, c in enumerate(data.get("claims") or [], start=1):
        if not isinstance(c, dict) or not c.get("claim"):
            continue
        status = c.get("status") if c.get("status") in VALID else "unsupported"
        evidence = (c.get("evidence") or "").strip()
        if status == "supported" and not factguard.evidence_ok(evidence, transcript):
            status = "unsupported"
        claims.append({"id": f"c{n}", "claim": c["claim"].strip(), "status": status, "evidence": evidence, "note": (c.get("note") or "").strip()})
    supported = sum(1 for c in claims if c["status"] == "supported")
    status = "no_facts" if not claims else "green" if supported == len(claims) else "amber"
    return {"status": status, "kept": supported, "total": len(claims), "claims": claims, "checker_model": model, "rewriter_model": summarizer_model}
