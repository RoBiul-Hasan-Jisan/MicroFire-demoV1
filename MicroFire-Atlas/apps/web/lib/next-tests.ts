/** Types and helpers for the next-experiment recommender (data written by pipelines/next_experiments.py). */
import type { Gravity } from "./gravity-bridge.ts";

export type Step = {
  rank: number; gravity: Gravity; o2: number; forced: number; direction: "concurrent" | "opposed";
  cumulative_uncertainty_removed: number; alone_uncertainty_removed: number; expected_p_sustained: number; p90: [number, number];
};
export type Target = { id: string; label: string; o2: number; forced: number; direction: string; gravity: Gravity };
export type RunSummary = {
  label: string; prior_total_variance: number;
  target_prior: { id: string; p_mean: number; p_sd: number }[];
  batch: Step[];
  best_by_gravity: Record<Gravity, { gravity: Gravity; o2: number; forced: number; direction: string; alone_uncertainty_removed: number }>;
};
export type NextTests = {
  version: string; kappa_extrapolation: number; members: number; targets: Target[];
  headline: RunSummary; bootstrap_only: RunSummary;
  grid: Record<Gravity, { o2: number; forced: number; gain: number }[]>;
  validation_rows_used_to_reweight: number;
  assumptions: string[];
};

export type Sensitivity = {
  settings: { id: string; label: string; uncertainty_removed_by_batch: number; batch: { rank: number; gravity: Gravity; o2: number; forced: number; direction: string }[] }[];
  default_picks_survival: { rank: number; gravity: Gravity; o2: number; forced: number; direction: string; appears_in: number; of: number; top1_in: number }[];
  kinds: { id: string; top_pick_gravity: Gravity; partial_gravity_tests_in_batch: number }[];
  always_includes_partial_gravity_test: boolean;
  default_batch_identical_everywhere: boolean;
};

export const GRAVITY_LABEL: Record<Gravity, string> = { microgravity: "ISS microgravity", lunar: "Lunar gravity (0.17 g)", martian: "Martian gravity (0.38 g)" };
export const pct = (x: number) => `${Math.round(x * 100)} %`;

export function describeTest(s: Pick<Step, "gravity" | "o2" | "forced" | "direction">) {
  const flow = s.forced === 0 ? "no forced airflow" : `${s.forced} cm/s ${s.direction} airflow`;
  return `${GRAVITY_LABEL[s.gravity]}, ${s.o2} % oxygen, ${flow}`;
}

/** One-line reason a test is valuable, derived only from fields in the data. */
export function whyThisTest(s: Step, outOfRangeO2: boolean) {
  const bits = [`Expected to remove ${pct(s.alone_uncertainty_removed)} of the uncertainty about the five mission cabins on its own.`];
  if (s.gravity !== "microgravity") bits.push("No real partial-gravity result exists in the atlas, so this is the only kind of test that can settle the gravity bridge.");
  if (outOfRangeO2) bits.push("Oxygen is above anything NASA tested in the atlas, where the model is extrapolating.");
  bits.push(`The model currently expects ${pct(s.expected_p_sustained)} chance of a sustained flame, range ${pct(s.p90[0])}–${pct(s.p90[1])}.`);
  return bits.join(" ");
}

/* ------------------------------------------------------------------ cost lens (user-set assumption, no cost data) */

export type CostRow = { gravity: Gravity; o2: number; forced: number; gain: number; cost: number; perCost: number; rank: number; breakEven: number | null };

/**
 * Re-ranks the best single test per gravity by uncertainty removed per unit cost.
 * The atlas holds NO cost data, so cost is a single assumption set by the reader: how many times more a partial-gravity
 * test costs than an ISS test (ratio). At ratio = 1 the order is the planner's own order by gain.
 * breakEven: the cost ratio at which a partial-gravity test and the best ISS test tie, because gain_p / r = gain_iss.
 * Below it the partial-gravity test is the better buy on this measure; above it the ISS test is.
 */
export function costLens(grid: NextTests["grid"], ratio: number): CostRow[] {
  if (!(ratio > 0) || !Number.isFinite(ratio)) throw new RangeError("cost ratio must be a positive finite number");
  const order: Gravity[] = ["microgravity", "lunar", "martian"];
  const best = order.map((g) => ({ g, b: grid[g].reduce((a, c) => (c.gain > a.gain ? c : a)) }));
  const iss = best[0].b.gain;
  const rows = best.map(({ g, b }) => {
    const cost = g === "microgravity" ? 1 : ratio;
    return { gravity: g, o2: b.o2, forced: b.forced, gain: b.gain, cost, perCost: b.gain / cost, rank: 0, breakEven: g === "microgravity" || iss <= 0 ? null : b.gain / iss };
  });
  [...rows].sort((a, b) => b.perCost - a.perCost || b.gain - a.gain).forEach((r, i) => { r.rank = i + 1; });
  return rows;
}
