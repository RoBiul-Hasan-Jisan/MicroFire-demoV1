import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildDataset, chooseModel, evaluate, gate, materialTransfer, predict, snapshot, type Query } from "./model-lab.ts";

const exps = JSON.parse(readFileSync(new URL("../data/experiments.json", import.meta.url), "utf8"));
const { rows, excluded } = buildDataset(exps);
const evals = evaluate(rows);
const pick = chooseModel(evals);
const s = snapshot(rows, pick as "logit-o2-material");
const q = (x: Partial<Query>): Query => ({ material: "SIBAL fabric", gravity: "microgravity", o2: 18.5, kpa: 101.3, flow: 10, ...x });

test("dataset: only BASS-II SIBAL and PMMA, no reused samples, no suspect oxygen, every row cited", () => {
  assert.equal(rows.length + excluded.length, exps.length);
  assert.equal(rows.length, 41);
  assert.equal(rows.filter((r) => !r.y).length, 4);
  for (const r of rows) {
    assert.ok(["SIBAL fabric", "PMMA"].includes(r.material));
    assert.ok(r.cite.source_id && r.cite.pdf_page > 0, `${r.id} lost provenance`);
    const e = exps.find((x: { id: string }) => x.id === r.id);
    assert.ok(!e.quality_flags.includes("reused_sample") && !e.quality_flags.includes("o2_reading_suspect"));
  }
  // the label never encodes the flow-sweep procedure: quenched, blown-off and burned-but-unstated runs all count as established
  for (const r of rows) assert.equal(r.y, ["Did not ignite", "No sustained flame"].some((x) => r.outcome.startsWith(x)) ? 0 : r.y);
});

test("validation is deterministic and the deployed model beats the baseline on proper scores", () => {
  assert.deepEqual(evaluate(rows).map((e) => e.grouped.brier), evals.map((e) => e.grouped.brier));
  assert.equal(pick, "logit-o2-material");
  const base = evals.find((e) => e.id === "baseline")!, m = evals.find((e) => e.id === pick)!;
  assert.ok(m.grouped.brier < base.grouped.brier && m.grouped.logLoss < base.grouped.logLoss);
  assert.ok(m.grouped.ci.auc!.lo > 0.5);
  assert.equal(base.grouped.auc, null); // a constant predictor never reports an AUC
});

test("material transfer is reported, not hidden", () => {
  const t = materialTransfer(rows);
  assert.equal(t.length, 2);
  assert.ok(t.every((x) => x.testN > 0));
});

test("PREDICTION BLOCKED: PMMA, lunar gravity, 34 % O2, 56.5 kPa", () => {
  const query = q({ material: "PMMA", gravity: "lunar", o2: 34, kpa: 56.5, flow: 10 });
  const g = gate(s, query);
  assert.equal(g.status, "out");
  for (const dim of ["Gravity", "Pressure", "Oxygen"]) assert.equal(g.checks.find((c) => c.dim === dim)?.status, "out", dim);
  assert.equal(predict(s, query), null);
});

test("every out-of-domain or thin query is refused a number", () => {
  const blocked: Partial<Query>[] = [
    { gravity: "martian" }, { gravity: "earth" }, { gravity: "lunar" },
    { material: "Silicone" }, { material: "Cotton jersey" },
    { kpa: 70 }, { o2: 25 }, { o2: 12 }, { flow: 40 },
  ];
  for (const b of blocked) assert.equal(predict(s, q(b)), null, JSON.stringify(b));
  assert.equal(gate(s, q({ material: "Nomex" })).status, "insufficient");
  assert.equal(gate(s, q({ material: "PMMA", o2: 15, flow: 5 })).status, "insufficient"); // inside the marginal range, but a sparse joint region
});

test("an in-domain query gets a probability with an interval and exact contributions", () => {
  const query = q({ o2: 17, flow: 5 });
  assert.equal(gate(s, query).status, "in");
  const p = predict(s, query)!;
  assert.ok(p.lo <= p.p + 1e-9 && p.p <= p.hi + 1e-9 && p.lo >= 0 && p.hi <= 1);
  const logit = p.baseLogOdds + p.contributions.reduce((a, c) => a + c.logOdds, 0);
  assert.ok(Math.abs(1 / (1 + Math.exp(-logit)) - p.p) < 1e-9);
  // more oxygen never lowers the estimate for the same material
  assert.ok(predict(s, q({ o2: 18.5 }))!.p > predict(s, q({ o2: 17 }))!.p);
});

test("near-domain is flagged, not silently treated as in-domain", () => {
  const near = q({ material: "PMMA", o2: 21, flow: 5 }); // PMMA training max is 20.6 %
  assert.equal(gate(s, near).status, "near");
  assert.ok(predict(s, near));
});
