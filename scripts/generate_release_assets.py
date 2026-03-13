#!/usr/bin/env python3

from __future__ import annotations

import math
import re
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE_GLYPH = ROOT.parent / "tdf-hq-ui" / "src" / "assets" / "tdf-isotype.svg"
SOURCE_WORDMARK = ROOT.parent / "tdf-hq-ui" / "public" / "tdf-logo-wordmark.png"
ASSETS_DIR = ROOT / "assets"

BACKGROUND = (15, 23, 42, 255)
FOREGROUND = (248, 250, 252, 255)
TOKEN_RE = re.compile(r"[A-Za-z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?")


def parse_matrix(transform: str | None) -> tuple[float, float, float, float, float, float]:
    if not transform:
        return (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)

    match = re.fullmatch(r"matrix\(([^)]+)\)", transform.strip())
    if not match:
        raise ValueError(f"Unsupported transform: {transform}")

    values = [float(part) for part in re.split(r"[,\s]+", match.group(1).strip()) if part]
    if len(values) != 6:
        raise ValueError(f"Expected 6 transform values, got {len(values)}")

    return tuple(values)  # type: ignore[return-value]


def apply_transform(point: tuple[float, float], matrix: tuple[float, float, float, float, float, float]) -> tuple[float, float]:
    x, y = point
    a, b, c, d, e, f = matrix
    return (a * x + c * y + e, b * x + d * y + f)


def cubic_points(
    start: tuple[float, float],
    control1: tuple[float, float],
    control2: tuple[float, float],
    end: tuple[float, float],
    steps: int = 30,
) -> list[tuple[float, float]]:
    points: list[tuple[float, float]] = []
    for index in range(1, steps + 1):
        t = index / steps
        inv_t = 1.0 - t
        x = (
            inv_t ** 3 * start[0]
            + 3 * inv_t ** 2 * t * control1[0]
            + 3 * inv_t * t ** 2 * control2[0]
            + t ** 3 * end[0]
        )
        y = (
            inv_t ** 3 * start[1]
            + 3 * inv_t ** 2 * t * control1[1]
            + 3 * inv_t * t ** 2 * control2[1]
            + t ** 3 * end[1]
        )
        points.append((x, y))
    return points


def tokenize_path(path_data: str) -> list[str]:
    return TOKEN_RE.findall(path_data.replace(",", " "))


def parse_path(path_data: str) -> list[list[tuple[float, float]]]:
    tokens = tokenize_path(path_data)
    index = 0
    command = ""
    current = (0.0, 0.0)
    start = (0.0, 0.0)
    current_subpath: list[tuple[float, float]] = []
    subpaths: list[list[tuple[float, float]]] = []

    def read_number() -> float:
        nonlocal index
        if index >= len(tokens):
            raise ValueError("Unexpected end of SVG path")
        value = float(tokens[index])
        index += 1
        return value

    def push_point(point: tuple[float, float]) -> None:
        nonlocal current_subpath
        if not current_subpath:
            current_subpath = [point]
        else:
            current_subpath.append(point)

    while index < len(tokens):
        token = tokens[index]
        if token.isalpha():
            command = token
            index += 1
        elif not command:
            raise ValueError("SVG path data must start with a command")

        if command in {"M", "m"}:
            x = read_number()
            y = read_number()
            if command == "m":
                current = (current[0] + x, current[1] + y)
            else:
                current = (x, y)
            start = current
            if current_subpath:
                subpaths.append(current_subpath)
            current_subpath = [current]
            command = "L" if command == "M" else "l"

        elif command in {"L", "l"}:
            x = read_number()
            y = read_number()
            point = (current[0] + x, current[1] + y) if command == "l" else (x, y)
            push_point(point)
            current = point

        elif command in {"H", "h"}:
            x = read_number()
            point = (current[0] + x, current[1]) if command == "h" else (x, current[1])
            push_point(point)
            current = point

        elif command in {"V", "v"}:
            y = read_number()
            point = (current[0], current[1] + y) if command == "v" else (current[0], y)
            push_point(point)
            current = point

        elif command in {"C", "c"}:
            values = [read_number() for _ in range(6)]
            if command == "c":
                control1 = (current[0] + values[0], current[1] + values[1])
                control2 = (current[0] + values[2], current[1] + values[3])
                end = (current[0] + values[4], current[1] + values[5])
            else:
                control1 = (values[0], values[1])
                control2 = (values[2], values[3])
                end = (values[4], values[5])
            push_point(current)
            current_subpath.extend(cubic_points(current, control1, control2, end))
            current = end

        elif command in {"Z", "z"}:
            if current_subpath:
                current_subpath.append(start)
            current = start
            command = ""

        else:
            raise ValueError(f"Unsupported SVG command: {command}")

    if current_subpath:
        if current_subpath[-1] != current_subpath[0]:
            current_subpath.append(current_subpath[0])
        subpaths.append(current_subpath)

    return subpaths


def load_glyph_polygons() -> list[list[tuple[float, float]]]:
    document = ET.parse(SOURCE_GLYPH)
    root = document.getroot()
    polygons: list[list[tuple[float, float]]] = []

    for path in root.findall("{http://www.w3.org/2000/svg}path"):
        matrix = parse_matrix(path.attrib.get("transform"))
        for subpath in parse_path(path.attrib["d"]):
            polygons.append([apply_transform(point, matrix) for point in subpath])

    return polygons


def normalized_bbox(polygons: list[list[tuple[float, float]]]) -> tuple[float, float, float, float]:
    xs = [point[0] for polygon in polygons for point in polygon]
    ys = [point[1] for polygon in polygons for point in polygon]
    return (min(xs), min(ys), max(xs), max(ys))


def render_glyph(
    size: int,
    padding_ratio: float,
    fill: tuple[int, int, int, int],
    background: tuple[int, int, int, int] | None = None,
    oversample: int = 4,
) -> Image.Image:
    polygons = load_glyph_polygons()
    min_x, min_y, max_x, max_y = normalized_bbox(polygons)
    source_width = max_x - min_x
    source_height = max_y - min_y
    target_size = size * oversample
    padding = target_size * padding_ratio
    drawable = target_size - (padding * 2)
    scale = drawable / max(source_width, source_height)

    mode = "RGBA"
    canvas = Image.new(mode, (target_size, target_size), background or (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)

    x_offset = (target_size - (source_width * scale)) / 2.0 - (min_x * scale)
    y_offset = (target_size - (source_height * scale)) / 2.0 - (min_y * scale)

    for polygon in polygons:
        draw.polygon(
            [(x * scale + x_offset, y * scale + y_offset) for x, y in polygon],
            fill=fill,
        )

    return canvas.resize((size, size), Image.Resampling.LANCZOS)


def compose_icon(size: int) -> Image.Image:
    icon = Image.new("RGBA", (size, size), BACKGROUND)
    glyph = render_glyph(size=size, padding_ratio=0.2, fill=FOREGROUND)
    return Image.alpha_composite(icon, glyph)


def compose_favicon(size: int) -> Image.Image:
    icon = Image.new("RGBA", (size, size), BACKGROUND)
    glyph = render_glyph(size=size, padding_ratio=0.18, fill=FOREGROUND)
    return Image.alpha_composite(icon, glyph)


def compose_splash(width: int, height: int) -> Image.Image:
    splash = Image.new("RGBA", (width, height), BACKGROUND)
    glyph = render_glyph(size=360, padding_ratio=0.16, fill=FOREGROUND)
    wordmark = Image.open(SOURCE_WORDMARK).convert("RGBA")

    target_wordmark_width = 760
    wordmark_ratio = target_wordmark_width / wordmark.width
    wordmark = wordmark.resize(
        (target_wordmark_width, math.floor(wordmark.height * wordmark_ratio)),
        Image.Resampling.LANCZOS,
    )

    glyph_x = (width - glyph.width) // 2
    glyph_y = 760
    wordmark_x = (width - wordmark.width) // 2
    wordmark_y = glyph_y + glyph.height + 72

    splash.alpha_composite(glyph, (glyph_x, glyph_y))
    splash.alpha_composite(wordmark, (wordmark_x, wordmark_y))
    return splash


def main() -> None:
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)

    compose_icon(1024).save(ASSETS_DIR / "icon.png")
    render_glyph(size=1024, padding_ratio=0.27, fill=FOREGROUND).save(ASSETS_DIR / "adaptive-icon.png")
    render_glyph(size=1024, padding_ratio=0.27, fill=FOREGROUND).save(ASSETS_DIR / "adaptive-icon-monochrome.png")
    compose_favicon(64).save(ASSETS_DIR / "favicon.png")
    compose_splash(1242, 2436).save(ASSETS_DIR / "splash.png")


if __name__ == "__main__":
    main()
