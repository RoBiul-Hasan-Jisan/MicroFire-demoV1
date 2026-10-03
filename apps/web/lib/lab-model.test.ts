// node --test lib/   (Node ≥ 23 strips the types)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_STATE, FRESH_SAVE, SAFETY, badgesOf, evaluateAction, explanationIds, insightFor, judge, lookOf, progressOf, readEvidence,
  type LabState,
} from "./lab-model.ts";
import type { Experiment } from "./types";

const all: Experiment[] = JSON.parse(readFileSync(new URL("../data/experiments.json", import.meta.url), "utf8"));
const verdict = (s: LabState) => readEvidence(all, s).verdict;

test("outcome words only come from tests NASA ran in microgravity", () => {
  const earth = verdict({ ...DEFAULT_STATE, world: "earth" });
  assert.equal(earth.kind, "limited");
  assert.equal(earth.reason, "gravity");
  const moon = verdict({ ...DEFAULT_STATE, world: "moon" });
  assert.equal(moon.reason, "gravity");
});

test("verdict tally counts only strong matches and agrees with its own kind", () => {
  const v = verdict({ ...DEFAULT_STATE, oxygen: 17, flow: 3 });
  const total = v.tally.sustained + v.tally.extinguished + v.tally.not_ignited + v.tally.unknown;
  assert.equal(total, v.used);
  assert.ok(v.used <= 8);
  if (v.kind === "sustained" || v.kind === "extinguished" || v.kind === "not_ignited") {
    assert.ok(v.tally[v.kind] >= Math.max(v.tally.sustained, v.tally.extinguished, v.tally.not_ignited));
  }
});

test("conditions far outside the atlas give a limited verdict, never a made-up outcome", () => {
  const v = verdict({ ...DEFAULT_STATE, oxygen: 36, flow: 60, fuel: "Nomex" });
  assert.ok(["limited", "unstated", "mixed", "sustained", "extinguished", "not_ignited"].includes(v.kind));
  if (v.used === 0) assert.equal(v.kind, "limited");
});

test("settings outside the tested range never produce an outcome count", () => {
  const v = verdict({ ...DEFAULT_STATE, oxygen: 30 });
  assert.equal(v.kind, "limited");
  assert.equal(v.reason, "outside");
});

test("explanations cite only findings that exist", () => {
  const findings: { id: string }[] = JSON.parse(readFileSync(new URL("../data/findings.json", import.meta.url), "utf8"));
  const ids = new Set(findings.map((f) => f.id));
  for (const s of [DEFAULT_STATE, { ...DEFAULT_STATE, flow: 1 }, { ...DEFAULT_STATE, oxygen: 16 }, { ...DEFAULT_STATE, world: "moon" as const }, { ...DEFAULT_STATE, oxygen: 34, pressureKpa: 56.5 }, { ...DEFAULT_STATE, flow: 40 }]) {
    for (const id of explanationIds(s)) assert.ok(ids.has(id), id);
  }
});

test("insight always carries a caution and never claims a prediction", () => {
  const i = insightFor(DEFAULT_STATE, verdict(DEFAULT_STATE));
  assert.match(i.caution, /not a forecast/i);
});

test("prediction judging is honest about missing evidence", () => {
  const limited = verdict({ ...DEFAULT_STATE, world: "earth" });
  assert.equal(judge("sustained", limited).result, "nodata");
});

test("flame look follows the controls in the expected direction", () => {
  assert.ok(lookOf({ ...DEFAULT_STATE, oxygen: 30 }).size > lookOf({ ...DEFAULT_STATE, oxygen: 16 }).size);
  assert.ok(lookOf({ ...DEFAULT_STATE, world: "earth" }).g > lookOf({ ...DEFAULT_STATE, world: "micro" }).g);
  assert.ok(lookOf({ ...DEFAULT_STATE, flow: 30 }).lean > lookOf({ ...DEFAULT_STATE, flow: 1 }).lean);
});

test("every safety scenario evaluates every action", () => {
  for (const sc of SAFETY) for (const a of sc.actions) {
    const r = evaluateAction(all, sc, a);
    assert.ok(r.before && r.after);
  }
});

test("mission progress and badges unlock from actions", () => {
  assert.equal(progressOf(FRESH_SAVE).discover, false);
  const done = { ...FRESH_SAVE, brief: true, touched: ["a", "b", "c"], ignitions: 1, worlds: ["earth", "moon", "mars", "micro"] as const, views: ["flame", "heat", "oxygen", "airflow", "safety"] as const, safetyDone: ["fans"], opened: ["x"], wentOut: true, matches: 1, pushedLimits: true };
  const full = { ...done, worlds: [...done.worlds], views: [...done.views] };
  assert.equal(progressOf(full).discover, true);
  assert.equal(badgesOf(full).length, 8);
  assert.equal(badgesOf(FRESH_SAVE).length, 0);
});

test("a lead outcome needs several stated end states; sparse tables read as unstated", () => {
  const v = verdict({ ...DEFAULT_STATE, flow: 5 });
  assert.ok(v.stated < 3 ? v.kind === "unstated" : true);
});
