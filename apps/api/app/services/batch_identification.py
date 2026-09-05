"""Per-page student name extraction for batch grading."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass

from . import gemini_vision, vision_ocr

logger = logging.getLogger("wiseos.grading")


@dataclass
class IdentifiedName:
    studentName: str | None
    confidence: float
    method: str


NAME_EXTRACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "studentName": {"type": "string"},
        "confidence": {"type": "number"},
        "notReadableReason": {"type": "string"},
    },
    "required": ["studentName", "confidence"],
}


NAME_EXTRACTION_PROMPT = (
    "Du är en OCR-assistent för svenska elevprov. "
    "Din uppgift är att läsa av elevens namn från sidhuvudet eller namnfältet på bilden. "
    "Titta efter etiketter som 'Elev:', 'Namn:', 'Name:', 'Elevnamn:', 'Ditt namn:' eller liknande. "
    "Returnera ENDAST JSON enligt schemat, inga kodblock, inget resonemang. "
    "- studentName: elevens fullständiga namn. Om du inte kan läsa det, lämna tom sträng. "
    "- confidence: ett decimaltal mellan 0.0 och 1.0 som anger hur säker du är. "
    "- notReadableReason: kort förklaring om namnet inte gick att läsa. Om du hittade namnet, lämna tom sträng."
)


async def extract_student_name(
    page: tuple[bytes, str],
    *,
    identification_method: str = "name_field",
) -> IdentifiedName:
    """Extract a student name from a single page image using Gemini.

    Never raises – a failed extraction returns a marker that the caller can
    fall back on (filename, 'Okänd elev', etc.).
    """
    if identification_method != "name_field":
        return IdentifiedName(studentName=None, confidence=0.0, method=identification_method)

    image_bytes, mime = page
    if not gemini_vision.is_supported_document(mime):
        return IdentifiedName(studentName=None, confidence=0.0, method="name_field_unsupported_mime")

    try:
        raw = await vision_ocr._gemini(
            image_bytes=image_bytes,
            mime_type=mime,
            prompt=NAME_EXTRACTION_PROMPT,
            json_mode=True,
            response_schema=NAME_EXTRACTION_SCHEMA,
        )
        cleaned = gemini_vision._strip_wrappers(raw)
        if not cleaned:
            return IdentifiedName(studentName=None, confidence=0.0, method="name_field_empty")

        data = json.loads(cleaned)
        name = data.get("studentName")
        if isinstance(name, str):
            name = name.strip()
            if not name:
                name = None
        confidence = max(0.0, min(1.0, float(data.get("confidence") or 0.0)))
        return IdentifiedName(studentName=name, confidence=confidence, method="name_field")
    except Exception as exc:  # noqa: BLE001
        logger.warning("name_extraction_failed error=%s", exc)
        return IdentifiedName(studentName=None, confidence=0.0, method="name_field_failed")
