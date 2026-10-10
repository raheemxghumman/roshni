# Roshni: Build Plan

**One page. Every learner.**
Roshni turns a printed textbook page or a recorded lecture into an accessible lesson pack for blind, dyslexic and deaf learners, and for weaker readers. A second AI, called **Fact Guard**, checks that the AI-made version did not lose or change any facts.

- Team: 404 Team Not Found
- Domain: EdTech & Workforce
- Event: AICON'26 Build With AI
- Demo: Sunday 11 Oct, 09:49–09:54, SEECS CR-01

> Status: **idea finalised.** This document is the team's single source of truth. If you change the plan, change this file in the same commit.

---

## 1. Product summary

| | |
|---|---|
| **Problem** | Teachers rarely have time to adapt material for each learner who needs it. A blind student can't read the printed page. A dyslexic student, or one from an Urdu-medium school, can read it but can't follow it. A deaf student misses everything said in the lecture. Adapting one page by hand for all of them takes a teacher a long time, so in practice it is never done. |
| **Users** | **Primary:** blind and low-vision, dyslexic, and deaf or hard-of-hearing students, plus weaker readers and Urdu-medium students using English textbooks. **Secondary:** teachers and special-education staff. |
| **Input** | A photo or PDF of a textbook page (English first). Optionally, a short lecture recording. |
| **AI** | Gemini vision reads the page and describes diagrams. Qwen 3.8 (on Groq) rewrites the text at a simpler level and explains hard words in Urdu. A *different* model (Fact Guard) extracts facts and checks them. Whisper transcribes the lecture. |
| **Output** | One lesson pack with three modes: **Read Easy** (dyslexic and weaker readers), **Listen** (blind), **Captions** (deaf). Every AI-made text carries a Fact Guard badge such as "12/12 facts kept". |
| **Impact metrics** | Reading grade lowered (Flesch-Kincaid). Facts kept (%). Planted errors caught by Fact Guard (%). OCR error rate on real pages. Whisper word error rate. Teacher minutes to adapt a page by hand vs seconds in the app. |
| **SDGs** | 4.5 (equal access for persons with disabilities), 4.1, 10.2 |
| **Why the AI is essential** | Reading a printed page, describing a diagram, rewriting while keeping the meaning, transcribing speech and checking facts all need AI. Without it, the product does nothing. |
| **Why not Immersive Reader / Lens / Live Transcribe?** | Those tools change how existing text is *displayed or spoken*, one disability at a time. None of them takes a printed page and **rewrites** it at a lower level, **checks that the facts survived**, **describes the diagrams**, **explains hard words in Urdu**, and produces one lesson pack for three kinds of learner. Our output is clean, structured HTML, so screen readers and Immersive Reader can still be used on top of it. |

---

## 2. Scope (MoSCoW)

**P0, must have (the demo fails without these):**

1. Upload a page photo or PDF → structured lesson (headings, paragraphs, figures with descriptions)
2. **Read Easy mode:** simplified rewrite at 2 levels, side by side with the original
3. **Fact Guard:** extraction by an independent model, check for missing facts, check for added claims, check that numbers and terms are unchanged, a repair loop, and the badge
4. Read-aloud with the current sentence highlighted
5. **Listen mode:** section-by-section audio, diagram descriptions read in place, keyboard navigation
6. **Captions mode:** upload a lecture clip → timestamped transcript + a summary checked by Fact Guard
7. Cache + demo mode (works with no internet once the cache is warmed)
8. Deployed URL + repo + README

**P1, should have (adds points):**

9. Hard-word glossary: simple English + **Urdu** explanation, with terms kept in English
10. Urdu audio of the glossary and summary (edge-tts)
11. Metrics panel showing the evaluation results (labelled with dataset and date)
12. Adaptive quiz (3–5 questions from Fact Guard facts) that moves the reading level up or down
13. Display options: dyslexia-friendly font, letter and line spacing, colour overlay, text size

**P2, roadmap slide only (do not build):** sign language, live captions (point to Live Transcribe), printed Urdu (Nastaliq) pages, handwritten notes, teacher dashboard across real classes, offline mobile app, Braille export.

**Cut order if time runs short:** 13 → 12 → 10 → 11 → 9. Never cut anything from P0.

---

## 3. Demo user story

*Ms. Ayesha photographs one Grade-8 science page (OpenStax) and uploads a 2-minute clip of her explaining it.*

- **Bilal (blind)** presses Tab and Enter and hears the page section by section, including "Figure 2: a diagram showing…".
- **Sara (dyslexic, from an Urdu-medium school)** opens Read Easy: shorter sentences, hard words explained in Urdu, the current sentence highlighted as it's read aloud, and "12/12 facts kept ✔".
- **Hamza (deaf)** reads the captioned transcript and a checked summary of the lecture.

---

## 4. Architecture and stack

```
[Browser: React + Vite + Tailwind]
   │  upload page / lecture, choose mode, play audio (Web Speech API for English highlighting)
   ▼
[FastAPI backend on Hugging Face Spaces (Docker)]
   ingest → ocr → structure → simplify → factguard → glossary → tts
                                   ▲            │
                       transcribe → summarize ──┘ (Fact Guard on the summary too)
   cache (sha256 → JSON/MP3 on disk)      metrics (eval/results/*.json)
   │
   ├─ Gemini 3.5 Flash + 4 fallbacks (free) : page reading + diagram descriptions
   ├─ Groq Qwen 3.8 27B (free)  : rewrite, glossary, summary, quiz
   ├─ Groq GPT-OSS 120B (free)  : Fact Guard (a different model family from the rewriter)
   ├─ Groq Whisper (free)       : lecture transcript
   └─ edge-tts → gTTS → browser : audio
```

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite + Tailwind, deployed on Vercel | Fast to build; accessible components are easy |
| Backend | Python 3.11 + FastAPI, on Hugging Face Spaces (Docker, port 7860) | Free, no card needed; Python has the best AI SDKs |
| Storage | Files on disk + SQLite (optional) | Nothing to set up; the cache doubles as demo mode |
| Fonts | Atkinson Hyperlegible, Lexend, OpenDyslexic (optional), Noto Nastaliq Urdu | Proven readability fonts, all free |
| Evaluation | jiwer, textstat, wordfreq | Free and standard |

Model IDs live in `.env`, so changing a model doesn't need a code change (see `docs/APIS_AND_ACCOUNTS.md`).

---

## 5. Pipelines in detail

### 5.1 Ingest (`services/ingest.py`)

1. Check the file's real type from its magic bytes. Accepted: JPEG, PNG, WEBP, HEIC (convert with pillow-heif), PDF. Maximum 10 MB.
2. Images: apply the EXIF rotation, convert to RGB, resize so the longest side is 1600 px, save as JPEG at quality 85.
3. PDF: if it has a text layer (pypdf extracts more than 200 characters), **use that text and skip OCR**. Keep the page image only to find figures. Maximum 3 pages for the MVP; reject more with a clear message.
4. `hash = sha256(file bytes + options + PROMPT_VERSION)`. If the hash is already in the cache, return the cached result immediately.

### 5.2 Read the page and build its structure (`ocr.py`, `structure.py`)

- **One Gemini call** returns JSON blocks: `heading | paragraph | list | table | figure | equation | caption`, in reading order, with a confidence flag. Text the model can't read is written as `[unclear]`, never guessed.
- **Figures:** the same call adds a 1–3 sentence description written for a blind student (what it shows, labels, relationships). No guessing beyond what is visible.
- **Clean-up rules:** remove running headers, page numbers and footers. Join words hyphenated across lines. Keep equations as plain text and as LaTeX.
- **Language check:** if most of the text is Urdu script, label it `language=ur` and show "Urdu pages are in beta" (P2).

### 5.3 Simplify (`simplify.py`)

- Rewrite **section by section**, never the whole page in one call. This avoids cut-off responses and keeps Fact Guard checks local.
- Two levels:
  - **Easier:** about grade 6–7, average sentence 14 words or fewer
  - **Simplest:** about grade 4–5, 10 words or fewer
- **Protected tokens are never changed:** numbers with units, formulas, chemical symbols, proper nouns and key terms. They are extracted with regex before the rewrite and passed to the prompt as a list.
- After rewriting, measure readability with textstat. If it misses the target, retry once with "shorter sentences".

### 5.4 Fact Guard (`factguard.py`), the centrepiece
**Independence rule:** facts are extracted and checked by **a different model from the one that rewrote the text.** By default the rewriter is Qwen 3.8 (Groq) and the checker is GPT-OSS 120B. If the rewrite falls back to Gemini, the checker is still GPT-OSS; the code refuses any checker from the rewriter's model family.

1. **Extract facts** from the original section as an atomic list: `{id, text, source_block_id, protected_tokens[]}`.
2. **Coverage check:** every original sentence that contains a number, term or verb claim must link to at least one fact. If one doesn't, ask the extractor again for just that sentence.
3. **Omission check (fact → rewrite):** for each fact, decide `kept | missing | changed`, with an evidence quote from the rewrite. A verdict without a quote is treated as `missing`.
4. **Addition check (rewrite → original):** list every claim in the rewrite and confirm each is supported by the original. Unsupported claims are flagged as `added`.
5. **Deterministic protected-token check:** using `normalize.py`, every protected token in the original must appear in the rewrite. Examples: `1,000` = `1000`; `m/s` = `metres per second`; superscripts are normalised.
6. **Repair:** send only the missing, changed or added items back to the rewriter. Run checks 3–5 again. **Maximum 2 repair rounds.**
7. **Result:** a badge reading `kept/total`. Green only when everything is kept, there are no additions and all tokens are present; amber otherwise. When amber, show the affected original sentence next to the rewrite. **Never show green when something failed.**
8. Log every round, so the demo can show the red-to-repaired-to-green moment.

### 5.5 Glossary with Urdu (`glossary.py`), P1

- **Choose candidate words without AI:** words with a wordfreq Zipf score below 3.5, plus textstat's difficult words, minus stop words. At most 8 per section.
- **AI writes:** a simple English definition (12 words or fewer), a short Urdu explanation, and an example. **The term itself stays in English** (for example "photosynthesis").
- The Urdu is displayed in Noto Nastaliq Urdu with `dir="rtl"`. Audio comes from edge-tts (`ur-PK-UzmaNeural`).

### 5.6 Read-aloud and audio (`tts.py` + frontend)

- **English with highlighting:** use the browser's speech synthesis with **one utterance per sentence**, highlighting on each sentence's `onstart`. This avoids Chrome's missing word-boundary events and its bug where long utterances stop after about 15 seconds. Wait for `voiceschanged` before choosing a voice.
- **Urdu, and English when the browser has no voice:** edge-tts on the server, one MP3 per sentence, cached. If edge-tts fails, use gTTS; if that fails, use the browser voice.
- **Controls:** play/pause, previous/next sentence, speed (0.75×, 1×, 1.25×), repeat.

### 5.7 Listen mode for blind learners (frontend)

- Semantic HTML (`<main>`, `<h1>`–`<h3>`, `<figure>` + `<figcaption>`), a "skip to lesson" link, and an ARIA live region for status messages.
- **Keyboard first.** Every action is also a visible button. Single-key shortcuts only work when "Shortcut mode" is switched on, because screen readers capture letter keys.
  - `Alt+N` / `Alt+P`: next / previous section
  - `Alt+D`: describe the figure
  - `Space`: play or pause
  - `Alt+R`: repeat
  - `Alt+S`: slower
- Test with **NVDA** (free, Windows) and **VoiceOver** (Mac/iPad) before the code freeze.

### 5.8 Captions mode for deaf learners (`transcribe.py`, `summarize.py`)

- **Upload:** mp3, m4a, wav or webm, up to 25 MB (VERIFY Groq's free limit), ideally 5 minutes or less. The user can choose the language (auto, English, Urdu) because automatic detection can go wrong on mixed speech.
- **Whisper** returns timestamped segments. The transcript is clickable and shows timestamps.
- **Summary:** 5 bullets plus key terms. Fact Guard checks it **against the transcript**.
- **Too large:** if the file is over the limit, split it into 10-minute chunks with pydub/ffmpeg (P1), or ask the user to trim it.

### 5.9 Adaptive quiz (`quiz.py`), P1

- 3–5 questions generated **from Fact Guard facts only**, so every answer is traceable to the page. Mix multiple-choice and true/false.
- 80% or more correct → move up one level. Below 50% → move down one level and suggest Listen mode.

---

## 6. Data contract (`backend/app/schemas.py`)

```json
{
  "id": "sha256…",
  "source": {"type": "image|pdf", "filename": "p12.jpg", "pages": 1, "text_layer": false},
  "language": "en",
  "sections": [{
    "id": "s1", "heading": "Photosynthesis", "level": 2,
    "blocks": [
      {"id": "b1", "type": "paragraph", "text": "…", "unclear": false},
      {"id": "b2", "type": "figure", "caption": "Figure 2", "description": "A diagram showing…"}
    ]
  }],
  "simplified": {
    "easier":   {"sections": [{"id": "s1", "text": "…"}], "readability": {"before": 10.4, "after": 6.8}},
    "simplest": {"sections": [], "readability": {}}
  },
  "factguard": {
    "easier": {
      "total": 12, "kept": 12, "status": "green|amber",
      "facts": [{"id": "f1", "text": "…", "source_block_id": "b1", "status": "kept|missing|changed", "evidence": "…"}],
      "added_claims": [], "missing_tokens": [], "repair_rounds": 1,
      "checker_model": "openai/gpt-oss-120b", "rewriter_model": "qwen/qwen3.8-27b"
    }
  },
  "glossary": [{"term": "chlorophyll", "simple_en": "…", "urdu": "…", "section_id": "s1"}],
  "lecture": {"segments": [{"start": 0.0, "end": 4.2, "text": "…"}], "summary": ["…"], "factguard": {}},
  "warnings": ["Low light: some words marked unclear"],
  "meta": {"prompt_version": "v1", "created_at": "…", "from_cache": true}
}
```

---

## 7. API endpoints

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/health` | — | `{ok, demo_mode, models}` |
| POST | `/api/lessons` | multipart `file`, `language?` | Lesson (sections + warnings) |
| GET | `/api/lessons/{id}` | — | Full Lesson |
| POST | `/api/lessons/{id}/simplify` | `{level: "easier"/"simplest"}` | Simplified text + Fact Guard report |
| POST | `/api/lessons/{id}/glossary` | — | Glossary list |
| POST | `/api/lessons/{id}/audio` | `{section_id, lang, text_source}` | `{sentences: [{text, url}]}` |
| POST | `/api/lectures` | multipart `file`, `language?` | Segments + summary + Fact Guard |
| POST | `/api/lessons/{id}/quiz` | `{level}` | Questions |
| POST | `/api/quiz/{quiz_id}/answers` | `{answers}` | Score + new level |
| GET | `/api/metrics` | — | Evaluation results |

**Errors** always look like `{error: {code, message_for_user, retryable}}`. Codes:

- `UNSUPPORTED_FILE`
- `FILE_TOO_LARGE`
- `NO_TEXT_FOUND`
- `RATE_LIMITED`
- `MODEL_UNAVAILABLE`
- `TIMEOUT`

---

## 8. Frontend screens

| Screen | Contents |
|---|---|
| **Home** | Upload a page (drag and drop, or a file input with `capture="environment"` on phones), upload a lecture, "Try a sample lesson" (from the cache), and a demo-mode indicator |
| **Lesson** | Mode tabs: **Read Easy / Listen / Captions / Original**. The Read Easy view is two columns side by side (one column on phones), with the Fact Guard badge, the glossary and audio controls |
| **Fact Guard panel** | List of facts with ✔/✖ icons **and text** (never colour alone), evidence quotes, repair rounds and the models used |
| **Display settings** | Font, size, letter and line spacing, overlay colour, dark/light theme. Saved in localStorage |
| **Metrics** | Evaluation numbers with their datasets, each labelled as an evaluation result |

**Accessibility rules:**

- Text contrast of at least 4.5:1, visible focus states, and every control reachable by keyboard
- `prefers-reduced-motion` is respected, no information is shown by colour alone, and all images have alt text
- The page language is set (`lang="en"`, `lang="ur"` on Urdu blocks)

---

## 9. Edge cases and how each is handled

### Input
| Case | Handling |
|---|---|
| Blurry, dark, glare, skewed photo | Resize and rotate on ingest. The OCR prompt marks `[unclear]`. Show "Retake: low light" if more than 10% is unclear. Always show the original image beside the result. |
| Rotated or upside-down photo | EXIF rotation, plus a prompt instruction to read in the correct orientation |
| Two-page spread | Read in column order; show a warning: "two pages detected, processed left then right" |
| Partial page or cut-off text | Mark cut sentences `[unclear]`; don't complete them |
| Only a diagram, no text | Produce only the figure description; skip Fact Guard and show "no text facts" |
| Handwritten notes on a printed page | Prompt: ignore handwriting unless asked. P2: handwriting support |
| HEIC (iPhone) | Convert with pillow-heif |
| File too large or too many PDF pages | Reject with `FILE_TOO_LARGE` and say how to fix it |
| Empty, corrupt or wrong-type file | Check magic bytes, then `UNSUPPORTED_FILE` |
| PDF with a text layer | Use the text directly (no OCR, no quota used) |
| Scanned PDF | Turn the pages into images, then OCR |
| Urdu-script page | Detect it; show "beta"; still try OCR, but don't promise accuracy |
| Tables | Keep them as tables. In Listen mode, read them row by row as "Row 1: …" |
| Equations and chemistry | Keep them as protected tokens. In Listen mode, read them in words ("H 2 O") |
| Footnotes, headers, page numbers | Remove them in the structure step |
| Prompt injection printed on the page ("ignore instructions…") | Treat page text as data inside delimiters, validate the JSON output, and never execute instructions from content |

### AI output
| Case | Handling |
|---|---|
| Invalid JSON or schema mismatch | JSON mode + pydantic validation; retry once with the validation error; then fall back to the next model |
| OCR invents text (hallucination) | Show the original image side by side. With a PDF text layer, prefer the text. Evaluation: error rate against the OpenStax digital text |
| Rewrite drops, changes or adds a fact | Fact Guard: omission + addition + token checks, with up to 2 repairs, then amber with the sentences shown side by side |
| Fact extraction misses a fact | Coverage check (every claim sentence links to a fact) plus the deterministic token check |
| Rewrite not simpler | Readability check, one retry, then show the measured grade honestly |
| Different number formats or units | `normalize.py`: commas, decimals, unit synonyms, superscripts, "per" vs "/" |
| Model refuses or returns nothing | Retry with a neutral prompt, then the fallback model, then a clear error |
| Response cut off (long section) | Process by section with a maximum chunk size; never send a whole page in one call |
| Wrong Urdu explanation | Keep explanations to one or two lines with the English term, labelled "AI explanation"; the teacher can flag one |
| Mixed Urdu-English lecture | Let the user choose the language; Whisper's auto-detect is the default; show the word error rate honestly |

### Network, quota and hosting
| Case | Handling |
|---|---|
| Gemini 429 or quota used up | Backoff (1 s, 2 s, 4 s), then Tesseract (English print) fallback, then a cached result if available |
| Groq 429 | If Groq asks to wait more than 8 s, switch to the next model (Gemini list) instead of waiting. Gemini models whose daily quota is spent are skipped for an hour. Fact Guard must never run on the same model as the rewriter. If no independent model is available, Fact Guard shows "unavailable", not green. |
| edge-tts down | gTTS, then the browser voice |
| Venue Wi-Fi fails | Phone hotspot. **Demo mode** serves cached lesson packs with no API calls. The backend can also run on the laptop. |
| Hugging Face Space asleep | Open it 10 minutes before the slot; `/api/health` is used as a keep-alive |
| CORS errors | Allow-list the Vercel domain and localhost in FastAPI |
| Slow responses | Show progress per step ("Reading page… Rewriting… Checking facts…"); time out each call at 45 seconds |
| A team member's key is leaked or disabled | Keys only in `.env` and Space secrets, never committed; each member has their own key to switch to |

### Audio and browser
| Case | Handling |
|---|---|
| `getVoices()` empty on first load | Wait for the `voiceschanged` event |
| No word-boundary events (Chrome online voices) | Highlight by sentence (one utterance per sentence) |
| Chrome stops long utterances after ~15 seconds | One utterance per sentence |
| Autoplay blocked | Start audio only from a button press |
| Safari or iPad differences | Test once on Safari; server MP3 fallback |
| Screen reader captures letter keys | Shortcut mode toggle, Alt-based shortcuts, every action also a button |

### Rules, data and ethics
| Case | Handling |
|---|---|
| Copyrighted textbooks | Use only OpenStax (CC BY 4.0) in the repo, with attribution. Photograph other books only for live demos; don't store them |
| Simulated data | Every simulated item is labelled "simulated" in the UI, README and slides |
| Personal data | None collected. Uploaded files are cached by hash only; a "Delete my lesson" button is provided |
| Free-tier data use | Never upload private documents; the README says so |
| Overclaiming | Present it as an assistive tool, not a medical or diagnostic one; no tests with real disabled users have been done yet, and we say so |

---

## 10. Fallback order (in `llm_clients.py`)

| Task | 1st | 2nd | 3rd | Last resort |
|---|---|---|---|---|
| Read page | Gemini 3.5 Flash | Gemini Flash latest / 3 Flash preview / 3.1 Flash Lite / 2.5 Flash | PDF text layer (skips OCR) | Cached result |
| Rewrite / glossary / summary / quiz | Groq Qwen 3.8 27B | Gemini 3.5 Flash | Gemini Flash latest | Gemini 3 Flash preview |
| Fact Guard | Groq GPT-OSS 120B | Gemini 3.5 Flash (only if the rewriter wasn't Gemini) | Groq GPT-OSS 20B | Show "unavailable" |
| Speech to text | Groq Whisper large-v3-turbo | Groq Whisper large-v3 | faster-whisper locally | Cached result |
| Text to speech | edge-tts | gTTS | Browser voice | — |

---

## 11. Evaluation (`eval/`): real numbers for the slides

| Metric | Dataset | Method | Target |
|---|---|---|---|
| OCR character error rate | 10 printed and photographed OpenStax pages | jiwer CER vs OpenStax digital text (real ground truth) | under 3% |
| Reading grade reduction | 30 OpenStax sections | textstat Flesch-Kincaid grade before and after | about 2–4 grades lower |
| Facts kept | Same 30 sections | Share of facts with status `kept` after repair | 95% or more |
| **Planted-error recall** | 30 rewrites, each sabotaged with 1 dropped fact, 1 changed number or 1 added claim | Share caught by Fact Guard. **This is the key non-circular test.** | 85% or more |
| Fact Guard false alarms | 30 clean rewrites | Share wrongly flagged | 10% or less |
| Whisper word error rate | 5 lecture clips (team recordings, hand-transcribed) | jiwer WER | Report honestly |
| Teacher time | 1 page adapted by hand by a team member (timed) | Stopwatch vs the app | e.g. 25 minutes vs under 1 minute |

Results are saved to `eval/results/*.json`, shown in the Metrics panel, and put on one slide, with the dataset and date given for each number.

---

## 12. Team split and timeline

Roles (rename these to people):

- **A, AI pipeline:** OCR, simplify, Fact Guard, glossary, quiz, prompts
- **B, backend and data:** ingest, API, cache, TTS, Whisper, evaluation scripts, deployment
- **C, frontend and pitch:** UI, accessibility, demo mode, slides, journey video, presenter

| Block | A | B | C | Checkpoint |
|---|---|---|---|---|
| **Now → +1 h** (setup) | Get keys (Gemini, Groq); test one OCR call on a photographed OpenStax page | Create the repo; FastAPI + `/api/health`; `.env`; deploy a hello-world Space | Vite + React + Tailwind scaffold; deploy hello-world to Vercel; choose 10 OpenStax pages and print 3 | Repo live, both deploys work, keys tested |
| **Until 1:30 PM** (on-site) | `ocr.py` + `structure.py` → Lesson JSON | `ingest.py`, `/api/lessons`, `cache.py` | Upload → Lesson screen (Original + read-aloud with sentence highlighting) | **CP1: photo → structured lesson → read aloud, on localhost** |
| **2–6 PM** | `simplify.py`, `factguard.py`, `normalize.py` + tests | `tts.py`, `transcribe.py`, `summarize.py`, `/api/lectures`, fallbacks | Read Easy view + Fact Guard panel; Listen mode keyboard navigation; Captions view | **CP2 (6 PM): all 3 modes + Fact Guard on the deployed URL** |
| **6–9 PM** | `glossary.py` (Urdu), `quiz.py` | Evaluation scripts → results; `warm_cache.py`; `check_quotas.py`; edge-case tests | Display settings, metrics panel, NVDA test; slides; 2-minute backup screen recording | **9 PM: FEATURE FREEZE** |
| **9 PM → submission** | README "How the AI works" section | Final deploy; private-window and phone test; access for organisers | Slides final; journey video edit | **Submitted at least 1 hour before the deadline** |

**Rules:**

- **Commit at least every hour,** with clear messages. The history is your proof the work was done during the event.
- If you're stuck for 30 minutes, ask a teammate.
- At each checkpoint, if a P0 item isn't working, everyone helps fix it before starting new work.

---

## 13. Git workflow

- `main` must always deploy. Each person works on a short branch (`a/factguard`, `b/tts`, `c/listen-mode`), with small pull requests that get a quick review from one other member.
- **Never commit:** `.env`, `data/raw/`, `data/lectures/`, `journey/`, or copyrighted pages.
- Tag `v1-submission` at the moment of submission.

---

## 14. Test checklist (before the 9 PM freeze)

- [ ] 3 real photos (good, dark, angled), 1 digital PDF and 1 scanned PDF all process correctly
- [ ] An empty file, a `.docx` and a 20 MB image are rejected with clear messages
- [ ] Fact Guard planted-error test passes (at least 85% caught); the badge is never green when a fact is missing
- [ ] Every mode works by keyboard only; tested with NVDA; contrast checked
- [ ] Read-aloud highlights each sentence in Chrome and Edge; works on Safari/iPad
- [ ] Lecture clip: transcript, summary and Fact Guard all work
- [ ] Demo mode works with Wi-Fi off (cache warmed)
- [ ] Deployed URL works in a private window and on a phone
- [ ] `check_quotas.py` shows all APIs OK

---

## 15. Deployment

- **Backend:** a Hugging Face Space (Docker SDK) built from `backend/Dockerfile`, port 7860. Put the keys in **Space settings → Secrets**, not in the repo.
- **Frontend:** Vercel, importing the GitHub repo with root `frontend/`. Set `VITE_API_BASE_URL` to the Space URL.
- **Local fallback for the demo:** `uvicorn app.main:app --port 8000` + `npm run dev`, with `DEMO_MODE=true`.

---

## 16. The 5-minute demo (09:49, CR-01)

| Time | Beat |
|---|---|
| 0:00–0:30 | Problem: "One page. Three students who can't use it." Show the printed page. Say the SDG 4.5 target. |
| 0:30–1:30 | **Live:** photograph the page and upload it. Show the structured lesson. **Listen mode:** a Tab press reads the heading, then the diagram description. |
| 1:30–2:45 | **Read Easy:** side by side, read-aloud highlighting, Urdu glossary. **Fact Guard moment:** show the log where the first rewrite dropped a number (red), the repair, then "12/12 facts kept ✔" (green). |
| 2:45–3:30 | **Captions:** a 20-second lecture clip becomes a transcript and a checked summary. |
| 3:30–4:20 | Evidence slide: OCR error rate, grade reduction, planted-error recall, false alarm rate, teacher minutes vs seconds. Show the free stack and fallbacks. |
| 4:20–5:00 | Impact and adoption: special-education schools, NGOs, textbook boards, school chains (and Urdu-medium students as the bigger market). What we built during AICON'26. Close. |

**Backup:** the screen recording is already open in a tab, and demo mode is on. If anything is slow for more than 5 seconds, switch to the cached sample immediately.

---

## 17. Slides (PPTX, 7 slides)

1. Title + one-line pitch + team
2. Problem (three learners, one page) + a sourced statistic (VERIFY before using)
3. How it works (pipeline diagram, AI stages highlighted)
4. Fact Guard (why it matters, and how it works)
5. Results (evaluation numbers with datasets)
6. Impact and adoption + SDGs + "why not existing tools"
7. What we built during AICON'26, disclosures, and the roadmap (P2 items)

---

## 18. Submission checklist

- [ ] Repo link (public, or the organisers given access); README covers the problem, how to run it, how the AI works, evaluation results, data and licences, disclosures, and what was built during the event
- [ ] Deployed link works in a private window; any test instructions are in the README
- [ ] Demo presentation (PPTX) uploaded
- [ ] Optional: screen recording, and the Document Your Journey video (3 minutes max)
- [ ] `docs/DISCLOSURES.md` complete
- [ ] Simulated or self-made data labelled everywhere

---

## 19. Judge questions to rehearse

- **"Why not Immersive Reader?"** → It displays or speaks existing text. We rewrite printed pages, check the facts, describe diagrams, explain in Urdu, and serve three kinds of learner from one upload. Our output also works with those tools.
- **"How do you know the simplification is correct?"** → Fact Guard uses an independent model, checks in both directions, checks numbers and terms with plain code, and in the planted-error test caught X%.
- **"Have blind or deaf users tested it?"** → Not yet, and we say so. We followed WCAG and tested with NVDA. The next step is a pilot with a special-education school.
- **"What happens when the free tier runs out?"** → Fallback chain, cache and demo mode. Running cost today is PKR 0.
- **"What did you build during the event?"** → Everything in the repo; the commit history shows it. Pre-existing items are listed in `DISCLOSURES.md`.
- **"Why is the AI essential?"** → Reading printed pages, describing images, rewriting while keeping meaning, transcribing and checking facts are all AI tasks. Without the AI, nothing works.

---

## 20. Risk register
| Risk | Chance | Impact | Mitigation | Owner |
|---|---|---|---|---|
| Free quota runs out during development | Medium | High | Separate keys for each person, the cache, the fallback chain | B |
| Fact Guard flags too much or too little | Medium | High | Planted-error and clean-rewrite tests; tune the prompts | A |
| Read-aloud highlighting breaks in a browser | Medium | Medium | Sentence-level utterances; server MP3 fallback | C |
| Scope creep | High | High | MoSCoW list; freeze at 9 PM | Everyone |
| Venue internet or projector fails | Medium | High | Hotspot, demo mode, local backend, HDMI adapter, backup video | C |
| Hugging Face Space build fails | Low | Medium | Run locally for the demo; Render as a second host | B |

---

## 21. Sunday morning checklist

- [ ] Laptop charged, charger, HDMI or USB-C adapter, a small speaker for audio, phone hotspot on
- [ ] Before 9:00: run `check_quotas.py` and `warm_cache.py`, open the Space (wake it), open all tabs
- [ ] Printed page and a phone ready for the live photo; the lecture clip saved locally
- [ ] At CR-01 by 9:35 (the slot is 09:49; they wait only 2 minutes)
- [ ] One presenter, one person driving the laptop, one ready to answer the AI questions
