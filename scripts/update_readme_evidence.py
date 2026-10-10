"""Writes the Evidence table in README.md from eval/results/*.json, so the README, the app and the slides agree.

Usage: python scripts/update_readme_evidence.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ORDER = ["factguard_facts_kept", "factguard_planted_errors", "factguard_false_alarms", "readability", "ocr_cer", "processing_time", "asr_wer"]

results = {}
for path in (ROOT / "eval" / "results").glob("*.json"):
    if path.name.startswith("_"):
        continue
    data = json.loads(path.read_text(encoding="utf-8"))
    results[data["metric"]] = data

rows = ["| Metric | Result | What it means | Data | Sample |", "|---|---|---|---|---|"]
for key in ORDER:
    d = results.get(key)
    if not d:
        continue
    kind = "real" if d.get("data_type") == "real" else "**synthetic**"
    rows.append(f"| {d['title']} | **{d['display']}** | {d['detail']} | {d['dataset']} ({kind}) | {d['n']} |")
table = "\n".join(rows)

readme = ROOT / "README.md"
text = readme.read_text(encoding="utf-8")
block = f"<!-- EVIDENCE-TABLE -->\n{table}\n<!-- /EVIDENCE-TABLE -->"
if "<!-- /EVIDENCE-TABLE -->" in text:
    text = re.sub(r"<!-- EVIDENCE-TABLE -->.*?<!-- /EVIDENCE-TABLE -->", lambda _: block, text, flags=re.S)
else:
    text = text.replace("<!-- EVIDENCE-TABLE -->", block)
readme.write_text(text, encoding="utf-8")
print(table)
