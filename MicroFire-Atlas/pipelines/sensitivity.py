"""How much do the next-test picks depend on the assumptions that are mine, not NASA's?

    python3 pipelines/sensitivity.py  ->  data/processed/next_experiments_sensitivity.json (+ apps/web/data copy)

Re-runs the recommender while varying the two assumptions the project made up, the buoyant-flow scale
u_ref and the extrapolation spread kappa, plus the buoyant exponent, and reports how often each pick
survives. A pick that survives every setting is robust; one that does not is an artefact.
"""
import copy
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import gravity_bridge as gb  # noqa: E402
import next_experiments as ne  # noqa: E402

ROOT = gb.ROOT
OUT = ROOT / "data" / "processed" / "next_experiments_sensitivity.json"
WEB = ROOT / "apps" / "web" / "data" / "next_experiments_sensitivity.json"

SETTINGS = [
    {"id": "default", "label": "Default (u_ref 10–30 cm/s, n 1/3–1/2, kappa 1.5)", "u_ref": [10, 30], "exponent": [1 / 3, 0.5], "kappa": 1.5},
    {"id": "weak-buoyancy", "label": "Weak buoyancy (u_ref 3–10 cm/s)", "u_ref": [3, 10], "exponent": [1 / 3, 0.5], "kappa": 1.5},
    {"id": "strong-buoyancy", "label": "Strong buoyancy (u_ref 20–60 cm/s)", "u_ref": [20, 60], "exponent": [1 / 3, 0.5], "kappa": 1.5},
    {"id": "n-third", "label": "Exponent fixed at 1/3", "u_ref": [10, 30], "exponent": [1 / 3, 1 / 3], "kappa": 1.5},
    {"id": "n-half", "label": "Exponent fixed at 1/2", "u_ref": [10, 30], "exponent": [0.5, 0.5], "kappa": 1.5},
    {"id": "kappa-low", "label": "Little extrapolation uncertainty (kappa 0.5)", "u_ref": [10, 30], "exponent": [1 / 3, 0.5], "kappa": 0.5},
    {"id": "kappa-high", "label": "Large extrapolation uncertainty (kappa 3)", "u_ref": [10, 30], "exponent": [1 / 3, 0.5], "kappa": 3.0},
]


def key(s):
    return (s["gravity"], s["o2"], s["forced"], s["direction"])


def main():
    model, base = gb.load_model(), gb.load_spec()
    cands = ne.candidates()
    runs = []
    for st in SETTINGS:
        spec = copy.deepcopy(base)
        spec["u_ref_cm_s"], spec["exponent"] = st["u_ref"], st["exponent"]
        res = ne.run(gb.Ensemble(model, spec, kappa=st["kappa"]), cands, st["label"])
        batch = res["batch"]
        runs.append({"id": st["id"], "label": st["label"], "uncertainty_removed_by_batch": batch[-1]["cumulative_uncertainty_removed"],
                     "batch": [{"rank": b["rank"], "gravity": b["gravity"], "o2": b["o2"], "forced": b["forced"], "direction": b["direction"]} for b in batch]})
        print(st["id"], [(b["gravity"][:4], b["o2"], b["forced"]) for b in batch], round(batch[-1]["cumulative_uncertainty_removed"], 3))
    ref = runs[0]["batch"]
    ref_keys = [key(b) for b in ref]
    survive = []
    for b in ref:
        k = key(b)
        survive.append({**b, "appears_in": sum(1 for r in runs if k in [key(x) for x in r["batch"]]), "of": len(runs),
                        "top1_in": sum(1 for r in runs if key(r["batch"][0]) == k)})
    # pick-type robustness: gravity of each rank-1 pick, and share of runs whose batch has >= 1 partial-gravity test
    kinds = [{"id": r["id"], "top_pick_gravity": r["batch"][0]["gravity"], "partial_gravity_tests_in_batch": sum(1 for b in r["batch"] if b["gravity"] != "microgravity")} for r in runs]
    out = {"version": "sensitivity-1.0", "settings": runs, "default_picks_survival": survive, "kinds": kinds,
           "always_includes_partial_gravity_test": all(k["partial_gravity_tests_in_batch"] >= 1 for k in kinds),
           "default_batch_identical_everywhere": all([key(b) for b in r["batch"]] == ref_keys for r in runs)}
    for p in (OUT, WEB):
        p.write_text(json.dumps(out, indent=1) + "\n")
    print("always includes partial-gravity test:", out["always_includes_partial_gravity_test"], "| identical everywhere:", out["default_batch_identical_everywhere"])
    print([(s["rank"], s["appears_in"], s["top1_in"]) for s in survive])


if __name__ == "__main__":
    main()
