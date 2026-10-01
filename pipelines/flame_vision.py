"""Flame Vision: classical, documented flame segmentation on NASA media.

For each media item in data/media.json this writes apps/web/public/media/<slug>/analysis.json with
per-frame pixel-domain measurements and simplified flame outlines for the on-video overlay.

Method (no learned model, no tuning per frame):
  1. crop to a documented region of interest (excludes second-camera insets);
  2. two colour masks per pixel:
       luminous  = bright, warm pixels (sooty yellow/white flame)
       blue      = blue-dominant pixels (dim blue, low-soot flame)
  3. morphological open (3x3) then close (5x5); drop connected regions under MIN_REGION_PX;
  4. measure area, bounding box, centroid, left/right extent, brightness and saturation;
  5. flag weak, overexposed and fragmented frames. No spatial calibration exists, so all
     lengths and areas are in pixels of the analysed rendition and are never converted.

    .venv/bin/python pipelines/flame_vision.py
"""
import hashlib
import json
import pathlib
from datetime import date

import cv2
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
VERSION = "flame-vision-1.0"
MIN_REGION_PX = 12
SAMPLE_FPS = 5

# Per-media configuration. ROI is (x0, y0, x1, y1) as fractions of the frame.
CONFIG = {
    "saffire-v-ribs": {
        "roi": (0.0, 0.135, 1.0, 0.985),
        "roi_note": "Excludes the top strip, which shows a second camera view.",
        "luminous": {"r_min": 170, "r_over_g": 0.85},
        # The sample is lit green: burnt, bubbly PMMA turns pale green-white and read as "blue".
        # Blue-flame detection is therefore switched off for this video (b_min above 255).
        "blue": {"b_min": 256, "b_over_r": 25},
        "blue_note": "Blue-flame detection off: green illumination makes bubbly burnt PMMA look blue.",
    },
    "saffire-vi-pmma": {
        "roi": (0.0, 0.0, 0.865, 1.0),
        "roi_note": "Excludes the right-hand inset, which shows a second camera view.",
        "luminous": {"r_min": 90, "r_over_g": 0.75},
        "blue": {"b_min": 55, "b_over_r": 15},
    },
    "bass-cassidy-2013": {
        "roi": (0.0, 0.0, 1.0, 1.0),
        "roi_note": "Whole photograph.",
        "luminous": {"r_min": 120, "r_over_g": 0.85},
        "blue": {"b_min": 50, "b_over_r": 15},
    },
    "bass2-reduced-o2-gmt213": {
        "roi": (0.0, 0.0, 1.0, 1.0),
        "roi_note": "Whole photograph.",
        "luminous": {"r_min": 120, "r_over_g": 0.85},
        "blue": {"b_min": 50, "b_over_r": 15},
    },
}

K_OPEN = np.ones((3, 3), np.uint8)
K_CLOSE = np.ones((5, 5), np.uint8)


def masks(bgr, cfg):
    """Return (luminous, blue) boolean masks for one BGR image."""
    b, g, r = (bgr[..., i].astype(np.int16) for i in range(3))
    # near-saturated pixels are flame core even when JPEG tints them slightly blue
    sat = np.maximum(np.maximum(r, g), b) >= 245
    lum = ((r >= cfg["luminous"]["r_min"]) & (r >= cfg["luminous"]["r_over_g"] * g) & (r >= b)) | (sat & (r >= 200))
    blue = (b >= cfg["blue"]["b_min"]) & (b >= r + cfg["blue"]["b_over_r"]) & ~lum
    return clean(lum), clean(blue)


def clean(m):
    m = m.astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, K_OPEN)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, K_CLOSE)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m, connectivity=8)
    keep = np.zeros(n, bool)
    keep[1:] = stats[1:, cv2.CC_STAT_AREA] >= MIN_REGION_PX
    return keep[lab]


def measure(bgr, cfg, roi_px):
    """Measurements for one frame inside the ROI; coordinates normalised to the full frame."""
    x0, y0, x1, y1 = roi_px
    crop = bgr[y0:y1, x0:x1]
    lum, blue = masks(crop, cfg)
    flame = lum | blue
    H, W = bgr.shape[:2]
    roi_area = (x1 - x0) * (y1 - y0)
    area = int(flame.sum())
    n_regions = cv2.connectedComponents(flame.astype(np.uint8), connectivity=8)[0] - 1
    out = {
        "area_px": area,
        "luminous_px": int(lum.sum()),
        "blue_px": int(blue.sum()),
        "area_frac": round(area / roi_area, 6),
        "regions": int(n_regions),
    }
    if area:
        ys, xs = np.nonzero(flame)
        xs_full, ys_full = xs + x0, ys + y0
        maxc = crop.max(axis=2)[flame]
        out.update({
            "bbox": [round(xs_full.min() / W, 4), round(ys_full.min() / H, 4), round(xs_full.max() / W, 4), round(ys_full.max() / H, 4)],
            "centroid": [round(xs_full.mean() / W, 4), round(ys_full.mean() / H, 4)],
            "width_px": int(xs.max() - xs.min() + 1),
            "height_px": int(ys.max() - ys.min() + 1),
            "mean_brightness": round(float(maxc.mean()), 1),
            "saturated_frac": round(float((maxc >= 250).mean()), 4),
        })
    flags = []
    if out["area_frac"] < 0.0015:
        flags.append("weak_or_no_flame")
    if out.get("saturated_frac", 0) > 0.35:
        flags.append("overexposed")
    if n_regions > 15:
        flags.append("many_regions")  # several separate flamelets: box and centroid describe the group
    out["flags"] = flags
    # simplified outlines for the overlay, normalised to the full frame
    contours, _ = cv2.findContours(flame.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:6]
    out["outlines"] = [
        [[round((p[0][0] + x0) / W, 3), round((p[0][1] + y0) / H, 3)] for p in cv2.approxPolyDP(c, 2.0, True)]
        for c in contours
        if cv2.contourArea(c) >= MIN_REGION_PX
    ]
    return out


def roi_pixels(cfg, W, H):
    fx0, fy0, fx1, fy1 = cfg["roi"]
    return int(fx0 * W), int(fy0 * H), int(fx1 * W), int(fy1 * H)


def analyse(item):
    cfg = CONFIG[item["slug"]]
    path = ROOT / "data" / "raw" / "media" / f"{item['slug']}.{'mp4' if item['kind'] == 'video' else 'jpg'}"
    frames = []
    if item["kind"] == "image":
        img = cv2.imread(str(path))
        H, W = img.shape[:2]
        frames.append({"t": 0.0, **measure(img, cfg, roi_pixels(cfg, W, H))})
    else:
        cap = cv2.VideoCapture(str(path))
        fps = cap.get(cv2.CAP_PROP_FPS)
        step = max(1, round(fps / SAMPLE_FPS))
        i = 0
        while True:
            ok, img = cap.read()
            if not ok:
                break
            if i % step == 0:
                H, W = img.shape[:2]
                frames.append({"t": round(i / fps, 3), **measure(img, cfg, roi_pixels(cfg, W, H))})
            i += 1
        cap.release()
    return {
        "slug": item["slug"],
        "version": VERSION,
        "opencv": cv2.__version__,
        "generated": date.today().isoformat(),
        "input_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "frame_size": [W, H],
        "sample_fps": SAMPLE_FPS if item["kind"] == "video" else None,
        "roi": cfg["roi"],
        "roi_note": cfg["roi_note"],
        "blue_note": cfg.get("blue_note"),
        "thresholds": {"luminous": cfg["luminous"], "blue": cfg["blue"], "min_region_px": MIN_REGION_PX},
        "units": "pixels of the analysed rendition; no spatial calibration is available",
        "frames": frames,
    }


def main():
    media = json.loads((ROOT / "data" / "media.json").read_text())
    for item in media:
        result = analyse(item)
        out = ROOT / "apps" / "web" / "public" / "media" / item["slug"] / "analysis.json"
        out.write_text(json.dumps(result, separators=(",", ":")))
        areas = [f["area_frac"] for f in result["frames"]]
        flagged = sum(1 for f in result["frames"] if f["flags"])
        print(f"{item['slug']}: {len(result['frames'])} frames, peak area {max(areas):.3%}, flagged {flagged}, {out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
