"""Several Groq/Gemini keys: a rate-limited key rests and the next one takes over (no network calls made)."""
import httpx
import pytest
from groq import AuthenticationError, RateLimitError

from app.config import Settings
from app.errors import AppError
from app.services import llm_clients

MODEL = "qwen/qwen3.8-27b"


@pytest.fixture
def keys(monkeypatch, tmp_path):
    settings = Settings(groq_api_key="k0", groq_api_keys="k1, k2", gemini_api_key="g0", cache_dir=str(tmp_path))
    monkeypatch.setattr(llm_clients, "get_settings", lambda: settings)
    for name, value in (("_cooldown", {}), ("_bad_keys", set()), ("_next_key", {}), ("_groq_clients", {})):
        monkeypatch.setattr(llm_clients, name, value)
    return settings


def error(cls, status, headers=None):
    response = httpx.Response(status, headers=headers or {}, request=httpx.Request("POST", "https://api.groq.com"))
    return cls("limited" if status == 429 else "bad key", response=response, body=None)


class FakeClient:
    """Each key behaves as scripted: 'limit' (429), 'bad' (401) or 'ok'."""

    def __init__(self, behaviour, calls, key):
        self.chat = self
        self.completions = self
        self.behaviour, self.calls, self.key = behaviour, calls, key

    def create(self, **kwargs):
        self.calls.append(self.key)
        if self.behaviour == "limit":
            raise error(RateLimitError, 429, {"retry-after": "30"})
        if self.behaviour == "bad":
            raise error(AuthenticationError, 401)
        msg = type("M", (), {"content": '{"ok": true}'})
        return type("R", (), {"choices": [type("C", (), {"message": msg})]})


def script(monkeypatch, behaviours):
    calls = []
    monkeypatch.setattr(llm_clients, "_groq", lambda i=0: FakeClient(behaviours[i], calls, i))
    return calls


def test_settings_merge_and_dedupe_keys():
    s = Settings(groq_api_key="a", groq_api_keys="b, a,,c ")
    assert s.groq_keys == ["a", "b", "c"]


def test_rate_limited_key_rotates_to_next(keys, monkeypatch):
    calls = script(monkeypatch, ["limit", "ok", "ok"])
    assert llm_clients.groq_json("Reply with JSON", model=MODEL) == {"ok": True}
    assert calls == [0, 1]
    assert llm_clients.cooling(MODEL) is False  # keys 1 and 2 are still free


def test_load_is_spread_round_robin(keys, monkeypatch):
    calls = script(monkeypatch, ["ok", "ok", "ok"])
    for _ in range(4):
        llm_clients.groq_json("Reply with JSON", model=MODEL)
    assert calls == [0, 1, 2, 0]


def test_invalid_key_is_skipped_for_good(keys, monkeypatch):
    calls = script(monkeypatch, ["bad", "ok", "ok"])
    llm_clients.groq_json("Reply with JSON", model=MODEL)
    llm_clients.groq_json("Reply with JSON", model=MODEL)
    llm_clients.groq_json("Reply with JSON", model=MODEL)
    assert calls.count(0) == 1  # tried once, then never again


def test_all_keys_busy_moves_on_instead_of_waiting(keys, monkeypatch):
    script(monkeypatch, ["limit", "limit", "limit"])
    monkeypatch.setattr(llm_clients.time, "sleep", lambda s: pytest.fail("should not wait 30 s inside a chain"))
    with pytest.raises(AppError) as e:
        llm_clients.groq_json("Reply with JSON", model=MODEL, max_wait=8)
    assert e.value.code == "RATE_LIMITED"
    assert llm_clients.cooling(MODEL) is True  # the chain will now skip this model
