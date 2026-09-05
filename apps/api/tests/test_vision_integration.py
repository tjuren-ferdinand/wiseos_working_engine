"""Integrationstester mot riktig Gemini-vision-provider.

Körs endast när GEMINI_API_KEY är konfigurerad. Syftar till att fånga
modellnamn/mime-problem utan att gå via hela HTTP-lagret.
"""
from __future__ import annotations

import pytest

import pymupdf

from app.config import settings
from app.schemas import AnswerKeyItem
from app.services import gemini_vision


pytestmark = pytest.mark.skipif(
    not settings.GEMINI_API_KEY,
    reason="GEMINI_API_KEY saknas – integrationstest mot Gemini kan inte köras",
)


def _tiny_exam_png() -> bytes:
    """Generera en minimal PNG med en enda uppgift och ett elev-svar."""
    doc = pymupdf.open()
    page = doc.new_page(width=400, height=200)
    page.insert_text((20, 100), "1) 2 + 2 = ?", fontsize=24, color=(0, 0, 0))
    page.insert_text((20, 150), "Elev svar: 4", fontsize=24, color=(0, 0, 0))
    pdf_bytes = doc.tobytes()
    doc.close()

    raster = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    try:
        pixmap = raster.load_page(0).get_pixmap(matrix=pymupdf.Matrix(2, 2))
        return pixmap.tobytes("png")
    finally:
        raster.close()


@pytest.mark.asyncio
async def test_gemini_analyzes_tiny_exam_image():
    image = _tiny_exam_png()
    answer_key = [
        AnswerKeyItem(
            question_number="1",
            question_text="Vad är 2 + 2?",
            final_answer="4",
            max_points=1.0,
        )
    ]

    questions, meta = await gemini_vision.analyze_document(
        pages=[(image, "image/png")],
        answer_key=answer_key,
        grading_notes="",
        student_label="Integration Test",
    )

    assert not meta.error, f"Gemini-anropet misslyckades: {meta.error}"
    assert meta.questionsFound == 1
    assert len(questions) == 1
    q = questions[0]
    assert q.found is True
    assert q.questionNumber == "1"
    assert q.assessment.status == "correct"
    assert q.assessment.points == 1.0
    assert q.studentWork.strip() == "4"
    assert q.sourceRegions, "source_regions ska vara satta så att Workbench kan visa var svaret är"


@pytest.mark.asyncio
async def test_gemini_ping_is_reachable():
    from app.services.gemini_client import ping

    assert await ping() is True
