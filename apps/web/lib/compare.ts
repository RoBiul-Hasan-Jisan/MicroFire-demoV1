/**
 * Compare 2.0: what a set of tests held constant, what changed, what NASA recorded, and what that does
 * and does not let us say. Computed from the records themselves, so it can never drift from the data.
 * Works across families (BASS-II and Saffire) and warns when a comparison crosses physical regimes.
 */
import type { Citation, Experiment, OutcomeGroup, SaffireRun } from "./types";
import { FAMILIES, type Family, type FamilyId } from "./ontology.ts";

export type CompareRecord = {
  id: string;
  family: FamilyId;
  label: string;
  href: string;
  material: string;
  thicknessMm: number | null;
  widthMm: number | null;
  flowDirection: string | null;
  airflow: string; // as recorded
  airflowCmS: number | null; // starting value
  oxygen: number | null;
  pressureKpa: [number, number] | null;
  outcome: OutcomeGroup;
  outcomeCode: string; // for the outcome mark
  outcomeLabel: string;
  note: string | null; // NASA's own words
  cite: Citation | null;
};

const GROUP_CODE: Record<OutcomeGroup, string> = { sustained: "sustained_no_blowoff", extinguished: "quenched_low_flow", not_ignited: "not_ignited", unknown: "burned_outcome_not_stated" };

export function compareFromBass(e: Experiment): CompareRecord {
  return {
    id: e.id, family: "bass2", label: `${e.investigation} ${e.test_id}`, href: `/experiments/${e.id}`,
    material: e.material, thicknessMm: e.thickness_mm, widthMm: e.width_mm, flowDirection: e.flow_direction,
    airflow: e.flow_final_cm_s != null && e.flow_final_cm_s !== e.flow_initial_cm_s ? `${e.flow_initial_cm_s} → ${e.flow_final_cm_s} cm/s` : `“${e.flow_verbatim}”`,
    airflowCmS: e.flow_initial_cm_s, oxygen: e.oxygen_vol_pct,
    pressureKpa: e.pressure_kpa != null ? [e.pressure_kpa, e.pressure_kpa] : e.pressure_kpa_range ?? null,
    outcome: e.outcome_group, outcomeCode: e.outcome, outcomeLabel: e.outcome_label, note: e.observations_verbatim, cite: e.provenance.record,
  };
}

export function compareFromSaffire(r: SaffireRun): CompareRecord {
  return {
    id: r.id, family: "saffire", label: `Saffire ${r.sample}`, href: `/saffire#${r.id}`,
    material: r.material, thicknessMm: r.thickness_mm, widthMm: r.width_cm != null ? r.width_cm * 10 : null, flowDirection: r.flow_direction,
    airflow: r.flow_cm_s != null ? `${r.flow_cm_s} cm/s` : "not stated", airflowCmS: r.flow_cm_s, oxygen: r.o2_pct,
    pressureKpa: r.pressure_kpa != null ? [r.pressure_kpa, r.pressure_kpa] : null,
    outcome: r.outcome_group, outcomeCode: GROUP_CODE[r.outcome_group], outcomeLabel: r.outcome_label,
    note: r.provenance.outcome?.quote ?? null, cite: r.provenance.results ?? r.provenance.conditions ?? r.provenance.outcome,
  };
}

type Dim = { key: string; label: string; get: (r: CompareRecord) => number | string | [number, number] | null; show: (v: never) => string; same: (a: never, b: never) => boolean };

const num = (tol: number) => (a: number, b: number) => Math.abs(a - b) <= tol;
const DIMS: Dim[] = [
  { key: "family", label: "Experiment", get: (r) => r.family, show: (v: FamilyId) => FAMILIES[v].name, same: (a, b) => a === b },
  { key: "material", label: "Material", get: (r) => r.material, show: (v: string) => v, same: (a, b) => a === b },
  { key: "thickness", label: "Thickness", get: (r) => r.thicknessMm, show: (v: number) => `${v} mm`, same: num(0.001) },
  { key: "width", label: "Sample width", get: (r) => r.widthMm, show: (v: number) => (v >= 50 ? `${v / 10} cm` : `${v} mm`), same: num(0.001) },
  { key: "direction", label: "Flow direction", get: (r) => r.flowDirection, show: (v: string) => v, same: (a, b) => a === b },
  { key: "airflow", label: "Airflow", get: (r) => r.airflowCmS, show: (v: number) => `${v} cm/s`, same: num(0.5) },
  { key: "oxygen", label: "Oxygen", get: (r) => r.oxygen, show: (v: number) => `${v} %`, same: num(0.5) },
  {
    key: "pressure", label: "Pressure", get: (r) => r.pressureKpa,
    show: (v: [number, number]) => (v[0] === v[1] ? `${v[0]} kPa` : `${v[0]}–${v[1]} kPa`),
    same: (a: [number, number], b: [number, number]) => Math.max(a[0], b[0]) - Math.min(a[1], b[1]) <= 2,
  },
];

export type Held = { label: string; value: string };
export type Changed = { label: string; values: { id: string; label: string; value: string }[] };
export type Analysis = {
  held: Held[];
  changed: Changed[];
  unrecorded: string[];
  recorded: { id: string; label: string; outcome: string; group: OutcomeGroup }[];
  canSay: string[];
  cantSay: string[];
  crossFamily: Family[] | null;
};

const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

export function analyze(rows: CompareRecord[]): Analysis {
  const held: Held[] = [], changed: Changed[] = [], unrecorded: string[] = [];
  for (const d of DIMS) {
    const vals = rows.map(d.get);
    if (vals.some((v) => v == null)) {
      if (vals.some((v) => v != null)) unrecorded.push(d.label.toLowerCase());
      continue;
    }
    const allSame = vals.every((v) => d.same(v as never, vals[0] as never));
    if (allSame) held.push({ label: d.label, value: d.show(vals[0] as never) });
    else changed.push({ label: d.label, values: rows.map((r, i) => ({ id: r.id, label: r.label, value: d.show(vals[i] as never) })) });
  }
  const recorded = rows.map((r) => ({ id: r.id, label: r.label, outcome: r.outcomeLabel, group: r.outcome }));
  const outcomesDiffer = new Set(rows.map((r) => r.outcome)).size > 1 || new Set(rows.map((r) => r.outcomeLabel)).size > 1;
  const families = [...new Set(rows.map((r) => r.family))];
  const ch = changed.filter((c) => c.label !== "Experiment").map((c) => c.label.toLowerCase());

  const canSay: string[] = [];
  if (held.length) canSay.push(`These ${rows.length} tests recorded the same ${list(held.map((h) => h.label.toLowerCase()))}${ch.length ? ` and different ${list(ch)}` : ""}.`);
  canSay.push(outcomesDiffer ? "NASA recorded different outcomes for them." : "NASA recorded the same kind of outcome for all of them.");
  if (ch.length === 1 && outcomesDiffer) canSay.push(`The recorded outcome changed when the recorded ${ch[0]} changed.`);

  const cantSay: string[] = [];
  if (ch.length === 1 && outcomesDiffer) cantSay.push(`That ${ch[0]} alone caused the difference: each condition was run once, and things NASA did not record (such as run-to-run scatter or flow history) could also differ.`);
  if (ch.length > 1) cantSay.push(`Which of the ${ch.length} things that changed (${list(ch)}) made the difference: more than one changed at once.`);
  for (const u of unrecorded) cantSay.push(`That the ${u} was the same: it is not recorded for every test.`);
  if (families.length > 1) cantSay.push("That the numbers are interchangeable: these come from different experiments with different sample sizes, ducts and vehicles.");
  cantSay.push("What would happen in conditions none of these tests reached, such as lunar gravity.");

  return { held, changed, unrecorded, recorded, canSay, cantSay, crossFamily: families.length > 1 ? families.map((f) => FAMILIES[f]) : null };
}
