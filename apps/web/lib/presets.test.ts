import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PRESETS } from "./presets.ts";

const read = (f: string) => JSON.parse(readFileSync(new URL(`../data/${f}.json`, import.meta.url), "utf8"));
const exps = new Map(read("experiments").map((e: { id: string }) => [e.id, e]));
const findingIds = new Set(read("findings").map((f: { id: string }) => f.id));

test("every preset points at real tests and verified findings", () => {
  for (const p of PRESETS) {
    for (const id of p.ids) assert.ok(exps.has(id), `${p.id}: unknown test ${id}`);
    for (const f of p.findings) assert.ok(findingIds.has(f), `${p.id}: unknown finding ${f}`);
  }
});

test("numbers quoted in preset text match the dataset", () => {
  // Spot-check the quench preset, whose text restates final flows and oxygen.
  const want: Record<string, [number, number]> = {
    "sibal-GMT45-T4": [2.2, 18.7],
    "sibal-GMT100-T13": [2.2, 17.5],
    "sibal-GMT175-T18": [2.6, 17.4],
    "sibal-GMT178-T14": [2.8, 16.9],
  };
  for (const [id, [flow, o2]] of Object.entries(want)) {
    const e = exps.get(id) as { flow_final_cm_s: number; oxygen_vol_pct: number; outcome: string };
    assert.equal(e.flow_final_cm_s, flow);
    assert.equal(e.oxygen_vol_pct, o2);
    assert.equal(e.outcome, "quenched_low_flow");
  }
});
