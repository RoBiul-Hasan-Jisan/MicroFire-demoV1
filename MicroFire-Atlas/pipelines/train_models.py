"""Train and honestly evaluate the flame-outcome model.

    python3 pipelines/build_model_table.py && python3 pipelines/train_models.py

Question the model answers: given material, thickness, oxygen, flow speed and flow direction,
does the flame keep burning in microgravity (1) or go out / never ignite (0)?

Honesty rules:
- evaluation is leave-one-series-out (a whole flight or BASS-II material group is hidden),
  never a random row split, so near-duplicate tests cannot leak across train and test;
- every model is compared with a no-skill baseline;
- the model is a small regularised logistic regression on ~50 rows, so each prediction
  comes with a bootstrap interval and an "inside / outside the tested range" flag;
- spread rate has only 4 measured values, far too few to fit, so it is reported, not modelled.

Outputs: data/processed/model_report.json  and  apps/web/data/model.json (used by /predict).
"""
import csv
import json
import pathlib
import warnings

import numpy as np
from sklearn.linear_model import LogisticRegression

warnings.filterwarnings("ignore")
ROOT = pathlib.Path(__file__).resolve().parent.parent
TABLE = ROOT / "data" / "processed" / "model_table.csv"
REPORT = ROOT / "data" / "processed" / "model_report.json"
WEB_MODEL = ROOT / "apps" / "web" / "data" / "model.json"
SEED = 7
MATS = ["PMMA", "Nomex", "Silicone"]  # SIBAL fabric is the reference level; Cotton jersey (1 row) folds into it
FEATURES_FULL = ["o2_pct", "log_flow", "log_thickness", "opposed"] + [f"mat_{m}" for m in MATS]
FEATURES_O2 = ["o2_pct"]
FEATURES_SEL = ["o2_pct", "log_flow", "opposed"]  # shipped model: physical drivers only (material and thickness did not help in CV)


def load():
    rows = [r for r in csv.DictReader(open(TABLE)) if r["usable_label"] == "1"]
    return rows


def thickness_median(rows):
    v = [float(r["thickness_mm"]) for r in rows if r["thickness_mm"]]
    return float(np.median(v))


def featurize(r, th_med):
    th = float(r["thickness_mm"]) if r["thickness_mm"] else th_med
    f = {"o2_pct": float(r["o2_pct"]), "log_flow": np.log(float(r["flow_cm_s"])), "log_thickness": np.log(th),
         "opposed": 1.0 if r["flow_direction"] == "opposed" else 0.0}
    for m in MATS:
        f[f"mat_{m}"] = 1.0 if r["material"] == m else 0.0
    return f


def matrix(rows, cols, th_med):
    return np.array([[featurize(r, th_med)[c] for c in cols] for r in rows])


def fit(X, y, C=1.0):
    mu, sd = X.mean(0), X.std(0)
    sd[sd == 0] = 1
    m = LogisticRegression(C=C, max_iter=1000).fit((X - mu) / sd, y)
    return {"mu": mu, "sd": sd, "w": m.coef_[0], "b": float(m.intercept_[0])}


def predict(M, X):
    z = ((X - M["mu"]) / M["sd"]) @ M["w"] + M["b"]
    return 1 / (1 + np.exp(-z))


def metrics(y, p):
    p = np.clip(p, 1e-6, 1 - 1e-6)
    pred = (p >= 0.5).astype(int)
    tpr = ((pred == 1) & (y == 1)).sum() / max((y == 1).sum(), 1)
    tnr = ((pred == 0) & (y == 0)).sum() / max((y == 0).sum(), 1)
    return {"accuracy": round(float((pred == y).mean()), 3), "balanced_accuracy": round(float((tpr + tnr) / 2), 3),
            "brier": round(float(((p - y) ** 2).mean()), 3),
            "log_loss": round(float(-(y * np.log(p) + (1 - y) * np.log(1 - p)).mean()), 3)}


def cross_validate(rows, groups, cols, th_med_fn, C=1.0):
    y = np.array([int(r["sustained"]) for r in rows])
    oof = np.zeros(len(rows))
    for g in sorted(set(groups)):
        te = np.array([x == g for x in groups])
        tr = ~te
        if len(set(y[tr])) < 2:
            oof[te] = y[tr].mean()
            continue
        th = th_med_fn([r for r, t in zip(rows, tr) if t])
        M = fit(matrix([r for r, t in zip(rows, tr) if t], cols, th), y[tr], C)
        oof[te] = predict(M, matrix([r for r, t in zip(rows, te) if t], cols, th))
    return y, oof


CANDIDATE_SETS = {"oxygen_only": FEATURES_O2, "oxygen_flow_direction": FEATURES_SEL, "all_features": FEATURES_FULL}


def nested_selection(rows, groups):
    """Honest score for "pick the best feature set by CV, then deploy it".

    For every held-out series the feature set is chosen using ONLY the other series (inner
    leave-one-series-out, lowest Brier), refitted on them, and scored on the held-out series.
    This removes the optimism of choosing the shipped features with the same CV that scores them.
    """
    y = np.array([int(r["sustained"]) for r in rows])
    oof = np.zeros(len(rows))
    picks = {}
    for g in sorted(set(groups)):
        te = np.array([x == g for x in groups])
        tr = ~te
        tr_rows = [r for r, t in zip(rows, tr) if t]
        tr_groups = [x for x, t in zip(groups, tr) if t]
        best, best_brier = None, 9.0
        for name, cols in CANDIDATE_SETS.items():
            yy, o = cross_validate(tr_rows, tr_groups, cols, thickness_median)
            b = float(((o - yy) ** 2).mean())
            if b < best_brier:
                best, best_brier = name, b
        picks[g] = best
        th = thickness_median(tr_rows)
        if len(set(y[tr])) < 2:
            oof[te] = y[tr].mean()
            continue
        M = fit(matrix(tr_rows, CANDIDATE_SETS[best], th), y[tr])
        oof[te] = predict(M, matrix([r for r, t in zip(rows, te) if t], CANDIDATE_SETS[best], th))
    return y, oof, picks


def baseline(rows, groups):
    y = np.array([int(r["sustained"]) for r in rows])
    oof = np.zeros(len(rows))
    for g in set(groups):
        te = np.array([x == g for x in groups])
        oof[te] = y[~te].mean()
    return y, oof


def wilson(k, n, z=1.96):
    if n == 0:
        return [None, None]
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return [round(float(c - h), 3), round(float(c + h), 3)]


def ranking(rows):
    out = []
    for mat in sorted({r["material"] for r in rows}):
        rs = [r for r in rows if r["material"] == mat]
        k, n = sum(int(r["sustained"]) for r in rs), len(rs)
        sus_o2 = [float(r["o2_pct"]) for r in rs if r["sustained"] == "1"]
        non_o2 = [float(r["o2_pct"]) for r in rs if r["sustained"] == "0"]
        out.append({"material": mat, "n_tests": n, "sustained": k, "sustained_rate": round(k / n, 3),
                    "rate_ci95": wilson(k, n),
                    "lowest_o2_sustained": min(sus_o2) if sus_o2 else None,
                    "highest_o2_not_sustained": max(non_o2) if non_o2 else None})
    return sorted(out, key=lambda x: -x["sustained_rate"])


def main():
    rows = load()
    groups = [r["series"] for r in rows]
    y = np.array([int(r["sustained"]) for r in rows])
    th_all = thickness_median(rows)
    report = {"n_rows": len(rows), "n_sustained": int(y.sum()), "n_not_sustained": int((1 - y).sum()),
              "n_series": len(set(groups)), "cv": "leave-one-series-out", "models": {}}

    yb, ob = baseline(rows, groups)
    report["models"]["baseline_series_prior"] = metrics(yb, ob)
    for name, cols in (("logistic_oxygen_only", FEATURES_O2), ("logistic_oxygen_flow_direction_SHIPPED", FEATURES_SEL), ("logistic_all_features_with_material", FEATURES_FULL)):
        yy, oof = cross_validate(rows, groups, cols, thickness_median)
        report["models"][name] = metrics(yy, oof)
    # stress test: hide an entire material at once
    mg = [r["material"] for r in rows]
    yy, oof = cross_validate(rows, mg, FEATURES_O2 + ["log_flow", "log_thickness", "opposed"], thickness_median)
    report["models"]["logistic_no_material_leave_one_material_out"] = metrics(yy, oof)

    # honest score for the whole "choose features, then fit" procedure (no peeking at the held-out series)
    yn, on, picks = nested_selection(rows, groups)
    report["models"]["nested_selection_honest"] = metrics(yn, on)
    report["nested_selection_picks"] = {k: picks[k] for k in sorted(picks)}

    # final fit + bootstrap ensemble for uncertainty
    M = fit(matrix(rows, FEATURES_SEL, th_all), y)
    rng = np.random.default_rng(SEED)
    boots = []
    X = matrix(rows, FEATURES_SEL, th_all)
    while len(boots) < 200:
        idx = rng.integers(0, len(rows), len(rows))
        if len(set(y[idx])) < 2:
            continue
        B = fit(X[idx], y[idx])
        boots.append({"mu": B["mu"].tolist(), "sd": B["sd"].tolist(), "w": B["w"].tolist(), "b": B["b"]})
    report["coefficients_standardised"] = {c: round(float(w), 3) for c, w in zip(FEATURES_SEL, M["w"])}
    report["ranking"] = ranking(rows)
    allrows = list(csv.DictReader(open(TABLE)))
    spread = [{"id": r["id"], "material": r["material"], "o2_pct": float(r["o2_pct"]) if r["o2_pct"] else None,
               "flow_cm_s": float(r["flow_cm_s"]) if r["flow_cm_s"] else None, "direction": r["flow_direction"] or None,
               "spread_rate_mm_s": float(r["spread_rate_mm_s"])} for r in allrows if r["spread_rate_mm_s"]]
    report["spread_rate"] = {"n_measured": len(spread), "runs": spread,
                             "note": f"Only {len(spread)} runs report a spread rate; too few to train a regressor, so they are shown as measured."}
    report["caveats"] = [
        "All tests are ISS microgravity; 5 materials, ~50 labelled rows.",
        "BASS-II outcomes depend on how the crew stepped the flow down, so low flow is partly an experiment-protocol effect.",
        "22 BASS-II rows with no stated outcome and 7 rows where flow was shut off by the crew are excluded.",
        "Pressure is mostly unstated and is not used as a feature. Material and thickness did not improve cross-validated scores, so the shipped model uses oxygen, flow speed and flow direction only; materials are compared in the ranking table.",
        "The shipped feature set was chosen using the same cross-validation it is scored on, so its scores are slightly optimistic. With ~49 rows, differences of a few points between models are within noise.",
        "Not validated for Moon or Mars gravity, or for materials outside the five listed.",
        "nested_selection_honest re-chooses the feature set inside every training fold, so it is the fair score for the whole procedure; compare it, not the shipped row, with the baseline.",
    ]
    REPORT.write_text(json.dumps(report, indent=1) + "\n")

    rng_ = {c: [float(X[:, i].min()), float(X[:, i].max())] for i, c in enumerate(FEATURES_SEL)}
    model = {"features": FEATURES_SEL,
             "mu": M["mu"].tolist(), "sd": M["sd"].tolist(), "w": M["w"].tolist(), "b": M["b"], "bootstrap": boots,
             "ranges": {"o2_pct": rng_["o2_pct"], "flow_cm_s": [float(np.exp(rng_["log_flow"][0])), float(np.exp(rng_["log_flow"][1]))]},
             "points": [{"id": r["id"], "material": r["material"], "o2": float(r["o2_pct"]), "flow": float(r["flow_cm_s"]),
                         "direction": r["flow_direction"] or None, "sustained": int(r["sustained"]), "series": r["series"]} for r in rows],
             "report": {k: report[k] for k in ("n_rows", "n_sustained", "n_not_sustained", "n_series", "cv", "models", "ranking", "caveats", "coefficients_standardised", "spread_rate")}}
    WEB_MODEL.parent.mkdir(parents=True, exist_ok=True)
    WEB_MODEL.write_text(json.dumps(model, separators=(",", ":")) + "\n")
    print(json.dumps(report["models"], indent=1))
    print(json.dumps(report["coefficients_standardised"]))
    for r in report["ranking"]:
        print(r)


if __name__ == "__main__":
    main()
