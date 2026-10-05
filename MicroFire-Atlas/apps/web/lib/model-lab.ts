/**
 * AI Model Lab: an evidence-bounded classifier trained on NASA BASS/BASS-II test records.
 *
 * Target: was a flame established after the ignition attempt (yes/no), coded from NASA's verbatim test-table
 * comments. It is NOT the final outcome. Most "went out" runs in BASS-II were driven to extinction on purpose by
 * turning the fan down, so that label records the test procedure, not a property of the starting conditions.
 *
 * Everything here is pure and seeded: the page, the tests and `npm run model-lab` compute the same numbers.
 * The gate decides whether a query may receive a prediction at all; abstention is a normal result.
 */
import type { Experiment } from "./types";
import { rng } from "./robustness.ts";

export const MODEL_VERSION = "flame-established v1.0";
export const TARGET =
  "Probability that a flame is established after the ignition attempt in a BASS-II-style ISS glovebox test, as coded from NASA's test-table comments";

export const MODEL_MATERIALS = ["SIBAL fabric", "PMMA"] as const;
export type ModelMaterial = (typeof MODEL_MATERIALS)[number];
/** Outcomes coded as "no flame established": never ignited, or only a brief flash that did not spread. */
const NOT_ESTABLISHED = new Set(["not_ignited", "no_sustained_flame"]);

export type Row = {
  id: string;
  test: string;
  material: ModelMaterial;
  o2: number;
  flow: number;
  y: 0 | 1;
  session: string;
  outcome: string;
  cite: { source_id: string; pdf_page: number; where: string };
};
export type Excluded = { id: string; test: string; material: string; reason: string };

export function buildDataset(exps: Experiment[]) {
  const rows: Row[] = [];
  const excluded: Excluded[] = [];
  for (const e of exps) {
    const reason = !(MODEL_MATERIALS as readonly string[]).includes(e.material)
      ? `${e.material}: every test in this family failed to sustain a flame, so a model cannot learn how conditions change the outcome`
      : e.quality_flags.includes("reused_sample")
        ? "Reused, partly burned sample: NASA notes these give less quantitative data, and reuse changes ignition"
        : e.quality_flags.includes("o2_reading_suspect")
          ? "NASA marks the oxygen reading as possibly inaccurate"
          : e.oxygen_vol_pct == null || e.flow_initial_cm_s == null
            ? "Oxygen or starting airflow not stated"
            : null;
    if (reason) {
      excluded.push({ id: e.id, test: e.test_id, material: e.material, reason });
      continue;
    }
    const r = e.provenance.record;
    rows.push({
      id: e.id,
      test: e.test_id,
      material: e.material as ModelMaterial,
      o2: e.oxygen_vol_pct!,
      flow: e.flow_initial_cm_s!,
      y: NOT_ESTABLISHED.has(e.outcome) ? 0 : 1,
      // SIBAL test IDs carry the GMT day (one crew session); PMMA IDs carry none, so each PMMA run is its own group.
      session: e.test_id.includes("-") ? e.test_id.split("-")[0] : e.test_id,
      outcome: e.outcome_label,
      cite: { source_id: r.source_id, pdf_page: r.pdf_page, where: r.table ?? "test table" },
    });
  }
  return { rows, excluded };
}

/* ---------------------------------------------------------------- models */

export type FeatureSet = "o2+material" | "o2+flow+material" | "o2";
const FEATURE_NAMES: Record<FeatureSet, string[]> = {
  "o2+material": ["Oxygen (%)", "Material is PMMA"],
  "o2+flow+material": ["Oxygen (%)", "Starting airflow (cm/s)", "Material is PMMA"],
  o2: ["Oxygen (%)"],
};
type X = { o2: number; flow: number; material: string };
const feats = (r: X, fs: FeatureSet) =>
  fs === "o2" ? [r.o2] : fs === "o2+material" ? [r.o2, r.material === "PMMA" ? 1 : 0] : [r.o2, r.flow, r.material === "PMMA" ? 1 : 0];

export type Logit = { mu: number[]; sd: number[]; w: number[]; b: number };
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

/** Solve A x = v by Gaussian elimination (A is tiny and positive definite). */
function solve(A: number[][], v: number[]) {
  const n = v.length, M = A.map((row, i) => [...row, v[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) x[r] = (M[r][n] - M[r].slice(r + 1, n).reduce((s, a, k) => s + a * x[r + 1 + k], 0)) / M[r][r];
  return x;
}

/** L2-regularised logistic regression on standardised features (intercept not penalised), fitted by Newton's method. */
export function fitLogit(X: number[][], y: number[], lambda = LAMBDA): Logit {
  const d = X[0].length;
  const mu = Array.from({ length: d }, (_, j) => X.reduce((s, x) => s + x[j], 0) / X.length);
  const sd = mu.map((m, j) => Math.sqrt(X.reduce((s, x) => s + (x[j] - m) ** 2, 0) / X.length) || 1);
  const Z = X.map((x) => [1, ...x.map((v, j) => (v - mu[j]) / sd[j])]);
  let beta = new Array(d + 1).fill(0);
  for (let it = 0; it < 50; it++) {
    const g = new Array(d + 1).fill(0), H = Array.from({ length: d + 1 }, () => new Array(d + 1).fill(0));
    Z.forEach((z, i) => {
      const p = sigmoid(z.reduce((s, v, k) => s + v * beta[k], 0)), wt = p * (1 - p);
      for (let a = 0; a <= d; a++) {
        g[a] += (p - y[i]) * z[a];
        for (let c = 0; c <= d; c++) H[a][c] += wt * z[a] * z[c];
      }
    });
    for (let a = 1; a <= d; a++) { g[a] += lambda * beta[a]; H[a][a] += lambda; }
    const step = solve(H, g);
    beta = beta.map((b, k) => b - step[k]);
    if (Math.max(...step.map(Math.abs)) < 1e-9) break;
  }
  return { mu, sd, b: beta[0], w: beta.slice(1) };
}
export const logitP = (m: Logit, x: number[]) => sigmoid(m.b + x.reduce((s, v, j) => s + (m.w[j] * (v - m.mu[j])) / m.sd[j], 0));

/** CART on Gini impurity, depth-limited; leaves hold a Laplace-smoothed rate so probabilities are never 0 or 1. */
type Node = { p: number } | { f: number; t: number; l: Node; r: Node };
function grow(X: number[][], y: number[], idx: number[], depth: number, pick: () => number[]): Node {
  const pos = idx.reduce((s, i) => s + y[i], 0), p = (pos + 1) / (idx.length + 2);
  if (depth === 0 || pos === 0 || pos === idx.length || idx.length < 4) return { p };
  const gini = (ids: number[]) => { const q = ids.reduce((s, i) => s + y[i], 0) / ids.length; return ids.length * 2 * q * (1 - q); };
  let best: { f: number; t: number; g: number } | null = null;
  for (const f of pick()) {
    const vals = [...new Set(idx.map((i) => X[i][f]))].sort((a, b) => a - b);
    for (let k = 1; k < vals.length; k++) {
      const t = (vals[k - 1] + vals[k]) / 2, L = idx.filter((i) => X[i][f] <= t), R = idx.filter((i) => X[i][f] > t);
      if (L.length < 2 || R.length < 2) continue;
      const g = gini(L) + gini(R);
      if (!best || g < best.g - 1e-12) best = { f, t, g };
    }
  }
  if (!best || best.g >= gini(idx) - 1e-12) return { p };
  return { f: best.f, t: best.t, l: grow(X, y, idx.filter((i) => X[i][best.f] <= best.t), depth - 1, pick), r: grow(X, y, idx.filter((i) => X[i][best.f] > best.t), depth - 1, pick) };
}
const treeP = (n: Node, x: number[]): number => ("p" in n ? n.p : treeP(x[n.f] <= n.t ? n.l : n.r, x));

export type ModelId = "baseline" | "logit-o2-material" | "logit-o2-flow-material" | "tree-depth2" | "forest";
export const MODELS: { id: ModelId; name: string; complexity: number; fs: FeatureSet }[] = [
  { id: "baseline", name: "Majority-rate baseline (no features)", complexity: 0, fs: "o2+material" },
  { id: "logit-o2-material", name: "Regularised logistic regression: oxygen + material", complexity: 1, fs: "o2+material" },
  { id: "logit-o2-flow-material", name: "Regularised logistic regression: oxygen + airflow + material", complexity: 2, fs: "o2+flow+material" },
  { id: "tree-depth2", name: "Decision tree, depth 2", complexity: 3, fs: "o2+flow+material" },
  { id: "forest", name: "Random forest, 200 depth-2 trees", complexity: 4, fs: "o2+flow+material" },
];
export const LAMBDA = 1;

type Predictor = (x: X) => number;
export function train(id: ModelId, rows: Row[], seed = 11): Predictor {
  const fs = MODELS.find((m) => m.id === id)!.fs;
  const X = rows.map((r) => feats(r, fs)), y = rows.map((r): number => r.y);
  if (id === "baseline") { const p = (y.reduce((s, v) => s + v, 0) + 1) / (y.length + 2); return () => p; }
  if (id.startsWith("logit")) { const m = fitLogit(X, y); return (x) => logitP(m, feats(x, fs)); }
  const all = X[0].map((_, j) => j);
  if (id === "tree-depth2") { const t = grow(X, y, X.map((_, i) => i), 2, () => all); return (x) => treeP(t, feats(x, fs)); }
  const r = rng(seed), trees: Node[] = [];
  for (let k = 0; k < 200; k++) {
    const boot = X.map(() => Math.floor(r() * X.length));
    trees.push(grow(X, y, boot, 2, () => [...all].sort(() => r() - 0.5).slice(0, 2)));
  }
  return (x) => trees.reduce((s, t) => s + treeP(t, feats(x, fs)), 0) / trees.length;
}

/* ---------------------------------------------------------------- metrics */

export type Metrics = {
  n: number; accuracy: number; balancedAccuracy: number;
  /** precision / recall / F1 for the minority class, "no flame established" */
  precision: number | null; recall: number; f1: number | null;
  auc: number | null; brier: number; logLoss: number;
  confusion: { tp: number; fn: number; fp: number; tn: number }; // positive = flame established
};
export function metrics(p: number[], y: number[]): Metrics {
  let tp = 0, fn = 0, fp = 0, tn = 0;
  p.forEach((v, i) => { const hat = v >= 0.5 ? 1 : 0; if (y[i] && hat) tp++; else if (y[i]) fn++; else if (hat) fp++; else tn++; });
  const pos = tp + fn, neg = tn + fp;
  const tpr = pos ? tp / pos : 0, tnr = neg ? tn / neg : 0;
  const precision = tn + fn ? tn / (tn + fn) : null, recall = tnr;
  const f1 = precision == null || precision + recall === 0 ? null : (2 * precision * recall) / (precision + recall);
  let auc: number | null = null;
  if (pos && neg) {
    let s = 0;
    p.forEach((a, i) => { if (y[i]) p.forEach((b, j) => { if (!y[j]) s += a > b ? 1 : a === b ? 0.5 : 0; }); });
    auc = s / (pos * neg);
  }
  const brier = p.reduce((s, v, i) => s + (v - y[i]) ** 2, 0) / p.length;
  const logLoss = -p.reduce((s, v, i) => { const q = Math.min(1 - 1e-6, Math.max(1e-6, v)); return s + (y[i] ? Math.log(q) : Math.log(1 - q)); }, 0) / p.length;
  return { n: p.length, accuracy: (tp + tn) / p.length, balancedAccuracy: (tpr + tnr) / 2, precision, recall, f1, auc, brier, logLoss, confusion: { tp, fn, fp, tn } };
}

const pct = (xs: number[], q: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]; };
export type Interval = { est: number; lo: number; hi: number };

/** Percentile bootstrap over out-of-fold predictions: resample records, recompute the metric. */
function bootCI(p: number[], y: number[], get: (m: Metrics) => number | null, n = 1000, seed = 5): Interval | null {
  const est = get(metrics(p, y));
  if (est == null) return null;
  const r = rng(seed), vals: number[] = [];
  for (let k = 0; k < n; k++) {
    const idx = p.map(() => Math.floor(r() * p.length));
    const v = get(metrics(idx.map((i) => p[i]), idx.map((i) => y[i])));
    if (v != null && Number.isFinite(v)) vals.push(v);
  }
  return { est, lo: pct(vals, 0.025), hi: pct(vals, 0.975) };
}

/* ---------------------------------------------------------------- validation */

/** Stratified k-fold: each class shuffled with a seeded RNG and dealt round-robin. */
function stratifiedFolds(y: number[], k: number, seed: number) {
  const r = rng(seed), fold = new Array(y.length).fill(0);
  for (const cls of [0, 1]) {
    const ids = y.map((v, i) => (v === cls ? i : -1)).filter((i) => i >= 0).sort(() => r() - 0.5);
    ids.forEach((i, j) => (fold[i] = j % k));
  }
  return fold;
}
function oof(id: ModelId, rows: Row[], fold: number[]) {
  const p = new Array(rows.length).fill(0);
  for (const f of new Set(fold)) {
    const tr = rows.filter((_, i) => fold[i] !== f), m = train(id, tr);
    rows.forEach((r, i) => { if (fold[i] === f) p[i] = m(r); });
  }
  return p;
}

export const REPEATS = 25;
export const FOLDS = 4;
export type Evaluation = {
  id: ModelId; name: string; complexity: number;
  repeated: { balancedAccuracy: Interval; brier: Interval; auc: Interval | null }; // spread across repeats
  grouped: Metrics & { ci: { balancedAccuracy: Interval | null; brier: Interval | null; auc: Interval | null } };
  calibration: { bin: string; n: number; meanP: number; observed: number }[];
};

export function evaluate(rows: Row[]): Evaluation[] {
  const y = rows.map((r) => r.y);
  const sessions = [...new Set(rows.map((r) => r.session))];
  const groupFold = rows.map((r) => sessions.indexOf(r.session));
  return MODELS.map((m) => {
    const reps = Array.from({ length: REPEATS }, (_, k) => metrics(oof(m.id, rows, stratifiedFolds(y, FOLDS, 100 + k)), y));
    const spread = (get: (x: Metrics) => number | null): Interval | null => {
      const v = reps.map(get).filter((x): x is number => x != null);
      return v.length ? { est: v.reduce((s, x) => s + x, 0) / v.length, lo: pct(v, 0.025), hi: pct(v, 0.975) } : null;
    };
    const p = oof(m.id, rows, groupFold);
    // A constant predictor has no ranking; its fold-to-fold rate shifts would fake an AUC, so none is reported.
    const g = { ...metrics(p, y), ...(m.id === "baseline" ? { auc: null } : {}) };
    const bins: [string, number, number][] = [["below 0.5", 0, 0.5], ["0.5 to 0.8", 0.5, 0.8], ["0.8 and above", 0.8, 1.01]];
    return {
      id: m.id, name: m.name, complexity: m.complexity,
      repeated: { balancedAccuracy: spread((x) => x.balancedAccuracy)!, brier: spread((x) => x.brier)!, auc: m.id === "baseline" ? null : spread((x) => x.auc) },
      grouped: { ...g, ci: { balancedAccuracy: bootCI(p, y, (x) => x.balancedAccuracy), brier: bootCI(p, y, (x) => x.brier), auc: m.id === "baseline" ? null : bootCI(p, y, (x) => x.auc) } },
      calibration: bins.map(([bin, lo, hi]) => {
        const ids = p.map((v, i) => (v >= lo && v < hi ? i : -1)).filter((i) => i >= 0);
        return { bin, n: ids.length, meanP: ids.length ? ids.reduce((s, i) => s + p[i], 0) / ids.length : 0, observed: ids.length ? ids.reduce((s, i) => s + y[i], 0) / ids.length : 0 };
      }),
    };
  });
}

/** Leave-one-material-out: oxygen-only logistic trained on one material, scored on the other. */
export function materialTransfer(rows: Row[]) {
  return MODEL_MATERIALS.map((held) => {
    const tr = rows.filter((r) => r.material !== held), te = rows.filter((r) => r.material === held);
    const m = fitLogit(tr.map((r) => [r.o2]), tr.map((r) => r.y));
    const mt = metrics(te.map((r) => logitP(m, [r.o2])), te.map((r) => r.y));
    return { held, trainN: tr.length, testN: te.length, testNegatives: te.filter((r) => !r.y).length, ...mt };
  });
}

/**
 * Deployment rule. The Lab outputs probabilities, never classes, so the rule uses proper scores: a model must beat
 * the baseline on grouped-CV Brier score AND log loss, and the lower end of its grouped-CV AUC 95 % interval must be
 * above 0.5. Among those, take the simplest one whose Brier score is within 0.01 of the best. If none qualifies,
 * deploy nothing. (A first draft also required balanced accuracy at a 0.5 cut-off; at 10 % prevalence that cut-off
 * is arbitrary and no logistic model ever crosses it. Under that draft rule the depth-2 tree would have been chosen.
 * The Model Card states this.)
 */
export const DRAFT_RULE_PICK: ModelId = "tree-depth2";
export function chooseModel(evals: Evaluation[]): ModelId | null {
  const base = evals.find((e) => e.id === "baseline")!;
  const ok = evals.filter((e) => e.id !== "baseline" && e.grouped.brier < base.grouped.brier && e.grouped.logLoss < base.grouped.logLoss && (e.grouped.ci.auc?.lo ?? 0) > 0.5);
  if (!ok.length) return null;
  const best = Math.min(...ok.map((e) => e.grouped.brier));
  return ok.filter((e) => e.grouped.brier <= best + 0.01).sort((a, b) => a.complexity - b.complexity)[0].id;
}

/* ---------------------------------------------------------------- deployed model */

export const BOOTSTRAPS = 200;
export type Snapshot = {
  version: string;
  modelId: "logit-o2-material" | "logit-o2-flow-material";
  fs: FeatureSet;
  features: string[];
  model: Logit;
  boot: Logit[];
  rows: Row[];
  domain: Record<ModelMaterial, { o2: [number, number]; flow: [number, number]; n: number; negatives: number }>;
};

/** Fit the chosen logistic model on every usable record, plus a stratified bootstrap ensemble for the interval. */
export function snapshot(rows: Row[], modelId: Snapshot["modelId"]): Snapshot {
  const fs = MODELS.find((m) => m.id === modelId)!.fs;
  const X = rows.map((r) => feats(r, fs)), y = rows.map((r) => r.y);
  const r = rng(29), pos = rows.flatMap((x, i) => (x.y ? [i] : [])), neg = rows.flatMap((x, i) => (x.y ? [] : [i]));
  const boot = Array.from({ length: BOOTSTRAPS }, () => {
    const idx = [...pos.map(() => pos[Math.floor(r() * pos.length)]), ...neg.map(() => neg[Math.floor(r() * neg.length)])];
    return fitLogit(idx.map((i) => X[i]), idx.map((i) => y[i]));
  });
  const domain = Object.fromEntries(MODEL_MATERIALS.map((mat) => {
    const m = rows.filter((x) => x.material === mat);
    return [mat, { o2: [Math.min(...m.map((x) => x.o2)), Math.max(...m.map((x) => x.o2))], flow: [Math.min(...m.map((x) => x.flow)), Math.max(...m.map((x) => x.flow))], n: m.length, negatives: m.filter((x) => !x.y).length }];
  })) as Snapshot["domain"];
  // Six decimals is far below any displayed precision and keeps the page payload small.
  const r6 = (m: Logit): Logit => { const q = (x: number) => Math.round(x * 1e6) / 1e6; return { mu: m.mu.map(q), sd: m.sd.map(q), w: m.w.map(q), b: q(m.b) }; };
  return { version: MODEL_VERSION, modelId, fs, features: FEATURE_NAMES[fs], model: r6(fitLogit(X, y)), boot: boot.map(r6), rows, domain };
}

/* ---------------------------------------------------------------- domain gate */

export type GravityChoice = "microgravity" | "lunar" | "martian" | "earth";
export type Query = { material: string; gravity: GravityChoice; o2: number; kpa: number; flow: number };
export type Status = "in" | "near" | "out" | "insufficient";
export const STATUS_LABEL: Record<Status, string> = { in: "In domain", near: "Near domain", out: "Out of domain", insufficient: "Insufficient evidence" };
export type Check = { dim: string; status: Status; text: string };
export type Neighbor = { row: Row; dO2: number; dFlow: number; distance: number };

/** Margins outside the training range that still count as "near"; beyond them the query is out of domain. */
export const NEAR = { o2: 1.0, flow: 2.0 } as const;
/** ISS cabin pressure: SIBAL runs state 1 atm; PMMA runs state no pressure. */
export const PRESSURE_DOMAIN: [number, number] = [96.3, 106.3];
/** A query needs at least this many same-material tests within ±LOCAL.o2 pp and ±LOCAL.flow cm/s. */
export const LOCAL = { o2: 1.0, flow: 3.0, min: 3 } as const;

const fmtR = ([a, b]: [number, number], u: string) => `${a}–${b} ${u}`;

export function gate(s: Snapshot, q: Query): { status: Status; checks: Check[]; neighbors: Neighbor[]; support: number } {
  const checks: Check[] = [];
  const range = (dim: string, v: number, [lo, hi]: [number, number], near: number, u: string) => {
    const off = v < lo ? lo - v : v > hi ? v - hi : 0;
    checks.push(off === 0
      ? { dim, status: "in", text: `${v} ${u} is inside the training range (${fmtR([lo, hi], u)})` }
      : off <= near
        ? { dim, status: "near", text: `${v} ${u} is ${off.toFixed(1)} ${u} outside the training range (${fmtR([lo, hi], u)})` }
        : { dim, status: "out", text: `${v} ${u} is outside the training range (${fmtR([lo, hi], u)}) by ${off.toFixed(1)} ${u}` });
  };

  checks.push(q.gravity === "microgravity"
    ? { dim: "Gravity", status: "in", text: "Microgravity: every training test burned aboard the ISS" }
    : { dim: "Gravity", status: "out", text: q.gravity === "lunar"
        ? "Lunar gravity is outside the training domain. The atlas's only lunar-g records are 2 LUCI burns, simulated on a spinning rocket, and they are a different experiment"
        : q.gravity === "martian" ? "Martian gravity is outside the training domain. No record in the atlas burned in Mars gravity"
        : "Earth gravity is outside the training domain. Buoyancy changes the flame, and no 1-g test is in the training set" });

  const mat = q.material as ModelMaterial;
  const known = (MODEL_MATERIALS as readonly string[]).includes(q.material);
  checks.push(known
    ? { dim: "Material", status: "in", text: `${q.material}: ${s.domain[mat].n} training tests, ${s.domain[mat].negatives} without an established flame` }
    : q.material === "Nomex"
      ? { dim: "Material", status: "insufficient", text: "Nomex: all 3 BASS-II tests failed to sustain a flame. With one outcome, no model can learn how conditions change it" }
      : { dim: "Material", status: "out", text: `${q.material}: no training tests. The leave-one-material-out test shows the model does not transfer between materials` });

  const pIn = q.kpa >= PRESSURE_DOMAIN[0] && q.kpa <= PRESSURE_DOMAIN[1];
  checks.push(pIn
    ? { dim: "Pressure", status: "in", text: `${q.kpa} kPa is ISS-cabin pressure (SIBAL tests state 1 atm; PMMA tests state no pressure)` }
    : { dim: "Pressure", status: "out", text: `${q.kpa} kPa is outside the training domain: SIBAL tests state 1 atm (101.3 kPa) and PMMA tests state no pressure` });

  let neighbors: Neighbor[] = [], support = 0;
  if (known) {
    range("Oxygen", q.o2, s.domain[mat].o2, NEAR.o2, "%");
    range("Airflow", q.flow, s.domain[mat].flow, NEAR.flow, "cm/s");
    const same = s.rows.filter((r) => r.material === mat);
    support = same.filter((r) => Math.abs(r.o2 - q.o2) <= LOCAL.o2 && Math.abs(r.flow - q.flow) <= LOCAL.flow).length;
    if (checks.every((c) => c.status !== "out"))
      checks.push(support >= LOCAL.min
        ? { dim: "Local support", status: "in", text: `${support} ${q.material} tests lie within ±${LOCAL.o2} pp oxygen and ±${LOCAL.flow} cm/s airflow` }
        : { dim: "Local support", status: "insufficient", text: `Only ${support} ${q.material} test${support === 1 ? "" : "s"} within ±${LOCAL.o2} pp oxygen and ±${LOCAL.flow} cm/s airflow; at least ${LOCAL.min} are required` });
    neighbors = nearest(s, q);
  } else neighbors = nearest(s, q);

  const worst = (["out", "insufficient", "near", "in"] as Status[]).find((st) => checks.some((c) => c.status === st))!;
  return { status: worst, checks, neighbors, support };
}

/** Same material first, then by oxygen and airflow distance in training standard deviations. A MicroFire heuristic. */
export function nearest(s: Snapshot, q: Query, k = 5): Neighbor[] {
  const sd = (f: (r: Row) => number) => { const v = s.rows.map(f), m = v.reduce((a, b) => a + b, 0) / v.length; return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length); };
  const so = sd((r) => r.o2), sf = sd((r) => r.flow);
  return s.rows
    .map((row) => { const dO2 = row.o2 - q.o2, dFlow = row.flow - q.flow; return { row, dO2, dFlow, distance: Math.hypot(dO2 / so, dFlow / sf) }; })
    .sort((a, b) => Number(b.row.material === q.material) - Number(a.row.material === q.material) || a.distance - b.distance)
    .slice(0, k);
}

export type Prediction = { p: number; lo: number; hi: number; contributions: { feature: string; value: string; logOdds: number }[]; baseLogOdds: number };

/** Only an in-domain or near-domain query gets a number. Everything else returns null: the prediction is blocked. */
export function predict(s: Snapshot, q: Query): Prediction | null {
  const g = gate(s, q);
  if (g.status !== "in" && g.status !== "near") return null;
  const x = feats(q, s.fs);
  const ps = s.boot.map((m) => logitP(m, x)).sort((a, b) => a - b);
  const vals = s.fs === "o2+material" ? [`${q.o2} %`, q.material === "PMMA" ? "yes" : "no"] : [`${q.o2} %`, `${q.flow} cm/s`, q.material === "PMMA" ? "yes" : "no"];
  return {
    p: logitP(s.model, x),
    lo: pct(ps, 0.05),
    hi: pct(ps, 0.95),
    baseLogOdds: s.model.b,
    // Exact for a linear model: each feature's log-odds shift from the average training record.
    contributions: x.map((v, j) => ({ feature: s.features[j], value: vals[j], logOdds: (s.model.w[j] * (v - s.model.mu[j])) / s.model.sd[j] })),
  };
}

/* ---------------------------------------------------------------- per-process memo */
// Pages render per request (fresh CSP nonce); the data never changes at runtime, so fit and validate once per server instance.
let snapMemo: Snapshot | null = null;
let labMemo: { rows: Row[]; excluded: Excluded[]; evals: Evaluation[]; pick: ModelId | null; transfer: ReturnType<typeof materialTransfer> } | null = null;
export function deployedSnapshot(exps: Experiment[]) {
  return (snapMemo ??= snapshot(buildDataset(exps).rows, "logit-o2-material"));
}
export function labReport(exps: Experiment[]) {
  if (!labMemo) {
    const { rows, excluded } = buildDataset(exps);
    const evals = evaluate(rows);
    labMemo = { rows, excluded, evals, pick: chooseModel(evals), transfer: materialTransfer(rows) };
  }
  return labMemo;
}
