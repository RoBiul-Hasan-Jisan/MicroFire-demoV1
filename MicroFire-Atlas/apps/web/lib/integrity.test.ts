// Scientific integrity: each test names the claim it protects. A failure here means the site could mislead.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { FAMILIES, fromBass, fromLuci, fromSaffire, ladder, SOURCE_FAMILY } from "./ontology.ts";
import { checkAnswer, type EvidenceItem } from "./ask-core.ts";
import { CONTEXTS } from "./mission-scenarios.ts";
import { buildDataset, gate, predict, snapshot } from "./model-lab.ts";
import { DEMOS, TOUR } from "./judge.ts";
import { PRESETS } from "./presets.ts";

const read = (f: string) => JSON.parse(readFileSync(new URL(f, import.meta.url), "utf8"));
const exps = read("../data/experiments.json"), saffire = read("../data/saffire.json"), luci = read("../data/luci.json");
const findings = read("../data/findings.json"), sources = read("../data/sources.json");
const sourceIds = new Set(sources.map((s: { source_id: string }) => s.source_id));
const records = [...exps.map(fromBass), ...saffire.map(fromSaffire), ...luci.map(fromLuci)];
const snap = snapshot(buildDataset(exps).rows, "logit-o2-material");

test("no record loses provenance: every test record cites an existing source and a real PDF page", () => {
  for (const r of records) {
    assert.ok(r.cite, `${r.id} has no citation`);
    assert.ok(sourceIds.has(r.cite!.source_id), `${r.id} cites unknown source ${r.cite!.source_id}`);
    assert.ok(Number.isInteger(r.cite!.pdf_page) && r.cite!.pdf_page > 0, `${r.id} has no page`);
  }
  for (const e of exps) for (const c of Object.values(e.provenance.series) as { source_id: string }[]) assert.ok(sourceIds.has(c.source_id), `${e.id} series cites unknown source`);
});

test("every finding names an existing source and family; every referenced finding exists", () => {
  const ids = new Set(findings.map((f: { id: string }) => f.id));
  for (const f of findings) {
    assert.ok(sourceIds.has(f.source_id), `${f.id}: unknown source ${f.source_id}`);
    assert.ok(SOURCE_FAMILY[f.source_id], `${f.id}: source has no family`);
    assert.ok(f.quote.length > 10 && (f.pdf_page > 0 || f.in === "abstract"), `${f.id}: missing quote or page`);
  }
  for (const p of PRESETS) {
    for (const id of p.findings) assert.ok(ids.has(id), `preset ${p.id} references missing finding ${id}`);
    for (const id of p.ids) assert.ok(records.some((r) => r.id === id), `preset ${p.id} references missing test ${id}`);
  }
});

test("unit conversion: every '1 atm' pressure is stored as 101.325 kPa", () => {
  let n = 0;
  for (const e of exps) {
    const p = e.provenance.series.pressure_kpa;
    if (p?.original === "1 atm") { n++; assert.equal(e.pressure_kpa, 101.325, e.id); }
  }
  assert.ok(n > 0);
});

test("planned FM² is never presented as completed evidence", () => {
  assert.match(FAMILIES.fm2.name, /planned/i);
  assert.match(FAMILIES.fm2.kid, /No results yet/);
  assert.ok(!records.some((r) => r.family === "fm2"), "an FM² test row exists");
  for (const f of findings.filter((x: { source_id: string }) => SOURCE_FAMILY[x.source_id] === "fm2"))
    assert.ok(!/\b(FM2|FM²)\b.*\b(burned|showed|found|measured)\b/i.test(f.quote), `${f.id} reads like an FM² result`);
});

test("LUCI is always simulated lunar gravity, never Moon-surface evidence", () => {
  for (const r of luci.map(fromLuci)) {
    assert.match(r.label, /simulated lunar gravity/);
    assert.match(r.caveat ?? "", /^Simulated lunar gravity/);
  }
  assert.equal(FAMILIES.luci.gravity, "lunar (simulated)");
});

test("AI output with an unsupported probability or a prediction is flagged, never verified", () => {
  const items: EvidenceItem[] = [{ key: "E:bass2-B16", kind: "test", title: "B16", text: "BASS-II test B16; PMMA; oxygen 16.5 %; quenched", href: "/x", gravity: "microgravity" }];
  const [c1, c2, c3] = checkAnswer({ summary: "", claims: [
    { type: "OBSERVED", text: "There is an 86 % probability that PMMA burns at 16.5 % oxygen.", cites: ["E:bass2-B16"] },
    { type: "INTERPRETATION", text: "PMMA will burn on the Moon.", cites: ["E:bass2-B16"] },
    { type: "OBSERVED", text: "B16 shows PMMA quenched on the Moon at 16.5 % oxygen.", cites: ["E:bass2-B16"] },
  ] }, items);
  assert.equal(c1.verified, false); assert.ok(c1.issues.some((i) => i.startsWith("Numbers not found")));
  assert.equal(c2.verified, false); assert.ok(c2.issues.some((i) => i.startsWith("Turns a past")));
  assert.equal(c3.verified, false); assert.ok(c3.issues.some((i) => i.startsWith("Describes microgravity")));
});

test("mission presets: lunar and Martian habitat questions never get direct evidence or a model number", () => {
  for (const c of CONTEXTS) {
    const q = { material: c.form.material === "any" ? undefined : c.form.material, oxygen: c.form.oxygen, pressureKpa: c.form.pressureKpa, gravity: c.form.gravity, flow: c.form.flow };
    const l = ladder(records, findings, q);
    if (c.form.gravity === "martian") assert.equal(l.direct.length, 0, c.id);
    if (c.form.oxygen >= 28) assert.equal(l.direct.length, 0, `${c.id}: no record reached ${c.form.oxygen} % oxygen`);
    if (c.form.gravity !== "microgravity") assert.equal(predict(snap, { material: c.form.material === "any" ? "SIBAL fabric" : c.form.material, gravity: c.form.gravity, o2: c.form.oxygen, kpa: c.form.pressureKpa, flow: c.form.flow }), null, c.id);
  }
  assert.ok(ladder(records, findings, { material: "PMMA", oxygen: 16.5, gravity: "microgravity", flow: 3 }).direct.length > 0, "the ISS low-airflow case lost its direct evidence");
});

test("judge demos keep their meaning: direct, analogous, abstain", () => {
  const [iss, moon, mars] = DEMOS.map((d) => ({ l: ladder(records, findings, d.q), g: gate(snap, d.model) }));
  assert.ok(iss.l.direct.length > 0); assert.equal(iss.g.status, "in");
  assert.equal(moon.l.direct.length, 0); assert.ok(moon.l.analogous.length > 0); assert.equal(moon.g.status, "out");
  assert.equal(mars.l.direct.length, 0); assert.equal(mars.g.status, "out");
  for (const s of TOUR) assert.ok(s.href.startsWith("/"));
});

// Wording guard over the UI source: a heuristic must never be called a NASA score, and the site never rates safety.
const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : /\.(tsx|ts)$/.test(f) && !f.endsWith(".test.ts") ? [p] : []; });
const ui = [...files(fileURLToPath(new URL("../app", import.meta.url))), ...files(fileURLToPath(new URL("../components", import.meta.url)))];

// "prove" covers the teaching questions: "Can a missing test prove something is safe?"
const NEG = /\b(not|never|no|nothing|isn't|without|neither|nor|cannot|prove)\b/i;
const unnegated = (re: RegExp) => ui.flatMap((f) => { const src = readFileSync(f, "utf8"); return [...src.matchAll(re)].filter((m) => !NEG.test(src.slice(Math.max(0, m.index! - 100), m.index!))).map((m) => `${f.split("/web/")[1]}: "${m[0]}"`); });

test("no heuristic is labelled as a NASA score, rating or priority", () => {
  assert.deepEqual(unnegated(/NASA(?:'s)? (?:safety )?(?:score|rating|priorit(?:y|ization)|ranking)/gi), []);
});

test("no safe/unsafe rating or fire probability is shown as a result", () => {
  assert.deepEqual(unnegated(/(risk score|safety score|is safe\b|is unsafe\b|chance of fire|probability of (?:a )?(?:spacecraft )?fire)/gi), []);
});
