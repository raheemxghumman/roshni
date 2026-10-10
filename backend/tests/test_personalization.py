"""Post-hackathon personalization: review facts, ask grounding, coach number rules, TTS voices."""
import pytest

from app.errors import AppError
from app.services import ask, coach, quiz, tts


def test_check_one_returns_fact_id():
    stored = {
        "questions": [
            {
                "id": "q1",
                "question": "What cools?",
                "options": ["Vapour", "Rock", "Steel", "Glass"],
                "answer": "Vapour",
                "answer_index": 0,
                "explanation": "Vapour cools.",
                "fact": "Water vapour cools and forms clouds.",
                "fact_id": "f1",
                "section_id": "s1",
            }
        ]
    }
    r = quiz.check_one(stored, "q1", "Vapour")
    assert r["correct"] and r["fact_id"] == "f1" and r["section_id"] == "s1"


def test_resolve_voice_allowlist():
    assert tts.resolve_voice("ur", "asad") == "ur-PK-AsadNeural"
    assert tts.resolve_voice("ps", "gulnawaz") == "ps-AF-GulNawazNeural"
    with pytest.raises(AppError) as e:
        tts.resolve_voice("ur", "not-a-voice")
    assert e.value.code == "BAD_REQUEST"


def test_ask_finds_section_by_sentence():
    lesson = {
        "id": "L1",
        "sections": [
            {"id": "s1", "heading": "Clouds", "text": "Water vapour cools and forms clouds. Rain follows."},
            {"id": "s2", "heading": "Sun", "text": "The sun gives light."},
        ],
    }
    sec = ask.find_section(lesson, "Water vapour cools and forms clouds.")
    assert sec and sec["id"] == "s1"


def test_coach_rejects_digits_in_model_lines(monkeypatch):
    """Code must refuse model output that invents numbers; build_note then fails cleanly."""
    report = {
        "correct": 4,
        "total": 10,
        "sections": [{"heading": "Clouds", "missed_facts": ["Water vapour cools and forms clouds."]}],
        "plan": [{"title": 'Re-read “Clouds” at the Simplest level'}],
    }
    quiz_doc = {"id": "qz1"}

    monkeypatch.setattr(coach.cache, "get_json", lambda *a, **k: None)
    monkeypatch.setattr(coach.cache, "put_json", lambda *a, **k: None)
    monkeypatch.setattr(coach.cache, "make_key", lambda *a: "k")
    monkeypatch.setattr(coach, "text_json", lambda *a, **k: ({"lines": ["You scored 99 percent somehow.", "Next: wrong"]}, "m"))

    with pytest.raises(AppError) as e:
        coach.build_note(quiz_doc, report)
    assert e.value.code == "MODEL_UNAVAILABLE"


def test_coach_accepts_clean_lines_and_writes_numbers(monkeypatch):
    report = {
        "correct": 4,
        "total": 10,
        "sections": [{"heading": "Clouds", "missed_facts": ["Water vapour cools and forms clouds."]}],
        "plan": [{"title": 'Re-read “Clouds” at the Simplest level'}],
    }
    monkeypatch.setattr(coach.cache, "get_json", lambda *a, **k: None)
    saved = {}
    monkeypatch.setattr(coach.cache, "put_json", lambda kind, key, data: saved.update(data))
    monkeypatch.setattr(coach.cache, "make_key", lambda *a: "k")
    monkeypatch.setattr(
        coach,
        "text_json",
        lambda *a, **k: ({"lines": ["This part of the page is still tricky.", "Next: ignore me"]}, "m"),
    )
    out = coach.build_note({"id": "qz1"}, report)
    assert out["checked"] and "4 of 10" in out["text"]
    assert "Water vapour cools and forms clouds." in out["text"]
    assert 'Next: Re-read “Clouds” at the Simplest level' in out["text"]
    assert not any(ch.isdigit() for ch in "This part of the page is still tricky.")


def test_generate_allows_single_fact_for_review():
    facts = [{"id": "f1", "text": "Water vapour cools and forms clouds.", "section_id": "s1"}]
    # Without min_facts=1 this would raise NOT_ENOUGH_FACTS
    with pytest.raises(AppError) as e:
        quiz.generate(facts, "easier", 1)
    assert e.value.code == "NOT_ENOUGH_FACTS"
