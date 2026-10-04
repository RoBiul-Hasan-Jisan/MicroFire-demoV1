import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyze, compareFromBass, compareFromSaffire } from "./compare.ts";

const read = (n: string) => JSON.parse(readFileSync(new URL(`../data/${n}.json`, import.meta.url), "utf8"));
const bass = new Map(read("experiments").map((e: { id: string }) => [e.id, e]));
const saffire = new Map(read("saffire").map((r: { id: string }) => [r.id, r]));
const B = (id: string) => compareFromBass(bass.get(id) as never);
const S = (id: string) => compareFromSaffire(saffire.get(id) as never);

test("B16/B20/B19: everything but airflow held, outcomes differ, no causal claim allowed", () => {
  const a = analyze(["bass2-B16", "bass2-B20", "bass2-B19"].map(B));
  assert.deepEqual(a.changed.map((c) => c.label), ["Airflow"]);
  for (const h of ["Material", "Thickness", "Sample width", "Flow direction", "Oxygen", "Pressure"]) assert.ok(a.held.some((x) => x.label === h), h);
  assert.match(a.canSay.join(" "), /outcome changed when the recorded airflow changed/);
  assert.match(a.cantSay[0], /airflow alone caused/);
  assert.equal(a.crossFamily, null);
});

test("Saffire IV-1 vs VI-2: pressure and oxygen changed together, so neither can be credited", () => {
  const a = analyze(["saffire-iv-1", "saffire-vi-2"].map(S));
  assert.deepEqual(a.changed.map((c) => c.label).sort(), ["Oxygen", "Pressure"]);
  assert.match(a.cantSay[0], /more than one changed at once/);
});

test("crossing families raises a comparability warning", () => {
  const a = analyze([B("sibal-GMT222-T11"), S("saffire-2-5"), S("saffire-1-1")]);
  assert.equal(a.crossFamily?.length, 2);
  assert.ok(a.changed.some((c) => c.label === "Sample width"));
  assert.ok(a.cantSay.some((c) => /interchangeable/.test(c)));
});
