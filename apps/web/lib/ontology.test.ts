import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fromBass, fromSaffire, ladder, differences, SOURCE_FAMILY, FAMILIES } from "./ontology.ts";

const read = (n: string) => JSON.parse(readFileSync(new URL(`../data/${n}.json`, import.meta.url), "utf8"));
const records = [...read("experiments").map(fromBass), ...read("saffire").map(fromSaffire)];
const findings = read("findings");
const sources = read("sources");

test("every NASA source belongs to a family, and families never mix fuel phases", () => {
  for (const s of sources) assert.ok(SOURCE_FAMILY[s.source_id], `no family for ${s.source_id}`);
  assert.equal(FAMILIES.flex.phase, "liquid");
  assert.equal(FAMILIES.acme.phase, "gas");
  assert.equal(FAMILIES.saffire.phase, "solid");
});

test("the Moon-habitat question has no direct evidence and names its gaps", () => {
  const l = ladder(records, findings, { material: "PMMA", oxygen: 34, pressureKpa: 56.5, gravity: "lunar" });
  assert.equal(l.direct.length, 0);
  const dims = l.gaps.map((g) => g.dim);
  assert.ok(dims.includes("gravity"));
  assert.ok(dims.includes("oxygen")); // highest recorded is Saffire VI-2 at 31.0 %
  assert.ok(!dims.includes("pressure")); // Saffire VI ran at 54.1 to 55.2 kPa
  // closest solid-fuel evidence: Saffire VI PMMA near 55 kPa, differing in gravity and oxygen only
  const top = l.analogous.slice(0, 2).map((x) => x.record.id).sort();
  assert.deepEqual(top, ["saffire-vi-3", "saffire-vi-4"]);
  assert.deepEqual(l.analogous[0].differs.map((d) => d.dim).sort(), ["gravity", "oxygen"]);
  // droplets and gas flames only ever appear as mechanistic evidence
  assert.ok(l.findings.mechanistic.every((f) => f.family.phase !== "solid"));
  assert.ok(l.findings.analogous.every((f) => f.family.phase === "solid"));
  assert.ok(l.findings.analogous.some((f) => f.finding.source_id === "luci"));
  assert.match(l.nextExperiment ?? "", /PMMA, 34 % O₂, 56.5 kPa, lunar gravity/);
});

test("a question BASS-II answered directly lands on the direct rung", () => {
  const l = ladder(records, findings, { material: "PMMA", oxygen: 16.5, flow: 5, gravity: "microgravity" });
  assert.ok(l.direct.some((x) => x.record.id === "bass2-B20"));
  assert.equal(l.gaps.length, 0);
  assert.equal(l.nextExperiment, null);
});

test("an unrecorded value is a difference, never a match", () => {
  const vi1 = records.find((r) => r.id === "saffire-vi-1")!; // Nomex, conditions not stated per sample
  const d = differences(vi1, { oxygen: 30, pressureKpa: 55 });
  assert.deepEqual(d.map((x) => [x.dim, x.unknown]), [["oxygen", true], ["pressure", true]]);
});
