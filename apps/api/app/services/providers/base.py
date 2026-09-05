"""Protocol interfaces for provider adapters.

Each adapter wraps an existing service module. The interface is the contract;
the implementation lives in the original service file.
"""
from __future__ import annotations

from typing import Protocol

from ...schemas import (
    AnswerKeyItem,
    DocumentMeta,
    OcrResponse,
    QuestionResult,
    WolframResult,
)


class VisionProvider(Protocol):
    """Analyzes a multi-page student document against an answer key."""

    name: str

    async def analyze_document(
        self,
        *,
        pages: list[tuple[bytes, str]],
        answer_key: list[AnswerKeyItem],
        grading_notes: str,
        student_label: str,
    ) -> tuple[list[QuestionResult], DocumentMeta]: ...


class FeedbackProvider(Protocol):
    """Generates pedagogical feedback for a single question."""

    name: str

    async def generate_feedback(
        self,
        *,
        problem: str,
        student_answer: str,
        correct_answer: str,
        wolfram: WolframResult,
    ) -> tuple[str, str]: ...


class MathVerificationProvider(Protocol):
    """Verifies mathematical equivalence between student and correct answer."""

    name: str

    async def verify_equation(
        self,
        student_answer: str,
        correct_answer: str,
    ) -> WolframResult: ...


class OCRProvider(Protocol):
    """Extracts text from a scanned image or PDF."""

    name: str

    async def extract(
        self,
        source: str,
        image_bytes: bytes,
        mime_type: str,
    ) -> OcrResponse: ...
