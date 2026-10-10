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
| **AI** | Gemini reads the page and describes every diagram. Qwen rewrites it at an easier level and explains hard words in Urdu. **Fact Guard**, GPT-OSS from a different model family, extracts every fact and audits the rewrite. Whisper transcribes the lecture. |
| **Solution** | One lesson in three modes: **Read Easy** (simpler text, Urdu help, read-aloud with highlighting, adaptive quiz), **Listen** (section-by-section audio with figure descriptions, full keyboard and screen-reader control), **Captions** (transcript synced to audio plus a summary checked against the lecture). |
| **Impact** | Reading level drops by several grades, nearly every fact is verifiably kept, planted errors are caught, and a page is ready in about a minute instead of hours of manual adaptation. See **Evidence** below. SDG 4.5 (equal access for persons with disabilities), 4.1, 10.2. |

## Why the AI is essential
Reading a printed page, describing a diagram for a blind student, rewriting while keeping meaning, explaining in Urdu, transcribing speech and checking facts are all AI tasks. Remove the AI and the product does nothing.

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
Gemini 3.5 Flash with four fallback Gemini models (each has its own free quota) · Groq: Qwen 3.8 27B, GPT-OSS 120B/20B, Whisper large-v3-turbo · edge-tts and gTTS voices · browser speech synthesis · FastAPI · React + Vite + Tailwind + Motion. Models whose quota runs out are skipped automatically, results are cached by content hash, and demo mode serves everything from the cache. Details: `docs/APIS_AND_ACCOUNTS.md`.

## Accessibility of the app itself
Keyboard control everywhere (Alt+K play/pause, Alt+N/P sections, Alt+R repeat, Alt+S/F speed). Screen-reader labels and live announcements. A skip link. Dark and high-contrast themes. Adjustable font (Atkinson Hyperlegible, Lexend), size, line, letter and word spacing, plus coloured reading overlays. Status is never shown by colour alone. `lang="ur"` and right-to-left layout for Urdu. All 3D motion stops when the system's "reduce motion" setting is on.

## Rulebook checklist
| Requirement | Where |
|---|---|
| Problem → Data/Input → AI → Solution → Impact | Table above; `docs/PLAN.md` |
| Meaningful AI, not a chatbot | Five AI steps in the pipeline, plus an independent checker |
| Working MVP + deployed link | This repo; root `Dockerfile` |
| Measurable impact | `eval/`, Evidence page |
| Public, synthetic or authorised data only | OpenStax CC BY 4.0; synthetic items labelled |
| Disclosures | `docs/DISCLOSURES.md` |
| Built during the event | Commit history from 9–10 Oct 2026 |

## Project layout
```
roshni/
├── backend/app/          FastAPI: routers/ (lessons, lectures, metrics), services/ (ingest, ocr, structure,
│                         simplify, factguard, normalize, glossary, readability, tts, transcribe, summarize,
│                         quiz, cache, llm_clients), prompts/ (versioned templates)
├── backend/tests/        unit tests (normalisation, Fact Guard, upload edge cases)
├── frontend/src/         pages/ (Home, Lesson, Lecture, Evidence), modes/ (ReadEasy, Listen, Captions,
│                         Original), components/ (Fact Guard, 3D hero, motion, UI kit), lib/ (api, speech, settings)
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
- Printed Urdu (Nastaliq) pages are read but not yet evaluated; English pages are the focus.
- Free-tier limits mean a fresh page can take a minute when the services are busy; samples and demo mode avoid that on stage.
- Readability formulas are a proxy for difficulty, not a measure of comprehension.

Sample content: OpenStax, *Concepts of Biology*, *College Physics 2e*, *Chemistry 2e*, https://openstax.org, licensed under CC BY 4.0. Simplified versions were generated by Roshni.
