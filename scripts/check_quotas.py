"""Sends one tiny request to every model Roshni uses and prints OK / RATE LIMITED / FAILED. Run before the demo.

Usage: python scripts/check_quotas.py
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from google import genai  # noqa: E402
from groq import Groq, RateLimitError  # noqa: E402

from app.config import get_settings  # noqa: E402

s = get_settings()
rows = []


def check(name, fn):
    t = time.time()
    try:
        fn()
        rows.append((name, "OK", f"{time.time() - t:.1f}s"))
    except RateLimitError as e:
        rows.append((name, "RATE LIMITED", str(e)[:90]))
    except Exception as e:  # noqa: BLE001
        msg = str(e)
        rows.append((name, "RATE LIMITED" if "429" in msg else "FAILED", msg[:90]))


g = genai.Client(api_key=s.gemini_api_key)
for m in s.gemini_models:
    check(f"Gemini {m}", lambda m=m: g.models.generate_content(model=m, contents="Say OK"))

q = Groq(api_key=s.groq_api_key)
for m in (s.groq_rewrite_model, s.groq_factguard_model, s.groq_fallback_model):
    extra = {"reasoning_effort": "none"} if "qwen" in m else {"reasoning_effort": "low"} if "gpt-oss" in m else {}
    check(f"Groq {m}", lambda m=m, extra=extra: q.chat.completions.create(model=m, messages=[{"role": "user", "content": "Say OK"}], max_tokens=20, **extra))
check(f"Groq {s.groq_stt_model}", lambda: q.models.retrieve(s.groq_stt_model))


def edge():
    import asyncio

    import edge_tts

    async def run():
        async for chunk in edge_tts.Communicate("OK", s.tts_urdu_voice).stream():
            if chunk["type"] == "audio":
                return
        raise RuntimeError("no audio")

    asyncio.run(run())


check(f"edge-tts {s.tts_urdu_voice}", edge)

if s.deepseek_api_key:  # paid backup: only the free balance endpoint is called, no credit is spent
    from app.services.llm_clients import deepseek_balance, deepseek_spend  # noqa: E402

    balance, spent = deepseek_balance(), deepseek_spend()
    rows.append((f"DeepSeek {s.deepseek_model} (paid backup)", "OK" if balance and balance >= s.deepseek_min_balance_usd else "LOW/FAILED",
                 f"balance ${balance}, Roshni est. spend ${spent['usd']:.4f} of ${s.deepseek_budget_usd:.2f} cap, {spent['calls']} calls"))

width = max(len(r[0]) for r in rows)
for name, status, note in rows:
    print(f"{name:<{width}}  {status:<13} {note}")
print("\nDEMO_MODE =", s.demo_mode)
sys.exit(0 if all(r[1] == "OK" for r in rows) else 1)
