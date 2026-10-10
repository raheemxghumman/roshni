"""Unit tests for number/unit/formula normalisation edge cases (commas, decimals, units, superscripts)."""
from app.services.normalize import for_match, missing_tokens, protected_tokens, token_present


def test_thousands_and_units_match():
    assert token_present("1,000 m", "about 1000 metres long")
    assert token_present("300,000 km/s", "light moves at 300000 km/s")


def test_unit_words_and_symbols():
    assert token_present("100 °C", "boils at 100 degrees Celsius")
    assert token_present("25%", "25 percent of it")
    assert token_present("5 m/s", "5 metres per second")


def test_number_words():
    assert token_present("3 hours", "three hours")


def test_superscripts():
    assert token_present("m/s²", "9.8 m/s2")
    assert token_present("CO₂", "CO2 gas")


def test_changed_number_is_caught():
    assert missing_tokens("The race took 50 min.", "The race took 100 min.") == ["50 min"]


def test_formulas_and_equations_extracted():
    toks = protected_tokens("Water (H2O) and CO2. E = mc2 is famous. DNA stores code.")
    assert {"H2O", "CO2", "DNA", "E = mc2"} <= set(toks)


def test_common_words_not_protected():
    toks = protected_tokens("The cell is small. It is alive. In plants, it grows.")
    assert toks == []


def test_case_insensitive():
    assert for_match("ATP") == for_match("atp")
