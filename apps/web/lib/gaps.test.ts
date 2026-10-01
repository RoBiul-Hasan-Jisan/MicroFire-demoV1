import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gapGrid, nearestObserved, O2_BINS } from "./gaps.ts";
import type { Experiment } from "./types";

const all: Experiment[] = JSON.parse(readFileSync(new URL("../data/experiments.json", import.meta.url), "utf8"));

test("nothing above 22 % oxygen has been tested", () => {
  const grid = gapGrid(all);
  O2_BINS.forEach(([lo], i) => {
    if (lo >= 22) assert.ok(grid[i].every((c) => c.zone === "outside"));
  });
});

test("a ramped test counts in every flow bin it passed through", () => {
  const t4 = all.filter((e) => e.id === "sibal-GMT45-T4"); // 18.7 %, 10 → 2.2 cm/s
  const row = gapGrid(t4)[3]; // 18–19 %
  assert.deepEqual(row.map((c) => c.tests.length), [0, 1, 1, 1, 0]);
});

test("nearest observed cell is found for an empty corner", () => {
  const grid = gapGrid(all);
  const n = nearestObserved(grid, O2_BINS.length - 1, 0);
  assert.ok(n);
  assert.equal(grid[n.i][n.j].zone, "observed");
});
