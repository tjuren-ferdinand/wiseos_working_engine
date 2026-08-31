"""Batch-rättning med bildförst-arkitektur.

    uppladdade filer -> gruppera per elev -> Gemini multimodal -> kanoniskt resultat

Flera filer kan tillhöra samma elev (flersidiga prov). De grupperas via
filnamnet och skickas som EN uppsättning sidor i ETT anrop, så att en uppgift
som fortsätter på nästa sida blir en enda uppgift med samlat elevsvar.

Designprincip: pipelinen kastar aldrig, men den fejkar heller aldrig. Ett
tekniskt fel ytas som needs_review med felorsak i klartext.
"""
from __future__ import annotations

import asyncio
import base64
import logging
import re
import uuid
from dataclasses import dataclass, field

from ..config import settings
from ..schemas import AnswerKeyItem, DocumentMeta, StudentDocumentResult
from . import gemini_vision

logger = logging.getLogger("wiseos.grading")


# ---------------------------------------------------------------------------
# Klassregler – samma regex/penalty-tabell som frontendens RULE_DEFS
# ---------------------------------------------------------------------------

RULE_DEFS: dict[str, dict] = {
    "unit_penalty": {
        "match": re.compile(r"enhet", re.IGNORECASE),
        "penalty": 0.25,
    },
    "sigfig_strict": {
        "match": re.compile(r"gällande siffror|sig\.?fig", re.IGNORECASE),
        "penalty": 0.0,
    },
}


def active_rules(params_text: str) -> list[str]:
    """Vilka regler matchas av kombinerad parametertext."""
    return [name for name, cfg in RULE_DEFS.items() if cfg["match"].search(params_text)]




# ---------------------------------------------------------------------------
# Namn-extraktion från filnamn ("Anna_Andersson - prov.pdf" → "Anna Andersson")
# ---------------------------------------------------------------------------


def derive_student_name(filename: str) -> str:
    base = re.sub(r"\.[^.]+$", "", filename)
    # Split off trailing suffix (t.ex. "Anna_Andersson - prov"): behåll delen före första " - " eller " – "
    head = re.split(r"\s*[-–]\s*", base, maxsplit=1)[0]
    # "Anna_Andersson" → ["Anna", "Andersson"]
    parts = re.findall(r"[A-Za-zÅÄÖåäö]+", head)
    if not parts:
        return "Okänd elev"
    return " ".join(p.capitalize() for p in parts[:3])


# ---------------------------------------------------------------------------
# Pipelinen
# ---------------------------------------------------------------------------


@dataclass
class UploadedFile:
    filename: str
    content: bytes
    content_type: str


@dataclass
class StudentDocument:
    """Alla sidor som hör till en och samma elev, i sidordning."""

    student_name: str
    pages: list[UploadedFile] = field(default_factory=list)


# Filnamnssuffix som anger sidnummer: "Anna_Andersson_sida2.jpg", "Anna - p3.png",
# "Anna_Andersson (2).jpg". Gruppen 'num' är sidnumret.
_PAGE_SUFFIX = re.compile(
    r"[\s_\-.]*(?:sid(?:a|an)?|page|p|s|del|part)?[\s_\-.#]*\(?(?P<num>\d{1,3})\)?\s*$",
    re.IGNORECASE,
)


def _split_page_suffix(stem: str) -> tuple[str, int]:
    """Delar "Anna_Andersson_sida2" i ("Anna_Andersson", 2).

    Saknas sidnummer returneras (stem, 1). Ett rent numeriskt namn behandlas
    som elevnamn, inte som sidnummer.
    """
    match = _PAGE_SUFFIX.search(stem)
    if not match:
        return stem, 1
    base = stem[: match.start()].strip(" _-.")
    if not base:
        return stem, 1
    return base, int(match.group("num"))


def group_pages_by_student(files: list[UploadedFile]) -> list[StudentDocument]:
    """Grupperar uppladdade filer till elevdokument.

    "Anna_Andersson_sida1.jpg" + "Anna_Andersson_sida2.jpg" blir ETT dokument
    med två sidor. Filer utan sidnummer blir egna dokument med en sida.
    """
    buckets: dict[str, list[tuple[int, int, UploadedFile]]] = {}
    order: list[str] = []

    for position, upload in enumerate(files):
        stem = re.sub(r"\.[^.]+$", "", upload.filename or "")
        base, page_no = _split_page_suffix(stem)
        key = derive_student_name(base).lower()
        if key not in buckets:
            buckets[key] = []
            order.append(key)
        buckets[key].append((page_no, position, upload))

    documents: list[StudentDocument] = []
    for key in order:
        entries = sorted(buckets[key], key=lambda e: (e[0], e[1]))
        stem = re.sub(r"\.[^.]+$", "", entries[0][2].filename or "")
        base, _ = _split_page_suffix(stem)
        documents.append(
            StudentDocument(
                student_name=derive_student_name(base),
                pages=[entry[2] for entry in entries],
            )
        )
    return documents


def _data_url(upload: UploadedFile) -> str:
    encoded = base64.b64encode(upload.content).decode("ascii")
    mime = upload.content_type or "application/octet-stream"
    return f"data:{mime};base64,{encoded}"


# Så många elevdokument analyseras samtidigt. Håller nere risken för 429
# samtidigt som en klassuppsättning inte tar orimligt lång tid.
_MAX_CONCURRENT_DOCUMENTS = 3


async def grade_batch(
    *,
    prov_id: str,
    answer_key: list[AnswerKeyItem],
    class_grading_parameters: str,
    test_specific_parameters: str,
    files: list[UploadedFile],
    identification_method: str = "name_field",
) -> list[StudentDocumentResult]:
    """Rättar en batch elevdokument bildförst.

    Flöde per elev:
      1. Alla sidor som hör till eleven skickas i ETT multimodalt Gemini-anrop.
      2. Modellen transkriberar elevens faktiska arbete och bedömer det.
      3. Originalsidorna bevaras som data-URL:er i sidordning.
    """
    documents = group_pages_by_student(files)
    grading_notes = "\n".join(
        part.strip()
        for part in (class_grading_parameters, test_specific_parameters)
        if part and part.strip()
    )

    logger.info(
        "batch_start prov_id=%s uploads=%d documents=%d questions=%d",
        prov_id, len(files), len(documents), len(answer_key),
    )

    semaphore = asyncio.Semaphore(_MAX_CONCURRENT_DOCUMENTS)

    async def _process(document: StudentDocument) -> StudentDocumentResult:
        async with semaphore:
            pages = [
                (page.content, page.content_type or "image/png")
                for page in document.pages
                if gemini_vision.is_supported_image(page.content_type or "")
            ]
            unsupported = len(document.pages) - len(pages)
            questions, meta = await gemini_vision.analyze_document(
                pages=pages,
                answer_key=answer_key,
                grading_notes=grading_notes,
                student_label=document.student_name,
            )
            if unsupported:
                note = f"{unsupported} sida/sidor hade filformat som inte kan analyseras."
                meta.error = f"{meta.error} | {note}" if meta.error else note

            # Föredra namn som extraherats från bilden (name_field) framför filnamnet.
            resolved_name = meta.studentName or document.student_name
            return StudentDocumentResult(
                id=str(uuid.uuid4()),
                provId=prov_id,
                studentName=resolved_name,
                scanPages=[_data_url(page) for page in document.pages],
                document=meta,
                questions=questions,
            )

    results = await asyncio.gather(*[_process(d) for d in documents])
    results = list(results)

    logger.info(
        "batch_done prov_id=%s documents=%d needs_review=%d",
        prov_id,
        len(results),
        sum(r.document.needsReviewCount for r in results),
    )
    return results


def integration_status() -> dict[str, bool | str]:
    return {
        "wolfram": bool(settings.WOLFRAM_APP_ID or settings.WOLFRAM_API_URL),
        "gemini": bool(settings.GEMINI_API_KEY),
        "groq": bool(settings.GROQ_API_KEY),
        "anthropic": bool(settings.ANTHROPIC_API_KEY),
        "mathpix": bool(settings.MATHPIX_APP_ID and settings.MATHPIX_APP_KEY),
        "gradingEngine": "gemini-vision" if gemini_vision.available() else "unconfigured",
        "model": settings.GEMINI_MODEL,
    }
