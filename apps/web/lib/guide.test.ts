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

test("discoveries are unique, placed in the box and open real routes", async () => {
  const { DISCOVERIES } = await import("./guide.ts");
  assert.equal(new Set(DISCOVERIES.map((d) => d.id)).size, DISCOVERIES.length);
  for (const d of DISCOVERIES) {
    assert.ok(d.x >= 0 && d.x <= 100 && d.y >= 0 && d.y <= 100, d.id);
    assert.match(d.href, /^\/(story|atlas|gaps|sources|expedition|analyze|compare|mission|methodology|ask|experiments\/bass2-B\d+)?$/, d.id);
  }
});

test("every guide page has a crew goal", async () => {
  const { GOALS, CREW } = await import("./guide.ts");
  for (const p of PAGES) {
    assert.ok(GOALS[p.id], `no goal for ${p.id}`);
    assert.ok(CREW[GOALS[p.id].crew]);
  }
});

test("the constellation is a closed flame: no two stars share a place", async () => {
  const { DISCOVERIES } = await import("./guide.ts");
  const seen = new Set(DISCOVERIES.map((d) => `${Math.round(d.x)},${Math.round(d.y)}`));
  assert.equal(seen.size, DISCOVERIES.length);
});
