/**
 * Gravity bridge: a transparent, UNVALIDATED hypothesis for reading the ISS-trained outcome model at
 * lunar or Martian gravity. Mirrors pipelines/gravity_bridge.py (the numbers are cross-checked in
 * gravity-bridge.test.ts against values the Python pipeline wrote).
 *
 *   u_buoyant   = u_ref * (g / g_earth)^n
 *   u_effective = sqrt(u_forced^2 + u_buoyant^2)
 *
 * The bridge only adds airflow. It does not model flame shape, soot, radiation, pressure or material.
 */
import type { Model } from "./model.ts";

export type Gravity = "microgravity" | "lunar" | "martian";
export type BridgeSpec = {
  version: string;
  status: string;
  idea: string;
  equation: string;
  assumptions: string[];
  u_ref_cm_s: [number, number];
  exponent: [number, number];
  gravity_ratio: Record<Gravity, number>;
  min_effective_flow_cm_s: number;
  derivation?: { formula: string; g_earth_cm_s2: number; length_cm: [number, number]; u_ref_from_length_cm_s: [number, number]; exponent_implied: number; note: string };
};
export type BridgeCondition = { o2: number; forced: number; direction: "concurrent" | "opposed"; gravity: Gravity };
export type BridgeRanges = { uRef: [number, number]; exponent: [number, number] };
export type BridgeResult = {
  p05: number; p50: number; p95: number;
  effectiveFlow: [number, number];
  /** True when the effective airflow or oxygen lies outside what the ISS tests covered. */
  extrapolated: { o2: boolean; flow: boolean };
};

export const GRID = { nu: 7, nn: 5 };

export const rangesFromSpec = (s: BridgeSpec): BridgeRanges => ({ uRef: s.u_ref_cm_s, exponent: s.exponent });

const linspace = (a: number, b: number, n: number) => Array.from({ length: n }, (_, i) => (n === 1 ? a : a + ((b - a) * i) / (n - 1)));
const logspace = (a: number, b: number, n: number) => linspace(Math.log(a), Math.log(b), n).map(Math.exp);

export const buoyantFlow = (uRef: number, n: number, gRatio: number) => uRef * Math.pow(gRatio, n);
export const effectiveFlow = (forced: number, ub: number, minFlow: number) => Math.max(Math.hypot(forced, ub), minFlow);

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

export function bridgePredict(model: Model, spec: BridgeSpec, c: BridgeCondition, ranges: BridgeRanges = rangesFromSpec(spec)): BridgeResult {
  const g = spec.gravity_ratio[c.gravity];
  const us = logspace(ranges.uRef[0], ranges.uRef[1], GRID.nu);
  const ns = linspace(ranges.exponent[0], ranges.exponent[1], GRID.nn);
  const opposed = c.direction === "opposed" ? 1 : 0;
  const vals: number[] = [];
  let effLo = Infinity, effHi = -Infinity;
  for (const u of us) {
    for (const n of ns) {
      const eff = effectiveFlow(c.forced, buoyantFlow(u, n, g), spec.min_effective_flow_cm_s);
      effLo = Math.min(effLo, eff);
      effHi = Math.max(effHi, eff);
      const x = [c.o2, Math.log(eff), opposed];
      for (const B of model.bootstrap) {
        const z = x.reduce((s, v, i) => s + ((v - B.mu[i]) / B.sd[i]) * B.w[i], B.b);
        vals.push(sigmoid(z));
      }
    }
  }
  vals.sort((a, b) => a - b);
  const q = (f: number) => vals[Math.min(vals.length - 1, Math.max(0, Math.round(f * (vals.length - 1))))];
  const [o0, o1] = model.ranges.o2_pct, [f0, f1] = model.ranges.flow_cm_s;
  return {
    p05: q(0.05), p50: q(0.5), p95: q(0.95),
    effectiveFlow: [effLo, effHi],
    extrapolated: { o2: c.o2 < o0 || c.o2 > o1, flow: effLo < f0 - 1e-9 || effHi > f1 + 1e-9 },
  };
}

/** P(sustained) against forced airflow for each gravity: the curves on the bridge page. */
export function bridgeCurves(model: Model, spec: BridgeSpec, o2: number, direction: BridgeCondition["direction"], forcedValues: number[], ranges?: BridgeRanges) {
  const out = {} as Record<Gravity, (BridgeResult & { forced: number })[]>;
  for (const gravity of ["microgravity", "lunar", "martian"] as Gravity[])
    out[gravity] = forcedValues.map((forced) => ({ forced, ...bridgePredict(model, spec, { o2, forced, direction, gravity }, ranges) }));
  return out;
}

export type Claim = { id: string; findingId: string; says: "sustains" | "not-testable" | "direction-only"; why: string; condition?: BridgeCondition };

/**
 * NASA statements already in the atlas that the bridge can be held against. Only the first is an
 * independent test; the others are listed so nobody mistakes them for validation.
 */
export const CLAIMS: Claim[] = [
  { id: "sibal-lunar-air", findingId: "sibal-lunar-downward", says: "sustains", condition: { o2: 21, forced: 0, direction: "opposed", gravity: "lunar" },
    why: "NASA reports SIBAL fabric burns in air at lunar gravity but goes out at once in Earth gravity. The bridge is asked: in 21 % oxygen, no forced flow, lunar gravity, does it lean toward the flame being sustained?" },
  { id: "lunar-more-flammable", findingId: "lunar-goldilocks", says: "direction-only",
    why: "Lunar gravity raising flammability limits is built into the bridge (buoyant flow is added), so agreement here is by construction and is not evidence for the bridge." },
  { id: "lower-o2-reduced-g", findingId: "low-g-burns-lower-o2", says: "not-testable",
    why: "Needs a 1 g comparison. The outcome model has no Earth-gravity data, so the bridge cannot be checked against it." },
];

export type ClaimCheck = { claim: Claim; verdict: "agrees" | "disagrees" | "direction only" | "not testable"; result?: BridgeResult; detail: string };

export function checkClaims(model: Model, spec: BridgeSpec): ClaimCheck[] {
  return CLAIMS.map((claim) => {
    if (claim.says === "not-testable") return { claim, verdict: "not testable", detail: "No Earth-gravity comparison is available." };
    if (claim.says === "direction-only") return { claim, verdict: "direction only", detail: "Consistent by construction." };
    const result = bridgePredict(model, spec, claim.condition!);
    const agrees = result.p50 >= 0.5;
    return {
      claim, result, verdict: agrees ? "agrees" : "disagrees",
      detail: `The bridge puts the chance the flame is sustained at ${Math.round(result.p50 * 100)} % (90 % range ${Math.round(result.p05 * 100)}–${Math.round(result.p95 * 100)} %), so it ${agrees ? "leans the same way as" : "leans against"} the NASA statement.${result.p05 < 0.5 && result.p95 > 0.5 ? " The range spans 50 %, so this is a lean, not a clear hit or miss." : ""}`,
    };
  });
}
