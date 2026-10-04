"""Merge every NASA test record that has a usable condition into one flat table.

    python3 pipelines/build_model_table.py   ->  data/processed/model_table.csv

Nothing is invented: a value the source does not state stays empty. `usable_label`
is 1 only when the outcome is a real physical result (flame sustained, quenched,
blown off, or never ignited). Rows where the experimenters ended the burn
themselves (flow shut off) or where the table gives no outcome are kept for
reference but never used to train or score a model.
"""
import csv
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "processed" / "model_table.csv"
COLS = ["id", "source", "series", "material", "thickness_mm", "o2_pct", "pressure_kpa", "flow_cm_s",
        "flow_direction", "outcome_group", "outcome_raw", "sustained", "usable_label", "spread_rate_mm_s", "notes"]

# outcome codes where a person, not the flame, decided how the burn ended
EXPERIMENTER_ENDED = {"extinguished_flow_off"}


def num(s):
    s = (s or "").strip()
    return float(s) if s else None


def bass_rows():
    for e in json.loads((ROOT / "data" / "processed" / "experiments.json").read_text()):
        flows = [v for v in (e.get("flow_initial_cm_s"), e.get("flow_final_cm_s")) if v is not None]
        group = e["outcome_group"]
        raw = e["outcome"]
        usable = group in ("sustained", "extinguished", "not_ignited") and raw not in EXPERIMENTER_ENDED
        flags = e.get("quality_flags") or []
        yield {
            "id": e["id"], "source": e["investigation"],
            "series": f'{e["investigation"]}|{e["material"]}',
            "material": e["material"], "thickness_mm": e.get("thickness_mm"), "o2_pct": e.get("oxygen_vol_pct"),
            "pressure_kpa": e.get("pressure_kpa"),
            # flame is judged against the LOWEST flow it saw: that is where quenching happens
            "flow_cm_s": min(flows) if flows else None,
            "flow_direction": e.get("flow_direction"), "outcome_group": group, "outcome_raw": raw,
            "sustained": 1 if group == "sustained" else 0, "usable_label": int(usable),
            "spread_rate_mm_s": None, "notes": ";".join(flags),
        }


def saffire_rows():
    with open(ROOT / "data" / "curated" / "saffire_runs.csv") as f:
        for r in csv.DictReader(f):
            group = r["outcome_group"]
            flight = r["flight"]
            yield {
                "id": r["id"], "source": "Saffire", "series": f"Saffire|{flight}",
                "material": r["material"], "thickness_mm": num(r["thickness_mm"]), "o2_pct": num(r["o2_pct"]),
                "pressure_kpa": num(r["pressure_kpa"]), "flow_cm_s": num(r["flow_cm_s"]),
                "flow_direction": r["flow_direction"] or None, "outcome_group": group,
                "outcome_raw": r["outcome_label"], "sustained": 1 if group == "sustained" else 0,
                "usable_label": int(group in ("sustained", "extinguished", "not_ignited") and r["o2_pct"] != ""),
                "spread_rate_mm_s": num(r["spread_rate_mm_s"]),
                "notes": "o2_" + r["o2_basis"] if r["o2_basis"] else "",
            }


def main():
    rows = list(bass_rows()) + list(saffire_rows())
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", newline="") as f:
        w = csv.DictWriter(f, COLS)
        w.writeheader()
        for r in rows:
            w.writerow({k: ("" if r[k] is None else r[k]) for k in COLS})
    use = [r for r in rows if r["usable_label"]]
    print(f"{len(rows)} rows, {len(use)} usable for modelling, "
          f"{sum(r['sustained'] for r in use)} sustained / {sum(1 - r['sustained'] for r in use)} not sustained, "
          f"{sum(1 for r in rows if r['spread_rate_mm_s'] is not None)} with a measured spread rate -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
