"""Tests for Fact Guard's deterministic parts: evidence quotes, sabotage, catch detection, verdict rules."""
from app.services import factguard

REWRITE = [
    {"id": "s1", "text": "Time is change. The SI unit for time is the second. A lecture lasted 50 min."},
    {"id": "s2", "text": "Velocity has a direction. Speed does not have a direction at all."},
]
FACTS = [
    {"id": "f1", "section_id": "s1", "text": "The SI unit for time is the second.", "source_sentence": ""},
    {"id": "f2", "section_id": "s1", "text": "The lecture lasted 50 min.", "source_sentence": ""},
    {"id": "f3", "section_id": "s2", "text": "Speed has no direction.", "source_sentence": ""},
]


def test_evidence_quote_must_exist():
    assert factguard.evidence_ok("The SI unit for time is the second", REWRITE[0]["text"])
    assert not factguard.evidence_ok("Mass is measured in kilograms", REWRITE[0]["text"])
    assert not factguard.evidence_ok("", REWRITE[0]["text"])


def test_sabotage_plants_three_known_errors():
    sabotaged, planted = factguard.sabotage(REWRITE, seed="t", facts=FACTS)
    kinds = {p["type"] for p in planted}
    assert kinds == {"changed_number", "deleted_fact", "added_claim"}
    joined = " ".join(s["text"] for s in sabotaged)
    assert "100 min" in joined  # 50 doubled
    assert any(p["after"] in joined for p in planted if p["type"] == "added_claim")


def test_sabotage_is_deterministic():
    a, _ = factguard.sabotage(REWRITE, seed="same", facts=FACTS)
    b, _ = factguard.sabotage(REWRITE, seed="same", facts=FACTS)
    assert a == b


def test_caught_detection():
    planted = [
        {"type": "changed_number", "section_id": "s1", "before": "A lecture lasted 50 min.", "after": "A lecture lasted 100 min."},
        {"type": "added_claim", "section_id": "s2", "before": "", "after": "Only 12 percent of living things depend on this process."},
    ]
    report = {
        "facts": [{**FACTS[1], "status": "changed"}],
        "added_claims": [{"section_id": "s2", "quote": "Only 12 percent of living things depend on this process.", "why": ""}],
        "missing_tokens": [],
    }
    assert all(p["caught"] for p in factguard.caught(planted, report))


def test_chunking_keeps_order():
    sections = [{"id": f"s{i}", "text": "word " * 400} for i in range(5)]
    chunks = factguard.chunk_sections(sections, max_words=900)
    assert [s["id"] for c in chunks for s in c] == [f"s{i}" for i in range(5)]
    assert all(sum(len(s["text"].split()) for s in c) <= 900 for c in chunks)


def test_problems_grouped_by_section():
    report = {"facts": [{**FACTS[0], "status": "missing", "note": ""}], "added_claims": [{"section_id": "s2", "quote": "x", "why": ""}],
              "missing_tokens": [{"section_id": "s1", "token": "50 min"}]}
    problems = factguard.problems_by_section(report)
    assert problems["s1"]["protected_items"] == ["50 min"]
    assert problems["s2"]["unsupported_claims"] == ["x"]


def test_evidence_must_state_the_fact():
    assert not factguard.supports("For example, a pendulum might make one full swing every 0.75 s.", "The SI unit for time is the second, abbreviated s.")
    assert not factguard.supports("About 500 red blood cells could fit on a pin head.", "About 250 red blood cells could fit on the head of a pin.")
    assert factguard.supports("Most living things get their energy from photosynthesis.", "Photosynthesis provides most of the energy required by living things.")
    assert factguard.supports("a pendulum might swing once every 0.75 s.", "A pendulum may make one full swing every 0.75 s.")
