import base64

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from .. import schemas
from ..services.answer_key import extract_answer_key, generate_answer_key
from ..services.ocr import process_image

router = APIRouter(prefix="/api/v1/ocr", tags=["ocr"])

MAX_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED = {"image/png", "image/jpeg", "image/jpg", "image/webp", "application/pdf"}


@router.post("/process", response_model=schemas.OcrResponse)
async def ocr_process(payload: schemas.OcrRequest):
    return await process_image(payload.image_base64)


@router.post("/upload", response_model=schemas.OcrResponse)
async def ocr_upload(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED:
        raise HTTPException(415, f"Filtyp {file.content_type} stöds inte")
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "Filen är för stor (max 10 MB)")
    mime = file.content_type or "image/png"
    b64 = f"data:{mime};base64,{base64.b64encode(data).decode('ascii')}"
    return await process_image(b64)


@router.post("/answer-key/upload", response_model=list[schemas.AnswerKeyItem])
async def answer_key_upload(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED:
        raise HTTPException(415, f"Filtyp {file.content_type} stöds inte")
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "Filen är för stor (max 10 MB)")
    return await extract_answer_key(data, file.content_type or "application/pdf")


@router.post("/answer-key/generate", response_model=list[schemas.AnswerKeyItem])
async def answer_key_generate(
    description: str = Form(""),
    question_count: int = Form(4),
):
    count = max(1, min(question_count, 20))
    return await generate_answer_key(description, count)
