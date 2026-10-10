"""Word error rate of lecture transcription against the exact script of the synthetic lecture clip.

The clip in data/lectures/ is generated with a text-to-speech voice from SCRIPT below, so the true
transcript is known exactly. Replace with team-recorded clips + hand transcripts for real speech.
Usage: python eval/asr_wer.py
"""
import re

import jiwer

from common import ROOT, write
from app.services import transcribe

SCRIPT = ("Good morning class. Today we continue with motion. Remember, time is change. The SI unit of time is the second. "
          "Now, velocity is not the same as speed. Average velocity is displacement divided by the time of travel. "
          "So if a car moves 100 metres east in 20 seconds, its average velocity is 5 metres per second east. "
          "Speed has no direction. For homework, please solve questions 3 to 6 from section 2.3, and bring your notebooks on Monday.")

UNITS = {"meters": "metres", "meter": "metre"}


def norm(t: str) -> str:
    t = re.sub(r"[^\w\s.]", " ", t.lower())
    t = re.sub(r"(?<!\d)\.|\.(?!\d)", " ", t)
    return " ".join(UNITS.get(w, w) for w in t.split())


clip = ROOT / "data" / "lectures" / "sample-lecture-synthetic.mp3"
if not clip.exists():
    raise SystemExit("Missing data/lectures/sample-lecture-synthetic.mp3 (see docs/PLAN.md).")
result = transcribe.run(clip.read_bytes(), clip.name, "en")
wer = jiwer.wer(norm(SCRIPT), norm(result["text"]))
print(f"WER {wer:.2%}\nheard: {result['text']}")
write(
    "asr_wer",
    title="Lecture transcription accuracy",
    display=f"{1 - wer:.1%} of words correct",
    value=round(wer, 4),
    detail=f"Word error rate {wer:.2%} on a {result['duration']:.0f}-second lecture clip with a known script.",
    dataset="Synthetic lecture clip (text-to-speech voice, known script)",
    n="1 clip, " + str(len(SCRIPT.split())) + " words",
    method="jiwer word error rate after normalising case, punctuation and metre/meter spelling",
    models=result["model"],
    data_type="synthetic",
)
