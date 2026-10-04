import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Model } from "./model.ts";
import { bridgePredict, buoyantFlow, checkClaims, effectiveFlow, type BridgeSpec, type Gravity } from "./gravity-bridge.ts";

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const model = read("../data/model.json") as Model;
const bridge = read("../data/gravity_bridge.json") as { spec: BridgeSpec; validation: { n: number; verdict: string }; check: { o2: number; forced: number; direction: "concurrent" | "opposed"; gravity: Gravity; p05: number; p50: number; p95: number }[] };

test("TypeScript bridge reproduces the numbers the Python pipeline wrote", () => {
  for (const c of bridge.check) {
    const r = bridgePredict(model, bridge.spec, c);
    assert.ok(Math.abs(r.p50 - c.p50) < 0.01, `p50 ${c.gravity} ${r.p50} vs ${c.p50}`);
    assert.ok(Math.abs(r.p05 - c.p05) < 0.01 && Math.abs(r.p95 - c.p95) < 0.01);
  }
});

test("buoyant flow grows with gravity and forced flow only adds to it", () => {
  assert.ok(buoyantFlow(20, 0.4, 0.3787) > buoyantFlow(20, 0.4, 0.1654));
  assert.equal(buoyantFlow(20, 0.4, 0), 0);
  assert.ok(effectiveFlow(10, 5, 0.05) > 10);
  assert.equal(effectiveFlow(0, 0, 0.05), 0.05);
});

test("at microgravity with forced flow the bridge reduces to the plain outcome model", () => {
  const r = bridgePredict(model, bridge.spec, { o2: 21, forced: 10, direction: "concurrent", gravity: "microgravity" });
  assert.ok(r.effectiveFlow[0] >= 9.99 && r.effectiveFlow[1] <= 10.01);
});

test("widening the assumed buoyant scale widens the interval, never narrows it", () => {
  const narrow = bridgePredict(model, bridge.spec, { o2: 21, forced: 0, direction: "concurrent", gravity: "lunar" }, { uRef: [20, 20], exponent: [0.4, 0.4] });
  const wide = bridgePredict(model, bridge.spec, { o2: 21, forced: 0, direction: "concurrent", gravity: "lunar" });
  assert.ok(wide.p95 - wide.p05 >= narrow.p95 - narrow.p05 - 1e-9);
});

test("no real partial-gravity rows yet means the bridge reports unvalidated", () => {
  assert.equal(bridge.validation.n, 0);
  assert.equal(bridge.validation.verdict, "unvalidated");
});

test("the scorecard keeps the independent test separate from claims that are not evidence", () => {
  const checks = checkClaims(model, bridge.spec);
  assert.equal(checks.filter((c) => c.verdict === "agrees" || c.verdict === "disagrees").length, 1);
  assert.ok(checks.some((c) => c.verdict === "not testable"));
  assert.ok(checks.some((c) => c.verdict === "direction only"));
});
