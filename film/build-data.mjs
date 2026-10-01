// Builds film/build/data.json from the site's real data and tested logic (node >= 23).
import { readFileSync, writeFileSync } from "node:fs";
import { rank, outsideEvidence } from "../apps/web/lib/relevance.ts";
import { gapGrid, O2_BINS, FLOW_BINS } from "../apps/web/lib/gaps.ts";
import { buildEvidence, checkAnswer } from "../apps/web/lib/ask-core.ts";

const read = (f) => JSON.parse(readFileSync(new URL(`../apps/web/data/${f}.json`, import.meta.url), "utf8"));
const exps = read("experiments");
const finds = read("findings");
const sources = read("sources");
const timed = JSON.parse(readFileSync(new URL("./build/script-timed.json", import.meta.url), "utf8"));

// Scene timing: narration plus pacing pauses. Local rules: 4 minutes maximum, so stay safely under.
export const TOTAL = 236;
const PAD = { intro: 5, challenge: 2, data: 4, map: 5, quench: 4, hidden: 3, mission: 4, gaps: 3, ask: 3, close: 1 };
const LEAD = { intro: 3 };
// Shrink pauses evenly if the narration is long, leaving 1 s of tail at the end.
const speech = timed.reduce((a, s) => a + s.audio, 0);
const padSum = Object.values(PAD).reduce((a, b) => a + b, 0);
const scale = Math.min(1, (TOTAL - 1 - speech) / padSum);
let t = 0;
const scenes = timed.map((s) => {
  const dur = s.audio + Math.max((LEAD[s.id] ?? 1) + 0.6, PAD[s.id] * scale);
  const sc = { id: s.id, start: t, dur, audioAt: LEAD[s.id] ?? 1, audio: s.audio, narration: s.narration };
  t += dur;
  return sc;
});
const last = scenes[scenes.length - 1];
last.dur += TOTAL - t;
if (last.dur < last.audio + last.audioAt) throw new Error("closing narration would be cut");

const finding = (id) => {
  const f = finds.find((x) => x.id === id);
  if (!f) throw new Error(id);
  return { quote: f.quote, source: sources.find((s) => s.source_id === f.source_id).title, page: f.pdf_page ?? null };
};
const compact = (e) => ({
  id: e.id, test: e.test_id, o2: e.oxygen_vol_pct, f0: e.flow_initial_cm_s, f1: e.flow_final_cm_s,
  varied: e.flow_varied, outcome: e.outcome, label: e.outcome_label, material: e.material,
  notes: e.observations_verbatim, flow: e.flow_verbatim,
});

const ctx = (s) => {
  const r = rank(exps, s);
  return {
    top: r.slice(0, 6).map((x) => ({ test: x.experiment.test_id, material: x.experiment.material, o2: x.experiment.oxygen_vol_pct, score: Math.round(x.score * 100), outcome: x.experiment.outcome })),
    strong: r.filter((x) => x.score >= 0.6).length,
    outside: outsideEvidence(exps, s),
  };
};

const grid = gapGrid(exps).map((row) => row.map((c) => c.tests.length));
const q = "How did airflow change the outcome in B16 and B19?";
const ev = buildEvidence(q, exps, finds);
const demo = checkAnswer(
  {
    summary: "",
    claims: [
      { text: "B19 blew out at 16.4 % oxygen.", type: "OBSERVED", cites: ["E:bass2-B19"] },
      { text: "B19 blew out at 12 % oxygen.", type: "OBSERVED", cites: ["E:bass2-B19"] },
      { text: "Test B99 burned the whole sample.", type: "OBSERVED", cites: ["E:bass2-B99"] },
      { text: "Neither test was run at lunar gravity.", type: "DATA_GAP", cites: [] },
    ],
  },
  ev.items,
);

const data = {
  total: TOTAL,
  scenes,
  counts: { tests: exps.length, findings: finds.length, sources: sources.length, materials: new Set(exps.map((e) => e.material)).size },
  sources: sources.map((s) => ({ title: s.title, type: s.document_type, ntrs: s.ntrs_id })),
  points: exps.map(compact),
  fates: ["bass2-B16", "bass2-B20", "bass2-B19"].map((id) => compact(exps.find((e) => e.id === id))),
  b19row: exps.find((e) => e.id === "bass2-B19"),
  quench: ["sibal-GMT45-T4", "sibal-GMT100-T13", "sibal-GMT175-T18", "sibal-GMT178-T14"].map((id) => compact(exps.find((e) => e.id === id))),
  quotes: {
    spread: finding("sibal-spread-trends"),
    quench: finding("sibal-quench-speeds"),
    dim: finding("dim-blue-low-flow"),
    tiny: finding("tiny-flame-undetected"),
    luci: finding("luci-first-lunar"),
    lowg: finding("low-g-burns-lower-o2"),
    explo: finding("exploration-atmosphere"),
  },
  mission: {
    iss: ctx({ oxygen: 21, flow: 10, pressureKpa: 101.3, gravity: "microgravity" }),
    explo: ctx({ oxygen: 34, flow: 10, pressureKpa: 56.5, gravity: "microgravity" }),
  },
  gap: { grid, o2: O2_BINS, flow: FLOW_BINS },
  ask: { question: q, items: ev.items.map((i) => ({ key: i.key, title: i.title })), demo },
};
writeFileSync(new URL("./build/data.json", import.meta.url), JSON.stringify(data));
console.log("scenes", scenes.map((s) => `${s.id}@${s.start.toFixed(1)}+${s.dur.toFixed(1)}`).join(" "));
console.log("ISS strong", data.mission.iss.strong, "| explo strong", data.mission.explo.strong, data.mission.explo.outside);
console.log("ask items", data.ask.items.map((i) => i.key).join(", "));
console.log("demo", data.ask.demo.map((c) => `${c.verified ? "OK" : "FLAG"}:${c.issues.join("/")}`).join(" | "));
