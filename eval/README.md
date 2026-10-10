# Evaluation

Every number shown on the slides or in the Metrics panel comes from these scripts. Results are written to `eval/results/<metric>.json` with the dataset, sample size, date and models used.

| Script | Measures | Data (as committed in `results/`) | Target |
|---|---|---|---|
| `ocr_cer.py` + `ocr_hard.py` | Character error rate of page reading | 5 pages × clean/photo + hard degradations | under 3% |
| `readability_eval.py` | Flesch-Kincaid grade before and after | 5 OpenStax pages × 2 levels | 2–4 grades lower |
| `factguard_planted_errors.py` | Recall on planted errors + false alarm rate | 28 planted on 5×2; separate false-alarm file | at least 85% recall, at most 10% false alarms |
| `asr_wer.py` | Whisper word error rate | 1 synthetic TTS clip with known script (labelled) | report honestly |

**Planted-error types:** (1) a fact sentence deleted, (2) a number or unit changed, (3) an unsupported claim added, (4) a key term replaced with a wrong synonym.

**Honesty rules:** report the sample size next to every number, never discard bad runs, and label synthetic data as synthetic.
