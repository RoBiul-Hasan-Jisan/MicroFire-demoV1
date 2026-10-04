/**
 * Retrieval and citation checking for the Ask page. Pure functions: the model never sees
 * anything but the evidence package built here, and every claim it returns is checked
 * against that package before it reaches the page.
 */
import type { Experiment, Finding, SaffireRun } from "./types";
import { predictOutcome, type Model } from "./model.ts";
import { rank, type Scenario } from "./relevance.ts";
import { differences, FAMILIES, fromBass, fromSaffire, KIND_LABEL, ladder, SOURCE_FAMILY, type FamilyId, type MissionQuestion } from "./ontology.ts";

export type EvidenceRung = "direct" | "analogous" | "mechanistic" | "context";
export type EvidenceItem = {
  key: string; // "E:bass2-B19", "S:saffire-vi-2" or "F:low-flow-sensitivity"
  kind: "test" | "finding" | "model";
  title: string;
  text: string;
  href: string;
  family?: FamilyId;
  /** Where this item sits on the Evidence Ladder for the question (tests), or its physical regime (findings). */
  rung?: EvidenceRung;
  /** Gravity the item was measured in; lets the checker refuse microgravity data phrased as lunar. */
  gravity?: "microgravity" | "partial";
};

export type ClaimType = "OBSERVED" | "DERIVED" | "INTERPRETATION" | "DATA_GAP";
export const CLAIM_TYPES: ClaimType[] = ["OBSERVED", "DERIVED", "INTERPRETATION", "DATA_GAP"];

export type RawAnswer = { summary: string; claims: { text: string; type: ClaimType; cites: string[] }[] };

export type CheckedClaim = RawAnswer["claims"][number] & { verified: boolean; issues: string[] };

const MATERIAL_WORDS: [RegExp, string][] = [
  [/\b(pmma|acrylic|plexiglas)/i, "PMMA"],
  [/\b(sibal|fabric|cotton|cloth|textile)/i, "SIBAL fabric"],
  [/\bnomex/i, "Nomex"],
  [/\bsilicone/i, "Silicone"],
];
/** Materials people ask about that no record in this atlas used: named, so the ladder reports the gap instead of matching other materials. */
const UNTESTED_MATERIALS: [RegExp, string][] = [
  [/\bkapton|polyimide/i, "Kapton"],
  [/\bteflon|ptfe\b/i, "Teflon"],
  [/\bwood(?:en)?\b/i, "wood"],
  [/\bpaper|cardboard/i, "paper"],
  [/\bpolyethylene|plastic bag/i, "polyethylene"],
  [/\bnylon|velcro/i, "nylon"],
  [/\b(?:polyurethane )?foam\b/i, "foam"],
  [/\brubber\b/i, "rubber"],
  [/\balumin(?:i)?um\b/i, "aluminium"],
];

const TOPIC_WORDS: [RegExp, string][] = [
  [/\b(air ?flow|flow|ventilat|fan|wind|draft)/i, "airflow"],
  [/\b(oxygen|o2|o₂)/i, "oxygen"],
  [/\b(quench|extinguish|went out|go out|starv)/i, "quench"],
  [/\b(blow ?off|blew|blown)/i, "blowoff"],
  [/\b(moon|lunar|mars|martian|partial|gravity|luci|sounding rocket|fm2|fm²)/i, "partial-gravity"],
  [/\b(pressure|kpa|atmosphere|exploration)/i, "pressure"],
  [/\b(detect|smoke|sensor|alarm|unnoticed|undetected)/i, "detection"],
  [/\b(confine|duct|baffle|scale|large)/i, "confinement"],
  [/\b(thick|thin|width|wide|narrow|geometry|size)/i, "geometry"],
  [/\b(large|big|scale|cargo|cygnus|saffire|spacecraft fire)/i, "scale"],
  [/\b(smoke|toxic|carbon monoxide|co₂|co2|alarm|fumes|hazard|crew)/i, "smoke"],
  [/\b(duct|apparatus|glovebox|igniter|camera|hardware|radiometer)/i, "apparatus"],
  [/\b(extinguish|suppress|put (it )?out|fight|diluent)/i, "suppression"],
  [/\b(nomex|silicone|rated|screening|6001|which materials?)/i, "materials-screening"],
  [/\b(droplet|liquid fuel|heptane|methanol|flex)\b/i, "droplet"],
  [/\b(gas flame|gaseous|spherical flame|acme)\b/i, "gas-flame"],
];

const SAFFIRE_ID = /\b(?:saffire[\s-]*)?((?:IV|VI|V)-\d|[12]-\d)\b/gi;

const TEST_ID = /\b(B\d{1,2}|F\d|GMT\d{2,3}-T\d{1,2}[ab]?)\b/gi;

export function parseQuestion(q: string): { scenario: Scenario; topics: Set<string>; testIds: string[]; saffireIds: string[] } {
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
  for (const [re, m] of UNTESTED_MATERIALS) if (re.test(q)) scenario.material = m;
  const topics = new Set(TOPIC_WORDS.filter(([re]) => re.test(q)).map(([, t]) => t));
  const testIds = [...q.matchAll(TEST_ID)].map((m) => m[1].toUpperCase());
  // "2-7" alone is too ambiguous; plain digit samples count only when the word Saffire is in the question
  const saffireIds = [...q.matchAll(SAFFIRE_ID)].map((m) => m[1].toUpperCase()).filter((id) => /^[IV]/.test(id) || /saffire/i.test(q));
  return { scenario, topics, testIds, saffireIds };
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
    family: "bass2",
    gravity: "microgravity",
  };
}

function saffireItem(r: SaffireRun): EvidenceItem {
  const c = r.provenance.results ?? r.provenance.conditions ?? r.provenance.outcome;
  const parts = [
    `Saffire flight ${r.flight.replace("Saffire-", "")}, sample ${r.sample}`,
    `material ${r.material_verbatim}`,
    r.width_cm != null || r.length_cm != null ? `sample ${r.width_cm != null ? `${r.width_cm} cm wide, ` : ""}${r.length_cm ?? "?"} cm long` : "",
    r.thickness_mm != null ? `thickness ${r.thickness_mm} mm` : "",
    r.flow_cm_s != null ? `${r.flow_direction} flow ${r.flow_cm_s} cm/s` : "airflow not stated",
    r.pressure_kpa != null ? `pressure ${r.pressure_kpa} kPa` : "pressure not stated",
    r.o2_pct != null ? `oxygen ${r.o2_basis === "recorded" ? "" : "about "}${r.o2_pct} %` : "oxygen not stated",
    r.burn_duration_s != null ? `burn duration ${r.burn_duration_s} s` : "",
    r.spread_rate_mm_s != null ? `spread rate ${r.spread_rate_mm_s} mm/s` : "",
    r.heat_release_avg_w != null ? `average heat release ${r.heat_release_avg_w} W` : "",
    `outcome: ${r.outcome_label}`,
    r.provenance.outcome ? `NASA: "${r.provenance.outcome.quote}"` : "",
    c ? `source: ${c.source_id}, PDF page ${c.pdf_page}` : "",
    "large-scale fire in microgravity inside an uncrewed Cygnus cargo vehicle in orbit, not aboard the ISS",
  ];
  return { key: `S:${r.id}`, kind: "test", title: `Saffire ${r.flight.replace("Saffire-", "")} sample ${r.sample}`, text: parts.filter(Boolean).join("; "), href: `/saffire#${r.id}`, family: "saffire", gravity: "microgravity" };
}

function findingItem(f: Finding): EvidenceItem {
  const family = SOURCE_FAMILY[f.source_id] ?? "context";
  const phase = FAMILIES[family].phase;
  const rung: EvidenceRung = phase == null ? "context" : phase === "solid" ? "analogous" : "mechanistic";
  const regime = rung === "mechanistic" ? ` (${FAMILIES[family].name}: ${FAMILIES[family].fuel}; mechanistic evidence only, not solid-material behaviour)` : "";
  return {
    key: `F:${f.id}`,
    kind: "finding",
    title: `${KIND_LABEL[f.kind]} (${f.source_id})`,
    text: `"${f.quote}" (source: ${f.source_id}, ${f.pdf_page ? `PDF page ${f.pdf_page}` : "abstract"})${regime}`,
    href: "/sources",
    family,
    rung,
    gravity: f.topics.includes("partial-gravity") && family !== "saffire" ? "partial" : "microgravity",
  };
}

const toQuestion = (s: Scenario): MissionQuestion => ({ material: s.material, oxygen: s.oxygen, pressureKpa: s.pressureKpa, gravity: s.gravity, flow: s.flow });

/** Deterministic evidence package for a question. Saffire runs join when the question reaches their regime. */
/**
 * The outcome model as one evidence item. It is MicroFire Atlas\'s own statistical estimate, not a NASA record,
 * so it carries no rung, is only built when the question gives both oxygen and airflow, and is never offered for
 * lunar or Mars gravity (the model was trained on microgravity tests only).
 */
function modelItem(q: string, scenario: Scenario, model?: Model): EvidenceItem | null {
  if (!model || scenario.oxygen == null || scenario.flow == null || scenario.gravity) return null;
  const direction = /opposed/i.test(q) ? "opposed" : "concurrent";
  const stated = /opposed|concurrent/i.test(q);
  const r = predictOutcome(model, { o2: scenario.oxygen, flow: scenario.flow, direction });
  const pct = (v: number) => Math.round(v * 100);
  const bal = model.report?.models?.logistic_oxygen_flow_direction_SHIPPED?.balanced_accuracy;
  const outside = !r.inRange.o2 || !r.inRange.flow;
  const text = [
    `MicroFire Atlas outcome model (a statistical estimate trained on ${model.report?.n_rows ?? model.points.length} NASA microgravity tests; not a NASA result)`,
    `for oxygen ${scenario.oxygen} %, airflow ${scenario.flow} cm/s, ${direction} flow${stated ? "" : " (direction not stated, concurrent assumed)"}`,
    `it estimates a ${pct(r.p)} % chance the flame was sustained, 90 % bootstrap interval ${pct(r.lo)} % to ${pct(r.hi)} %`,
    bal != null ? `cross-validated balanced accuracy ${bal} (no-skill baseline 0.5)` : "",
    outside ? `these conditions are outside the tested range (oxygen ${model.ranges.o2_pct[0]} to ${model.ranges.o2_pct[1]} %, airflow ${model.ranges.flow_cm_s[0]} to ${Math.round(model.ranges.flow_cm_s[1])} cm/s), so this is an extrapolation` : "",
    `closest real tests: ${r.nearest.slice(0, 3).map((n) => `${n.id} (${n.o2} %, ${n.flow} cm/s, ${n.sustained ? "kept burning" : "went out or did not ignite"})`).join("; ")}`,
    "model uses oxygen, airflow speed and direction only; run in microgravity data",
  ].filter(Boolean).join("; ");
  return { key: "M:outcome-model", kind: "model", title: "Outcome model estimate", text, href: "/predict", gravity: "microgravity" };
}

export function buildEvidence(q: string, exps: Experiment[], finds: Finding[], saffire: SaffireRun[] = [], model?: Model) {
  const { scenario, topics, testIds, saffireIds } = parseQuestion(q);
  const named = exps.filter((e) => testIds.includes(e.test_id.toUpperCase()));
  const hasScenario = Object.keys(scenario).length > 0;
  const ranked = hasScenario ? rank(exps, scenario).slice(0, 10).map((r) => r.experiment) : [];
  const tests = [...new Map([...named, ...ranked].map((e) => [e.id, e])).values()].slice(0, 12);

  // Saffire: named runs, plus the closest runs when the question is about scale, smoke, low pressure or high oxygen
  const wantsSaffire =
    saffireIds.length > 0 || topics.has("scale") || topics.has("smoke") || (scenario.pressureKpa ?? 101) < 90 || (scenario.oxygen ?? 21) > 22 || topics.has("materials-screening");
  const sq = toQuestion(scenario);
  const saffirePicked = !wantsSaffire
    ? []
    : [
        ...saffire.filter((r) => saffireIds.includes(r.sample.toUpperCase())),
        ...saffire
          .map((r) => ({ r, d: differences(fromSaffire(r), sq), size: Math.max(r.width_cm ?? 0, r.length_cm ?? 0) }))
          // with conditions: closest first; without (a question about scale or smoke): the largest fires first
          .sort((a, b) => (hasScenario ? a.d.length - b.d.length : b.size - a.size) || a.r.id.localeCompare(b.r.id))
          .slice(0, 4)
          .map((x) => x.r),
      ];
  const saffireRuns = [...new Map(saffirePicked.map((r) => [r.id, r])).values()].slice(0, 6);

  // a named Saffire flight points at its own report
  const flightSource = /saffire[\s-]*(vi\b|6)/i.test(q) ? "saffire-6" : /saffire[\s-]*(iv|v\b|4|5)/i.test(q) ? "saffire-4-5" : /saffire[\s-]*(i{1,3}\b|[123]\b)/i.test(q) ? "saffire-1-3" : null;
  const scored = finds
    .map((f) => ({
      f,
      s:
        f.topics.filter((t) => topics.has(t)).length +
        (f.source_id === flightSource ? 1 : 0) +
        (Array.isArray(f.experiments) && f.experiments.some((id) => tests.some((e) => e.id === id) || saffireRuns.some((r) => r.id === id)) ? 2 : 0),
    }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.f.id.localeCompare(b.f.id))
    .slice(0, 8)
    .map((x) => x.f);

  // every test is placed on the ladder for this question; the closest evidence comes first
  const placedTests = [
    ...tests.map((e) => ({ item: testItem(e), d: hasScenario ? differences(fromBass(e), sq).length : 1 })),
    ...saffireRuns.map((r) => ({ item: saffireItem(r), d: hasScenario ? differences(fromSaffire(r), sq).length : 1 })),
  ]
    .map((x, i) => ({ ...x, i }))
    .sort((a, b) => (hasScenario ? a.d - b.d : 0) || a.i - b.i)
    .map(({ item, d }) => ({ ...item, rung: (d === 0 && hasScenario ? "direct" : "analogous") as EvidenceRung }));
  // gaps come from the ladder over every family, so a Saffire run at 31 % oxygen counts as tested ground
  const records = [...exps.map(fromBass), ...saffire.map(fromSaffire)];
  const gaps: { dim: string; text: string }[] = hasScenario ? ladder(records, [], sq).gaps : [];
  // records the question names that this atlas does not hold are gaps too, never silently ignored
  for (const id of testIds) if (!named.some((e) => e.test_id.toUpperCase() === id)) gaps.push({ dim: "record", text: `This atlas holds no test ${id}.` });
  const flight = q.match(/\bsaffire[\s-]*(vii+|ix|x|[7-9]|1\d)\b/i);
  if (flight) gaps.push({ dim: "record", text: `This atlas holds Saffire I to VI only; it has no Saffire ${flight[1].toUpperCase()} record.` });
  // a question about a concept rather than conditions or named records reads NASA's own words first
  const conceptual = scenario.oxygen == null && scenario.flow == null && scenario.pressureKpa == null && !named.length && !saffireIds.length;
  const quoteItems = scored.map(findingItem);
  const mItem = modelItem(q, scenario, model);
  // the model estimate always comes last: it never displaces NASA evidence from the top of the package
  return {
    items: [...(conceptual ? [...quoteItems, ...placedTests] : [...placedTests, ...quoteItems]), ...(mItem ? [mItem] : [])],
    scenario,
    outside: gaps.map((g) => g.text),
    gapDims: gaps.map((g) => g.dim),
  };
}


export const SYSTEM_PROMPT = `You answer questions about NASA microgravity fire experiments for MicroFire Atlas.

Use only the evidence items in the user message. They are transcribed NASA test records (BASS-II "E:" keys, Saffire "S:" keys) and verbatim quotes from NASA reports ("F:" keys). Do not use outside knowledge for facts, numbers, test IDs or citations.

Each item carries an evidence rung for this question:
- direct: same material, gravity and conditions within tolerance;
- analogous: solid-fuel evidence that differs in named ways (say how it differs);
- mechanistic: droplet or gas-flame physics; use it only to explain mechanisms, never to describe how a solid material behaves;
- context: background or objectives, not results.

An item with key "M:outcome-model" is different: it is MicroFire Atlas's own statistical estimate from a small model, not a NASA record or measurement. Use it only as a DERIVED claim that cites "M:outcome-model", phrased as "the model estimates ..." and always with its interval, and say it is an estimate from limited data. Never present it as what will happen, as a safety rating or as NASA's result, and mention if the item says the conditions are outside the tested range. Do not use it to answer questions about lunar or Mars gravity.

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
- Never write that something causes, proves, ensures or guarantees an outcome, or that a material or habitat is safe, unless a cited NASA quote says so. Say "was recorded with" or "differed in" instead.
- Never predict ("will burn", "would ignite"). If asked, say what was recorded and add a DATA_GAP claim.
- Saffire fires were large-scale and ran in an uncrewed Cygnus cargo vehicle, not aboard the ISS. Keep units exactly as written (mm/s, cm/s, kPa, %).
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
  const list = items.map((i) => `[${i.key}]${i.rung ? ` (${i.rung})` : ""} ${i.text}`).join("\n");
  const notes = outside.length ? `\nScenario notes from the atlas:\n${outside.map((o) => `- ${o}`).join("\n")}\n` : "";
  return `Evidence items:\n${list || "(none matched this question)"}\n${notes}\nQuestion: ${q}`;
}

const NUMBER = /\d+(?:\.\d+)?/g;
/** Digits inside chemical formulas (O2, CO2, N2) are not measurements. */
const FORMULA = /\b(?:CO|O|N|H|CH)[2-4](?!\.?\d)|\b(?:CO|O|N)[₂₃₄]/g;
const numbersIn = (t: string) => t.replace(FORMULA, " ").match(NUMBER) ?? [];
/** A derived number may be the sum or difference of two cited numbers ("1200 s − 780 s = 420 s"). */
const derivable = (n: string, cited: string[]) => {
  const v = Number(n), dp = (n.split(".")[1] ?? "").length, vals = [...new Set(cited)].map(Number);
  const same = (x: number) => Math.abs(Number(x.toFixed(dp)) - v) < 1e-9;
  return vals.some((a, i) => vals.some((b, j) => i !== j && (same(Math.abs(a - b)) || same(a + b))));
};
/** Number + unit pairs. Longer units first so "mm/s" is never read as "mm". */
const UNIT_PAIR = /(\d+(?:\.\d+)?)\s*(mm\/s|cm\/s|m\/s|kPa|psi|atm|mm|cm|kW|W|%)(?![a-zA-Z/])/g;
const pairs = (t: string) => [...t.matchAll(UNIT_PAIR)].map((m) => [m[1], m[2]] as const);
const OTHER_GRAVITY = /\b(moon|lunar|mars|martian|partial[- ]gravity)\b/i;
const NEGATED = /\b(not|no|never|none|only|without|lack|cannot|can't|unknown|untested)\b/i;
const NEG_CAUSAL_PREFIX = String.raw`\b(?:not|no|never|cannot|can't|neither|nor|without)\b[^.]{0,90}?`;
const CAUSAL = /\b(caus(?:e|es|ed|ing)|prov(?:e|es|ed|en|ing)|ensur(?:e|es|ed)|guarantee[sd]?|leads? to|led to|makes? (?:it |them )?safe|made (?:it |them )?safe|(?:is|are) safe|safe to use|demonstrates? safety)\b/i;
const PREDICTION = /\b(will|would|is (?:likely|expected|predicted) to|are (?:likely|expected|predicted) to|predicts?)\b[^.]{0,40}?\b(burn|ignite|spread|go out|extinguish|quench|blow off|catch fire|behave|react|happen|be (?:safe|dangerous|the same))/i;
const UNCERTAIN = /\b(cannot|can't|unknown|not known|no evidence|whether|untested|would need|needs? to be tested)\b/i;

/**
 * Claim checker. A claim is verified only if:
 * - every cite exists in the evidence package;
 * - OBSERVED and DERIVED claims cite something, every number appears in a cited item, and every
 *   number-with-unit keeps the unit the evidence gives (no mm/s quietly becoming cm/s);
 * - no microgravity evidence is described as a Moon or Mars result;
 * - no causal or safety wording appears unless a cited NASA item uses the same word;
 * - no past outcome is turned into a prediction ("PMMA will burn on the Moon").
 */
export function checkAnswer(raw: RawAnswer, items: EvidenceItem[], question = ""): CheckedClaim[] {
  const byKey = new Map(items.map((i) => [i.key, i]));
  const asked = new Set(numbersIn(question)); // restating the question's own conditions is not a new fact
  const negCausal = new RegExp(NEG_CAUSAL_PREFIX + CAUSAL.source, "i");
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
      const citedList = cites.flatMap((k) => numbersIn(byKey.get(k)!.text));
      const citedNumbers = new Set(citedList);
      const missing = numbersIn(c.text).filter((n) => !citedNumbers.has(n) && !asked.has(n) && !(c.type === "DERIVED" && derivable(n, citedList)));
      if (missing.length) issues.push(`Numbers not found in cited evidence: ${missing.join(", ")}`);
      const cited = cites.flatMap((k) => pairs(byKey.get(k)!.text));
      for (const [n, unit] of pairs(c.text)) {
        const sameNumber = cited.filter(([m]) => m === n);
        if (sameNumber.length && !sameNumber.some(([, u]) => u === unit))
          issues.push(`Unit mismatch: the evidence gives ${n} in ${sameNumber[0][1]}, not ${unit}`);
      }
      if (OTHER_GRAVITY.test(c.text) && !NEGATED.test(c.text) && cites.every((k) => byKey.get(k)!.gravity !== "partial"))
        issues.push("Describes microgravity evidence as a Moon or Mars result");
    }
    const causal = negCausal.test(c.text) ? null : c.text.match(CAUSAL); // "does not prove it is safe" is the honest sentence
    if (causal && !cites.some((k) => byKey.get(k)!.text.toLowerCase().includes(causal[1].toLowerCase().slice(0, 5))))
      issues.push(`Causal or safety wording ("${causal[0]}") that no cited NASA item states`);
    if (c.type !== "DATA_GAP" && PREDICTION.test(c.text) && !UNCERTAIN.test(c.text))
      issues.push("Turns a past test outcome into a prediction");
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
