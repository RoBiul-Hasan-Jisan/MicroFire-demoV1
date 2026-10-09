import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rankRobustness, ladderRobustness } from "./robustness.ts";
import { fromBass, fromSaffire } from "./ontology.ts";

const exps = JSON.parse(readFileSync(new URL("../data/experiments.json", import.meta.url), "utf8"));
const saffire = JSON.parse(readFileSync(new URL("../data/saffire.json", import.meta.url), "utf8"));
const records = [...exps.map(fromBass), ...saffire.map(fromSaffire)];

test("rank robustness is repeatable and covers every test", () => {
  const s = { oxygen: 16.5, flow: 5, material: "PMMA", gravity: "microgravity" as const };
  const a = rankRobustness(exps, s, 200), b = rankRobustness(exps, s, 200);
  assert.equal(a.size, exps.length);
  assert.deepEqual([...a.entries()], [...b.entries()]);
  for (const v of a.values()) assert.ok(v.lo <= v.median && v.median <= v.hi && v.top3 >= 0 && v.top3 <= 1);
});

test("an exact-match scenario ranks its test first under every variation", () => {
  const e = exps.find((x: { test_id: string }) => x.test_id === "B20");
  const s = { oxygen: e.oxygen_vol_pct, flow: e.flow_initial_cm_s, material: e.material, gravity: "microgravity" as const, thicknessMm: e.thickness_mm, widthMm: e.width_mm, flowDirection: e.flow_direction };
  const r = rankRobustness(exps, s, 200).get(e.id)!;
  assert.equal(r.median, 1);
});

test("the lunar exploration-atmosphere question never gains direct evidence by loosening tolerances", () => {
  const l = ladderRobustness(records, [], { material: "PMMA", oxygen: 34, pressureKpa: 56.5, gravity: "lunar", flow: 20 }, 300);
  assert.equal(l.directEmpty, 1); // no orbit test is lunar gravity, whatever the tolerances
  assert.ok(l.closest && l.closest.first > 0);
  assert.ok(Math.abs((l.gapDims.gravity ?? 0) - 1) < 1e-9);
});
