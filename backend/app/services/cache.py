"""Content-addressed storage on disk: lessons, lectures, uploads and audio. Powers demo mode.

Layout under CACHE_DIR:
  lessons/<id>.json    uploads/<id>_p<n>.jpg    lectures/<id>.json + <id>.<ext>
  audio/<key>.mp3      quizzes/<id>.json
"""
from __future__ import annotations

import hashlib
import json
import threading
from pathlib import Path

from ..config import get_settings

_lock = threading.Lock()


def make_key(*parts: bytes | str) -> str:
    h = hashlib.sha256()
    for part in parts:
        h.update(part if isinstance(part, bytes) else part.encode("utf-8"))
        h.update(b"\x00")
    return h.hexdigest()[:24]


def _dir(namespace: str) -> Path:
    path = get_settings().cache_path / namespace
    path.mkdir(parents=True, exist_ok=True)
    return path


def path_for(namespace: str, name: str) -> Path:
    safe = "".join(c for c in name if c.isalnum() or c in "._-")
    return _dir(namespace) / safe


def get_json(namespace: str, key: str) -> dict | None:
    p = path_for(namespace, f"{key}.json")
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def put_json(namespace: str, key: str, data: dict) -> None:
    p = path_for(namespace, f"{key}.json")
    tmp = p.with_suffix(".tmp")
    with _lock:
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        tmp.replace(p)


def delete(namespace: str, key: str) -> bool:
    removed = False
    for p in _dir(namespace).glob(f"{key}*"):
        p.unlink(missing_ok=True)
        removed = True
    return removed


def list_json(namespace: str) -> list[dict]:
    items = []
    for p in sorted(_dir(namespace).glob("*.json"), key=lambda x: x.stat().st_mtime, reverse=True):
        try:
            items.append(json.loads(p.read_text(encoding="utf-8")))
        except (OSError, json.JSONDecodeError):
            continue
    return items


def put_bytes(namespace: str, name: str, data: bytes) -> Path:
    p = path_for(namespace, name)
    p.write_bytes(data)
    return p
