"""Turn the hand-transcribed NASA tables into data/processed/experiments.json.

Rules:
- original values and units are kept next to normalized ones;
- a value that applies to a whole test series (not one test) is marked "series";
- outcomes are coded from the verbatim NASA comment and marked "derived";
- anything the source does not state stays null.

    python3 pipelines/build_dataset.py
"""
import csv
import json
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
CURATED = ROOT / "data" / "curated"
OUT = ROOT / "data" / "processed" / "experiments.json"
WEB = ROOT / "apps" / "web" / "data"  # what the website imports

ATM_KPA = 101.325


def cm_to_mm(v):
    return None if v is None else round(v * 10, 4)


def um_to_mm(v):
    return None if v is None else round(v / 1000, 4)


def atm_to_kpa(v):
    return round(v * ATM_KPA, 3)


def num(s):
    s = (s or "").strip()
    return float(s) if s else None


OUTCOMES = {
    # code: (label, group)
    "quenched_low_flow": ("Quenched as flow was reduced", "extinguished"),
    "blowoff": ("Blew off at high flow", "extinguished"),
    "extinguished_flow_off": ("Extinguished after flow was turned off", "extinguished"),
    "no_sustained_flame": ("Ignited briefly, no sustained flame", "extinguished"),
    "not_ignited": ("Did not ignite", "not_ignited"),
    "sustained_no_blowoff": ("Kept burning at high flow (no blowoff)", "sustained"),
    "burned_entire_sample": ("Burned the entire sample", "sustained"),
    "burned_outcome_not_stated": ("Burned; final outcome not stated in table", "unknown"),
}

SIBAL_RULES = {
    "Quenched": "quenched_low_flow",
    "No ignition": "not_ignited",
    "Reused, did not ignite": "not_ignited",
    "Blow-off": "blowoff",
    "No blowoff": "sustained_no_blowoff",
}

CITE_SUMMARY = "bass2-summary"
SIBAL_CITE = {"source_id": CITE_SUMMARY, "table": "Table 7.1", "pdf_page": 104, "page_label": "96"}
SIBAL_METHOD_CITE = {"source_id": CITE_SUMMARY, "section": "7.1.3", "pdf_page": 102, "page_label": "94"}
A1_CITE = {
    "A.1": [111, 112],  # Table A.1 spans two pages
    "A.2": [113],
}
A1_PRESSURE_CITE = {"source_id": CITE_SUMMARY, "section": "2.3.5", "pdf_page": 46, "page_label": "38"}


def outcome_fields(code):
    label, group = OUTCOMES[code]
    return {"outcome": code, "outcome_label": label, "outcome_group": group}


def sibal_record(row):
    comment = row["comment_verbatim"].strip()
    code = SIBAL_RULES.get(comment, "burned_outcome_not_stated")
    start, end = num(row["flow_start_cm_s"]), num(row["flow_end_cm_s"])
    if code == "quenched_low_flow" and not end < start:
        raise ValueError(f"{row['test_id']}: quenched but flow did not decrease")
    flags = []
    if row["o2_reading_suspect"] == "true":
        flags.append("o2_reading_suspect")
    if comment.startswith("Reused"):
        flags.append("reused_sample")
    if "one-sided" in comment:
        flags.append("one_sided_flame")
    return {
        "id": f"sibal-{row['test_id']}",
        "test_id": row["test_id"],
        "investigation": row["investigation"],
        "family": "SIBAL fabric · concurrent flow",
        "material": "SIBAL fabric",
        "material_category": "cotton–fiberglass composite fabric",
        "material_verbatim": "composite cotton-fiberglass fabric blend (75 percent cotton and 25 percent fiberglass)",
        "geometry": "thin flat sample",
        "thickness_mm": 0.32,
        "width_mm": cm_to_mm(num(row["sample_width_cm"])),
        "length_mm": cm_to_mm(10),
        "gravity_regime": "microgravity (ISS, Microgravity Science Glovebox)",
        "flow_direction": "concurrent",
        "flow_initial_cm_s": start,
        "flow_final_cm_s": end,
        "flow_varied": start != end,
        "flow_verbatim": f"{row['flow_start_cm_s']} to {row['flow_end_cm_s']}" if start != end else row["flow_start_cm_s"],
        "oxygen_vol_pct": num(row["o2_vol_pct"]),
        "pressure_kpa": atm_to_kpa(1),
        "co2_vol_pct": None,
        "co_ppm": None,
        "observations_verbatim": comment or None,
        **outcome_fields(code),
        "quality_flags": flags,
        "provenance": {
            "record": SIBAL_CITE,
            "observed": ["test_id", "width_mm", "flow_initial_cm_s", "flow_final_cm_s", "oxygen_vol_pct"],
            "series": {
                "thickness_mm": {**SIBAL_METHOD_CITE, "quote": "The thickness of the sample is about 0.32 mm"},
                "length_mm": {**SIBAL_METHOD_CITE, "quote": "Both have an exposed length of 10 cm."},
                "pressure_kpa": {**SIBAL_METHOD_CITE, "quote": "Ambient pressure was 1 atm.", "original": "1 atm"},
            },
            "derived": {"outcome": "Coded by MicroFire Atlas from the verbatim Comments column of Table 7.1."},
            "notes": {},
        },
    }


_TABLE_PAGES = {}


def page_of_test(test_id, pages):
    """Table A.1 spans two PDF pages: return the one whose text contains this test's row."""
    if len(pages) == 1:
        return pages[0]
    if "bass2" not in _TABLE_PAGES:
        _TABLE_PAGES["bass2"] = pdf_pages("20210011385")
    text = _TABLE_PAGES["bass2"]
    hits = [pg for pg in pages if re.search(rf"\b{re.escape(test_id)}\b", text[pg - 1])]
    if len(hits) != 1:
        raise ValueError(f"{test_id}: found on pages {hits}, expected exactly one of {pages}")
    return hits[0]


def table_a_record(row):
    pages = A1_CITE[row["pi_table"]]
    pi = {"A.1": "Bhattacharjee", "A.2": "Ferkul"}[row["pi_table"]]
    pmma = row["material"] == "PMMA"
    width = num(row["sample_width_cm"])
    flags = []
    if row["test_id"] in ("B3", "B5"):
        flags.append("o2_reading_suspect")
    if row["test_id"] == "B2":
        flags.append("no_still_images")
    series = {}
    if pi == "Bhattacharjee":
        series["pressure_kpa_range"] = {
            **A1_PRESSURE_CITE,
            "quote": "The total pressure is also monitored, which varied from 99.2 to 99.5 kPa in the tests reported.",
            "note": "Series-level range from the Bhattacharjee report section; not a per-test reading.",
        }
    flow_verbatim = row["air_display_verbatim"]
    return {
        "id": f"bass2-{row['test_id']}",
        "test_id": row["test_id"],
        "as_run_test": int(row["as_run_test"]),
        "investigation": "BASS-II",
        "principal_investigator": pi,
        "date": row["date_listed"],
        "family": ("PMMA film · opposed flow" if pmma else "Nomex · concurrent flow"),
        "material": row["material"],
        "material_category": "thermoplastic (PMMA)" if pmma else "aramid fabric",
        "material_verbatim": row["material_verbatim"],
        "geometry": "thin flat sample" if pmma else "flat sample",
        "thickness_mm": um_to_mm(num(row["thickness_um"])),
        "width_mm": cm_to_mm(width),
        "length_mm": None,
        "gravity_regime": "microgravity (ISS, Microgravity Science Glovebox)",
        "flow_direction": row["flow_direction"],
        "flow_initial_cm_s": num(row["flow_initial_cm_s"]),
        "flow_final_cm_s": None,
        "flow_varied": "," in flow_verbatim or "down" in flow_verbatim or "blowoff" in flow_verbatim,
        "flow_verbatim": flow_verbatim,
        "oxygen_vol_pct": num(row["o2_cal_initial_vol_pct"]),
        "oxygen_final_vol_pct": num(row["o2_cal_final_vol_pct"]),
        "pressure_kpa": None,
        "pressure_kpa_range": [99.2, 99.5] if pi == "Bhattacharjee" else None,
        "co2_vol_pct": [num(row["co2_initial_vol_pct"]), num(row["co2_final_vol_pct"])],
        "co_ppm": [num(row["co_initial_ppm"]), num(row["co_final_ppm"])],
        "observations_verbatim": row["observations_verbatim"],
        **outcome_fields(row["outcome"]),
        "quality_flags": flags,
        "provenance": {
            "record": {"source_id": CITE_SUMMARY, "table": f"Table {row['pi_table']}", "pdf_page": page_of_test(row["test_id"], pages)},
            "observed": ["test_id", "thickness_mm", "width_mm", "flow_verbatim", "oxygen_vol_pct", "co2_vol_pct", "co_ppm"],
            "series": series,
            "derived": {
                "outcome": "Coded by MicroFire Atlas from the verbatim observations column.",
                "flow_initial_cm_s": "First value of the 'Air display' column (air velocity transducer, cm/s). "
                                     "Later 'pot' values are fan potentiometer settings, not velocities, and are not converted.",
            },
            "notes": {"oxygen_vol_pct": "Taken from NASA's 'Calibrated initial O2 vol%' column."},
        },
    }


def build():
    records = []
    with open(CURATED / "sibal_fabric_table7_1.csv", newline="", encoding="utf-8") as f:
        records += [sibal_record(r) for r in csv.DictReader(f)]
    with open(CURATED / "bass2_table_a1_a2.csv", newline="", encoding="utf-8") as f:
        records += [table_a_record(r) for r in csv.DictReader(f)]
    ids = [r["id"] for r in records]
    if len(ids) != len(set(ids)):
        raise ValueError("duplicate experiment ids")
    return records


def squash(text):
    return " ".join(text.split())


def pdf_pages(ntrs_id):
    pdf = ROOT / "data" / "raw" / "ntrs" / f"{ntrs_id}.pdf"
    if not pdf.exists():
        raise FileNotFoundError(f"{pdf} missing: run pipelines/fetch_sources.py first")
    out = subprocess.run(["pdftotext", "-layout", str(pdf), "-"], check=True, capture_output=True, text=True).stdout
    return [squash(p) for p in out.split("\f")]


def build_findings(sources, experiment_ids):
    """Every quote must appear verbatim in its source; PDF quotes get their page number."""
    by_id = {s["source_id"]: s for s in sources}
    findings = json.loads((CURATED / "findings.json").read_text())
    pages_cache = {}
    for f in findings:
        src = by_id[f["source_id"]]
        q = squash(f["quote"])
        if f["in"] == "abstract":
            if q not in squash(src["abstract"] or ""):
                raise ValueError(f"{f['id']}: quote not found in {f['source_id']} abstract")
        else:
            pages = pages_cache.setdefault(src["ntrs_id"], pdf_pages(src["ntrs_id"]))
            hits = [i + 1 for i, p in enumerate(pages) if q in p]
            if not hits:
                raise ValueError(f"{f['id']}: quote not found in {f['source_id']} PDF")
            f["pdf_page"] = hits[0]
        for eid in f.get("experiments", []) if isinstance(f.get("experiments"), list) else []:
            if eid not in experiment_ids:
                raise ValueError(f"{f['id']}: unknown experiment {eid}")
    return findings


def main():
    records = build()
    sources = json.loads((ROOT / "data" / "sources.json").read_text())
    findings = build_findings(sources, {r["id"] for r in records})
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(records, indent=1, ensure_ascii=False) + "\n")
    WEB.mkdir(parents=True, exist_ok=True)
    for name, data in (("experiments", records), ("sources", sources), ("findings", findings)):
        (WEB / f"{name}.json").write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n")
    print(f"{len(records)} records, {len(findings)} verified findings -> {WEB.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
