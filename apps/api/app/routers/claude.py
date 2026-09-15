"""Provider-agnostisk analysendpoint.

Namnet /api/v1/claude/analyze speglar slutarkitekturen: när ANTHROPIC_API_KEY
sätts byter denna endpoint automatiskt till Claude utan att frontend eller
kontraktet ändras. Idag körs den via den konfigurerade feedback-providern.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from .. import schemas
from ..services.supabase_auth import SupabaseUser, get_current_supabase_user
from ..services.feedback import generate_feedback_detailed
from ..services.providers.registry import get_math_provider

router = APIRouter(prefix="/api/v1/claude", tags=["claude"])


@router.post("/analyze", response_model=schemas.ClaudeAnalyzeResponse)
async def analyze(
    payload: schemas.ClaudeAnalyzeRequest,
    _user: SupabaseUser = Depends(get_current_supabase_user),
) -> schemas.ClaudeAnalyzeResponse:
    verifier = get_math_provider()
    wolfram = await verifier.verify_equation(payload.studentAnswer, payload.correctAnswer)

    problem = payload.problem if not payload.context else f"{payload.problem}\n\nKontext: {payload.context}"
    feedback, provider_used = await generate_feedback_detailed(
        problem=problem,
        student_answer=payload.studentAnswer,
        correct_answer=payload.correctAnswer,
        wolfram=wolfram,
    )

    return schemas.ClaudeAnalyzeResponse(
        feedback=feedback,
        isCorrect=wolfram.is_correct,
        confidence=wolfram.confidence,
        provider=provider_used,
    )
