"""Prepare production PNG brand assets from the Gemini JPEG sources.

Run from repo root: python scripts/prepare-brand-assets.py
"""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "images"
OUT = SRC
PREVIEW = ROOT / "assets" / "images" / "_previews"
SIZE = 1024
SAFE_RATIO = 72 / 108  # Android adaptive-icon inner safe zone
SAFE_PX = int(SIZE * SAFE_RATIO)  # 682
# Extra inset so Arabic strokes don't sit on the mask edge
GLYPH_MAX = int(SIZE * 0.58)  # ~594px

BRAND_GREEN = (26, 78, 29)  # sampled median from icon.jpg interior


def lum(p):
    r, g, b = p[:3]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def is_green_bg(p, lum_max=175):
    r, g, b = p[:3]
    return g > r + 6 and g > b + 6 and r < 120 and lum(p) < lum_max


def light_border_mask(im: Image.Image, light_min=185) -> Image.Image:
    """1-bit mask of border-connected light pixels (white matte / padding)."""
    rgb = im.convert("RGB")
    w, h = rgb.size
    pix = rgb.load()
    mask = Image.new("L", (w, h), 0)
    mp = mask.load()
    seen = bytearray(w * h)
    q = deque()

    def light(x, y):
        r, g, b = pix[x, y]
        return r >= light_min and g >= light_min and b >= light_min

    def push(x, y):
        i = y * w + x
        if seen[i]:
            return
        if not light(x, y):
            return
        seen[i] = 1
        q.append((x, y))

    for x in range(w):
        push(x, 0)
        push(x, h - 1)
    for y in range(h):
        push(0, y)
        push(w - 1, y)

    while q:
        x, y = q.popleft()
        mp[x, y] = 255
        if x > 0:
            push(x - 1, y)
        if x + 1 < w:
            push(x + 1, y)
        if y > 0:
            push(x, y - 1)
        if y + 1 < h:
            push(x, y + 1)
    return mask


def extract_glyphs(im: Image.Image, padding: Image.Image | None = None, lum_min=155) -> Image.Image:
    """Keep light glyphs; punch out padding and green field. Anti-alias via luminance."""
    src = im.convert("RGB")
    w, h = src.size
    if padding is None:
        padding = light_border_mask(src)
    out = Image.new("RGBA", (w, h), (255, 255, 255, 0))
    sp = src.load()
    pp = padding.load()
    op = out.load()
    for y in range(h):
        for x in range(w):
            if pp[x, y]:
                continue
            r, g, b = sp[x, y]
            L = lum((r, g, b))
            if L < lum_min:
                continue
            alpha = int(max(0, min(255, (L - (lum_min - 40)) * 255 / (255 - (lum_min - 40)))))
            op[x, y] = (255, 255, 255, alpha)
    return out


def alpha_bbox(im: Image.Image, min_alpha=12):
    a = im.getchannel("A")
    return a.getbbox()  # None if fully transparent


def knockout_dark(im: Image.Image, threshold=28) -> Image.Image:
    """White-on-black → white-on-transparent, preserving anti-alias."""
    src = im.convert("RGB")
    w, h = src.size
    out = Image.new("RGBA", (w, h), (255, 255, 255, 0))
    sp = src.load()
    op = out.load()
    for y in range(h):
        for x in range(w):
            L = lum(sp[x, y])
            if L <= threshold:
                continue
            alpha = int(max(0, min(255, (L - threshold) * 255 / (255 - threshold))))
            op[x, y] = (255, 255, 255, alpha)
    return out


def center_on_canvas(glyph: Image.Image, canvas_size=SIZE, max_side=None) -> Image.Image:
    g = glyph
    bbox = alpha_bbox(g)
    if not bbox:
        return Image.new("RGBA", (canvas_size, canvas_size), (255, 255, 255, 0))
    g = g.crop(bbox)
    if max_side:
        scale = min(max_side / g.size[0], max_side / g.size[1], 1.0)
        # Always fit into max_side (scale up or down)
        scale = min(max_side / g.size[0], max_side / g.size[1])
        nw = max(1, int(round(g.size[0] * scale)))
        nh = max(1, int(round(g.size[1] * scale)))
        g = g.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (255, 255, 255, 0))
    x = (canvas_size - g.size[0]) // 2
    y = (canvas_size - g.size[1]) // 2
    canvas.alpha_composite(g, (x, y))
    return canvas


def crop_green_poster(im: Image.Image, pad=8) -> Image.Image:
    src = im.convert("RGB")
    w, h = src.size
    pix = src.load()
    minx, miny, maxx, maxy = w, h, -1, -1
    for y in range(0, h, 1):
        for x in range(0, w, 1):
            if is_green_bg(pix[x, y]) or (
                lum(pix[x, y]) > 180
                and not (pix[x, y][0] > 232 and pix[x, y][1] > 232 and pix[x, y][2] > 232)
            ):
                # green or light-on-green text
                if pix[x, y][0] > 232 and pix[x, y][1] > 232 and pix[x, y][2] > 232:
                    continue
                minx = min(minx, x)
                miny = min(miny, y)
                maxx = max(maxx, x)
                maxy = max(maxy, y)
    if maxx < 0:
        return src
    # Inset 2px so the white matte is not included
    minx = min(minx + 2, maxx)
    miny = min(miny + 2, maxy)
    maxx = max(maxx - 2, minx)
    maxy = max(maxy - 2, miny)
    return src.crop((minx, miny, maxx + 1, maxy + 1))


def squircle_mask(size, radius_ratio=0.22):
    """Approximate iOS/Android launcher mask for previews."""
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    r = int(size * radius_ratio)
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=r, fill=255)
    return m.filter(ImageFilter.GaussianBlur(1.2))


def save_png(im: Image.Image, path: Path, **kwargs):
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, format="PNG", optimize=True, **kwargs)
    print(f"  wrote {path.relative_to(ROOT)}  {im.size} {im.mode}  {path.stat().st_size} bytes")


def main():
    PREVIEW.mkdir(parents=True, exist_ok=True)
    print("Brand green", "#%02X%02X%02X" % BRAND_GREEN)

    icon_jpg = Image.open(SRC / "icon.jpg")
    splash_jpg = Image.open(SRC / "splash-logo.jpg")
    bg_jpg = Image.open(SRC / "android-icon-background.jpg")
    fg_jpg = Image.open(SRC / "android-icon-foreground.jpg")
    mono_jpg = Image.open(SRC / "android-icon-monochrome.jpg")

    # --- App icon: full-bleed green + original Arabic (no baked squircle) ---
    icon_pad = light_border_mask(icon_jpg)
    icon_glyphs = extract_glyphs(icon_jpg, icon_pad, lum_min=160)
    # Drop leftover squircle anti-alias in the outer frame
    gp = icon_glyphs.load()
    frame = 88
    for y in range(SIZE):
        for x in range(SIZE):
            if x < frame or y < frame or x >= SIZE - frame or y >= SIZE - frame:
                gp[x, y] = (255, 255, 255, 0)
    icon_rgba = Image.new("RGBA", (SIZE, SIZE), (*BRAND_GREEN, 255))
    icon_rgba.alpha_composite(icon_glyphs)
    icon_png = icon_rgba.convert("RGB")
    ip = icon_png.load()
    fringe = 130
    for y in range(SIZE):
        for x in range(SIZE):
            if x >= fringe and y >= fringe and x < SIZE - fringe and y < SIZE - fringe:
                continue
            r, g, b = ip[x, y]
            if abs(r - BRAND_GREEN[0]) + abs(g - BRAND_GREEN[1]) + abs(b - BRAND_GREEN[2]) > 12:
                ip[x, y] = BRAND_GREEN
    save_png(icon_png, OUT / "icon.png")

    # --- Adaptive background: solid brand green ---
    bg_png = Image.new("RGB", (SIZE, SIZE), BRAND_GREEN)
    save_png(bg_png, OUT / "android-icon-background.png")

    # --- Adaptive foreground + monochrome from the clean two-line wordmark ---
    mono_glyph = knockout_dark(mono_jpg)
    fg_png = center_on_canvas(mono_glyph, SIZE, max_side=GLYPH_MAX)
    save_png(fg_png, OUT / "android-icon-foreground.png")
    save_png(fg_png, OUT / "android-icon-monochrome.png")

    # --- Ornate calligraphy kept as a usable transparent illustration ---
    calligraphy = center_on_canvas(knockout_dark(fg_jpg), SIZE, max_side=GLYPH_MAX)
    save_png(calligraphy, OUT / "calligraphy.png")

    # --- Splash wordmark: bilingual title from splash-logo.jpg ---
    splash_pad = light_border_mask(splash_jpg)
    splash_glyph = extract_glyphs(splash_jpg, splash_pad, lum_min=150)
    splash_png = center_on_canvas(splash_glyph, SIZE, max_side=int(SIZE * 0.72))
    save_png(splash_png, OUT / "splash-logo.png")

    # Dark-board copies so transparent PNGs are inspectable
    for src_im, name in (
        (fg_png, "foreground-on-green.png"),
        (splash_png, "splash-on-green.png"),
        (calligraphy, "calligraphy-on-green.png"),
    ):
        board = Image.new("RGBA", (SIZE, SIZE), (*BRAND_GREEN, 255))
        board.alpha_composite(src_im)
        save_png(board.convert("RGB"), PREVIEW / name)

    # --- Cover posters (cropped, no white matte) — in-app / store art ---
    cover_a = crop_green_poster(splash_jpg)
    cover_b = crop_green_poster(bg_jpg)
    save_png(cover_a.convert("RGB"), OUT / "cover.png")
    save_png(cover_b.convert("RGB"), OUT / "cover-alt.png")

    # --- Favicon from the prepared icon (192 is sharp enough for browser tabs) ---
    save_png(icon_png.resize((192, 192), Image.Resampling.LANCZOS), OUT / "favicon.png")

    # --- Previews for visual QA ---
    # Adaptive icon under squircle + circle masks
    adaptive = Image.new("RGBA", (SIZE, SIZE), (*BRAND_GREEN, 255))
    adaptive.alpha_composite(fg_png)
    for name, mask in (
        ("adaptive-squircle.png", squircle_mask(SIZE, 0.22)),
        ("adaptive-circle.png", squircle_mask(SIZE, 0.5)),
    ):
        layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
        layer.paste(adaptive, (0, 0))
        layer.putalpha(mask)
        # composite on dark gray so clipped area is visible
        board = Image.new("RGBA", (SIZE, SIZE), (40, 40, 40, 255))
        board.alpha_composite(layer)
        save_png(board.convert("RGB"), PREVIEW / name)

    # Safe-zone overlay
    overlay = adaptive.convert("RGB").copy()
    d = ImageDraw.Draw(overlay, "RGBA")
    inset = (SIZE - SAFE_PX) // 2
    d.rectangle([inset, inset, SIZE - inset, SIZE - inset], outline=(255, 200, 0, 255), width=4)
    save_png(overlay, PREVIEW / "adaptive-safezone.png")

    # Splash mock (phone-like 9:19.5 at 1x width 390)
    sw, sh = 390, 844
    splash_mock = Image.new("RGB", (sw, sh), BRAND_GREEN)
    # imageWidth 240 dp ≈ 240px on this mock
    mark = splash_png.copy()
    mark_w = 240
    scale = mark_w / mark.size[0]
    mark = mark.resize((mark_w, int(mark.size[1] * scale)), Image.Resampling.LANCZOS)
    splash_mock.paste(
        mark,
        ((sw - mark.size[0]) // 2, (sh - mark.size[1]) // 2),
        mark,
    )
    save_png(splash_mock, PREVIEW / "splash-mock.png")

    # iOS-style icon (full bleed, squircle mask)
    ios = icon_png.convert("RGBA")
    ios.putalpha(squircle_mask(SIZE, 0.225))
    board = Image.new("RGBA", (SIZE, SIZE), (40, 40, 40, 255))
    board.alpha_composite(ios)
    save_png(board.convert("RGB"), PREVIEW / "ios-icon-masked.png")

    print("done")


if __name__ == "__main__":
    main()
