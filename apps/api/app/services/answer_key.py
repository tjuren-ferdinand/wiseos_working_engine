"""Answer-key extraction for uploaded facit documents."""
from __future__ import annotations

import base64
import json

from ..config import settings
from ..schemas import AnswerKeyItem
from . import groq_client, vision_ocr


SYSTEM_PROMPT = """You are the core extraction engine of wiseOS, an advanced AI grading assistant for STEM teachers. Your task is to analyze the uploaded answer key (facit/lösningsförslag) and convert it into a structured, machine-readable format for the grading workbench. Analyze the provided document and extract every single question. For each question, identify and isolate: 1. The question number. 2. The final analytical answer including correct SI units, e.g., N, m/s, kg. 3. The deterministic step-by-step mathematical or physical derivation required for full marks. You must handle complex notation, sub-steps, and formulas with absolute precision. Do not hallucinate or simplify. Respond ONLY with a valid JSON array in the following format. Do not include any conversational prose, markdown blocks outside of the JSON, or explanations.
[
{
"question_number": "1",
"final_answer": "x = 3",
"derivation_steps": [
"2x + 4 = 10",
"2x = 6",
"x = 3"
]
},
{
"question_number": "2",
"final_answer": "F = 24 N",
"derivation_steps": [
"m = 2.4 kg",
"g = 9.81 m/s^2",
"F = m * g",
"F = 2.4 * 9.81 = 23.544 N",
"Rounded to significant figures: 24 N"
]
}
]"""


def _mock_answer_key(size: int) -> list[AnswerKeyItem]:
    # Realistisk fysik 1 demo för investerare
    return [
        AnswerKeyItem(
            question_number="1a",
            final_answer="v = 19.6 m/s",
            derivation_steps=[
                "Ett föremål släpps från vila (v₀ = 0)",
                "Fallhöjd: h = 19.6 m",
                "Energilagen: mgh = ½mv²",
                "gh = ½v² → v² = 2gh",
                "v = √(2 × 9.82 × 19.6) = √384.9 ≈ 19.6 m/s"
            ],
        ),
        AnswerKeyItem(
            question_number="1b",
            final_answer="t = 2.0 s",
            derivation_steps=[
                "Falltid från höjden",
                "h = ½gt²",
                "t² = 2h/g = 2×19.6/9.82 = 3.99",
                "t = √3.99 ≈ 2.0 s"
            ],
        ),
        AnswerKeyItem(
            question_number="2",
            final_answer="F = 1470 N",
            derivation_steps=[
                "Lyftkraft behövs för att motverka tyngdkraften",
                "Massa: m = 150 kg",
                "Tyngdacceleration: g = 9.82 m/s²",
                "F = mg = 150 × 9.82 = 1473 N",
                "Avrundat till 3 gällande siffror: 1470 N"
            ],
        ),
        AnswerKeyItem(
            question_number="3",
            final_answer="a = 2.5 m/s²",
            derivation_steps=[
                "Newtons 2a lag: F = ma",
                "Resultantkraft: F_net = 500 N - 250 N = 250 N",
                "Massa: m = 100 kg",
                "a = F_net/m = 250/100 = 2.5 m/s²"
            ],
        ),
    ]


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
    "Du är wiseOS facitmotor för svenska gymnasieprov i matematik och fysik. "
    "Konstruera ett rimligt facit utifrån provets beskrivning. "
    "Varje uppgift ska ha ett slutsvar med korrekt SI-enhet och högst fyra korta härledningssteg. "
    'Svara enbart med JSON på formen '
    '{"items": [{"question_number": "1", "final_answer": "F = 24 N", '
    '"derivation_steps": ["m = 2.4 kg", "F = m*g", "F = 24 N"]}]}'
)


def _parse_items(text: str) -> list[AnswerKeyItem]:
    return [AnswerKeyItem.model_validate(item) for item in _extract_json_array(text)]


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
        from anthropic import AsyncAnthropic

        client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        encoded = base64.b64encode(file_bytes).decode("ascii")
        if mime_type == "application/pdf":
            media_block = {
                "type": "document",
                "source": {"type": "base64", "media_type": mime_type, "data": encoded},
            }
        else:
            media_block = {
                "type": "image",
                "source": {"type": "base64", "media_type": mime_type, "data": encoded},
            }

        msg = await client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=4000,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": [media_block, {"type": "text", "text": "Extract this answer key."}]}],
        )
        text = "\n".join(block.text for block in msg.content if getattr(block, "type", None) == "text")
        return _parse_items(text)
    except Exception:
        items = await _extract_with_vision(file_bytes, mime_type)
        return items if items else _mock_answer_key(len(file_bytes))
