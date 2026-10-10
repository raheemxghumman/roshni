"""Turns what a student said ("B", "option two", "bee", "دو", the answer itself) into an option index or a command.

Plain code, no AI: Whisper writes down the words, this decides what they mean. Ambiguous replies return nothing,
so the app asks again instead of guessing.
"""
from __future__ import annotations

import re

LETTERS = {
    0: {"a", "ay", "eh", "aye", "اے", "ए"},
    1: {"b", "bee", "be", "bi", "بی", "बी"},
    2: {"c", "see", "sea", "si", "cee", "سی", "सी"},
    3: {"d", "dee", "di", "ڈی", "डी"},
}
NUMBERS = {
    0: {"1", "one", "first", "ek", "ایک", "پہلا", "پہلی", "یو", "لومړی", "एक"},
    1: {"2", "two", "second", "دو", "دوسرا", "دوسری", "دوه", "دویم", "दो"},  # bare English "do" is NOT here — too many false positives
    2: {"3", "three", "third", "teen", "tin", "تین", "تیسرا", "تیسری", "درې", "دری", "دریم", "तीन"},
    3: {"4", "four", "fourth", "char", "chaar", "چار", "چوتھا", "چوتھی", "څلور", "څلورم", "चार"},
}
# Roman-Urdu "do" (two) counts when it is the whole reply ("do") or led by option/answer/number ("number do"),
# never inside an English sentence ("I do not know", "I do think so")
NUMBER_DO = {"do"}
# words that may be spoken before a choice: "option B", "answer number two", "jawab B", "جواب بی"
LEAD = {"option", "options", "answer", "letter", "number", "choice", "its", "it's", "is", "the", "my", "i", "say", "choose", "pick",
        "jawab", "جواب", "آپشن", "نمبر", "ځواب", "please", "go", "with", "final"}
EXPLICIT_LEAD = {"option", "options", "answer", "letter", "number", "choice", "jawab", "جواب", "آپشن", "نمبر", "ځواب"}
COMMANDS = {
    "repeat": {"repeat", "again", "say again", "repeat that", "repeat the question", "once more", "one more time", "what", "pardon",
               "دوبارہ", "پھر سے", "دوبارہ پڑھیں", "بیا", "بیا ووایه"},
    "skip": {"skip", "pass", "next", "skip it", "next question", "i don't know", "don't know", "i dont know", "dont know",
             "i do not know", "do not know", "no idea",
             "اگلا", "چھوڑ دیں", "معلوم نہیں", "نہیں پتا", "پتہ نہیں", "نه پوهېږم", "بل"},
    "stop": {"stop", "pause", "quit", "stop the quiz", "رکیں", "بند کریں", "ودرېږه"},
}
STOP_WORDS = set("the a an and or of to in on for with is are was were be by as at from that this it its into than then their there".split())
# Homophones that are also common English words — only count as letters when the reply is basically just that token
AMBIGUOUS_LETTERS = {"a", "ay", "eh", "aye", "be", "bee", "see", "sea", "si"}


def normalize(text: str) -> str:
    text = text.lower().replace("’", "'")
    text = re.sub(r"[^\w\s']", " ", text)  # \w keeps Urdu, Pashto and Hindi letters
    return re.sub(r"\s+", " ", text).strip()


def _choices_in(words: list[str], n: int) -> set[int]:
    """Option indexes named by letter or number. Single letters only count when the reply is short or led in by
    'option'/'answer', so the article 'a' in "a plant" isn't read as option A."""
    found: set[int] = set()
    content = [w for w in words if w not in LEAD]
    # Bare letter answers: "b", "see", "option C". Soft phrases like "I see" / "I will be" must not match.
    bare_letter = len(words) == 1 or (len(content) == 1 and all(w in EXPLICIT_LEAD or w == content[0] for w in words))
    short = len(content) <= 1
    for i, w in enumerate(words):
        led = i > 0 and words[i - 1] in LEAD
        explicit = i > 0 and words[i - 1] in EXPLICIT_LEAD
        for idx in range(n):
            if w in NUMBER_DO and idx == 1:
                if explicit or len(words) == 1:
                    found.add(idx)
                continue
            if w in NUMBERS.get(idx, set()) and (short or led or w.isdigit()):
                found.add(idx)
            if w in LETTERS.get(idx, set()):
                if w in AMBIGUOUS_LETTERS:
                    if bare_letter or explicit:
                        found.add(idx)
                elif short or led:
                    found.add(idx)
    return found


def _content(text: str) -> set[str]:
    return {w for w in normalize(text).split() if w not in STOP_WORDS and len(w) > 1}


def _by_option_text(heard: str, options: list[str]) -> int | None:
    said = _content(heard)
    heard_n = normalize(heard)
    heard_words = heard_n.split()
    if not said and not heard_words:
        return None
    scores = []
    for opt in options:
        words = _content(opt)
        opt_n = normalize(opt)
        if not words and not opt_n:
            scores.append(0.0)
            continue
        # Exact / whole-phrase match only (not substring: "brain" must not match "Rain")
        if opt_n and (heard_n == opt_n or re.search(rf"(?<!\w){re.escape(opt_n)}(?!\w)", heard_n)):
            scores.append(1.0)
            continue
        if not words:
            scores.append(0.0)
            continue
        scores.append(len(words & said) / len(words))
    best = max(range(len(options)), key=lambda i: scores[i])
    runner_up = max((s for i, s in enumerate(scores) if i != best), default=0.0)
    return best if scores[best] >= 0.6 and scores[best] - runner_up >= 0.2 else None


def match(heard: str, options: list[str]) -> dict:
    """{"choice": index or None, "command": "repeat"|"skip"|"stop"|None, "reason": short note for the UI}."""
    text = normalize(heard)
    if not text:
        return {"choice": None, "command": None, "reason": "nothing heard"}
    for command, phrases in COMMANDS.items():
        if text in phrases or any(len(p.split()) > 1 and p in text for p in phrases):
            return {"choice": None, "command": command, "reason": command}
    # Prefer option text before letter/number so saying "Sea" picks the Sea option, not letter C
    idx = _by_option_text(heard, options)
    if idx is not None:
        return {"choice": idx, "command": None, "reason": "answer text"}
    words = text.split()
    named = _choices_in(words, len(options))
    if len(named) == 1:
        return {"choice": named.pop(), "command": None, "reason": "letter or number"}
    if len(named) > 1:
        return {"choice": None, "command": None, "reason": "more than one answer"}
    return {"choice": None, "command": None, "reason": "no match"}
