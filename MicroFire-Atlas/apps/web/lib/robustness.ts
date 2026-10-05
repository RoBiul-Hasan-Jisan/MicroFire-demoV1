/**
 * Ranking robustness: does an answer survive reasonable changes to MicroFire's own assumptions?
 *
 * The relevance weights, the pressure scale, the partial credit for a similar material and the ladder
 * tolerances are project choices. Here each one is varied over a stated range (a seeded, repeatable
 * sample), and we report how stable each result is. Robustness is reported beside relevance, never merged
 * into it: a high, stable rank means "closest under many reasonable assumptions", not "safe" or "likely".
 */
import type { Experiment, Finding } from "./types";
import { RANK_DEFAULTS, rank, type RankParams, type Scenario } from "./relevance.ts";
import { ladder, TOLERANCE, type EvidenceRecord, type MissionQuestion, type Tolerance } from "./ontology.ts";

export const SAMPLES = 1000;
export const RANGES = {
  weight: [0.75, 1.25], // × each weight
  pressureScaleKpa: [5, 15],
  classCredit: [0.25, 0.75],
  oxygen: [1, 2], // ladder tolerance, percentage points
  pressureKpa: [5, 15],
  flowFraction: [0.3, 0.7],
} as const;

/** mulberry32: small, seeded, repeatable */
export function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const draw = (r: () => number, [lo, hi]: readonly [number, number]) => lo + (hi - lo) * r();
const pct = (xs: number[], q: number) => xs[Math.min(xs.length - 1, Math.floor(q * xs.length))];

export type RankStability = { median: number; lo: number; hi: number; top3: number; level: "High" | "Moderate" | "Low" };

/** Rank stability for every test: median rank, 5th–95th percentile rank range and the share of variations in the top 3. */
export function rankRobustness(exps: Experiment[], s: Scenario, n = SAMPLES, seed = 1): Map<string, RankStability> {
  const r = rng(seed);
  const ranks = new Map<string, number[]>(exps.map((e) => [e.id, []]));
  for (let i = 0; i < n; i++) {
    const w = Object.fromEntries(Object.entries(RANK_DEFAULTS.weights).map(([k, v]) => [k, v * draw(r, RANGES.weight)])) as RankParams["weights"];
    const prm: RankParams = { weights: w, pressureScaleKpa: draw(r, RANGES.pressureScaleKpa), classCredit: draw(r, RANGES.classCredit) };
    rank(exps, s, prm).forEach((x, k) => ranks.get(x.experiment.id)!.push(k + 1));
  }
  const out = new Map<string, RankStability>();
  for (const [id, xs] of ranks) {
    xs.sort((a, b) => a - b);
    const top3 = xs.filter((k) => k <= 3).length / xs.length;
    const lo = pct(xs, 0.05), hi = pct(xs, 0.95);
    // the label describes stability only; the score itself is shown separately
    const level = hi - lo <= 2 ? "High" : hi - lo <= 6 ? "Moderate" : "Low";
    out.set(id, { median: pct(xs, 0.5), lo, hi, top3, level });
  }
  return out;
}

export type LadderStability = {
  n: number;
  directEmpty: number; // share of tolerance variations with no direct evidence
  directCount: [number, number]; // min and max number of direct records
  closest: { id: string; label: string; first: number } | null; // the default closest record, and how often it stays first
  gapDims: Record<string, number>; // how often each gap dimension appears
};

/** Varies the ladder tolerances and reports what stays the same. */
export function ladderRobustness(records: EvidenceRecord[], findings: Finding[], q: MissionQuestion, n = SAMPLES, seed = 7): LadderStability {
  const base = ladder(records, findings, q, TOLERANCE);
  const top = (base.direct[0] ?? base.analogous[0])?.record ?? null;
  const r = rng(seed);
  let empty = 0, first = 0, lo = Infinity, hi = 0;
  const dims: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const tol: Tolerance = { oxygen: draw(r, RANGES.oxygen), pressureKpa: draw(r, RANGES.pressureKpa), flowFraction: draw(r, RANGES.flowFraction) };
    const l = ladder(records, [], q, tol);
    if (!l.direct.length) empty++;
    lo = Math.min(lo, l.direct.length); hi = Math.max(hi, l.direct.length);
    if (top && (l.direct[0] ?? l.analogous[0])?.record.id === top.id) first++;
    for (const g of l.gaps) dims[g.dim] = (dims[g.dim] ?? 0) + 1 / n;
  }
  return { n, directEmpty: empty / n, directCount: [lo, hi], closest: top && { id: top.id, label: top.label, first: first / n }, gapDims: dims };
}
