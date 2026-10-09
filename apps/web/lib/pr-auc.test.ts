import { test } from "node:test";
import assert from "node:assert/strict";
import { averagePrecision, metrics } from "./model-lab.ts";

test("average precision: perfect ranking is 1, worst ranking is the class share or lower", () => {
  assert.equal(averagePrecision([0.9, 0.8, 0.2, 0.1], [true, true, false, false]), 1);
  // positives ranked last: precision at their ranks is 1/3 and 2/4
  assert.ok(Math.abs(averagePrecision([0.9, 0.8, 0.2, 0.1], [false, false, true, true])! - (0.5 * (1 / 3) + 0.5 * (2 / 4))) < 1e-12);
});

test("average precision matches a hand-computed example", () => {
  // ranked: P N P N N  -> recall steps 0.5 at rank 1 (precision 1), 0.5 at rank 3 (precision 2/3)
  const ap = averagePrecision([0.9, 0.8, 0.7, 0.6, 0.5], [true, false, true, false, false])!;
  assert.ok(Math.abs(ap - (0.5 * 1 + 0.5 * (2 / 3))) < 1e-12);
});

test("ties form one step: the result does not depend on input order", () => {
  const s = [0.5, 0.5, 0.5, 0.5], a = averagePrecision(s, [true, false, true, false])!, b = averagePrecision(s, [false, true, false, true])!;
  assert.equal(a, b);
  assert.equal(a, 0.5); // all tied: precision equals the class share
});

test("no positive example gives null, not a fake zero", () => {
  assert.equal(averagePrecision([0.1, 0.2], [false, false]), null);
});

test("metrics reports PR-AUC for the no-flame class and the class share to compare it against", () => {
  // 8 flames, 2 no-flame; the model gives the no-flame tests the lowest flame probabilities
  const p = [0.95, 0.9, 0.9, 0.85, 0.8, 0.8, 0.75, 0.7, 0.3, 0.2], y = [1, 1, 1, 1, 1, 1, 1, 1, 0, 0];
  const m = metrics(p, y);
  assert.equal(m.prAuc, 1);
  assert.equal(m.noFlameShare, 0.2);
  const bad = metrics([0.2, 0.3, 0.9, 0.9, 0.8, 0.8, 0.75, 0.7, 0.95, 0.9], y);
  assert.ok(bad.prAuc! < m.noFlameShare + 0.2 && bad.prAuc! < 0.5);
});
