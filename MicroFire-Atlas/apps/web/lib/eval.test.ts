import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runEval } from "./eval.ts";

const read = (f: string) => JSON.parse(readFileSync(new URL(f, import.meta.url), "utf8"));
const r = runEval(read("../eval/microfire-eval-v1.json").questions, read("../data/experiments.json"), read("../data/findings.json"), read("../data/saffire.json"));

// floors, not targets: a change that lowers any of these fails the build
test("MicroFire-Eval v1 floors", () => {
  assert.equal(r.questions, 100);
  assert.ok(r.passed >= 98, `passed ${r.passed}/100`);
  assert.ok(r.recallAll >= 0.97, `recall ${r.recallAll}`);
  assert.equal(r.overClaims, 0); // no unanswerable or gap question ever comes back with direct evidence
  assert.equal(r.abstention.correct, r.abstention.n);
  assert.equal(r.verifier.caught, r.verifier.faulty);
  assert.equal(r.verifier.falseAlarms, 0);
});
