"""Fallback vision adapter — kedjar primär + ordnade fallback-motorer.

Används i auto-läge när flera vision-nycklar är satta. Ordningen är
testmotiverad (se docs/provider-switching.md): Gemini primär, Claude,
OpenAI — ett avbrott hos en provider stoppar inte flödet.

En provider räknas som misslyckad om den kastar (circuit open, oväntat
fel) ELLER returnerar en total teknisk misslyckandesignal (meta.error satt
+ alla facitfrågor needs_review). Delresultat — några frågor bedömda, några
needs_review — räknas som lyckat svar; fallback körs bara när svaret är helt
utan bedömbart innehåll. Om alla kedjans motorer faller returneras det första
misslyckade svaret: needs_review, aldrig påhittade poäng.
"""
from __future__ import annotations

import logging

from ...schemas import AnswerKeyItem, DocumentMeta, QuestionResult
from .resilience import CircuitBreaker

logger = logging.getLogger("wiseos.grading")


def _is_total_provider_failure(
    questions: list[QuestionResult], meta: DocumentMeta
) -> bool:
    """Sant när svaret inte innehåller någon riktig bedömning alls."""
    if not meta.error:
        return False
    in_key = [q for q in questions if q.inAnswerKey]
    return not in_key or all(
        q.assessment.status == "needs_review" for q in in_key
    )


class FallbackVisionProvider:
    """VisionProvider som kedjar primär → fallback(er) vid providerfel."""

    def __init__(
        self,
        primary,
        fallbacks: list,
        circuit: CircuitBreaker,
    ) -> None:
        self._primary = primary
        self._fallbacks = list(fallbacks)
        self._circuit = circuit
        self.name = "+".join([primary.name] + [f.name for f in self._fallbacks])

    async def analyze_document(
        self,
        *,
        pages: list[tuple[bytes, str]],
        answer_key: list[AnswerKeyItem],
        grading_notes: str,
        student_label: str,
    ) -> tuple[list[QuestionResult], DocumentMeta]:
        self._circuit.check()
        first_failure: tuple[list[QuestionResult], DocumentMeta] | None = None
        first_error: Exception | None = None

        providers = [self._primary, *self._fallbacks]
        for index, provider in enumerate(providers):
            role = "primary" if index == 0 else "fallback"
            try:
                result = await provider.analyze_document(
                    pages=pages,
                    answer_key=answer_key,
                    grading_notes=grading_notes,
                    student_label=student_label,
                )
                if not _is_total_provider_failure(*result):
                    self._circuit.record_success()
                    return result
                logger.warning(
                    "vision_%s_total_failure provider=%s error=%s — provar nästa i kedjan",
                    role, provider.name, result[1].error,
                )
                if first_failure is None:
                    first_failure = result
            except Exception as exc:
                logger.warning(
                    "vision_%s_raised provider=%s error=%s — provar nästa i kedjan",
                    role, provider.name, exc,
                )
                if first_error is None:
                    first_error = exc

        # Alla motorer i kedjan faller: returnera första misslyckade svaret
        # (needs_review med felorsak) eller första felet — aldrig påhittat.
        self._circuit.record_failure()
        if first_failure is not None:
            return first_failure
        raise first_error
