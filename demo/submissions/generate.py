from PIL import Image, ImageDraw, ImageFont
import os

WIDTH, HEIGHT = 800, 1100
WHITE = (255, 255, 255)
BLACK = (20, 20, 20)


def make_image(name: str, lines: list[str], filename: str):
    img = Image.new("RGB", (WIDTH, HEIGHT), WHITE)
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("arial.ttf", 28)
        header_font = ImageFont.truetype("arial.ttf", 32)
    except Exception:
        font = ImageFont.load_default()
        header_font = ImageFont.load_default()

    y = 40
    draw.text((40, y), f"Namn: {name}", fill=BLACK, font=header_font)
    y += 70
    draw.text((40, y), "Uppgift: Bestäm hastigheten v vid t = 3 s", fill=BLACK, font=font)
    y += 60
    draw.text((40, y), "då s(t) = 2t² + 5t.", fill=BLACK, font=font)
    y += 80
    for line in lines:
        draw.text((40, y), line, fill=BLACK, font=font)
        y += 50

    out_path = os.path.join(os.path.dirname(__file__), filename)
    img.save(out_path, "PNG")
    print(f"Saved {out_path}")


if __name__ == "__main__":
    make_image(
        "Anna Andersson",
        [
            "Lösning:",
            "s(t) = 2t² + 5t",
            "v(t) = s'(t) = 4t + 5",
            "v(3) = 4*3 + 5 = 12 + 5 = 17",
            "Svar: v = 17 m/s",
        ],
        "Anna_Andersson.png",
    )
    make_image(
        "Erik Eriksson",
        [
            "Lösning:",
            "s(t) = 2t² + 5t",
            "v(t) = 4t + 5",
            "v(3) = 4*3 + 5 = 16 + 5 = 21",
            "Svar: v = 21 m/s",
        ],
        "Erik_Eriksson.png",
    )
    make_image(
        "Linnea Svensson",
        [
            "Lösning:",
            "s(t) = 2t² + 5t",
            "v(t) = 4t + 5",
            "v(3) = 4*3 + 5 = 17",
            "Svar: v = 17 m/s",
        ],
        "Linnea_Svensson.png",
    )
