---
title: Roshni
emoji: 🪔
colorFrom: blue
colorTo: yellow
sdk: docker
app_port: 7860
pinned: false
---

# Roshni · روشنی: One page. Every learner.

**Roshni turns a printed textbook page or a recorded lecture into an accessible lesson for blind, dyslexic and deaf learners. A second AI, Fact Guard, proves that no fact was lost or changed along the way.**

Built at **AICON'26 Build With AI** (domain: **EdTech & Workforce**) by **404 Team Not Found**.

| | |
|---|---|
| **Problem** | One printed page works for almost nobody who needs help. Blind students can't read it, dyslexic students and students from Urdu-medium schools struggle to follow it, and deaf students miss the lecture that explains it. Teachers have no time to adapt every page three ways, so it doesn't happen. |
| **Data in** | A phone photo, scan or PDF of a textbook page; optionally a lecture recording. |
| **AI** | Gemini reads the page and describes every diagram. Qwen rewrites it at an easier level, and hard words are explained in Urdu or Pashto (Gemini first, it writes better Pashto). **Fact Guard**, GPT-OSS from a different model family, extracts every fact and audits the rewrite. Whisper transcribes the lecture. |
| **Solution** | One lesson in three modes: **Read Easy** (simpler text, Urdu or Pashto help, read-aloud with highlighting, adaptive quiz), **Listen** (section-by-section audio with figure descriptions, full keyboard and screen-reader control), **Captions** (transcript synced to audio plus a summary checked against the lecture). Plus **Videos** (a YouTube link becomes timestamped study notes, each checked against the video's captions) and **Practice** (up to 15 questions from verified facts, a voice quiz for blind learners, a per-question timer, weak areas and a study plan). |
| **Impact** | Reading level drops by several grades, nearly every fact is verifiably kept, planted errors are caught, and a page is ready in about a minute instead of hours of manual adaptation. See **Evidence** below. SDG 4.5 (equal access for persons with disabilities), 4.1, 10.2. |

## Why the AI is essential
Reading a printed page, describing a diagram for a blind student, rewriting while keeping meaning, explaining in Urdu and Pashto, transcribing speech and checking facts are all AI tasks. Remove the AI and the product does nothing.

## Practice: quiz, weak areas and a study plan
- **Questions only from verified facts.** Every multiple-choice question is written from a fact Fact Guard verified, then checked in code: 4 distinct options, exactly one correct, tied to a real fact and section, shuffled so the answer isn't always A. Bad questions are dropped, never guessed.
- **Voice quiz for blind learners.** The question and options are read aloud; after a beep the student says "B", "option two", the answer itself, or a number in Urdu or Pashto. Whisper writes it down and plain code decides which option it was; unclear replies are asked again, never guessed. "Repeat", "skip" and "stop" work too, and keys 1 to 4 always work.
- **Timer that respects access needs.** Off / 15 / 30 / 60 seconds per question, +15 s at any time, starts after the question is read aloud, pauses when the tab is hidden, off by default in voice mode.
- **Weak areas and a study plan, made in plain code.** Results show each section's score, the verified facts you missed, and steps that open the right place: re-read the section at the Simplest level, listen to it, learn its hard words, or watch the exact minute of an attached video that explains it. Progress is kept per lesson.

## Set up for you: personalized learning
- **Two-question setup, never a pop-up.** "Explain hard words in" (اردو / پښتو) and "What helps you learn?" (reading is tiring, large text, screen reader or keyboard, captions, English is a second language; choose any). Each choice changes only what it says, and lives under Display afterwards.
- **Lessons open the way you need, and say why.** "Opened in Listen because you said you use a screen reader." Read Easy opens at the level your last quiz suggested ("Opened at Simplest because your last quiz here was 4 of 10"), only if that version already exists; otherwise a button asks the AI to make it, and Fact Guard checks it. Opening a page never starts an AI call by itself.
- **For you on Home:** Continue where you left off, and Your next step from your last quiz, opening the exact section, word or video minute.
- **A coach note in plain code** compares this attempt with your last one and quotes a fact you missed, word for word. No number is invented.
- **Gender-friendly and private by design:** no name, no gender, no account. The profile is saved under a random code in **Neon Postgres** (and in the browser, so it works offline); "Clear my data" deletes both. Quiz history is per learner, so visitors never see each other's scores.

## Video notes from YouTube
Paste a YouTube link: Roshni reads the video's own captions (no audio download), writes short notes with timestamps, and **Fact Guard checks every note against the captions** (flagged notes are repaired once or dropped). Tap a time to jump the video; captions are searchable; notes download as text. Attached to a lesson, a plain-code check warns when the video doesn't match the page. No captions, private videos, playlists, long videos (notes cover the first hour) and YouTube blocking all give clear messages.

## Fact Guard: why you can trust a rewrite
1. **Independent checker.** Facts are extracted and audited by a model from a *different family* than the rewriter. The code refuses a same-family checker.
2. **Quote or it didn't happen.** A fact is "kept" only if the checker quotes it from the rewrite, and plain code confirms the quote exists *and* shares the fact's content words and numbers.
3. **Both directions.** It checks for missing or changed facts, and for claims the rewrite invented.
4. **Plain-code number check.** Numbers, units, formulas and symbols are compared without AI (`1,000 m` = `1000 metres`, `50 min` ≠ `100 min`).
5. **Repair, then re-check.** Only flagged sentences are rewritten, up to 2 rounds. The badge stays amber and the original sits beside the text if anything is still wrong.
6. **Stress test in the UI.** Plant three errors on purpose (changed number, deleted fact, invented claim) and watch Fact Guard catch and repair them.

## Evidence
All numbers come from scripts in `eval/` and are shown live on the app's **Evidence** page with their dataset and sample size. Synthetic test data is labelled.

<!-- EVIDENCE-TABLE -->
| Metric | Result | What it means | Data | Sample |
|---|---|---|---|---|
| Facts kept after Fact Guard | **99%** | 287 of 291 extracted facts verified with a quote from the final rewrite; 9 of 10 rewrites fully green. | OpenStax textbook pages (CC BY 4.0) (real) | 291 facts, 10 rewrites |
| Planted errors caught by Fact Guard | **28/28** | deleted facts: 10/10; invented claims: 10/10; changed numbers: 8/8. Errors are planted by code, so the right answer is known in advance. | Sabotaged rewrites of OpenStax pages (synthetic errors, real text) (**synthetic**) | 28 planted errors on 5 pages × 2 seeds |
| False alarms on unchanged text | **0.0%** | Each original page was audited against itself. 0 flag(s) were raised across 142 facts where nothing had changed. | OpenStax textbook pages (CC BY 4.0) (real) | 142 facts on 5 pages |
| Reading level lowered | **Grade 11.0 → 6.3** | Easier: grade 11.0 → 6.3, 19 → 8 words per sentence (5 pages); Simplest: grade 11.0 → 6.2, 19 → 7 words per sentence (5 pages) | OpenStax textbook pages (CC BY 4.0) (real) | 10 rewrites of 5 pages |
| Page-reading accuracy | **99.98% correct on hard photos** | Character error rate 0.00% on clean pages and 0.00% on pages degraded like phone photos (tilt, blur, dim light, noise). On deliberately hard photos (6-8° tilt, heavy blur, dim and uneven light, strong JPEG compression) it was 0.02%. Lower is better. Ground truth is the OpenStax source text. | OpenStax pages rendered as images, clean and phone-photo-degraded (real) | 10 page images + 5 hard images |
| Time to make a lesson | **26 s per page** | Reading a phone-style photo took 5 s on average (5 pages); simplifying with Fact Guard took 22 s (2 pages), including waits for free-tier rate limits. Adapting one page by hand for three kinds of learner takes a teacher far longer (measure it on-site with a stopwatch). | Fresh uploads of phone-photo-degraded OpenStax pages (no cache) (real) | 5 reads, 2 simplifications |
| Lecture transcription accuracy | **100.0% of words correct** | Word error rate 0.00% on a 35-second lecture clip with a known script. | Synthetic lecture clip (text-to-speech voice, known script) (**synthetic**) | 1 clip, 79 words |
<!-- /EVIDENCE-TABLE -->

## Run it
```bash
# 1. keys: copy .env.example to .env and add a free Gemini key (aistudio.google.com) and Groq key (console.groq.com)
# 2. backend (Python 3.11+)
cd backend
python -m venv .venv && .venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000
# 3. frontend (Node 20+), in a second terminal
cd frontend && npm install && npm run dev                # http://localhost:5173 (proxies /api to :8000)
#    or build once and let the backend serve it at http://localhost:8000:
npm run build
```
On first start, the backend copies the ready-made sample lessons from `data/samples/` into its cache.

| Task | Command |
|---|---|
| Unit tests | `cd backend && python -m pytest` |
| Check every API key and quota | `python scripts/check_quotas.py` |
| Rebuild sample lessons (backend running) | `python scripts/fetch_openstax.py && python scripts/warm_cache.py && python scripts/export_samples.py` |
| Re-run the evaluation | `python eval/readability_eval.py`, `python eval/factguard_planted_errors.py`, `python eval/ocr_cer.py`, `python eval/asr_wer.py` |
| Offline demo (no AI calls) | set `DEMO_MODE=true` in `.env`; cached samples, quizzes and Fact Guard results still work |
| Deploy | Hugging Face Space (Docker SDK) from the root `Dockerfile`; add the keys as Space secrets |

## Free stack (PKR 0, no card)
Gemini 3.5 Flash with four fallback Gemini models (each has its own free quota) · Groq: Qwen 3.8 27B, GPT-OSS 120B/20B, Whisper large-v3-turbo · edge-tts voices (Urdu, Pashto, English) with gTTS fallback · browser speech synthesis · FastAPI · React + Vite + Tailwind + Motion. Several keys per provider can be listed (`GEMINI_API_KEYS`, `GROQ_API_KEYS`): calls are spread round-robin, a rate-limited key rests while the next one takes over, and an invalid key is switched off. Models whose quota runs out on every key are skipped automatically, results are cached by content hash, and demo mode serves everything from the cache. Details: `docs/APIS_AND_ACCOUNTS.md`.

**Optional paid backup:** if a DeepSeek key is set, DeepSeek V4.1 Flash is tried only after the free models are rate-limited (and for page reading when every free Gemini model is busy). It runs with thinking off, never retries a cut-off answer, and stops at a hard cap (`DEEPSEEK_BUDGET_USD`, default $0.80 of estimated spend) or when the real balance drops below $0.10. Each lesson task costs well under one US cent. Without the key, everything still runs for free.

## Accessibility of the app itself
Keyboard control everywhere (Alt+K play/pause, Alt+N/P sections, Alt+R repeat, Alt+S/F speed). Screen-reader labels and live announcements. A skip link. Dark and high-contrast themes. Adjustable font (Atkinson Hyperlegible, Lexend), size, line, letter and word spacing, plus coloured reading overlays. Status is never shown by colour alone. `lang="ur"`/`lang="ps"` and right-to-left layout for Urdu (Nastaliq) and Pashto (Naskh). All 3D motion stops when the system's "reduce motion" setting is on.

## Rulebook checklist
| Requirement | Where |
|---|---|
| Problem → Data/Input → AI → Solution → Impact | Table above; `docs/PLAN.md` |
| Meaningful AI, not a chatbot | Five AI steps in the pipeline, plus an independent checker |
| Working MVP + deployed link | This repo; root `Dockerfile` |
| Demo PPTX (5 minutes) | `slides/Roshni-AICON26-Demo.pptx`, script in `docs/DEMO.md` |
| Measurable impact | `eval/`, Evidence page |
| Public, synthetic or authorised data only | OpenStax CC BY 4.0; synthetic items labelled |
| Disclosures | `docs/DISCLOSURES.md` |
| Built during the event | Commit history from 9–10 Oct 2026 |

## Project layout
```
roshni/
├── backend/app/          FastAPI: routers/ (lessons, lectures, practice, videos, metrics), services/ (ingest, ocr,
│                         structure, simplify, factguard, normalize, glossary, readability, tts, transcribe,
│                         summarize, quiz, voice, youtube, cache, llm_clients), prompts/ (versioned templates)
├── backend/tests/        unit tests (normalisation, Fact Guard, upload edge cases)
├── frontend/src/         pages/ (Home, Lesson, Lecture, Video, Evidence), modes/ (ReadEasy, Listen, Captions, Videos,
│                         Practice, Original), components/ (Fact Guard, video notes, 3D hero, motion, UI kit),
│                         lib/ (api, speech, voice, settings)
├── data/openstax/        CC BY 4.0 source excerpts and rendered page images (ground truth for eval)
├── data/samples/         ready-made sample lessons (copied into the cache on first start)
├── data/lectures/        synthetic sample lecture clip
├── eval/                 evaluation scripts and results/
├── scripts/              fetch_openstax, warm_cache, export_samples, check_quotas
├── docs/                 PLAN, DEMO, APIS_AND_ACCOUNTS, DISCLOSURES
└── Dockerfile            single container for Hugging Face Spaces
```

## Honest limitations
- Not yet tested with blind, dyslexic or deaf students; the next step is a pilot with a special-education school.
- Printed Urdu and Pashto pages are read but not yet evaluated; English pages are the focus.
- Pashto word explanations are AI-written and haven't been reviewed by a Pashto teacher yet.
- Free-tier limits mean a fresh page can take a minute when the services are busy; samples and demo mode avoid that on stage.
- Readability formulas are a proxy for difficulty, not a measure of comprehension.
- Video notes need the video's captions; YouTube sometimes blocks requests from cloud servers, so the hosted demo uses a prepared sample video.
- Voice answers need a microphone, a secure page (https or localhost) and internet; keys 1 to 4 always work as the fallback.
- The profile follows a learner across visits in the same browser; moving it to another device (a settings code) comes after the hackathon.

Sample content: OpenStax, *Concepts of Biology*, *College Physics 2e*, *Chemistry 2e*, https://openstax.org, licensed under CC BY 4.0. Simplified versions were generated by Roshni.
