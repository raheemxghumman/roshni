#!/usr/bin/env bash
# Starts the backend without the auto-reloader (more reliable on Windows). Restart after code changes.
cd "$(dirname "$0")"
exec .venv/Scripts/python -m uvicorn app.main:app --host 127.0.0.1 --port "${PORT:-8000}"
