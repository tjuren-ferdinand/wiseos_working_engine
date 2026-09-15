# Lokal, gratis OCR med Tesseract.
#
# Används som reserv när MATHPIX och vision-API:erna (Gemini/OpenAI/OpenRouter)
# inte är konfigurerade. Swappbar mot Mathpix genom att sätta MATHPIX_APP_ID/KEY i .env.
#
# Kräver att Tesseract är installerat:
# - Windows: https://github.com/UB-Mannheim/tesseract/wiki
# - macOS: brew install tesseract tesseract-lang
# - Ubuntu: apt install tesseract-ocr tesseract-ocr-swe tesseract-ocr-eng
from __future__ import annotations

import io
import shutil
from pathlib import Path

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    Image = None

try:
    import pytesseract
except ImportError:  # pragma: no cover
    pytesseract = None

# Lokal tessdata-mapp (swe+eng nedladdade hit)
TESSDATA_DIR = Path(__file__).resolve().parents[2] / "tessdata"


def _set_tesspath():
    from ..config import settings

    if settings.TESSERACT_CMD:
        return settings.TESSERACT_CMD
    found = shutil.which('tesseract')
    if found:
        return found
    # Vanliga Windows-sökvägar om PATH inte uppdaterats
    candidates = [
        r'C:\Program Files\Tesseract-OCR\tesseract.exe',
        r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe',
    ]
    for cand in candidates:
        if shutil.which(cand):
            return cand
    return 'tesseract'


def tesseract_available():
    if pytesseract is None:
        return False
    try:
        pytesseract.pytesseract.tesseract_cmd = _set_tesspath()
        if not shutil.which(pytesseract.pytesseract.tesseract_cmd):
            return False
        return True
    except Exception:
        return False


def read_image(image_bytes, *_args, **_kwargs):
    # Synkron OCR på en bild.
    if not tesseract_available():
        return None

    try:
        image = Image.open(io.BytesIO(image_bytes))
        if image.mode not in ('L', 'RGB'):
            image = image.convert('RGB')

        # Använd lokal tessdata-mapp; försök swe+eng, annars eng
        # psm 1 ger Tesseract friare sidsegmentering (bättre på tvåspaltiga prov)
        tessdata_arg = f'--tessdata-dir {TESSDATA_DIR}'
        config = f'--psm 1 -c preserve_interword_spaces=1 {tessdata_arg}'
        try:
            text = pytesseract.image_to_string(
                image,
                lang='swe+eng',
                config=config,
            )
        except pytesseract.TesseractError:
            text = pytesseract.image_to_string(
                image,
                lang='eng',
                config=config,
            )
        return text.strip() or None
    except Exception:
        return None
