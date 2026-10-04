import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildEvidence, checkAnswer, isRawAnswer, parseQuestion } from "./ask-core.ts";
import type { Experiment, Finding } from "./types";

const read = (f: string) => JSON.parse(readFileSync(new URL(`../data/${f}.json`, import.meta.url), "utf8"));
const exps: Experiment[] = read("experiments");
const finds: Finding[] = read("findings");

test("question parsing picks up conditions, material and test IDs", () => {
  const p = parseQuestion("What happened to PMMA at 16.5% oxygen and 10 cm/s in test b19 on the Moon?");
  assert.deepEqual(p.scenario, { oxygen: 16.5, flow: 10, gravity: "lunar", material: "PMMA" });
  assert.deepEqual(p.testIds, ["B19"]);
  assert.ok(p.topics.has("oxygen") && p.topics.has("partial-gravity"));
});

test("named tests are always in the evidence package", () => {
  const ev = buildEvidence("What changed between B16 and B19?", exps, finds);
  const keys = ev.items.map((i) => i.key);
  assert.ok(keys.includes("E:bass2-B16") && keys.includes("E:bass2-B19"));
});

test("partial-gravity questions bring the partial-gravity quotes and an outside-evidence note", () => {
  const ev = buildEvidence("Would PMMA burn on Mars at 21%?", exps, finds);
  assert.ok(ev.items.some((i) => i.key === "F:low-g-burns-lower-o2"));
  assert.ok(ev.outside.some((o) => /martian/i.test(o)));
});

test("citation check removes invented IDs and flags unsupported numbers", () => {
  const ev = buildEvidence("What happened in B19?", exps, finds);
  const checked = checkAnswer(
    {
      summary: "x",
      claims: [
        { text: "B19 blew out at 16.4 % oxygen.", type: "OBSERVED", cites: ["E:bass2-B19"] },
        { text: "B19 blew out at 12 % oxygen.", type: "OBSERVED", cites: ["E:bass2-B19"] },
        { text: "Test B99 burned.", type: "OBSERVED", cites: ["E:bass2-B99"] },
        { text: "Partial gravity is untested here.", type: "DATA_GAP", cites: [] },
      ],
    },
    ev.items,
  );
  assert.deepEqual(checked.map((c) => c.verified), [true, false, false, true]);
  // regression: "12" must not be accepted because the evidence mentions "PDF page 112"
  assert.ok(ev.items.find((i) => i.key === "E:bass2-B19")!.text.includes("112"));
  assert.equal(checked[2].cites.length, 0);
});

test("malformed model output is rejected", () => {
  assert.equal(isRawAnswer({ summary: "x", claims: [{ text: "y", type: "FACT", cites: [] }] }), false);
  assert.equal(isRawAnswer({ summary: "x", claims: [] }), true);
});

const saffire = read("saffire");

test("Saffire runs and findings join questions about scale, smoke or exploration air", () => {
  const big = buildEvidence("How big were the Saffire fires, and what about the smoke?", exps, finds, saffire);
  assert.ok(big.items.some((i) => i.key.startsWith("S:")));
  assert.ok(big.items.some((i) => i.key === "F:saffire-smoke-main-hazard"));
  const moon = buildEvidence("Would PMMA burn at 34% oxygen and 56.5 kPa on the Moon?", exps, finds, saffire);
  const keys = moon.items.map((i) => i.key);
  assert.ok(keys.includes("S:saffire-vi-3") && keys.includes("S:saffire-vi-4"));
  assert.ok(moon.items.filter((i) => i.kind === "test").every((i) => i.rung === "analogous")); // nothing is direct for the Moon
  const named = buildEvidence("What happened in Saffire VI-2?", exps, finds, saffire);
  assert.equal(named.items.find((i) => i.key.startsWith("S:"))?.key, "S:saffire-vi-2");
});

test("droplet and gas-flame findings are labelled mechanistic", () => {
  const ev = buildEvidence("What did the FLEX droplet tests find about the oxygen limit?", exps, finds, saffire);
  const flex = ev.items.filter((i) => i.family === "flex");
  assert.ok(flex.length > 0 && flex.every((i) => i.rung === "mechanistic"));
});

test("validators catch unit swaps, gravity mix-ups, causal wording and predictions", () => {
  const ev = buildEvidence("What happened in Saffire 1-1 and test B16 on the Moon?", exps, finds, saffire);
  const run = (text: string, type: "OBSERVED" | "INTERPRETATION" | "DATA_GAP", cites: string[]) =>
    checkAnswer({ summary: "", claims: [{ text, type, cites }] }, ev.items)[0];
  assert.equal(run("Saffire 1-1 spread at 1.8 mm/s.", "OBSERVED", ["S:saffire-1-1"]).verified, true);
  assert.match(run("Saffire 1-1 spread at 1.8 cm/s.", "OBSERVED", ["S:saffire-1-1"]).issues.join(), /Unit mismatch/);
  assert.match(run("Saffire 1-1 burned at lunar gravity for 420 s.", "OBSERVED", ["S:saffire-1-1"]).issues.join(), /Moon or Mars/);
  assert.equal(run("Saffire 1-1 was not a lunar-gravity test.", "OBSERVED", ["S:saffire-1-1"]).verified, true);
  assert.match(run("Reducing the airflow caused B16 to go out.", "INTERPRETATION", ["E:bass2-B16"]).issues.join(), /Causal/);
  assert.match(run("PMMA will burn on the Moon.", "INTERPRETATION", ["E:bass2-B16"]).issues.join(), /prediction/);
  assert.equal(run("We cannot say whether PMMA would burn on the Moon.", "DATA_GAP", []).verified, true);
  assert.match(run("This material is safe for a Moon base.", "INTERPRETATION", ["E:bass2-B16"]).issues.join(), /safety wording/);
});

test("verifier precision: formulas, the question's own numbers, arithmetic and negated safety words are not flagged", () => {
  const ev = buildEvidence("Compare Saffire VI-3 and VI-4.", exps, finds, saffire);
  const check = (text: string, type: "OBSERVED" | "DERIVED" | "INTERPRETATION" | "DATA_GAP", cites: string[], q = "") =>
    checkAnswer({ summary: "", claims: [{ text, type, cites }] }, ev.items, q)[0];
  assert.ok(check("VI-3 burned at 30.3 % O2 and 54.6 kPa.", "OBSERVED", ["S:saffire-vi-3"]).verified);
  assert.ok(check("VI-3 is the closest run to about 30 % at 54 kPa.", "OBSERVED", ["S:saffire-vi-3"], "Which runs used about 30% oxygen at 54 kPa?").verified);
  assert.ok(check("VI-4 burned 420 s longer than VI-3 (1200 s minus 780 s).", "DERIVED", ["S:saffire-vi-3", "S:saffire-vi-4"]).verified);
  assert.ok(!check("VI-4 burned 421 s longer than VI-3.", "DERIVED", ["S:saffire-vi-3", "S:saffire-vi-4"]).verified);
  assert.ok(!check("VI-3 burned for 420 s.", "OBSERVED", ["S:saffire-vi-3", "S:saffire-vi-4"]).verified); // arithmetic is only allowed for DERIVED claims
  assert.ok(check("These records do not demonstrate that PMMA is safe at 34 % oxygen.", "DATA_GAP", []).verified);
  assert.ok(!check("These records show PMMA is safe at 34 % oxygen.", "INTERPRETATION", ["S:saffire-vi-3"]).verified);
});

// ---- outcome model in the evidence package ----
import { readFileSync as readModelFile } from "node:fs";
import type { Model } from "./model.ts";
const outcomeModel = JSON.parse(readModelFile(new URL("../data/model.json", import.meta.url), "utf8")) as Model;
const noData = [] as never[];

test("the model estimate joins the package last, only when oxygen and airflow are both given", () => {
  const withBoth = buildEvidence("What happens to PMMA at 21% oxygen and 10 cm/s?", noData, noData, noData, outcomeModel);
  assert.equal(withBoth.items.at(-1)?.key, "M:outcome-model");
  assert.match(withBoth.items.at(-1)!.text, /not a NASA result/);
  assert.equal(buildEvidence("What happens to PMMA at 21% oxygen?", noData, noData, noData, outcomeModel).items.some((i) => i.key === "M:outcome-model"), false);
  assert.equal(buildEvidence("PMMA at 21% oxygen and 10 cm/s", noData, noData, noData).items.some((i) => i.key === "M:outcome-model"), false);
});

test("the model is never offered for lunar gravity, and out-of-range inputs are labelled", () => {
  assert.equal(buildEvidence("PMMA on the Moon at 21% oxygen and 10 cm/s", noData, noData, noData, outcomeModel).items.some((i) => i.key === "M:outcome-model"), false);
  const far = buildEvidence("PMMA at 21% oxygen and 90 cm/s", noData, noData, noData, outcomeModel).items.at(-1)!;
  assert.match(far.text, /outside the tested range/);
});

test("a DERIVED claim that restates the model numbers passes the checker; a wrong number does not", () => {
  const item = buildEvidence("PMMA at 21% oxygen and 10 cm/s", noData, noData, noData, outcomeModel).items.at(-1)!;
  const [, pct, lo, hi] = item.text.match(/estimates a (\d+) % chance.*?interval (\d+) % to (\d+) %/)!;
  const good = checkAnswer({ summary: "", claims: [{ type: "DERIVED", cites: ["M:outcome-model"], text: `The model estimates a ${pct} % chance, interval ${lo} % to ${hi} %.` }] }, [item]);
  assert.equal(good[0].verified, true, good[0].issues.join("; "));
  const bad = checkAnswer({ summary: "", claims: [{ type: "DERIVED", cites: ["M:outcome-model"], text: "The model estimates a 88.123 % chance." }] }, [item]);
  assert.equal(bad[0].verified, false);
});
