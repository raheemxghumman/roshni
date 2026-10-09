# Roshni: One page. Every learner.

Roshni turns a printed textbook page or a recorded lecture into an accessible lesson pack:

- **Read Easy** for dyslexic learners and weaker readers: a simplified rewrite with Urdu explanations and read-aloud highlighting
- **Listen** for blind learners: structured audio with diagram descriptions and keyboard navigation
- **Captions** for deaf learners: a transcript plus a checked summary

**Fact Guard**, a second, independent AI, checks that no fact was lost, changed or added.

Built at **AICON'26 Build With AI** (EdTech & Workforce) by **404 Team Not Found**.

> ⚠️ Work in progress during the event. See `docs/PLAN.md`.

## Run locally
```bash
# backend
cd backend
python -m venv .venv && .venv\Scripts\activate      # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy ..\.env.example ..\.env                           # then fill in your keys
uvicorn app.main:app --reload --port 8000

# frontend (first time only: scaffold, see frontend/README.md)
cd frontend
npm install
npm run dev
```

## Docs

- `docs/PLAN.md`: full build plan, scope, edge cases, timeline, demo script
- `docs/APIS_AND_ACCOUNTS.md`: every API and account we use, all free
- `docs/DISCLOSURES.md`: pre-existing material, datasets and licences, as the rulebook requires

## Project layout
```
roshni/
├── backend/            FastAPI app (Hugging Face Spaces, Docker)
│   ├── app/
│   │   ├── routers/    lessons, lectures, quiz, metrics endpoints
│   │   ├── services/   ingest, ocr, structure, simplify, factguard, normalize,
│   │   │               glossary, readability, tts, transcribe, summarize, quiz,
│   │   │               cache, llm_clients
│   │   └── prompts/    versioned prompt templates
│   ├── tests/          unit tests (normalisation, Fact Guard, edge inputs)
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/           React + Vite + Tailwind (Vercel)
│   └── src/{pages,modes,components,lib,styles}
├── data/
│   ├── openstax/       CC BY 4.0 excerpts + ATTRIBUTION.md
│   ├── raw/            page photos (git-ignored)
│   ├── lectures/       demo audio clips (git-ignored)
│   └── demo_cache/     pre-computed lesson packs for demo mode (git-ignored)
├── eval/               evaluation scripts + results/
├── scripts/            warm_cache.py, check_quotas.py
├── docs/               plan, APIs and accounts, disclosures
├── slides/             demo presentation (PPTX)
└── journey/            Document Your Journey clips (git-ignored)
```

## Data and licences
Textbook content comes from **OpenStax** (CC BY 4.0); see `data/openstax/ATTRIBUTION.md`. Any simulated or self-made test data is labelled as such.
