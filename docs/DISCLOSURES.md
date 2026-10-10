# Disclosures (as required by the AICON'26 Build With AI rulebook)

The rulebook asks teams to disclose significant pre-existing code, datasets, models, templates and other resources, to follow licences, and not to misrepresent anyone's contribution.

## Built during AICON'26
Everything in this repository was created during the official Build With AI period, which started at the Day 1 briefing on 9 Oct 2026. The git commit history is the record. No code from earlier projects was reused.

## AI coding assistant
The team used an AI coding assistant (Claude Code), which the rulebook explicitly allows. The team chose the problem, designed the product and the Fact Guard method, set the scope and requirements, reviewed and tested the output, and is responsible for every line. Team members should be able to explain any part of the system; see `docs/PLAN.md` for the design.

## Templates and libraries
| Item | Source | Licence | How it's used |
|---|---|---|---|
| Vite + React starter | `npm create vite` | MIT | Frontend scaffold |
| FastAPI, Pydantic, Uvicorn | Open source | MIT / BSD | Backend |
| Tailwind CSS, Motion, Lucide icons | Open source | MIT / ISC | UI, animation, icons |
| textstat, wordfreq, jiwer, PyMuPDF, Pillow | Open source | MIT / Apache / AGPL (PyMuPDF) | Readability, word frequency, evaluation, PDF and image handling |

## AI models and APIs (third-party, free tiers)
| Item | Provider | Used for |
|---|---|---|
| Gemini 3.5 Flash (+ fallbacks) | Google AI Studio | Page reading, diagram descriptions, fallback writing/checking |
| Qwen 3.8 27B, GPT-OSS 120B/20B, Whisper large-v3-turbo | Groq | Rewrite, Fact Guard checking, transcription |
| edge-tts / gTTS | Open-source clients for Microsoft / Google voices | Urdu and English speech |

## Datasets and content
| Item | Licence | Notes |
|---|---|---|
| OpenStax textbook excerpts (*Concepts of Biology*, *College Physics 2e*, *Chemistry 2e*) | CC BY 4.0 | Credited in `data/openstax/ATTRIBUTION.md`; page images rendered by our script |
| Lecture clip `sample-lecture-synthetic.mp3` | Made by the team | Generated with a text-to-speech voice from a known script; labelled **synthetic** everywhere |
| Planted-error test set | Made by the team | Errors planted by code into real rewrites; labelled **synthetic** |

## Not used
No private, confidential or personal data. No copyrighted textbooks are stored in this repository. No results were edited by hand: every number on the Evidence page comes from the scripts in `eval/`.

## Paid backup model
The team added an optional prepaid DeepSeek key (under $1 of credit) as a backup for when the free Gemini and Groq tiers are rate-limited. It is capped in code and used only after the free models; all evaluation results in the README were produced before it was added.
