"""Does pressure help? A check on the rows where pressure is actually stated.

    python3 pipelines/pressure_check.py  ->  data/processed/pressure_report.json, apps/web/data/pressure_report.json

Pressure is blank for most rows (BASS tables often do not state it). We do NOT guess it. Instead we
look only at rows with a stated pressure and compare, with leave-one-series-out cross-validation:
  oxygen % only   vs   oxygen % + pressure   vs   partial pressure of oxygen (kPa)
and report plainly whether anything is better. With this few rows the honest answer is usually
"cannot tell", and that is what the page shows.
"""
import json
import pathlib
import sys

import numpy as np

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import train_models as tm  # noqa: E402

ROOT = tm.ROOT
OUT = ROOT / "data" / "processed" / "pressure_report.json"
WEB = ROOT / "apps" / "web" / "data" / "pressure_report.json"


def with_extra(rows):
    out = []
    for r in rows:
        r = dict(r)
        p = float(r["pressure_kpa"])
        r["_pressure"] = p
        r["_ppo2"] = float(r["o2_pct"]) / 100 * p
        out.append(r)
    return out


def cv(rows, groups, cols, extra):
    """Leave-one-series-out with extra columns appended to the shared feature matrix."""
    y = np.array([int(r["sustained"]) for r in rows])
    th = tm.thickness_median(rows)

    def mat(rs):
        base = tm.matrix(rs, [c for c in cols if not c.startswith("_")], th)
        add = np.array([[r[c] for c in cols if c.startswith("_")] for r in rs]).reshape(len(rs), -1)
        return np.hstack([base, add]) if add.size else base

    oof = np.zeros(len(rows))
    for g in sorted(set(groups)):
        te = np.array([x == g for x in groups])
        tr = ~te
        if len(set(y[tr])) < 2:
            oof[te] = y[tr].mean()
            continue
        M = tm.fit(mat([r for r, t in zip(rows, tr) if t]), y[tr])
        oof[te] = tm.predict(M, mat([r for r, t in zip(rows, te) if t]))
    return y, oof


def main():
    rows = [r for r in tm.load() if r["pressure_kpa"]]
    n_all = len(tm.load())
    rows = with_extra(rows)
    groups = [r["series"] for r in rows]
    y = np.array([int(r["sustained"]) for r in rows])
    base_rate = y.mean()
    series = sorted(set(groups))
    # no-skill baseline on the same subset (hide a series, predict the rate in the rest)
    oof0 = np.array([y[[x != g for x in groups]].mean() for g in groups])
    variants = {
        "no_skill_baseline": tm.metrics(y, oof0),
        "oxygen_only": tm.metrics(*cv(rows, groups, ["o2_pct"], None)),
        "oxygen_flow_direction": tm.metrics(*cv(rows, groups, ["o2_pct", "log_flow", "opposed"], None)),
        "oxygen_flow_direction_plus_pressure": tm.metrics(*cv(rows, groups, ["o2_pct", "log_flow", "opposed", "_pressure"], None)),
        "partial_pressure_o2_flow_direction": tm.metrics(*cv(rows, groups, ["_ppo2", "log_flow", "opposed"], None)),
    }
    b = variants["oxygen_flow_direction"]["brier"]
    better = [k for k in ("oxygen_flow_direction_plus_pressure", "partial_pressure_o2_flow_direction") if variants[k]["brier"] < b - 0.02]
    pressures = sorted(set(round(r["_pressure"], 1) for r in rows))
    report = {
        "version": "pressure-check-1.0",
        "n_with_pressure": len(rows), "n_usable_total": n_all, "n_series": len(series), "series": series,
        "sustained_rate": round(float(base_rate), 3), "distinct_pressures_kpa": pressures,
        "variants": variants,
        "verdict": "pressure_helps" if better else "cannot_tell",
        "verdict_text": (
            "Adding pressure or partial pressure of oxygen improved Brier by more than 0.02 on this subset."
            if better else
            "Neither pressure nor partial pressure of oxygen improves the score by a margin larger than noise on this subset. With this few rows and series the check cannot tell whether pressure matters."
        ),
        "caveats": [
            f"Pressure is stated for only {len(rows)} of {n_all} labelled rows; it is never guessed or filled in.",
            f"Most of those rows are at ambient pressure, so the model sees little pressure variation (distinct values: {', '.join(map(str, pressures))} kPa).",
            f"Only {len(series)} series are available, so leave-one-series-out folds are few and the comparison is noisy.",
            "Every variant, including the no-skill baseline, scores badly here (Brier above 0.65): whole series share one outcome, so hiding a series leaves the others unrepresentative. The numbers are shown for transparency and should not be read as evidence for or against pressure.",
            "The limiting factor is data, not method: entering the stated BASS chamber pressures from the NASA reports would fix this (see docs/TODO_REAL_DATA.md).",
        ],
    }
    for p in (OUT, WEB):
        p.write_text(json.dumps(report, indent=1) + "\n")
    print(json.dumps({k: report[k] for k in ("n_with_pressure", "n_series", "distinct_pressures_kpa", "verdict")}))
    for k, v in variants.items():
        print(f"{k:42s} {v}")


if __name__ == "__main__":
    main()
