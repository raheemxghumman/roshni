# APIs and Accounts

Every service is **free** and needs **no credit card**. Free-tier limits change often, so treat the numbers below as approximate and **check them in each console today**. Anything marked **VERIFY** is unconfirmed.

---

## 1. Summary: what each person must create

| Account | Member A | Member B | Member C | Why |
|---|---|---|---|---|
| Google account → **Google AI Studio** API key | ✅ | ✅ | ✅ | Each key has its own free quota, so three keys give three times the development quota |
| **Groq** account → API key | ✅ | ✅ | ✅ | Same reason. Groq limits are per organisation, so each person needs their own account |
| **GitHub** account | ✅ | ✅ | ✅ | Required for submission; everyone commits |
| **Hugging Face** account | — | ✅ (owner) | optional | Hosts the backend (Space) |
| **Vercel** account (sign in with GitHub) | — | — | ✅ (owner) | Hosts the frontend |

**Team-level resources:**

- one GitHub repo (owner: A, with B and C as collaborators)
- one Hugging Face Space (owner: B)
- one Vercel project (owner: C)

---

## 2. The APIs we call

### 2.1 Google Gemini API (via Google AI Studio)
| | |
|---|---|
| **Used for** | Reading the page (OCR + structure) and describing diagrams. **Vision only**, to save quota. Also the second fallback for text tasks |
| **Get a key** | https://aistudio.google.com → sign in with Google → **Get API key** → Create API key |
| **Models** | `gemini-3.5-flash` (primary), then `gemini-flash-latest`, `gemini-3-flash-preview`, `gemini-3.1-flash-lite`, `gemini-2.5-flash` (each has its own free daily quota; listed in `GEMINI_FALLBACK_MODEL`) |
| **Free limits** | Small. Roughly 5–15 requests per minute and a limited number per day per project (VERIFY in AI Studio → Usage/Rate limits) |
| **SDK** | `pip install google-genai` |
| **Env vars** | `GEMINI_API_KEY`, `GEMINI_MODEL` |
| **Test the key** | `curl "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY"` → should list models |
| **Data note** | Free-tier inputs may be used to improve Google's products. Send only OpenStax or self-made content, never private documents |

### 2.2 Groq API
| | |
|---|---|
| **Used for** | Rewrite, glossary, summary and quiz (Qwen 3.8 27B). **Fact Guard** (GPT-OSS 120B, a different model family). Lecture transcripts (Whisper) |
| **Get a key** | https://console.groq.com → sign up → **API Keys** → Create |
| **Models** (VERIFY in console → Models) | `qwen/qwen3.8-27b` (rewriter), `openai/gpt-oss-120b` (Fact Guard), `openai/gpt-oss-20b` (last-resort checker). Groq retired its Llama models in 2026, `whisper-large-v3-turbo` and `whisper-large-v3` (speech to text) |
| **Free limits** (approximate) | About 30 requests/min for chat models. About 1,000 requests/day for 70B. About 14,400/day for 8B. About 2,000 audio requests/day for Whisper. Audio file size limit about 25 MB (VERIFY) |
| **SDK** | `pip install groq` (OpenAI-compatible) |
| **Env vars** | `GROQ_API_KEY`, `GROQ_REWRITE_MODEL`, `GROQ_FACTGUARD_MODEL`, `GROQ_FALLBACK_MODEL`, `GROQ_STT_MODEL` |
| **Test the key** | `curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer $GROQ_API_KEY"` |

### 2.3 edge-tts (Microsoft Edge read-aloud voices)
| | |
|---|---|
| **Used for** | Urdu audio (glossary, summary) and English audio when the browser has no voice |
| **Account / key** | **None.** It's an unofficial open-source client that needs internet. It could stop working without notice, which is why it has fallbacks |
| **Install** | `pip install edge-tts` · list voices: `edge-tts --list-voices` |
| **Voices** | `ur-PK-UzmaNeural`, `ur-PK-AsadNeural`, `ps-AF-LatifaNeural`, `ps-AF-GulNawazNeural` (Pashto; gTTS has no Pashto fallback), `en-US-AriaNeural`, `en-GB-SoniaNeural` (VERIFY with `--list-voices`) |
| **Env vars** | `TTS_URDU_VOICE`, `TTS_ENGLISH_VOICE` |
| **Fallbacks** | `gTTS` (no key; `pip install gTTS`) → the browser's own speech synthesis |

### 2.4 Browser Web Speech API (speech synthesis)
| | |
|---|---|
| **Used for** | English read-aloud with the current sentence highlighted, entirely in the browser |
| **Account / key** | None. Built into Chrome, Edge and Safari |
| **Notes** | Wait for the `voiceschanged` event. Use one utterance per sentence (see PLAN §5.6) |

---

## 3. Hosting and tooling accounts

### 3.1 GitHub (required for submission)

- Create the repo `roshni` (public, or give the organisers access).
- Add all members as collaborators. Protect `main` (optional).
- Every commit must come from a registered team member, since the rulebook allows only registered members to contribute.

### 3.2 Hugging Face (backend hosting)

- https://huggingface.co → sign up → **New Space** → SDK: **Docker** → hardware: **CPU basic (free)**.
- **Settings → Variables and secrets:** add every key from `.env.example` as a **Secret**.
- Push the backend folder to the Space's git remote using an access token (Settings → Access Tokens → *write*).
- The app listens on **port 7860**. Free Spaces sleep when idle, so open the URL 10 minutes before the demo.
- Backup host if the build fails: Render (free web service; VERIFY that no card is needed) or run locally.

### 3.3 Vercel (frontend hosting)

- https://vercel.com → sign in with GitHub → **Import** the repo → Root directory: `frontend` → framework: Vite.
- Environment variable: `VITE_API_BASE_URL` = the Space URL (e.g. `https://<user>-roshni.hf.space`).
- The free Hobby plan is enough.

---

## 4. Optional local tools (no accounts)
| Tool | Used for | Install |
|---|---|---|
| **Tesseract OCR** | English print OCR fallback | Windows installer from the UB-Mannheim build; `pip install pytesseract` |
| **Ollama** | Last-resort local text model | https://ollama.com → `ollama pull llama3.2:3b` |
| **faster-whisper** | Local speech-to-text fallback | `pip install faster-whisper` (the small model runs on CPU) |
| **ffmpeg** | Splitting long lecture audio (P1) | `winget install ffmpeg` |
| **NVDA** | Screen-reader testing | https://www.nvaccess.org (free) |

## 5. Content and fonts (no accounts)
| Resource | Licence | Notes |
|---|---|---|
| **OpenStax** textbooks (e.g. *Concepts of Biology*, *Physics*) | CC BY 4.0 | Must be credited: see `data/openstax/ATTRIBUTION.md` |
| Google Fonts: Atkinson Hyperlegible, Lexend, Noto Nastaliq Urdu | SIL Open Font License | Load from fonts.googleapis.com or self-host |
| OpenDyslexic (optional) | SIL Open Font License | Self-host in `frontend/public/fonts/` |

---

## 6. Environment variables (copy `.env.example` to `.env`)

| Variable | Example | Used by |
|---|---|---|
| `GEMINI_API_KEY` | `AIza…` | ocr.py |
| `GEMINI_MODEL` | `gemini-3.5-flash` | ocr.py, fallback text |
| `GEMINI_FALLBACK_MODEL` | `gemini-flash-latest,gemini-3-flash-preview,…` | tried in order when quota runs out |
| `GROQ_API_KEY` | `gsk_…` | simplify, factguard, glossary, summarize, quiz, transcribe |
| `GROQ_REWRITE_MODEL` | `qwen/qwen3.8-27b` | simplify, glossary, summarize, quiz |
| `GROQ_FACTGUARD_MODEL` | `openai/gpt-oss-120b` | factguard (must be a different model from the rewriter) |
| `GROQ_FALLBACK_MODEL` | `openai/gpt-oss-20b` | last-resort checker |
| `GROQ_STT_MODEL` | `whisper-large-v3-turbo` | transcribe |
| `TTS_URDU_VOICE` | `ur-PK-UzmaNeural` | tts |
| `TTS_PASHTO_VOICE` | `ps-AF-LatifaNeural` | tts |
| `TTS_ENGLISH_VOICE` | `en-US-AriaNeural` | tts |
| `DEMO_MODE` | `false` | `true` = serve only from cache, no API calls |
| `CACHE_DIR` | *(empty = `data/cache`)* | cache |
| `MAX_UPLOAD_MB` | `10` | ingest |
| `ALLOWED_ORIGINS` | `http://localhost:5173,https://roshni.vercel.app` | CORS |
| `PROMPT_VERSION` | `v1` | Cache key; bump it when prompts change |
| `VITE_API_BASE_URL` (frontend) | `https://<user>-roshni.hf.space` | frontend |

---

## 7. Key safety rules

1. **Never commit `.env`.** It's already in `.gitignore`. If a key is pushed by mistake, **revoke it in the console immediately** and create a new one.
2. Keys go only in `.env` (local) and Space secrets (deployed). **Never in frontend code:** every AI call goes through the backend.
3. Don't share keys in the WhatsApp group. Each person uses their own.
4. Before the demo, run `python scripts/check_quotas.py` to confirm every key works.

## 8. Not needed (don't sign up)
OpenAI, Anthropic, Azure, AWS, Google Cloud billing, Twilio, or any paid OCR or TTS service. Nothing in this project needs a credit card. The one exception is optional: a prepaid DeepSeek key (under $1 of credit) used only as a capped backup when the free tiers are busy; see `DEEPSEEK_*` in `.env.example`.
