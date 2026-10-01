"""Download the NASA source documents and write data/sources.json.

Raw PDFs land in data/raw/ntrs/ (git-ignored); the manifest records each
file's SHA-256 so anyone can verify they hold the same document.

    python3 pipelines/fetch_sources.py
"""
import hashlib
import json
import pathlib
import subprocess
import urllib.request
from datetime import date

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "ntrs"
NTRS = "https://ntrs.nasa.gov"

# source_id -> NTRS citation id, plus what we use the document for.
SOURCES = {
    "bass2-summary": ("20210011385", "Test matrices (Tables 7.1, A.1, A.2) and apparatus description"),
    "bass2-results": ("20160000593", "BASS-II overview findings (low-flow dim flames, test counts)"),
    "pmma-rods-concurrent": ("20150008961", "PMMA rod flammability in concurrent flow"),
    "sibal-concurrent": ("20150008962", "SIBAL fabric concurrent flame growth and quenching"),
    "bass-thickness": ("20140011099", "Thickness and preheating effects (BASS)"),
    "confinement": ("20205004657", "Saffire vs BASS confinement comparison"),
    "partial-g": ("20130010991", "Microgravity vs Martian gravity vs NASA-STD-6001 Test 1"),
    "luci": ("20250010653", "Lunar-gravity flammability from a rotating sounding rocket"),
    "exploration-atmosphere": ("20220009546", "Source for the 56.5 kPa, 34 % O2 exploration cabin atmosphere scenario"),
}


def get_json(url):
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.load(r)


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    manifest = []
    for source_id, (ntrs_id, used_for) in SOURCES.items():
        meta = get_json(f"{NTRS}/api/citations/{ntrs_id}")
        # Some NTRS records are metadata-only (no PDF); those are cited by their abstract alone.
        pdf_link = next((d["links"]["pdf"] for d in meta.get("downloads") or [] if d.get("mimetype") == "application/pdf"), None)
        pdf = RAW / f"{ntrs_id}.pdf"
        if pdf_link and not pdf.exists():
            urllib.request.urlretrieve(NTRS + pdf_link, pdf)
        if pdf_link:
            subprocess.run(["pdftotext", "-layout", str(pdf), str(pdf.with_suffix(".txt"))], check=True)
        pubs = meta.get("publications") or [{}]
        manifest.append({
            "source_id": source_id,
            "ntrs_id": ntrs_id,
            "title": meta["title"].strip(),
            "authors": [a["meta"]["author"]["name"] for a in meta.get("authorAffiliations", [])],
            "organization": "NASA",
            "document_type": meta.get("stiType"),
            "published": (pubs[0].get("publicationDate") or "")[:10] or None,
            "url": f"{NTRS}/citations/{ntrs_id}",
            "pdf_url": NTRS + pdf_link if pdf_link else None,
            "copyright": (meta.get("copyright") or {}).get("determinationType"),
            "sha256": hashlib.sha256(pdf.read_bytes()).hexdigest() if pdf_link else None,
            "retrieved": date.today().isoformat(),
            "used_for": used_for,
            "abstract": (meta.get("abstract") or "").strip() or None,
        })
        print(source_id, ntrs_id, "ok")
    (ROOT / "data" / "sources.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
