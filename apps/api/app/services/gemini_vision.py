"""Bildförst rättningsmotor för wiseOS.

Arkitektur:

    elevbild(er)  ->  Gemini multimodal  ->  extraktion + bedömning + annotering

Ett enda multimodalt anrop per elevdokument ser SAMTLIGA sidor och facit
samtidigt. Modellen transkriberar elevens faktiska arbete och bedömer det i
samma kontext, vilket gör att diagram, överstrykningar, pilar och matematisk
notation kan vägas in. Det finns medvetet ingen text-OCR som mellansteg –
bilden är source of truth.

Principer som koden upprätthåller (inte bara promptar om):
  * Aldrig påhittat elevarbete. Tom transkription -> needs_review, inte 0 poäng.
  * found=False endast när uppgiften saknas i dokumentet. Oläslig handstil
    ger found=True med låg transcriptionConfidence.
  * Tekniska fel (timeout/429/5xx/trasig JSON) blir needs_review med felorsak,
    aldrig ett hittepå-resultat och aldrig "eleven svarade fel".
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
import random
import re
import time
import uuid

import httpx

from ..config import settings
from ..schemas import (
    Annotation,
    AnswerKeyItem,
    Assessment,
    DocumentMeta,
    QuestionResult,
    SourceRegion,
)
from .anonymize import scrub_pii

logger = logging.getLogger("wiseos.grading")

API_ROOT = "https://generativelanguage.googleapis.com/v1beta"

IMAGE_MIME_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif", "image/heic"}

# Multimodala anrop över flera sidor är tunga. Timeout är generös och
# kompletteras med retry i stället för att klassa en långsam men lyckad
# analys som misslyckad.
REQUEST_TIMEOUT_SECONDS = 180.0
MAX_ATTEMPTS = 4
BACKOFF_BASE_SECONDS = 2.0
BACKOFF_MAX_SECONDS = 30.0

# Så många uppgifter bedöms per anrop. Alla sidor skickas alltid med, men
# uppgiftslistan delas upp så att långa prov inte slår i output-taket.
QUESTIONS_PER_CALL = 8

MAX_OUTPUT_TOKENS = 8192

# Under detta värde litar vi inte på transkriptionen och lämnar till lärare.
TRANSCRIPTION_REVIEW_THRESHOLD = 0.55


class GradingError(RuntimeError):
    """Tekniskt fel som ska ytas som needs_review, inte som ett elevfel."""

    def __init__(self, message: str, *, kind: str):
        super().__init__(message)
        self.kind = kind


# ---------------------------------------------------------------------------
# Structured output-schema
# ---------------------------------------------------------------------------

_REGION_SCHEMA = {
    "type": "object",
    "properties": {
        "page": {"type": "integer"},
        "x": {"type": "number"},
        "y": {"type": "number"},
        "width": {"type": "number"},
        "height": {"type": "number"},
    },
    "required": ["page", "x", "y", "width", "height"],
}

ANALYSIS_SCHEMA = {
    "type": "object",
    "properties": {
        "questions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "question_number": {"type": "string"},
                    "found": {"type": "boolean"},
                    "question_text": {"type": "string"},
                    "student_work": {"type": "string"},
                    "transcription_confidence": {"type": "number"},
                    "source_regions": {"type": "array", "items": _REGION_SCHEMA},
                    "status": {
                        "type": "string",
                        "enum": ["correct", "partial", "incorrect", "needs_review"],
                    },
                    "points": {"type": "number"},
                    "assessment_confidence": {"type": "number"},
                    "feedback": {"type": "string"},
                    "annotation_summary": {"type": "string"},
                    "annotation_evidence": {"type": "array", "items": {"type": "string"}},
                    "annotation_issues": {"type": "array", "items": {"type": "string"}},
                    "annotation_suggestions": {"type": "array", "items": {"type": "string"}},
                    "correct_answer": {"type": "string"},
                    "max_points": {"type": "number"},
                },
                "required": [
                    "question_number",
                    "found",
                    "question_text",
                    "student_work",
                    "transcription_confidence",
                    "source_regions",
                    "status",
                    "points",
                    "assessment_confidence",
                    "feedback",
                    "annotation_summary",
                    "annotation_evidence",
                    "annotation_issues",
                    "annotation_suggestions",
                ],
            },
        },
        "unlisted_questions": {
            "type": "array",
            "description": "Uppgifter som syns i dokumentet men saknas i facit.",
            "items": {
                "type": "object",
                "properties": {
                    "question_number": {"type": "string"},
                    "question_text": {"type": "string"},
                    "student_work": {"type": "string"},
                    "transcription_confidence": {"type": "number"},
                    "source_regions": {"type": "array", "items": _REGION_SCHEMA},
                },
                "required": [
                    "question_number",
                    "question_text",
                    "student_work",
                    "transcription_confidence",
                    "source_regions",
                ],
            },
        },
    },
    "required": ["questions", "unlisted_questions"],
}


SYSTEM_INSTRUCTION = """Du är wiseOS bedömningsmotor för inskannade elevprov.

BILDEN ÄR SOURCE OF TRUTH.
Titta på bilden först. Utgå aldrig från att en textrepresentation är komplett.

TRANSKRIPTION
- Identifiera elevens faktiska handskrift och markeringar.
- Hitta ALDRIG på elevarbete. Skriv aldrig det förväntade svaret i student_work.
- Att du vet vad rätt svar är betyder INTE att eleven skrivit det.
- Bevara matematisk notation, enheter, mellanled och radbrytningar.
- Skilj tryckt uppgiftstext från det eleven skrivit. Endast elevens egna
  anteckningar hör hemma i student_work.
- Skilj lärarkommentarer och redan satta poäng från elevens arbete. Ta inte med dem.
- Om provsidan bara innehåller tryckta exempel- eller modellsvar (t.ex. 'ELEVSVAR', 'Exempel', 'Student A/B/C'), behandla det första fullständiga exempelsvaret som elevens arbete.
- Överstruket arbete som eleven tydligt förkastat ska markeras
  "[överstruket: ...]" och inte räknas som elevens slutgiltiga svar.
- Beskriv diagram och figurer eleven ritat i klartext, t.ex.
  "[figur: graf med E_k på y-axeln och T på x-axeln, rät linje uppåt]".

KOPPLING TILL RÄTT UPPGIFT
- Koppla elevarbete till det uppgiftsnummer det hör till, inte till närmaste
  textblock. Svar kan stå bredvid, under eller på nästa sida.
- Om samma uppgiftsnummer förekommer flera gånger i dokumentet (t.ex. två
  fotograferade ark) ska du slå ihop det till EN uppgift och ta med allt
  elevarbete. Lista då en source_region per förekomst.
- Om flera olika uppgiftsnummer syns på samma sida (1., 2., 3., ...) ska varje
  uppgift få EGET student_work. Blanda aldrig svaret till uppgift 2 in i
  student_work för uppgift 1. student_work ska endast innehålla det eleven
  skrivit för det aktuella question_number.
- Om en uppgift börjar på en sida och fortsätter på nästa: EN uppgift, ett
  samlat student_work, flera source_regions.

found
- found=true betyder att uppgiften finns i dokumentet.
- found=false ENDAST när uppgiften faktiskt inte finns i dokumentet.
- Matcha uppgifter främst på uppgiftsnummer. Facitets frågetext är en ledtråd,
  inte ett krav på ordagrant stämmer. Om rätt nummer syns: found=true.
- Om du ser uppgiften men handstilen är svårläst: found=true, ge din bästa
  visuella transkription och sätt låg transcription_confidence.
- Om uppgiften finns men eleven lämnat den tom: found=true, student_work="".

BEDÖMNING
- Bedöm endast det underlag som syns i bilden.
- Följ rubriken/poängmatrisen när sådan ges. Saknas den, bedöm mot facit och
  sänk assessment_confidence.
- Ge delpoäng när metoden är rätt men utförandet brister.
- Räkna efter elevens matematik steg för steg. Rätt metod med räknefel är
  "partial", inte "correct".
- Är underlaget otillräckligt för en rättvis bedömning: status="needs_review".
- points måste ligga mellan 0 och uppgiftens max_points.

FACITFRITT LÄGE
- Om inget facit anges agerar DU som facit.
- LÄS UPPGIFTSTEXTEN ORDAGRANT FRÅN BILDEN. Hitta aldrig på frågor.
- Om en uppgift inte syns i bilden: inkludera den INTE i `questions`.
- För varje uppgift du VERKLIGEN ser, ange `correct_answer` (det korrekta svaret)
  och `max_points` (rimlig maxpoäng, ofta 1), sedan bedöm elevens `student_work`.

ANNOTERING
- annotation_evidence: konkreta saker eleven bevisligen gjort rätt.
- annotation_issues: konkreta fel i elevens arbete.
- Varje punkt ska referera till något som faktiskt syns i elevens arbete.
- Är student_work tomt ska evidence och issues vara tomma listor.

KOORDINATER
- source_regions anges normaliserat [0,1] relativt sidan.
- page är 1-indexerad och matchar ordningen bilderna skickades i.

Svara enbart med JSON enligt schemat. Inget resonemang, inga kodblock."""


# ---------------------------------------------------------------------------
# Hjälpare
# ---------------------------------------------------------------------------


def normalize_mime(mime_type: str) -> str:
    mime = (mime_type or "").split(";")[0].strip().lower()
    if mime in ("image/jpg", "image/pjpeg"):
        return "image/jpeg"
    return mime


def is_supported_image(mime_type: str) -> bool:
    return normalize_mime(mime_type) in IMAGE_MIME_TYPES


def is_supported_document(mime_type: str) -> bool:
    return is_supported_image(mime_type) or normalize_mime(mime_type) == "application/pdf"


def available() -> bool:
    return bool(settings.GEMINI_API_KEY)


def _strip_wrappers(text: str) -> str:
    """Tar bort kodblocksstaket och ev. resonemangsprefix runt JSON."""
    if not text:
        return ""
    text = re.sub(r"<thinking>.*?</thinking>", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"^\s*```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```\s*$", "", text)
    return text.strip()


def _escape_control_chars_in_strings(text: str) -> str:
    """Escapar råa radbrytningar/tabbar inuti JSON-strängar.

    Modellen transkriberar flerradigt elevarbete och släpper då ibland in en
    rå newline i en sträng, vilket är ogiltig JSON. Vi lagar det utan att röra
    innehållet i övrigt.
    """
    out: list[str] = []
    in_string = False
    escaped = False
    for ch in text:
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            elif ch == "\n":
                out.append("\\n")
                continue
            elif ch == "\r":
                out.append("\\r")
                continue
            elif ch == "\t":
                out.append("\\t")
                continue
        elif ch == '"':
            in_string = True
        out.append(ch)
    return "".join(out)


def _parse_json_object(raw: str) -> dict:
    """Tolererar prat och små formatfel runt JSON, men aldrig påhittat innehåll."""
    cleaned = _strip_wrappers(raw)
    if not cleaned:
        raise GradingError("Modellen returnerade tomt svar.", kind="empty_response")

    start, end = cleaned.find("{"), cleaned.rfind("}")
    candidates = [cleaned]
    if start != -1 and end > start:
        candidates.append(cleaned[start : end + 1])
    # Sista utvägen: laga råa kontrolltecken inuti strängar.
    candidates.extend(_escape_control_chars_in_strings(c) for c in list(candidates))

    last_error: Exception | None = None
    for candidate in candidates:
        try:
            data = json.loads(candidate)
        except json.JSONDecodeError as e:
            last_error = e
            continue
        if not isinstance(data, dict):
            raise GradingError(
                "Modellsvaret var inte ett JSON-objekt.", kind="invalid_json"
            )
        return data

    raise GradingError(
        f"Kunde inte tolka JSON: {last_error}", kind="invalid_json"
    ) from last_error


def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def _coerce_float(value: object, default: float = 0.0) -> float:
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


def _normalize_regions(raw: object, page_count: int) -> list[SourceRegion]:
    if not isinstance(raw, list):
        return []
    regions: list[SourceRegion] = []
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        page = int(_coerce_float(entry.get("page"), 1.0)) or 1
        page = max(1, min(page_count or 1, page))
        coords: dict[str, float] = {}
        for key in ("x", "y", "width", "height"):
            val = _coerce_float(entry.get(key))
            # Vissa modeller svarar i 0-1000 i stället för 0-1.
            if val > 1.0:
                val = val / 1000.0
            coords[key] = _clamp(val)
        if coords["width"] <= 0 or coords["height"] <= 0:
            continue
        regions.append(SourceRegion(page=page, **coords))
    return regions


def _clean_line(text: object, limit: int) -> str:
    if not isinstance(text, str):
        return ""
    return _strip_wrappers(text)[:limit].strip()


def _string_list(raw: object, limit: int = 6) -> list[str]:
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    for entry in raw:
        cleaned = _clean_line(entry, 300)
        if cleaned:
            out.append(cleaned)
        if len(out) >= limit:
            break
    return out


# ---------------------------------------------------------------------------
# Gemini-anrop med retry
# ---------------------------------------------------------------------------


def _classify_status(status_code: int) -> str:
    if status_code == 429:
        return "rate_limited"
    if status_code >= 500:
        return "server_error"
    if status_code == 404:
        return "model_not_found"
    if status_code in (401, 403):
        return "auth_error"
    return "http_error"


def _is_retryable(kind: str) -> bool:
    """Vilka fel som är värda ett nytt försök.

    invalid_json/empty_response/max_tokens är stokastiska formatfel från
    modellen – en ny sampling ger nästan alltid giltig JSON. De MÅSTE därför
    retryas, annars tappar vi hela uppgiftsgruppen på ett övergående fel.
    """
    return kind in {
        "rate_limited",
        "server_error",
        "timeout",
        "network_error",
        "invalid_json",
        "empty_response",
        "max_tokens",
    }


async def _generate_json(payload: dict, *, request_id: str) -> tuple[dict, int]:
    """Gemini-anrop + JSON-tolkning med exponentiell backoff.

    Tolkningen ligger MEDVETET inne i retry-loopen: ett trasigt JSON-svar är
    lika övergående som en 503 och ska ge ett nytt försök, inte ett tappat
    resultat. Returnerar (parsed, attempts).
    """
    if not settings.GEMINI_API_KEY:
        raise GradingError("GEMINI_API_KEY saknas.", kind="not_configured")

    url = f"{API_ROOT}/models/{settings.GEMINI_MODEL}:generateContent"
    last_error: GradingError | None = None

    # GDPR-bevis: logga textdelen av prompten (utan bildbytes) precis INNAN
    # den lämnar backend, så att man i terminalen kan se att PII redan är
    # skrubbad. Endast text-parts loggas – inline_data (bildbytes) exkluderas.
    outgoing_text = "\n".join(
        p["text"] for p in payload["contents"][0]["parts"] if "text" in p
    )
    logger.debug(
        "gemini_outgoing_prompt request_id=%s text=%r", request_id, outgoing_text,
    )

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
                response = await client.post(
                    url,
                    headers={"x-goog-api-key": settings.GEMINI_API_KEY},
                    json=payload,
                )
            if response.status_code >= 400:
                kind = _classify_status(response.status_code)
                detail = response.text[:300]
                last_error = GradingError(
                    f"Gemini {response.status_code}: {detail}", kind=kind
                )
                if not _is_retryable(kind) or attempt == MAX_ATTEMPTS:
                    raise last_error
            else:
                body = response.json()
                candidates = body.get("candidates") or []
                if not candidates:
                    reason = (body.get("promptFeedback") or {}).get("blockReason")
                    raise GradingError(
                        f"Gemini gav inga kandidater (blockReason={reason}).",
                        kind="blocked" if reason else "empty_response",
                    )
                candidate = candidates[0]
                finish = candidate.get("finishReason")
                parts = (candidate.get("content") or {}).get("parts") or []
                text = "".join(p.get("text", "") for p in parts).strip()
                if finish == "MAX_TOKENS" and not text:
                    raise GradingError(
                        "Svaret klipptes av innan något innehåll producerades.",
                        kind="max_tokens",
                    )
                if not text:
                    raise GradingError(
                        f"Gemini gav tomt innehåll (finishReason={finish}).",
                        kind="empty_response",
                    )
                # Tolka direkt så att formatfel omfattas av samma retry.
                return _parse_json_object(text), attempt

        except httpx.TimeoutException as e:
            last_error = GradingError(f"Timeout mot Gemini: {e}", kind="timeout")
        except httpx.HTTPError as e:
            last_error = GradingError(f"Nätverksfel mot Gemini: {e}", kind="network_error")
        except GradingError as e:
            last_error = e
            if not _is_retryable(e.kind):
                raise

        if attempt < MAX_ATTEMPTS and last_error and _is_retryable(last_error.kind):
            delay = min(BACKOFF_BASE_SECONDS * (2 ** (attempt - 1)), BACKOFF_MAX_SECONDS)
            delay += random.uniform(0, 0.5 * delay)  # jitter mot samtidiga retries
            logger.warning(
                "gemini_retry request_id=%s attempt=%d/%d kind=%s delay=%.1fs",
                request_id, attempt, MAX_ATTEMPTS, last_error.kind, delay,
            )
            await asyncio.sleep(delay)
            continue
        break

    raise last_error or GradingError("Okänt fel mot Gemini.", kind="unknown")


# ---------------------------------------------------------------------------
# Promptbygge
# ---------------------------------------------------------------------------


def _format_question_brief(item: AnswerKeyItem) -> str:
    lines = [f"UPPGIFT {item.question_number}"]
    lines.append(f"  Max poäng: {item.max_points}")
    if item.final_answer.strip():
        lines.append(f"  Facit/förväntat svar: {item.final_answer.strip()}")
    if item.acceptable_answers:
        lines.append(f"  Godtagbara alternativ: {'; '.join(item.acceptable_answers)}")
    if item.derivation_steps:
        steps = "; ".join(s.strip() for s in item.derivation_steps if s.strip())
        if steps:
            lines.append(f"  Förväntade lösningssteg: {steps}")
    if item.important_concepts:
        lines.append(f"  Viktiga begrepp: {'; '.join(item.important_concepts)}")
    if item.reasoning_requirements:
        lines.append(f"  Resonemangskrav: {'; '.join(item.reasoning_requirements)}")
    if item.rubric:
        lines.append("  Poängmatris:")
        for level in sorted(item.rubric, key=lambda k: _coerce_float(k, 0.0), reverse=True):
            lines.append(f"    {level}p = {item.rubric[level]}")
    else:
        lines.append(
            "  Poängmatris: saknas – bedöm mot facit och sänk assessment_confidence."
        )
    return "\n".join(lines)


def _build_prompt(
    items: list[AnswerKeyItem],
    page_count: int,
    grading_notes: str,
) -> str:
    pages_desc = (
        f"Dokumentet består av {page_count} sida/sidor, bifogade i ordning "
        f"(sida 1 först)."
        if page_count > 1
        else "Dokumentet består av 1 sida."
    )
    notes = grading_notes.strip()
    notes_block = (
        f"\nLärarens bedömningsanvisningar (gäller alla uppgifter):\n{notes}\n"
        if notes
        else ""
    )

    if not items:
        return (
            f"{pages_desc}\n"
            f"Ett och samma elevdokument. Inget facit är angivet.\n\n"
            f"1. Identifiera ENDAST uppgifter som FAKTISKT SYNS med text i bilden. "
            f"Hitta ALDRIG på frågor.\n"
            f"2. Ser du ingen tryckt frågetext: returnera en TOM 'questions'-lista.\n"
            f"3. För varje uppgift du ser, ange question_number, question_text, "
            f"correct_answer (det rätta svaret enligt dig) och max_points.\n"
            f"4. Transkribera exakt vad eleven skrivit (student_work).\n"
            f"5. Bedöm elevens svar mot din egen correct_answer och sätt status, "
            f"points, feedback och annotering.\n"
            f"6. Ange source_regions för elevens arbete.\n"
            f"7. Lämna 'unlisted_questions' tom.\n"
            f"{notes_block}\n"
        )

    numbers = ", ".join(item.question_number for item in items)
    return (
        f"{pages_desc}\n"
        f"Ett och samma elevdokument. Analysera samtliga sidor tillsammans.\n\n"
        f"Bedöm dessa uppgiftsnummer: {numbers}\n\n"
        f"{chr(10).join(_format_question_brief(i) for i in items)}\n"
        f"{notes_block}\n"
        f"För varje uppgift ovan:\n"
        f"1. Leta upp uppgiften i bilden efter uppgiftsnumret och sätt found. "
        f"Facitets frågetext är en ledtråd, inte ett krav på exakt match. "
        f"Hittar du rätt nummer: found=true.\n"
        f"2. Transkribera exakt vad eleven skrivit (student_work).\n"
        f"3. student_work får ENDAST innehålla texten för det aktuella question_number. "
        f"Blanda aldrig in svar från andra uppgiftsnummer.\n"
        f"4. Ange source_regions för elevens arbete.\n"
        f"5. Bedöm mot facit/poängmatris och sätt status och points.\n"
        f"6. Skriv feedback till eleven samt strukturerad annotering.\n\n"
        f"Lägg uppgifter som syns i dokumentet men INTE finns i listan ovan "
        f"i 'unlisted_questions'. Bedöm dem inte.\n"
        f"Om ingen sådan finns: returnera en tom lista."
    )


def _build_payload(
    pages: list[tuple[bytes, str]],
    items: list[AnswerKeyItem],
    grading_notes: str,
) -> dict:
    parts: list[dict] = [{"text": _build_prompt(items, len(pages), grading_notes)}]
    for index, (data, mime) in enumerate(pages, start=1):
        parts.append({"text": f"--- Sida {index} ---"})
        parts.append(
            {
                "inline_data": {
                    "mime_type": normalize_mime(mime),
                    "data": base64.b64encode(data).decode("ascii"),
                }
            }
        )
    return {
        "systemInstruction": {"parts": [{"text": SYSTEM_INSTRUCTION}]},
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {
            "temperature": 0.0,
            "maxOutputTokens": MAX_OUTPUT_TOKENS,
            "responseMimeType": "application/json",
            "responseSchema": ANALYSIS_SCHEMA,
        },
    }


# ---------------------------------------------------------------------------
# Tolkning av modellsvar -> kanoniska QuestionResult
# ---------------------------------------------------------------------------


def _question_from_payload(
    raw: dict,
    item: AnswerKeyItem,
    page_count: int,
) -> QuestionResult:
    max_points = float(item.max_points or 1.0)
    found = bool(raw.get("found", False))
    student_work = _clean_line(raw.get("student_work"), 8000)
    transcription_confidence = _clamp(_coerce_float(raw.get("transcription_confidence")))
    question_text = _clean_line(raw.get("question_text"), 1000) or item.question_text

    status = raw.get("status")
    if status not in ("correct", "partial", "incorrect", "needs_review"):
        status = "needs_review"

    points = round(_clamp(_coerce_float(raw.get("points")), 0.0, max_points), 2)
    assessment_confidence = _clamp(_coerce_float(raw.get("assessment_confidence")))
    feedback = _clean_line(raw.get("feedback"), 1200)

    annotation = Annotation(
        summary=_clean_line(raw.get("annotation_summary"), 600),
        evidence=_string_list(raw.get("annotation_evidence")),
        issues=_string_list(raw.get("annotation_issues")),
        suggestions=_string_list(raw.get("annotation_suggestions")),
    )
    regions = _normalize_regions(raw.get("source_regions"), page_count)

    # --- Invarianter som koden garanterar oavsett vad modellen svarar ---

    if not found:
        # Uppgiften finns inte i dokumentet: ingen bedömning, inget påhittat arbete.
        student_work = ""
        status = "needs_review"
        points = 0.0
        annotation = Annotation(
            summary="Uppgiften kunde inte hittas i det uppladdade dokumentet.",
        )
        if not feedback:
            feedback = (
                "Uppgiften hittades inte i dokumentet. Kontrollera att alla sidor "
                "är uppladdade."
            )
    elif not student_work:
        # Uppgiften finns men eleven har inte svarat -> 0 poäng är ett giltigt
        # resultat, men bara om modellen är säker på att fältet är tomt.
        if transcription_confidence >= TRANSCRIPTION_REVIEW_THRESHOLD:
            status = "incorrect" if status != "needs_review" else "needs_review"
        else:
            status = "needs_review"
        points = 0.0
        annotation = Annotation(
            summary="Inget elevarbete syns för denna uppgift.",
            suggestions=annotation.suggestions,
        )
        if not feedback:
            feedback = "Uppgiften lämnades obesvarad."
    elif transcription_confidence < TRANSCRIPTION_REVIEW_THRESHOLD:
        # Vi har en transkription men litar inte på den -> människa avgör.
        # Transkriptionen behålls så att läraren ser vad AI:n läste.
        status = "needs_review"
        points = 0.0

    if status == "correct" and points < max_points:
        # Full status kräver full poäng, annars är det delpoäng.
        status = "partial" if points > 0 else "incorrect"

    # --- Upptäck uppenbar svarsblandning (t.ex. svaret till uppgift 2 i uppgift 1) ---
    contaminated = False
    if student_work:
        match = re.search(r"^\s*(\d+)(?:[a-zA-Z])?[.\)]", student_work, re.MULTILINE)
        if match:
            current_num = re.match(r"(\d+)", str(item.question_number))
            if current_num and match.group(1) != current_num.group(1):
                contaminated = True
    if contaminated:
        status = "needs_review"
        points = 0.0
        feedback = (
            "Potentiell svarsblandning: text från flera uppgifter hittades i samma fält. "
            "Lärargranskning krävs."
        )
        annotation = Annotation(
            summary=feedback,
            issues=["Text som kan tillhöra en annan uppgift hittades i student_work."],
        )

    ai_verdict = status
    base_annotation = (annotation.summary or feedback).strip()

    return QuestionResult(
        questionNumber=str(item.question_number).strip(),
        found=found,
        inAnswerKey=True,
        questionText=question_text,
        studentWork=student_work,
        transcriptionConfidence=transcription_confidence,
        correctAnswer=item.final_answer,
        assessment=Assessment(
            status=status,
            points=points,
            maxPoints=max_points,
            confidence=assessment_confidence,
        ),
        feedback=feedback,
        annotation=annotation,
        sourceRegions=regions,
        aiVerdict=ai_verdict,
        baseAnnotation=base_annotation,
    )


def _unlisted_from_payload(raw: dict, page_count: int) -> QuestionResult | None:
    number = _clean_line(raw.get("question_number"), 20)
    if not number:
        return None
    student_work = _clean_line(raw.get("student_work"), 8000)
    unlisted_feedback = (
        "Uppgiften hittades i dokumentet men saknas i facit. "
        "Lägg till den i facit för att kunna poängsätta den."
    )
    unlisted_base = "Uppgift utan motsvarighet i facit – kräver lärarbeslut."
    return QuestionResult(
        questionNumber=number,
        found=True,
        inAnswerKey=False,
        questionText=_clean_line(raw.get("question_text"), 1000),
        studentWork=student_work,
        transcriptionConfidence=_clamp(_coerce_float(raw.get("transcription_confidence"))),
        correctAnswer="",
        assessment=Assessment(status="needs_review", points=0.0, maxPoints=0.0),
        feedback=unlisted_feedback,
        annotation=Annotation(
            summary=unlisted_base,
        ),
        sourceRegions=_normalize_regions(raw.get("source_regions"), page_count),
        aiVerdict="needs_review",
        baseAnnotation=unlisted_base,
    )


def _failed_question(item: AnswerKeyItem, error: str) -> QuestionResult:
    """Tekniskt fel: yta det ärligt i stället för att gissa ett resultat."""
    base = f"Teknisk analys misslyckades: {error}"
    return QuestionResult(
        questionNumber=str(item.question_number).strip(),
        found=False,
        inAnswerKey=True,
        questionText=item.question_text,
        studentWork="",
        transcriptionConfidence=0.0,
        correctAnswer=item.final_answer,
        assessment=Assessment(
            status="needs_review", points=0.0, maxPoints=float(item.max_points or 1.0)
        ),
        feedback="Uppgiften kunde inte bedömas automatiskt. Manuell granskning krävs.",
        annotation=Annotation(summary=base),
        error=error,
        aiVerdict="error",
        baseAnnotation=base,
    )


# ---------------------------------------------------------------------------
# Publikt API
# ---------------------------------------------------------------------------


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
    """Kör bildförst-analys av ett helt elevdokument.

    `pages` är sidorna i ordning som (bytes, mime). Alla sidor skickas i samma
    anrop så att modellen kan koppla ihop en uppgift som fortsätter på nästa sida.

    Kastar aldrig – tekniska fel returneras som needs_review med felorsak.
    """
    request_id = uuid.uuid4().hex[:12]
    started = time.perf_counter()
    meta = DocumentMeta(
        pageCount=len(pages),
        model=settings.GEMINI_MODEL,
        questionsExpected=len(answer_key),
    )

    # GDPR-anonymiseringssköld: lärarens fritextanvisningar (grading_notes)
    # kan innehålla PII (t.ex. om ett elevnamn/personnummer råkar skrivas in
    # i klass- eller provparametrarna). Skrubba INNAN texten läggs i prompten
    # som skickas till Gemini. Bildinnehållet (elevens handskrift) är en
    # separat, känd kvarstående risk – se GDPR-planen §1.1.
    raw_grading_notes = grading_notes
    grading_notes = scrub_pii(grading_notes)
    if raw_grading_notes != grading_notes:
        logger.warning(
            "pii_scrubbed_from_grading_notes request_id=%s", request_id,
        )

    # Elevnamnet (student_label) loggas ENDAST lokalt för felsökning – det
    # skickas aldrig med i payloaden/prompten till Gemini (se _build_payload).
    logger.info(
        "grade_start request_id=%s student=%s pages=%d questions=%d model=%s",
        request_id, student_label or "-", len(pages), len(answer_key), settings.GEMINI_MODEL,
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

    graded: list[QuestionResult] = []
    unlisted: list[QuestionResult] = []
    attempts_total = 0
    errors: list[str] = []

    for chunk in chunks:
        try:
            chunk_results, chunk_unlisted, attempts = await _analyze_chunk(
                pages, chunk, grading_notes, request_id
            )
            graded.extend(chunk_results)
            unlisted.extend(chunk_unlisted)
            attempts_total += attempts
        except GradingError as e:
            logger.error(
                "grade_chunk_failed request_id=%s kind=%s error=%s",
                request_id, e.kind, e,
            )
            errors.append(f"{e.kind}: {e}")
            graded.extend(_failed_question(item, f"{e.kind}: {e}") for item in chunk)
            attempts_total += MAX_ATTEMPTS
        except Exception as e:  # oväntat – ska ändå aldrig krascha batchen
            logger.exception("grade_chunk_crashed request_id=%s", request_id)
            errors.append(f"unexpected: {e}")
            graded.extend(_failed_question(item, f"unexpected: {e}") for item in chunk)

    # Uppgifter som finns i dokumentet men saknas i facit läggs sist,
    # deduplicerade mot facitnumren.
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
