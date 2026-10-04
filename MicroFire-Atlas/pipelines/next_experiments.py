"""Next-experiment recommender: which new test would shrink our uncertainty the most?

    python3 pipelines/next_experiments.py   ->  data/processed/next_experiments.json
                                                apps/web/data/next_experiments.json  (+ gravity_bridge.json)

Method (value of information, computed inside the model's own uncertainty):
  * members = bootstrap outcome models x gravity-bridge parameters x extrapolation slopes
    (so members disagree about how the response continues beyond the tested range);
  * target = P(sustained) in mission cabins (Moon / Mars, exploration atmospheres, Earth-like air);
  * for every candidate test, enumerate its possible outcomes, re-weight the members with Bayes' rule,
    and measure how much total target variance is expected to remain;
  * greedy batch: pick the best test, then the best second test given the first, and so on.

Limits (stated on the page too): the bootstrap is not a true posterior; the bridge is an unvalidated
hypothesis; pressure and material are not model inputs; the extrapolation slope spread (kappa) is an
assumption. This is a research-planning aid, not a NASA test plan.
"""
import itertools
import json
import pathlib
import sys

import numpy as np

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import gravity_bridge as gb  # noqa: E402

ROOT = gb.ROOT
OUT = ROOT / "data" / "processed" / "next_experiments.json"
WEB = ROOT / "apps" / "web" / "data" / "next_experiments.json"
WEB_BRIDGE = ROOT / "apps" / "web" / "data" / "gravity_bridge.json"
KAPPA = 1.5
BATCH = 4

TARGETS = [
    {"id": "moon-ea-a", "label": "Moon habitat, exploration atmosphere A (34 % O2, 56.5 kPa), 20 cm/s ventilation", "o2": 34, "forced": 20, "direction": "concurrent", "gravity": "lunar"},
    {"id": "mars-ea-a", "label": "Mars habitat, exploration atmosphere A (34 % O2, 56.5 kPa), still air", "o2": 34, "forced": 0, "direction": "concurrent", "gravity": "martian"},
    {"id": "moon-air", "label": "Moon habitat, Earth-like air (21 % O2), still air", "o2": 21, "forced": 0, "direction": "concurrent", "gravity": "lunar"},
    {"id": "moon-ea-alt", "label": "Moon habitat, alternate exploration atmosphere (28.5 % O2, 66.2 kPa), still air", "o2": 28.5, "forced": 0, "direction": "concurrent", "gravity": "lunar"},
    {"id": "mars-ea-alt", "label": "Mars habitat, alternate exploration atmosphere (28.5 % O2, 66.2 kPa), still air", "o2": 28.5, "forced": 0, "direction": "concurrent", "gravity": "martian"},
]
O2_GRID = [16, 18, 20, 22, 24, 26, 28.5, 30, 32, 34, 36]  # habitat-relevant: nothing above 36 %
FLOW_GRID = [2, 3, 5, 10, 20, 40]
GRAV = ["microgravity", "lunar", "martian"]


def candidates():
    out = []
    for g in GRAV:
        for o2 in O2_GRID:
            flows = ([0] if g != "microgravity" else []) + FLOW_GRID
            for f in flows:
                for d in (["concurrent"] if f == 0 else ["concurrent", "opposed"]):
                    out.append({"gravity": g, "o2": o2, "forced": f, "direction": d})
    return out


def expected_remaining(P, T, w, idx):
    """Expected total target variance left after running the tests in idx, over all outcome patterns."""
    total = 0.0
    for y in itertools.product([0, 1], repeat=len(idx)):
        lik = np.ones(P.shape[0])
        for j, yy in zip(idx, y):
            lik = lik * (P[:, j] if yy else 1 - P[:, j])
        pw = w * lik
        pm = pw.sum()
        if pm <= 1e-15:
            continue
        mean = (pw[:, None] * T).sum(0) / pm
        var = (pw[:, None] * T ** 2).sum(0) / pm - mean ** 2
        total += pm * var.sum()
    return total


def run(ens, cands, label):
    P = ens.prob([c["o2"] for c in cands], [c["forced"] for c in cands], [c["direction"] for c in cands], [c["gravity"] for c in cands])
    T = ens.prob([t["o2"] for t in TARGETS], [t["forced"] for t in TARGETS], [t["direction"] for t in TARGETS], [t["gravity"] for t in TARGETS])
    w = ens.weights
    mean0 = (w[:, None] * T).sum(0)
    var0 = (w[:, None] * T ** 2).sum(0) - mean0 ** 2
    prior = float(var0.sum())
    single = np.array([1 - expected_remaining(P, T, w, [j]) / prior for j in range(len(cands))])
    chosen, steps = [], []
    for _ in range(BATCH):
        best, best_gain = None, -1
        for j in range(len(cands)):
            if j in chosen:
                continue
            gain = 1 - expected_remaining(P, T, w, chosen + [j]) / prior
            if gain > best_gain:
                best, best_gain = j, gain
        chosen.append(best)
        pj = P[:, best]
        order = np.argsort(pj)
        cw = np.cumsum(w[order])
        q = lambda f: float(pj[order][min(np.searchsorted(cw, f), len(order) - 1)])
        steps.append({"rank": len(chosen), **cands[best], "cumulative_uncertainty_removed": round(float(best_gain), 4),
                      "alone_uncertainty_removed": round(float(single[best]), 4),
                      "expected_p_sustained": round(float((w * pj).sum()), 3), "p90": [round(q(0.05), 3), round(q(0.95), 3)]})
    best_by_g = {}
    for g in GRAV:
        js = [j for j, c in enumerate(cands) if c["gravity"] == g]
        j = max(js, key=lambda k: single[k])
        best_by_g[g] = {**cands[j], "alone_uncertainty_removed": round(float(single[j]), 4)}
    return {"label": label, "best_by_gravity": best_by_g, "prior_total_variance": round(prior, 5),
            "target_prior": [{"id": t["id"], "p_mean": round(float(m), 3), "p_sd": round(float(np.sqrt(v)), 3)} for t, m, v in zip(TARGETS, mean0, var0)],
            "batch": steps, "single": single, "P": P, "T": T}


def grid_payload(cands, single):
    out = {}
    for g in GRAV:
        cells = {}
        for c, v in zip(cands, single):
            if c["gravity"] != g:
                continue
            k = (c["o2"], c["forced"])
            cells[k] = max(cells.get(k, 0), float(v))
        out[g] = [{"o2": k[0], "forced": k[1], "gain": round(v, 4)} for k, v in sorted(cells.items())]
    return out


def grid_quantiles(model, spec, o2, forced, direction, gravity, nu=7, nn=5):
    """Deterministic bridge-only quantiles (no structural inflation); mirrored exactly by lib/gravity-bridge.ts."""
    boots = model["bootstrap"]
    us = np.exp(np.linspace(np.log(spec["u_ref_cm_s"][0]), np.log(spec["u_ref_cm_s"][1]), nu))
    ns = np.linspace(spec["exponent"][0], spec["exponent"][1], nn)
    g = spec["gravity_ratio"][gravity]
    vals = []
    for u in us:
        for n in ns:
            ub = u * g ** n
            eff = max(float(np.hypot(forced, ub)), spec["min_effective_flow_cm_s"])
            for B in boots:
                x = np.array([o2, np.log(eff), 1.0 if direction == "opposed" else 0.0])
                z = float((((x - np.array(B["mu"])) / np.array(B["sd"])) * np.array(B["w"])).sum() + B["b"])
                vals.append(1 / (1 + np.exp(-z)))
    vals = np.sort(vals)
    q = lambda f: float(vals[min(len(vals) - 1, max(0, round(f * (len(vals) - 1))))])
    return {"o2": o2, "forced": forced, "direction": direction, "gravity": gravity, "p05": round(q(0.05), 4), "p50": round(q(0.5), 4), "p95": round(q(0.95), 4)}


def main():
    model, spec = gb.load_model(), gb.load_spec()
    cands = candidates()
    ens = gb.Ensemble(model, spec, kappa=KAPPA)
    val_rows = gb.load_validation()
    if val_rows:
        ens.reweight([r["o2"] for r in val_rows], [r["forced"] for r in val_rows], [r["direction"] for r in val_rows], [r["gravity"] for r in val_rows], [r["sustained"] for r in val_rows])
    main_run = run(ens, cands, "with extrapolation uncertainty (headline)")
    plain = run(gb.Ensemble(model, spec, kappa=KAPPA, structural=False), cands, "bootstrap + bridge only (no extrapolation uncertainty)")
    validation = gb.validate(gb.Ensemble(model, spec, kappa=KAPPA), val_rows)
    checks = [grid_quantiles(model, spec, *a) for a in [(21, 0, "concurrent", "lunar"), (34, 20, "concurrent", "lunar"), (28.5, 0, "concurrent", "martian"), (21, 10, "concurrent", "microgravity"), (24, 5, "opposed", "martian")]]
    result = {
        "version": "next-experiments-1.0", "kappa_extrapolation": KAPPA, "members": ens.n, "targets": TARGETS,
        "headline": {k: main_run[k] for k in ("label", "prior_total_variance", "target_prior", "batch", "best_by_gravity")},
        "bootstrap_only": {k: plain[k] for k in ("label", "prior_total_variance", "target_prior", "batch", "best_by_gravity")},
        "grid": grid_payload(cands, main_run["single"]),
        "validation_rows_used_to_reweight": len(val_rows),
        "assumptions": [
            "Uncertainty is measured inside the model's own bootstrap ensemble, which is not a true posterior.",
            f"Members also disagree about how the response continues outside the tested oxygen and airflow range (slope spread kappa = {KAPPA} logit units per range-width); this is an assumption, not a measurement.",
            "Partial-gravity candidates are scored through the unvalidated gravity bridge (see gravity_bridge.json). Their high value largely reflects that no real partial-gravity result exists yet.",
            "Pressure and material are not model inputs, so a test at 56.5 kPa and one at 101 kPa with the same oxygen percentage look identical here.",
            "Flow below 2 cm/s is excluded: no test in the atlas goes there and the model cannot be trusted there (see the Unseen map).",
            "Research-planning aid only; not a NASA test plan.",
        ],
    }
    for p in (OUT, WEB):
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(result, indent=1) + "\n")
    WEB_BRIDGE.write_text(json.dumps({"spec": spec, "validation": validation, "check": checks}, indent=1) + "\n")
    print(f"{len(cands)} candidate tests, {ens.n} members, {len(val_rows)} validation rows")
    for s in main_run["batch"]:
        print(s)
    print("bootstrap-only batch:")
    for s in plain["batch"]:
        print(s["rank"], s["gravity"], s["o2"], s["forced"], s["direction"], s["cumulative_uncertainty_removed"])
    print([ (t["id"], t["p_mean"], t["p_sd"]) for t in main_run["target_prior"]])


if __name__ == "__main__":
    main()
