import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fromBass, fromSaffire } from "./ontology.ts";
import { ATMOSPHERES } from "./atmospheres.ts";
import { buildBrief, type BriefData, type BriefInput } from "./brief.ts";
import type { Experiment, Finding, SaffireRun } from "./types";

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const data: BriefData = {
  model: read("../data/model.json"), spec: read("../data/gravity_bridge.json").spec, next: read("../data/next_experiments.json"),
  records: [...(read("../data/experiments.json") as Experiment[]).map(fromBass), ...(read("../data/saffire.json") as SaffireRun[]).map(fromSaffire)],
  findings: read("../data/findings.json") as Finding[],
};
const atm = (id: string) => ATMOSPHERES.find((a) => a.id === id)!;
const base: BriefInput = { gravity: "lunar", atmosphere: atm("ea-a"), flow: 0, direction: "concurrent", materials: "PMMA\nKevlar-wrapped foam" };

test("a lunar brief is labelled a hypothesis and never claims a measurement", () => {
  const b = buildBrief(base, data);
  const text = b.markdown;
  assert.match(text, /UNVALIDATED hypothesis/);
  assert.match(text, /No partial-gravity test result is in the atlas/);
  assert.doesNotMatch(text, /outcome model \(ISS microgravity tests only\) estimates/);
});

test("an untested material is reported as no evidence, not safe", () => {
  const b = buildBrief(base, data);
  assert.match(b.markdown, /Kevlar-wrapped foam: No evidence/);
  assert.match(b.markdown, /not a safety finding/);
});

test("a microgravity brief uses the outcome model and flags extrapolation", () => {
  const b = buildBrief({ ...base, gravity: "microgravity", flow: 10, oxygen: 40, atmosphere: atm("custom") }, data);
  assert.match(b.markdown, /outcome model \(ISS microgravity tests only\) estimates/);
  assert.match(b.markdown, /outside the tested range/);
});

test("same inputs give the same brief", () => {
  assert.equal(buildBrief(base, data).markdown, buildBrief(base, data).markdown);
});

test("low airflow in microgravity adds the cited visibility concern and its sources", () => {
  const b = buildBrief({ ...base, gravity: "microgravity", atmosphere: atm("iss"), flow: 0.5 }, data);
  assert.match(b.markdown, /dim blue/);
  assert.match(b.markdown, /low-flow-sensitivity/);
});

test("the plan and limits are always present", () => {
  const b = buildBrief(base, data);
  assert.match(b.markdown, /Tests that would reduce the uncertainty most/);
  assert.match(b.markdown, /not a NASA test plan/);
  assert.match(b.markdown, /## Limits/);
});
