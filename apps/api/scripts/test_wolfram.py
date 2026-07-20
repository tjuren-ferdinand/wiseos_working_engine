"""Snabb sanity-check att Wolfram-API:t fungerar med den konfigurerade nyckeln.

Kör från projektroten:

    cd apps/api
    .\.venv\Scripts\python.exe scripts\test_wolfram.py

Förväntat utfall (med giltig nyckel):
    [STATUS] active_mode = full-results
    [RAW]    queryresult.success = True, numpods = 3+
    [VERIFY] x = 3 ≡ x = 3 → True (confidence 0.99)
    [VERIFY] x = 3 ≡ x = 4 → False (confidence 0.99)
    [VERIFY] 2*(x+1) ≡ 2*x + 2 → True (confidence ≥ 0.7)
"""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

# Lägg till apps/api/ i sys.path så vi kan importera 'app' även när scriptet
# körs från scripts/-mappen.
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv  # type: ignore

# Ladda .env från projekt-roten (två steg upp från detta script)
load_dotenv(ROOT.parent.parent / ".env")

from app.config import settings  # noqa: E402
from app.services.wolfram import WolframVerifier  # noqa: E402

import httpx  # noqa: E402


async def raw_check() -> None:
    print(f"[STATUS] WOLFRAM_APP_ID = {(settings.WOLFRAM_APP_ID[:4] + '***') if settings.WOLFRAM_APP_ID else '(saknas)'}")
    print(f"[STATUS] active_mode    = {'full-results' if settings.WOLFRAM_APP_ID else 'local-mock'}")

    if not settings.WOLFRAM_APP_ID:
        print("[FEL] WOLFRAM_APP_ID är inte satt i .env. Avbryter.")
        sys.exit(1)

    print()
    print("[RAW] Skickar 'solve 2x + 4 = 10' till Full Results API ...")
    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.get(
            "https://api.wolframalpha.com/v2/query",
            params={
                "input": "solve 2x + 4 = 10",
                "appid": settings.WOLFRAM_APP_ID,
                "output": "JSON",
                "format": "plaintext",
            },
        )
    if r.status_code != 200:
        print(f"[FEL] HTTP {r.status_code}: {r.text[:300]}")
        sys.exit(2)

    qr = r.json().get("queryresult", {})
    pods = qr.get("pods", []) or []
    print(f"       queryresult.success = {qr.get('success')}")
    print(f"       numpods             = {qr.get('numpods')}")
    for p in pods[:5]:
        plain = [sp.get("plaintext") for sp in p.get("subpods", [])]
        print(f"       · {p.get('title'):<25} -> {plain}")


async def verify_cases() -> None:
    print()
    print("[VERIFY] Kör WolframVerifier mot några testfall ...")
    v = WolframVerifier()
    cases = [
        ("x = 3", "x = 3", True),
        ("x = 3", "x = 4", False),
        ("2*(x+1)", "2*x + 2", True),
        ("x = 1/2", "x = 0.5", True),
        ("x^2 - 4", "(x-2)*(x+2)", True),
    ]
    for student, correct, expected in cases:
        r = await v.verify_equation(student, correct)
        flag = "OK " if r.is_correct == expected else "MISS"
        print(
            f"       [{flag}] {student!r:<15} ≡ {correct!r:<15} → "
            f"{r.is_correct} (conf {r.confidence:.2f}) — {r.notes}"
        )


async def main() -> None:
    await raw_check()
    await verify_cases()
    print()
    print("Klar. ✅")


if __name__ == "__main__":
    asyncio.run(main())
