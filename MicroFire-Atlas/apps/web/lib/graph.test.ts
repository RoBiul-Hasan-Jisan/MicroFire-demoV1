import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fromBass, fromSaffire, whyPath } from "./ontology.ts";
import { FRONTIER } from "./frontier.ts";
import { buildGraph } from "./graph.ts";

const read = (n: string) => JSON.parse(readFileSync(new URL(`../data/${n}.json`, import.meta.url), "utf8"));
const records = [...read("experiments").map(fromBass), ...read("saffire").map(fromSaffire)];

test("every graph edge connects two existing nodes, and every record is sourced", () => {
  const g = buildGraph(records, read("findings"), read("sources"), FRONTIER);
  const ids = new Set(g.nodes.map((n) => n.id));
  for (const e of g.edges) assert.ok(ids.has(e.from) && ids.has(e.to), `${e.type}: ${e.from} -> ${e.to}`);
  for (const r of records) assert.ok(g.edges.some((e) => e.type === "SOURCE_DOCUMENTS_RECORD" && e.to === `record:${r.id}`), r.id);
  assert.ok(g.edges.some((e) => e.type === "SCENARIO_MISSING" && e.from === "scenario:moon-base"));
});

test("the why-path explains Saffire VI-3 for the Moon base step by step", () => {
  const steps = whyPath(records.find((r) => r.id === "saffire-vi-3")!, { material: "PMMA", oxygen: 34, pressureKpa: 56.5, gravity: "lunar" });
  assert.deepEqual(steps.map((s) => s.kind), ["question", "match", "match", "differs", "differs", "match", "rung"]);
  assert.match(steps.at(-1)!.text, /Analogous evidence: differs in gravity, oxygen/);
});
