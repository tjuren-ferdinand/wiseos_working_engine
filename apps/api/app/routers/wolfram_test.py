"""Diagnostisk endpoint för att verifiera Wolfram-API-koppling.

Endast för utveckling/integration – avregistreras enkelt i `main.py` om man
vill stänga av den i produktion.
"""
from __future__ import annotations

import httpx
from fastapi import APIRouter, HTTPException, Query

from .. import schemas
from ..config import settings
from ..services.wolfram import WolframVerifier

router = APIRouter(prefix="/api/v1/wolfram", tags=["wolfram-test"])


@router.get("/status")
def status() -> dict:
    """Returnerar vilket Wolfram-läge som är aktivt."""
    return {
        "app_id_configured": bool(settings.WOLFRAM_APP_ID),
        "app_id_preview": (settings.WOLFRAM_APP_ID[:4] + "***") if settings.WOLFRAM_APP_ID else None,
        "cloud_url_configured": bool(settings.WOLFRAM_API_URL),
        "cloud_url": settings.WOLFRAM_API_URL or None,
        "active_mode": (
            "cloud" if settings.WOLFRAM_API_URL
            else "full-results" if settings.WOLFRAM_APP_ID
            else "local-mock"
        ),
    }


@router.get("/verify")
async def verify(
    student: str = Query(..., description="Elevens svar, t.ex. 'x = 3'"),
    correct: str = Query(..., description="Korrekt svar, t.ex. 'x = 3'"),
) -> dict:
    """Verifiera ett par (student, correct) via aktiv Wolfram-strategi.

    Exempel:
        GET /api/v1/wolfram/verify?student=x%3D3&correct=x%3D3
        → { "is_correct": true, "confidence": 0.99, ... }
    """
    verifier = WolframVerifier()
    result = await verifier.verify_equation(student, correct)
    return result.model_dump()


@router.post("/verify", response_model=schemas.WolframResult)
async def verify_post(payload: schemas.WolframVerifyRequest) -> schemas.WolframResult:
    """JSON-body-variant av GET /verify för klienter som föredrar POST."""
    verifier = WolframVerifier()
    return await verifier.verify_equation(payload.student, payload.correct)


@router.get("/raw")
async def raw_query(
    input: str = Query("solve 2x + 4 = 10", description="Wolfram-fråga"),
) -> dict:
    """Skickar en rå fråga till Wolfram|Alpha Full Results API och returnerar
    queryresult.success + pod-titlar (för snabb sanity-check av API-nyckeln).

    Exempel:
        GET /api/v1/wolfram/raw?input=solve+2x+%2B+4+%3D+10
    """
    if not settings.WOLFRAM_APP_ID:
        raise HTTPException(503, "WOLFRAM_APP_ID är inte konfigurerat i .env")

    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.get(
            "https://api.wolframalpha.com/v2/query",
            params={
                "input": input,
                "appid": settings.WOLFRAM_APP_ID,
                "output": "JSON",
                "format": "plaintext",
                "scantimeout": "10",
                "podtimeout": "10",
            },
        )

    if r.status_code != 200:
        return {"http_status": r.status_code, "body": r.text[:500]}

    data = r.json()
    qr = data.get("queryresult", {})
    pods = qr.get("pods", []) or []
    return {
        "http_status": r.status_code,
        "success": qr.get("success"),
        "error": qr.get("error"),
        "numpods": qr.get("numpods"),
        "pods": [
            {
                "id": p.get("id"),
                "title": p.get("title"),
                "plaintext": [sp.get("plaintext") for sp in p.get("subpods", [])],
            }
            for p in pods
        ],
    }
