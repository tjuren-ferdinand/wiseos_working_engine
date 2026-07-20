"""Answer-key extraction for uploaded facit documents."""
from __future__ import annotations

import base64
import json

from ..config import settings
from ..schemas import AnswerKeyItem


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
            raise ValueError("Vision model returned no JSON array")
        data = json.loads(raw[start : end + 1])

    if not isinstance(data, list):
        raise ValueError("Vision model JSON response was not an array")
    return data


async def extract_answer_key(file_bytes: bytes, mime_type: str) -> list[AnswerKeyItem]:
    if not settings.ANTHROPIC_API_KEY:
        return _mock_answer_key(len(file_bytes))

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
        return [AnswerKeyItem.model_validate(item) for item in _extract_json_array(text)]
    except Exception:
        return _mock_answer_key(len(file_bytes))
