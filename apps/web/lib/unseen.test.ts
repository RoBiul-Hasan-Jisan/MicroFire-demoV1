import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Model } from "./model.ts";
import { unseenCell, unseenGrid, visibilityClass } from "./unseen.ts";

const model = JSON.parse(readFileSync(new URL("../data/model.json", import.meta.url), "utf8")) as Model;
const findings = JSON.parse(readFileSync(new URL("../data/findings.json", import.meta.url), "utf8")) as { id: string }[];

test("the thresholds come from NASA findings that exist in the atlas", () => {
  for (const id of ["dim-blue-low-flow", "low-flow-sensitivity", "tiny-flame-undetected"]) assert.ok(findings.some((f) => f.id === id), id);
});

test("classes follow the cited airflow thresholds", () => {
  assert.equal(visibilityClass(0.5), "dim-blue");
  assert.equal(visibilityClass(1), "flow-sensitive");
  assert.equal(visibilityClass(4.9), "flow-sensitive");
  assert.equal(visibilityClass(5), "no-cited-concern");
});

test("below the lowest tested airflow the model stays silent instead of guessing", () => {
  const c = unseenCell(model, 21, 0.5);
  assert.equal(c.modelValid, false);
  assert.equal(c.p, undefined);
  assert.equal(c.verdict, "hidden-burn-possible");
});

test("inside the tested range the model speaks and the verdict follows its estimate", () => {
  const hi = unseenCell(model, 28, 4);
  assert.equal(hi.modelValid, true);
  assert.ok(hi.p !== undefined);
  assert.ok(["may-burn-small", "likely-goes-out"].includes(hi.verdict));
});

test("grid covers every airflow and oxygen step and marks the untested rows", () => {
  const g = unseenGrid(model);
  assert.ok(g.length > 5 && g[0].length > 5);
  assert.ok(g.flat().some((c) => c.verdict === "hidden-burn-possible"));
  assert.ok(g.flat().every((c) => c.modelValid || c.p === undefined));
});
