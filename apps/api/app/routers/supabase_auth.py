"""Fas 2 – Steg 1: Verifieringsendpoint för Supabase-sessioner.

Rör inte OCR/Wolfram/LLM-rättningslogiken. Endast till för att bekräfta att
frontendens Bearer-token verifieras korrekt av backend end-to-end.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from ..services.supabase_auth import SupabaseUser, get_current_supabase_user

router = APIRouter(prefix="/api/v1/auth/supabase", tags=["auth-supabase"])


@router.get("/me", response_model=SupabaseUser)
async def get_supabase_me(
    user: Annotated[SupabaseUser, Depends(get_current_supabase_user)],
) -> SupabaseUser:
    """Returnerar den Supabase-autentiserade användaren. 401 om token saknas/ogiltig."""
    return user
