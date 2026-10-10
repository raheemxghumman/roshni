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
Deck: `slides/Roshni-AICON26-Demo.pptx` (7 slides, Morph transitions, script in the speaker notes). Open it in **Presenter View** (Slide Show → Use Presenter View) so the notes and timer show on the laptop only. On slide 4, press **Alt+Tab** to the app, then come back to the deck for slide 5.

| Time | Slide | Who | What to do and say |
|---|---|---|---|
| 0:00–0:20 | 1 Title | Presenter | "We are 404 Team Not Found. This is Roshni, which means light: one photo of a textbook page becomes a lesson blind, dyslexic and deaf students can use, and a second AI proves no fact was lost." |
| 0:20–0:50 | 2 Problem | Presenter | Hold up the printed page: "Three students, one class. Bilal is blind, Sara is dyslexic, Hamza is deaf. This page works for none of them, and their teacher has no time to adapt it three ways." |
| 0:50–1:30 | 3 Solution | Presenter | "AI is the pipeline, not a chat box: Gemini reads the page, Qwen rewrites it, Fact Guard checks it, Whisper captions the lecture." The student cards morph into their modes. |
| 1:30–3:30 | 4 Live demo | Driver | **Alt+Tab to the app.** (1) Upload the photo of the printed page. (2) Read Easy: **Read aloud**, tap an underlined word for Urdu/Pashto, point at the Fact Guard badge. (3) **Plant 3 errors**: the cards flip to Caught, then the rewrite is repaired. (4) **Practice → Voice quiz** on the Photosynthesis sample: let it read one question, say "B" after the beep, show the result card, weak areas and the study plan step "Watch 1:23 in Autotrophs and Heterotrophs" (click Open: the video jumps there). Slow upload? Open the cached physics sample. |
| 3:30–4:00 | 5 Fact Guard | Presenter | "You just saw it live. A different AI family checks, every kept fact must be quoted, numbers are checked by plain code, and gaps are repaired." |
| 4:00–4:35 | 6 Evidence | Presenter | "Every number comes from a script in our repo, on real textbook pages: 28 of 28 planted errors caught, zero false alarms, grade 11 down to about 6." |
| 4:35–5:00 | 7 Impact | Presenter | Adopters, PKR 0 to run, SDG 4.5, built during AICON'26. "Next is a pilot with a special-education school. Thank you." |

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
