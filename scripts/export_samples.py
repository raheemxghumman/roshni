"""Copies the warmed sample lessons (and their images, quizzes, lecture and audio) from the cache into
data/samples/, which is committed to git. The server copies them back into an empty cache on start,
so a fresh deploy or a teammate's laptop has working samples and demo mode immediately.

Usage: python scripts/export_samples.py   (after scripts/warm_cache.py)
"""
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from app.config import get_settings  # noqa: E402

cache = get_settings().cache_path
out = ROOT / "data" / "samples"
for sub in ("lessons", "uploads", "quizzes", "lectures"):
    (out / sub).mkdir(parents=True, exist_ok=True)

count = 0
for p in (cache / "lessons").glob("*.json"):
    lesson = json.loads(p.read_text(encoding="utf-8"))
    if not lesson.get("sample"):
        continue
    count += 1
    shutil.copy2(p, out / "lessons" / p.name)
    for img in (cache / "uploads").glob(f"{lesson['id']}_p*.jpg"):
        shutil.copy2(img, out / "uploads" / img.name)
    for quiz_id in (lesson.get("quiz") or {}).values():
        q = cache / "quizzes" / f"{quiz_id}.json"
        if q.exists():
            shutil.copy2(q, out / "quizzes" / q.name)
    if lesson.get("lecture_id"):
        for f in (cache / "lectures").glob(f"{lesson['lecture_id']}.*"):
            shutil.copy2(f, out / "lectures" / f.name)
print(f"Exported {count} sample lessons to {out}")
