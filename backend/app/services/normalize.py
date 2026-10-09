"""Normalises numbers, units, formulas and names so '1,000 m' == '1000 metres' when comparing original vs rewrite."""
from __future__ import annotations

import re

SUPERSCRIPTS = str.maketrans("⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉⁻", "01234567890123456789-")

NUMBER_WORDS = {
    "zero": "0", "one": "1", "two": "2", "three": "3", "four": "4", "five": "5", "six": "6", "seven": "7",
    "eight": "8", "nine": "9", "ten": "10", "eleven": "11", "twelve": "12", "fifteen": "15", "twenty": "20",
    "thirty": "30", "forty": "40", "fifty": "50", "hundred": "100", "thousand": "1000",
}

UNIT_WORDS = [
    (r"metres? per second squared|meters? per second squared", "m/s2"),
    (r"metres? per second|meters? per second", "m/s"),
    (r"kilometres? per hour|kilometers? per hour", "km/h"),
    (r"degrees? celsius|° ?c\b", "°c"),
    (r"degrees? fahrenheit|° ?f\b", "°f"),
    (r"per ?cent\b|percent\b", "%"),
    (r"kilometres?|kilometers?", "km"),
    (r"centimetres?|centimeters?", "cm"),
    (r"millimetres?|millimeters?", "mm"),
    (r"nanometres?|nanometers?", "nm"),
    (r"kilograms?", "kg"),
    (r"milligrams?", "mg"),
    (r"millilitres?|milliliters?", "ml"),
    (r"litres?|liters?", "l"),
    (r"kilojoules?", "kj"),
    (r"joules?", "j"),
    (r"watts?", "w"),
    (r"hertz", "hz"),
]

UNIT_PATTERN = r"(?:%|°c|°f|km/h|km/s|m/s²|m/s2|m/s|km|cm|mm|nm|kg|mg|ml|kj|kw|kpa|mol|hz|g|m|s|l|j|w|v|a|k|n|pa)"
NUMBER_RE = re.compile(r"(?<![\w.])(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:\s?" + UNIT_PATTERN + r")?(?![\w])", re.IGNORECASE)
FORMULA_RE = re.compile(r"\b(?:[A-Z][a-z]?\d*){2,}\b")
EQUATION_RE = re.compile(r"\b[A-Za-z]\w{0,3}\s*=\s*[\w^²³().]+(?:\s*[+\-*/×÷]\s*[\w^²³().]+)*")

COMMON_CAPS = {"The", "This", "These", "Each", "All", "In", "It", "An", "As", "At", "By", "For", "If", "On", "Of", "To", "We", "When"}


def basic(text: str) -> str:
    text = text.translate(SUPERSCRIPTS).replace("²", "2").replace("³", "3").replace("−", "-").replace("–", "-")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def for_match(text: str) -> str:
    """Lower-cased, unit- and number-normalised text used only for comparisons."""
    t = basic(text).lower()
    t = re.sub(r"(?<=\d),(?=\d{3}\b)", "", t)  # 1,000 -> 1000
    for pattern, symbol in UNIT_WORDS:
        t = re.sub(pattern, symbol, t)
    t = re.sub(r"\b(" + "|".join(NUMBER_WORDS) + r")\b", lambda m: NUMBER_WORDS[m.group(1)], t)
    t = re.sub(r"(\d)\s+(" + UNIT_PATTERN + r")\b", r"\1\2", t)  # "5 kg" -> "5kg"
    t = re.sub(r"(\d)\.0\b", r"\1", t)  # 3.0 -> 3
    return t


def protected_tokens(text: str) -> list[str]:
    """Numbers (with units), chemical formulas and equations that a rewrite must keep unchanged."""
    text = basic(text)
    found: list[str] = []
    for m in NUMBER_RE.finditer(text):
        tok = m.group(0).strip()
        if re.fullmatch(r"\d", tok):  # single digits are often list numbers or "one" in prose; checked via facts instead
            continue
        found.append(tok)
    for m in FORMULA_RE.finditer(text):
        tok = m.group(0)
        if tok in COMMON_CAPS:
            continue
        if any(ch.isdigit() for ch in tok) or (tok.isupper() and 2 <= len(tok) <= 6):
            found.append(tok)
    for m in EQUATION_RE.finditer(text):
        found.append(m.group(0).strip())
    seen, unique = set(), []
    for tok in found:
        key = for_match(tok)
        if key not in seen:
            seen.add(key)
            unique.append(tok)
    return unique


def token_present(token: str, rewrite: str) -> bool:
    tok, rw = for_match(token), for_match(rewrite)
    if tok in rw:
        return True
    # tolerate spacing differences in formulas / equations
    return tok.replace(" ", "") in rw.replace(" ", "")


def missing_tokens(original: str, rewrite: str) -> list[str]:
    return [tok for tok in protected_tokens(original) if not token_present(tok, rewrite)]
