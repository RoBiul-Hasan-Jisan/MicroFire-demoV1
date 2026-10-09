import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { costLens, type NextTests } from "./next-tests.ts";

const data = JSON.parse(readFileSync(new URL("../data/next_experiments.json", import.meta.url), "utf8")) as NextTests;
const by = (r: ReturnType<typeof costLens>, g: string) => r.find((x) => x.gravity === g)!;

test("at equal cost the order is the planner's own order by uncertainty removed", () => {
  const r = costLens(data.grid, 1);
  const byGain = [...r].sort((a, b) => b.gain - a.gain).map((x) => x.gravity);
  assert.deepEqual([...r].sort((a, b) => a.rank - b.rank).map((x) => x.gravity), byGain);
  for (const g of ["microgravity", "lunar", "martian"] as const) assert.equal(by(r, g).gain, data.headline.best_by_gravity[g].alone_uncertainty_removed);
});

test("break-even is exact: at that ratio the partial-gravity test ties the ISS test, either side flips the order", () => {
  const be = by(costLens(data.grid, 1), "lunar").breakEven!;
  assert.ok(be > 0 && be < 1);
  const at = costLens(data.grid, be);
  assert.ok(Math.abs(by(at, "lunar").perCost - by(at, "microgravity").perCost) < 1e-12);
  assert.equal(by(costLens(data.grid, be * 0.9), "lunar").rank < by(costLens(data.grid, be * 0.9), "microgravity").rank, true);
  assert.equal(by(costLens(data.grid, be * 1.1), "lunar").rank > by(costLens(data.grid, be * 1.1), "microgravity").rank, true);
  assert.equal(by(costLens(data.grid, 1), "microgravity").breakEven, null);
});

test("raising the partial-gravity cost never improves its rank; ranks are a permutation of 1..3", () => {
  let last = 0;
  for (const r of [0.25, 0.5, 1, 2, 5, 20]) {
    const rows = costLens(data.grid, r);
    assert.deepEqual(rows.map((x) => x.rank).sort(), [1, 2, 3]);
    assert.ok(by(rows, "lunar").rank >= last); last = by(rows, "lunar").rank;
  }
});

test("a missing or invalid cost is rejected rather than defaulted", () => {
  for (const bad of [0, -1, NaN, Infinity]) assert.throws(() => costLens(data.grid, bad), RangeError);
});
