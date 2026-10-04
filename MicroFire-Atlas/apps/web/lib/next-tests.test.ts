import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { NextTests } from "./next-tests.ts";
import { describeTest, whyThisTest } from "./next-tests.ts";

const d = JSON.parse(readFileSync(new URL("../data/next_experiments.json", import.meta.url), "utf8")) as NextTests;

test("each added test removes at least as much uncertainty as the one before", () => {
  const b = d.headline.batch;
  assert.ok(b.length >= 3);
  for (let i = 1; i < b.length; i++) assert.ok(b[i].cumulative_uncertainty_removed >= b[i - 1].cumulative_uncertainty_removed);
});

test("every value is a share between 0 and 1", () => {
  for (const s of d.headline.batch) for (const v of [s.cumulative_uncertainty_removed, s.alone_uncertainty_removed, s.expected_p_sustained]) assert.ok(v >= 0 && v <= 1);
  for (const g of Object.values(d.grid)) for (const c of g) assert.ok(c.gain >= 0 && c.gain <= 1);
});

test("the plain bootstrap run is kept next to the headline so the assumption is visible", () => {
  assert.ok(d.bootstrap_only.batch.length === d.headline.batch.length);
  assert.ok(d.assumptions.some((a) => /not a NASA test plan/i.test(a)));
});

test("explanations only use fields in the data and flag partial gravity honestly", () => {
  const lunar = d.headline.batch.find((s) => s.gravity === "lunar")!;
  assert.match(whyThisTest(lunar, false), /No real partial-gravity result/);
  assert.match(describeTest(lunar), /Lunar/);
});
