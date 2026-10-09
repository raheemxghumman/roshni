# Prompts (version v1)

| File | Used by | Model role |
|---|---|---|
| `ocr_page.txt` | ocr.py | Gemini vision: page photo → blocks + figure descriptions |
| `structure_text.txt` | ocr.py | PDF text layer → blocks (no words changed) |
| `simplify_sections.txt` | simplify.py | Rewriter (Qwen): all sections in one call |
| `facts_extract.txt` | factguard.py | Checker (GPT-OSS): atomic facts from the original |
| `facts_audit.txt` | factguard.py | Checker: omission + change + addition audit in one call |
| `repair.txt` | simplify.py | Rewriter: fixes only the reported problems |
| `glossary.txt` | glossary.py | Rewriter: simple English + Urdu explanations |
| `lecture_summary.txt` | summarize.py | Rewriter: lecture summary |
| `support_check.txt` | summarize.py | Checker: every summary claim supported by the transcript |
| `quiz.txt` | quiz.py | Rewriter: questions from verified facts only |

Rules:
- `{placeholders}` are filled by `config.fill()`. Lines starting with `# ` are comments and are stripped.
- Page and lecture content always goes inside tags and is treated as data, never as instructions.
- Bump `PROMPT_VERSION` in `.env` when a prompt changes, so cached results refresh.
- The checker must always be a different model family from the rewriter (enforced in code).
