"""Diagnostisk endpoint för att verifiera Wolfram-API-koppling.

Endast för utveckling/integration – avregistreras enkelt i `main.py` om man
vill stänga av den i produktion.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from .. import schemas
from ..config import settings
from ..services.supabase_auth import SupabaseUser, get_current_supabase_user
from ..services.wolfram import WolframVerifier

router = APIRouter(prefix="/api/v1/wolfram", tags=["wolfram-test"])


@router.get("/status")
def status(
    _user: SupabaseUser = Depends(get_current_supabase_user),
) -> dict:
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
    _user: SupabaseUser = Depends(get_current_supabase_user),
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
async def verify_post(
    payload: schemas.WolframVerifyRequest,
    _user: SupabaseUser = Depends(get_current_supabase_user),
) -> schemas.WolframResult:
    """JSON-body-variant av GET /verify för klienter som föredrar POST."""
    verifier = WolframVerifier()
    return await verifier.verify_equation(payload.student, payload.correct)


@router.get("/raw")
async def raw_query(
    input: str = Query("solve 2x + 4 = 10", description="Wolfram-fråga"),
    _user: SupabaseUser = Depends(get_current_supabase_user),
) -> dict:
    """Skickar en rå fråga till Wolfram|Alpha Full Results API och returnerar
    queryresult.success + pod-titlar (för snabb sanity-check av API-nyckeln).

    Exempel:
        GET /api/v1/wolfram/raw?input=solve+2x+%2B+4+%3D+10
    """
    if not settings.WOLFRAM_APP_ID:
        raise HTTPException(503, "WOLFRAM_APP_ID är inte konfigurerat i .env")

    verifier = WolframVerifier()
    return await verifier.raw_query(input)
