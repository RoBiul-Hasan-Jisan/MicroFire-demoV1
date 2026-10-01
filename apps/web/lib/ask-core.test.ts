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
  assert.ok(ev.outside.some((o) => o.includes("martian")));
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
