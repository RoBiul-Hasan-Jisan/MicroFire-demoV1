"""Saffire runs: a second experiment family, kept in its own schema (large-scale fires in Cygnus, not BASS-II).

Every row of data/curated/saffire_runs.csv names the exact NASA table line it was transcribed from.
The build fails unless that line appears verbatim on the cited PDF page, every transcribed value
appears in that line (or, for column tables, at the sample's column), and every quote is on its page.
"""
import csv
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
CURATED = ROOT / "data" / "curated"
_pages = {}

# thickness of Saffire IV-VI PMMA comes from a sample-configuration figure or the method text, not the test matrix
THICKNESS_CITE = {
    "saffire-iv-2": ("saffire-4-5", 6, "2-sided PMMA (1 cm thick.)"),
    "saffire-v-3": ("saffire-4-5", 6, "1-sided PMMA (0.5 cm thick.)"),
    "saffire-v-4": ("saffire-4-5", 6, "Structured PMMA (1 cm thick.)"),
    "saffire-vi-3": ("saffire-6", 4, "flat, cast, polymethyl methacrylate (PMMA) (either one-sided 5 mm thick or two-sided (10 mm thick)"),
    "saffire-vi-4": ("saffire-6", 4, "flat, cast, polymethyl methacrylate (PMMA) (either one-sided 5 mm thick or two-sided (10 mm thick)"),
}
NOTES = {
    "saffire-1-1": ["Table I lists 182 W ignition power; an earlier slide in the same presentation gives 165 W for Saffire 1. The table value is kept."],
    "saffire-2-7": ["Composite sample: a 5 cm, 0.85 mm PMMA lead-in followed by 24 cm of Nomex HT90-40 (0.37 mm). Values here describe the Nomex part."],
    "saffire-2-8": ["Grooved slab; its cross-section is given in a figure, so no single thickness is recorded."],
    "saffire-iv-2": ["Thick-fuel flames in concurrent flow 'did not spread and were instead pinned to the leading edge' (overview statement, not tied to this sample)."],
}
SQUASH = lambda s: " ".join(s.split())


def page_lines(ntrs_id, page):
    key = (ntrs_id, page)
    if key not in _pages:
        pdf = ROOT / "data" / "raw" / "ntrs" / f"{ntrs_id}.pdf"
        out = subprocess.run(["pdftotext", "-layout", "-f", str(page), "-l", str(page), str(pdf), "-"], check=True, capture_output=True, text=True).stdout
        _pages[key] = [SQUASH(l) for l in out.splitlines() if l.strip()]
    return _pages[key]


def num(s):
    return float(s) if s not in ("", None) else None


def g(v):
    return f"{v:g}"


def check_row_line(rid, line, wants):
    for w in wants:
        if w is not None and w not in line:
            raise ValueError(f"{rid}: '{w}' not found in its NASA table line: {line}")


def build_saffire(sources):
    ntrs = {s["source_id"]: s["ntrs_id"] for s in sources}
    page_text = lambda sid, p: " ".join(page_lines(ntrs[sid], p))
    runs = []
    with open(CURATED / "saffire_runs.csv", newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        rid = r["id"]
        v = {k: num(r[k]) for k in ("thickness_mm", "width_cm", "length_cm", "flow_cm_s", "pressure_kpa", "o2_pct", "burn_duration_s", "spread_rate_mm_s", "heat_release_avg_w", "heat_release_peak_w")}
        prov = {"conditions": None, "results": None, "outcome": None, "thickness": None}

        if r["cond_line"]:
            lines = r["cond_line"].split("|")
            have = page_lines(ntrs[r["cond_source"]], int(r["cond_page"]))
            for l in lines:
                if l not in have:
                    raise ValueError(f"{rid}: condition line not on {r['cond_source']} PDF page {r['cond_page']}: {l}")
            if r["cond_col"] == "":  # one row per sample (Saffire 1-2, Table I)
                line = lines[0]
                t = v["thickness_mm"]
                check_row_line(rid, line, [r["sample"] + " ", r["material_verbatim"], f"{g(v['width_cm'])} cm", f"{g(v['flow_cm_s'])} cm/s", r["flow_direction"].capitalize(), g(v["o2_pct"]) if v["o2_pct"] is not None else None])
                if t is not None and f"{g(t)} mm" not in line and f"{g(t / 10)} cm" not in line:
                    raise ValueError(f"{rid}: thickness {t} mm not in {line}")
                if v["length_cm"] is not None and f"{g(v['length_cm'])} cm" not in line:
                    raise ValueError(f"{rid}: length not in {line}")
            else:  # one column per sample (Saffire IV-VI)
                col = int(r["cond_col"])
                for l in lines:
                    label = {"Ambient Pressure": "pressure_kpa", "Oxygen Concentration": "o2_pct", "Length (cm)": "length_cm", "Air Flow Rate": "flow_cm_s"}
                    field = next(fld for k, fld in label.items() if l.startswith(k))
                    cells = [c for c in l.split() if c.replace(".", "").isdigit()]
                    if v[field] is None or abs(float(cells[col]) - v[field]) > 1e-9:
                        raise ValueError(f"{rid}: {field}={v[field]} but column {col} of '{l}' is {cells[col]}")
            prov["conditions"] = {"source_id": r["cond_source"], "pdf_page": int(r["cond_page"]), "table": "Table I" if r["cond_col"] == "" else "Test matrix", "quote": " / ".join(lines)}

        if r["res_line"]:
            line = r["res_line"]
            if line not in page_lines(ntrs[r["res_source"]], int(r["res_page"])):
                raise ValueError(f"{rid}: result line not on {r['res_source']} PDF page {r['res_page']}: {line}")
            wants = [r["sample"] + " "]
            if v["burn_duration_s"] is not None:
                wants.append(f"{g(v['burn_duration_s'])} s" if r["flight"] in ("Saffire-1", "Saffire-2") else f" {g(v['burn_duration_s'])} ")
            if v["spread_rate_mm_s"] is not None:
                wants.append(f"{g(v['spread_rate_mm_s'])} mm/s")
            if v["heat_release_avg_w"] is not None:
                wants.append(f"{int(v['heat_release_avg_w']):,}")
            if v["heat_release_peak_w"] is not None:
                wants.append(f" {int(v['heat_release_peak_w'])} ")
            if r["burn_length_verbatim"]:
                wants.append(r["burn_length_verbatim"])
            check_row_line(rid, line + " ", wants)
            prov["results"] = {"source_id": r["res_source"], "pdf_page": int(r["res_page"]), "table": "Table I (continued)" if r["res_source"] == "saffire-1-3" else "Table 2", "quote": line}

        if r["quote"]:
            if SQUASH(r["quote"]) not in page_text(r["quote_source"], int(r["quote_page"])):
                raise ValueError(f"{rid}: quote not on {r['quote_source']} PDF page {r['quote_page']}")
            prov["outcome"] = {"source_id": r["quote_source"], "pdf_page": int(r["quote_page"]), "quote": r["quote"]}

        if rid in THICKNESS_CITE:
            sid, p, q = THICKNESS_CITE[rid]
            if q not in page_text(sid, p):
                raise ValueError(f"{rid}: thickness quote not on {sid} PDF page {p}")
            prov["thickness"] = {"source_id": sid, "pdf_page": p, "quote": q}

        if r["outcome_group"] != "unknown" and not (prov["results"] or prov["outcome"]):
            raise ValueError(f"{rid}: an outcome needs a NASA result line or quote")

        runs.append({
            "id": rid,
            "family": "saffire",
            "flight": r["flight"],
            "sample": r["sample"],
            "material": r["material"],
            "material_verbatim": r["material_verbatim"],
            "geometry": r["geometry"],
            "thickness_mm": v["thickness_mm"],
            "width_cm": v["width_cm"],
            "length_cm": v["length_cm"],
            "flow_cm_s": v["flow_cm_s"],
            "flow_direction": r["flow_direction"] or None,
            "pressure_kpa": v["pressure_kpa"],
            "o2_pct": v["o2_pct"],
            "o2_basis": r["o2_basis"] or None,
            "burn_duration_s": v["burn_duration_s"],
            "burn_length_verbatim": r["burn_length_verbatim"] or None,
            "spread_rate_mm_s": v["spread_rate_mm_s"],
            "heat_release_avg_w": v["heat_release_avg_w"],
            "heat_release_peak_w": v["heat_release_peak_w"],
            "one_g": {"burn_length": r["one_g_burn_length"], "spread": r["one_g_spread"]} if r["one_g_burn_length"] else None,
            "outcome_group": r["outcome_group"],
            "outcome_label": r["outcome_label"],
            "gravity_regime": "microgravity (uncrewed Cygnus vehicle in orbit)",
            "provenance": prov,
            "notes": NOTES.get(rid, []) + (["Oxygen is the initial value of NASA's Δ%O2 range, derived from measured CO production and referenced to the ISS reading."] if r["o2_basis"] in ("range", "approx") else []),
        })
    ids = [x["id"] for x in runs]
    if len(ids) != len(set(ids)):
        raise ValueError("duplicate Saffire ids")
    return runs
