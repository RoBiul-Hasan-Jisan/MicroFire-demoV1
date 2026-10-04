import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => JSON.parse(readFileSync(new URL(`../data/${p}`, import.meta.url), "utf8"));
const loc = read("loc_curve.json"), press = read("pressure_report.json"), vis = read("visibility_measured.json"), sens = read("next_experiments_sensitivity.json");

test("the limiting-oxygen curve only falls as airflow rises (it is monotonic by construction) and says so", () => {
  for (const dir of ["concurrent", "opposed"] as const) {
    const o = loc.curves[dir].map((r: { o2_p50: number }) => r.o2_p50);
    for (let i = 1; i < o.length; i++) assert.ok(o[i] <= o[i - 1] + 1e-9, `${dir} ${i}`);
    for (const r of loc.curves[dir]) assert.ok(r.o2_p05 <= r.o2_p50 && r.o2_p50 <= r.o2_p95);
  }
  assert.ok(loc.limits.some((l: string) => /cannot show a turnover/.test(l)));
});

test("opposed flow needs no more oxygen than concurrent in this model at every airflow", () => {
  loc.curves.concurrent.forEach((c: { o2_p50: number }, i: number) => assert.ok(loc.curves.opposed[i].o2_p50 <= c.o2_p50 + 1e-9));
});

test("the pressure check never claims a result the data cannot support", () => {
  assert.ok(press.n_with_pressure < press.n_usable_total);
  assert.ok(press.n_series <= 5);
  assert.equal(press.verdict, "cannot_tell");
  assert.ok(press.caveats.some((c: string) => /never guessed/.test(c)));
});

test("measured visibility only builds a curve from items with a cited airflow", () => {
  assert.equal(vis.curve_available, vis.curve_points.length >= 4);
  for (const p of vis.curve_points) assert.ok(p.flow_cm_s != null);
  for (const i of vis.items) assert.equal(i.in_curve, vis.curve_points.some((p: { slug: string }) => p.slug === i.slug));
});

test("sensitivity covers the buoyancy, exponent and extrapolation assumptions and keeps partial gravity in the plan", () => {
  const ids = sens.settings.map((s: { id: string }) => s.id);
  for (const id of ["default", "weak-buoyancy", "strong-buoyancy", "n-third", "n-half", "kappa-low", "kappa-high"]) assert.ok(ids.includes(id), id);
  assert.equal(sens.always_includes_partial_gravity_test, true);
  for (const s of sens.default_picks_survival) assert.ok(s.appears_in >= 1 && s.appears_in <= s.of);
});
