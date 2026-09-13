"""PDF and MIME-type validation tests.

Tests that PDF expansion, MIME filtering, and file-count limits behave
correctly — no network required.
"""
from __future__ import annotations

import sys
from io import BytesIO
from pathlib import Path

import pytest
from pypdf import PdfWriter

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.services.batch_pipeline import (
    UploadedFile,
    expand_pdf_uploads,
    gemini_vision,
)

PNG_1PX = bytes.fromhex(
    "89504e470d0a1a0a0000000d494844520000000100000001080600000"
    "01f15c4890000000a49444154789c63000100000500010d0a2db40000"
    "000049454e44ae426082"
)


def _make_pdf(pages: int = 1) -> bytes:
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=612, height=792)
    buf = BytesIO()
    writer.write(buf)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# MIME type support
# ---------------------------------------------------------------------------


def test_is_supported_document_png():
    assert gemini_vision.is_supported_document("image/png")


def test_is_supported_document_jpeg():
    assert gemini_vision.is_supported_document("image/jpeg")


def test_is_supported_document_pdf():
    assert gemini_vision.is_supported_document("application/pdf")


def test_is_supported_document_rejects_html():
    assert not gemini_vision.is_supported_document("text/html")


def test_is_supported_document_rejects_empty():
    assert not gemini_vision.is_supported_document("")


# ---------------------------------------------------------------------------
# PDF expansion
# ---------------------------------------------------------------------------


def test_expand_pdf_uploads_single_page():
    pdf = _make_pdf(pages=1)
    uploads = [UploadedFile(filename="test.pdf", content=pdf, content_type="application/pdf")]
    expanded = expand_pdf_uploads(uploads)
    assert len(expanded) == 1
    assert expanded[0].content_type == "image/jpeg"
    assert expanded[0].page_number == 1
    assert expanded[0].source_id == "test.pdf"


def test_expand_pdf_uploads_multi_page():
    pdf = _make_pdf(pages=3)
    uploads = [UploadedFile(filename="test.pdf", content=pdf, content_type="application/pdf")]
    expanded = expand_pdf_uploads(uploads)
    assert len(expanded) == 3
    assert all(u.content_type == "image/jpeg" for u in expanded)
    assert [u.page_number for u in expanded] == [1, 2, 3]
    assert all(u.source_id == "test.pdf" for u in expanded)


def test_expand_pdf_uploads_rejects_invalid_pdf():
    uploads = [
        UploadedFile(filename="bad.pdf", content=b"not a pdf", content_type="application/pdf")
    ]
    with pytest.raises(ValueError, match="inte en giltig PDF"):
        expand_pdf_uploads(uploads)


def test_expand_pdf_uploads_rejects_empty_pdf():
    writer = PdfWriter()
    buf = BytesIO()
    writer.write(buf)
    uploads = [
        UploadedFile(filename="empty.pdf", content=buf.getvalue(), content_type="application/pdf")
    ]
    with pytest.raises(ValueError, match="inga sidor"):
        expand_pdf_uploads(uploads)


def test_expand_pdf_uploads_respects_max_pages():
    pdf = _make_pdf(pages=5)
    uploads = [UploadedFile(filename="big.pdf", content=pdf, content_type="application/pdf")]
    with pytest.raises(ValueError, match="fler än"):
        expand_pdf_uploads(uploads, max_pages=3)


def test_expand_pdf_uploads_passes_images_through():
    uploads = [
        UploadedFile(filename="img.png", content=PNG_1PX, content_type="image/png"),
        UploadedFile(filename="img2.jpg", content=PNG_1PX, content_type="image/jpeg"),
    ]
    expanded = expand_pdf_uploads(uploads)
    assert len(expanded) == 2
    assert expanded[0].content_type == "image/png"
    assert expanded[1].content_type == "image/jpeg"
    assert expanded[0].source_id is None
    assert expanded[1].source_id is None


def test_expand_pdf_uploads_max_pages_boundary():
    """Exactly at max_pages is allowed; one over is rejected."""
    pdf = _make_pdf(pages=3)
    uploads = [UploadedFile(filename="test.pdf", content=pdf, content_type="application/pdf")]
    expanded = expand_pdf_uploads(uploads, max_pages=3)
    assert len(expanded) == 3

    with pytest.raises(ValueError, match="fler än"):
        expand_pdf_uploads(uploads, max_pages=2)
