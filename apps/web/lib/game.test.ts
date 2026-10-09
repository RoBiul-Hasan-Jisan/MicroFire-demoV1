import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PARTS, PREDICTIONS, LAB_TARGET, blockedBy } from "./game.ts";

const read = (f: string) => JSON.parse(readFileSync(new URL(`../data/${f}.json`, import.meta.url), "utf8"));
const exps = new Map(read("experiments").map((e: { id: string }) => [e.id, e]));
const finds = new Set(read("findings").map((f: { id: string }) => f.id));
type E = { oxygen_vol_pct: number; flow_initial_cm_s: number; flow_final_cm_s: number | null; outcome: string };

test("every part cites a verified NASA quote and depends on a real part", () => {
  const ids = new Set(PARTS.map((p) => p.id));
  for (const p of PARTS) {
    assert.ok(finds.has(p.finding), `${p.id}: ${p.finding}`);
    if (p.needs) assert.ok(ids.has(p.needs), `${p.id} needs ${p.needs}`);
  }
});

test("assembly order rules", () => {
  const igniter = PARTS.find((p) => p.id === "igniter")!;
  assert.ok(blockedBy(igniter, new Set(["duct"])));
  assert.equal(blockedBy(igniter, new Set(["duct", "holder"])), null);
  assert.equal(blockedBy(PARTS.find((p) => p.id === "duct")!, new Set()), null);
});

test("ignition lab target is test B20's recorded start", () => {
  const b20 = exps.get(LAB_TARGET.testId) as E;
  assert.equal(b20.oxygen_vol_pct, LAB_TARGET.o2);
  assert.equal(b20.flow_initial_cm_s, LAB_TARGET.flow);
});

test("prediction answers match NASA's records", () => {
  for (const p of PREDICTIONS) {
    assert.equal(p.choices.filter((c) => c.correct).length, 1, p.id);
    if (p.finding) assert.ok(finds.has(p.finding), p.id);
  }
  assert.equal((exps.get("bass2-B16") as E).outcome, "quenched_low_flow");
  assert.equal((exps.get("bass2-B19") as E).outcome, "blowoff");
  // fabric reveal quotes 2.2 cm/s at 18.7 % and 2.8 cm/s at 16.9 %
  const t4 = exps.get("sibal-GMT45-T4") as E, t14 = exps.get("sibal-GMT178-T14") as E;
  assert.deepEqual([t4.flow_final_cm_s, t4.oxygen_vol_pct, t14.flow_final_cm_s, t14.oxygen_vol_pct], [2.2, 18.7, 2.8, 16.9]);
});

test("fabric line-up matches every recorded SIBAL quench row exactly", async () => {
  const { FABRIC_QUENCH } = await import("./game.ts");
  type R = E & { id: string; material: string; test_id: string };
  const rows = (read("experiments") as R[]).filter((e) => e.material === "SIBAL fabric" && e.outcome === "quenched_low_flow");
  assert.equal(FABRIC_QUENCH.length, rows.length, "every quenched fabric row is on the chart");
  for (const f of FABRIC_QUENCH) {
    const e = exps.get(f.id) as R;
    assert.equal(e.test_id, f.test);
    assert.equal(e.oxygen_vol_pct, f.o2);
    assert.equal(e.flow_final_cm_s, f.quench);
  }
});

test("log clues point at real tests; Moon air matches the cited finding", async () => {
  const { LOG_CLUES, MOON_AIR } = await import("./game.ts");
  for (const c of LOG_CLUES) assert.ok(exps.has(c.id), c.id);
  const q = (read("findings") as { id: string; quote: string }[]).find((f) => f.id === "exploration-atmosphere")!.quote;
  assert.ok(q.includes(String(MOON_AIR.o2)) && q.includes(String(MOON_AIR.kpa)), q);
});

test("B16 and B19 endpoints are the logged values", () => {
  type F = { flow_initial_cm_s: number; flow_verbatim: string };
  const b16 = exps.get("bass2-B16") as F, b19 = exps.get("bass2-B19") as F, b20 = exps.get("bass2-B20") as F;
  assert.equal(b16.flow_initial_cm_s, 3);
  assert.match(b16.flow_verbatim, /0\.4 pot$/);
  assert.equal(b19.flow_initial_cm_s, 10);
  assert.equal(b20.flow_initial_cm_s, 5);
});
