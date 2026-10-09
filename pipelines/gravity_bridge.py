"""Gravity bridge: a transparent, UNVALIDATED hypothesis for reading ISS-trained results at lunar / Martian gravity.

    u_buoyant   = u_ref * (g/g_earth)^n
    u_effective = sqrt(u_forced^2 + u_buoyant^2)

The outcome model (trained on ISS microgravity only) is then evaluated at u_effective.
Nothing here is measured at partial gravity. Real partial-gravity results go in
data/curated/partial_gravity_validation.csv (every row needs a citation); when rows exist, the
bridge parameters are re-weighted against them and agreement / disagreement is reported.
"""
import csv
import json
import pathlib

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
SPEC = ROOT / "data" / "curated" / "gravity_bridge_spec.json"
VALIDATION = ROOT / "data" / "curated" / "partial_gravity_validation.csv"
MODEL_JSON = ROOT / "apps" / "web" / "data" / "model.json"
GROUPS = {"sustained", "extinguished", "not_ignited"}


def load_spec():
    return json.loads(SPEC.read_text())


def load_model():
    return json.loads(MODEL_JSON.read_text())


class Ensemble:
    """Bootstrap models x bridge parameters x extrapolation slopes. Rows are members."""

    def __init__(self, model, spec, repeats=5, kappa=1.5, seed=11, structural=True):
        boots = model["bootstrap"]
        rng = np.random.default_rng(seed)
        self.n = len(boots) * repeats
        pick = np.tile(np.arange(len(boots)), repeats)
        self.mu = np.array([boots[i]["mu"] for i in pick])
        self.sd = np.array([boots[i]["sd"] for i in pick])
        self.w = np.array([boots[i]["w"] for i in pick])
        self.b = np.array([boots[i]["b"] for i in pick])
        lo, hi = spec["u_ref_cm_s"]
        self.u_ref = np.exp(rng.uniform(np.log(lo), np.log(hi), self.n))
        self.exp = rng.uniform(*spec["exponent"], self.n)
        self.a_o2 = rng.normal(0, kappa, self.n) if structural else np.zeros(self.n)
        self.a_flow = rng.normal(0, kappa, self.n) if structural else np.zeros(self.n)
        self.o2_rng = model["ranges"]["o2_pct"]
        self.flow_rng = model["ranges"]["flow_cm_s"]
        self.gravity = spec["gravity_ratio"]
        self.min_flow = spec["min_effective_flow_cm_s"]
        self.weights = np.ones(self.n) / self.n
        self.structural = structural

    def effective_flow(self, forced, g):
        ub = self.u_ref[:, None] * np.power(np.asarray(g, float)[None, :], self.exp[:, None])
        return np.maximum(np.sqrt(np.asarray(forced, float)[None, :] ** 2 + ub ** 2), self.min_flow)

    def prob(self, o2, forced, direction, gravity):
        """P(sustained) per member for arrays of conditions. Returns [members, conditions]."""
        o2 = np.asarray(o2, float)
        g = np.array([self.gravity[x] for x in gravity])
        opposed = np.array([1.0 if d == "opposed" else 0.0 for d in direction])
        eff = self.effective_flow(forced, g)
        x = np.stack([np.broadcast_to(o2, eff.shape), np.log(eff), np.broadcast_to(opposed, eff.shape)], axis=-1)
        z = (((x - self.mu[:, None, :]) / self.sd[:, None, :]) * self.w[:, None, :]).sum(-1) + self.b[:, None]
        if self.structural:
            lo, hi = self.o2_rng
            d_o2 = np.where(o2 > hi, (o2 - hi) / (hi - lo), np.where(o2 < lo, (o2 - lo) / (hi - lo), 0.0))
            llo, lhi = np.log(self.flow_rng[0]), np.log(self.flow_rng[1])
            lf = np.log(eff)
            d_f = np.where(lf > lhi, (lf - lhi) / (lhi - llo), np.where(lf < llo, (lf - llo) / (lhi - llo), 0.0))
            z = z + self.a_o2[:, None] * d_o2[None, :] + self.a_flow[:, None] * d_f
        return 1 / (1 + np.exp(-z))

    def reweight(self, o2, forced, direction, gravity, y):
        """Bayesian-style update of member weights from observed outcomes (1 sustained, 0 not)."""
        p = self.prob(o2, forced, direction, gravity)
        y = np.asarray(y, float)[None, :]
        lik = np.prod(np.where(y == 1, p, 1 - p), axis=1)
        w = self.weights * lik
        self.weights = w / w.sum()


def load_validation():
    rows = []
    if not VALIDATION.exists():
        return rows
    with open(VALIDATION) as f:
        for n, r in enumerate(csv.DictReader(f), start=2):
            if not any((v or "").strip() for v in r.values()):
                continue
            where = f"{VALIDATION.name} line {n}"
            if not (r.get("citation") or "").strip():
                raise ValueError(f"{where}: every validation row needs a citation (report, table, page)")
            if r["gravity"] not in ("lunar", "martian"):
                raise ValueError(f"{where}: gravity must be lunar or martian")
            if r["outcome_group"] not in GROUPS:
                raise ValueError(f"{where}: outcome_group must be one of {sorted(GROUPS)}")
            rows.append({"id": r["id"], "citation": r["citation"], "gravity": r["gravity"], "o2": float(r["o2_pct"]),
                         "forced": float(r["forced_flow_cm_s"] or 0), "direction": r["flow_direction"] or "concurrent",
                         "material": r["material"], "sustained": 1 if r["outcome_group"] == "sustained" else 0})
    return rows


def validate(ens, rows):
    """Compare the bridge with real partial-gravity rows. With no rows, says so instead of implying a pass."""
    if not rows:
        return {"n": 0, "verdict": "unvalidated", "rows": [], "note": "No partial-gravity results have been added, so the bridge is a hypothesis only."}
    p = ens.prob([r["o2"] for r in rows], [r["forced"] for r in rows], [r["direction"] for r in rows], [r["gravity"] for r in rows])
    out, hits = [], 0
    for j, r in enumerate(rows):
        col = np.sort(p[:, j])
        lo, mid, hi = (float(np.quantile(col, q)) for q in (0.05, 0.5, 0.95))
        agree = (mid >= 0.5) == bool(r["sustained"])
        hits += agree
        out.append({"id": r["id"], "citation": r["citation"], "gravity": r["gravity"], "o2": r["o2"], "forced": r["forced"],
                    "observed_sustained": r["sustained"], "bridge_p": round(mid, 3), "bridge_p90": [round(lo, 3), round(hi, 3)], "agrees": bool(agree)})
    verdict = "agrees" if hits == len(rows) else "partly agrees" if hits else "disagrees"
    return {"n": len(rows), "agree": hits, "verdict": verdict, "rows": out,
            "note": f"{hits} of {len(rows)} real partial-gravity results fall on the same side of 50% as the bridge."}
