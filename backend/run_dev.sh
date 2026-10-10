#!/usr/bin/env bash
# Starts the backend without the auto-reloader (more reliable on Windows). Restart after code changes.
cd "$(dirname "$0")"
PY=".venv/Scripts/python"
[ -x "$PY" ] || PY=".venv/bin/python"
[ -x "$PY" ] || PY="python"
exec "$PY" -m uvicorn app.main:app --host 127.0.0.1 --port "${PORT:-8000}"
