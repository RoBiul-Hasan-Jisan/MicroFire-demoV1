/**
 * Scenario Dossier: one scenario in, five answers out, one shareable link.
 *
 *   1. What do NASA's tests say here?          (gate, estimate, envelope, closest tests, Evidence Ladder counts)
 *   2. What happens if one thing changes?      (What-if engine, one-condition comparison)
 *   3. Where is the evidence thin or missing?  (Evidence Ladder gaps, coverage at this point)
 *   4. Which new test would help most?         (nearest untested neighbourhood + the planner's pick, scoped honestly)
 *   5. What does this NOT say?                 (fixed limits)
 *
 * It adds no model and no data. Every number comes from model-lab, what-if, ontology or next_experiments.json, and the
 * same guardrails apply: a blocked state has no number, and nothing here is a fire-risk probability or a safety verdict.
 */
import { ladder, type Ladder } from "./ontology.ts";
import type { EvidenceRecord } from "./ontology.ts";
import type { Finding } from "./types";
import { LOCAL, STATUS_LABEL, type Query, type Snapshot } from "./model-lab.ts";
import { coverage, DIM_LABEL, interventions, whatIf, type WhatIf } from "./what-if.ts";
import { describeTest, pct, type NextTests } from "./next-tests.ts";

export const DOSSIER_MATERIALS = ["SIBAL fabric", "PMMA", "Nomex", "Silicone", "Cotton jersey"] as const;
export const DOSSIER_GRAVITY = ["microgravity", "lunar", "martian", "earth"] as const;
export const DEFAULT_QUERY: Query = { material: "SIBAL fabric", gravity: "microgravity", o2: 18.5, kpa: 101.3, flow: 10 };
export const DEFAULT_CHANGE: Partial<Query> = { o2: 16.5 };

const RANGE = { o2: [10, 40], kpa: [30, 110], flow: [0, 30] } as const;
const G_NAME: Record<Query["gravity"], string> = { microgravity: "orbit (microgravity)", lunar: "lunar gravity", martian: "Martian gravity", earth: "Earth gravity" };

/* ---------------------------------------------------------------- URL <-> scenario */

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Reads a scenario from URL parameters. Invalid values are ignored (and reported), never trusted. */
export function parseDossier(sp: Params): { q: Query; change: Partial<Query>; ignored: string[]; fromUrl: boolean } {
  const ignored: string[] = [];
  const read = (key: string): Partial<Query> => {
    const out: Partial<Query> = {};
    const num = (k: "o2" | "kpa" | "flow") => {
      const raw = first(sp[`${key}${k}`]);
      if (raw === undefined || raw === "") return;
      const n = Number(raw);
      if (Number.isFinite(n) && n >= RANGE[k][0] && n <= RANGE[k][1]) out[k] = n; else ignored.push(`${key}${k}`);
    };
    num("o2"); num("kpa"); num("flow");
    const m = first(sp[`${key}m`]);
    if (m !== undefined && m !== "") { if ((DOSSIER_MATERIALS as readonly string[]).includes(m)) out.material = m; else ignored.push(`${key}m`); }
    const g = first(sp[`${key}g`]);
    if (g !== undefined && g !== "") { if ((DOSSIER_GRAVITY as readonly string[]).includes(g)) out.gravity = g as Query["gravity"]; else ignored.push(`${key}g`); }
    return out;
  };
  const fromUrl = ["m", "g", "o2", "kpa", "flow", "x_m", "x_g", "x_o2", "x_kpa", "x_flow"].some((k) => sp[k] !== undefined);
  const q: Query = { ...DEFAULT_QUERY, ...read("") };
  const rawChange = read("x_");
  const change: Partial<Query> = {};
  for (const k of Object.keys(rawChange) as (keyof Query)[]) if (rawChange[k] !== q[k]) (change as Record<string, unknown>)[k] = rawChange[k];
  return { q, change: fromUrl ? change : DEFAULT_CHANGE, ignored, fromUrl };
}

/** The link that reopens exactly this dossier. */
export function dossierUrl(q: Query, change: Partial<Query>): string {
  const p = new URLSearchParams({ m: q.material, g: q.gravity, o2: String(q.o2), kpa: String(q.kpa), flow: String(q.flow) });
  const short: Record<keyof Query, string> = { material: "m", gravity: "g", o2: "o2", kpa: "kpa", flow: "flow" };
  for (const k of Object.keys(change) as (keyof Query)[]) p.set(`x_${short[k]}`, String(change[k]));
  return `/dossier?${p.toString()}`;
}

/* ---------------------------------------------------------------- nearest untested neighbourhood */

export type Untested = { kind: "here" | "nearby" | "beyond" | "none" | "no-model-material"; o2?: number; flow?: number; text: string };
const O2_AX: [number, number] = [14, 31], FLOW_AX: [number, number] = [0, 25];

/**
 * Where, on the oxygen × airflow plane for this material, is the nearest combination with no NASA test in the gate's window?
 * This is the scenario's own gap, distinct from the planner's pick (which is scored against five fixed reference cabins).
 */
export function nearestUntested(s: Snapshot, q: Query): Untested {
  const mat = q.material as keyof Snapshot["domain"];
  if (!s.domain[mat]) return { kind: "no-model-material", text: `${q.material} has no usable test records in the model's training set, so every oxygen and airflow combination is untested for it here.` };
  const d = s.domain[mat];
  const inView = q.o2 >= O2_AX[0] && q.o2 <= O2_AX[1] && q.flow >= FLOW_AX[0] && q.flow <= FLOW_AX[1];
  if (!inView || q.o2 < d.o2[0] - 1 || q.o2 > d.o2[1] + 1 || q.flow < d.flow[0] - 2 || q.flow > d.flow[1] + 2)
    return { kind: "beyond", text: `This scenario lies beyond the ${q.material} tests (oxygen ${d.o2[0]}–${d.o2[1]} %, airflow ${d.flow[0]}–${d.flow[1]} cm/s). Everything out here is untested; the nearest tested edge is the range just stated.` };
  const nx = 34, ny = 25, cells = coverage(s, q.material, O2_AX, FLOW_AX, nx, ny);
  const here = cells.reduce((b, c) => (Math.hypot((c.o2 - q.o2) / 17, (c.flow - q.flow) / 25) < Math.hypot((b.o2 - q.o2) / 17, (b.flow - q.flow) / 25) ? c : b));
  if (here.support === 0) return { kind: "here", o2: q.o2, flow: q.flow, text: `No ${q.material} test lies within ±${LOCAL.o2} pp oxygen and ±${LOCAL.flow} cm/s of this scenario. This exact combination is untested.` };
  const empty = cells.filter((c) => c.tier === "empty" && c.o2 >= d.o2[0] - 1 && c.o2 <= d.o2[1] + 1 && c.flow >= d.flow[0] - 2 && c.flow <= d.flow[1] + 2);
  if (!empty.length) return { kind: "none", text: `Every oxygen and airflow combination inside the ${q.material} test range has at least one nearby test. The gap is outside that range, in gravity, pressure or composition.` };
  const near = empty.reduce((b, c) => (Math.hypot((c.o2 - q.o2) / 17, (c.flow - q.flow) / 25) < Math.hypot((b.o2 - q.o2) / 17, (b.flow - q.flow) / 25) ? c : b));
  const o2 = Math.round(near.o2 * 2) / 2, flow = Math.round(near.flow * 2) / 2;
  return { kind: "nearby", o2, flow, text: `The nearest untested ${q.material} combination inside the tested range is about ${o2} % oxygen at ${flow} cm/s airflow: no test lies within ±${LOCAL.o2} pp and ±${LOCAL.flow} cm/s of it.` };
}

/* ---------------------------------------------------------------- the dossier */

export type DossierData = { snap: Snapshot; records: EvidenceRecord[]; findings: Finding[]; next: NextTests; pressure: { n: number; of: number } };
export type Section = { n: number; title: string; headline: string; lines: string[] };
export type Dossier = {
  title: string;
  scenario: string;
  url: string;
  whatIf: WhatIf;
  ladder: Ladder | null;
  untested: Untested;
  planner: string | null;
  sections: Section[];
  /** Every NASA record the dossier points at, for the source trace. */
  trace: { id: string; test: string; pdf_page: number; source_id: string }[];
  markdown: string;
};

const pc = (x: number) => `${Math.round(x * 100)} %`;
export const LIMITS = [
  "The estimate describes one experimental outcome: whether a flame was established after the ignition attempt in a BASS-II-style ISS glovebox test. It is not a fire-risk probability, a hazard rating or advice for a crew.",
  "A lower estimate means fewer nearby NASA tests established a flame. It does not mean a cabin is safer, and a missing test does not mean something is safe.",
  "Every training test burned in orbit. No record comes from the Moon or Mars, so nothing here is a measurement for those places.",
  "Only SIBAL fabric and PMMA have enough tests to model, and the baseline often rests on very few nearby tests; the envelope shows that.",
  "This is a research planning aid, not a safety certification and not NASA guidance.",
];

export const describeQuery = (q: Query) => `${q.material}, ${q.o2} % oxygen, ${q.kpa} kPa, ${q.flow} cm/s airflow, ${G_NAME[q.gravity]}`;

export function buildDossier(d: DossierData, q: Query, change: Partial<Query>): Dossier {
  const w = whatIf(d.snap, q, change);
  const mod = { ...q, ...change } as Query;
  const lad = q.gravity === "earth" ? null : ladder(d.records, d.findings, { material: q.material, oxygen: q.o2, pressureKpa: q.kpa, flow: q.flow, gravity: q.gravity });
  const untested = nearestUntested(d.snap, q);
  const levers = interventions(d.snap, q, d.pressure);
  const trace: Dossier["trace"] = [];
  const addTrace = (n: { row: { id: string; test: string; cite: { source_id: string; pdf_page: number } } }) => {
    if (!trace.some((t) => t.id === n.row.id)) trace.push({ id: n.row.id, test: n.row.test, pdf_page: n.row.cite.pdf_page, source_id: n.row.cite.source_id });
  };
  w.base.neighbors.slice(0, 3).forEach(addTrace);
  if (w.changed.length) w.modified.neighbors.slice(0, 3).forEach(addTrace);

  // 1. what the tests say here
  const b = w.base, e = b.env;
  const s1: string[] = [];
  s1.push(`Domain check: ${STATUS_LABEL[b.status]}. ${b.checks.filter((c) => c.status !== "in").map((c) => `${c.dim}: ${c.text}.`).join(" ") || "Every condition lies inside the tested range."}`);
  if (e.p != null) s1.push(`Estimate: ${pc(e.p)} of comparable NASA tests establish a flame (model interval ${pc(e.modelInterval![0])}–${pc(e.modelInterval![1])}; evidence-weighted envelope ${pc(e.lo!)}–${pc(e.hi!)}). ${e.support} ${q.material} test${e.support === 1 ? "" : "s"} lie nearby, ${e.established} established a flame.`);
  else s1.push("No estimate: these conditions are outside what the NASA tests support. Abstention is a result.");
  for (const n of b.neighbors.slice(0, 3)) s1.push(`Closest test: ${n.row.test} (${n.row.material}, ${n.row.o2} % O₂, ${n.row.flow} cm/s): ${n.row.y ? "flame established" : "no flame established"} (${n.row.cite.source_id}, PDF p. ${n.row.cite.pdf_page}).`);
  if (lad) s1.push(`Evidence Ladder: ${lad.direct.length} direct and ${lad.analogous.length} analogous test records across BASS-II, Saffire and LUCI.`);
  else s1.push("Evidence Ladder: not computed for Earth gravity, because every NASA record in the atlas is from microgravity or simulated partial gravity.");
  const h1 = e.p != null ? `${pc(e.p)} estimated, ${STATUS_LABEL[b.status].toLowerCase()}` : `No estimate (${STATUS_LABEL[b.status].toLowerCase()})`;

  // 2. what-if
  const s2: string[] = [w.reading];
  if (w.changed.length) s2.push(`Change tested: ${w.changed.map((k) => `${DIM_LABEL[k]} ${q[k]} → ${mod[k]}`).join(", ")}.`);
  if (w.delta) for (const f of w.delta.byFeature) s2.push(`${f.feature}: ${f.from} → ${f.to} shifts the log-odds by ${f.logOdds >= 0 ? "+" : "−"}${Math.abs(f.logOdds).toFixed(2)}.`);
  s2.push("One-condition comparison against the starting scenario:");
  for (const l of levers) {
    if (l.kind === "modelled") s2.push(`${l.label}: ${l.result.delta ? `${pc(l.result.modified.env.p!)} (${l.result.delta.pp >= 0 ? "+" : "−"}${Math.abs(l.result.delta.pp).toFixed(0)} pp${l.result.delta.distinguishable ? "" : ", not distinguishable from the start"})` : `no estimate (${STATUS_LABEL[l.result.modified.status].toLowerCase()})`}.`);
    else if (l.kind === "records") s2.push(`${l.label}: ${l.interval ? `${l.established} of ${l.support} nearby tests established a flame (${pc(l.interval[0])}–${pc(l.interval[1])})` : `too few nearby tests (${l.support})`}.`);
    else s2.push(`${l.label}: no NASA solid-fuel evidence in the atlas; nothing estimated.`);
  }
  const h2 = !w.changed.length ? "No change selected"
    : w.delta ? `${w.delta.pp >= 0 ? "+" : "−"}${Math.abs(w.delta.pp).toFixed(0)} pp, ${w.delta.distinguishable ? "envelopes separate" : "not distinguishable"}`
    : !w.base.pred ? "No starting estimate to compare against"
    : "Number blocked at the modified scenario";

  // 3. where the evidence is thin or missing
  const s3: string[] = [];
  if (lad) for (const g of lad.gaps) s3.push(`${g.dim === "combination" ? "Combination" : g.dim[0].toUpperCase() + g.dim.slice(1)}: ${g.text}`);
  s3.push(untested.text);
  const nearGap = untested.kind === "nearby" || untested.kind === "here";
  const h3 = lad
    ? lad.gaps.length ? `${lad.gaps.length} gap${lad.gaps.length === 1 ? "" : "s"} against the Evidence Ladder${nearGap ? ", plus an untested neighbourhood" : ""}`
      : nearGap ? "No Ladder gap, but an untested neighbourhood nearby" : "No gap flagged by the Evidence Ladder"
    : nearGap ? "Untested neighbourhood nearby (Ladder not computed)" : "Ladder not computed";

  // 4. which new test would help most
  const s4: string[] = [];
  if (untested.kind === "nearby" || untested.kind === "here") s4.push(`For this scenario: a ${q.material} test at about ${untested.o2} % oxygen and ${untested.flow} cm/s airflow in orbit would fill the nearest untested neighbourhood.`);
  else s4.push(untested.text);
  if (lad?.nextExperiment) s4.push(`Evidence Ladder: ${lad.nextExperiment}`);
  let planner: string | null = null;
  const pg = q.gravity === "earth" ? null : d.next.headline.best_by_gravity[q.gravity];
  if (pg) {
    planner = `${describeTest({ gravity: pg.gravity, o2: pg.o2, forced: pg.forced, direction: pg.direction as "concurrent" | "opposed" })}`;
    s4.push(`Research planner: ${planner}, expected to remove ${pct(pg.alone_uncertainty_removed)} of the model's uncertainty about five fixed reference mission cabins. This is scored against those cabins, not against your scenario, and is an expected value, not a result.`);
  }
  const h4 = untested.kind === "nearby" || untested.kind === "here" ? `Untested near ${untested.o2} % O₂, ${untested.flow} cm/s` : untested.kind === "beyond" ? "Beyond the tested range" : "No nearby untested point";

  const sections: Section[] = [
    { n: 1, title: "What NASA's tests say here", headline: h1, lines: s1 },
    { n: 2, title: "What happens if one thing changes", headline: h2, lines: s2 },
    { n: 3, title: "Where the evidence is thin or missing", headline: h3, lines: s3 },
    { n: 4, title: "Which new test would help most", headline: h4, lines: s4 },
    { n: 5, title: "What this does not say", headline: "Read before using", lines: LIMITS },
  ];

  const url = dossierUrl(q, change);
  const title = `Scenario dossier: ${describeQuery(q)}`;
  const md = [
    `# ${title}`, "",
    `Generated by MicroFire Atlas. Reopen this exact dossier: ${url}`, "",
    ...sections.flatMap((s) => [`## ${s.n}. ${s.title}`, `**${s.headline}**`, "", ...s.lines.map((l) => `- ${l}`), ""]),
    "## Source trace", ...trace.map((t) => `- ${t.test}: ${t.source_id}, PDF p. ${t.pdf_page}`), "",
    "Data: NASA Technical Reports Server. Not affiliated with or endorsed by NASA.", "",
  ].join("\n");

  return { title, scenario: describeQuery(q), url, whatIf: w, ladder: lad, untested, planner, sections, trace, markdown: md };
}
