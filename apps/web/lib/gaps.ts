import type { Experiment, OutcomeGroup } from "./types";
import { flowRange } from "./relevance.ts";

/** Bins for the oxygen × airflow evidence map. Upper edges are exclusive. */
export const O2_BINS: [number, number][] = [
  [14, 16],
  [16, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [20, 21],
  [21, 22],
  [22, 26],
  [26, 30],
  [30, 36],
];
export const FLOW_BINS: [number, number][] = [
  [0, 2],
  [2, 5],
  [5, 10],
  [10, 20],
  [20, 60],
];

/** Zone thresholds: a project choice, shown on the page. */
export const OBSERVED_MIN = 3;

export type Zone = "observed" | "sparse" | "outside";

export type Cell = {
  o2: [number, number];
  flow: [number, number];
  tests: Experiment[];
  outcomes: Partial<Record<OutcomeGroup, number>>;
  zone: Zone;
};

/** A test counts in every flow bin its recorded flow range passes through. */
export function gapGrid(exps: Experiment[]): Cell[][] {
  return O2_BINS.map((o2) =>
    FLOW_BINS.map((flow) => {
      const tests = exps.filter((e) => {
        const r = flowRange(e);
        const x = e.oxygen_vol_pct;
        return x != null && r != null && x >= o2[0] && x < o2[1] && r[0] < flow[1] && r[1] >= flow[0];
      });
      const outcomes: Cell["outcomes"] = {};
      for (const t of tests) outcomes[t.outcome_group] = (outcomes[t.outcome_group] ?? 0) + 1;
      const zone: Zone = tests.length >= OBSERVED_MIN ? "observed" : tests.length > 0 ? "sparse" : "outside";
      return { o2, flow, tests, outcomes, zone };
    }),
  );
}

/** Nearest observed cell to an empty one, by bin steps. Used to suggest where a new test would extend coverage. */
export function nearestObserved(grid: Cell[][], i: number, j: number) {
  let best: { i: number; j: number; d: number } | null = null;
  grid.forEach((row, a) =>
    row.forEach((c, b) => {
      if (c.zone !== "observed") return;
      const d = Math.abs(a - i) + Math.abs(b - j);
      if (!best || d < best.d) best = { i: a, j: b, d };
    }),
  );
  return best as { i: number; j: number; d: number } | null;
}
