"""Practice quiz: question validation, fact picking, grading, weak areas, study plan, and spoken-answer matching."""
import pytest

from app.services import quiz, voice

OPTIONS = ["Evaporation", "Condensation", "Precipitation", "Transpiration"]


# ---------------------------------------------------------------- spoken answers

@pytest.mark.parametrize("heard,expected", [
    ("B", 1), ("B.", 1), ("bee", 1), ("Option B", 1), ("option b please", 1), ("The answer is C", 2), ("see", 2),
    ("D.", 3), ("dee", 3), ("A", 0), ("Answer A.", 0),
    ("two", 1), ("Number three", 2), ("4", 3), ("the first one", 0), ("fourth", 3),
    ("دو", 1), ("جواب بی", 1), ("تین", 2), ("چار", 3), ("ایک", 0),  # Urdu
    ("دوه", 1), ("درې", 2), ("څلور", 3),  # Pashto
    ("do", 1), ("teen", 2),  # Roman Urdu
    ("Condensation", 1), ("I think it's precipitation", 2), ("transpiration.", 3),
])
def test_choices(heard, expected):
    assert voice.match(heard, OPTIONS)["choice"] == expected


@pytest.mark.parametrize("heard,command", [("repeat", "repeat"), ("Repeat the question", "repeat"), ("say again", "repeat"), ("دوبارہ", "repeat"),
                                            ("skip", "skip"), ("I don't know", "skip"), ("next question", "skip"), ("stop", "stop")])
def test_commands(heard, command):
    m = voice.match(heard, OPTIONS)
    assert m["command"] == command and m["choice"] is None


@pytest.mark.parametrize("heard", ["", "   ", "Thank you.", "B or C", "a plant makes food from light and water", "hmm"])
def test_unclear_replies_choose_nothing(heard):
    """Silence, Whisper's 'Thank you.' hallucination, two answers, or a sentence with the article 'a' must not pick an option."""
    assert voice.match(heard, OPTIONS)["choice"] is None


def test_letter_beyond_option_count_is_ignored():
    assert voice.match("D", ["True", "False", "Maybe"])["choice"] is None


# ---------------------------------------------------------------- question validation

FACTS = {"f1": {"id": "f1", "text": "Water vapour cools and forms clouds.", "section_id": "s1"}}


def q(**over):
    base = {"fact_id": "f1", "question": "What happens when water vapour cools?", "options": ["It forms clouds", "It boils", "It freezes at once", "It disappears"],
            "answer": "It forms clouds", "explanation": "Cooling vapour condenses into clouds."}
    base.update(over)
    return base


def test_valid_question_is_kept_and_shuffled_stably():
    a, b = quiz.clean_question(q(), FACTS, set()), quiz.clean_question(q(), FACTS, set())
    assert a and a["options"] == b["options"] and a["options"][a["answer_index"]] == "It forms clouds"
    assert a["section_id"] == "s1" and a["fact"] == FACTS["f1"]["text"]


@pytest.mark.parametrize("over", [
    {"answer": "It melts"},  # answer not among the options
    {"options": ["It forms clouds", "It forms clouds", "it forms clouds."]},  # duplicates leave too few options
    {"options": ["It forms clouds", "It boils", "All of the above", "None"]},  # breaks when shuffled
    {"fact_id": "f99"},  # not one of the verified facts
    {"question": ""},
])
def test_bad_questions_are_dropped(over):
    assert quiz.clean_question(q(**over), FACTS, set()) is None


def test_answer_given_as_letter_and_prefixed_options():
    c = quiz.clean_question(q(options=["A) It boils", "B) It forms clouds", "C) It freezes at once", "D) It disappears"], answer="B"), FACTS, set())
    assert c and c["answer"] == "It forms clouds" and all(not o.startswith(("A)", "B)")) for o in c["options"])


def test_numeric_fact_id_and_duplicate_questions():
    seen = set()
    assert quiz.clean_question(q(fact_id="1"), FACTS, seen)["fact_id"] == "f1"
    assert quiz.clean_question(q(fact_id="1"), FACTS, seen) is None  # same question twice


def test_pick_facts_covers_every_section_and_respects_focus():
    facts = [{"id": f"f{i}", "text": f"fact {i}", "section_id": f"s{i % 3}"} for i in range(12)]
    picked = quiz.pick_facts(facts, 3, None, "seed")
    assert {f["section_id"] for f in picked} == {"s0", "s1", "s2"}
    focus = quiz.pick_facts(facts, 10, ["s1"], "seed")
    assert focus and all(f["section_id"] == "s1" for f in focus)


def test_too_few_facts_is_a_clear_error():
    with pytest.raises(Exception) as e:
        quiz.generate([{"id": "f1", "text": "x", "section_id": "s1"}], "easier", 5)
    assert getattr(e.value, "code", "") == "NOT_ENOUGH_FACTS"


# ---------------------------------------------------------------- grading, weak areas and study plan

LESSON = {"id": "L1", "sections": [{"id": "s1", "heading": "Evaporation"}, {"id": "s2", "heading": "Clouds"}],
          "glossary": {"items": [{"term": "condensation", "section_id": "s2"}]}, "lecture_id": "lec1"}


def make_quiz():
    qs = []
    for i, sid in enumerate(["s1", "s1", "s2", "s2", "s2"], start=1):
        qs.append({"id": f"q{i}", "question": f"Q{i}", "options": ["a", "b", "c", "d"], "answer": "a", "answer_index": 0,
                   "fact_id": f"f{i}", "section_id": sid, "fact": f"Clouds form when vapour condenses {i}", "explanation": ""})
    return {"id": "Z", "level": "easier", "questions": qs}


def test_grade_finds_weak_section_and_builds_plan():
    video = {"id": "v1", "title": "Water cycle", "notes": [{"heading": "Clouds", "start": 60, "notes": [
        {"text": "Clouds form when water vapour condenses into droplets", "start": 75, "status": "supported"}]}]}
    report = quiz.grade(make_quiz(), {"q1": "a", "q2": "a", "q3": "b", "q4": ""}, ["q4"], LESSON, [video])
    assert report["correct"] == 2 and report["total"] == 5 and report["timed_out"] == 1 and report["skipped"] == 1
    clouds = next(s for s in report["sections"] if s["id"] == "s2")
    assert clouds["weak"] and clouds["correct"] == 0 and len(clouds["missed_facts"]) == 3
    assert report["weak_sections"] == ["s2"]
    kinds = [p["kind"] for p in report["plan"]]
    assert kinds[:2] == ["read", "listen"] and "words" in kinds and "video" in kinds and "lecture" in kinds and "retry" in kinds
    video_step = next(p for p in report["plan"] if p["kind"] == "video")
    assert video_step["action"] == {"tab": "videos", "video": "v1", "t": 75}
    assert report["new_level"] == "simplest"  # 40% -> make it simpler


def test_perfect_score_has_no_weak_areas():
    report = quiz.grade(make_quiz(), {f"q{i}": "A " for i in range(1, 6)}, [], LESSON, [])
    assert report["score"] == 1.0 and report["weak_sections"] == [] and report["new_level"] == "original"
    assert report["plan"][-1]["kind"] == "retry"


def test_many_timeouts_suggest_more_time():
    report = quiz.grade(make_quiz(), {}, ["q1", "q2", "q3"], LESSON, [])
    assert any(p["kind"] == "timer" for p in report["plan"])


def test_check_one_hides_nothing_needed_and_rejects_unknown_question():
    z = make_quiz()
    assert quiz.check_one(z, "q1", "a")["correct"] is True
    assert quiz.check_one(z, "q1", "")["correct"] is False
    with pytest.raises(Exception):
        quiz.check_one(z, "q9", "a")
    pub = quiz.public(z)
    assert all("answer" not in x and "fact" not in x for x in pub["questions"])
