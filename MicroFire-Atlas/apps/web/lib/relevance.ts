import type { Experiment } from "./types";

/**
 * Mission Relevance: how close a NASA test is to a user's scenario.
 * A project heuristic — not a NASA rating and not a fire-risk prediction.
 *
 *   relevance = Σ wᵢ·simᵢ / Σ wᵢ   over the variables the scenario specifies
 *   coverage  = Σ wᵢ(known) / Σ wᵢ
 *
 * A variable the test does not report adds 0 to the numerator but keeps its
 * weight in the denominator, so blank fields can never raise a score.
 */

export type Gravity = "microgravity" | "lunar" | "martian";

export type Scenario = {
  oxygen?: number; // vol %
  flow?: number; // cm/s
  pressureKpa?: number;
  gravity?: Gravity;
  material?: string;
  flowDirection?: string;
  thicknessMm?: number;
  widthMm?: number;
};

export const WEIGHTS = {
  oxygen: 3,
  flow: 3,
  pressureKpa: 2,
  gravity: 2,
  material: 2,
  flowDirection: 1,
  thicknessMm: 1,
  widthMm: 1,
} as const;

export const LABELS: Record<keyof Scenario, string> = {
  oxygen: "Oxygen",
  flow: "Airflow",
  pressureKpa: "Pressure",
  gravity: "Gravity",
  material: "Material",
  flowDirection: "Flow direction",
  thicknessMm: "Thickness",
  widthMm: "Sample width",
};

/** Materials in the same broad class get partial credit. Project choice, documented on Methodology. */
export const MATERIAL_CLASS: Record<string, string> = {
  PMMA: "thermoplastic",
  "SIBAL fabric": "fabric",
  Nomex: "fabric",
};
export const SAME_CLASS_CREDIT = 0.5;

/**
 * Every test in the atlas ran near 1 atm, so the data's own pressure spread (~1 kPa) is too
 * narrow to be a fair yardstick. A fixed, documented scale is used instead.
 */
export const PRESSURE_SCALE_KPA = 10;

const isMicrogravity = (e: Experiment) => e.gravity_regime.startsWith("microgravity");

export type Term = {
  key: keyof Scenario;
  label: string;
  weight: number;
  sim: number | null; // null = the test does not report this variable
  testValue: string;
};

export type Ranked = { experiment: Experiment; score: number; coverage: number; terms: Term[] };

const std = (xs: number[]) => {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length) || 1;
};

/** Distance scales come from the spread of the data itself. */
export function scalesFrom(exps: Experiment[]) {
  const vals = (f: (e: Experiment) => number | null) => exps.map(f).filter((v): v is number => v != null);
  return {
    oxygen: std(vals((e) => e.oxygen_vol_pct)),
    flow: std(vals((e) => e.flow_initial_cm_s)),
    logThickness: std(vals((e) => (e.thickness_mm ? Math.log(e.thickness_mm) : null))),
    widthMm: std(vals((e) => e.width_mm)),
  };
}

/** Flow range a test actually experienced (start and end, when both are known). */
export function flowRange(e: Experiment): [number, number] | null {
  const a = e.flow_initial_cm_s;
  if (a == null) return null;
  const b = e.flow_final_cm_s ?? a;
  return [Math.min(a, b), Math.max(a, b)];
}

const near = (d: number, scale: number) => Math.exp(-Math.abs(d) / scale);

/** The project choices inside the score. Ranking robustness (robustness.ts) varies them. */
export type RankParams = { weights: Record<keyof typeof WEIGHTS, number>; pressureScaleKpa: number; classCredit: number };
export const RANK_DEFAULTS: RankParams = { weights: WEIGHTS, pressureScaleKpa: PRESSURE_SCALE_KPA, classCredit: SAME_CLASS_CREDIT };

export function rank(exps: Experiment[], s: Scenario, prm: RankParams = RANK_DEFAULTS): Ranked[] {
  const sc = scalesFrom(exps);
  const out = exps.map((e) => {
    const terms: Term[] = [];
    const add = (key: keyof Scenario, sim: number | null, testValue: string) =>
      terms.push({ key, label: LABELS[key], weight: prm.weights[key], sim, testValue });

    if (s.oxygen != null)
      add("oxygen", e.oxygen_vol_pct == null ? null : near(e.oxygen_vol_pct - s.oxygen, sc.oxygen), `${e.oxygen_vol_pct ?? "—"} %`);
    if (s.flow != null) {
      const r = flowRange(e);
      const d = r == null ? null : s.flow < r[0] ? r[0] - s.flow : s.flow > r[1] ? s.flow - r[1] : 0;
      add("flow", d == null ? null : near(d, sc.flow), r == null ? "—" : r[0] === r[1] ? `${r[0]} cm/s` : `${r[0]}–${r[1]} cm/s`);
    }
    if (s.pressureKpa != null) {
      const p = e.pressure_kpa != null ? [e.pressure_kpa, e.pressure_kpa] : e.pressure_kpa_range ?? null;
      const d = p == null ? null : s.pressureKpa < p[0] ? p[0] - s.pressureKpa : s.pressureKpa > p[1] ? s.pressureKpa - p[1] : 0;
      add("pressureKpa", d == null ? null : near(d, prm.pressureScaleKpa), p == null ? "—" : p[0] === p[1] ? `${p[0]} kPa` : `${p[0]}–${p[1]} kPa`);
    }
    if (s.gravity != null)
      add("gravity", (s.gravity === "microgravity") === isMicrogravity(e) ? 1 : 0, isMicrogravity(e) ? "microgravity" : e.gravity_regime);
    if (s.material != null) {
      const same = e.material === s.material;
      const cls = MATERIAL_CLASS[e.material] && MATERIAL_CLASS[e.material] === MATERIAL_CLASS[s.material];
      add("material", same ? 1 : cls ? prm.classCredit : 0, e.material);
    }
    if (s.flowDirection != null) add("flowDirection", e.flow_direction === s.flowDirection ? 1 : 0, e.flow_direction);
    if (s.thicknessMm != null)
      add(
        "thicknessMm",
        e.thickness_mm == null ? null : near(Math.log(e.thickness_mm) - Math.log(s.thicknessMm), sc.logThickness),
        e.thickness_mm == null ? "—" : `${e.thickness_mm} mm`,
      );
    if (s.widthMm != null)
      add("widthMm", e.width_mm == null ? null : near(e.width_mm - s.widthMm, sc.widthMm), e.width_mm == null ? "—" : `${e.width_mm} mm`);

    const total = terms.reduce((a, t) => a + t.weight, 0);
    const score = total ? terms.reduce((a, t) => a + t.weight * (t.sim ?? 0), 0) / total : 0;
    const coverage = total ? terms.filter((t) => t.sim != null).reduce((a, t) => a + t.weight, 0) / total : 0;
    return { experiment: e, score, coverage, terms };
  });
  return out.sort(
    (a, b) => b.score - a.score || b.coverage - a.coverage || a.experiment.id.localeCompare(b.experiment.id),
  );
}

/** Scenario values that fall outside everything the atlas has tested. */
export function outsideEvidence(exps: Experiment[], s: Scenario) {
  const out: string[] = [];
  const span = (vals: (number | null | undefined)[]) => {
    const v = vals.filter((x): x is number => x != null);
    return [Math.min(...v), Math.max(...v)] as const;
  };
  const check = (label: string, v: number | undefined, [lo, hi]: readonly [number, number], unit: string) => {
    if (v != null && (v < lo || v > hi)) out.push(`${label} of ${v} ${unit} is outside the tested range (${lo}–${hi} ${unit}).`);
  };
  check("Oxygen", s.oxygen, span(exps.map((e) => e.oxygen_vol_pct)), "%");
  check("Airflow", s.flow, span(exps.flatMap((e) => [e.flow_initial_cm_s, e.flow_final_cm_s])), "cm/s");
  check(
    "Pressure",
    s.pressureKpa,
    span(exps.flatMap((e) => [e.pressure_kpa, ...(e.pressure_kpa_range ?? [])])),
    "kPa",
  );
  if (s.gravity && s.gravity !== "microgravity" && !exps.some((e) => !isMicrogravity(e)))
    out.push(`No BASS-II test was run at ${s.gravity} gravity; every result below is microgravity evidence.`);
  if (s.material && !exps.some((e) => e.material === s.material)) out.push(`No test in this atlas used ${s.material}.`);
  return out;
}

/**
 * Evidence Confidence: how solid one test's record is, independent of any scenario.
 * Equal-weight checklist; also a project heuristic.
 */
export type Check = { label: string; pass: boolean };

export function confidence(e: Experiment, all: Experiment[]) {
  const related = all.filter(
    (o) =>
      o.id !== e.id &&
      o.family === e.family &&
      o.oxygen_vol_pct != null &&
      e.oxygen_vol_pct != null &&
      Math.abs(o.oxygen_vol_pct - e.oxygen_vol_pct) <= 1 &&
      o.flow_initial_cm_s != null &&
      e.flow_initial_cm_s != null &&
      Math.abs(o.flow_initial_cm_s - e.flow_initial_cm_s) <= 2,
  ).length;
  const checks: Check[] = [
    { label: "Test-level row in a NASA document", pass: true },
    { label: "Outcome stated by NASA", pass: e.outcome_group !== "unknown" },
    { label: "Oxygen reading not flagged by NASA", pass: !e.quality_flags.includes("o2_reading_suspect") },
    { label: "Pressure documented", pass: e.pressure_kpa != null || e.pressure_kpa_range != null },
    { label: "Combustion-gas readings (CO₂, CO)", pass: !!e.co2_vol_pct?.some((v) => v != null) },
    { label: "Fresh sample (not reused)", pass: !e.quality_flags.includes("reused_sample") },
    { label: `Related tests at similar O₂ and flow (${related})`, pass: related >= 2 },
  ];
  const score = checks.filter((c) => c.pass).length / checks.length;
  const level = score >= 0.8 ? "Strong" : score >= 0.55 ? "Moderate" : "Limited";
  return { score, level, checks };
}
