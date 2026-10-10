"""The paid DeepSeek backup must refuse to run once its budget or balance limit is reached (no network calls made)."""
import json

import pytest

from app.config import Settings
from app.errors import AppError
from app.services import llm_clients


@pytest.fixture
def paid(tmp_path, monkeypatch):
    settings = Settings(deepseek_api_key="test-key", deepseek_budget_usd=0.80, cache_dir=str(tmp_path))
    monkeypatch.setattr(llm_clients, "get_settings", lambda: settings)
    monkeypatch.setattr(llm_clients, "_balance_checked_at_call", -1)
    monkeypatch.setattr(llm_clients, "_cooldown", {})
    return tmp_path


def spend(tmp_path, usd, calls=1):
    (tmp_path / "deepseek_spend.json").write_text(json.dumps({"usd": usd, "calls": calls, "input_tokens": 0, "output_tokens": 0}))


def test_refuses_when_budget_used_up(paid, monkeypatch):
    spend(paid, 0.80)
    monkeypatch.setattr(llm_clients, "deepseek_balance", lambda: pytest.fail("balance should not be needed"))
    with pytest.raises(AppError) as e:
        llm_clients.deepseek_json("Reply with JSON")
    assert e.value.code == "RATE_LIMITED"


def test_refuses_when_real_balance_low(paid, monkeypatch):
    spend(paid, 0.01)
    monkeypatch.setattr(llm_clients, "deepseek_balance", lambda: 0.05)
    with pytest.raises(AppError):
        llm_clients.deepseek_json("Reply with JSON")


def test_allowed_inside_limits(paid, monkeypatch):
    spend(paid, 0.10)
    monkeypatch.setattr(llm_clients, "deepseek_balance", lambda: 0.90)
    llm_clients._deepseek_allowed()  # no exception


def test_spend_is_recorded(paid):
    llm_clients._record_spend({"prompt_tokens": 1_000_000, "completion_tokens": 0})
    assert llm_clients.deepseek_spend()["usd"] == pytest.approx(0.50)
    assert llm_clients.deepseek_spend()["calls"] == 1


def test_cut_off_answer_is_not_retried(paid, monkeypatch):
    spend(paid, 0.0)
    monkeypatch.setattr(llm_clients, "deepseek_balance", lambda: 0.90)
    calls = []

    class Resp:
        status_code = 200

        def json(self):
            return {"usage": {"prompt_tokens": 10, "completion_tokens": 3000}, "choices": [{"finish_reason": "length", "message": {"content": '{"items": ['}}]}

    monkeypatch.setattr(llm_clients.httpx, "post", lambda *a, **k: calls.append(1) or Resp())
    with pytest.raises(AppError):
        llm_clients.deepseek_json("Reply with JSON")
    assert len(calls) == 1  # paid once, not twice
