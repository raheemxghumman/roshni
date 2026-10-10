"""Page photo/PDF -> raw blocks via Gemini vision, DeepSeek vision when Gemini is busy (or the PDF text layer). Unreadable text is marked [unclear]."""
from __future__ import annotations

from ..config import fill, get_settings, load_prompt
from ..errors import AppError
from .ingest import Prepared
from .llm_clients import deepseek_json, gemini_json, text_json

VALID_TYPES = {"heading", "paragraph", "list", "table", "figure", "equation", "caption"}


def _clean_blocks(raw: list, page: int) -> list[dict]:
    blocks = []
    for b in raw or []:
        if not isinstance(b, dict):
            continue
        btype = b.get("type") if b.get("type") in VALID_TYPES else "paragraph"
        text = (b.get("text") or "").strip()
        if btype == "table" and not text and b.get("rows"):
            text = "\n".join(" | ".join(str(c) for c in row) for row in b["rows"])
        description = (b.get("description") or "").strip()
        if not text and not description:
            continue
        blocks.append({
            "type": btype,
            "level": int(b.get("level") or 2) if btype == "heading" else None,
            "text": text,
            "description": description if btype == "figure" else "",
            "rows": b.get("rows") if btype == "table" else None,
            "unclear": bool(b.get("unclear")) or "[unclear]" in text,
            "page": page,
        })
    return blocks


def read_page(prepared: Prepared) -> dict:
    """Returns {"language", "blocks", "warnings", "models"}."""
    warnings: list[str] = list(prepared.warnings)
    blocks: list[dict] = []
    models: list[str] = []
    language = "en"

    if prepared.text_layer:
        data, model = text_json(fill(load_prompt("structure_text.txt"), text=prepared.text_layer[:12000]), "structure")
        blocks = _clean_blocks(data.get("blocks"), page=1)
        language = data.get("language") or language
        models.append(model)
        warnings.append("Used the PDF's own text, so no words had to be guessed.")
    else:
        prompt = load_prompt("ocr_page.txt")
        for i, img in enumerate(prepared.images, start=1):
            try:
                data, model = gemini_json(prompt, image=img)
            except AppError as e:
                if e.code != "RATE_LIMITED" or not get_settings().deepseek_api_key:
                    raise
                data, model = deepseek_json(prompt, image=img, max_tokens=4000)  # paid backup when free Gemini is busy
            blocks.extend(_clean_blocks(data.get("blocks"), page=i))
            language = data.get("language") or language
            warnings.extend(w for w in (data.get("warnings") or []) if isinstance(w, str))
            models.append(model)

    for n, b in enumerate(blocks, start=1):
        b["id"] = f"b{n}"
    return {"language": language, "blocks": blocks, "warnings": warnings, "models": sorted(set(models))}
