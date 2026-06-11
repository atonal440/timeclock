"""
gen_extras.py  —  generates apple-touch-icon.png and favicon.ico for the TimeClock PWA.

Usage:
    python gen_extras.py

Requires: Pillow  (pip install Pillow)

Imports draw_face() from gen_icon.py, which must be in the same directory.

apple-touch-icon:
    180×180 px, RGB (opaque — iOS requires no alpha), no rounded corners
    (iOS applies its own corner mask at install time).

favicon.ico:
    Multi-resolution bundle: 16×16, 32×32, 48×48.
    Uses heavier supersampling at small sizes to preserve legibility.
"""

from PIL import Image, ImageDraw
from gen_icon import make_icon


# ── Apple touch icon ───────────────────────────────────────────────
def make_apple_touch(size=180):
    # RGB (no alpha) — iOS rejects transparency in touch icons
    rgba = make_icon(size, rounded_corners=False)
    rgb  = Image.new("RGB", rgba.size, (11, 15, 25))
    rgb.paste(rgba, mask=rgba.split()[3])
    return rgb


# ── Favicon layers ─────────────────────────────────────────────────
def make_favicon_layer(size):
    # Larger supersample factor for tiny sizes keeps detail readable
    from PIL import Image as _Image, ImageDraw as _ImageDraw
    import math, importlib, gen_icon as gi
    scale = max(4, 256 // size)
    S     = size * scale
    img   = _Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d     = _ImageDraw.Draw(img)

    # Re-use the internals of gen_icon with a custom scale
    from gen_icon import clock_to_pil

    cx = cy = S / 2.0

    BG       = (11,  15,  25,  255)
    SURFACE  = (18,  24,  40,  255)
    RING_TRK = (28,  36,  58,  255)
    LIME     = (163, 230, 53,  255)
    WHITE    = (230, 238, 255, 255)
    HUB_DARK = (10,  14,  22,  255)
    TICK_DIM = (40,  52,  80,  255)

    d.rounded_rectangle([0, 0, S, S], radius=int(S * 0.22), fill=BG)

    surf_r = S * 0.40
    d.ellipse([cx-surf_r, cy-surf_r, cx+surf_r, cy+surf_r], fill=SURFACE)

    ring_r_out = S / 2.0 - S * 0.09
    ring_r_in  = ring_r_out - S * 0.042
    d.ellipse([cx-ring_r_out, cy-ring_r_out, cx+ring_r_out, cy+ring_r_out], fill=RING_TRK)
    d.ellipse([cx-ring_r_in,  cy-ring_r_in,  cx+ring_r_in,  cy+ring_r_in],  fill=BG)

    arc_pil_start = clock_to_pil(225)
    arc_pil_end   = clock_to_pil(135)
    arc_bbox = [cx-ring_r_out, cy-ring_r_out, cx+ring_r_out, cy+ring_r_out]
    d.pieslice(arc_bbox, start=arc_pil_start, end=arc_pil_end, fill=LIME)

    cap_r = (ring_r_out - ring_r_in) / 2.0
    mid_r = (ring_r_in  + ring_r_out) / 2.0
    for pil_deg in [arc_pil_start, arc_pil_end]:
        ar  = math.radians(pil_deg)
        ccx = cx + math.cos(ar) * mid_r
        ccy = cy + math.sin(ar) * mid_r
        d.ellipse([ccx-cap_r, ccy-cap_r, ccx+cap_r, ccy+cap_r], fill=LIME)

    d.ellipse([cx-ring_r_in, cy-ring_r_in, cx+ring_r_in, cy+ring_r_in], fill=BG)

    for clock_deg in [0, 90, 180, 270]:
        ar    = math.radians(clock_to_pil(clock_deg))
        color = TICK_DIM if clock_deg == 180 else LIME
        t_out = ring_r_in - S * 0.008
        t_w   = max(1, int(S * 0.013))
        x1 = cx + math.cos(ar) * t_out
        y1 = cy + math.sin(ar) * t_out
        x2 = cx + math.cos(ar) * (t_out - S * 0.038)
        y2 = cy + math.sin(ar) * (t_out - S * 0.038)
        d.line([x1, y1, x2, y2], fill=color, width=t_w)

    def draw_hand(clock_deg, length_frac, width_frac, color, tail_frac=0.045):
        ar     = math.radians(clock_to_pil(clock_deg))
        tip_x  = cx + math.cos(ar) * S * length_frac
        tip_y  = cy + math.sin(ar) * S * length_frac
        base_x = cx - math.cos(ar) * S * tail_frac
        base_y = cy - math.sin(ar) * S * tail_frac
        hw     = S * width_frac / 2.0
        perp   = ar + math.pi / 2
        pts = [
            (base_x + math.cos(perp)*hw, base_y + math.sin(perp)*hw),
            (tip_x  + math.cos(perp)*hw, tip_y  + math.sin(perp)*hw),
            (tip_x  - math.cos(perp)*hw, tip_y  - math.sin(perp)*hw),
            (base_x - math.cos(perp)*hw, base_y - math.sin(perp)*hw),
        ]
        d.polygon(pts, fill=color)
        d.ellipse([tip_x-hw, tip_y-hw, tip_x+hw, tip_y+hw], fill=color)

    draw_hand(315, 0.23, 0.024, WHITE, tail_frac=0.045)
    draw_hand(130, 0.30, 0.018, LIME,  tail_frac=0.055)

    for r, color in [(S*0.060, HUB_DARK), (S*0.038, LIME), (S*0.018, HUB_DARK)]:
        d.ellipse([cx-r, cy-r, cx+r, cy+r], fill=color)

    return img.resize((size, size), _Image.LANCZOS)


if __name__ == "__main__":
    make_apple_touch().save("apple-touch-icon.png")
    print("  wrote apple-touch-icon.png")

    layers = [make_favicon_layer(s) for s in [16, 32, 48]]
    layers[0].save(
        "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=layers[1:],
    )
    print("  wrote favicon.ico")
