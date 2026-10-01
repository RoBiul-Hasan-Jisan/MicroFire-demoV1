/**
 * Retrieval and citation checking for the Ask page. Pure functions: the model never sees
 * anything but the evidence package built here, and every claim it returns is checked
 * against that package before it reaches the page.
 */
import type { Experiment, Finding } from "./types";
import { outsideEvidence, rank, type Scenario } from "./relevance.ts";

export type EvidenceItem = {
  key: string; // "E:bass2-B19" or "F:low-flow-sensitivity"
  kind: "test" | "finding";
  title: string;
  text: string;
  href: string;
};

export type ClaimType = "OBSERVED" | "DERIVED" | "INTERPRETATION" | "DATA_GAP";
export const CLAIM_TYPES: ClaimType[] = ["OBSERVED", "DERIVED", "INTERPRETATION", "DATA_GAP"];

export type RawAnswer = { summary: string; claims: { text: string; type: ClaimType; cites: string[] }[] };

export type CheckedClaim = RawAnswer["claims"][number] & { verified: boolean; issues: string[] };

const MATERIAL_WORDS: [RegExp, string][] = [
  [/\b(pmma|acrylic|plexiglas)/i, "PMMA"],
  [/\b(sibal|fabric|cotton|cloth|textile)/i, "SIBAL fabric"],
  [/\bnomex/i, "Nomex"],
];

const TOPIC_WORDS: [RegExp, string][] = [
  [/\b(air ?flow|flow|ventilat|fan|wind|draft)/i, "airflow"],
  [/\b(oxygen|o2|o₂)/i, "oxygen"],
  [/\b(quench|extinguish|went out|go out|starv)/i, "quench"],
  [/\b(blow ?off|blew|blown)/i, "blowoff"],
  [/\b(moon|lunar|mars|martian|partial|gravity)/i, "partial-gravity"],
  [/\b(pressure|kpa|atmosphere|exploration)/i, "pressure"],
  [/\b(detect|smoke|sensor|alarm|unnoticed|undetected)/i, "detection"],
  [/\b(confine|duct|baffle|scale|saffire|large)/i, "confinement"],
  [/\b(thick|thin|width|wide|narrow|geometry|size)/i, "geometry"],
];

const TEST_ID = /\b(B\d{1,2}|F\d|GMT\d{2,3}-T\d{1,2}[ab]?)\b/gi;

export function parseQuestion(q: string): { scenario: Scenario; topics: Set<string>; testIds: string[] } {
  const scenario: Scenario = {};
  const o2 = q.match(/(\d{1,2}(?:\.\d+)?)\s*%/);
  if (o2) scenario.oxygen = Number(o2[1]);
  const flow = q.match(/(\d{1,2}(?:\.\d+)?)\s*cm\s*\/\s*s/i);
  if (flow) scenario.flow = Number(flow[1]);
  const kpa = q.match(/(\d{2,3}(?:\.\d+)?)\s*kpa/i);
  if (kpa) scenario.pressureKpa = Number(kpa[1]);
  if (/\b(moon|lunar)\b/i.test(q)) scenario.gravity = "lunar";
  else if (/\b(mars|martian)\b/i.test(q)) scenario.gravity = "martian";
  for (const [re, m] of MATERIAL_WORDS) if (re.test(q)) scenario.material = m;
  const topics = new Set(TOPIC_WORDS.filter(([re]) => re.test(q)).map(([, t]) => t));
  const testIds = [...q.matchAll(TEST_ID)].map((m) => m[1].toUpperCase());
  return { scenario, topics, testIds };
}

function testItem(e: Experiment): EvidenceItem {
  const r = e.provenance.record;
  const parts = [
    `${e.investigation} test ${e.test_id}`,
    `material ${e.material_verbatim}`,
    `${e.flow_direction} flow`,
    `oxygen ${e.oxygen_vol_pct ?? "not stated"} %`,
    `airflow as recorded "${e.flow_verbatim}" (cm/s; "pot" values are fan settings)`,
    e.thickness_mm != null ? `thickness ${e.thickness_mm} mm` : "thickness not stated",
    e.width_mm != null ? `width ${e.width_mm} mm` : "",
    `outcome: ${e.outcome_label} (coded by MicroFire Atlas from NASA's notes)`,
    e.observations_verbatim ? `NASA notes: "${e.observations_verbatim}"` : "no NASA notes",
    e.quality_flags.length ? `caution flags: ${e.quality_flags.join(", ")}` : "",
    `source: ${r.source_id} ${r.table ?? ""}, PDF page ${r.pdf_page}`,
    "run in microgravity aboard the ISS",
  ];
  return {
    key: `E:${e.id}`,
    kind: "test",
    title: `${e.investigation} test ${e.test_id}`,
    text: parts.filter(Boolean).join("; "),
    href: `/experiments/${e.id}`,
  };
}

function findingItem(f: Finding): EvidenceItem {
  return {
    key: `F:${f.id}`,
    kind: "finding",
    title: `${f.kind === "observed" ? "Reported observation" : "Authors' interpretation"} (${f.source_id})`,
    text: `"${f.quote}" (source: ${f.source_id}, ${f.pdf_page ? `PDF page ${f.pdf_page}` : "abstract"})`,
    href: "/sources",
  };
}

/** Deterministic evidence package for a question. */
export function buildEvidence(q: string, exps: Experiment[], finds: Finding[]) {
  const { scenario, topics, testIds } = parseQuestion(q);
  const named = exps.filter((e) => testIds.includes(e.test_id.toUpperCase()));
  const hasScenario = Object.keys(scenario).length > 0;
  const ranked = hasScenario ? rank(exps, scenario).slice(0, 10).map((r) => r.experiment) : [];
  const tests = [...new Map([...named, ...ranked].map((e) => [e.id, e])).values()].slice(0, 12);

  const scored = finds
    .map((f) => ({
      f,
      s:
        f.topics.filter((t) => topics.has(t)).length +
        (Array.isArray(f.experiments) && f.experiments.some((id) => tests.some((e) => e.id === id)) ? 2 : 0),
    }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.f.id.localeCompare(b.f.id))
    .slice(0, 8)
    .map((x) => x.f);

  return {
    items: [...tests.map(testItem), ...scored.map(findingItem)],
    scenario,
    outside: hasScenario ? outsideEvidence(exps, scenario) : [],
  };
}

export const SYSTEM_PROMPT = `You answer questions about NASA microgravity fire experiments for MicroFire Atlas.

Use only the evidence items in the user message. They are transcribed NASA test records and verbatim quotes from NASA reports. Do not use outside knowledge for facts, numbers, test IDs or citations.

Return a short summary and a list of claims. Each claim has a type:
- OBSERVED: something NASA recorded or reported. Cite the evidence keys that state it.
- DERIVED: a comparison or count you computed from cited items, such as which of two tests had more oxygen. Cite every item used.
- INTERPRETATION: your reading of what the cited evidence suggests. Phrase it tentatively and cite the items it rests on. Do not state causes unless a cited NASA quote states them.
- DATA_GAP: what the evidence does not cover. Cites may be empty.

Rules:
- Cite only keys that appear in the evidence list, exactly as written (for example "E:bass2-B19" or "F:low-flow-sensitivity").
- Copy numbers exactly as they appear in the cited items.
- All tests were run in microgravity aboard the ISS. Never present them as Moon or Mars measurements; if asked about other gravity levels, say what the cited partial-gravity quotes report and add a DATA_GAP claim.
- These are past test outcomes, not predictions or safety ratings. Do not give operational crew advice.
- If the evidence does not answer the question, say so in the summary and return DATA_GAP claims.
- Keep the summary under 80 words and use at most 6 claims.`;

export const ANSWER_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    claims: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          type: { type: "string", enum: CLAIM_TYPES },
          cites: { type: "array", items: { type: "string" } },
        },
        required: ["text", "type", "cites"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "claims"],
  additionalProperties: false,
} as const;

export function userMessage(q: string, items: EvidenceItem[], outside: string[]) {
  const list = items.map((i) => `[${i.key}] ${i.text}`).join("\n");
  const notes = outside.length ? `\nScenario notes from the atlas:\n${outside.map((o) => `- ${o}`).join("\n")}\n` : "";
  return `Evidence items:\n${list || "(none matched this question)"}\n${notes}\nQuestion: ${q}`;
}

const NUMBER = /\d+(?:\.\d+)?/g;

/**
 * Citation check. A claim is verified only if every cite exists in the package and, for
 * OBSERVED and DERIVED claims, every number in the claim appears in at least one cited item.
 */
export function checkAnswer(raw: RawAnswer, items: EvidenceItem[]): CheckedClaim[] {
  const byKey = new Map(items.map((i) => [i.key, i]));
  return raw.claims.slice(0, 8).map((c) => {
    const issues: string[] = [];
    const cites = c.cites.filter((k) => byKey.has(k));
    const unknown = c.cites.filter((k) => !byKey.has(k));
    if (unknown.length) issues.push(`Removed citations not in the evidence: ${unknown.join(", ")}`);
    const factual = c.type === "OBSERVED" || c.type === "DERIVED";
    if (factual && cites.length === 0) issues.push("No valid citation for a factual claim");
    if (c.type === "INTERPRETATION" && cites.length === 0) issues.push("Interpretation cites no evidence");
    if (factual && cites.length) {
      // Compare whole numbers, not substrings: "12" must not match inside "112".
      const citedNumbers = new Set(cites.flatMap((k) => byKey.get(k)!.text.match(NUMBER) ?? []));
      const missing = (c.text.match(NUMBER) ?? []).filter((n) => !citedNumbers.has(n));
      if (missing.length) issues.push(`Numbers not found in cited evidence: ${missing.join(", ")}`);
    }
    return { ...c, cites, verified: issues.length === 0, issues };
  });
}

/** Shape check on model output (structured outputs constrain it, but never trust the wire). */
export function isRawAnswer(x: unknown): x is RawAnswer {
  if (!x || typeof x !== "object") return false;
  const a = x as RawAnswer;
  return (
    typeof a.summary === "string" &&
    Array.isArray(a.claims) &&
    a.claims.every(
      (c) => typeof c.text === "string" && CLAIM_TYPES.includes(c.type) && Array.isArray(c.cites) && c.cites.every((k) => typeof k === "string"),
    )
  );
}
