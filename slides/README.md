# Slides

| File | Use |
|---|---|
| `Roshni-AICON26-Demo.pptx` | **The demo deck to submit and present.** 7 slides for the 5-minute slot, Morph transitions, script and timings in the speaker notes. |
| `Roshni-AICON26-extended.pptx` | Longer 8-slide version for reading after the event. |

Rebuild the demo deck (numbers are read from `eval/results/`):
```bash
node slides/build_demo_deck.js . <assets-dir> slides/Roshni-AICON26-Demo.pptx   # assets-dir holds deck-read.png (app screenshot) and hard.jpg
python slides/set_morph.py slides/Roshni-AICON26-Demo.pptx slides/Roshni-AICON26-Demo.pptx
```
Objects named with a `!!` prefix (the lamp, the panel, the student cards, the stats) appear on several slides, so Morph moves and reshapes them instead of cutting.
