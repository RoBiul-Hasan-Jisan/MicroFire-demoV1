import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { distractors, hop, matchLabel, traceFrame, centroid, restoreJourney, type Hop } from "./expedition.ts";
const dest = (h: Hop) => ("to" in h ? h.to.id : null);

const exps = JSON.parse(readFileSync(new URL("../data/experiments.json", import.meta.url), "utf8"));
const get = (id: string) => exps.find((e: { id: string }) => e.id === id);

test("journey restores earned discoveries and rejects malformed or out-of-range saves", () => {
  assert.deepEqual(
    restoreJourney(`{"step":5,"film":"saffire-vi-pmma","done":["watch","watch","fake",null],"log":["Traced B",7,"${"x".repeat(200)}"],"nick":"Ada"}`),
    {step:5,film:"saffire-vi-pmma",done:["watch"],log:["Traced B"],nick:"Ada"},
  );
  for (const raw of [null, "{broken", "[]", `{"step":99,"film":"javascript:bad","done":true,"log":"x","nick":"${"y".repeat(40)}"}`]) {
    assert.deepEqual(restoreJourney(raw), {step:0,film:"saffire-v-ribs",done:[],log:[],nick:""});
  }
});

test("airflow hops from B20 land on the matched films B19 and B16", () => {
  const up = hop(get("bass2-B20"), "more-flow", exps);
  assert.equal(up.kind, "matched");
  assert.equal(dest(up), "bass2-B19");
  const down = hop(get("bass2-B20"), "less-flow", exps);
  assert.equal(dest(down), "bass2-B16");
});

test("more oxygen from B19 is matched by B15 at the same 10 cm/s", () => {
  const h = hop(get("bass2-B19"), "more-oxygen", exps);
  assert.equal(h.kind, "matched");
  assert.equal(dest(h), "bass2-B15");
});

test("more oxygen from B20 has no same-flow film, so it is honestly 'closest' with the difference named", () => {
  const h = hop(get("bass2-B20"), "more-oxygen", exps);
  assert.equal(h.kind, "closest");
  assert.ok(h.kind === "closest" && h.differs[0].includes("airflow"));
  // the flow-off and not-stated outcomes are never offered as comparable evidence
  assert.ok(h.kind === "closest" && !["extinguished_flow_off", "burned_outcome_not_stated"].includes(h.to.outcome));
});

test("Moon gravity is a science gap, never a predicted flame", () => {
  assert.equal(hop(get("bass2-B20"), "moon", exps).kind, "gap");
});

test("match labels follow the documented thresholds", () => {
  assert.equal(matchLabel(0.8, 0.8, false), "Great match");
  assert.equal(matchLabel(0.8, 0.5, false), "Pretty close");
  assert.equal(matchLabel(0.3, 1, false), "Some clues");
  assert.equal(matchLabel(0.1, 1, false), "Science gap");
  assert.equal(matchLabel(0.99, 1, true), "Science gap");
});

test("distractors stay in the frame and differ from the real outline", () => {
  const o: [number, number][] = [[0.4, 0.4], [0.6, 0.4], [0.6, 0.6], [0.4, 0.6]];
  const { scaled, shifted } = distractors(o);
  for (const [x, y] of [...scaled, ...shifted]) assert.ok(x >= 0 && x <= 1 && y >= 0 && y <= 1);
  assert.notDeepEqual(scaled, o);
  assert.notDeepEqual(shifted, o);
  assert.deepEqual(centroid(scaled).map((v) => +v.toFixed(6)), centroid(o).map((v) => +v.toFixed(6)));
});

test("the trace game uses a real computed frame from each video", () => {
  for (const slug of ["saffire-vi-pmma", "saffire-v-ribs"]) {
    const a = JSON.parse(readFileSync(new URL(`../public/media/${slug}/analysis.json`, import.meta.url), "utf8"));
    const f = traceFrame(a.frames);
    assert.ok(f && f.outlines[0].length >= 6, slug);
  }
});
