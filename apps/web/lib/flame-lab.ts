/**
 * Flame Lab engine. One engine, two presentation layers (Explorer and Scientist).
 *
 * Every configuration is classified against the curated NASA records with the same Evidence Ladder used everywhere
 * else in MicroFire. The flame drawing follows the class: a NASA-observed outcome only when a test matches, a
 * conceptual illustration of established qualitative physics for analogues, and an explicit unknown state otherwise.
 * Nothing here invents an experimental outcome.
 */
import { ladder, TOLERANCE, type EvidenceRecord, type MissionQuestion } from "./ontology.ts";
import type { Finding, OutcomeGroup } from "./types";

export type LabGravity = "earth" | "moon" | "mars" | "orbit";
export type LabConfig = { gravity: LabGravity; o2: number; kpa: number; flow: number; material: string };
export type EvidenceClass = "direct" | "analog" | "mechanistic" | "none";
export type Visual = "nasa" | "conceptual" | "unknown";
export type DimStatus = "match" | "close" | "outside" | "unknown";
export type DimRow = { dim: "Material" | "Gravity" | "Oxygen" | "Pressure" | "Airflow"; you: string; nasa: string; status: DimStatus; delta?: string };

export const GRAVITY_LABEL: Record<LabGravity, string> = { earth: "Earth (1 g)", moon: "Moon (0.17 g)", mars: "Mars (0.38 g)", orbit: "Orbit (microgravity)" };
export const GRAVITY_G: Record<LabGravity, number> = { earth: 1, mars: 0.38, moon: 0.17, orbit: 0 };
export const CLASS_LABEL: Record<EvidenceClass, string> = { direct: "Direct evidence", analog: "Close analog", mechanistic: "Mechanistic evidence only", none: "No matching evidence" };
const ladderGravity = (g: LabGravity) => (g === "orbit" ? "microgravity" : g === "moon" ? "lunar" : g === "mars" ? "martian" : undefined);
const recGravity = (r: EvidenceRecord) => (r.family === "luci" ? "moon (simulated)" : r.gravity === "microgravity" ? "orbit" : r.gravity);

export const PRESETS: { id: string; label: string; note: string; cfg: LabConfig }[] = [
  { id: "earth", label: "Earth baseline", note: "the familiar flame", cfg: { gravity: "earth", o2: 21, kpa: 101.3, flow: 0, material: "PMMA" } },
  { id: "iss", label: "ISS cabin", note: "fabric, ventilated", cfg: { gravity: "orbit", o2: 21, kpa: 101.3, flow: 10, material: "SIBAL fabric" } },
  { id: "bass", label: "Low-airflow BASS", note: "NASA test B16", cfg: { gravity: "orbit", o2: 16.5, kpa: 101.3, flow: 3, material: "PMMA" } },
  { id: "moon", label: "Lunar habitat", note: "34 % O₂ · 56.5 kPa", cfg: { gravity: "moon", o2: 34, kpa: 56.5, flow: 10, material: "PMMA" } },
  { id: "mars", label: "Mars habitat", note: "34 % O₂ · 56.5 kPa", cfg: { gravity: "mars", o2: 34, kpa: 56.5, flow: 10, material: "SIBAL fabric" } },
];

export function toQuestion(c: LabConfig): MissionQuestion {
  return { material: c.material, oxygen: c.o2, pressureKpa: c.kpa, flow: c.flow, gravity: ladderGravity(c.gravity) };
}

/** Per-dimension distance from your condition to one NASA record. A MicroFire heuristic, not a NASA score. */
export function dimRows(r: EvidenceRecord, c: LabConfig): DimRow[] {
  const num = (dim: DimRow["dim"], you: number, rec: number | null, tol: number, unit: string): DimRow => {
    if (rec == null) return { dim, you: `${you} ${unit}`, nasa: "not stated", status: "unknown" };
    const d = rec - you;
    return { dim, you: `${you} ${unit}`, nasa: `${rec} ${unit}`, status: Math.abs(d) < 1e-9 ? "match" : Math.abs(d) <= tol ? "close" : "outside", delta: `${d > 0 ? "+" : d < 0 ? "−" : "±"}${Math.abs(d).toFixed(1)} ${unit === "%" ? "pp" : unit}` };
  };
  const kpa = r.pressureKpa ? (r.pressureKpa[0] + r.pressureKpa[1]) / 2 : null;
  const gYou = ladderGravity(c.gravity);
  return [
    { dim: "Material", you: c.material, nasa: r.material, status: r.material === c.material ? "match" : "outside" },
    { dim: "Gravity", you: GRAVITY_LABEL[c.gravity], nasa: recGravity(r), status: gYou && gYou === r.gravity ? (r.family === "luci" ? "close" : "match") : "outside" },
    num("Oxygen", c.o2, r.oxygen, TOLERANCE.oxygen, "%"),
    num("Pressure", c.kpa, kpa, TOLERANCE.pressureKpa, "kPa"),
    num("Airflow", c.flow, r.flowCmS, Math.max(1, c.flow * TOLERANCE.flowFraction), "cm/s"),
  ];
}

export type Assessment = {
  cls: EvidenceClass;
  visual: Visual;
  closest: EvidenceRecord | null;
  rows: DimRow[];
  direct: EvidenceRecord[];
  /** The outcome NASA recorded for the matching tests, or "mixed" when matching tests disagree. Only set for direct evidence. */
  observed: { group: OutcomeGroup | "mixed"; label: string } | null;
  largest: DimRow["dim"] | null;
  gaps: string[];
  next: string | null;
  findings: Finding[];
};

/** Rank for "largest uncertainty": a different physical regime outranks a different value. */
const DIM_WEIGHT: Record<DimRow["dim"], number> = { Gravity: 5, Material: 4, Oxygen: 3, Pressure: 2, Airflow: 1 };

export function assess(c: LabConfig, records: EvidenceRecord[], findings: Finding[]): Assessment {
  const q = toQuestion(c);
  const l = ladder(records, findings, q);
  // "Direct" allows only unstated values (e.g. BASS-II PMMA pressure); every stated condition must be within tolerance.
  // Earth gravity differs from every record here (all burned in orbit or simulated lunar g), so Earth is never direct.
  const scored = [...l.direct, ...l.analogous].map((x) => ({ r: x.record, rows: dimRows(x.record, c) }));
  const hard = (rows: DimRow[]) => rows.filter((x) => x.status === "outside");
  const weight = (rows: DimRow[]) => hard(rows).reduce((s, x) => s + DIM_WEIGHT[x.dim], 0);
  const unknown = (rows: DimRow[]) => rows.filter((x) => x.status === "unknown").length;
  const near = (rows: DimRow[]) => rows.filter((x) => x.status === "close").length; // exact matches beat in-tolerance ones
  scored.sort((a, b) => weight(a.rows) - weight(b.rows) || unknown(a.rows) - unknown(b.rows) || near(a.rows) - near(b.rows) || a.r.id.localeCompare(b.r.id));
  const direct = c.gravity === "earth" ? [] : scored.filter((x) => hard(x.rows).length === 0).map((x) => x.r);
  const best = scored[0] ?? null;
  const misses = best ? hard(best.rows) : [];
  const relevant = [...l.findings.analogous, ...l.findings.mechanistic].map((x) => x.finding);

  let cls: EvidenceClass;
  if (direct.length) cls = "direct";
  // A close analog differs from a real test in exactly one value (oxygen, pressure or airflow), never in gravity or material.
  else if (best && misses.length === 1 && !misses.some((m) => m.dim === "Gravity" || m.dim === "Material")) cls = "analog";
  else if (c.gravity === "earth" || relevant.length) cls = "mechanistic";
  else cls = "none";

  const groups = [...new Set(direct.map((r) => r.outcome))];
  const observed = cls === "direct" ? (groups.length === 1 ? { group: groups[0], label: direct[0].outcomeLabel } : { group: "mixed" as const, label: `Matching NASA tests ended differently: ${[...new Set(direct.map((r) => r.outcomeLabel))].join("; ")}` }) : null;
  // Earth flames are the textbook buoyant case, so they may be drawn conceptually; the lab never claims a NASA observation for them.
  const visual: Visual = cls === "direct" ? "nasa" : cls === "analog" || c.gravity === "earth" ? "conceptual" : "unknown";
  const largest = misses.length ? [...misses].sort((a, b) => DIM_WEIGHT[b.dim] - DIM_WEIGHT[a.dim])[0].dim : null;
  return {
    cls, visual, closest: best?.r ?? null, rows: best?.rows ?? [], direct, observed, largest,
    gaps: c.gravity === "earth" ? ["This atlas holds no 1-g test records: NASA screens materials in normal gravity with a separate standard test (NASA-STD-6001)."] : l.gaps.map((g) => g.text),
    next: c.gravity === "earth" ? null : l.nextExperiment,
    findings: relevant,
  };
}

/* ------------------------------------------------------------ explanations: one evidence base, two voices */
export type Explanation = { explorer: string; scientist: string; findingIds: string[] };

export function explain(c: LabConfig): Explanation[] {
  const out: Explanation[] = [];
  if (c.gravity === "earth")
    out.push({ explorer: "On Earth, hot air rises. It pulls fresh air in from below, so the flame stands up tall and flickers.", scientist: "In 1 g, buoyant convection drives the plume upward and entrains oxidizer; flicker is a buoyancy-driven instability, which microgravity removes.", findingIds: ["acme-spherical-flames"] });
  else if (c.gravity === "orbit")
    out.push({ explorer: "In orbit, hot air doesn't rise. The flame depends on moving air to bring it fresh oxygen.", scientist: "Without buoyant convection the plume is suppressed, so flame behaviour depends strongly on forced-flow velocity, oxygen concentration, material properties and heat loss.", findingIds: ["low-flow-sensitivity"] });
  else
    out.push({
      explorer: c.gravity === "moon"
        ? "On the Moon there is a little gravity, so hot air rises a little. Short NASA tests found some materials burn in less oxygen in lunar gravity than on Earth."
        : "On Mars there is some gravity, so hot air rises a little. NASA has only short drop-tower tests at Martian gravity, so very little is known.",
      scientist: "Partial gravity gives weak buoyant flow. Earlier microgravity and lunar-gravity testing found some materials burn to lower oxygen than in 1 g; NASA suggests a factor of safety on 1-g limits may be needed if this holds for more materials.",
      findingIds: ["low-g-burns-lower-o2", "factor-of-safety", "lunar-goldilocks"],
    });

  if (c.gravity !== "earth") {
    if (c.flow < 1)
      out.push({ explorer: "With almost no moving air, NASA saw flames turn dim and blue, and very steady.", scientist: "At flows below about 1 cm/s, flames became dim, blue and very stable; they survived even below 1 cm/s.", findingIds: ["dim-blue-low-flow", "flames-survive-below-1"] });
    else if (c.flow <= 5)
      out.push({ explorer: "Slow air is a tricky zone: NASA found flames very sensitive to small changes in airflow here.", scientist: "Microgravity flames were especially sensitive to flow in the 0–5 cm/s range; for the fabric, quenching speeds were 1–5 cm/s, higher in lower oxygen.", findingIds: ["low-flow-sensitivity", "sibal-quench-speeds"] });
    else if (c.flow >= 10)
      out.push({ explorer: "Strong airflow can push a flame so hard it blows off, like blowing out a candle.", scientist: "At higher opposed-flow speeds the residence time shrinks; blowoff limits were measured at several oxygen levels.", findingIds: ["blowoff-kinetics", "pmma-rod-limits"] });
  }
  if (c.o2 >= 28)
    out.push({ explorer: "This much oxygen is more than any test in this atlas used. That is exactly why NASA plans more tests.", scientist: "Few thin-fuel materials are rated even in 1 g at 34 % O₂ and 8.2 psia, the exploration atmosphere NASA studied.", findingIds: ["sofie-exploration-atmosphere", "exploration-atmosphere"] });
  else if (c.o2 <= 17)
    out.push({ explorer: "With less oxygen, flames spread more slowly and some never got going.", scientist: "Spread slowed at lower O₂ percentages; quenching occurred at higher flow speeds in lower oxygen.", findingIds: ["sibal-spread-trends", "sibal-quench-speeds"] });
  return out;
}

/* ------------------------------------------------------------ notebook, missions and patches */
export type Run = { id: string; n: number; cfg: LabConfig; cls: EvidenceClass; result: string; ref: string | null; refHref: string | null; abstained: boolean; at: number };

export function recordRun(n: number, cfg: LabConfig, a: Assessment): Run {
  return {
    id: `run-${n}-${Date.now().toString(36)}`, n, cfg, cls: a.cls,
    result: a.observed ? (a.observed.group === "mixed" ? "Mixed NASA outcomes" : a.observed.label) : "Abstained: no NASA test matches this condition",
    ref: a.cls === "direct" ? a.direct[0]?.label ?? null : a.closest?.label ?? null,
    refHref: a.cls === "direct" ? a.direct[0]?.href ?? null : a.closest?.href ?? null,
    abstained: !a.observed, at: Date.now(),
  };
}

const DIMS: (keyof LabConfig)[] = ["gravity", "o2", "kpa", "flow", "material"];
export const DIM_NAME: Record<keyof LabConfig, string> = { gravity: "Gravity", o2: "Oxygen", kpa: "Pressure", flow: "Airflow", material: "Material" };
/** Which settings differ across a set of runs. A fair comparison changes exactly one. */
export function differing(runs: { cfg: LabConfig }[]) {
  return DIMS.filter((d) => new Set(runs.map((r) => String(r.cfg[d]))).size > 1);
}

export type Mission = { id: string; title: string; goal: string; done: (runs: Run[]) => boolean; lesson: string };
export const MISSIONS: Mission[] = [
  {
    id: "buoyancy", title: "Remove buoyancy", goal: "Run Earth and Orbit with every other setting the same.",
    done: (rs) => rs.some((a) => a.cfg.gravity === "earth" && rs.some((b) => b.cfg.gravity === "orbit" && differing([a, b]).join() === "gravity")),
    lesson: "Changing one thing at a time is how scientists isolate a cause. Notice that only the orbit run can point to a NASA test.",
  },
  {
    id: "airflow", title: "Find the airflow effect", goal: "Find two PMMA runs in orbit, with only airflow changed, where NASA recorded different outcomes.",
    done: (rs) => rs.some((a) => rs.some((b) => a !== b && a.cfg.material === "PMMA" && a.cfg.gravity === "orbit" && differing([a, b]).join() === "flow" && a.cls === "direct" && b.cls === "direct" && a.result !== b.result)),
    lesson: "Near-matched NASA tests B16, B20 and B19 differed mainly in airflow and ended three different ways. That is an association, not proof that airflow alone caused it.",
  },
  {
    id: "limit", title: "Find the evidence limit", goal: "Configure a lunar habitat with 34 % oxygen and run it.",
    done: (rs) => rs.some((r) => r.cfg.gravity === "moon" && r.cfg.o2 >= 33 && r.abstained),
    lesson: "No NASA test in this atlas covers that combination. The responsible answer is: we don't know yet.",
  },
  {
    id: "detective", title: "Evidence detective", goal: "For the lunar habitat, find which setting causes the largest evidence mismatch.",
    done: () => false, // answered in the Missions tab, checked against the engine's own answer
    lesson: "MicroFire ranks mismatches: a different gravity regime or material outranks a different value, then oxygen, pressure and airflow. A MicroFire heuristic, not a NASA rule.",
  },
];

export type Patch = { id: string; name: string; why: string; earned: (runs: Run[], missions: Set<string>) => boolean };
export const PATCHES: Patch[] = [
  { id: "gravity", name: "Gravity Detective", why: "Compared Earth and orbit fairly.", earned: (_, m) => m.has("buoyancy") },
  { id: "flow", name: "Flow Investigator", why: "Found NASA's airflow effect.", earned: (_, m) => m.has("airflow") },
  { id: "hunter", name: "Evidence Hunter", why: "Matched a condition to a real NASA test.", earned: (rs) => rs.some((r) => r.cls === "direct") },
  { id: "scientist", name: "Flame Scientist", why: "Recorded five experiments.", earned: (rs) => rs.length >= 5 },
  { id: "unknown", name: "Unknown Explorer", why: "Went beyond every NASA test in this atlas.", earned: (rs) => rs.some((r) => r.cls === "none" || r.cls === "mechanistic") },
  { id: "guardian", name: "Evidence Guardian", why: "Found a condition where the responsible scientific answer was: we don't know yet.", earned: (rs) => rs.some((r) => r.abstained && r.cfg.gravity !== "earth") },
];

/** Mission 4's answer, computed: the closest record's mismatches, ranked by physical regime first. */
export function detectiveAnswer(records: EvidenceRecord[], findings: Finding[]): DimRow["dim"] | null {
  return assess(PRESETS.find((p) => p.id === "moon")!.cfg, records, findings).largest;
}
