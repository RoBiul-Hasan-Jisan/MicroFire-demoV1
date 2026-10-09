"""Download NASA flame media from the NASA Image and Video Library and write data/media.json.

Raw files go to data/raw/media/ (git-ignored). Web copies (compact H.264 + poster) go to
apps/web/public/media/<slug>/. Every file is recorded with its NASA ID, URL and SHA-256.

    python3 pipelines/fetch_media.py
"""
import hashlib
import json
import pathlib
import subprocess
import urllib.parse
import urllib.request
from fractions import Fraction

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "media"
WEB = ROOT / "apps" / "web" / "public" / "media"
API = "https://images-api.nasa.gov"

# slug -> (nasa_id, kind, rendition used for analysis)
MEDIA = {
    "saffire-v-ribs": ("GRC-2021-CN-00008", "video", "small"),
    "saffire-vi-pmma": ("Saf-VI S8C3+C4 1-sided PMMA_unmapped_jpeg-20x no text", "video", "small"),
    "bass-cassidy-2013": ("iss035e015900", "image", "large"),
    "bass2-reduced-o2-gmt213": ("iss040e086481", "image", "large"),
}


def get_json(url):
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.load(r)


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    manifest = []
    for slug, (nasa_id, kind, rendition) in MEDIA.items():
        q = urllib.parse.quote(nasa_id)
        meta = get_json(f"{API}/search?nasa_id={q}")["collection"]["items"][0]["data"][0]
        ext = "mp4" if kind == "video" else "jpg"
        url = f"https://images-assets.nasa.gov/{kind}/{q}/{q}~{rendition}.{ext}"
        raw = RAW / f"{slug}.{ext}"
        if not raw.exists():
            urllib.request.urlretrieve(url, raw)
        out = WEB / slug
        out.mkdir(parents=True, exist_ok=True)
        if kind == "video":
            # compact web copy: H.264, 720 px wide, no audio track
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-vf", "scale=720:-2", "-c:v", "libx264", "-crf", "27",
                            "-preset", "slow", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", str(out / "video.mp4")], check=True)
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "3", "-i", str(raw), "-frames:v", "1", "-vf", "scale=720:-2", "-q:v", "4", str(out / "poster.jpg")], check=True)
        else:
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-vf", "scale=1280:-2", "-q:v", "4", str(out / "image.jpg")], check=True)
        probe = json.loads(subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_streams", "-show_format", str(raw)],
                                          capture_output=True, text=True, check=True).stdout)
        v = next(s for s in probe["streams"] if s["codec_type"] == "video")
        manifest.append({
            "slug": slug,
            "nasa_id": nasa_id,
            "kind": kind,
            "title": meta.get("title"),
            "description": (meta.get("description") or "").strip(),
            "center": meta.get("center"),
            "date_created": (meta.get("date_created") or "")[:10],
            "page_url": f"https://images.nasa.gov/details/{q}",
            "file_url": url,
            "sha256": hashlib.sha256(raw.read_bytes()).hexdigest(),
            "width": v["width"],
            "height": v["height"],
            "fps": float(Fraction(v["r_frame_rate"])) if kind == "video" else None,  # e.g. "30000/1001"
            "duration_s": float(probe["format"].get("duration", 0)) if kind == "video" else None,
            "licence": "NASA media; not copyrighted in the US per NASA media usage guidelines. Credit NASA; no endorsement implied.",
        })
        print(slug, "ok")
    text = json.dumps(manifest, indent=2, ensure_ascii=False) + "\n"
    (ROOT / "data" / "media.json").write_text(text)
    (ROOT / "apps" / "web" / "data" / "media.json").write_text(text)  # what the website imports


if __name__ == "__main__":
    main()
