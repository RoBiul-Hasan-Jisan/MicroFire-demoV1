import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FUN_FACTS, PAGES, guideFor } from "./guide.ts";

const finds = new Map(
  JSON.parse(readFileSync(new URL("../data/findings.json", import.meta.url), "utf8")).map((f: { id: string; quote: string }) => [f.id, f.quote]),
);

test("every fun fact rewords a verified NASA quote", () => {
  for (const f of FUN_FACTS) assert.ok(finds.has(f.finding), f.finding);
});

test("numbers in fun facts appear in the quote they reword", () => {
  for (const f of FUN_FACTS) {
    const q = finds.get(f.finding) as string;
    for (const n of f.text.match(/\d+(?:\.\d+)?/g) ?? []) assert.ok(q.includes(n), `${f.finding}: ${n} not in "${q}"`);
  }
});

test("routes resolve to the right guide page", () => {
  assert.equal(guideFor("/")?.id, "home");
  assert.equal(guideFor("/analyze/saffire-vi-pmma")?.id, "analyze");
  assert.equal(guideFor("/experiments/bass2-B19")?.id, "experiment");
  assert.equal(guideFor("/nowhere"), undefined);
  assert.ok(PAGES.every((p) => p.steps.length > 0));
});
