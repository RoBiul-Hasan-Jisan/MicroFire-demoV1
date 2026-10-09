"""Measured visibility: what Flame Vision actually sees, set against the test's airflow, where airflow is known.

    python3 pipelines/visibility_measured.py -> data/processed/visibility_measured.json (+ apps/web/data copy)

Reads every apps/web/public/media/<slug>/analysis.json (written by flame_vision.py) and
data/curated/visibility_manifest.json (conditions + citation per item). Per item it reports how often
a flame is found, how much of it is classed bright (luminous) versus blue, and how often the frame is
overexposed. An item joins the airflow curve ONLY if the manifest gives airflow and a citation.

To grow the curve: download more NASA flame videos or stills (low-airflow BASS runs especially), add them
to data/media.json, run flame_vision.py, then fill in their conditions in the manifest with citations.
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
MEDIA = ROOT / "apps" / "web" / "public" / "media"
MANIFEST = ROOT / "data" / "curated" / "visibility_manifest.json"
OUT = ROOT / "data" / "processed" / "visibility_measured.json"
WEB = ROOT / "apps" / "web" / "data" / "visibility_measured.json"
MIN_POINTS_FOR_CURVE = 4


def summarize(slug):
    a = json.loads((MEDIA / slug / "analysis.json").read_text())
    fr = a["frames"]
    found = [f for f in fr if f["area_px"] > 0]
    n = len(fr)
    lum = sum(f["luminous_px"] for f in found)
    blue = sum(f["blue_px"] for f in found)
    flagged = {}
    for f in fr:
        for fl in f["flags"]:
            flagged[fl] = flagged.get(fl, 0) + 1
    return {
        "slug": slug, "frames": n, "frames_with_flame": len(found),
        "share_frames_with_flame": round(len(found) / n, 3) if n else None,
        "luminous_share_of_flame_px": round(lum / (lum + blue), 3) if lum + blue else None,
        "blue_share_of_flame_px": round(blue / (lum + blue), 3) if lum + blue else None,
        "share_frames_overexposed": round(flagged.get("overexposed", 0) / n, 3) if n else None,
        "share_frames_weak_or_none": round(flagged.get("weak_or_no_flame", 0) / n, 3) if n else None,
        "blue_detection_note": a.get("blue_note"),
    }


def main():
    man = {i["slug"]: i for i in json.loads(MANIFEST.read_text())["items"]}
    items, curve = [], []
    for slug in sorted(p.name for p in MEDIA.iterdir() if (p / "analysis.json").exists()):
        s = summarize(slug)
        m = man.get(slug, {})
        ok = m.get("flow_cm_s") is not None and bool(m.get("citation"))
        s["flow_cm_s"], s["o2_pct"], s["citation"], s["in_curve"] = m.get("flow_cm_s"), m.get("o2_pct"), m.get("citation"), ok
        items.append(s)
        if ok:
            curve.append({"slug": slug, "flow_cm_s": m["flow_cm_s"], "o2_pct": m.get("o2_pct"), "blue_share": s["blue_share_of_flame_px"],
                          "luminous_share": s["luminous_share_of_flame_px"], "share_frames_with_flame": s["share_frames_with_flame"]})
    enough = len(curve) >= MIN_POINTS_FOR_CURVE
    result = {
        "version": "visibility-measured-1.0", "items": items, "curve_points": curve, "curve_available": enough,
        "status": ("Measured visibility curve available." if enough else
                   f"No curve yet: {len(curve)} of the {len(items)} analysed NASA media items have a cited airflow, and at least {MIN_POINTS_FOR_CURVE} are needed. The media records in the atlas do not state airflow, so none were filled in."),
        "how_to_extend": "Add NASA media (especially BASS runs below 5 cm/s) to data/media.json, run pipelines/flame_vision.py, fill their conditions and citations in data/curated/visibility_manifest.json, then run this script.",
    }
    for p in (OUT, WEB):
        p.write_text(json.dumps(result, indent=1) + "\n")
    print(result["status"])
    for s in items:
        print(s["slug"], s["frames"], s["share_frames_with_flame"], s["luminous_share_of_flame_px"], s["blue_share_of_flame_px"], s["share_frames_overexposed"])


if __name__ == "__main__":
    main()
