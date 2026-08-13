"""Diagnostik: verifierar Groq text- och vision-anrop direkt mot API:t."""
from __future__ import annotations

import asyncio
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "apps" / "api"))

from app.config import settings  # noqa: E402
from app.services import groq_client  # noqa: E402

HERE = pathlib.Path(__file__).parent


async def main() -> None:
    print("Nyckel satt:", bool(settings.GROQ_API_KEY), "| textmodell:", settings.GROQ_MODEL)
    print("visionmodell:", settings.GROQ_VISION_MODEL)

    try:
        text = await groq_client.complete_text("Svara kort på svenska.", "Säg hej.", max_tokens=40)
        print("TEXT OK:", text[:120])
    except Exception as e:  # noqa: BLE001
        print("TEXT FEL:", type(e).__name__, e)

    image = next(iter(sorted(HERE.glob("*.png"))), None)
    if image is None:
        print("Ingen bild att testa vision med.")
        return
    try:
        out = await groq_client.complete_vision(
            "Läs av all text i bilden.",
            "Vad står det?",
            groq_client.to_data_url(image.read_bytes(), "image/png"),
            max_tokens=300,
        )
        print("VISION OK:", out[:300])
    except Exception as e:  # noqa: BLE001
        print("VISION FEL:", type(e).__name__, e)


if __name__ == "__main__":
    asyncio.run(main())
