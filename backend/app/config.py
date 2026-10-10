"""Reads settings from .env (API keys, model names, limits, DEMO_MODE) with pydantic-settings."""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[1]
ROOT_DIR = BACKEND_DIR.parent
PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT_DIR / ".env", env_file_encoding="utf-8", extra="ignore")

    gemini_api_key: str = ""
    gemini_api_keys: str = ""  # extra keys, comma separated; rotated when one is rate-limited
    gemini_model: str = "gemini-3.5-flash"
    gemini_fallback_model: str = "gemini-flash-latest,gemini-3-flash-preview,gemini-3.1-flash-lite,gemini-2.5-flash"  # comma list; each has its own free quota

    groq_api_key: str = ""
    groq_api_keys: str = ""  # extra keys, comma separated; rotated when one is rate-limited
    groq_rewrite_model: str = "qwen/qwen3.8-27b"
    groq_factguard_model: str = "openai/gpt-oss-120b"
    groq_fallback_model: str = "openai/gpt-oss-20b"
    groq_stt_model: str = "whisper-large-v3-turbo"

    # Paid backup (prepaid credit): only used when the free models are busy, with a hard spending cap
    deepseek_api_key: str = ""
    deepseek_model: str = "deepseek-flash"
    deepseek_budget_usd: float = 0.80  # stop once Roshni's estimated DeepSeek spend reaches this
    deepseek_min_balance_usd: float = 0.10  # stop once the real account balance drops below this
    deepseek_price_in: float = 0.50  # USD per million input tokens, set high on purpose so the cap trips early
    deepseek_price_out: float = 1.50  # USD per million output tokens

    tts_urdu_voice: str = "ur-PK-UzmaNeural"
    tts_pashto_voice: str = "ps-AF-LatifaNeural"
    tts_english_voice: str = "en-US-AriaNeural"

    demo_mode: bool = False
    database_url: str = ""  # Neon Postgres for learner profiles; empty = profiles stay in the browser
    cache_dir: str = ""
    max_upload_mb: int = 10
    max_audio_mb: int = 24
    allowed_origins: str = "http://localhost:5173"
    prompt_version: str = "v1"

    @property
    def cache_path(self) -> Path:
        path = Path(self.cache_dir) if self.cache_dir else ROOT_DIR / "data" / "cache"
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def gemini_keys(self) -> list[str]:
        return _key_list(self.gemini_api_key, self.gemini_api_keys)

    @property
    def groq_keys(self) -> list[str]:
        return _key_list(self.groq_api_key, self.groq_api_keys)

    @property
    def gemini_models(self) -> list[str]:
        models = [self.gemini_model] + [m.strip() for m in self.gemini_fallback_model.split(",") if m.strip()]
        return list(dict.fromkeys(models))

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


def _key_list(first: str, extra: str) -> list[str]:
    keys = [first.strip()] + [k.strip() for k in extra.split(",")]
    return list(dict.fromkeys(k for k in keys if k))


@lru_cache
def get_settings() -> Settings:
    return Settings()


def load_prompt(name: str) -> str:
    """Returns a prompt template without its leading '# used by ...' comment lines."""
    text = (PROMPTS_DIR / name).read_text(encoding="utf-8")
    return "\n".join(line for line in text.splitlines() if not line.startswith("# ")).strip()


def fill(template: str, **values) -> str:
    """Fills {placeholders} without tripping over the literal JSON braces in prompts."""
    for key, value in values.items():
        template = template.replace("{" + key + "}", str(value))
    return template
