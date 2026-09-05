"""Provider registry — selects the active adapter based on config + API keys.

Each getter returns the appropriate adapter instance. "auto" resolves based on
which API keys are configured (same priority logic as the original services).
"""
from __future__ import annotations

from functools import lru_cache

from ...config import settings
from .base import (
    FeedbackProvider,
    MathVerificationProvider,
    OCRProvider,
    VisionProvider,
)
from .resilience import CircuitBreaker

# One CircuitBreaker per provider name — shared across all calls.
_circuits: dict[str, CircuitBreaker] = {}


def _circuit(name: str) -> CircuitBreaker:
    if name not in _circuits:
        _circuits[name] = CircuitBreaker(provider_name=name)
    return _circuits[name]


# ---------------------------------------------------------------------------
# Vision (grading engine)
# ---------------------------------------------------------------------------


def get_vision_provider() -> VisionProvider:
    from .gemini_vision import GeminiVisionAdapter

    configured = settings.effective_grading_provider.strip().lower()
    if configured == "gemini" or (configured == "auto" and settings.GEMINI_API_KEY):
        return GeminiVisionAdapter(_circuit("gemini-vision"))
    # Future: claude-vision adapter when GRADING_PROVIDER=anthropic is wired
    # to a grading-capable Claude adapter. For now, auto resolves to gemini.
    if configured != "auto" and configured != "gemini":
        raise RuntimeError(f"GRADING_PROVIDER={configured!r} is not yet supported for vision grading")
    if settings.GEMINI_API_KEY:
        return GeminiVisionAdapter(_circuit("gemini-vision"))
    raise RuntimeError("Ingen vision-provider konfigurerad (sätt GEMINI_API_KEY eller GRADING_PROVIDER)")


# ---------------------------------------------------------------------------
# Feedback
# ---------------------------------------------------------------------------


def get_feedback_provider() -> FeedbackProvider:
    configured = settings.FEEDBACK_PROVIDER.strip().lower()
    if configured == "auto":
        if settings.ANTHROPIC_API_KEY:
            configured = "anthropic"
        elif settings.GROQ_API_KEY:
            configured = "groq"
        elif settings.GEMINI_API_KEY:
            configured = "gemini"
        else:
            configured = "unavailable"

    if configured == "groq":
        from .groq_feedback import GroqFeedbackAdapter
        return GroqFeedbackAdapter(_circuit("groq"))
    if configured == "gemini":
        from .gemini_feedback import GeminiFeedbackAdapter
        return GeminiFeedbackAdapter(_circuit("gemini"))
    if configured == "anthropic":
        from .anthropic_feedback import AnthropicFeedbackAdapter
        return AnthropicFeedbackAdapter(_circuit("anthropic"))
    raise RuntimeError("Ingen AI-provider för feedback är konfigurerad eller aktiverad.")


# ---------------------------------------------------------------------------
# Math verification
# ---------------------------------------------------------------------------


def get_math_provider() -> MathVerificationProvider:
    from .wolfram import WolframAdapter

    configured = settings.MATH_PROVIDER.strip().lower()
    if configured == "wolfram" or configured == "auto":
        return WolframAdapter(_circuit("wolfram"))
    if configured == "local":
        return WolframAdapter(_circuit("wolfram"))  # local fallback is inside WolframVerifier
    raise RuntimeError(f"MATH_PROVIDER={configured!r} stöds inte")


# ---------------------------------------------------------------------------
# OCR
# ---------------------------------------------------------------------------


def get_ocr_provider() -> OCRProvider:
    configured = settings.OCR_PROVIDER.strip().lower()
    if configured == "auto":
        if settings.MATHPIX_APP_ID and settings.MATHPIX_APP_KEY:
            configured = "mathpix"
        elif settings.GEMINI_API_KEY:
            configured = "gemini"
        elif settings.OPENROUTER_API_KEY:
            configured = "openrouter"
        elif settings.GROQ_API_KEY:
            configured = "groq"
        else:
            configured = "unavailable"

    if configured == "mathpix":
        from .mathpix_ocr import MathpixOCRAdapter
        return MathpixOCRAdapter(_circuit("mathpix"))
    if configured == "groq":
        from .groq_vision import GroqVisionAdapter
        return GroqVisionAdapter(_circuit("groq-vision"))
    if configured == "openrouter":
        from .openrouter_vision import OpenRouterVisionAdapter
        return OpenRouterVisionAdapter(_circuit("openrouter-vision"))
    if configured == "gemini":
        # Gemini vision OCR uses the DevelopmentVisionOCRProvider path
        # which already handles Gemini via vision_ocr.
        from ..ocr import DevelopmentVisionOCRProvider
        return DevelopmentVisionOCRProvider()
    raise RuntimeError("Ingen OCR-provider är konfigurerad.")


def get_claude_vision_provider() -> "ClaudeVisionAdapter":
    """Returns the Claude Vision adapter for answer-key extraction."""
    from .claude_vision import ClaudeVisionAdapter
    return ClaudeVisionAdapter(_circuit("claude-vision"))


def reset_circuits() -> None:
    """Reset all circuit breakers — used in tests to avoid cross-test leakage."""
    _circuits.clear()
