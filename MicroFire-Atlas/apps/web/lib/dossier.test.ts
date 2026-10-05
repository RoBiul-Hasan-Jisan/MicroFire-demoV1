import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fromBass, fromLuci, fromSaffire } from "./ontology.ts";
import { buildDataset, snapshot, type Query } from "./model-lab.ts";
import { buildDossier, DEFAULT_CHANGE, DEFAULT_QUERY, dossierUrl, nearestUntested, parseDossier, type DossierData } from "./dossier.ts";
import { localRows } from "./what-if.ts";

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const exps = read("../data/experiments.json");
const snap = snapshot(buildDataset(exps).rows, "logit-o2-material");
const data: DossierData = {
  snap, records: [...exps.map(fromBass), ...read("../data/saffire.json").map(fromSaffire), ...read("../data/luci.json").map(fromLuci)],
  findings: read("../data/findings.json"), next: read("../data/next_experiments.json"), pressure: { n: 20, of: 49 },
};
const q = (x: Partial<Query> = {}): Query => ({ ...DEFAULT_QUERY, ...x });

test("URL round-trip: the link reopens exactly the same scenario and change", () => {
  const start = q({ material: "PMMA", gravity: "lunar", o2: 34, kpa: 56.5, flow: 20 });
  const change = { gravity: "microgravity" as const, o2: 21 };
  const url = new URL(dossierUrl(start, change), "http://x");
  const back = parseDossier(Object.fromEntries(url.searchParams));
  assert.deepEqual(back.q, start); assert.deepEqual(back.change, change); assert.deepEqual(back.ignored, []);
  const all = { material: "SIBAL fabric", gravity: "martian" as const, o2: 17, kpa: 70, flow: 3 };
  const u2 = new URL(dossierUrl(start, all), "http://x");
  assert.deepEqual(parseDossier(Object.fromEntries(u2.searchParams)).change, all);
});

test("parsing: no parameters gives the default demo; invalid values are ignored and reported, never trusted", () => {
  const d = parseDossier({});
  assert.deepEqual(d.q, DEFAULT_QUERY); assert.deepEqual(d.change, DEFAULT_CHANGE); assert.equal(d.fromUrl, false);
  const bad = parseDossier({ m: "Unobtainium", g: "venus", o2: "999", kpa: "abc", flow: "-3", x_o2: "NaN" });
  assert.deepEqual(bad.q, DEFAULT_QUERY);
  assert.deepEqual(bad.change, {});
  assert.deepEqual(bad.ignored.sort(), ["flow", "g", "kpa", "m", "o2", "x_o2"].sort());
  const inj = parseDossier({ m: ["PMMA", "x"], o2: ["17", "5"] });
  assert.equal(inj.q.material, "PMMA"); assert.equal(inj.q.o2, 17);
});

test("a change equal to the start is dropped", () => {
  assert.deepEqual(parseDossier({ o2: "20", x_o2: "20" }).change, {});
});

test("dossier has the five answers in order, every line non-empty, and a source trace with pages", () => {
  const dz = buildDossier(data, q(), { o2: 16.5 });
  assert.deepEqual(dz.sections.map((s) => s.n), [1, 2, 3, 4, 5]);
  for (const s of dz.sections) { assert.ok(s.headline.length > 0); assert.ok(s.lines.length > 0 && s.lines.every((l) => l.trim().length > 0)); }
  assert.ok(dz.trace.length > 0 && dz.trace.every((t) => t.pdf_page > 0 && t.source_id));
  assert.match(dz.markdown, /^# Scenario dossier:/);
  assert.ok(dz.markdown.includes(dz.url));
});

test("the dossier's estimate and what-if equal the engines'", () => {
  const dz = buildDossier(data, q(), { o2: 16.5 });
  assert.equal(dz.whatIf.base.pred!.p, snap && dz.whatIf.base.pred!.p);
  assert.match(dz.sections[0].lines[1], new RegExp(`${Math.round(dz.whatIf.base.pred!.p * 100)} %`));
});

test("blocked scenarios carry no estimate anywhere, in any section or in the markdown", () => {
  const dz = buildDossier(data, q({ material: "PMMA", gravity: "lunar", o2: 34, kpa: 56.5, flow: 20 }), {});
  assert.equal(dz.whatIf.base.pred, null);
  assert.match(dz.sections[0].headline, /^No estimate/);
  assert.match(dz.sections[0].lines.join(" "), /Abstention is a result/);
  assert.doesNotMatch(dz.sections[0].lines.join(" "), /established a flame \(model interval/);
  assert.equal(dz.untested.kind, "beyond");
  assert.ok(dz.ladder && dz.ladder.direct.length === 0, "no direct record at 34 % O2 in lunar gravity");
});

test("Earth gravity: the ladder is not computed and the dossier says why", () => {
  const dz = buildDossier(data, q({ gravity: "earth" }), {});
  assert.equal(dz.ladder, null); assert.equal(dz.planner, null);
  assert.match(dz.sections[0].lines.join(" "), /not computed for Earth gravity/);
});

test("the planner pick is always scoped to the reference cabins, never presented as a result for the user's scenario", () => {
  for (const g of ["microgravity", "lunar", "martian"] as const) {
    const dz = buildDossier(data, q({ gravity: g }), {});
    const line = dz.sections[3].lines.find((l) => l.startsWith("Research planner"));
    assert.ok(line, g);
    assert.match(line!, /five fixed reference mission cabins/); assert.match(line!, /expected value, not a result/);
  }
});

test("nearestUntested: honest kinds, and the suggested point really has no test nearby", () => {
  assert.equal(nearestUntested(snap, q({ material: "Nomex" })).kind, "no-model-material");
  assert.equal(nearestUntested(snap, q({ o2: 34 })).kind, "beyond");
  const u = nearestUntested(snap, q());
  assert.ok(u.kind === "nearby" || u.kind === "here" || u.kind === "none");
  if (u.kind === "nearby") assert.equal(localRows(snap, q({ o2: u.o2!, flow: u.flow! })).length, 0);
});

test("wording: no safe/unsafe/risk-score language, and the limits are always last", () => {
  const dz = buildDossier(data, q(), { o2: 16.5 });
  // same rule as the project's wording guard: a negated mention ("does not mean a cabin is safer") is allowed
  const NEG = /\b(not|never|no|nothing|isn't|without|neither|nor|cannot|prove)\b/i;
  const bad = [...dz.markdown.matchAll(/\b(is safe|is unsafe|risk score|safety score|safer|safest|chance of fire)\b/gi)].filter((m) => !NEG.test(dz.markdown.slice(Math.max(0, m.index! - 100), m.index!)));
  assert.deepEqual(bad.map((m) => m[0]), []);
  assert.equal(dz.sections[4].title, "What this does not say");
  assert.match(dz.sections[4].lines.join(" "), /not a fire-risk probability/);
});

test("headlines never contradict the lines under them", () => {
  // blocked START: the headline must blame the start, not the modified scenario
  const blockedStart = buildDossier(data, q({ material: "PMMA", gravity: "lunar", o2: 34, kpa: 56.5, flow: 20 }), { gravity: "microgravity", o2: 21, kpa: 101.3 });
  assert.equal(blockedStart.whatIf.base.pred, null);
  assert.equal(blockedStart.sections[1].headline, "No starting estimate to compare against");
  // blocked MODIFIED: the headline blames the modified scenario
  const blockedMod = buildDossier(data, q(), { gravity: "lunar" });
  assert.ok(blockedMod.whatIf.base.pred && !blockedMod.whatIf.modified.pred);
  assert.equal(blockedMod.sections[1].headline, "Number blocked at the modified scenario");
  // an untested neighbourhood must never sit under a "no gap" headline
  const dz = buildDossier(data, q(), {});
  if (dz.untested.kind === "nearby" || dz.untested.kind === "here") assert.doesNotMatch(dz.sections[2].headline, /^No gap flagged/);
});
