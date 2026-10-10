"""Learner profiles and per-learner quiz attempts in Postgres (Neon), keyed by an anonymous random id.

No name, email or gender is stored: the profile is the learner's setup and progress, sent by their browser.
When DATABASE_URL is not set or the database is unreachable, the store reports itself off and the app keeps
working with the copy in the browser.
"""
from __future__ import annotations

import json
import logging
import re
import threading
import time

from ..config import get_settings
from ..errors import AppError

log = logging.getLogger("roshni.profiles")

ID_RE = re.compile(r"^[A-Za-z0-9-]{16,64}$")
MAX_PROFILE_BYTES = 32 * 1024
RETRY_AFTER_FAILURE = 60  # seconds to wait before trying an unreachable database again
SCHEMA = """
CREATE TABLE IF NOT EXISTS learners (
    id          text PRIMARY KEY,
    profile     jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS attempts (
    id          bigserial PRIMARY KEY,
    learner_id  text NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    lesson_id   text NOT NULL,
    quiz_id     text NOT NULL,
    at          timestamptz NOT NULL DEFAULT now(),
    score       real NOT NULL,
    correct     integer NOT NULL,
    total       integer NOT NULL,
    level       text NOT NULL,
    mode        text NOT NULL,
    weak        jsonb NOT NULL DEFAULT '[]'::jsonb,
    focus       boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS attempts_learner_lesson ON attempts (learner_id, lesson_id, at);
"""

_pool = None
_lock = threading.Lock()
_failed_at = 0.0


def _get_pool():
    """Opens the connection pool and creates the tables on first use. Returns None when the store is off."""
    global _pool, _failed_at
    url = get_settings().database_url
    if not url or time.time() - _failed_at < RETRY_AFTER_FAILURE:
        return None
    if _pool is not None:
        return _pool
    with _lock:
        if _pool is not None:
            return _pool
        try:
            from psycopg_pool import ConnectionPool

            # Neon suspends an idle database and closes its connections, so test each connection before use
            # and drop idle ones after a minute instead of handing out a dead one.
            pool = ConnectionPool(url, min_size=0, max_size=4, timeout=10, check=ConnectionPool.check_connection,
                                  max_idle=60, max_lifetime=600, kwargs={"connect_timeout": 10, "autocommit": True}, open=True)
            with pool.connection() as conn:
                conn.execute(SCHEMA)
            _pool = pool
            log.info("Profile store connected")
        except Exception as e:  # noqa: BLE001 - any connection problem turns the store off for a minute
            _failed_at = time.time()
            log.warning("Profile store unavailable: %s", str(e)[:200])
            return None
    return _pool


def available() -> bool:
    return _get_pool() is not None


def _run(sql: str, params: tuple = (), fetch: str | None = None):
    """Runs one query. A broken connection (for example after Neon woke from sleep) is retried once on a fresh one;
    only a second connection failure turns the store off for a minute."""
    global _failed_at
    import psycopg
    from psycopg_pool import PoolTimeout

    pool = _get_pool()
    if pool is None:
        raise AppError("PROFILE_STORE_OFF", "Your progress is saved in this browser only right now.", 503, True)
    for attempt in range(2):
        try:
            with pool.connection() as conn:
                cur = conn.execute(sql, params)
                if fetch == "one":
                    return cur.fetchone()
                if fetch == "all":
                    return cur.fetchall()
                return None
        except (psycopg.OperationalError, psycopg.InterfaceError, PoolTimeout) as e:
            log.warning("Profile store connection problem (attempt %s): %s", attempt + 1, str(e)[:200])
            if attempt == 0:
                continue  # the pool discards the broken connection; try once more on a fresh one
            _failed_at = time.time()
            raise AppError("PROFILE_STORE_OFF", "Your progress is saved in this browser only right now.", 503, True) from e
        except psycopg.Error as e:  # a bad query or data, not an outage: don't switch the store off
            log.warning("Profile store query error: %s", str(e)[:200])
            raise AppError("PROFILE_STORE_OFF", "Your progress couldn't be saved on the server just now.", 503, True) from e
    return None


def check_id(learner_id: str | None) -> str:
    if not learner_id or not ID_RE.fullmatch(learner_id):
        raise AppError("BAD_REQUEST", "This browser has no learner id yet.", 400)
    return learner_id


def clean_profile(profile: dict) -> dict:
    """Keeps the profile small and free of anything personal: only the known keys are stored."""
    allowed = {"onboarded", "needs", "preferredTab", "defaultLevel", "levels", "recent", "last", "lastReport",
               "best", "dismissed", "review", "addressForm", "updatedAt"}
    data = {k: v for k, v in (profile or {}).items() if k in allowed}
    if len(json.dumps(data, ensure_ascii=False).encode("utf-8")) > MAX_PROFILE_BYTES:
        raise AppError("BAD_REQUEST", "This profile is too large to save.", 413)
    return data


def get_profile(learner_id: str) -> dict | None:
    row = _run("SELECT profile FROM learners WHERE id = %s", (learner_id,), fetch="one")
    return row[0] if row else None


def put_profile(learner_id: str, profile: dict) -> None:
    from psycopg.types.json import Jsonb

    _run("""INSERT INTO learners (id, profile) VALUES (%s, %s)
            ON CONFLICT (id) DO UPDATE SET profile = EXCLUDED.profile, updated_at = now()""", (learner_id, Jsonb(clean_profile(profile))))


def delete_learner(learner_id: str) -> None:
    _run("DELETE FROM learners WHERE id = %s", (learner_id,))  # attempts go with it (ON DELETE CASCADE)


def add_attempt(learner_id: str, attempt: dict) -> None:
    from psycopg.types.json import Jsonb

    _run("INSERT INTO learners (id) VALUES (%s) ON CONFLICT (id) DO NOTHING", (learner_id,))
    _run("""INSERT INTO attempts (learner_id, lesson_id, quiz_id, score, correct, total, level, mode, weak, focus)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
         (learner_id, attempt["lesson_id"], attempt["quiz_id"], attempt["score"], attempt["correct"], attempt["total"],
          attempt["level"], attempt["mode"], Jsonb(attempt.get("weak") or []), bool(attempt.get("focus"))))


def attempts(learner_id: str, lesson_id: str, limit: int = 20) -> list[dict]:
    rows = _run("""SELECT quiz_id, at, score, correct, total, level, mode, weak, focus FROM attempts
                   WHERE learner_id = %s AND lesson_id = %s ORDER BY at DESC LIMIT %s""", (learner_id, lesson_id, limit), fetch="all")
    return [{"quiz_id": r[0], "at": r[1].isoformat(timespec="seconds"), "score": r[2], "correct": r[3], "total": r[4], "level": r[5],
             "mode": r[6], "weak": r[7], "focus": r[8]} for r in reversed(rows or [])]
