"""
gen_icon.py  —  generates regular and maskable icons for the TimeClock PWA.

Usage:
    python gen_icon.py

Requires: Pillow  (pip install Pillow)

Angle convention throughout this file:
    clock_deg  = degrees clockwise from 12 o'clock  (0=12, 90=3, 180=6, 270=9)
    clock_to_pil(d) converts to PIL's system         (0=3 o'clock, clockwise)
"""

from PIL import Image, ImageDraw
import math


def clock_to_pil(clock_deg):
    """Convert clockwise-from-12 degrees to PIL's clockwise-from-3 degrees."""
    return clock_deg - 90


def make_icon(size=512, rounded_corners=True, art_scale=1.0):
    scale = 4          # supersample factor — downsample at the end for AA
    S = size * scale
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    cx = cy = S / 2.0

    # ── Palette ────────────────────────────────────────────────────
    BG       = (11,  15,  25,  255)
    SURFACE  = (18,  24,  40,  255)
    RING_TRK = (28,  36,  58,  255)
    LIME     = (163, 230, 53,  255)
    WHITE    = (230, 238, 255, 255)
    HUB_DARK = (10,  14,  22,  255)
    TICK_DIM = (40,  52,  80,  255)

    # ── Background (rounded rect) ──────────────────────────────────
    if rounded_corners:
        d.rounded_rectangle([0, 0, S, S], radius=int(S * 0.22), fill=BG)
    else:
        d.rectangle([0, 0, S, S], fill=BG)

    # ── Inner surface circle ───────────────────────────────────────
    surf_r = S * 0.40 * art_scale
    d.ellipse([cx-surf_r, cy-surf_r, cx+surf_r, cy+surf_r], fill=SURFACE)

    # ── Track ring ─────────────────────────────────────────────────
    ring_r_out = (S / 2.0 - S * 0.09) * art_scale
    ring_r_in  = ring_r_out - S * 0.042 * art_scale

    d.ellipse([cx-ring_r_out, cy-ring_r_out, cx+ring_r_out, cy+ring_r_out], fill=RING_TRK)
    d.ellipse([cx-ring_r_in,  cy-ring_r_in,  cx+ring_r_in,  cy+ring_r_in],  fill=BG)

    # ── Progress arc: 270°, gap at 6 o'clock (135°–225° clock) ────
    #   arc runs from 225° to 135° clockwise.
    arc_pil_start = clock_to_pil(225)   # = 135  ... gap bottom-left edge
    arc_pil_end   = clock_to_pil(135)   # =  45  ... gap bottom-right edge

    arc_bbox = [cx-ring_r_out, cy-ring_r_out, cx+ring_r_out, cy+ring_r_out]
    d.pieslice(arc_bbox, start=arc_pil_start, end=arc_pil_end, fill=LIME)

    # Round end-caps — drawn BEFORE inner punch so punch clips inner bulge
    cap_r = (ring_r_out - ring_r_in) / 2.0
    mid_r = (ring_r_in  + ring_r_out) / 2.0
    for pil_deg in [arc_pil_start, arc_pil_end]:
        ar  = math.radians(pil_deg)
        ccx = cx + math.cos(ar) * mid_r
        ccy = cy + math.sin(ar) * mid_r
        d.ellipse([ccx-cap_r, ccy-cap_r, ccx+cap_r, ccy+cap_r], fill=LIME)

    # Inner punch — restores BG inside ring AND clips inner bulge of caps
    d.ellipse([cx-ring_r_in, cy-ring_r_in, cx+ring_r_in, cy+ring_r_in], fill=BG)

    # ── Cardinal tick marks ────────────────────────────────────────
    # 180° (6 o'clock) is in the gap → dimmed; all others are lit
    for clock_deg in [0, 90, 180, 270]:
        ar     = math.radians(clock_to_pil(clock_deg))
        color  = TICK_DIM if clock_deg == 180 else LIME
        t_out  = ring_r_in - S * 0.008 * art_scale
        t_len  = S * 0.038 * art_scale
        t_w    = max(1, int(S * 0.013 * art_scale))
        x1 = cx + math.cos(ar) * t_out
        y1 = cy + math.sin(ar) * t_out
        x2 = cx + math.cos(ar) * (t_out - t_len)
        y2 = cy + math.sin(ar) * (t_out - t_len)
        d.line([x1, y1, x2, y2], fill=color, width=t_w)

    # ── Clock hands ────────────────────────────────────────────────
    def draw_hand(clock_deg, length_frac, width_frac, color, tail_frac=0.045):
        ar     = math.radians(clock_to_pil(clock_deg))
        tip_x  = cx + math.cos(ar) * S * length_frac * art_scale
        tip_y  = cy + math.sin(ar) * S * length_frac * art_scale
        base_x = cx - math.cos(ar) * S * tail_frac * art_scale
        base_y = cy - math.sin(ar) * S * tail_frac * art_scale
        hw     = S * width_frac * art_scale / 2.0          # exact float half-width
        perp   = ar + math.pi / 2
        pts = [
            (base_x + math.cos(perp)*hw, base_y + math.sin(perp)*hw),
            (tip_x  + math.cos(perp)*hw, tip_y  + math.sin(perp)*hw),
            (tip_x  - math.cos(perp)*hw, tip_y  - math.sin(perp)*hw),
            (base_x - math.cos(perp)*hw, base_y - math.sin(perp)*hw),
        ]
        d.polygon(pts, fill=color)
        # Round tip — center exactly at tip, radius exactly hw
        d.ellipse([tip_x-hw, tip_y-hw, tip_x+hw, tip_y+hw], fill=color)

    draw_hand(315, 0.23, 0.024, WHITE, tail_frac=0.045)   # hour  (~10 o'clock)
    draw_hand(130, 0.30, 0.018, LIME,  tail_frac=0.055)   # minute (~2 o'clock)

    # ── Center hub ─────────────────────────────────────────────────
    for r, color in [(S*0.060*art_scale, HUB_DARK), (S*0.038*art_scale, LIME), (S*0.018*art_scale, HUB_DARK)]:
        d.ellipse([cx-r, cy-r, cx+r, cy+r], fill=color)

    # ── Downsample (anti-alias) ────────────────────────────────────
    return img.resize((size, size), Image.LANCZOS)


def make_maskable_icon(size=512):
    """Create an Android maskable icon.

    The background is full-bleed and opaque; the artwork stays inside the
    center 80% safe zone so launchers can apply circular or squircle masks.
    """
    return make_icon(size, rounded_corners=False, art_scale=0.94).convert("RGB")


if __name__ == "__main__":
    for size, name in [(192, "icon-192.png"), (512, "icon-512.png")]:
        make_icon(size).save(name)
        print(f"  wrote {name}")
    for size, name in [(192, "icon-maskable-192.png"), (512, "icon-maskable-512.png")]:
        make_maskable_icon(size).save(name)
        print(f"  wrote {name}")
