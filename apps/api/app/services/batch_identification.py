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
    # Sidklassificering — utvinns i samma anrop som namnet (noll extrakostnad).
    # 'question_sheet' = utskrivet frågeblad utan ifyllt arbete,
    # 'student_work'  = sida med elevens (vanligen handskrivna) lösningar,
    # 'answer_key'    = facit/lösningsförslag/bedömningsanvisning,
    # 'cover'/'blank' = försättsblad/tom sida, 'unclear' = osäker.
    pageType: str = "unclear"
    hasHandwriting: bool = False
    documentTitle: str = ""


PAGE_TYPES = {
    "question_sheet",
    "student_work",
    "answer_key",
    "cover",
    "blank",
    "unclear",
}


NAME_EXTRACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "studentName": {"type": "string"},
        "confidence": {"type": "number"},
        "pageType": {"type": "string"},
        "hasHandwriting": {"type": "boolean"},
        "documentTitle": {"type": "string"},
        "notReadableReason": {"type": "string"},
    },
    "required": ["studentName", "confidence", "pageType", "hasHandwriting", "documentTitle"],
}


NAME_EXTRACTION_PROMPT = (
    "Du är en OCR-assistent för svenska elevprov. "
    "Din uppgift är att läsa av elevens namn från sidhuvudet eller namnfältet på bilden, "
    "samt klassificera vad sidan föreställer. "
    "Titta efter etiketter som 'Elev:', 'Namn:', 'Name:', 'Elevnamn:', 'Ditt namn:' eller liknande. "
    "Returnera ENDAST JSON enligt schemat, inga kodblock, inget resonemang. "
    "- studentName: elevens fullständiga namn. Om du inte kan läsa det, lämna tom sträng. "
    "- confidence: ett decimaltal mellan 0.0 och 1.0 som anger hur säker du är. "
    "- pageType: sidans roll — 'question_sheet' (utskrivet frågeblad UTAN ifyllda svar), "
    "'student_work' (sida med elevens handskrivna lösningar/svar), "
    "'answer_key' (facit, lösningsförslag, bedömningsanvisning eller lärarens uträkningar), "
    "'cover' (försättsblad), 'blank' (tom sida) eller 'unclear' (osäker). "
    "- hasHandwriting: true om sidan innehåller handskriven text eller uträkningar, annars false. "
    "- documentTitle: sidans utskrivna huvudrubrik (t.ex. 'Prov 1', 'Lösningsförslag'), "
    "tom sträng om ingen rubrik syns. "
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
        page_type = str(data.get("pageType") or "unclear").strip().lower()
        if page_type not in PAGE_TYPES:
            page_type = "unclear"
        has_handwriting = bool(data.get("hasHandwriting"))
        document_title = str(data.get("documentTitle") or "").strip()[:120]
        return IdentifiedName(
            studentName=name,
            confidence=confidence,
            method="name_field",
            pageType=page_type,
            hasHandwriting=has_handwriting,
            documentTitle=document_title,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("name_extraction_failed error=%s", exc)
        return IdentifiedName(studentName=None, confidence=0.0, method="name_field_failed")
