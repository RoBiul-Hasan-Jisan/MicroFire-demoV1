import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fromBass, fromLuci, fromSaffire } from "./ontology.ts";
import { assess, detectiveAnswer, differing, explain, MISSIONS, PATCHES, PRESETS, recordRun, type LabConfig } from "./flame-lab.ts";

const read = (f: string) => JSON.parse(readFileSync(new URL(f, import.meta.url), "utf8"));
const findings = read("../data/findings.json");
const records = [...read("../data/experiments.json").map(fromBass), ...read("../data/saffire.json").map(fromSaffire), ...read("../data/luci.json").map(fromLuci)];
const p = (id: string) => PRESETS.find((x) => x.id === id)!.cfg;
const a = (c: LabConfig) => assess(c, records, findings);

test("presets keep their evidence meaning", () => {
  const bass = a(p("bass"));
  assert.equal(bass.cls, "direct"); assert.equal(bass.visual, "nasa");
  assert.ok(bass.direct.some((r) => r.id === "bass2-B16"));
  assert.equal(a(p("iss")).cls, "direct");
  for (const id of ["moon", "mars"]) { const x = a(p(id)); assert.notEqual(x.cls, "direct"); assert.equal(x.visual, "unknown"); assert.equal(x.observed, null); }
  const earth = a(p("earth")); assert.notEqual(earth.cls, "direct"); assert.equal(earth.visual, "conceptual"); assert.equal(earth.observed, null);
});

test("an outcome is shown only when a NASA test matches; disagreeing tests are reported as mixed", () => {
  for (const g of ["earth", "moon", "mars", "orbit"] as const) for (const o2 of [16, 21, 30, 34]) for (const flow of [0, 2, 5, 10]) for (const material of ["PMMA", "SIBAL fabric", "Nomex", "Silicone"]) {
    const x = a({ gravity: g, o2, kpa: o2 > 28 ? 56.5 : 101.3, flow, material });
    if (x.observed) { assert.equal(x.cls, "direct"); assert.ok(x.direct.length > 0); }
    if (x.cls !== "direct") assert.equal(x.observed, null);
    if (g === "mars") assert.notEqual(x.cls, "direct");
    if (x.observed && x.observed.group !== "mixed") assert.ok(x.direct.every((r) => r.outcome === x.observed!.group));
  }
});

test("the closest record's rows are a heuristic distance with explicit unknowns", () => {
  const x = a(p("bass"));
  assert.notEqual(x.rows.find((r) => r.dim === "Pressure")?.status, "outside");
  const moon = a(p("moon"));
  assert.equal(moon.closest?.family, "luci"); // simulated lunar gravity, so gravity is close, never a match
  assert.equal(moon.rows.find((r) => r.dim === "Gravity")?.status, "close");
  assert.equal(detectiveAnswer(records, findings), moon.largest);
  assert.ok(moon.largest);
});

test("explanations cite real findings and both voices rest on the same evidence", () => {
  const ids = new Set(findings.map((f: { id: string }) => f.id));
  for (const pr of PRESETS) for (const e of explain(pr.cfg)) {
    assert.ok(e.explorer && e.scientist);
    for (const id of e.findingIds) assert.ok(ids.has(id), `${id} missing`);
  }
});

test("notebook records abstentions; missions and patches follow the runs", () => {
  const runs = [p("earth"), { ...p("earth"), gravity: "orbit" as const }, p("moon")].map((c, i) => recordRun(i + 1, c, a(c)));
  assert.equal(runs[2].abstained, true);
  assert.match(runs[2].result, /Abstained/);
  assert.deepEqual(differing(runs.slice(0, 2)), ["gravity"]);
  const done = new Set(MISSIONS.filter((m) => m.done(runs)).map((m) => m.id));
  assert.ok(done.has("buoyancy") && done.has("limit"));
  const patches = PATCHES.filter((x) => x.earned(runs, done)).map((x) => x.id);
  assert.ok(patches.includes("guardian") && patches.includes("gravity"));
});
