"""Diagnostik: verifierar OpenAI text- och vision-anrop direkt mot API:t."""
from __future__ import annotations

import asyncio
import base64
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "apps" / "api"))

from app.config import settings  # noqa: E402
from app.services import openai_client, vision_ocr  # noqa: E402

HERE = pathlib.Path(__file__).parent


async def main() -> None:
    print("Nyckel satt:", bool(settings.OPENAI_API_KEY), "| textmodell:", settings.OPENAI_FEEDBACK_MODEL)
    print("visionmodell:", settings.OPENAI_VISION_MODEL)

    try:
        text = await openai_client.complete_text("Svara kort på svenska.", "Säg hej.", max_tokens=40)
        print("TEXT OK:", text[:120])
    except Exception as e:  # noqa: BLE001
        print("TEXT FEL:", type(e).__name__, e)

    image = next(iter(sorted(HERE.glob("*.png"))), None)
    if image is None:
        print("Ingen bild att testa vision med.")
        return
    try:
        data_url = f"data:image/png;base64,{base64.b64encode(image.read_bytes()).decode('ascii')}"
        out = await vision_ocr._openai_style(
            "https://api.openai.com/v1/chat/completions",
            settings.OPENAI_API_KEY,
            settings.OPENAI_VISION_MODEL,
            data_url,
            "Läs av all text i bilden.",
            token_param="max_completion_tokens",
            timeout_seconds=settings.OPENAI_TIMEOUT_SECONDS,
        )
        print("VISION OK:", out[:300])
    except Exception as e:  # noqa: BLE001
        print("VISION FEL:", type(e).__name__, e)


if __name__ == "__main__":
    asyncio.run(main())
