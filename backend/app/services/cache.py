"""Content-addressed storage on disk: lessons, lectures, uploads and audio. Powers demo mode.

Layout under CACHE_DIR:
  lessons/<id>.json    uploads/<id>_p<n>.jpg    lectures/<id>.json + <id>.<ext>
  audio/<key>.mp3      quizzes/<id>.json
"""
from __future__ import annotations

import hashlib
import json
import threading
from collections.abc import Callable
from pathlib import Path

from ..config import get_settings

_lock = threading.Lock()
_key_locks: dict[str, threading.Lock] = {}
_key_locks_guard = threading.Lock()


def make_key(*parts: bytes | str) -> str:
    h = hashlib.sha256()
    for part in parts:
        h.update(part if isinstance(part, bytes) else part.encode("utf-8"))
        h.update(b"\x00")
    return h.hexdigest()[:24]


def _safe(name: str) -> str:
    return "".join(c for c in name if c.isalnum() or c in "._-")


def _dir(namespace: str) -> Path:
    path = get_settings().cache_path / namespace
    path.mkdir(parents=True, exist_ok=True)
    return path


def path_for(namespace: str, name: str) -> Path:
    return _dir(namespace) / _safe(name)


def _lock_for(namespace: str, key: str) -> threading.Lock:
    token = f"{namespace}:{_safe(key)}"
    with _key_locks_guard:
        lock = _key_locks.get(token)
        if lock is None:
            lock = threading.Lock()
            _key_locks[token] = lock
        return lock


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


def update_json(namespace: str, key: str, mutator: Callable[[dict], None]) -> dict:
    """Load → mutate → save under a per-key lock so concurrent field updates don't clobber each other."""
    with _lock_for(namespace, key):
        data = get_json(namespace, key)
        if data is None:
            raise KeyError(key)
        mutator(data)
        put_json(namespace, key, data)
        return data


def delete(namespace: str, key: str) -> bool:
    safe = _safe(key)
    if not safe:
        return False
    removed = False
    # Prefer exact known suffixes over an open-ended glob of raw user input
    exact = [
        path_for(namespace, f"{safe}.json"),
        path_for(namespace, safe),
    ]
    for p in exact:
        if p.exists():
            p.unlink(missing_ok=True)
            removed = True
    for p in _dir(namespace).glob(f"{safe}_*"):
        p.unlink(missing_ok=True)
        removed = True
    for p in _dir(namespace).glob(f"{safe}.*"):
        if p not in exact:
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
