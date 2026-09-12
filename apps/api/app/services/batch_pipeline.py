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
from io import BytesIO

import pymupdf
from pypdf import PdfReader

from ..config import settings
from ..schemas import (
    Annotation,
    AnswerKeyItem,
    Assessment,
    DocumentMeta,
    MathVerification,
    QuestionResult,
    StudentDocumentResult,
    WolframResult,
)
from . import feedback, gemini_vision
from .batch_identification import IdentifiedName, extract_student_name
from .gemini_vision import GradingError
from .providers.registry import get_feedback_provider, get_math_provider, get_vision_provider

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
    source_id: str | None = None
    page_number: int = 1


def _rasterize_pdf_page(pdf_bytes: bytes, page_number: int, dpi: int = 200) -> tuple[bytes, str]:
    """Rendera en PDF-sida till en PNG-bild så att den kan skickas till vision-modeller.

    Vision-modeller har generellt sett bättre stöd för bilder (PNG/JPEG) än för
    råa PDF-bytes, och Workbench kan visa en data-URL med image/* som en <img>.
    """
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    try:
        page = doc.load_page(page_number)
        matrix = pymupdf.Matrix(dpi / 72.0, dpi / 72.0)
        pixmap = page.get_pixmap(matrix=matrix)
        return pixmap.tobytes("png"), "image/png"
    finally:
        doc.close()


def expand_pdf_uploads(files: list[UploadedFile], max_pages: int = 300) -> list[UploadedFile]:
    expanded: list[UploadedFile] = []
    for upload in files:
        if upload.content_type != "application/pdf":
            if len(expanded) >= max_pages:
                raise ValueError(f"Uppladdningen innehåller fler än {max_pages} sidor")
            expanded.append(upload)
            continue
        try:
            reader = PdfReader(BytesIO(upload.content), strict=False)
        except Exception as exc:
            raise ValueError(f"{upload.filename} är inte en giltig PDF") from exc
        if not reader.pages:
            raise ValueError(f"{upload.filename} innehåller inga sidor")
        if len(expanded) + len(reader.pages) > max_pages:
            raise ValueError(f"Uppladdningen innehåller fler än {max_pages} sidor")
        stem = re.sub(r"\.[^.]+$", "", upload.filename or "dokument")
        for page_index, _page in enumerate(reader.pages):
            try:
                image_bytes, _ = _rasterize_pdf_page(upload.content, page_index, dpi=200)
            except Exception as exc:
                raise ValueError(f"Kunde inte rendera sida {page_index + 1} i {upload.filename}") from exc
            page_number = page_index + 1
            expanded.append(
                UploadedFile(
                    filename=f"{stem}_sida_{page_number}.png",
                    content=image_bytes,
                    content_type="image/png",
                    source_id=upload.filename,
                    page_number=page_number,
                )
            )
    return expanded


@dataclass
class StudentDocument:
    """Alla sidor som hör till en och samma elev, i sidordning."""

    student_name: str
    pages: list[UploadedFile] = field(default_factory=list)
    identification_method: str = "unresolved"
    identification_confidence: float = 0.0
    # Dokumentverdict — sätts efter sidklassificeringen i
    # identify_and_group_pages:
    #   "student_submission"      — elevidentiferat arbete finns, rättas normalt
    #   "not_student_submission"  — klassificerat som blankett/facit/annat,
    #                             rättas ALDRIG (flaggas för läraren)
    #   "unverified"              — sidorna kunde inte klassificeras alls,
    #                             rättas som förr men flaggas som obekräftat
    document_type: str = "student_submission"
    classification_reason: str = ""


# Filnamnssuffix som anger sidnummer: "Anna_Andersson_sida2.jpg", "Anna - p3.png",
# "Anna_Andersson (2).jpg". Gruppen 'num' är sidnumret.
#
# Siffran MÅSTE föregås av en separator (mellanslag/_/-/.//#/() eller ett
# sid-nyckelord. En naken siffra direkt på stammen — "prov1", "scan3",
# "bild5" — är inte ett sidsuffix utan del av filnamnet, annars skulle
# separata elevfiler som heter prov1..prov5 felaktigt grupperas som sidor
# i samma elevs dokument.
_PAGE_SUFFIX = re.compile(
    r"(?:[\s_\-.#]+\(?|(?:sid(?:a|an)?|page|p|s|del|part)[\s_\-.#]*\(?)"
    r"(?P<num>\d{1,3})\)?\s*$",
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
        if upload.source_id:
            page_no = upload.page_number
        has_page_suffix = base != stem
        key = (
            " ".join(derive_student_name(base).casefold().split())
            if not upload.source_id and has_page_suffix and not _generic_filename(base)
            else f"upload:{position}"
        )
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


_GENERIC_STEMS = {
    "image", "img", "scan", "scanned", "dokument", "doc", "test", "page",
    "sida", "okand", "okänd", "unknown", "file", "picture", "pic", "photo",
    "bild", "foto", "dsc", "sample", "exempel",
    # Svenska skol-skanningsstammar — "prov 1", "tenta_2", "klass-3" är
    # sidnummer på en generisk stam, aldrig ett elevnamn.
    "prov", "exam", "tenta", "diagnos", "bedömning", "bedomning",
    "inlämning", "inlamning", "inlupp", "skanning", "klass", "uppgift",
    "uppg", "matte", "ma", "fysik", "fy", "kemi", "ke", "elev",
    "screenshot", "whatsapp", "fil", "filen",
}
_NUMERIC_ONLY = re.compile(r"^\d+$")


def _generic_filename(base: str) -> bool:
    """Return True when the filename stem gives no usable student name."""
    if not base:
        return True
    first = re.split(r"[\s_\-.]", base)[0].lower().strip()
    if first in _GENERIC_STEMS:
        return True
    if _NUMERIC_ONLY.fullmatch(first):
        return True
    if not re.search(r"[a-zåäö]", base, re.IGNORECASE):
        return True
    return False


def _resolve_name(
    extracted: IdentifiedName,
    upload: UploadedFile,
    identification_method: str,
) -> str:
    """Pick the best student name for a page: extracted name, derived filename, or unknown."""
    if identification_method == "name_field" and extracted.studentName:
        return extracted.studentName.strip()

    stem = re.sub(r"\.[^.]+$", "", upload.filename or "")
    base, _ = _split_page_suffix(stem)
    if _generic_filename(base):
        return f"Okänd elev - {upload.filename}"
    derived = derive_student_name(base)
    if not derived or derived == "Okänd elev":
        return f"Okänd elev - {upload.filename}"
    return derived


def _same_student(a: str, b: str) -> bool:
    return " ".join(a.casefold().split()) == " ".join(b.casefold().split())


async def identify_and_group_pages(
    files: list[UploadedFile],
    identification_method: str = "name_field",
) -> list[StudentDocument]:
    """Identify the student on each page, then group pages by that student.

    Pages that cannot be identified are grouped under 'Okänd elev - <filename>'.
    Multi-page documents for the same student are kept as one StudentDocument.
    """
    if identification_method != "name_field":
        raise ValueError(f"Identifieringsmetoden {identification_method!r} stöds inte ännu")

    semaphore = asyncio.Semaphore(5)

    async def _get_name(upload: UploadedFile) -> IdentifiedName:
        async with semaphore:
            return await extract_student_name(
                (upload.content, upload.content_type),
                identification_method=identification_method,
            )

    extracted = await asyncio.gather(*[_get_name(upload) for upload in files])
    candidates = group_pages_by_student(files)
    extraction_by_file = {id(upload): item for upload, item in zip(files, extracted)}
    documents: list[StudentDocument] = []

    for candidate in candidates:
        confident = [
            item
            for page in candidate.pages
            if (item := extraction_by_file[id(page)]).studentName and item.confidence >= 0.85
        ]
        names: dict[str, list[IdentifiedName]] = {}
        for item in confident:
            key = " ".join((item.studentName or "").casefold().split())
            names.setdefault(key, []).append(item)

        if len(names) == 1:
            identified = next(iter(names.values()))
            candidate.student_name = identified[0].studentName or candidate.student_name
            candidate.identification_method = "name_field"
            candidate.identification_confidence = min(1.0, max(item.confidence for item in identified))
        elif len(names) > 1:
            # Flera säkert lästa men OLIKA namn i samma filnamnsbucket —
            # dela upp i separata elevdokument per namnankare istället för
            # att slå ihop allt till en "Okänd elev". Sidor utan säkert
            # namn hakar på det öppna segmentet (positionell fortsättning);
            # sidor före första ankaret blir egna unresolved-poster.
            open_segment: StudentDocument | None = None
            for page in candidate.pages:
                item = extraction_by_file[id(page)]
                page_name = (item.studentName or "").strip()
                anchored = bool(page_name) and item.confidence >= 0.85
                if anchored:
                    if open_segment is not None and _same_student(
                        open_segment.student_name, page_name
                    ):
                        open_segment.pages.append(page)
                        open_segment.identification_confidence = min(
                            open_segment.identification_confidence,
                            item.confidence,
                        )
                    else:
                        open_segment = StudentDocument(
                            student_name=page_name,
                            pages=[page],
                            identification_method="name_field",
                            identification_confidence=item.confidence,
                        )
                        documents.append(open_segment)
                elif open_segment is not None:
                    open_segment.pages.append(page)
                else:
                    documents.append(
                        StudentDocument(
                            student_name=f"Okänd elev - {page.filename}",
                            pages=[page],
                            identification_method="unresolved",
                            identification_confidence=0.0,
                        )
                    )
            continue
        else:
            stem = re.sub(r"\.[^.]+$", "", candidate.pages[0].filename or "")
            base, _ = _split_page_suffix(stem)
            if _generic_filename(base):
                candidate.student_name = f"Okänd elev - {candidate.pages[0].filename}"
                candidate.identification_method = "unresolved"
                candidate.identification_confidence = 0.0
            else:
                candidate.student_name = derive_student_name(base)
                candidate.identification_method = "filename"
                candidate.identification_confidence = 0.6
        documents.append(candidate)

    # Del E — sidnivå-uppdelning INOM filnamnsbucketade dokument, innan merge:
    # en facitsida eller en ny utskriven dokumentrubrik skär segmentet även
    # när sidorna hamnade i samma namn-bucket (t.ex. "anna_med_facit.pdf").
    split_documents: list[StudentDocument] = []
    for document in documents:
        current: StudentDocument | None = None
        current_title = ""
        for page in document.pages:
            item = extraction_by_file.get(id(page))
            is_answer_key = item is not None and item.pageType == "answer_key"
            title = (item.documentTitle or "").strip().casefold() if item else ""
            starts_new = (
                current is None
                or is_answer_key
                or (title and current_title and title != current_title)
            )
            if starts_new:
                current = StudentDocument(
                    student_name=document.student_name,
                    identification_method=document.identification_method,
                    identification_confidence=document.identification_confidence,
                )
                split_documents.append(current)
                current_title = title
            current.pages.append(page)
            # Facitsidan stängs alltid direkt — sidan efter kan vara nästa elev.
            if is_answer_key:
                current = None
                current_title = ""

    # Namn följer bara segment som faktiskt innehåller ett namnankare — ett
    # delat segment utan säkert namn får inte ärva bucketens identitet.
    for document in split_documents:
        anchor = [
            item
            for page in document.pages
            if (item := extraction_by_file.get(id(page))) is not None
            and item.method == "name_field"
            and item.studentName
            and item.confidence >= 0.85
        ]
        if anchor:
            document.student_name = anchor[0].studentName.strip()
            document.identification_method = "name_field"
            document.identification_confidence = anchor[0].confidence
        elif document.identification_method == "name_field":
            document.student_name = f"Okänd elev - {document.pages[0].filename}"
            document.identification_method = "unresolved"
            document.identification_confidence = 0.0

    documents = split_documents

    # Slå ihop sidor inom samma uppladdade källa (samma PDF) till elevsegment.
    #
    # Säkerhetsinvariant: bara en sida vars namn lästs med name_field-metoden
    # (confidence >= 0.85) kan ANKRA eller splittra ett segment.
    #
    #  - name_field-sida med samma namn som öppet segment = fortsättningssida.
    #  - name_field-sida med ANNAT namn öppnar ALLTID nytt segment — en
    #    säkert läst annan elev kan aldrig absorberas in i fel dokument.
    #  - Sida UTAN säkert namn (unresolved/filename/conflicting) får endast
    #    haka på ett segment som förankrats av name_field — den är en
    #    positionell fortsättningssida. Filnamnshärledda namn är
    #    behållarens namn (alla sidor i samma PDF delar stem) och duger
    #    aldrig som identitetsbevis.
    #  - Namnlösa sidor INNAN första namnankaret blir var och en sin egen
    #    unresolved-post — två namnlösa sidor kan vara olika elever och slås
    #    aldrig ihop med varandra, aldrig över källgränser.
    #  - Kvarstående risk: en oläslig sida mitt i en bundle som tillhör nästa
    #    elev antas vara fortsättning på föregående. Positionellt antagande,
    #    flaggas alltid för mänsklig granskning via unresolved/needs_review.
    #
    # Del E-tillägg — sidklassificering:
    #  - En sida klassificerad som 'answer_key' (facit/lösningsförslag) får
    #    ALDRIG absorberas som fortsättningssida i ett elevförankrat segment.
    #  - En avvikande utskriven dokumentrubrik (documentTitle, t.ex.
    #    "Lösningsförslag" eller "Prov 2") mitt i samma källa bryter segmentet
    #    — rubrikankare kompletterar namnankare när flera dokument följer
    #    efter varandra i en sammanslagen PDF.
    def _page_extraction(document: StudentDocument) -> IdentifiedName | None:
        return (
            extraction_by_file.get(id(document.pages[0])) if document.pages else None
        )

    merged: list[StudentDocument] = []
    current_source: str | None = None
    open_segment: StudentDocument | None = None
    open_title = ""

    for document in documents:
        source = document.pages[0].source_id
        if source is None or source != current_source:
            current_source = source
            open_segment = None
            open_title = ""
        if source is None:
            # Lös fil (inte PDF-sida) — filnamnsbucketingen ovan gäller redan.
            merged.append(document)
            continue

        item = _page_extraction(document)
        is_answer_key = item is not None and item.pageType == "answer_key"
        doc_title = (item.documentTitle or "").strip().casefold() if item else ""
        open_is_key = open_segment is not None and any(
            (ex := extraction_by_file.get(id(p))) is not None
            and ex.pageType == "answer_key"
            for p in open_segment.pages
        )

        anchored = document.identification_method == "name_field"
        if anchored:
            if open_segment is not None and _same_student(
                open_segment.student_name, document.student_name
            ):
                open_segment.pages.extend(document.pages)
                open_segment.identification_confidence = min(
                    open_segment.identification_confidence,
                    document.identification_confidence,
                )
            else:
                merged.append(document)
                open_segment = document
                open_title = doc_title
        elif (
            open_segment is not None
            and not is_answer_key
            and (
                # Positionell fortsättning: hakar bara på name_field-förankrade
                # segment, och aldrig över en rubrikgräns.
                (
                    open_segment.identification_method == "name_field"
                    and not (doc_title and open_title and doc_title != open_title)
                )
                # Samma utskrivna dokumenttitel = samma fysiska dokument —
                # tillåt sammanslagning även utan namnförankring.
                or (doc_title and open_title and doc_title == open_title)
                # Facit-fortsättning: sidor utan egen rubrik efter ett
                # lösningsförslag hör till facit-dokumentet, inte till en
                # ny elev. En sida med rubrik bryter alltid (nytt prov).
                or (open_is_key and not doc_title)
            )
        ):
            open_segment.pages.extend(document.pages)
        else:
            merged.append(document)
            open_segment = document
            open_title = doc_title

    # Dokumentverdict — avgör om segmentet över huvud taget är en
    # elevinlämning INNAN något skickas till rättningsmotorn.
    #
    #  - Sida med 'student_work' ELLER handskrift räknas som elevarbete —
    #    hasHandwriting vinner över pageType (ett ifyllt frågeblad är
    #    fortfarande elevens arbete, inte en blank blankett).
    #  - Sidor vars extraktion misslyckades räknas inte som bevis åt något
    #    håll. Finns inga lyckade klassificeringar alls sätts 'unverified'
    #    och dokumentet rättas som förr — ett provideravbrott får aldrig
    #    tyst göra en hel uppladdning orättad.
    #  - Lyckade klassificeringar utan ett enda elevarbetstecken =>
    #    'not_student_submission' — flaggas, rättas aldrig.
    for document in merged:
        usable = [
            item
            for page in document.pages
            if (item := extraction_by_file.get(id(page))) is not None
            and item.method == "name_field"
        ]
        # Facit förgiftar segmentet: ett dokument som innehåller EN ENDA
        # answer_key-sida är inte en elevinlämning, oavsett om det även
        # råkar innehålla arbetslika sidor (facit-fortsättningar).
        # hasHandwriting vinner över pageType — men aldrig över answer_key:
        # en handskriven facit är fortfarande lärarens dokument.
        has_key = any(item.pageType == "answer_key" for item in usable)
        has_work = any(
            (item.pageType == "student_work" or item.hasHandwriting)
            and item.pageType != "answer_key"
            for item in usable
        )
        if has_key:
            document.document_type = "not_student_submission"
            document.classification_reason = (
                "Dokumentet verkar vara facit eller lösningsförslag — "
                "inget elevarbete hittades."
            )
        elif has_work:
            document.document_type = "student_submission"
        elif usable:
            document.document_type = "not_student_submission"
            if all(
                item.pageType in ("question_sheet", "cover", "blank")
                for item in usable
            ):
                document.classification_reason = (
                    "Dokumentet verkar vara en tom provblankett — "
                    "inga ifyllda elevuppgifter hittades."
                )
            else:
                document.classification_reason = (
                    "Inget elevarbete kunde identifieras på sidorna."
                )
        else:
            document.document_type = "unverified"

    return merged


def _data_url(upload: UploadedFile) -> str:
    encoded = base64.b64encode(upload.content).decode("ascii")
    mime = upload.content_type or "application/octet-stream"
    return f"data:{mime};base64,{encoded}"


_MATH_NOTATION = re.compile(r"(?:\\frac|\\sqrt|[=+*/^]|\d\s*-\s*\d|\b(?:sin|cos|tan|log)\s*\()", re.IGNORECASE)
_MATH_TERMS = re.compile(r"\b(?:beräkna|lös|ekvation|uttryck|deriv|integr|algebra|procent|area|volym|hastighet|kraft|energi)\b", re.IGNORECASE)


def requires_math_verification(item: AnswerKeyItem) -> bool:
    if item.mathematical_verification is not None:
        return item.mathematical_verification
    text = f"{item.question_text}\n{item.final_answer}"
    return bool(_MATH_NOTATION.search(text) or _MATH_TERMS.search(text))


async def apply_math_verification(
    questions: list,
    answer_key: list[AnswerKeyItem],
) -> None:
    items = {str(item.question_number).strip(): item for item in answer_key}
    verifier = get_math_provider()
    configured = bool(settings.WOLFRAM_API_URL or settings.WOLFRAM_APP_ID)
    for question in questions:
        item = items.get(question.questionNumber)
        if not item or not requires_math_verification(item):
            question.mathVerification = MathVerification()
            continue
        if not question.found or not question.studentWork.strip():
            question.mathVerification = MathVerification(
                provider="wolfram" if configured else "development-local",
                status="unavailable",
                message="Matematisk verifiering kräver ett läsbart elevsvar.",
            )
            continue
        try:
            verification = await verifier.verify_equation(question.studentWork, item.final_answer)
        except Exception:
            logger.exception("math_verification_crashed question=%s", question.questionNumber)
            question.mathVerification = MathVerification(
                provider="wolfram" if configured else "development-local",
                status="failed",
                message="Den matematiska verifieringen misslyckades och kräver lärargranskning.",
            )
            question.assessment.status = "needs_review"
            continue

        if not configured:
            status = "degraded"
            message = "Wolfram är inte konfigurerat; endast lokal deterministisk jämförelse kördes."
        elif verification.confidence >= 0.85:
            status = "verified" if verification.is_correct else "not_equivalent"
            message = (
                "Wolfram verifierade att slutsvaret är matematiskt ekvivalent."
                if verification.is_correct
                else "Wolfram kunde inte verifiera slutsvaret som matematiskt ekvivalent."
            )
        else:
            status = "degraded"
            message = "Wolfram gav inget tillräckligt säkert svar; lärargranskning krävs."

        question.mathVerification = MathVerification(
            provider="wolfram" if configured else "development-local",
            status=status,
            isEquivalent=verification.is_correct,
            confidence=verification.confidence,
            message=message,
        )
        if status == "verified" and not item.derivation_steps and not item.reasoning_requirements and not item.rubric:
            question.assessment.status = "correct"
            question.assessment.points = question.assessment.maxPoints
        elif status == "not_equivalent" and question.assessment.status == "correct":
            question.assessment.status = "needs_review"
            question.assessment.points = 0.0


async def apply_feedback_provider(questions: list) -> None:
    provider = feedback.provider_name()
    for question in questions:
        if question.error or not question.found or not question.studentWork.strip():
            question.feedbackProvider = "system"
            continue
        if provider == "unavailable":
            question.feedbackProvider = "gemini-vision" if settings.GEMINI_API_KEY else "unavailable"
            continue
        math = question.mathVerification
        wolfram = WolframResult(
            is_correct=bool(math.isEquivalent),
            confidence=math.confidence,
            notes=math.message or None,
        )
        try:
            fb = get_feedback_provider()
            generated, used = await fb.generate_feedback(
                problem=question.questionText,
                student_answer=question.studentWork,
                correct_answer=question.correctAnswer,
                wolfram=wolfram,
            )
        except Exception:
            logger.exception("feedback_provider_failed question=%s provider=%s", question.questionNumber, provider)
            question.feedbackProvider = "gemini-vision" if question.feedback else "unavailable"
            continue
        if generated:
            question.feedback = generated
            question.feedbackProvider = used


# Så många elevdokument analyseras samtidigt. Håller nere risken för 429
# samtidigt som en klassuppsättning inte tar orimligt lång tid.
_MAX_CONCURRENT_DOCUMENTS = 3


def _not_student_submission_question(item: AnswerKeyItem, reason: str) -> QuestionResult:
    """Flaggat dokument: rättas aldrig, men ytas som needs_review med tydlig
    orsak så läraren ser att fel fil laddades — inte en falsk 0-poängare."""
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
        feedback=(
            "Detta dokument verkar inte vara en elevinlämning — "
            "ingen uppgift bedömdes."
        ),
        annotation=Annotation(summary=reason),
        aiVerdict="needs_review",
        baseAnnotation=reason,
    )


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
    documents = await identify_and_group_pages(files, identification_method)
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
                if gemini_vision.is_supported_document(page.content_type or "")
            ]
            unsupported = len(document.pages) - len(pages)
            if document.document_type == "not_student_submission":
                # Sidorna klassificerades som blankett/facit/annat — inget
                # elevarbete. Rättningsmotorn anropas aldrig; varje fråga
                # blir needs_review med tydlig orsak för läraren.
                meta = DocumentMeta(
                    pageCount=len(document.pages),
                    model=settings.GEMINI_MODEL,
                    questionsExpected=len(answer_key),
                    documentType="not_student_submission",
                    classificationReason=document.classification_reason,
                    error=document.classification_reason,
                    needsReviewCount=len(answer_key) or 1,
                )
                questions = [
                    _not_student_submission_question(item, document.classification_reason)
                    for item in answer_key
                ]
            else:
                try:
                    questions, meta = await get_vision_provider().analyze_document(
                        pages=pages,
                        answer_key=answer_key,
                        grading_notes=grading_notes,
                        student_label=document.student_name,
                    )
                except GradingError as e:
                    # Circuit-open or provider-level error → needs_review, never fabricated data.
                    meta = DocumentMeta(
                        pageCount=len(pages),
                        model=settings.GEMINI_MODEL,
                        questionsExpected=len(answer_key),
                        error=str(e),
                        needsReviewCount=len(answer_key) or 1,
                    )
                    questions = [
                        gemini_vision._failed_question(i, str(e))
                        for i in answer_key
                    ]
                meta.documentType = document.document_type
                if document.document_type == "unverified":
                    meta.classificationReason = (
                        "Sidorna kunde inte klassificeras — "
                        "kontrollera att dokumentet är en elevinlämning."
                    )
                await apply_math_verification(questions, answer_key)
                await apply_feedback_provider(questions)
            if unsupported:
                note = f"{unsupported} sida/sidor hade filformat som inte kan analyseras."
                meta.error = f"{meta.error} | {note}" if meta.error else note

            # Föredra namn som extraherats från bilden (name_field) framför filnamnet.
            resolved_name = meta.studentName or document.student_name
            return StudentDocumentResult(
                id=str(uuid.uuid4()),
                provId=prov_id,
                studentName=resolved_name,
                identificationMethod=document.identification_method,
                identificationConfidence=document.identification_confidence,
                scanPages=[_data_url(page) for page in document.pages],
                sourceFiles=list(
                    dict.fromkeys(p.source_id or p.filename for p in document.pages)
                ),
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


def _provider_name(getter) -> str:
    """Resolve a provider's name, returning 'unavailable' on failure."""
    try:
        return getter().name
    except Exception:
        return "unavailable"


def integration_status() -> dict[str, bool | str]:
    from .providers.registry import (
        get_feedback_provider,
        get_math_provider,
        get_ocr_provider,
        get_vision_provider,
    )

    return {
        "wolfram": bool(settings.WOLFRAM_APP_ID or settings.WOLFRAM_API_URL),
        "gemini": bool(settings.GEMINI_API_KEY),
        "groq": bool(settings.GROQ_API_KEY),
        "anthropic": bool(settings.ANTHROPIC_API_KEY),
        "mathpix": bool(settings.MATHPIX_APP_ID and settings.MATHPIX_APP_KEY),
        "ocrProvider": _provider_name(get_ocr_provider),
        "gradingProvider": _provider_name(get_vision_provider),
        "feedbackProvider": _provider_name(get_feedback_provider),
        "mathProvider": _provider_name(get_math_provider),
        "mathpixStatus": "configured_not_active_in_batch" if settings.MATHPIX_APP_ID and settings.MATHPIX_APP_KEY else "not_configured",
        "gradingEngine": "gemini-vision" if gemini_vision.available() else "unconfigured",
        "model": settings.GEMINI_MODEL,
    }
