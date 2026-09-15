"""OpenAI-visionbedömning — speglar gemini_vision.analyze_document.

Återanvänder prompt, systeminstruktion, JSON-tolkning, invarianter och
orkestrering (sid-/frågechunking, deduplicering, needs_review-konvertering)
från services/gemini_vision.py. Endast transportlagret skiljer: OpenAI
chat.completions med image_url-parts i stället för Gemini generateContent.

Samma garantier gäller: kastar aldrig, fejkar aldrig — tekniska fel blir
needs_review med felorsak, aldrig ett påhittat resultat.
"""
from __future__ import annotations

import asyncio
import base64
import logging
import random
import time
import uuid

import httpx

from ..config import settings
from ..schemas import AnswerKeyItem, DocumentMeta, QuestionResult
from .anonymize import scrub_pii
from .gemini_vision import (
    BACKOFF_BASE_SECONDS,
    BACKOFF_MAX_SECONDS,
    MAX_ATTEMPTS,
    MAX_OUTPUT_TOKENS,
    MAX_PAGES_PER_CALL,
    QUESTIONS_PER_CALL,
    REQUEST_TIMEOUT_SECONDS,
    SYSTEM_INSTRUCTION,
    GradingError,
    _better_result,
    _build_prompt,
    _classify_status,
    _clean_line,
    _coerce_float,
    _failed_question,
    _is_retryable,
    _parse_json_object,
    _question_from_payload,
    _unlisted_from_payload,
    normalize_mime,
)

logger = logging.getLogger("wiseos.grading")

CHAT_URL = "https://api.openai.com/v1/chat/completions"

_CHUNK_SEMAPHORE = asyncio.Semaphore(4)


def available() -> bool:
    return bool(settings.OPENAI_API_KEY)


def _build_payload(
    pages: list[tuple[bytes, str]],
    items: list[AnswerKeyItem],
    grading_notes: str,
) -> dict:
    content: list[dict] = [
        {"type": "text", "text": _build_prompt(items, len(pages), grading_notes)}
    ]
    for index, (data, mime) in enumerate(pages, start=1):
        content.append({"type": "text", "text": f"--- Sida {index} ---"})
        content.append(
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:{normalize_mime(mime)};base64,{base64.b64encode(data).decode('ascii')}"
                },
            }
        )
    return {
        "model": settings.OPENAI_MODEL,
        # gpt-5.x accepterar bara default-temperaturen (1) — parametern utelämnas.
        # gpt-5.x kräver max_completion_tokens — max_tokens är borttaget.
        "max_completion_tokens": MAX_OUTPUT_TOKENS,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM_INSTRUCTION},
            {"role": "user", "content": content},
        ],
    }


async def _generate_json(payload: dict, *, request_id: str) -> tuple[dict, int]:
    """OpenAI-anrop + JSON-tolkning med exponentiell backoff.

    Tolkningen ligger MEDVETET inne i retry-loopen: ett trasigt JSON-svar är
    lika övergående som en 503 och ska ge ett nytt försök, inte ett tappat
    resultat. Returnerar (parsed, attempts).
    """
    if not settings.OPENAI_API_KEY:
        raise GradingError("OPENAI_API_KEY saknas.", kind="not_configured")

    last_error: GradingError | None = None

    # GDPR-bevis: logga textdelen av prompten (utan bildbytes) precis INNAN
    # den lämnar backend. Endast text-parts loggas – bilder exkluderas.
    outgoing_text = "\n".join(
        p["text"]
        for p in payload["messages"][1]["content"]
        if p.get("type") == "text"
    )
    logger.debug(
        "openai_outgoing_prompt request_id=%s text=%r", request_id, outgoing_text,
    )

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
                response = await client.post(
                    CHAT_URL,
                    headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                    json=payload,
                )
            if response.status_code >= 400:
                kind = _classify_status(response.status_code)
                detail = response.text[:300]
                last_error = GradingError(
                    f"OpenAI {response.status_code}: {detail}", kind=kind
                )
                if not _is_retryable(kind) or attempt == MAX_ATTEMPTS:
                    raise last_error
            else:
                body = response.json()
                choices = body.get("choices") or []
                if not choices:
                    raise GradingError(
                        "OpenAI gav inga svaralternativ.",
                        kind="empty_response",
                    )
                choice = choices[0]
                finish = choice.get("finish_reason")
                message = choice.get("message") or {}
                text = (message.get("content") or "").strip()
                if finish == "length" and not text:
                    raise GradingError(
                        "Svaret klipptes av innan något innehåll producerades.",
                        kind="max_tokens",
                    )
                if not text:
                    raise GradingError(
                        f"OpenAI gav tomt innehåll (finish_reason={finish}).",
                        kind="empty_response",
                    )
                # Tolka direkt så att formatfel omfattas av samma retry.
                return _parse_json_object(text), attempt

        except httpx.TimeoutException as e:
            last_error = GradingError(f"Timeout mot OpenAI: {e}", kind="timeout")
        except httpx.HTTPError as e:
            last_error = GradingError(f"Nätverksfel mot OpenAI: {e}", kind="network_error")
        except GradingError as e:
            last_error = e
            if not _is_retryable(e.kind):
                raise

        if attempt < MAX_ATTEMPTS and last_error and _is_retryable(last_error.kind):
            delay = min(BACKOFF_BASE_SECONDS * (2 ** (attempt - 1)), BACKOFF_MAX_SECONDS)
            delay += random.uniform(0, 0.5 * delay)  # jitter mot samtidiga retries
            logger.warning(
                "openai_retry request_id=%s attempt=%d/%d kind=%s delay=%.1fs",
                request_id, attempt, MAX_ATTEMPTS, last_error.kind, delay,
            )
            await asyncio.sleep(delay)
            continue
        break

    raise last_error or GradingError("Okänt fel mot OpenAI.", kind="unknown")


async def _analyze_chunk(
    pages: list[tuple[bytes, str]],
    items: list[AnswerKeyItem],
    grading_notes: str,
    request_id: str,
) -> tuple[list[QuestionResult], list[QuestionResult], int]:
    payload = _build_payload(pages, items, grading_notes)
    data, attempts = await _generate_json(payload, request_id=request_id)

    if not items:
        # Facitfritt läge: modellen genererar facit och bedömning i samma anrop.
        graded: list[QuestionResult] = []
        for entry in data.get("questions") or []:
            if not isinstance(entry, dict):
                continue
            number = _clean_line(entry.get("question_number"), 20)
            if not number:
                continue
            auto_item = AnswerKeyItem(
                question_number=number,
                question_text=_clean_line(entry.get("question_text"), 1000),
                final_answer=_clean_line(entry.get("correct_answer"), 8000),
                derivation_steps=[],
                max_points=_coerce_float(entry.get("max_points"), 1.0),
            )
            graded.append(_question_from_payload(entry, auto_item, len(pages)))
        return graded, [], attempts

    by_number: dict[str, dict] = {}
    for entry in data.get("questions") or []:
        if not isinstance(entry, dict):
            continue
        number = _clean_line(entry.get("question_number"), 20)
        if number:
            by_number[number] = entry

    graded = [
        _question_from_payload(
            by_number.get(str(item.question_number).strip(), {}), item, len(pages)
        )
        for item in items
    ]

    unlisted: list[QuestionResult] = []
    for entry in data.get("unlisted_questions") or []:
        if isinstance(entry, dict):
            parsed = _unlisted_from_payload(entry, len(pages))
            if parsed:
                unlisted.append(parsed)

    return graded, unlisted, attempts


async def analyze_document(
    *,
    pages: list[tuple[bytes, str]],
    answer_key: list[AnswerKeyItem],
    grading_notes: str = "",
    student_label: str = "",
) -> tuple[list[QuestionResult], DocumentMeta]:
    """Kör bildförst-analys av ett helt elevdokument via OpenAI.

    `pages` är sidorna i ordning som (bytes, mime). Alla sidor skickas i samma
    anrop så att modellen kan koppla ihop en uppgift som fortsätter på nästa sida.

    Kastar aldrig – tekniska fel returneras som needs_review med felorsak.
    """
    request_id = uuid.uuid4().hex[:12]
    started = time.perf_counter()
    meta = DocumentMeta(
        pageCount=len(pages),
        model=settings.OPENAI_MODEL,
        questionsExpected=len(answer_key),
    )

    # GDPR-anonymiseringssköld: lärarens fritextanvisningar (grading_notes)
    # kan innehålla PII. Skrubba INNAN texten läggs i prompten som skickas
    # till OpenAI.
    raw_grading_notes = grading_notes
    grading_notes = scrub_pii(grading_notes)
    if raw_grading_notes != grading_notes:
        logger.warning(
            "pii_scrubbed_from_grading_notes request_id=%s", request_id,
        )

    # Elevnamnet (student_label) loggas ENDAST lokalt – det skickas aldrig
    # med i payloaden/prompten till OpenAI (se _build_payload).
    logger.info(
        "grade_start request_id=%s student=%s pages=%d questions=%d model=%s",
        request_id, student_label or "-", len(pages), len(answer_key), settings.OPENAI_MODEL,
    )
    if pages:
        total_bytes = sum(len(data) for data, _ in pages)
        mime_types = [mime for _, mime in pages]
        logger.info(
            "grade_payload request_id=%s total_bytes=%d mime_types=%s",
            request_id, total_bytes, mime_types,
        )

    if not pages:
        meta.latencyMs = int((time.perf_counter() - started) * 1000)
        meta.error = "Inga sidor kunde läsas."
        if answer_key:
            results = [_failed_question(i, "Inga sidor kunde läsas.") for i in answer_key]
        else:
            results = []
        meta.needsReviewCount = len(results)
        return results, meta

    chunks: list[list[AnswerKeyItem]] = (
        [answer_key[i : i + QUESTIONS_PER_CALL] for i in range(0, len(answer_key), QUESTIONS_PER_CALL)]
        if answer_key
        else [[]]
    )

    attempts_total = 0
    errors: list[str] = []

    # Sidchunking: om dokumentet har fler sidor än MAX_PAGES_PER_CALL, dela
    # upp i överlappande chunkar (1-sidors överlapp) så att en uppgift som
    # spänner en chunkgräns inte klipps.
    if len(pages) > MAX_PAGES_PER_CALL:
        page_chunks: list[list[tuple[bytes, str]]] = []
        step = MAX_PAGES_PER_CALL - 1  # 1-sidors överlapp
        for i in range(0, len(pages), step):
            page_chunks.append(pages[i : i + MAX_PAGES_PER_CALL])
            if i + MAX_PAGES_PER_CALL >= len(pages):
                break
        logger.info(
            "grade_page_chunks request_id=%s total_pages=%d chunks=%d overlap=1",
            request_id, len(pages), len(page_chunks),
        )
    else:
        page_chunks = [pages]

    best_by_number: dict[str, QuestionResult] = {}
    all_unlisted: list[QuestionResult] = []

    async def _run_chunk(
        page_chunk: list[tuple[bytes, str]],
        chunk: list[AnswerKeyItem],
    ) -> tuple[list[QuestionResult], list[QuestionResult], int, str | None]:
        try:
            async with _CHUNK_SEMAPHORE:
                chunk_results, chunk_unlisted, attempts = await _analyze_chunk(
                    page_chunk, chunk, grading_notes, request_id
                )
            return chunk_results, chunk_unlisted, attempts, None
        except GradingError as e:
            logger.error(
                "grade_chunk_failed request_id=%s kind=%s error=%s",
                request_id, e.kind, e,
            )
            return (
                [_failed_question(item, f"{e.kind}: {e}") for item in chunk],
                [], MAX_ATTEMPTS, f"{e.kind}: {e}",
            )
        except Exception as e:  # oväntat – ska ändå aldrig krascha batchen
            logger.exception("grade_chunk_crashed request_id=%s", request_id)
            return (
                [_failed_question(item, f"unexpected: {e}") for item in chunk],
                [], MAX_ATTEMPTS, f"unexpected: {e}",
            )

    chunk_outputs = await asyncio.gather(*[
        _run_chunk(page_chunk, chunk)
        for page_chunk in page_chunks
        for chunk in chunks
    ])
    for chunk_results, chunk_unlisted, attempts, error in chunk_outputs:
        attempts_total += attempts
        if error:
            errors.append(error)
        for q in chunk_results:
            existing = best_by_number.get(q.questionNumber)
            if existing is None or _better_result(q, existing):
                best_by_number[q.questionNumber] = q
        all_unlisted.extend(chunk_unlisted)

    graded = list(best_by_number.values())
    unlisted = all_unlisted

    known = {q.questionNumber for q in graded}
    for extra in unlisted:
        if extra.questionNumber not in known:
            graded.append(extra)
            known.add(extra.questionNumber)

    meta.latencyMs = int((time.perf_counter() - started) * 1000)
    meta.attempts = attempts_total or 1
    meta.questionsFound = sum(1 for q in graded if q.found and q.inAnswerKey)
    meta.needsReviewCount = sum(
        1 for q in graded if q.assessment.status == "needs_review"
    )
    if errors:
        meta.error = " | ".join(errors)[:500]

    logger.info(
        "grade_done request_id=%s student=%s pages=%d expected=%d found=%d "
        "needs_review=%d unlisted=%d attempts=%d latency_ms=%d error=%s",
        request_id, student_label or "-", meta.pageCount, meta.questionsExpected,
        meta.questionsFound, meta.needsReviewCount, len(unlisted),
        meta.attempts, meta.latencyMs, meta.error or "-",
    )

    return graded, meta
