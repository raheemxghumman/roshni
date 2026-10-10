"""Runs the full pipeline on every sample page so the demo works from cache, with no AI calls on stage.

Usage (backend running on :8000):  python scripts/warm_cache.py [--api http://127.0.0.1:8000]
For each OpenStax page image in data/openstax/pages/: upload -> simplify (easier + simplest) -> glossary
-> quiz -> Fact Guard stress test, then marks the lesson as a sample. The synthetic lecture clip is
attached to the physics lesson. Afterwards you can set DEMO_MODE=true to serve only cached results.
"""
from __future__ import annotations

import argparse
import json
import mimetypes
import sys
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from app.config import get_settings  # noqa: E402

PAGES = ROOT / "data" / "openstax" / "pages"
LECTURE = ROOT / "data" / "lectures" / "sample-lecture-synthetic.mp3"


def call(api: str, path: str, *, body: dict | None = None, files: dict | None = None, fields: dict | None = None, timeout: int = 300) -> dict:
    headers, data = {}, None
    if files:
        boundary = uuid.uuid4().hex
        parts = []
        for name, value in (fields or {}).items():
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())
        for name, path_ in files.items():
            mime = mimetypes.guess_type(path_.name)[0] or "application/octet-stream"
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; filename="{path_.name}"\r\nContent-Type: {mime}\r\n\r\n'.encode()
                         + path_.read_bytes() + b"\r\n")
        data = b"".join(parts) + f"--{boundary}--\r\n".encode()
        headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
    elif body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(api + path, data=data, headers=headers, method="POST" if data is not None else "GET")
    try:
        return json.load(urllib.request.urlopen(req, timeout=timeout))
    except urllib.error.HTTPError as e:
        return json.loads(e.read() or b"{}")


def step(label: str, result: dict) -> dict:
    err = result.get("error")
    print(f"   {'FAIL' if err else 'ok  '} {label}" + (f": {err['code']} {err['message_for_user']}" if err else ""))
    return result


def mark_sample(lesson_id: str) -> None:
    path = get_settings().cache_path / "lessons" / f"{lesson_id}.json"
    lesson = json.loads(path.read_text(encoding="utf-8"))
    lesson["sample"] = True
    path.write_text(json.dumps(lesson, ensure_ascii=False, indent=1), encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", default="http://127.0.0.1:8000")
    args = ap.parse_args()
    api = args.api.rstrip("/")
    pages = sorted(PAGES.glob("*.png"))
    if not pages:
        sys.exit("No sample pages found. Run scripts/fetch_openstax.py first.")
    physics_id = None
    for page in pages:
        print(f"\n{page.stem}")
        lesson = step("read page", call(api, "/api/lessons", files={"file": page}))
        if "id" not in lesson:
            continue
        lid = lesson["id"]
        if "physics" in page.stem:
            physics_id = lid
        for level in ("easier", "simplest"):
            r = step(f"simplify {level}", call(api, f"/api/lessons/{lid}/simplify", body={"level": level}))
            if "factguard" in r:
                fg = r["factguard"]
                print(f"        Fact Guard {fg['status']} {fg['kept']}/{fg['total']}, grade {r['readability']['before']['grade']} -> {r['readability']['after']['grade']}")
            time.sleep(2)
        step("glossary", call(api, f"/api/lessons/{lid}/glossary", body={}))
        step("quiz", call(api, f"/api/lessons/{lid}/quiz", body={"level": "easier"}))
        s = step("stress test", call(api, f"/api/lessons/{lid}/factguard/stress", body={"level": "easier"}))
        if "caught" in s:
            print(f"        caught {s['caught']}/{s['total_planted']} planted errors, repaired: {s['repaired_report']['status']}")
        mark_sample(lid)
    if LECTURE.exists():
        print("\nlecture")
        step("captions + summary", call(api, "/api/lectures", files={"file": LECTURE}, fields={"language": "en", **({"lesson_id": physics_id} if physics_id else {})}))
    print("\nDone. Set DEMO_MODE=true in .env to serve only these cached results.")


if __name__ == "__main__":
    main()
