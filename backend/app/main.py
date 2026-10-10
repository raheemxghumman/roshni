"""FastAPI app: CORS, error handling, routers, /api/health, and (if built) the frontend at '/'."""
import logging
import shutil

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .auth import require_api_secret
from .config import ROOT_DIR, get_settings
from .errors import AppError
from .routers import lectures, lessons, me, metrics, practice, videos
from .services import profiles

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("roshni")

settings = get_settings()


def seed_samples() -> None:
    """On a fresh machine or deploy, copy the committed sample lessons into the empty cache."""
    samples = ROOT_DIR / "data" / "samples"
    lessons_dir = settings.cache_path / "lessons"
    if not samples.exists() or (lessons_dir.exists() and any(lessons_dir.glob("*.json"))):
        return
    for sub in samples.iterdir():
        if sub.is_dir():
            shutil.copytree(sub, settings.cache_path / sub.name, dirs_exist_ok=True)
    log.info("Seeded the cache with sample lessons from %s", samples)


seed_samples()
app = FastAPI(title="Roshni API", version="1.0.0", description="One page. Every learner.")
# Prefer exact origins from ALLOWED_ORIGINS. Only add the HF Spaces / Vercel preview regex when no secret is set,
# so a locked-down deploy with API_SECRET is not wide open to every *.vercel.app site.
_cors_regex = None if settings.api_secret.strip() else r"https://.*\.(vercel\.app|hf\.space)"
app.add_middleware(CORSMiddleware, allow_origins=settings.origins, allow_origin_regex=_cors_regex,
                   allow_methods=["*"], allow_headers=["*"])


@app.middleware("http")
async def api_secret_middleware(request: Request, call_next):
    try:
        require_api_secret(request)
    except AppError as exc:
        return JSONResponse(status_code=exc.status, content=exc.to_dict())
    return await call_next(request)


@app.exception_handler(AppError)
async def app_error(_: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(status_code=exc.status, content=exc.to_dict())


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(status_code=422, content=AppError("BAD_REQUEST", "Some of the request details were missing or invalid.").to_dict())


@app.exception_handler(Exception)
async def unexpected_error(_: Request, exc: Exception) -> JSONResponse:
    log.exception("Unexpected error: %s", exc)
    return JSONResponse(status_code=500, content=AppError("INTERNAL", "Something went wrong on our side. Please try again.", 500, True).to_dict())


@app.get("/api/health")
def health() -> dict:
    s = get_settings()
    return {
        "ok": True,
        "demo_mode": s.demo_mode,
        "models": {"reader": s.gemini_model, "rewriter": s.groq_rewrite_model, "fact_guard": s.groq_factguard_model,
                   "speech_to_text": s.groq_stt_model, "urdu_voice": s.tts_urdu_voice, "pashto_voice": s.tts_pashto_voice},
        "keys": {"gemini": bool(s.gemini_keys), "groq": bool(s.groq_keys)},
        "auth_required": bool(s.api_secret.strip()),
        "profile_store": profiles.available(),
    }


app.include_router(lessons.router)
app.include_router(lectures.router)
app.include_router(metrics.router)
app.include_router(practice.router)
app.include_router(videos.router)
app.include_router(me.router)

_dist = ROOT_DIR / "frontend" / "dist"
if _dist.exists():
    app.mount("/", StaticFiles(directory=_dist, html=True), name="frontend")
