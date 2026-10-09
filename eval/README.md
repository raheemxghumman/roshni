# Evaluation

Every number shown on the slides or in the Metrics panel comes from these scripts. Results are written to `eval/results/<metric>.json` with the dataset, sample size, date and models used.

| Script | Measures | Data | Target |
|---|---|---|---|
| `ocr_cer.py` | Character error rate of page reading | 10 photographed OpenStax pages vs their digital text | under 3% |
| `readability_eval.py` | Flesch-Kincaid grade before and after | 30 OpenStax sections | 2–4 grades lower |
| `factguard_planted_errors.py` | Recall on planted errors + false alarm rate on clean rewrites | 30 sabotaged + 30 clean rewrites (synthetic, labelled) | at least 85% recall, at most 10% false alarms |
| `asr_wer.py` | Whisper word error rate | 5 team-recorded clips with hand transcripts | report honestly |

**Planted-error types:** (1) a fact sentence deleted, (2) a number or unit changed, (3) an unsupported claim added, (4) a key term replaced with a wrong synonym.

**Honesty rules:** report the sample size next to every number, never discard bad runs, and label synthetic data as synthetic.
