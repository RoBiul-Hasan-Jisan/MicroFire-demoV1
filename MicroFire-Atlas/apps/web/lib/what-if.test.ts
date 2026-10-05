import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildDataset, predict, snapshot, type Query } from "./model-lab.ts";
import { coverage, evaluateSide, interventions, localRows, whatIf, wilson } from "./what-if.ts";

const exps = JSON.parse(readFileSync(new URL("../data/experiments.json", import.meta.url), "utf8"));
const s = snapshot(buildDataset(exps).rows, "logit-o2-material");
const q = (x: Partial<Query> = {}): Query => ({ material: "SIBAL fabric", gravity: "microgravity", o2: 18.5, kpa: 101.3, flow: 10, ...x });
const PRESSURE = { n: 20, of: 49 };

test("wilson: no records means no information; more records narrow the interval", () => {
  assert.deepEqual(wilson(0, 0), [0, 1]);
  const [a, b] = wilson(3, 6), [c, d] = wilson(30, 60);
  assert.ok(b - a > d - c);
  for (const [l, h] of [wilson(0, 5), wilson(5, 5), wilson(2, 9)]) assert.ok(l >= 0 && h <= 1 && l <= h);
});

test("envelope is never narrower than the model's own interval and is blocked outside the domain", () => {
  const side = evaluateSide(s, q());
  assert.ok(side.pred);
  assert.equal(side.env.tier, "supported");
  assert.ok(side.env.lo! <= side.pred!.lo + 1e-12 && side.env.hi! >= side.pred!.hi - 1e-12);
  assert.ok(side.env.lo! <= side.env.p! && side.env.p! <= side.env.hi!);
  const moon = evaluateSide(s, q({ gravity: "lunar", o2: 34, kpa: 56.5 }));
  assert.equal(moon.env.tier, "blocked");
  assert.equal(moon.env.p, null); assert.equal(moon.env.lo, null); assert.equal(moon.env.hi, null);
});

test("what-if: no change gives no delta; the estimate matches the Model Lab exactly", () => {
  const w = whatIf(s, q(), {});
  assert.deepEqual(w.changed, []);
  assert.equal(w.base.pred!.p, predict(s, q())!.p);
  const m = whatIf(s, q(), { o2: 16.5 });
  assert.deepEqual(m.changed, ["o2"]);
  assert.equal(m.modified.pred!.p, predict(s, q({ o2: 16.5 }))!.p);
  assert.ok(Math.abs(m.delta!.pp - (m.modified.pred!.p - m.base.pred!.p) * 100) < 1e-9);
  // lower oxygen must not raise the estimate for fabric (the model's oxygen weight is positive)
  assert.ok(m.delta!.pp <= 0);
});

test("what-if: per-feature log-odds shifts sum to the total log-odds change (exact for the linear model)", () => {
  const m = whatIf(s, q(), { o2: 17 });
  const logit = (p: number) => Math.log(p / (1 - p));
  const sum = m.delta!.byFeature.reduce((a, f) => a + f.logOdds, 0);
  assert.ok(Math.abs(sum - (logit(m.modified.pred!.p) - logit(m.base.pred!.p))) < 1e-9);
});

test("what-if: leaving the tested conditions blocks the number and ends the comparison, never extrapolates", () => {
  for (const change of [{ gravity: "lunar" as const }, { gravity: "martian" as const }, { o2: 34 }, { kpa: 56.5 }, { material: "Nomex" }]) {
    const w = whatIf(s, q(), change);
    assert.equal(w.modified.pred, null, JSON.stringify(change));
    assert.equal(w.delta, null);
    assert.match(w.reading, /blocks it|outside the tested/);
  }
  const from = whatIf(s, q({ gravity: "lunar", o2: 34, kpa: 56.5 }), { gravity: "microgravity" });
  assert.equal(from.base.pred, null); assert.equal(from.delta, null);
});

test("what-if: overlapping envelopes are reported as indistinguishable", () => {
  const w = whatIf(s, q(), { o2: 18.3 });
  assert.ok(w.delta);
  assert.equal(w.delta!.distinguishable, false);
  assert.match(w.reading, /cannot distinguish/);
});

test("interventions: gap levers come last, carry no estimate, and modelled levers match the engine", () => {
  const L = interventions(s, q(), PRESSURE);
  const kinds = L.map((l) => l.kind);
  assert.equal(kinds.join(",").replace(/modelled,?/g, "M,").includes("gap,M"), false);
  assert.deepEqual(kinds.slice(-3), ["gap", "gap", "gap"]);
  for (const l of L) if (l.kind === "gap") { assert.ok(!("result" in l) && !("modified" in l)); assert.match(l.why, /Nothing is estimated/); }
  const o2 = L.find((l) => l.id === "o2-2");
  assert.ok(o2 && o2.kind === "modelled");
  assert.equal(o2!.kind === "modelled" && o2!.result.modified.pred!.p, predict(s, q({ o2: 16.5 }))!.p);
  const flow = L.find((l) => l.id === "flow-double");
  assert.ok(flow && flow.kind === "records");
  if (flow.kind === "records") assert.equal(flow.support, localRows(s, q({ flow: 20 })).length);
  assert.deepEqual(interventions(s, q(), PRESSURE).map((l) => l.id), L.map((l) => l.id));
});

test("interventions: records levers show no rate when fewer than the required tests are nearby", () => {
  const L = interventions(s, q({ flow: 24 }), PRESSURE);
  const dbl = L.find((l) => l.id === "flow-double")!;
  assert.ok(dbl.kind === "records" && dbl.support < 3 && dbl.interval === null);
});

test("interventions: an out-of-domain start yields no modelled numbers at all", () => {
  const L = interventions(s, q({ gravity: "lunar", o2: 34, kpa: 56.5 }), PRESSURE);
  for (const l of L) if (l.kind === "modelled") assert.equal(l.result.delta, null);
});

test("coverage grid uses the gate's own window and tiers", () => {
  const cells = coverage(s, "SIBAL fabric", [14, 31], [2, 25]);
  assert.equal(cells.length, 24 * 12);
  for (const c of cells.slice(0, 40)) {
    assert.equal(c.support, localRows(s, q({ o2: c.o2, flow: c.flow })).length);
    assert.equal(c.tier, c.support >= 3 ? "supported" : c.support > 0 ? "sparse" : "empty");
  }
  assert.ok(cells.some((c) => c.tier === "supported") && cells.some((c) => c.tier === "empty"));
});

test("wording: engine strings never call anything safe, unsafe or a risk score", () => {
  const all = JSON.stringify([whatIf(s, q(), { o2: 16 }), whatIf(s, q(), { gravity: "lunar" }), interventions(s, q(), PRESSURE)]);
  assert.doesNotMatch(all, /\b(is safe|is unsafe|risk score|safer|safest|recommend)/i);
});

test("material replacement is offered only for materials the model was trained on, and carries the sample-type caveat", () => {
  const L = interventions(s, q(), PRESSURE);
  const mats = L.filter((l) => l.id.startsWith("material-"));
  assert.deepEqual(mats.map((l) => l.id), Object.keys(s.domain).filter((m) => m !== "SIBAL fabric").map((m) => `material-${m}`));
  for (const l of mats) { assert.ok(l.kind === "modelled" && l.caveat && /not a like-for-like/.test(l.caveat)); assert.equal(l.result.modified.q.material, l.id.slice(9)); }
  assert.ok(!L.some((l) => /Nomex|Silicone|Cotton/.test(l.label)), "no lever for a material without usable tests");
});

test("sweepO2: points equal the engine, blocked points are null, and the model never falls as oxygen rises", async () => {
  const { sweepO2 } = await import("./what-if.ts");
  const pts = sweepO2(s, q());
  assert.ok(pts.length > 30 && pts[0].o2 === 14 && pts[pts.length - 1].o2 === 31);
  for (const pt of pts) {
    const side = evaluateSide(s, q({ o2: pt.o2 }));
    assert.equal(pt.p, side.env.p); assert.equal(pt.status, side.status);
    if (pt.p === null) assert.ok(pt.lo === null && pt.hi === null && pt.tier === "blocked");
    else assert.ok(pt.lo! <= pt.p && pt.p <= pt.hi!);
  }
  const live = pts.filter((x) => x.p !== null);
  assert.ok(live.length > 0 && live.length < pts.length, "some oxygen values are inside the tested range and some are not");
  for (let i = 1; i < live.length; i++) assert.ok(live[i].p! >= live[i - 1].p! - 1e-12);
  // far above the tested range must never produce a number
  assert.ok(pts.filter((x) => x.o2 >= 28).every((x) => x.p === null));
});

test("similarity: 1 only for the same material at zero distance, falls with distance, halves across materials", async () => {
  const { similarity } = await import("./what-if.ts");
  const { nearest } = await import("./model-lab.ts");
  const base = q();
  const ns = nearest(s, base, 8);
  for (const n of ns) { const v = similarity(base, n); assert.ok(v > 0 && v <= 1); }
  const exact = { row: s.rows.find((r) => r.material === "SIBAL fabric")!, dO2: 0, dFlow: 0, distance: 0 };
  assert.equal(similarity(base, exact), 1);
  assert.equal(similarity(base, { ...exact, row: { ...exact.row, material: "PMMA" } }), 0.5);
  assert.ok(similarity(base, { ...exact, distance: 2 }) < similarity(base, { ...exact, distance: 1 }));
});
