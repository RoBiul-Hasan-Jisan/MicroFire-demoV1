/**
 * "Burning but unseen": where a flame can plausibly persist while being small, dim and easy to miss.
 *
 * This is NOT a measured visibility score. It combines two things the atlas does hold:
 *   1. NASA's statements about low airflow (bass-thickness findings):
 *        - below 1 cm/s all flames became dim blue and very stable and can burn for a long time;
 *        - flames are especially sensitive to airflow between 0 and 5 cm/s;
 *        - a tiny flame might be undetected for a long time and may flare up if airflow rises.
 *   2. The outcome model, which can only speak where it has tests (airflow 2 to 25 cm/s here).
 * Below the lowest tested airflow the model is silent, and this module says so instead of guessing.
 */
import { predictOutcome, type Model, type Conditions } from "./model.ts";

export const THRESHOLDS = { dimBelow: 1, sensitiveBelow: 5 };
export const FINDINGS = { dim: "dim-blue-low-flow", sensitive: "low-flow-sensitivity", undetected: "tiny-flame-undetected" };

export type VisibilityClass = "dim-blue" | "flow-sensitive" | "no-cited-concern";
export type Verdict = "hidden-burn-possible" | "may-burn-small" | "likely-goes-out" | "ordinary";

export type Cell = {
  flow: number; o2: number; cls: VisibilityClass; modelValid: boolean;
  p?: number; lo?: number; hi?: number; verdict: Verdict; text: string;
};

export function visibilityClass(flow: number): VisibilityClass {
  return flow < THRESHOLDS.dimBelow ? "dim-blue" : flow < THRESHOLDS.sensitiveBelow ? "flow-sensitive" : "no-cited-concern";
}

export function unseenCell(model: Model, o2: number, flow: number, direction: Conditions["direction"] = "concurrent"): Cell {
  const cls = visibilityClass(flow);
  const modelValid = flow >= model.ranges.flow_cm_s[0] && o2 >= model.ranges.o2_pct[0] && o2 <= model.ranges.o2_pct[1];
  if (cls === "dim-blue" || !modelValid) {
    const low = flow < model.ranges.flow_cm_s[0];
    return {
      flow, o2, cls, modelValid: false, verdict: cls === "dim-blue" ? "hidden-burn-possible" : "ordinary",
      text: cls === "dim-blue"
        ? "NASA reports flames at this airflow are dim blue, very stable and can burn for a long time. No labelled test and no model estimate exist here."
        : low ? "Below the lowest airflow in the labelled tests; the model is silent." : "Oxygen is outside the tested range; the model is silent.",
    };
  }
  const r = predictOutcome(model, { o2, flow, direction });
  if (r.p >= 0.5)
    return { flow, o2, cls, modelValid, p: r.p, lo: r.lo, hi: r.hi, verdict: cls === "flow-sensitive" ? "may-burn-small" : "ordinary", text: cls === "flow-sensitive" ? "The model leans toward a sustained flame in the airflow range where NASA found flames most sensitive; it may be small." : "The model leans toward a sustained flame; no visibility concern is cited at this airflow." };
  return { flow, o2, cls, modelValid, p: r.p, lo: r.lo, hi: r.hi, verdict: "likely-goes-out", text: "The model leans toward the flame going out." };
}

export const O2_STEPS = [14, 16, 18, 20, 22, 24, 26, 28, 30];
export const FLOW_STEPS = [0.25, 0.5, 1, 1.5, 2, 3, 5, 8, 12, 20];

export function unseenGrid(model: Model, direction: Conditions["direction"] = "concurrent") {
  return FLOW_STEPS.map((f) => O2_STEPS.map((o) => unseenCell(model, o, f, direction)));
}
