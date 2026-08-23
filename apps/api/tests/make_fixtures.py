"""Genererar testbilder för golden-sviten.

Två sorter:
  derived   – riktiga elevbilder som transformeras (delas, roteras, försämras)
  synthetic – renderade scenarier vi saknar riktigt material för

Ingen fixture innehåller ett facit-svar som eleven inte faktiskt "skrivit" —
scenarierna är konstruerade så att det står klart vad rätt bedömning är.

Kör:  python tests/make_fixtures.py
"""
from __future__ import annotations

import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
FIXTURES = HERE / "fixtures"
# Riktigt elevmaterial som testsviten äger själv.
REAL = FIXTURES / "real"

REAL_PHYSICS = REAL / "physics_prov.jpg"
REAL_ANNA = REAL / "Anna_Andersson.png"

WHITE = (255, 255, 255)
INK = (20, 24, 40)
PEN = (30, 50, 140)
TEACHER_RED = (200, 40, 40)


def _font(size: int, *, italic: bool = False) -> ImageFont.FreeTypeFont:
    """Handskriftsliknande typsnitt där det finns, annars ett vanligt."""
    candidates = [
        "C:/Windows/Fonts/Ink Free.ttf" if not italic else "C:/Windows/Fonts/segoeuii.ttf",
        "C:/Windows/Fonts/segoesc.ttf",
        "C:/Windows/Fonts/comic.ttf",
        "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/segoeui.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default(size)


def _canvas(width: int = 1000, height: int = 1200) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    img = Image.new("RGB", (width, height), WHITE)
    return img, ImageDraw.Draw(img)


def _save(img: Image.Image, name: str) -> None:
    FIXTURES.mkdir(parents=True, exist_ok=True)
    img.save(FIXTURES / name)
    print(f"  wrote {name}  ({img.width}x{img.height})")


def _lines(
    draw: ImageDraw.ImageDraw,
    start_xy: tuple[int, int],
    rows: list[tuple[str, ImageFont.FreeTypeFont, tuple[int, int, int]]],
    leading: int = 46,
    jitter: int = 0,
) -> int:
    x, y = start_xy
    for text, font, colour in rows:
        dx = random.randint(-jitter, jitter) if jitter else 0
        dy = random.randint(-jitter, jitter) if jitter else 0
        draw.text((x + dx, y + dy), text, font=font, fill=colour)
        y += leading
    return y


# ---------------------------------------------------------------------------
# Derived – från riktiga elevbilder
# ---------------------------------------------------------------------------


def make_multipage_from_physics() -> None:
    """Delar det tvåarks-fotograferade fysikprovet i två separata sidor.

    Vänstra arket (Fråga 1 + Fråga 2) blir sida 1, högra arket (Fråga 2 +
    Fråga 3) blir sida 2. Fråga 2 spänner därmed över båda sidorna.
    """
    src = Image.open(REAL_PHYSICS).convert("RGB")
    mid = int(src.width * 0.503)
    _save(src.crop((0, 0, mid, src.height)), "physics_multipage_page1.png")
    _save(src.crop((mid, 0, src.width, src.height)), "physics_multipage_page2.png")


def make_rotated_from_anna() -> None:
    src = Image.open(REAL_ANNA).convert("RGB")
    _save(src.rotate(90, expand=True, fillcolor=WHITE), "math_rotated.png")


def make_low_quality_from_anna() -> None:
    """Nedskalning + brus + lågkontrast, som ett dåligt mobilfoto."""
    src = Image.open(REAL_ANNA).convert("RGB")
    small = src.resize((src.width // 4, src.height // 4), Image.BILINEAR)
    degraded = small.resize((src.width // 2, src.height // 2), Image.BILINEAR)
    degraded = degraded.filter(ImageFilter.GaussianBlur(radius=1.1))

    random.seed(7)
    pixels = degraded.load()
    for _ in range(degraded.width * degraded.height // 12):
        x = random.randrange(degraded.width)
        y = random.randrange(degraded.height)
        shift = random.randint(-55, 55)
        r, g, b = pixels[x, y]
        pixels[x, y] = (
            max(0, min(255, r + shift)),
            max(0, min(255, g + shift)),
            max(0, min(255, b + shift)),
        )
    # Sänk kontrasten mot grått.
    grey = Image.new("RGB", degraded.size, (128, 128, 128))
    _save(Image.blend(degraded, grey, 0.28), "math_low_quality.png")


# ---------------------------------------------------------------------------
# Synthetic – scenarier vi saknar riktigt material för
# ---------------------------------------------------------------------------

# Radbruten så att den ryms på 1000px bredd utan att klippas.
_PROMPT_L1 = "Uppgift 1: Bestäm hastigheten v vid t = 3 s"
_PROMPT_L2 = "då s(t) = 2t² + 5t."


def _prompt_rows(font: ImageFont.FreeTypeFont) -> list:
    return [(_PROMPT_L1, font, INK), (_PROMPT_L2, font, INK)]


def make_blank_answer() -> None:
    img, d = _canvas(1000, 700)
    head, hand = _font(34), _font(38)
    _lines(d, (60, 50), [("Namn: Johan Berg", head, INK), *_prompt_rows(head)], leading=52)
    d.text((60, 220), "Lösning:", font=head, fill=INK)
    # Tomma svarsrader – eleven har inte skrivit något.
    for i in range(4):
        y = 280 + i * 62
        d.line((60, y, 940, y), fill=(190, 190, 200), width=2)
    d.text((60, 560), "Svar: ______________", font=hand, fill=(190, 190, 200))
    _save(img, "blank_answer.png")


def make_crossed_out() -> None:
    img, d = _canvas(1000, 820)
    head, hand = _font(34), _font(38)
    _lines(d, (60, 50), [("Namn: Sara Lind", head, INK), *_prompt_rows(head)], leading=52)
    d.text((60, 220), "Lösning:", font=head, fill=INK)

    # Förkastat försök
    d.text((60, 275), "v(t) = 4t", font=hand, fill=PEN)
    d.text((60, 330), "v(3) = 12", font=hand, fill=PEN)
    d.line((55, 296, 330, 296), fill=PEN, width=4)
    d.line((55, 351, 330, 351), fill=PEN, width=4)
    d.line((55, 268, 335, 360), fill=PEN, width=3)

    # Gällande lösning
    _lines(
        d, (60, 420),
        [
            ("v(t) = s'(t) = 4t + 5", hand, PEN),
            ("v(3) = 4*3 + 5 = 12 + 5 = 17", hand, PEN),
            ("Svar: v = 17 m/s", hand, PEN),
        ],
        leading=64,
    )
    _save(img, "crossed_out.png")


def make_teacher_marks() -> None:
    img, d = _canvas(1000, 780)
    head, hand, teacher = _font(34), _font(38), _font(36, italic=True)
    _lines(d, (60, 50), [("Namn: Oskar Ek", head, INK), *_prompt_rows(head)], leading=52)
    _lines(
        d, (60, 230),
        [
            ("Lösning:", head, INK),
            ("v(t) = s'(t) = 4t + 5", hand, PEN),
            ("v(3) = 4*3 + 5 = 17", hand, PEN),
            ("Svar: v = 17 m/s", hand, PEN),
        ],
        leading=62,
    )
    # Lärarens egna markeringar – ska INTE hamna i studentWork.
    d.text((700, 300), "✓", font=_font(70), fill=TEACHER_RED)
    d.text((620, 560), "Bra jobbat! 3/3", font=teacher, fill=TEACHER_RED)
    d.text((620, 610), "/Läraren", font=teacher, fill=TEACHER_RED)
    _save(img, "teacher_marks.png")


def make_extra_question() -> None:
    """Bilden har uppgift 1 OCH 2, men facit innehåller bara uppgift 1."""
    img, d = _canvas(1000, 900)
    head, hand = _font(32), _font(36)
    d.text((60, 45), "Namn: Elin Norr", font=head, fill=INK)
    _lines(
        d, (60, 110),
        [
            *_prompt_rows(head),
            ("v(t) = 4t + 5", hand, PEN),
            ("v(3) = 4*3 + 5 = 17", hand, PEN),
            ("Svar: v = 17 m/s", hand, PEN),
        ],
        leading=58,
    )
    _lines(
        d, (60, 420),
        [
            ("Uppgift 2: Beräkna accelerationen a vid t = 3 s.", head, INK),
            ("a(t) = v'(t) = 4", hand, PEN),
            ("Svar: a = 4 m/s²", hand, PEN),
        ],
        leading=58,
    )
    _save(img, "extra_question.png")


def make_math_notation() -> None:
    img, d = _canvas(1000, 760)
    head, hand, big = _font(34), _font(40), _font(52)
    _lines(
        d, (60, 50),
        [("Namn: Nils Ohlsson", head, INK),
         ("Uppgift 1: Lös ekvationen x² = 16 där x > 0.", head, INK)],
        leading=64,
    )
    d.text((60, 210), "Lösning:", font=head, fill=INK)
    d.text((60, 275), "x² = 16", font=hand, fill=PEN)
    # Rottecken ritat för hand
    d.text((60, 345), "x = ", font=hand, fill=PEN)
    d.line((135, 360, 150, 392), fill=PEN, width=4)
    d.line((150, 392, 168, 340), fill=PEN, width=4)
    d.line((168, 340, 250, 340), fill=PEN, width=4)
    d.text((178, 348), "16", font=hand, fill=PEN)
    d.text((60, 430), "x = 4", font=big, fill=PEN)
    d.text((60, 520), "Svar: x = 4", font=hand, fill=PEN)
    _save(img, "math_notation.png")


def make_wrong_answer() -> None:
    img, d = _canvas(1000, 760)
    head, hand = _font(34), _font(38)
    _lines(d, (60, 50), [("Namn: Vera Falk", head, INK), *_prompt_rows(head)], leading=52)
    _lines(
        d, (60, 230),
        [
            ("Lösning:", head, INK),
            ("s(t) = 2t² + 5t", hand, PEN),
            ("v(t) = 2t + 5", hand, PEN),      # fel derivata
            ("v(3) = 2*3 + 5 = 11", hand, PEN),
            ("Svar: v = 11 m/s", hand, PEN),
        ],
        leading=62,
    )
    _save(img, "wrong_answer.png")


def make_between_lines() -> None:
    """Svaret står inklämt mellan linjerade rader och i marginalen."""
    img, d = _canvas(1000, 820)
    head, small = _font(32), _font(30)
    d.text((60, 40), "Namn: Hugo Ström", font=head, fill=INK)
    d.text((60, 95), _PROMPT_L1, font=head, fill=INK)
    d.text((60, 140), _PROMPT_L2, font=head, fill=INK)
    for i in range(7):
        y = 210 + i * 78
        d.line((60, y, 940, y), fill=(200, 205, 220), width=2)
    # Elevens text mellan raderna
    d.text((80, 205), "v(t) = s'(t) = 4t + 5", font=small, fill=PEN)
    d.text((300, 285), "v(3) = 4*3 + 5", font=small, fill=PEN)
    d.text((110, 363), "= 12 + 5 = 17", font=small, fill=PEN)
    # I marginalen
    d.text((640, 440), "Svar: 17 m/s", font=small, fill=PEN)
    _save(img, "between_lines.png")


def make_five_questions() -> None:
    img, d = _canvas(1000, 1100)
    head, hand = _font(32), _font(36)
    d.text((60, 40), "Namn: Moa Lindqvist", font=head, fill=INK)
    rows = [
        ("Uppgift 1: Vad är 7 + 5?", "Svar: 12"),
        ("Uppgift 2: Vad är 9 * 3?", "Svar: 27"),
        ("Uppgift 3: Vad är 20 - 8?", "Svar: 12"),
        ("Uppgift 4: Vad är 36 / 6?", "Svar: 7"),   # fel, rätt är 6
        ("Uppgift 5: Vad är 2^5?", "Svar: 32"),
    ]
    y = 120
    for prompt, answer in rows:
        d.text((60, y), prompt, font=head, fill=INK)
        d.text((110, y + 52), answer, font=hand, fill=PEN)
        y += 180
    _save(img, "five_questions.png")


def make_messy_handwriting() -> None:
    random.seed(11)
    img, d = _canvas(1000, 780)
    head = _font(32)
    d.text((60, 40), "Namn: Kalle Sjo", font=head, fill=INK)
    d.text((60, 95), _PROMPT_L1, font=head, fill=INK)
    d.text((60, 140), _PROMPT_L2, font=head, fill=INK)

    rows = [
        "v(t) = s'(t) = 4t + 5",
        "v(3) = 4*3 + 5",
        "= 12 + 5",
        "Svar: v = 17 m/s",
    ]
    y = 230
    for text in rows:
        # Varje tecken får egen jitter och rotation -> skakig handstil.
        x = 70
        for ch in text:
            f = _font(random.randint(32, 44))
            layer = Image.new("RGBA", (70, 80), (0, 0, 0, 0))
            ImageDraw.Draw(layer).text((10, 10), ch, font=f, fill=PEN + (255,))
            layer = layer.rotate(random.uniform(-13, 13), resample=Image.BICUBIC)
            img.paste(layer, (x, y + random.randint(-9, 9)), layer)
            x += max(16, int(f.getlength(ch)) + random.randint(-2, 4))
        y += 110
    _save(img, "messy_handwriting.png")


def make_diagram_answer() -> None:
    img, d = _canvas(1000, 820)
    head, hand, small = _font(32), _font(34), _font(28)
    d.text((60, 40), "Namn: Iris Palm", font=head, fill=INK)
    d.text((60, 95), "Uppgift 1: Rita en graf som visar hur sträckan ökar", font=head, fill=INK)
    d.text((60, 140), "linjärt med tiden.", font=head, fill=INK)

    ox, oy = 200, 640
    d.line((ox, oy, ox, 250), fill=PEN, width=4)           # y-axel
    d.line((ox, oy, 760, oy), fill=PEN, width=4)           # x-axel
    d.line((ox, oy, 700, 300), fill=PEN, width=5)          # rät linje genom origo
    d.text((ox - 60, 240), "s (m)", font=small, fill=PEN)
    d.text((770, oy - 18), "t (s)", font=small, fill=PEN)
    d.text((ox - 28, oy + 12), "0", font=small, fill=PEN)
    d.text((430, 330), "rät linje", font=small, fill=PEN)
    d.text((60, 700), "Svar: s ökar linjärt med t, rät linje genom origo.", font=hand, fill=PEN)
    _save(img, "diagram_answer.png")


def main() -> None:
    FIXTURES.mkdir(parents=True, exist_ok=True)
    print("Derived (från riktiga elevbilder):")
    make_multipage_from_physics()
    make_rotated_from_anna()
    make_low_quality_from_anna()
    print("Synthetic:")
    make_blank_answer()
    make_crossed_out()
    make_teacher_marks()
    make_extra_question()
    make_math_notation()
    make_wrong_answer()
    make_between_lines()
    make_five_questions()
    make_messy_handwriting()
    make_diagram_answer()
    print(f"\nKlart. Fixtures i {FIXTURES}")


if __name__ == "__main__":
    main()
