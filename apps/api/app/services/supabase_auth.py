"""Fas 2 – Steg 1: Verifiering av Supabase-JWT för inkommande requests.

Validerar Bearer-token mot Supabase Auth REST API (GET /auth/v1/user).
Kräver ingen extra dependency (httpx finns redan) och ingen lokal
signaturverifiering — Supabase är källan till sanning för giltiga sessioner.

Detta system är FRISTÅENDE från det befintliga JWT/bcrypt-systemet i
app/routers/auth.py, som lämnas orört tills en fullständig migrering är
bekräftad av produktägaren.
"""
from __future__ import annotations

from typing import Annotated

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from ..config import settings

security = HTTPBearer()


class SupabaseUser(BaseModel):
    id: str
    email: str | None = None
    role: str | None = None


async def get_current_supabase_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
) -> SupabaseUser:
    """Verifierar Bearer-token mot Supabase och returnerar användaren.

    ZERO MOCK DATA: om SUPABASE_URL/ANON_KEY saknas eller Supabase svarar
    med fel kraschar detta högljutt (401/500) — ingen tyst fallback.
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_URL/SUPABASE_ANON_KEY är inte konfigurerade i backend .env",
        )

    token = credentials.credentials
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(
                f"{settings.SUPABASE_URL}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": settings.SUPABASE_ANON_KEY,
                },
            )
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Kunde inte nå Supabase Auth: {exc}",
            ) from exc

    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ogiltig eller utgången Supabase-session",
            headers={"WWW-Authenticate": "Bearer"},
        )

    data = resp.json()
    return SupabaseUser(id=data["id"], email=data.get("email"), role=data.get("role"))
