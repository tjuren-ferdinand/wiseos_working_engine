"""Answer-key extraction for uploaded facit documents."""
from __future__ import annotations

import asyncio
import base64
import json
import logging
import re

from ..config import settings
from ..schemas import AnswerKeyItem
from . import groq_client, vision_ocr

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

    # JSON-läget på Groq kräver ett objekt, så facit levereras som {"items": [...]}.
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
    if not groq_client.groq_enabled():
        return _mock_answer_key(question_count)

    prompt = (
        f"Skapa ett facit med {question_count} uppgifter för följande prov.\n\n"
        f"Provbeskrivning: {description.strip() or 'Fysik 1, blandade uppgifter.'}"
    )
    try:
        text = await groq_client.complete_text(
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


QUESTION_SHEET_PROMPT = f"""{SYSTEM_PROMPT}

Detta är INTE ett officiellt facit utan ett frågeblad som läraren uttryckligen
markerat som referensunderlag. Skapa ett AI-INFERERAT bedömningsunderlag:
- Läs endast provets tryckta uppgifter, uppgiftsnummer och synliga maxpoäng.
- Lös varje tryckt uppgift själv för att ange final_answer.
- Ignorera helt webbläsar-/bildvisargränssnitt, knappar, klockslag, filnamn,
  text från en intilliggande bild och allt som bara läcker in längs bildkanterna.
- Ignorera handskrivna eller fristående numeriska svar i marginalen. De är
  aldrig elevsvar och får inte kopieras som facit utan egen kontrollräkning.
- Om en uppgift inte kan läsas säkert: utelämna den hellre än att hitta på.

Svara endast med JSON-arrayen enligt schemat ovan."""


async def _infer_question_sheet_page(
    file_bytes: bytes,
    mime_type: str,
) -> list[AnswerKeyItem]:
    try:
        text = await vision_ocr.read_image(
            file_bytes,
            mime_type,
            prompt=QUESTION_SHEET_PROMPT,
        )
        return _parse_items(text) if text else []
    except Exception as exc:  # noqa: BLE001
        logger.warning("question_sheet_inference_failed error=%s", exc)
        return []


async def infer_question_sheet(
    pages: list[tuple[bytes, str]],
) -> list[AnswerKeyItem]:
    """Inferera ett gemensamt underlag från skannerns e00-frågeblad.

    Sidorna analyseras parallellt med låg gräns och slås ihop per normaliserat
    uppgiftsnummer. Resultatet är uttryckligen AI-infererat, inte lärarens facit.
    """
    semaphore = asyncio.Semaphore(3)

    async def _one(page: tuple[bytes, str]) -> list[AnswerKeyItem]:
        async with semaphore:
            return await _infer_question_sheet_page(*page)

    page_items = await asyncio.gather(*[_one(page) for page in pages])
    merged: dict[str, AnswerKeyItem] = {}
    for items in page_items:
        for item in items:
            key = _normalize_question_number(item.question_number)
            item.question_number = key
            if key and key not in merged:
                merged[key] = item
    return list(merged.values())
