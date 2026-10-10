"""Fact Guard: an independent model extracts the original's facts and audits a rewrite.

Checks run in both directions (missing/changed facts and added claims), plus a deterministic
check that protected numbers, units and formulas survived. A "kept" verdict only counts when
the checker can quote supporting words from the rewrite.
"""
from __future__ import annotations

import json
import random
import re

from ..config import fill, load_prompt
from ..errors import AppError
from . import normalize
from .llm_clients import text_json
from .readability import split_sentences

VALID_STATUS = {"kept", "missing", "changed"}
CHUNK_WORDS = 900


def fmt_sections(sections: list[dict]) -> str:
    return "\n\n".join(f"[{s['id']}] {s['text']}" for s in sections if s.get("text", "").strip())


def chunk_sections(sections: list[dict], max_words: int = CHUNK_WORDS) -> list[list[dict]]:
    chunks, current, count = [], [], 0
    for s in sections:
        words = len(s.get("text", "").split())
        if current and count + words > max_words:
            chunks.append(current)
            current, count = [], 0
        current.append(s)
        count += words
    if current:
        chunks.append(current)
    return chunks


def _words(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", normalize.for_match(text))


def evidence_ok(quote: str, text: str) -> bool:
    """True when the quote really appears in the text (allowing small wording/punctuation differences)."""
    if not quote or not quote.strip():
        return False
    q, t = normalize.for_match(quote), normalize.for_match(text)
    if q in t:
        return True
    words = [w for w in _words(quote) if len(w) > 2]
    if not words:
        return False
    pool = set(_words(text))
    return sum(w in pool for w in words) / len(words) >= 0.8


STOP = set("""a an and are as at be been by can could does each for from has have how in into is it its may might more most
of on or our so some such than that the their them then there these they this those through to was we were what when where
which while who will with would also about after before other only very used uses use called""".split())


def _stems(text: str) -> set[str]:
    return {w[:5] for w in _words(text) if len(w) > 2 and w not in STOP}


def supports(evidence: str, fact: str) -> bool:
    """Plain-code guard against a checker quoting an unrelated sentence: the quote must share a fair part
    of the fact's content words (5-letter stems, so 'measured'/'measure' match) and every number the fact
    writes in digits."""
    fact_stems = _stems(fact)
    if not fact_stems:
        return True
    numbers = set(re.findall(r"\d+(?:\.\d+)?", normalize.basic(fact).replace(",", "")))
    if numbers and not numbers <= set(re.findall(r"\d+(?:\.\d+)?", normalize.for_match(evidence))):
        return False
    return len(fact_stems & _stems(evidence)) / len(fact_stems) >= 0.25


def extract_facts(original_sections: list[dict], avoid_family: str | None) -> tuple[list[dict], str]:
    facts: list[dict] = []
    model = ""
    valid_ids = {s["id"] for s in original_sections}
    for chunk in chunk_sections(original_sections):
        data, model = text_json(fill(load_prompt("facts_extract.txt"), original_text=fmt_sections(chunk)),
                                "check", avoid_family=avoid_family, max_tokens=3500)
        for f in data.get("facts") or []:
            if not isinstance(f, dict) or not (f.get("text") or "").strip():
                continue
            sid = f.get("section_id") if f.get("section_id") in valid_ids else chunk[0]["id"]
            facts.append({"section_id": sid, "text": f["text"].strip(), "source_sentence": (f.get("source_sentence") or "").strip()})
    for n, f in enumerate(facts, start=1):
        f["id"] = f"f{n}"
    return facts, model


def audit(facts: list[dict], original_sections: list[dict], rewrite_sections: list[dict], avoid_family: str | None) -> dict:
    rewrite_by_id = {s["id"]: s.get("text", "") for s in rewrite_sections}
    all_rewrite = "\n".join(rewrite_by_id.values())
    verdicts: dict[str, dict] = {}
    added: list[dict] = []
    model = ""

    for chunk in chunk_sections(original_sections):
        ids = {s["id"] for s in chunk}
        chunk_facts = [f for f in facts if f["section_id"] in ids]
        chunk_rewrite = [{"id": s["id"], "text": rewrite_by_id.get(s["id"], "")} for s in chunk]
        if not chunk_facts:
            continue
        prompt = fill(load_prompt("facts_audit.txt"),
                      facts_json=json.dumps([{"id": f["id"], "section_id": f["section_id"], "text": f["text"]} for f in chunk_facts], ensure_ascii=False),
                      original_text=fmt_sections(chunk), rewrite_text=fmt_sections(chunk_rewrite))
        data, model = text_json(prompt, "check", avoid_family=avoid_family, max_tokens=4000)
        for r in data.get("results") or []:
            if isinstance(r, dict) and r.get("id"):
                verdicts[str(r["id"])] = r
        for a in data.get("added_claims") or []:
            if isinstance(a, dict) and evidence_ok(a.get("quote", ""), all_rewrite):
                added.append({"section_id": a.get("section_id") or "", "quote": a.get("quote", "").strip(), "why": (a.get("why") or "").strip()})

    results = []
    for f in facts:
        r = verdicts.get(f["id"], {})
        status = r.get("status") if r.get("status") in VALID_STATUS else "missing"
        evidence = (r.get("evidence") or "").strip()
        note = (r.get("note") or "").strip()
        if not r:
            note = "The checker gave no verdict for this fact, so it is treated as not verified."
        elif status == "kept" and not evidence_ok(evidence, all_rewrite):
            status, note = "missing", "The checker could not quote this fact from the rewrite."
        elif status == "kept" and not supports(evidence, f["text"]):
            status, note = "missing", "The quoted words don't state this fact, so it was not verified."
        results.append({**f, "status": status, "evidence": evidence, "note": note})

    missing_tokens = []
    for s in original_sections:
        for tok in normalize.missing_tokens(s["text"], rewrite_by_id.get(s["id"], "")):
            missing_tokens.append({"section_id": s["id"], "token": tok})

    kept = sum(1 for r in results if r["status"] == "kept")
    if not results:
        status = "no_facts"
    elif kept == len(results) and not added and not missing_tokens:
        status = "green"
    else:
        status = "amber"
    return {"status": status, "total": len(results), "kept": kept, "facts": results,
            "added_claims": added, "missing_tokens": missing_tokens, "checker_model": model}


def problems_by_section(report: dict) -> dict[str, dict]:
    problems: dict[str, dict] = {}

    def entry(sid: str) -> dict:
        return problems.setdefault(sid, {"missing_or_changed_facts": [], "unsupported_claims": [], "protected_items": []})

    for f in report["facts"]:
        if f["status"] != "kept":
            entry(f["section_id"])["missing_or_changed_facts"].append(f["text"] + (f" ({f['note']})" if f.get("note") else ""))
    for a in report["added_claims"]:
        entry(a["section_id"] or "s1")["unsupported_claims"].append(a["quote"])
    for t in report["missing_tokens"]:
        entry(t["section_id"])["protected_items"].append(t["token"])
    return problems


def round_summary(report: dict, number: int, action: str) -> dict:
    return {"round": number, "action": action, "status": report["status"], "kept": report["kept"], "total": report["total"],
            "added_claims": len(report["added_claims"]), "missing_tokens": len(report["missing_tokens"])}


def unavailable_report(reason: str) -> dict:
    return {"status": "unavailable", "total": 0, "kept": 0, "facts": [], "added_claims": [], "missing_tokens": [],
            "checker_model": "", "note": reason}


# ---------------------------------------------------------------- planted-error stress test

FAKE_CLAIMS = [
    "Scientists first described this in 1847 in a small village laboratory.",
    "This happens about 40 times faster at night than during the day.",
    "Only 12 percent of living things depend on this process.",
]


def _change_number(sentence: str) -> str | None:
    m = re.search(r"\b(\d+(?:\.\d+)?)\b", sentence)
    if not m:
        return None
    value = float(m.group(1))
    new = value * 2 if value else 7
    new_text = str(int(new)) if new.is_integer() else f"{new:.1f}"
    return sentence[: m.start()] + new_text + sentence[m.end():]


def _fact_overlap(sentence: str, facts: list[dict]) -> float:
    words = set(w for w in _words(sentence) if len(w) > 3)
    if not words:
        return 0.0
    return max((len(words & set(_words(f["text"]))) / len(words) for f in facts), default=0.0)


def sabotage(rewrite_sections: list[dict], seed: str, facts: list[dict] | None = None) -> tuple[list[dict], list[dict]]:
    """Plants up to three known errors: a deleted fact sentence, a changed number and an invented claim."""
    rng = random.Random(seed)
    sections = [dict(s) for s in rewrite_sections]
    planted: list[dict] = []
    sentences = [(i, j, sent) for i, s in enumerate(sections) for j, sent in enumerate(split_sentences(s.get("text", "")))]
    if not sentences:
        return sections, planted

    numbered = [x for x in sentences if re.search(r"\d", x[2])]
    if numbered:
        i, j, sent = rng.choice(numbered)
        changed = _change_number(sent)
        if changed:
            parts = split_sentences(sections[i]["text"])
            parts[j] = changed
            sections[i]["text"] = " ".join(parts)
            planted.append({"type": "changed_number", "section_id": sections[i]["id"], "before": sent, "after": changed})

    candidates = [x for x in sentences if len(x[2].split()) >= 6 and not any(p.get("before") == x[2] for p in planted)]
    if candidates:
        if facts:  # delete the sentence that carries the most fact content, so the test is fair
            candidates.sort(key=lambda x: _fact_overlap(x[2], facts), reverse=True)
            i, j, sent = rng.choice(candidates[:3])
        else:
            i, j, sent = rng.choice(candidates)
        parts = split_sentences(sections[i]["text"])
        if sent in parts and len(parts) > 1:
            parts.remove(sent)
            sections[i]["text"] = " ".join(parts)
            planted.append({"type": "deleted_fact", "section_id": sections[i]["id"], "before": sent, "after": ""})

    target = rng.randrange(len(sections))
    claim = rng.choice(FAKE_CLAIMS)
    sections[target]["text"] = (sections[target]["text"].rstrip() + " " + claim).strip()
    planted.append({"type": "added_claim", "section_id": sections[target]["id"], "before": "", "after": claim})
    return sections, planted


def caught(planted: list[dict], report: dict) -> list[dict]:
    """Marks each planted error as caught or not by comparing it with the audit report."""
    out = []
    for p in planted:
        hit = False
        if p["type"] == "added_claim":
            hit = any(evidence_ok(a["quote"], p["after"]) or evidence_ok(p["after"], a["quote"]) for a in report["added_claims"])
        elif p["type"] == "changed_number":
            original_numbers = re.findall(r"\d+(?:\.\d+)?", p["before"])
            hit = any(f["status"] != "kept" and f["section_id"] == p["section_id"] and
                      any(n in normalize.for_match(f["text"]) for n in original_numbers) for f in report["facts"]) \
                or any(t["section_id"] == p["section_id"] for t in report["missing_tokens"])
        elif p["type"] == "deleted_fact":
            before = _words(p["before"])
            for f in report["facts"]:
                if f["status"] != "kept" and f["section_id"] == p["section_id"]:
                    overlap = len(set(_words(f["text"])) & set(before)) / max(1, len(set(_words(f["text"]))))
                    if overlap >= 0.4:
                        hit = True
                        break
        out.append({**p, "caught": hit})
    return out


def ensure_available(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except AppError as e:
        if e.code == "FACTGUARD_UNAVAILABLE":
            return None
        raise
