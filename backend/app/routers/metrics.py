"""GET /api/metrics -> latest evaluation results from eval/results/*.json for the Evidence page."""
import json

from fastapi import APIRouter

from ..config import ROOT_DIR

router = APIRouter(prefix="/api", tags=["metrics"])


@router.get("/metrics")
def metrics() -> list[dict]:
    results = []
    for path in sorted((ROOT_DIR / "eval" / "results").glob("*.json")):
        if path.name.startswith("_"):  # internal progress files, not results
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if isinstance(data, dict) and data.get("metric") and data.get("display"):
            results.append(data)
    return results
