/**
 * Challenge Mode: the whole MicroFire answer to one mission question, computed from the curated data.
 * Every stage is derived from existing systems (ladder, experiment and finding ranking, robustness, insight
 * templates, the verified AI example, the Ask guards). Nothing here is written by hand except labels.
 */
import { ATMOSPHERES } from "./atmospheres.ts";
import { buildEvidence } from "./ask-core.ts";
import { verifiedExample } from "./ask-example.ts";
import { findingRobustness, findingTopics, fireInsight, rankFindings } from "./finding-relevance.ts";
import { differences, FAMILIES, ladder, SOURCE_FAMILY, TOLERANCE, type Difference, type EvidenceRecord, type FamilyId, type MissionQuestion } from "./ontology.ts";
import { rank, type Scenario } from "./relevance.ts";
import { rankRobustness } from "./robustness.ts";
import type { Experiment, Finding, LuciRun, SaffireRun } from "./types";

export type DimStatus = "match" | "near" | "different" | "not reported";
export type CompareRow = { record: EvidenceRecord; dims: { dim: string; you: string; record: string; status: DimStatus }[] };

/** The canonical judge question: a NASA-studied atmosphere posed as a lunar research scenario, never "the Moon atmosphere". */
export const CHALLENGE_ATMOSPHERES = ["ea-a", "ea-alt"] as const;
export type ChallengeAtmosphere = (typeof CHALLENGE_ATMOSPHERES)[number];

export function challengeQuestion(atm: ChallengeAtmosphere = "ea-a"): { q: MissionQuestion; text: string; scenario: string } {
  const a = ATMOSPHERES.find((x) => x.id === atm)!;
  return {
    q: { material: "PMMA", oxygen: a.o2!, pressureKpa: a.kpa!, gravity: "lunar", flow: 20 },
    text: "What does NASA actually know about PMMA fire under a future lunar-habitat scenario?",
    scenario: `PMMA, lunar gravity, ${a.kpa} kPa with ${a.o2} % oxygen (the ${a.name}, a NASA-studied configuration posed here as a lunar research scenario), 20 cm/s airflow`,
  };
}

const num = (you: number | undefined, rec: number | null | undefined, tol: number, unit: string, dim: string) => {
  if (you == null) return null;
  if (rec == null) return { dim, you: `${you} ${unit}`, record: "not reported", status: "not reported" as DimStatus };
  const d = Math.abs(rec - you);
  return { dim, you: `${you} ${unit}`, record: `${rec} ${unit}`, status: (d < 1e-9 ? "match" : d <= tol ? "near" : "different") as DimStatus };
};

export function compareRow(r: EvidenceRecord, q: MissionQuestion): CompareRow {
  const dims = [
    { dim: "Material", you: q.material!, record: r.material, status: (r.material === q.material ? "match" : "different") as DimStatus },
    num(q.oxygen, r.oxygen, TOLERANCE.oxygen, "% O₂", "Oxygen"),
    num(q.pressureKpa, r.pressureKpa ? (r.pressureKpa[0] + r.pressureKpa[1]) / 2 : null, TOLERANCE.pressureKpa, "kPa", "Pressure"),
    { dim: "Gravity", you: q.gravity!, record: r.gravity, status: (r.gravity === q.gravity ? "match" : "different") as DimStatus },
    num(q.flow, r.flowCmS, Math.max(1, (q.flow ?? 0) * TOLERANCE.flowFraction), "cm/s", "Airflow"),
  ].filter((x): x is NonNullable<typeof x> => x != null);
  return { record: r, dims };
}

export function buildChallenge(data: { experiments: Experiment[]; findings: Finding[]; saffire: SaffireRun[]; luci: LuciRun[]; records: EvidenceRecord[] }, atm: ChallengeAtmosphere = "ea-a") {
  const { q, text, scenario } = challengeQuestion(atm);
  const l = ladder(data.records, data.findings, q);

  // 1 FIND: which evidence families the retrieval consulted, and what each one can contribute
  const familyRole = (id: FamilyId) => (FAMILIES[id].phase == null ? "context" : id === "fm2" ? "planned, no results yet" : FAMILIES[id].phase !== "solid" ? "mechanism only" : ["bass2", "saffire", "luci"].includes(id) ? "structured test records" : "verified findings");
  const recordFamilies = new Map<FamilyId, number>();
  for (const r of data.records) recordFamilies.set(r.family, (recordFamilies.get(r.family) ?? 0) + 1);
  const findingFamilies = new Map<FamilyId, number>();
  for (const f of data.findings) { const fam = SOURCE_FAMILY[f.source_id] ?? "context"; findingFamilies.set(fam, (findingFamilies.get(fam) ?? 0) + 1); }
  const find = (Object.keys(FAMILIES) as FamilyId[]).filter((id) => id !== "context").map((id) => ({
    id, name: FAMILIES[id].name, role: familyRole(id), records: recordFamilies.get(id) ?? 0, findings: findingFamilies.get(id) ?? 0,
  }));

  // 2 COMPARE: the closest test records across all families
  const closest = [...l.direct, ...l.analogous].slice(0, 3).map((x) => compareRow(x.record, q));

  // 3 + 4 SUMMARIZE / RANK findings: the existing finding ranking, with its own robustness
  const findingQuery = { scenario: q, topics: findingTopics({ scenario: q }) };
  const rankedFindings = rankFindings(data.findings, data.records, findingQuery);
  const findingStability = findingRobustness(data.findings, data.records, findingQuery);
  const topFindings = rankedFindings.slice(0, 3).map((r) => ({ result: r, finding: data.findings.find((f) => f.id === r.findingId)!, top3: findingStability[r.findingId]?.top3 ?? null }));

  // 4 RANK experiments: Mission Relevance ranks BASS-II rows (its documented scope), with robustness
  const scen: Scenario = { oxygen: q.oxygen, flow: q.flow, pressureKpa: q.pressureKpa, gravity: q.gravity, material: q.material };
  const rankedTests = rank(data.experiments, scen).slice(0, 3);
  const testStability = rankRobustness(data.experiments, scen);
  const topTests = rankedTests.map((r) => ({
    experiment: r.experiment, relevance: r.score, coverage: r.coverage, stability: testStability.get(r.experiment.id)!,
    // why this rank: the conditions that score well and the ones that do not, straight from the relevance terms
    matches: r.terms.filter((x) => (x.sim ?? 0) >= 0.5).map((x) => `${x.label.toLowerCase()} (${x.testValue})`),
    misses: r.terms.filter((x) => x.sim == null || x.sim < 0.5).map((x) => (x.sim == null ? `${x.label.toLowerCase()} not reported` : x.label.toLowerCase())),
  }));

  // 5 INTERPRET: a reviewed insight template, or nothing
  const insight = fireInsight(rankedFindings, data.findings);

  // 6 AI: the verified example, with each check computed by the current checker
  const ai = verifiedExample(data.experiments, data.findings, data.saffire, data.luci);

  // 7 GAP + 8 NEXT
  // where each condition WAS tested: the gap is the combination, so show coverage condition by condition
  const DIMS: [Difference["dim"], string][] = [["material", "Material"], ["gravity", "Gravity"], ["oxygen", "Oxygen"], ["pressure", "Pressure"], ["flow", "Airflow"]];
  const coverage = DIMS.map(([dim, label]) => {
    const ok = data.records.filter((r) => !differences(r, q).some((d) => d.dim === dim));
    const fams = [...new Set(ok.map((r) => FAMILIES[r.family].name))];
    return { dim, label, count: ok.length, families: fams };
  });
  const gap = { coverage, direct: l.direct.length, analogous: l.analogous.length, mechanistic: l.findings.mechanistic.length, gaps: l.gaps, nextExperiment: l.nextExperiment };

  return { q, text, scenario, atm, find, closest, topFindings, topTests, insight, ai, gap };
}

/** "MicroFire says no": a probability question gets the evidence, the mismatches and the open question, never a number. */
export const ABSTAIN_QUESTION = "What is the probability that PMMA ignites in a lunar habitat at 34% oxygen?";
export function abstention(data: { experiments: Experiment[]; findings: Finding[]; saffire: SaffireRun[]; luci: LuciRun[]; records: EvidenceRecord[] }) {
  const ev = buildEvidence(ABSTAIN_QUESTION, data.experiments, data.findings, data.saffire, data.luci);
  const q: MissionQuestion = { material: "PMMA", oxygen: 34, gravity: "lunar" };
  const l = ladder(data.records, data.findings, q);
  const closest = l.analogous[0] ?? null;
  const observed = rankFindings(data.findings, data.records, { scenario: q, topics: findingTopics({ scenario: q }) }).find((r) => r.rung === "analogous");
  return {
    refuses: ev.gapDims.includes("prediction"),
    reason: ev.outside[ev.gapDims.indexOf("prediction")] ?? null,
    closest,
    mismatches: closest?.differs.map((d) => d.text) ?? [],
    observed: observed ? data.findings.find((f) => f.id === observed.findingId)! : null,
    unknown: l.gaps.map((g) => g.text),
    next: l.nextExperiment,
  };
}

/** The challenge brief, word by word, mapped to where the product does it. Every href is a real route. */
export const TRACEABILITY = [
  { verb: "Find", what: "Search structured NASA evidence across experiment families", href: "/atlas", where: "Evidence Atlas" },
  { verb: "Compare", what: "See conditions side by side: what matched, what differed, what was not reported", href: "/compare", where: "Compare Lab" },
  { verb: "Summarize", what: "Read verified NASA findings, quoted word for word with their pages", href: "/mission?context=moon-base#ranked-findings", where: "Top relevant NASA findings" },
  { verb: "Rank", what: "Rank experiments and findings for mission conditions, with ranking robustness", href: "/mission?context=moon-base", where: "Mission Analyst" },
  { verb: "Interpret", what: "Turn an observation into a carefully bounded fire-safety implication", href: "/mission?context=still-air#fire-safety-insight", where: "Evidence-backed insight" },
  { verb: "AI-powered", what: "Evidence is retrieved first; AI synthesizes; every factual claim is checked", href: "/ask", where: "Ask, with a verified example" },
  { verb: "Evidence-bounded ML", what: "A validated model on NASA tests, gated so it abstains outside the conditions NASA tested", href: "/model-lab", where: "AI Model Lab" },
  { verb: "Human space exploration", what: "NASA-studied exploration atmospheres, orbit, simulated lunar gravity and planned Moon-surface tests", href: "/gaps", where: "Research Frontier" },
  { verb: "Uncertainty", what: "Evidence Ladder, ranking robustness and named gaps show where the evidence stops", href: "/methodology#robustness", where: "Methodology" },
] as const;
