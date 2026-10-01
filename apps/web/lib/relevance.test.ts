// node --test lib/   (Node ≥ 23 strips the types)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rank, confidence, flowRange, outsideEvidence } from "./relevance.ts";
import type { Experiment } from "./types";

const all: Experiment[] = JSON.parse(readFileSync(new URL("../data/experiments.json", import.meta.url), "utf8"));
const byId = (id: string) => all.find((e) => e.id === id)!;

test("exact match ranks first with score 1", () => {
  const b19 = byId("bass2-B19");
  const r = rank(all, { oxygen: 16.4, flow: 10, material: "PMMA", flowDirection: "opposed", thicknessMm: 0.1, widthMm: 20 });
  assert.equal(r[0].experiment.id, "bass2-B19");
  assert.equal(r[0].score, 1);
  assert.equal(r[0].coverage, 1);
  assert.ok(b19);
});

test("missing values never raise a score", () => {
  // Nomex rows have no thickness or width; asking about them must lower, not keep, their score.
  const base = rank(all, { material: "Nomex" }).find((x) => x.experiment.id === "bass2-F1")!;
  const withMissing = rank(all, { material: "Nomex", thicknessMm: 0.3 }).find((x) => x.experiment.id === "bass2-F1")!;
  assert.equal(base.score, 1);
  assert.ok(withMissing.score < base.score);
  assert.ok(withMissing.coverage < 1);
});

test("ranking is deterministic", () => {
  const s = { oxygen: 18, flow: 4 };
  assert.deepEqual(
    rank(all, s).map((x) => x.experiment.id),
    rank([...all].reverse(), s).map((x) => x.experiment.id),
  );
});

test("a flow inside the tested range counts as a full flow match", () => {
  const t4 = byId("sibal-GMT45-T4"); // 10 → 2.2 cm/s
  assert.deepEqual(flowRange(t4), [2.2, 10]);
  const r = rank([t4], { flow: 5 })[0];
  assert.equal(r.terms[0].sim, 1);
});

test("same material class earns partial credit only", () => {
  const r = rank(all, { material: "SIBAL fabric" });
  const nomex = r.find((x) => x.experiment.material === "Nomex")!;
  const pmma = r.find((x) => x.experiment.material === "PMMA")!;
  assert.equal(nomex.score, 0.5);
  assert.equal(pmma.score, 0);
});

test("confidence reflects NASA's own flags", () => {
  const suspect = confidence(byId("sibal-GMT45-T1"), all);
  assert.equal(suspect.checks.find((c) => c.label.startsWith("Oxygen"))!.pass, false);
  const solid = confidence(byId("bass2-B19"), all);
  assert.ok(solid.score > suspect.score);
});

test("exploration atmosphere is flagged as outside the evidence", () => {
  const notes = outsideEvidence(all, { oxygen: 34, pressureKpa: 56.5, gravity: "lunar" });
  assert.equal(notes.length, 3);
  assert.deepEqual(outsideEvidence(all, { oxygen: 18, flow: 5, pressureKpa: 101 }), []);
});

test("gravity mismatch lowers every score equally and never reorders by itself", () => {
  const micro = rank(all, { oxygen: 18, flow: 5, gravity: "microgravity" });
  const lunar = rank(all, { oxygen: 18, flow: 5, gravity: "lunar" });
  assert.deepEqual(micro.map((r) => r.experiment.id), lunar.map((r) => r.experiment.id));
  assert.ok(lunar[0].score < micro[0].score);
});

test("pressure inside a series range counts as a match", () => {
  const r = rank([byId("bass2-B19")], { pressureKpa: 99.3 })[0];
  assert.equal(r.score, 1);
});
