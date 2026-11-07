#!/usr/bin/env python3
"""Generate the app icons into public/. Placeholder design: rounded square with a 3x3 grid."""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public"
BG = "#2b2b2b"
FG = "#f6f1e7"
ACCENT = "#7fc1d8"


def draw_icon(size: int, maskable: bool) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if maskable:
        d.rectangle((0, 0, size, size), fill=BG)
        pad = size * 0.2
    else:
        d.rounded_rectangle((0, 0, size - 1, size - 1), radius=size * 0.22, fill=BG)
        pad = size * 0.14
    grid = size - 2 * pad
    cell = grid / 3
    line = max(2, round(size * 0.025))
    for i in range(4):
        x = pad + i * cell
        d.line((x, pad, x, pad + grid), fill=FG, width=line)
        d.line((pad, x, pad + grid, x), fill=FG, width=line)
    # a few filled cells, like a puzzle in progress
    for (r, c) in [(0, 0), (1, 1), (2, 2), (0, 2)]:
        x0 = pad + c * cell + line
        y0 = pad + r * cell + line
        d.rectangle((x0, y0, x0 + cell - 2 * line, y0 + cell - 2 * line), fill=ACCENT)
    return img


def main() -> None:
    OUT.mkdir(exist_ok=True)
    draw_icon(192, False).save(OUT / "icon-192.png")
    draw_icon(512, False).save(OUT / "icon-512.png")
    draw_icon(512, True).save(OUT / "icon-maskable-512.png")
    print("icons written to", OUT)


if __name__ == "__main__":
    main()
