"""Limiting-oxygen curve: how much oxygen the model needs, at each airflow, for a 50 % chance of a sustained flame.

    python3 pipelines/loc_curve.py  ->  data/processed/loc_curve.json, apps/web/data/loc_curve.json

This is the model's own "50 % oxygen" line, a close cousin of NASA's limiting oxygen concentration (LOC),
not NASA's measured LOC. Solved analytically for each of the 200 bootstrap models, so the band is the
same uncertainty the /predict page shows. Points outside the tested oxygen range are flagged.
"""
import json
import pathlib

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
MODEL = ROOT / "apps" / "web" / "data" / "model.json"
OUT = ROOT / "data" / "processed" / "loc_curve.json"
WEB = ROOT / "apps" / "web" / "data" / "loc_curve.json"
FLOWS = [2, 3, 4, 5, 7, 10, 15, 20, 25]


def o2_at_half(B, flow, opposed):
    mu, sd, w, b = np.array(B["mu"]), np.array(B["sd"]), np.array(B["w"]), B["b"]
    if w[0] <= 1e-9:
        return None  # oxygen has no positive effect in this refit: no crossing
    rest = b + w[1] * (np.log(flow) - mu[1]) / sd[1] + w[2] * (opposed - mu[2]) / sd[2]
    return float(mu[0] - sd[0] / w[0] * rest)


def main():
    m = json.loads(MODEL.read_text())
    lo_t, hi_t = m["ranges"]["o2_pct"]
    out = {"version": "loc-curve-1.0", "o2_tested_range": [lo_t, hi_t], "flow_tested_range": m["ranges"]["flow_cm_s"],
           "limits": ["The model is logistic in log airflow, so the curve can only fall as airflow rises. It cannot show a turnover or minimum if the real boundary has one.", "No test is below 2 cm/s, so the left edge of the chart is the edge of the data, not of the physics.", "Material is not a model input; the overlap between 'burned' and 'went out' in the observed bins partly reflects different materials."],
           "definition": "Oxygen (vol %) at which the model gives a 50 % chance that the flame is sustained, at each airflow. Not NASA's measured limiting oxygen concentration.",
           "curves": {}, "points": m["points"]}
    for name, opp in (("concurrent", 0.0), ("opposed", 1.0)):
        rows = []
        for f in FLOWS:
            vals = [v for v in (o2_at_half(B, f, opp) for B in m["bootstrap"]) if v is not None]
            lo, mid, hi = (float(np.quantile(vals, q)) for q in (0.05, 0.5, 0.95)) if vals else (None,) * 3
            rows.append({"flow": f, "o2_p05": lo, "o2_p50": mid, "o2_p95": hi, "n_models": len(vals),
                         "inside_tested_o2": bool(mid is not None and lo_t <= mid <= hi_t),
                         "band_inside_tested_o2": bool(lo is not None and lo >= lo_t and hi <= hi_t)})
        out["curves"][name] = rows
    # observed: per flow bin, the lowest O2 that burned and the highest that went out (what the raw tests say)
    pts = m["points"]
    bins = [(2, 3), (3, 5), (5, 10), (10, 25)]
    out["observed_by_flow_bin"] = []
    for a, b in bins:
        sel = [p for p in pts if a <= p["flow"] < b or (b == 25 and p["flow"] == b)]
        burned = [p["o2"] for p in sel if p["sustained"]]
        went_out = [p["o2"] for p in sel if not p["sustained"]]
        out["observed_by_flow_bin"].append({"flow_from": a, "flow_to": b, "n": len(sel),
                                            "lowest_o2_that_burned": min(burned) if burned else None,
                                            "highest_o2_that_went_out": max(went_out) if went_out else None,
                                            "overlap": bool(burned and went_out and min(burned) <= max(went_out))})
    for p in (OUT, WEB):
        p.write_text(json.dumps(out, indent=1) + "\n")
    for k, rows in out["curves"].items():
        print(k, [(r["flow"], None if r["o2_p50"] is None else round(r["o2_p50"], 1), r["inside_tested_o2"]) for r in rows])
    print(out["observed_by_flow_bin"])


if __name__ == "__main__":
    main()
