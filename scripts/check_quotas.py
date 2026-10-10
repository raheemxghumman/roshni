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
        rows.append((name, "RATE LIMITED" if "429" in msg else "BAD KEY" if "403" in msg or "401" in msg else "FAILED", msg[:90]))


# every key is checked on the main model (each key has its own quota); the fallback models on the first working key
gemini_clients = [genai.Client(api_key=k) for k in s.gemini_keys]  # kept alive: a discarded client closes its connection
for i, g in enumerate(gemini_clients):
    check(f"Gemini key #{i + 1} {s.gemini_model}", lambda g=g: g.models.generate_content(model=s.gemini_model, contents="Say OK"))
for m in s.gemini_models[1:]:
    check(f"Gemini key #1 {m}", lambda m=m: gemini_clients[0].models.generate_content(model=m, contents="Say OK"))

groq_clients = [Groq(api_key=k) for k in s.groq_keys]
for i, q in enumerate(groq_clients):
    for m in (s.groq_rewrite_model, s.groq_factguard_model, s.groq_fallback_model):
        extra = {"reasoning_effort": "none"} if "qwen" in m else {"reasoning_effort": "low"} if "gpt-oss" in m else {}
        check(f"Groq key #{i + 1} {m}", lambda q=q, m=m, extra=extra: q.chat.completions.create(model=m, messages=[{"role": "user", "content": "Say OK"}], max_tokens=20, **extra))
q = groq_clients[0]
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
