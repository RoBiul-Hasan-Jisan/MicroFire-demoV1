/**
 * What-if engine: counterfactual scenarios, intervention comparison and an evidence-weighted envelope.
 *
 * Built on the AI Model Lab so it inherits every guardrail: the domain gate decides whether a number may exist at all,
 * and a blocked state is a normal result, never an error.
 *
 * What the number means: the model's target is "a flame was established after the ignition attempt" in a BASS-II-style
 * ISS glovebox test. It is NOT a fire-risk probability, a hazard rating or advice. A lower estimate means fewer of the
 * NASA tests nearby established a flame, not that a cabin is safer. Nothing here ranks what a crew should do.
 *
 * Everything is pure and deterministic, so the page and the tests compute the same numbers.
 */
import { gate, LOCAL, predict, type Check, type Neighbor, type Prediction, type Query, type Snapshot, type Status } from "./model-lab.ts";

/* ---------------------------------------------------------------- evidence-weighted envelope */

/** supported: in domain. sparse: near domain (just outside the tested range). blocked: no number may be shown. */
export type Tier = "supported" | "sparse" | "blocked";

/** 90 % Wilson score interval for a proportion k/n. With n = 0 it is the whole range: no records, no information. */
export function wilson(k: number, n: number, z = 1.645): [number, number] {
  if (n === 0) return [0, 1];
  const p = k / n, d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

export type Envelope = {
  tier: Tier;
  /** Model estimate; null when blocked. */
  p: number | null;
  /** Union of the model's bootstrap interval and the local-record interval: never narrower than either. */
  lo: number | null;
  hi: number | null;
  /** Same-material tests within ±LOCAL.o2 pp oxygen and ±LOCAL.flow cm/s. */
  support: number;
  /** Of those, how many established a flame. */
  established: number;
  modelInterval: [number, number] | null;
  localInterval: [number, number] | null;
};

/** Same-material rows inside the gate's local window around a query. */
export function localRows(s: Snapshot, q: Query) {
  return s.rows.filter((r) => r.material === q.material && Math.abs(r.o2 - q.o2) <= LOCAL.o2 && Math.abs(r.flow - q.flow) <= LOCAL.flow);
}

export function envelope(s: Snapshot, q: Query, status: Status, pred: Prediction | null): Envelope {
  const near = localRows(s, q);
  const k = near.filter((r) => r.y === 1).length;
  if (!pred) return { tier: "blocked", p: null, lo: null, hi: null, support: near.length, established: k, modelInterval: null, localInterval: null };
  const local = wilson(k, near.length);
  return {
    tier: status === "in" ? "supported" : "sparse",
    p: pred.p,
    lo: Math.min(pred.lo, local[0]),
    hi: Math.max(pred.hi, local[1]),
    support: near.length,
    established: k,
    modelInterval: [pred.lo, pred.hi],
    localInterval: local,
  };
}

/* ---------------------------------------------------------------- one scenario */

export type Side = {
  q: Query;
  status: Status;
  checks: Check[];
  neighbors: Neighbor[];
  pred: Prediction | null;
  env: Envelope;
};

export function evaluateSide(s: Snapshot, q: Query): Side {
  const g = gate(s, q);
  const pred = predict(s, q);
  return { q, status: g.status, checks: g.checks, neighbors: g.neighbors, pred, env: envelope(s, q, g.status, pred) };
}

/* ---------------------------------------------------------------- counterfactual */

export const DIM_LABEL: Record<keyof Query, string> = { material: "Material", gravity: "Gravity", o2: "Oxygen", kpa: "Pressure", flow: "Airflow" };

export type WhatIf = {
  base: Side;
  modified: Side;
  changed: (keyof Query)[];
  /** Present only when BOTH states may receive a number. */
  delta: null | {
    /** Percentage points, modified minus base. */
    pp: number;
    /** Log-odds shift per model feature, modified minus base (exact for the linear model). */
    byFeature: { feature: string; from: string; to: string; logOdds: number }[];
    /** true when the two envelopes do not overlap: the difference is larger than the stated uncertainty. */
    distinguishable: boolean;
  };
  /** Plain-language reading, always bounded. */
  reading: string;
};

export function whatIf(s: Snapshot, base: Query, change: Partial<Query>): WhatIf {
  const mod: Query = { ...base, ...change };
  const changed = (Object.keys(DIM_LABEL) as (keyof Query)[]).filter((k) => base[k] !== mod[k]);
  const a = evaluateSide(s, base), b = evaluateSide(s, mod);

  let delta: WhatIf["delta"] = null;
  if (a.pred && b.pred) {
    const lo = Math.max(a.env.lo!, b.env.lo!), hi = Math.min(a.env.hi!, b.env.hi!);
    delta = {
      pp: (b.pred.p - a.pred.p) * 100,
      distinguishable: lo > hi,
      byFeature: a.pred.contributions.map((c, i) => ({
        feature: c.feature, from: c.value, to: b.pred!.contributions[i].value, logOdds: b.pred!.contributions[i].logOdds - c.logOdds,
      })).filter((f) => f.from !== f.to),
    };
  }

  let reading: string;
  if (changed.length === 0) reading = "Nothing has been changed yet. Move one control in the modified scenario.";
  else if (!a.pred && !b.pred) reading = "Neither scenario is inside the tested conditions, so no estimate exists for either. The closest NASA tests are listed instead.";
  else if (!a.pred) reading = "The starting scenario is outside the tested conditions, so there is nothing to compare against. A change cannot be measured from an unknown start.";
  else if (!b.pred) reading = "The modified scenario leaves the conditions NASA tested, so the model blocks it. This is the point where the evidence stops: the comparison ends here, it does not continue as a guess.";
  else if (!delta!.distinguishable)
    reading = `The estimate moves ${Math.abs(delta!.pp).toFixed(0)} percentage points, but the two uncertainty envelopes overlap. The tests cannot distinguish these two scenarios.`;
  else
    reading = `The estimate moves ${Math.abs(delta!.pp).toFixed(0)} percentage points ${delta!.pp < 0 ? "down" : "up"}, and the envelopes do not overlap. This describes how often nearby NASA tests established a flame, not how safe a cabin is.`;

  return { base: a, modified: b, changed, delta, reading };
}

/* ---------------------------------------------------------------- interventions */

export type Evidence = { source_id: string; pdf_page: number; text: string };

export type Lever =
  | { id: string; label: string; kind: "modelled"; change: Partial<Query>; result: WhatIf; caveat?: string }
  | { id: string; label: string; kind: "records"; change: Partial<Query>; modified: Side; support: number; established: number; interval: [number, number] | null; why: string }
  | { id: string; label: string; kind: "gap"; why: string; evidence: Evidence[] };

/**
 * Conditions-change levers compared against the same starting scenario.
 * - modelled: oxygen levers, because oxygen is the one condition the deployed model uses.
 * - records: airflow levers. The deployed model does not use airflow (it did not improve held-out scores), so the only
 *   honest number is the raw rate among nearby NASA tests, with its count and interval.
 * - gap: levers no NASA test in this atlas varies for solid fuels. They are listed so the absence is visible.
 */
export function interventions(s: Snapshot, base: Query, pressureStated: { n: number; of: number }): Lever[] {
  const out: Lever[] = [];
  for (const d of [-4, -2, 2]) {
    const o2 = Math.round((base.o2 + d) * 10) / 10;
    out.push({ id: `o2${d > 0 ? "+" : ""}${d}`, label: `Oxygen ${d > 0 ? "+" : "−"}${Math.abs(d)} pp (${o2} %)`, kind: "modelled", change: { o2 }, result: whatIf(s, base, { o2 }) });
  }
  // Material replacement: only materials the model was trained on can be compared. Fabric vs solid PMMA are different sample
  // types (geometry, thickness, burn-down), so this is a comparison of NASA test samples, not a like-for-like substitution.
  for (const m of Object.keys(s.domain)) {
    if (m === base.material) continue;
    out.push({
      id: `material-${m}`, label: `Material: ${m}`, kind: "modelled", change: { material: m }, result: whatIf(s, base, { material: m }),
      caveat: "Different sample types (fabric vs solid): a comparison of NASA test samples, not a like-for-like swap.",
    });
  }
  for (const [id, label, f] of [["flow-half", "Airflow halved", base.flow / 2], ["flow-double", "Airflow doubled", base.flow * 2]] as const) {
    const flow = Math.round(f * 10) / 10;
    const mod: Query = { ...base, flow };
    const side = evaluateSide(s, mod);
    const near = localRows(s, mod), k = near.filter((r) => r.y === 1).length;
    out.push({
      id, label: `${label} (${flow} cm/s)`, kind: "records", change: { flow }, modified: side, support: near.length, established: k,
      interval: near.length >= LOCAL.min ? wilson(k, near.length) : null,
      why: near.length >= LOCAL.min
        ? `${near.length} ${base.material} tests lie within ±${LOCAL.o2} pp oxygen and ±${LOCAL.flow} cm/s of this airflow; ${k} established a flame. NASA's BASS thickness study (PDF p. 54) also found flames especially sensitive to airflow between 0 and 5 cm/s.`
        : `Only ${near.length} ${base.material} test${near.length === 1 ? "" : "s"} near these conditions; at least ${LOCAL.min} are needed, so no rate is shown.`,
    });
  }
  out.push(
    {
      id: "suppressant", label: "Add a suppressant (CO₂, helium, SF₆)", kind: "gap",
      why: "No solid-fuel test in this atlas varies a suppressant. The only suppressant-dilution evidence is NASA's FLEX droplet work, a different fuel and regime, kept as mechanism only. Nothing is estimated.",
      evidence: [{ source_id: "flex", pdf_page: 8, text: "FLEX burned droplets in oxidizers diluted with nitrogen, carbon dioxide and mixtures (droplets, not solid fuel)." }],
    },
    {
      id: "pressure", label: "Reduce cabin pressure", kind: "gap",
      why: `Pressure is stated for only ${pressureStated.n} of ${pressureStated.of} usable tests, and those tests are Saffire runs and SIBAL at 1 atm. A pressure check on the data returns "cannot tell". Nothing is estimated.`,
      evidence: [{ source_id: "saffire-4-5", pdf_page: 7, text: "Saffire quiescent-extinguishment finding: extinguishment at increased oxygen cannot be assumed to be rapid." }],
    },
    {
      id: "isolate", label: "Isolate the compartment", kind: "gap",
      why: "No NASA test in this atlas varies compartment isolation or ventilation shut-off, and it is not an experiment variable here. Nothing is estimated.",
      evidence: [],
    },
  );
  const rank = (l: Lever) => (l.kind === "modelled" ? (l.result.delta ? 0 : 1) : l.kind === "records" ? 2 : 3);
  const mag = (l: Lever) => (l.kind === "modelled" && l.result.delta ? -Math.abs(l.result.delta.pp) : l.kind === "records" ? -l.support : 0);
  return out.sort((x, y) => rank(x) - rank(y) || mag(x) - mag(y));
}

/* ---------------------------------------------------------------- coverage grid */

export type Cell = { o2: number; flow: number; support: number; tier: "supported" | "sparse" | "empty" };

/** Evidence coverage on an oxygen × airflow grid for one material, using the same window the gate uses. */
export function coverage(s: Snapshot, material: string, o2Range: [number, number], flowRange: [number, number], nx = 24, ny = 12): Cell[] {
  const cells: Cell[] = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const o2 = o2Range[0] + ((o2Range[1] - o2Range[0]) * (i + 0.5)) / nx;
    const flow = flowRange[0] + ((flowRange[1] - flowRange[0]) * (j + 0.5)) / ny;
    const support = localRows(s, { material, gravity: "microgravity", o2, kpa: 101.3, flow }).length;
    cells.push({ o2, flow, support, tier: support >= LOCAL.min ? "supported" : support > 0 ? "sparse" : "empty" });
  }
  return cells;
}

/* ---------------------------------------------------------------- partial dependence */

export type SweepPoint = { o2: number; status: Status; p: number | null; lo: number | null; hi: number | null; tier: Tier };

/**
 * Partial dependence on oxygen: the estimate as oxygen alone varies, every other condition held at the query.
 * A point exists only where the domain gate allows a number; blocked points carry null so a chart leaves a visible break
 * where the evidence stops instead of drawing a line through it. This is how the MODEL responds, not a physical law.
 */
export function sweepO2(s: Snapshot, q: Query, from = 14, to = 31, step = 0.5): SweepPoint[] {
  const out: SweepPoint[] = [];
  for (let o2 = from; o2 <= to + 1e-9; o2 += step) {
    const x = Math.round(o2 * 10) / 10, side = evaluateSide(s, { ...q, o2: x });
    out.push({ o2: x, status: side.status, p: side.env.p, lo: side.env.lo, hi: side.env.hi, tier: side.env.tier });
  }
  return out;
}

/* ---------------------------------------------------------------- similarity */

/**
 * Similarity of a NASA test to a query, 0 to 1. A MicroFire heuristic, not a probability and not a NASA measure:
 * 1 / (1 + distance), where distance is the oxygen and airflow gap in training standard deviations, halved when the
 * material differs. 100 % means the same material at the same oxygen and airflow.
 */
export function similarity(q: Query, n: Neighbor): number {
  return (n.row.material === q.material ? 1 : 0.5) / (1 + n.distance);
}
