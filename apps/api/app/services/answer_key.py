"""Answer-key extraction for uploaded facit documents."""
from __future__ import annotations

import base64
import json
import re

from ..config import settings
from ..schemas import AnswerKeyItem
from . import groq_client, vision_ocr


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
