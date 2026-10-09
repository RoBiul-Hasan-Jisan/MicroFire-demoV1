import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { abstention, ABSTAIN_QUESTION, buildChallenge, challengeQuestion, TRACEABILITY } from "./challenge.ts";
import { fromBass, fromLuci, fromSaffire } from "./ontology.ts";

const read = (n: string) => JSON.parse(readFileSync(new URL(`../data/${n}.json`, import.meta.url), "utf8"));
const experiments = read("experiments"), findings = read("findings"), saffire = read("saffire"), luci = read("luci"), sources = read("sources");
const records = [...experiments.map(fromBass), ...saffire.map(fromSaffire), ...luci.map(fromLuci)];
const data = { experiments, findings, saffire, luci, records };
const sourceIds = new Set(sources.map((s: { source_id: string }) => s.source_id));

for (const atm of ["ea-a", "ea-alt"] as const) {
  test(`challenge (${atm}): every stage is computed from real data`, () => {
    const c = buildChallenge(data, atm);
    assert.match(c.text, /lunar-habitat scenario/);
    assert.match(c.scenario, /posed here as a lunar research scenario/);
    assert.ok(c.find.some((f) => f.id === "bass2" && f.records === 56) && c.find.some((f) => f.id === "fm2" && f.role.includes("planned")));
    assert.ok(c.closest.length >= 2 && c.closest.every((r) => r.dims.length >= 4));
    assert.ok(c.topFindings.length >= 2 && c.topFindings.every((t) => sourceIds.has(t.finding.source_id) && t.finding.quote.length > 0));
    assert.ok(c.topTests.length === 3 && c.topTests.every((t) => t.stability && t.relevance >= 0 && t.relevance <= 1));
    assert.ok(c.ai.valid && c.ai.checked.every((x) => x.verified));
    // where the evidence stops: no direct record for this lunar combination, and a deterministic next question
    assert.equal(c.gap.direct, 0);
    assert.ok(c.gap.gaps.length > 0 && c.gap.nextExperiment && c.gap.nextExperiment.includes("lunar gravity"));
    // gravity is the same regime only for LUCI; every other closest record must show gravity as different
    for (const row of c.closest) assert.equal(row.dims.find((d) => d.dim === "Gravity")!.status, row.record.family === "luci" ? "match" : "different");
    if (c.insight) assert.ok(sourceIds.has(c.insight.sourceId) && c.insight.label === "MicroFire interpretation");
  });
}

test("the two atmospheres stay separate and neither is called the Moon atmosphere", () => {
  const a = challengeQuestion("ea-a"), b = challengeQuestion("ea-alt");
  assert.deepEqual([a.q.oxygen, a.q.pressureKpa, b.q.oxygen, b.q.pressureKpa], [34, 56.5, 28.5, 66.2]);
  for (const x of [a, b]) assert.doesNotMatch(x.scenario + x.text, /the moon atmosphere|moon-base air/i);
});

test("MicroFire says no: a probability question gets evidence and gaps, never a number", () => {
  const a = abstention(data);
  assert.match(ABSTAIN_QUESTION, /probability/);
  assert.equal(a.refuses, true);
  assert.ok(a.reason && /probability/.test(a.reason));
  assert.ok(a.closest && a.mismatches.length > 0 && a.unknown.length > 0 && a.next);
  assert.ok(a.observed && sourceIds.has(a.observed.source_id));
  assert.doesNotMatch(JSON.stringify({ r: a.reason, u: a.unknown, n: a.next }), /\d+(\.\d+)?\s*%\s*(chance|probability|likely)/i);
});

test("every traceability link points at a real route", () => {
  for (const t of TRACEABILITY) {
    const path = t.href.split(/[?#]/)[0];
    assert.ok(existsSync(new URL(`../app${path === "/" ? "" : path}/page.tsx`, import.meta.url)), t.href);
  }
  assert.deepEqual(TRACEABILITY.map((t) => t.verb).slice(0, 5), ["Find", "Compare", "Summarize", "Rank", "Interpret"]);
});

test("the claim-check list is computed: a broken claim turns its own check off", async () => {
  const { checkSummary, verifiedExample, EXAMPLE_ANSWER, EXAMPLE_QUESTION } = await import("./ask-example.ts");
  const { checkAnswer } = await import("./ask-core.ts");
  const ok = verifiedExample(experiments, findings, saffire, luci);
  assert.ok(checkSummary(ok.checked).every((c) => c.pass));
  const bad = checkAnswer({ ...EXAMPLE_ANSWER, claims: [{ ...EXAMPLE_ANSWER.claims[0], text: "B19 ran at 88.8 % oxygen on the Moon." }] }, ok.evidence.items, EXAMPLE_QUESTION);
  const s = checkSummary(bad);
  assert.equal(s.find((c) => /number/.test(c.label))!.pass, false);
  assert.equal(s.find((c) => /Moon or Mars/.test(c.label))!.pass, false);
});
