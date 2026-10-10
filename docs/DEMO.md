# Demo guide: Sunday 11 Oct, 09:49–09:54, SEECS CR-01

## Before 09:30
1. Laptop charged, charger, HDMI adapter, a small speaker (read-aloud must be audible), phone hotspot on.
2. Start the app locally: `cd backend && bash run_dev.sh`, then open http://127.0.0.1:8000 (the backend serves the built frontend).
3. `python scripts/check_quotas.py`. If any free quota is exhausted, set `DEMO_MODE=true` in `.env` and restart. The samples then come from the cache with no AI calls.
4. Open these tabs in order:
   - Home
   - the **2.3 Time, Velocity, and Speed** lesson (Read Easy)
   - the same lesson's **Captions** tab
   - **Evidence**
5. Have one printed OpenStax page ready for the live photo, and `data/lectures/sample-lecture-synthetic.mp3` on the desktop.
6. Be at CR-01 by 09:35. They wait only 2 minutes.

## The 5 minutes
| Time | Who | What to do and say |
|---|---|---|
| 0:00–0:30 | Presenter | **Problem.** Hold up the printed page: "Three students in one class. Sara is dyslexic, Bilal is blind, Hamza is deaf. This page works for none of them, and their teacher has no time to adapt it three ways." |
| 0:30–1:20 | Driver | **Live upload.** Home → *Make a lesson* → photograph or upload the page. Point at the progress steps: "Gemini reads the page and describes the diagrams." The lesson opens. |
| 1:20–2:30 | Driver | **Read Easy.** Show original vs Easier side by side. Click **Read aloud**: sentences highlight as they're read. Click an underlined word, then the Urdu explanation and the 🔊 button. Point at **Fact Guard 17/17 facts kept**. |
| 2:30–3:10 | Driver | **The trust moment.** In the Fact Guard card, click **Plant 3 errors**. The cards flip: changed number caught, deleted fact caught, invented claim caught, then repaired back to green. "A second AI from a different family checks the first, and plain code checks every number." |
| 3:10–3:40 | Driver | **Listen** tab: press Alt+N to jump sections, show the figure description. **Captions** tab: click a caption line to jump the audio, show the summary checked against the lecture. |
| 3:40–4:20 | Presenter | **Evidence** page: facts kept %, reading grade drop, planted-error catch rate, false alarms, OCR accuracy on phone-style photos, time per page. "Every number comes from a script in the repo." |
| 4:20–5:00 | Presenter | **Impact and adoption:** special-education schools, inclusive-education NGOs, textbook boards, school chains, Urdu-medium students learning in English, and workplace training for employees with disabilities. Runs on free tiers, PKR 0. "We built all of this during AICON'26." |

## If something goes wrong
- **Upload is slow (more than 20 s):** say "free tiers are queueing us" and open a sample lesson instead. It's the same pipeline, already cached.
- **No internet:** set `DEMO_MODE=true`. Every sample, read-aloud (browser voice), quiz and Fact Guard result still works offline. The Urdu audio clips need internet the first time.
- **Projector has no sound:** turn on the speaker, or show the sentence highlighting without audio.

## Likely judge questions
- **Why not Immersive Reader or Google Lens?** They display or speak existing text. Roshni rewrites printed pages at a lower level, proves the facts survived, describes diagrams, explains hard words in Urdu, and serves three kinds of learner from one upload. Its output is clean HTML that works with screen readers and Immersive Reader too.
- **How do you know the rewrite is correct?** Fact Guard: an independent model family extracts the facts, the checker must quote each one from the rewrite, plain code checks numbers and formulas, and it checks in both directions. The planted-error test shows how often it catches injected mistakes; the false-alarm test shows it doesn't cry wolf.
- **Have blind or deaf students tested it?** Not yet, and we say so. It follows WCAG patterns: keyboard control, screen-reader labels, live announcements, high-contrast theme, reduced motion. The next step is a pilot with a special-education school.
- **What did you build during the event?** Everything; see the commit history and `docs/DISCLOSURES.md` (we used an AI coding assistant, which the rules allow).
- **What does it cost?** PKR 0 today on free tiers, with automatic fallbacks between five Gemini and three Groq models, plus caching.
