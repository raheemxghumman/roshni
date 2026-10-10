"""Raw blocks -> Lesson sections (headings, paragraphs, lists, tables, figures, equations)."""
from __future__ import annotations

import re

URDU_RE = re.compile(r"[؀-ۿ]")  # Arabic script (Urdu and Pashto)
PASHTO_RE = re.compile(r"[ښږځڅټډړګڼېۍ]")  # letters Pashto has and Urdu doesn't (Urdu writes ٹ ڈ ڑ, other code points)


def block_text(block: dict) -> str:
    if block["type"] == "figure":
        return ""  # figure descriptions are AI-written, so they're not part of the facts to keep
    return block.get("text") or ""


def section_text(section: dict) -> str:
    return "\n".join(t for t in (block_text(b) for b in section["blocks"]) if t.strip())


def detect_language(blocks: list[dict]) -> str:
    text = " ".join(b.get("text", "") for b in blocks)
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return "en"
    share = sum(1 for c in letters if URDU_RE.match(c)) / len(letters)
    script = "ps" if len(PASHTO_RE.findall(text)) >= 3 else "ur"
    return script if share > 0.6 else "mixed" if share > 0.15 else "en"


FURNITURE_RE = re.compile(r"(licensed under|creative commons|all rights reserved|^page \d+$|^\d{1,4}$|^chapter \d+$)", re.I)


def is_page_furniture(block: dict) -> bool:
    """Running headers, footers, page numbers and licence lines that aren't part of the lesson."""
    if block["type"] not in ("paragraph", "caption"):
        return False
    text = (block.get("text") or "").strip()
    words = text.split()
    if not words:
        return True
    letters = [c for c in text if c.isalpha()]
    if len(words) <= 8 and letters and sum(c.isupper() for c in letters) / len(letters) > 0.8:
        return True
    return len(words) <= 15 and bool(FURNITURE_RE.search(text))


def build_sections(blocks: list[dict]) -> tuple[str, list[dict], list[str]]:
    """Groups blocks under headings. Returns (title, sections, warnings)."""
    blocks = [b for b in blocks if not is_page_furniture(b)]
    warnings: list[str] = []
    title = ""
    sections: list[dict] = []
    current: dict | None = None

    headings = [b for b in blocks if b["type"] == "heading"]
    if headings:
        top_level = min(h.get("level") or 2 for h in headings)
        first_top = next(h for h in headings if (h.get("level") or 2) == top_level)
        title = first_top["text"]

    for b in blocks:
        if b["type"] == "heading":
            if b["text"] == title and not sections:
                # the page title opens the first section; keep any intro text that came before it
                current = {"heading": title, "level": 1, "blocks": current["blocks"] if current else []}
                continue
            if current and current["blocks"]:
                sections.append(current)
            current = {"heading": b["text"], "level": b.get("level") or 2, "blocks": []}
        else:
            if current is None:
                current = {"heading": title or "Lesson", "level": 1, "blocks": []}
            current["blocks"].append(b)
    if current and current["blocks"]:
        sections.append(current)

    for n, s in enumerate(sections, start=1):
        s["id"] = f"s{n}"

    text_blocks = [b for b in blocks if b["type"] != "figure"]
    unclear = sum(1 for b in text_blocks if b.get("unclear"))
    if text_blocks and unclear / len(text_blocks) > 0.1:
        warnings.append("Some words couldn't be read clearly and are marked [unclear]. Retaking the photo in better light will help.")
    if not sections:
        warnings.append("No readable text was found on this page.")
    if not title:
        title = (sections[0]["heading"] if sections else "Untitled page")
    return title, sections, warnings
