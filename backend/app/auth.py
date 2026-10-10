"""Optional shared-secret auth. When API_SECRET is empty, all routes stay open (local/demo)."""
from __future__ import annotations

from fastapi import Request

from .config import get_settings
from .errors import AppError

# Paths that never require a secret (health + static assets are handled elsewhere)
PUBLIC_PREFIXES = ("/api/health",)
PUBLIC_GET_PREFIXES = (
    "/api/lessons",  # list + get samples for the home page / demo
    "/api/metrics",
    "/api/tts",
)


def require_api_secret(request: Request) -> None:
    secret = get_settings().api_secret.strip()
    if not secret:
        return
    path = request.url.path
    if any(path == p or path.startswith(p + "/") for p in PUBLIC_PREFIXES):
        return
    if request.method == "GET" and any(path == p or path.startswith(p + "/") for p in PUBLIC_GET_PREFIXES):
        return
    auth = request.headers.get("authorization") or ""
    token = ""
    if auth.lower().startswith("bearer "):
        token = auth[7:].strip()
    elif request.headers.get("x-api-key"):
        token = request.headers["x-api-key"].strip()
    if token != secret:
        raise AppError("UNAUTHORIZED", "This API requires a valid key. Set Authorization: Bearer <API_SECRET>.", 401)
