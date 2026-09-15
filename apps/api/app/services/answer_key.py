"""Answer-key extraction for uploaded facit documents."""
from __future__ import annotations

import asyncio
import base64
import json
import logging
import re

from ..config import settings
from ..schemas import AnswerKeyItem
from . import gemini_client, openai_client, vision_ocr

logger = logging.getLogger("wiseos.grading")


SYSTEM_PROMPT = """Du är facit-extraheraren i wiseOS. Analysera det uppladdade facitdokumentet och extrahera varje uppgift som ett JSON-objekt. För varje uppgift, fång:
1. Nummer (question_number).
2. Själva frågan/uppdraget (question_text) – ordagrant eller en kort sammanfattning om texten är lång.
3. Förväntat korrekt svar (final_answer).
4. Godtagbara alternativa svar (acceptable_answers).
5. Eventuella lösningssteg (derivation_steps), viktiga begrepp (important_concepts) och resonemangskrav (reasoning_requirements).
6. Om matematisk verifiering är relevant (mathematical_verification).
7. Maxpoäng (max_points) – 1.0 om inget poängantal syns.

Svara ENDAST med en giltig JSON-array. Inga förklaringar, inga kodblock, ingen annan text.

[
  {
    "question_number": "1",
    "question_text": "Hur många meter är 1 km?",
    "final_answer": "1000 m",
    "derivation_steps": [],
    "max_points": 1
  },
  {
    "question_number": "2",
    "question_text": "Sveriges huvudstad?",
    "final_answer": "Stockholm",
    "derivation_steps": [],
    "max_points": 1
  }
]"""


def _mock_answer_key(size: int) -> list[AnswerKeyItem]:
    """Vi använder aldrig ett statiskt demo-facit."""
    raise RuntimeError("Inget facit tillgängligt. Kontrollera API-nycklar eller uppladdat facit.")


def _extract_json_array(text: str) -> list[dict]:
    raw = text.strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("[")
        end = raw.rfind("]")
        if start == -1 or end == -1 or end <= start:
            raise ValueError("Modellen returnerade ingen JSON-array")
        data = json.loads(raw[start : end + 1])

    # JSON-läget på OpenAI kräver ett objekt, så facit levereras som {"items": [...]}.
    if isinstance(data, dict):
        for key in ("items", "answer_key", "questions", "facit"):
            if isinstance(data.get(key), list):
                data = data[key]
                break

    if not isinstance(data, list):
        raise ValueError("JSON-svaret innehöll ingen lista med uppgifter")
    return data


GENERATE_PROMPT = (
    "Du är wiseOS facitmotor för svenska prov i olika ämnen. "
    "Konstruera ett rimligt facit utifrån provets beskrivning. "
    "Varje uppgift ska innehålla frågan, förväntat svar, godtagbara alternativ, lösningssteg, viktiga begrepp, resonemangskrav, matematisk verifiering och maxpoäng. "
    'Svara enbart med JSON på formen '
    '{"items": [{"question_number": "1", "question_text": "Frågan", "final_answer": "Svar", '
    '"acceptable_answers": [], "derivation_steps": [], "important_concepts": [], '
    '"reasoning_requirements": [], "mathematical_verification": false, "max_points": 1}]}'
)


def _normalize_question_number(qn: str) -> str:
    """Ta bort vanliga prefix/suffix kring numret, t.ex. 'Uppgift 1.', '1)', 'Q1'."""
    s = str(qn).strip()
    # Matcha "Uppgift 1" / "1." / "1)" / "Q1" etc.
    m = re.search(r"([A-Za-z]*)(\d+[A-Za-z]?)", s)
    if m:
        return m.group(2).lower()
    return s


def _parse_items(text: str) -> list[AnswerKeyItem]:
    items = [AnswerKeyItem.model_validate(item) for item in _extract_json_array(text)]
    for item in items:
        item.question_number = _normalize_question_number(item.question_number)
    return items


async def _extract_with_vision(file_bytes: bytes, mime_type: str) -> list[AnswerKeyItem] | None:
    """Läser facit från bild via den gratis vision-providern som är konfigurerad."""
    try:
        text = await vision_ocr.read_image(
            file_bytes,
            mime_type,
            prompt=f"{SYSTEM_PROMPT}\n\nExtrahera facit från den här bilden.",
        )
        if not text:
            return None
        items = _parse_items(text)
        return items or None
    except Exception:
        return None


async def generate_answer_key(description: str, question_count: int = 4) -> list[AnswerKeyItem]:
    """Skapar ett facit från en textbeskrivning när läraren inte laddat upp något."""
    if not openai_client.openai_enabled():
        return _mock_answer_key(question_count)

    prompt = (
        f"Skapa ett facit med {question_count} uppgifter för följande prov.\n\n"
        f"Provbeskrivning: {description.strip() or 'Fysik 1, blandade uppgifter.'}"
    )
    try:
        text = await openai_client.complete_text(
            GENERATE_PROMPT,
            prompt,
            max_tokens=1400,
            temperature=0.3,
            json_mode=True,
        )
        items = _parse_items(text)
        return items or _mock_answer_key(question_count)
    except Exception:
        return _mock_answer_key(question_count)


async def extract_answer_key(file_bytes: bytes, mime_type: str) -> list[AnswerKeyItem]:
    if not settings.ANTHROPIC_API_KEY:
        items = await _extract_with_vision(file_bytes, mime_type)
        return items if items else _mock_answer_key(len(file_bytes))

    try:
        from .providers.registry import get_claude_vision_provider

        adapter = get_claude_vision_provider()
        return await adapter.extract_answer_key(file_bytes, mime_type)
    except Exception:
        items = await _extract_with_vision(file_bytes, mime_type)
        return items if items else _mock_answer_key(len(file_bytes))


class QuestionSheetInferenceError(RuntimeError):
    def __init__(self, message: str, *, kind: str):
        super().__init__(message)
        self.kind = kind


_REGION_SCHEMA = {
    "type": "object",
    "properties": {
        "x": {"type": "number"},
        "y": {"type": "number"},
        "width": {"type": "number"},
        "height": {"type": "number"},
    },
    "required": ["x", "y", "width", "height"],
}

QUESTION_SHEET_SCHEMA = {
    "type": "object",
    "properties": {
        "primaryDocumentFound": {"type": "boolean"},
        "primaryDocumentConfidence": {"type": "number"},
        "primaryDocumentRegion": _REGION_SCHEMA,
        "multipleDocumentsAmbiguous": {"type": "boolean"},
        "ambiguityReason": {"type": "string"},
        "questions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "question_number": {"type": "string"},
                    "question_text": {"type": "string"},
                    "max_points": {"type": "number"},
                    "confidence": {"type": "number"},
                    "question_region": _REGION_SCHEMA,
                },
                "required": [
                    "question_number", "question_text", "max_points",
                    "confidence", "question_region",
                ],
            },
        },
    },
    "required": [
        "primaryDocumentFound", "primaryDocumentConfidence",
        "primaryDocumentRegion", "multipleDocumentsAmbiguous",
        "ambiguityReason", "questions",
    ],
}

QUESTION_SHEET_PROMPT = """Du analyserar ett svenskt frågeblad som läraren
markerat som referensunderlag. Bilden FÅR vara en skärmdump och FÅR innehålla
webbläsarens adressfält, filnamn, knappar och bakgrund runt pappret.

1. Identifiera den PRIMÄRA PAPPERSYTAN: det största tydliga, centrala och
   sammanhängande frågebladet. UI utanför papperet är tillåtet och ignoreras.
2. En mindre, perifer eller kantklippt grannbild är ALDRIG primärt dokument.
   Läs ingen text från den.
3. Extrahera endast tryckta uppgifter vars text och region ligger på den valda
   pappersytan. Fristående tal/handskrift i marginaler är inte frågor.
4. Returnera INGA svar, inget studentWork, inga poängbedömningar och ingen
   feedback. Endast uppgiftsnummer, frågetext, synlig maxpoäng och region.
5. Koordinater anges normaliserat 0..1 relativt hela bilden.
6. Sätt multipleDocumentsAmbiguous=true endast om två fullständiga dokument är
   ungefär lika framträdande och inget säkert primärt frågeblad kan väljas.
7. Om huvudpappret är tydligt men UI syns runtom: primaryDocumentFound=true.

Svara endast med JSON enligt det givna schemat."""

_SOLVED_ITEMS_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "question_number": {"type": "string"},
                    "question_text": {"type": "string"},
                    "final_answer": {"type": "string"},
                    "acceptable_answers": {"type": "array", "items": {"type": "string"}},
                    "derivation_steps": {"type": "array", "items": {"type": "string"}},
                    "important_concepts": {"type": "array", "items": {"type": "string"}},
                    "reasoning_requirements": {"type": "array", "items": {"type": "string"}},
                    "mathematical_verification": {"type": "boolean"},
                    "max_points": {"type": "number"},
                },
                "required": [
                    "question_number", "question_text", "final_answer",
                    "acceptable_answers", "derivation_steps", "important_concepts",
                    "reasoning_requirements", "mathematical_verification", "max_points",
                ],
            },
        },
    },
    "required": ["items"],
}


def _balanced_json(text: str) -> object:
    """Extrahera första kompletta JSON-strukturen utan last-]-heuristik.

    Hanterar produktionsfallet `Extra data` (två strukturer efter varandra),
    men reparerar aldrig saknade kommatecken eller annat semantiskt innehåll.
    """
    raw = text.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    starts = [(raw.find("{"), "{"), (raw.find("["), "[")]
    starts = [(idx, char) for idx, char in starts if idx >= 0]
    if not starts:
        raise json.JSONDecodeError("Ingen JSON-struktur", raw, 0)
    start, opener = min(starts)
    closer = "}" if opener == "{" else "]"
    depth = 0
    in_string = False
    escaped = False
    for pos in range(start, len(raw)):
        char = raw[pos]
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == opener:
            depth += 1
        elif char == closer:
            depth -= 1
            if depth == 0:
                return json.loads(raw[start : pos + 1])
    raise json.JSONDecodeError("Ofullständig JSON-struktur", raw, start)


def _coord(value: object) -> float:
    try:
        number = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0.0
    return max(0.0, min(1.0, number / 1000.0 if number > 1.0 else number))


def _region(raw: object) -> tuple[float, float, float, float]:
    if not isinstance(raw, dict):
        return (0.0, 0.0, 0.0, 0.0)
    return tuple(_coord(raw.get(key)) for key in ("x", "y", "width", "height"))  # type: ignore[return-value]


def _question_manifest(raw: str) -> list[dict]:
    data = _balanced_json(raw)
    if not isinstance(data, dict):
        raise QuestionSheetInferenceError("Modellsvaret var inte ett objekt", kind="invalid_json")
    if bool(data.get("multipleDocumentsAmbiguous")):
        raise QuestionSheetInferenceError(
            str(data.get("ambiguityReason") or "Flera dokument är lika framträdande"),
            kind="multiple_documents",
        )
    if not bool(data.get("primaryDocumentFound")):
        raise QuestionSheetInferenceError("Ingen primär pappersyta hittades", kind="no_primary_document")
    confidence = _coord(data.get("primaryDocumentConfidence"))
    px, py, pw, ph = _region(data.get("primaryDocumentRegion"))
    if confidence < 0.5 or pw * ph < 0.12:
        raise QuestionSheetInferenceError("Pappersytan kunde inte avgränsas säkert", kind="no_primary_document")

    accepted: list[dict] = []
    for item in data.get("questions") or []:
        if not isinstance(item, dict) or _coord(item.get("confidence")) < 0.5:
            continue
        number = _normalize_question_number(str(item.get("question_number") or ""))
        text = str(item.get("question_text") or "").strip()
        qx, qy, qw, qh = _region(item.get("question_region"))
        center_x, center_y = qx + qw / 2, qy + qh / 2
        inside = px - 0.02 <= center_x <= px + pw + 0.02 and py - 0.02 <= center_y <= py + ph + 0.02
        if number and len(text) >= 8 and qw > 0 and qh > 0 and inside:
            accepted.append({
                "question_number": number,
                "question_text": text[:2000],
                "max_points": max(0.5, float(item.get("max_points") or 1.0)),
            })
    if not accepted:
        raise QuestionSheetInferenceError("Pappersytan hittades men inga frågor kunde läsas", kind="no_questions")
    return accepted


async def _infer_question_sheet_page(file_bytes: bytes, mime_type: str) -> list[dict]:
    last_parse_error: Exception | None = None
    for attempt in range(1, 4):
        try:
            raw = await vision_ocr.read_image_structured(
                file_bytes,
                mime_type,
                QUESTION_SHEET_PROMPT,
                QUESTION_SHEET_SCHEMA,
            )
            manifest = _question_manifest(raw)
            logger.info("question_sheet_page_parsed questions=%d attempts=%d", len(manifest), attempt)
            return manifest
        except QuestionSheetInferenceError as exc:
            if exc.kind != "invalid_json":
                raise
            last_parse_error = exc
            logger.warning(
                "question_sheet_json_retry attempt=%d/3 error=%s response_parse_failed=true",
                attempt, exc,
            )
            if attempt < 3:
                await asyncio.sleep(0.25 * attempt)
        except (json.JSONDecodeError, ValueError) as exc:
            last_parse_error = exc
            logger.warning(
                "question_sheet_json_retry attempt=%d/3 error=%s response_parse_failed=true",
                attempt, exc,
            )
            if attempt < 3:
                await asyncio.sleep(0.25 * attempt)
        except Exception as exc:  # transport/provider
            raise QuestionSheetInferenceError(str(exc), kind="provider_error") from exc
    raise QuestionSheetInferenceError(
        f"AI-svaret kunde inte tolkas efter 3 försök: {last_parse_error}",
        kind="invalid_json",
    )


async def _solve_manifest(manifest: list[dict]) -> list[AnswerKeyItem]:
    user_message = (
        "Lös följande tryckta provfrågor. Underlaget är AI-infererat, inte ett "
        "officiellt lärarfacit. Behåll exakt question_number, question_text och "
        "max_points. Svara endast med JSON-objektet enligt schemat.\n\n"
        + json.dumps({"questions": manifest}, ensure_ascii=False)
    )
    if not gemini_client.gemini_enabled() and not openai_client.openai_enabled():
        raise QuestionSheetInferenceError("Ingen textmodell är konfigurerad", kind="provider_error")
    solved: list[AnswerKeyItem] = []
    last_error: Exception | None = None
    providers = []
    if openai_client.openai_enabled():
        providers.append("openai")
    if gemini_client.gemini_enabled():
        providers.append("gemini")
    for provider in providers:
        for attempt in range(1, 3):
            try:
                if provider == "openai":
                    raw = await openai_client.complete_text(
                        GENERATE_PROMPT,
                        user_message,
                        max_tokens=4000,
                        temperature=0.0,
                        json_mode=True,
                    )
                else:
                    raw = await gemini_client.complete_text(
                        GENERATE_PROMPT,
                        user_message,
                        max_tokens=8192,
                        temperature=0.0,
                        json_mode=True,
                        response_schema=_SOLVED_ITEMS_SCHEMA,
                    )
                solved = _parse_items(json.dumps(_balanced_json(raw), ensure_ascii=False))
                break
            except (json.JSONDecodeError, ValueError) as exc:
                last_error = exc
                logger.warning(
                    "question_sheet_solution_json_retry provider=%s attempt=%d/2 error=%s",
                    provider, attempt, exc,
                )
                if attempt < 2:
                    await asyncio.sleep(0.25)
            except Exception as exc:
                last_error = exc
                logger.warning("question_sheet_solution_provider_failed provider=%s error=%s", provider, exc)
                break
        if solved:
            break
    if not solved:
        kind = "invalid_json" if isinstance(last_error, (json.JSONDecodeError, ValueError)) else "provider_error"
        raise QuestionSheetInferenceError(
            f"Det infererade facitet kunde inte skapas: {last_error}", kind=kind
        )
    expected = {item["question_number"] for item in manifest}
    solved = [item for item in solved if item.question_number in expected and item.final_answer.strip()]
    if not solved:
        raise QuestionSheetInferenceError("Inga lösningar kunde infereras", kind="no_questions")
    return solved


async def infer_question_sheet(pages: list[tuple[bytes, str]]) -> list[AnswerKeyItem]:
    """Läs frågor endast från primär pappersyta, lös dem sedan textbaserat."""
    semaphore = asyncio.Semaphore(3)

    async def _one(page: tuple[bytes, str]) -> list[dict]:
        async with semaphore:
            return await _infer_question_sheet_page(*page)

    outputs = await asyncio.gather(*[_one(page) for page in pages], return_exceptions=True)
    merged: dict[str, dict] = {}
    errors: list[QuestionSheetInferenceError] = []
    for output in outputs:
        if isinstance(output, QuestionSheetInferenceError):
            errors.append(output)
            continue
        if isinstance(output, BaseException):
            errors.append(QuestionSheetInferenceError(str(output), kind="provider_error"))
            continue
        for item in output:
            merged.setdefault(item["question_number"], item)
    if not merged:
        if errors:
            raise errors[0]
        raise QuestionSheetInferenceError("Inga frågor kunde läsas", kind="no_questions")
    return await _solve_manifest(list(merged.values()))
