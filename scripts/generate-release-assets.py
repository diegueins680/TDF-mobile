#!/usr/bin/env python3

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets'
ASSETS.mkdir(exist_ok=True)

BACKGROUND = '#0B1724'
BACKGROUND_ALT = '#17314A'
GOLD = '#D4A64A'
GOLD_SOFT = '#E8C77B'
CREAM = '#F5F1E8'


def make_background(size: int) -> Image.Image:
    image = Image.new('RGBA', (size, size), BACKGROUND)
    draw = ImageDraw.Draw(image)
    for y in range(size):
        blend = y / max(size - 1, 1)
        r = int(11 + ((23 - 11) * blend))
        g = int(23 + ((49 - 23) * blend))
        b = int(36 + ((74 - 36) * blend))
        draw.line([(0, y), (size, y)], fill=(r, g, b, 255))

    glow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse(
        (size * 0.08, size * 0.08, size * 0.92, size * 0.92),
        fill=(232, 199, 123, 28),
    )
    glow_draw.ellipse(
        (size * 0.2, size * 0.14, size * 0.82, size * 0.76),
        fill=(23, 49, 74, 90),
    )
    glow = glow.filter(ImageFilter.GaussianBlur(radius=size * 0.04))
    return Image.alpha_composite(image, glow)


def draw_mark(canvas: Image.Image) -> Image.Image:
    size = canvas.size[0]
    image = canvas.copy()
    draw = ImageDraw.Draw(image)

    circle_bounds = (size * 0.16, size * 0.16, size * 0.84, size * 0.84)
    draw.ellipse(circle_bounds, outline=CREAM, width=max(8, size // 36))

    bar_width = size * 0.09
    gap = size * 0.05
    left = size * 0.34
    bars = [
        (left, size * 0.33, left + bar_width, size * 0.68),
        (left + bar_width + gap, size * 0.26, left + (bar_width * 2) + gap, size * 0.74),
        (left + (bar_width * 2) + (gap * 2), size * 0.39, left + (bar_width * 3) + (gap * 2), size * 0.63),
    ]
    for idx, bounds in enumerate(bars):
        color = GOLD if idx != 1 else GOLD_SOFT
        draw.rounded_rectangle(bounds, radius=size * 0.04, fill=color)

    wave = [
        (size * 0.25, size * 0.62),
        (size * 0.39, size * 0.54),
        (size * 0.5, size * 0.58),
        (size * 0.63, size * 0.44),
        (size * 0.75, size * 0.5),
    ]
    draw.line(wave, fill=CREAM, width=max(8, size // 44), joint='curve')
    return image


def save_app_icon(path: Path) -> None:
    image = draw_mark(make_background(1024))
    accent = Image.new('RGBA', image.size, (0, 0, 0, 0))
    accent_draw = ImageDraw.Draw(accent)
    accent_draw.arc(
        (220, 220, 804, 804),
        start=200,
        end=342,
        fill=BACKGROUND_ALT,
        width=24,
    )
    accent = accent.filter(ImageFilter.GaussianBlur(radius=10))
    Image.alpha_composite(image, accent).convert('RGB').save(path)


def save_adaptive_icon(path: Path) -> None:
    base = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    mark = draw_mark(Image.new('RGBA', (720, 720), (0, 0, 0, 0)))
    base.alpha_composite(mark, dest=(152, 152))
    base.save(path)


def save_splash_icon(path: Path) -> None:
    base = Image.new('RGBA', (1242, 1242), (0, 0, 0, 0))
    mark = draw_mark(Image.new('RGBA', (700, 700), (0, 0, 0, 0)))
    base.alpha_composite(mark, dest=(271, 271))
    base.save(path)


def save_favicon(path: Path) -> None:
    icon = draw_mark(make_background(256)).resize((48, 48), Image.Resampling.LANCZOS)
    icon.save(path)


save_app_icon(ASSETS / 'app-icon.png')
save_adaptive_icon(ASSETS / 'adaptive-icon.png')
save_splash_icon(ASSETS / 'splash-icon.png')
save_favicon(ASSETS / 'favicon.png')
