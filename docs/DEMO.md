# Demo guide: Sunday 11 Oct, 09:49–09:54, SEECS CR-01

## Before 09:30
1. Laptop charged, charger, HDMI adapter, a small speaker (read-aloud must be audible), phone hotspot on.
2. Start the app locally: `cd backend && bash run_dev.sh`, then open http://127.0.0.1:8000 (the backend serves the built frontend).
3. `python scripts/check_quotas.py`. If any free quota is exhausted, set `DEMO_MODE=true` in `.env` and restart. Then use **sample lessons only** (live photo upload, new Urdu TTS, and voice answers are blocked in demo mode).
4. Open these tabs in order:
   - Home
   - the **2.3 Time, Velocity, and Speed** lesson (Read Easy)
   - the same lesson's **Captions** tab
   - **Evidence**
5. Have one printed OpenStax page ready for the live photo, and `data/lectures/sample-lecture-synthetic.mp3` on the desktop.
6. Be at CR-01 by 09:35. They wait only 2 minutes.

## The 5 minutes (8 slides, about 4:50)
Deck: `slides/Roshni-AICON26-Demo.pptx`, with Morph transitions. **Speaker A** and **Speaker B** talk; the **slide controller** clicks and drives the app during the live demo. Every slide's speaker notes give who speaks, the time, the script, and a **► CLICK** cue. Open the deck in **Presenter View** (Slide Show → Use Presenter View) so the notes and timer show on the laptop only.

| Time | Slide | Speaker | What happens | Controller clicks when… |
|---|---|---|---|---|
| 0:00–0:15 | 1 Title | A | Introduce the team and Roshni | A says "…no fact was lost." |
| 0:15–0:40 | 2 Problem | A | Bilal (blind), Sara (dyslexic), Hamza (deaf): one page fails all three | A says "…happens in every school." |
| 0:40–1:15 | 3 Solution | A | One page in, five ways out; where AI is used (Gemini, Qwen, Fact Guard, Whisper) | A says "…will show you." |
| 1:15–2:55 | 4 Live demo | B talks, controller drives | **Alt+Tab to the app.** (1) Home "For you" → open the Photosynthesis sample with its "because…" line. (2) Read Easy: Read aloud, tap an underlined word for Urdu/Pashto. (3) Plant 3 errors → caught and repaired. (4) Practice → Voice quiz, B says "B" → weak areas and study plan, click Open. | B says "…exactly what to revise." (Alt+Tab back first) |
| 2:55–3:20 | 5 Fact Guard | B | Why you can trust it; 28/28 planted errors, 0 false alarms | B says "…zero false alarms." |
| 3:20–3:50 | 6 Set up for you | A | Two questions, opens your way and says why, weak areas → study plan, private by design | A says "…delete any time." |
| 3:50–4:20 | 7 Evidence | B | Measured on real pages: 99% facts kept, grade 11 → 6, 99.98% page reading, 26 s | B says "…on free tiers." |
| 4:20–4:50 | 8 Impact | A | Who adopts it, PKR 0, SDG 4.5, built here, thank you | Stay here for questions |

**Before the demo:** the deployed site open in a second window, the demo profile already set up on that address (Set up → open two samples → one Practice quiz with a few wrong answers), the speaker and microphone tested, and the deck in Presenter View on slide 1. Rehearse at least twice with a stopwatch; the live demo is the part that overruns.

## If something goes wrong
- **Upload is slow (more than 20 s):** say "free tiers are queueing us" and open a sample lesson instead. It's the same pipeline, already cached.
- **No internet:** set `DEMO_MODE=true`. Sample lessons, browser English read-aloud, cached quizzes and Fact Guard still work. Urdu/Pashto TTS and voice answers need network (or pre-warmed audio) and are blocked in demo mode if not cached.
- **Projector has no sound:** turn on the speaker, or show the sentence highlighting without audio.

## Likely judge questions
- **Why not Immersive Reader or Google Lens?** They display or speak existing text. Roshni rewrites printed pages at a lower level, proves the facts survived, describes diagrams, explains hard words in Urdu, and serves three kinds of learner from one upload. Its output is clean HTML that works with screen readers and Immersive Reader too.
- **How do you know the rewrite is correct?** Fact Guard: an independent model family extracts the facts, the checker must quote each one from the rewrite, plain code checks numbers and formulas, and it checks in both directions. The planted-error test shows how often it catches injected mistakes; the false-alarm test shows it doesn't cry wolf.
- **Have blind or deaf students tested it?** Not yet, and we say so. It follows WCAG patterns: keyboard control, screen-reader labels, live announcements, high-contrast theme, reduced motion. The next step is a pilot with a special-education school.
- **What did you build during the event?** Everything; see the commit history and `docs/DISCLOSURES.md` (we used an AI coding assistant, which the rules allow).
- **What does it cost?** PKR 0 today on free tiers, with automatic fallbacks between five Gemini and three Groq models, plus caching.
