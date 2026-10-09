import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { predictOutcome, type Model } from "./model.ts";

const model = JSON.parse(readFileSync(new URL("../data/model.json", import.meta.url), "utf8")) as Model;

test("more oxygen and more flow never lowers the chance the flame is sustained", () => {
  const lo = predictOutcome(model, { o2: 17, flow: 5, direction: "concurrent" });
  const hi = predictOutcome(model, { o2: 25, flow: 20, direction: "concurrent" });
  assert.ok(hi.p > lo.p);
});

test("interval brackets the estimate and stays in [0,1]", () => {
  const r = predictOutcome(model, { o2: 21, flow: 10, direction: "opposed" });
  assert.ok(r.lo >= 0 && r.hi <= 1 && r.lo <= r.p + 0.02 && r.p <= r.hi + 0.02);
  assert.equal(r.nearest.length, 5);
});

test("conditions outside the tested range are flagged, not hidden", () => {
  const r = predictOutcome(model, { o2: 35, flow: 100, direction: "concurrent" });
  assert.equal(r.inRange.o2, false);
  assert.equal(r.inRange.flow, false);
  assert.equal(predictOutcome(model, { o2: 21, flow: 10, direction: "concurrent" }).inRange.o2, true);
});
