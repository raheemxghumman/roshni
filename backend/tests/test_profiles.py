"""Learner profile store: off cleanly without a database, never stores personal fields, never mixes visitors' history."""
import pytest
from fastapi.testclient import TestClient

from app.errors import AppError
from app.main import app
from app.services import profiles

LEARNER = "3f2b8c1e-9a4d-4c7b-8e21-5d6f7a8b9c0d"


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(profiles, "_get_pool", lambda: None)  # no database configured
    return TestClient(app)


def test_store_off_is_a_clear_retryable_error(client):
    r = client.get("/api/me", headers={"X-Learner-Id": LEARNER})
    assert r.status_code == 503 and r.json()["error"]["code"] == "PROFILE_STORE_OFF" and r.json()["error"]["retryable"]
    assert client.get("/api/health").json()["profile_store"] is False


@pytest.mark.parametrize("bad", [None, "", "short", "has spaces in it at all", "x" * 80, "'; DROP TABLE learners;--"])
def test_bad_learner_ids_are_rejected(client, bad):
    headers = {"X-Learner-Id": bad} if bad is not None else {}
    r = client.put("/api/me", json={"profile": {}}, headers=headers)
    assert r.status_code == 400


def test_profile_keeps_only_known_fields():
    cleaned = profiles.clean_profile({"needs": ["large_text"], "name": "Ayesha", "gender": "f", "email": "a@b.c", "best": {"L1": 0.8}})
    assert cleaned == {"needs": ["large_text"], "best": {"L1": 0.8}}


def test_profile_size_is_capped():
    with pytest.raises(AppError):
        profiles.clean_profile({"recent": [{"title": "x" * 1000}] * 40})


def test_history_is_never_shared_between_visitors(client):
    lesson = {"id": "L1"}
    attempt = {"quiz_id": "q", "score": 0.5, "correct": 5, "total": 10, "level": "easier", "mode": "tap", "weak": []}
    # no id / no database: only this answer comes back, nothing from other visitors
    from app.routers.practice import own_history
    assert own_history(None, lesson, attempt) == [attempt]
    assert own_history(LEARNER, lesson, attempt) == [attempt]
    assert own_history(None, lesson) == []
