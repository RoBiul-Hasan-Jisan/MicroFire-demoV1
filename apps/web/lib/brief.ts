/**
 * Mission brief: one cited page that combines the Evidence Ladder, the materials check, the outcome model
 * or the gravity bridge, the visibility hint and the next-test plan for one scenario.
 *
 * Deterministic: no language model writes any sentence. Every line comes from a rule applied to the
 * project's data, so the same inputs always give the same brief.
 */
import type { Model } from "./model.ts";
import { predictOutcome } from "./model.ts";
import { bridgePredict, type BridgeSpec, type Gravity } from "./gravity-bridge.ts";
import { gradeMaterials, parseList } from "./materials-bulk.ts";
import { describeTest, GRAVITY_LABEL, pct, type NextTests } from "./next-tests.ts";
import { unseenCell, visibilityClass } from "./unseen.ts";
import type { EvidenceRecord } from "./ontology.ts";
import type { Finding } from "./types";
import type { AtmosphereProfile } from "./atmospheres.ts";

export type BriefInput = {
  gravity: Gravity;
  atmosphere: Pick<AtmosphereProfile, "id" | "name" | "o2" | "kpa" | "finding">;
  oxygen?: number; // overrides the atmosphere (custom)
  pressureKpa?: number;
  flow?: number; // forced airflow, cm/s
  direction: "concurrent" | "opposed";
  materials: string;
};
export type BriefData = { model: Model; spec: BridgeSpec; next: NextTests; records: EvidenceRecord[]; findings: Finding[] };
export type Section = { heading: string; lines: string[] };
export type Brief = { title: string; sections: Section[]; markdown: string };

const LIMITS = [
  "All NASA tests in the atlas were run in microgravity. No partial-gravity test result is in the atlas, so nothing here is a measurement for the Moon or Mars.",
  "The outcome model uses oxygen, airflow and flow direction only (not pressure or material), is trained on 49 tests, and its honest cross-validated accuracy is about the same as guessing the more common outcome.",
  "An evidence grade says how much NASA test evidence fits the cabin. It is not a flammability rating, and “no evidence” does not mean safe.",
  "This brief is a planning aid for researchers and mission planners, not a safety certification and not NASA guidance.",
];

export function buildBrief(input: BriefInput, d: BriefData): Brief {
  const o2 = input.oxygen ?? input.atmosphere.o2 ?? undefined;
  const kpa = input.pressureKpa ?? input.atmosphere.kpa ?? undefined;
  const flowText = input.flow == null ? "airflow not specified" : input.flow === 0 ? "no forced airflow" : `${input.flow} cm/s ${input.direction} airflow`;
  const scenario = `${GRAVITY_LABEL[input.gravity]}; ${input.atmosphere.name}${o2 != null ? `, ${o2} % oxygen` : ""}${kpa != null ? `, ${kpa} kPa` : ""}; ${flowText}`;
  const sections: Section[] = [];

  sections.push({ heading: "Scenario", lines: [scenario] });

  // 1. evidence per material
  const mats = parseList(input.materials);
  const rows = gradeMaterials(mats, { oxygen: o2, pressureKpa: kpa, gravity: input.gravity, flow: input.flow }, d.records, d.findings);
  const evidence: string[] = [];
  for (const r of rows) {
    const closest = r.closest ? ` Closest test: ${r.closest.label} (${r.closest.href}); it differs in: ${r.closest.differs.join("; ") || "nothing recorded"}.` : "";
    evidence.push(`${r.input}: ${r.label}. ${r.note}${closest}`);
  }
  if (!rows.length) evidence.push("No materials were listed.");
  const gaps = rows.filter((r) => r.grade === "gap").length;
  if (rows.length) evidence.push(`Summary: ${rows.filter((r) => r.grade === "direct").length} direct, ${rows.filter((r) => r.grade === "analogous").length} analogous, ${gaps} with no evidence.`);
  sections.push({ heading: "What NASA evidence exists for your materials", lines: evidence });

  // 2. what the model / bridge says
  const est: string[] = [];
  if (o2 == null) est.push("Oxygen was not specified, so no estimate is given.");
  else if (input.gravity === "microgravity") {
    if (input.flow == null || input.flow <= 0) est.push("The outcome model needs an airflow above zero; none was given, so no estimate is shown.");
    else {
      const r = predictOutcome(d.model, { o2, flow: input.flow, direction: input.direction });
      est.push(`The outcome model (ISS microgravity tests only) estimates a ${pct(r.p)} chance that a flame is sustained, with a 90 % interval of ${pct(r.lo)} to ${pct(r.hi)}.`);
      if (!r.inRange.o2 || !r.inRange.flow) est.push("These conditions are outside the tested range, so this is an extrapolation.");
    }
  } else {
    const r = bridgePredict(d.model, d.spec, { o2, forced: input.flow ?? 0, direction: input.direction, gravity: input.gravity });
    est.push(`Gravity bridge (UNVALIDATED hypothesis, not a prediction): reading the ISS-trained model at the airflow that ${GRAVITY_LABEL[input.gravity].toLowerCase()} buoyancy would add, the chance of a sustained flame comes out at ${pct(r.p50)}, with a range of ${pct(r.p05)} to ${pct(r.p95)} across the assumptions.`);
    est.push(`That range reflects assumed buoyant-flow parameters, not measurements. Effective airflow assumed: ${r.effectiveFlow[0].toFixed(1)} to ${r.effectiveFlow[1].toFixed(1)} cm/s.`);
    if (r.extrapolated.o2 || r.extrapolated.flow) est.push("Part of this lies outside the oxygen or airflow range the ISS tests covered.");
  }
  sections.push({ heading: "What the model says (and how far to trust it)", lines: est });

  // 3. visibility
  const vis: string[] = [];
  if (input.gravity === "microgravity" && input.flow != null && o2 != null) {
    const c = unseenCell(d.model, o2, input.flow, input.direction);
    vis.push(c.text);
  } else if (input.gravity !== "microgravity" && o2 != null) {
    const b = bridgePredict(d.model, d.spec, { o2, forced: input.flow ?? 0, direction: input.direction, gravity: input.gravity });
    const cls = visibilityClass(b.effectiveFlow[0]);
    vis.push(cls === "no-cited-concern" ? "Under the bridge's assumptions the airflow is above the range where NASA reports dim, hard-to-see flames." : `Under the bridge's assumptions the effective airflow can be as low as ${b.effectiveFlow[0].toFixed(1)} cm/s, in the range where NASA reports flames can be dim and easy to miss. No test exists there.`);
  } else vis.push("Airflow was not specified, so the visibility check was skipped.");
  sections.push({ heading: "Could a fire here go unnoticed?", lines: vis });

  // 4. next tests
  const nt: string[] = d.next.headline.batch.map((s) => `${s.rank}. ${describeTest(s)}${s.gravity === input.gravity ? " (same gravity as your scenario)" : ""}`);
  nt.push(`Together these are expected to remove about ${pct(d.next.headline.batch.at(-1)?.cumulative_uncertainty_removed ?? 0)} of the uncertainty about five reference Moon and Mars cabins. The plan is global, not specific to your scenario. It is a research-planning aid, not a NASA test plan.`);
  sections.push({ heading: "Tests that would reduce the uncertainty most", lines: nt });

  // 5. sources
  const src: string[] = [];
  const ids = new Set<string>();
  if (input.atmosphere.finding) ids.add(input.atmosphere.finding);
  if (input.gravity === "lunar") ids.add("sibal-lunar-downward");
  if (input.flow != null && input.flow < 5 && input.gravity === "microgravity") ["low-flow-sensitivity", "dim-blue-low-flow"].forEach((i) => ids.add(i));
  for (const id of ids) {
    const f = d.findings.find((x) => x.id === id);
    if (f) src.push(`NASA finding “${f.id}”: source ${f.source_id}, ${f.pdf_page ? `PDF page ${f.pdf_page}` : "abstract"} (full wording on /sources).`);
  }
  if (src.length) sections.push({ heading: "NASA statements behind this brief", lines: src });

  sections.push({ heading: "Limits", lines: LIMITS });

  const markdown = [`# Cabin brief`, ``, `**Scenario:** ${scenario}`, ``, ...sections.slice(1).flatMap((s) => [`## ${s.heading}`, ``, ...s.lines.map((l) => `- ${l}`), ``]), `_Generated by MicroFire Atlas. Deterministic: every line comes from a rule applied to the atlas data._`].join("\n");
  return { title: "Cabin brief", sections, markdown };
}
