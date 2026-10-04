import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fromBass, fromSaffire } from "./ontology.ts";
import type { Experiment, Finding, SaffireRun } from "./types";
const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const evidenceRecords = [...(read("../data/experiments.json") as Experiment[]).map(fromBass), ...(read("../data/saffire.json") as SaffireRun[]).map(fromSaffire)];
const findings = read("../data/findings.json") as Finding[];
import { gradeMaterials, parseList, resolveMaterial, toCsv } from "./materials-bulk.ts";

test("common names resolve to the atlas materials", () => {
  assert.equal(resolveMaterial("Plexiglas").canonical, "PMMA");
  assert.equal(resolveMaterial("acrylic sheet").canonical, "PMMA");
  assert.equal(resolveMaterial("Nomex® III").canonical, "Nomex");
  assert.equal(resolveMaterial("cotton-fiberglass blend").canonical, "SIBAL fabric");
  assert.equal(resolveMaterial("titanium").canonical, null);
});

test("a bare 'cotton' is ambiguous and says which two it could be", () => {
  const r = resolveMaterial("cotton");
  assert.equal(r.canonical, null);
  assert.deepEqual(r.ambiguous, ["Cotton jersey", "SIBAL fabric"]);
});

test("lists split on lines, semicolons and commas, drop duplicates and blanks", () => {
  assert.deepEqual(parseList("PMMA, Nomex\nnomex;; Silicone\n\n"), ["PMMA", "Nomex", "Silicone"]);
  assert.equal(parseList(Array.from({ length: 80 }, (_, i) => `m${i}`).join("\n")).length, 50);
});

test("an unknown material is a gap, never a pass", () => {
  const [r] = gradeMaterials(["Kevlar-wrapped foam"], { oxygen: 21, pressureKpa: 101.3, gravity: "microgravity" }, evidenceRecords, findings);
  assert.equal(r.grade, "gap");
  assert.match(r.note, /not a safety finding/);
});

test("lunar gravity can never be graded 'direct' because the atlas has no partial-gravity test", () => {
  const rows = gradeMaterials(["PMMA", "SIBAL", "Nomex", "Silicone"], { oxygen: 34, pressureKpa: 56.5, gravity: "lunar" }, evidenceRecords, findings);
  for (const r of rows) assert.notEqual(r.grade, "direct", r.input);
  const pmma = rows[0];
  assert.equal(pmma.grade, "analogous");
  assert.ok(pmma.closest?.differs.some((d) => /lunar/.test(d)));
});

test("a microgravity cabin with conditions NASA tested is graded direct", () => {
  const [r] = gradeMaterials(["SIBAL fabric"], { oxygen: 21, gravity: "microgravity" }, evidenceRecords, findings);
  assert.equal(r.grade, "direct");
  assert.ok(r.tests > 0);
});

test("csv output escapes quotes and has one line per material plus a header", () => {
  const rows = gradeMaterials(['He said "PMMA"', "Nomex"], { gravity: "lunar" }, evidenceRecords, findings);
  const csv = toCsv(rows);
  assert.equal(csv.split("\n").length, 3);
  assert.ok(csv.includes('""PMMA""'));
});
