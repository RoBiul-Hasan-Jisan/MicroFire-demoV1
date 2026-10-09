/** Finding relevance v1. Publication relevance is not condition similarity or a safety estimate. */
import type { Finding } from "./types";
import { differences, FAMILIES, SOURCE_FAMILY, type EvidenceRecord, type MissionQuestion } from "./ontology.ts";
import { rng } from "./robustness.ts";

export type FindingQuery = { scenario: MissionQuestion; topics?: string[] };
export type FindingRung = "direct" | "analogous" | "mechanistic" | "context";
export type FindingResult = {
  findingId: string; sourceId: string; relevance: number; matchedTopics: string[];
  unmatchedRequestedDimensions: string[]; rung: FindingRung; sourceRole?: "abstract";
  supportingRecordIds: string[]; supportCount: number; coverage: number | null;
  scope: "record-linked" | "publication-level";
  whyRelevant: string[]; limitations: string[];
  // the sort keys themselves, so the UI can say why a finding ranks where it does
  requestedTopics: string[]; materialMatch: boolean; gravityMatch: boolean; coverageTier: 0 | 1;
};
export const FINDING_WEIGHTS = { topics: 5, material: 3, gravity: 2 };
export const FINDING_VARIATIONS = 200;
const ORDER: Record<FindingRung, number> = { direct: 0, analogous: 1, mechanistic: 2, context: 3 };
const validNumber = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

export function findingTopics({ scenario: s, topics = [] }: FindingQuery): string[] {
  const out = new Set(topics);
  if (s.flow != null && validNumber(s.flow) && s.flow <= 5) out.add("airflow");
  if (s.oxygen != null && validNumber(s.oxygen) && (s.oxygen > 21 || s.oxygen < 19)) out.add("oxygen");
  if (s.oxygen != null && s.oxygen < 19) out.add("quench");
  if (s.pressureKpa != null && validNumber(s.pressureKpa) && s.pressureKpa < 95) out.add("pressure");
  if (s.gravity && s.gravity !== "microgravity") out.add("partial-gravity");
  return [...out].sort();
}

/** Only explicit curated row links count. A shared publication/family is not a claim-to-row link. */
function linkedRecords(f: Finding, records: EvidenceRecord[]) {
  const ids = Array.isArray(f.experiments) ? f.experiments : [];
  return records.filter(r => ids.includes(r.id));
}
function materials(f: Finding, linked: EvidenceRecord[]) {
  const out = new Set(linked.map(r => r.material));
  // These source families are material-specific, unlike the broad BASS/Saffire family descriptions.
  if (f.source_id === "pmma-rods-concurrent") out.add("PMMA");
  if (f.source_id === "sibal-concurrent" || f.experiments === "family:SIBAL fabric · concurrent flow") out.add("SIBAL fabric");
  for (const [re, label] of [[/\b(PMMA|acrylic)\b/i, "PMMA"], [/\bSIBAL\b/i, "SIBAL fabric"], [/\bNomex\b/i, "Nomex"], [/\bsilicone\b/i, "Silicone"]] as const)
    if (re.test(f.quote)) out.add(label);
  return [...out];
}

export function rankFindings(finds: Finding[], records: EvidenceRecord[], query: FindingQuery, weights = FINDING_WEIGHTS): FindingResult[] {
  const s = query.scenario;
  const topics = findingTopics(query);
  const dims = (["material", "gravity", "oxygen", "pressureKpa", "flow"] as const).filter(k => s[k] != null && (typeof s[k] !== "number" || validNumber(s[k])));
  const safeWeights = Object.fromEntries(Object.entries(weights).map(([k, v]) => [k, validNumber(v) && v > 0 ? v : 0])) as typeof weights;
  const out: FindingResult[] = [];
  for (const f of finds) {
    const family = FAMILIES[SOURCE_FAMILY[f.source_id] ?? "context"];
    const linked = linkedRecords(f, records);
    const applicable = materials(f, linked);
    const matchedTopics = topics.filter(t => f.topics.includes(t));
    const materialMatch = !!s.material && applicable.includes(s.material);
    if (!matchedTopics.length && !materialMatch) continue; // no blanket prefix of unrelated findings
    const publication = !linked.length;
    const isContext = f.kind === "context" || family.phase == null || f.id === "luci-fm2";
    const direct = !publication && f.kind === "observed" && dims.length > 0 && linked.every(r => !r.caveat && differences(r, s).length === 0);
    const rung: FindingRung = isContext ? "context" : family.phase !== "solid" ? "mechanistic" : direct ? "direct" : "analogous";
    const gravities = linked.length ? linked.map(r => r.gravity) : family.gravity === "microgravity" ? ["microgravity"] : family.id === "luci" ? ["lunar"] : [];
    const gravityMatch = !!s.gravity && gravities.length > 0 && gravities.every(g => g === s.gravity);
    // Denominator includes requested features even when finding metadata is missing.
    const total = (topics.length ? safeWeights.topics : 0) + (s.material ? safeWeights.material : 0) + (s.gravity ? safeWeights.gravity : 0);
    const score = (topics.length ? safeWeights.topics * matchedTopics.length / topics.length : 0) + (materialMatch ? safeWeights.material : 0) + (gravityMatch ? safeWeights.gravity : 0);
    const unmatched = dims.filter(k => publication || linked.some(r => differences(r, s).some(d => d.dim === (k === "pressureKpa" ? "pressure" : k))));
    const known = (r: EvidenceRecord, k: typeof dims[number]) => k === "flow" ? r.flowCmS != null : k === "pressureKpa" ? r.pressureKpa != null : r[k] != null;
    const coverage = publication || !dims.length ? null : linked.reduce((n, r) => n + dims.filter(k => known(r, k)).length, 0) / (linked.length * dims.length);
    const whyRelevant = [
      ...matchedTopics.map(t => `The finding addresses ${t}; this topic is requested or triggered by the selected conditions.`),
      ...(materialMatch ? [`${s.material} appears in the quote, material-specific source, or curated supporting records.`] : []),
      ...(gravityMatch ? [`Source gravity overlaps ${s.gravity}${family.id === "luci" ? " only through a spinning-rocket simulation" : ""}.`] : []),
      `${family.name}: ${family.phase ? `${family.phase}-fuel evidence` : "mission context"}.`,
    ];
    const limitations = [
      ...(publication ? ["Publication-level evidence: no explicit test-row link is curated for this finding. Numeric condition coverage is unknown."] : ["Curated related records are not independent replications; the finding may summarize them together."]),
      ...(typeof f.experiments === "string" ? ["A family-level association exists, but it is not counted as individual supporting test records."] : []),
      ...(f.experiments_basis ? [f.experiments_basis] : []),
      ...new Set(linked.flatMap(r => differences(r, s).map(d => `${r.label}: ${d.text}.`))),
      ...new Set(linked.flatMap(r => r.caveat ? [r.caveat] : [])),
      ...(!gravityMatch && s.gravity ? [`The finding does not establish a measured result for the selected ${s.gravity} gravity.`] : []),
      ...(!materialMatch && s.material ? [`Applicability to ${s.material} is ${applicable.length ? `not established by material matches (${applicable.join(", ")})` : "not specified"}.`] : []),
      ...(rung === "mechanistic" ? ["Liquid/gas mechanisms cannot establish a solid-material outcome."] : []),
      ...(isContext ? ["Context, objectives or planned work; not a matched-condition combustion result."] : []),
      ...(family.id === "luci" ? ["Simulated lunar gravity, not a Moon-surface measurement."] : []),
      ...(family.id === "fm2" ? ["FM² is planned; any prior findings cited in its planning documents are not completed FM² Moon-surface results."] : []),
      "Geometry, confinement, scale and full flow history are not jointly matched by this finding score.",
    ];
    out.push({ findingId: f.id, sourceId: f.source_id, relevance: total ? 100 * score / total : 0, matchedTopics,
      unmatchedRequestedDimensions: unmatched, rung, sourceRole: f.in === "abstract" ? "abstract" : undefined,
      supportingRecordIds: linked.map(r => r.id).sort(), supportCount: linked.length, coverage,
      scope: publication ? "publication-level" : "record-linked", whyRelevant, limitations,
      requestedTopics: topics, materialMatch, gravityMatch, coverageTier: 1 });
  }
  // v1.1: a mission-condition question (no material, several topics) that no observation fully addresses lets the
  // findings that address every requested topic lead, still rung-ordered and still labelled context. When any
  // observation addresses the whole question, observations stay first (v1 order).
  const covers = (r: FindingResult) => topics.length > 1 && r.matchedTopics.length === topics.length;
  const contextLeads = !s.material && !out.some(r => (r.rung === "direct" || r.rung === "analogous") && covers(r));
  for (const r of out) r.coverageTier = contextLeads && covers(r) ? 0 : 1;
  return out.sort((a, b) => a.coverageTier - b.coverageTier || ORDER[a.rung] - ORDER[b.rung] || b.relevance - a.relevance || a.findingId.localeCompare(b.findingId));
}

/** Which sort key put `a` ahead of `b`: mirrors rankFindings' comparator exactly. */
export function whyAhead(a: FindingResult, b: FindingResult): string {
  if (a.coverageTier !== b.coverageTier) return "it addresses every requested topic, and no NASA observation does";
  if (a.rung !== b.rung) return `${a.rung} evidence is always ordered before ${b.rung} evidence`;
  if (a.relevance !== b.relevance) return `it has higher relevance (${Math.round(a.relevance)} vs ${Math.round(b.relevance)} / 100)`;
  return "the two tie on every ranking key, so only the finding ID orders them";
}

/** Sensitivity of project weights, not uncertainty in NASA measurements. Rung ordering stays fixed. */
export function findingRobustness(finds: Finding[], records: EvidenceRecord[], query: FindingQuery, n = FINDING_VARIATIONS, seed = 19) {
  const random = rng(seed);
  const count = Number.isFinite(n) ? Math.max(1, Math.min(1000, Math.floor(n))) : FINDING_VARIATIONS;
  const result: Record<string, { top3: number; samples: number }> = {};
  for (let i = 0; i < count; i++) {
    const w = Object.fromEntries(Object.entries(FINDING_WEIGHTS).map(([k, v]) => [k, v * (.75 + .5 * random())])) as typeof FINDING_WEIGHTS;
    rankFindings(finds, records, query, w).forEach((r, rank) => {
      result[r.findingId] ??= { top3: 0, samples: count };
      if (rank < 3) result[r.findingId].top3 += 1 / count;
    });
  }
  return result;
}

export type FireInsight = { findingId: string; sourceId: string; observation: string; whyRelevant: string[]; label: "MicroFire interpretation"; interpretation: string; limitations: string[] };
const INSIGHTS: Record<string, string> = {
  "dim-blue-low-flow": "Low-visibility combustion is relevant to the detection question under weak-flow conditions. This observation does not establish detection performance for the selected habitat.",
  "flames-survive-below-1": "Weak airflow is not, by itself, evidence that combustion has ended. Transfer to the selected material and habitat remains an open question.",
  "low-flow-sensitivity": "The reported sensitivity makes ventilation conditions relevant when comparing flame observations. It does not isolate airflow as the cause of outcomes in separate tests.",
  "pmma-rod-limits": "The reported boundaries make oxygen and airflow relevant to the research question. A rod result does not establish limits for a panel, fabric or different habitat.",
  "luci-first-lunar": "Simulated partial-gravity experiments offer a closer gravity analogy than orbital tests for a lunar question. Their platform and duration limit transfer to a habitat.",
  "saffire-alarm-981-s": "Detection response in the reported spacecraft experiment is relevant to a smoke-detection question. It does not specify an alarm response for the selected habitat.",
  "saffire-co-co2-limits": "The reported gas measurements make combustion products relevant alongside visible flame behavior. They do not estimate exposure in a different habitat.",
};
export function validateInsight(x: FireInsight, finds: Finding[]) {
  const f = finds.find(f => f.id === x.findingId && f.source_id === x.sourceId);
  return !!f && f.kind === "observed" && x.observation === f.quote && x.label === "MicroFire interpretation"
    && x.interpretation === INSIGHTS[f.id] && x.limitations.length > 0
    && !/\b(safe|unsafe|must|should|certif\w*|probability|shut off|turn off|extinguish the)\b/i.test(x.interpretation);
}
export function fireInsight(ranked: FindingResult[], finds: Finding[]): FireInsight | null {
  const r = ranked.find(r => r.rung !== "context" && r.rung !== "mechanistic" && r.matchedTopics.length && INSIGHTS[r.findingId]);
  const f = r && finds.find(f => f.id === r.findingId);
  if (!r || !f) return null;
  const x: FireInsight = { findingId:f.id, sourceId:f.source_id, observation:f.quote, whyRelevant:r.whyRelevant,
    label:"MicroFire interpretation", interpretation:INSIGHTS[f.id], limitations:r.limitations };
  return validateInsight(x, finds) ? x : null;
}
