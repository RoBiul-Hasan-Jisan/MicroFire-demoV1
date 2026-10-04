/**
 * The Combustion Evidence Ontology and the Evidence Ladder.
 *
 * Different NASA experiments burn different things in different physical regimes: BASS-II thin sheets
 * in a glovebox duct, Saffire metre-scale samples in a cargo ship, FLEX liquid droplets, ACME gas jets.
 * They are never merged into one table. Instead every record keeps its family's schema and is described
 * here along shared dimensions, and a mission question sorts the evidence into rungs:
 *
 *   DIRECT       same fuel phase and material, same gravity, and every stated condition within tolerance
 *   ANALOGOUS    solid-fuel evidence that differs in named ways (gravity, atmosphere, scale, material)
 *   MECHANISTIC  other physical regimes (droplets, gas flames): explains mechanisms, never material outcomes
 *   GAP          what no record covers, written as the experiment that would fill it
 *
 * Pure functions, no React. Tolerances are project choices, documented on /methodology.
 */
import type { Experiment, Finding, OutcomeGroup, SaffireRun } from "./types";
import type { Gravity } from "./relevance";

export type Phase = "solid" | "liquid" | "gas";
export type FamilyId = "bass2" | "saffire" | "luci" | "partial-g" | "sofie" | "fm2" | "flex" | "acme" | "context";
export type Rung = "direct" | "analogous" | "mechanistic" | "gap";

export type Family = {
  id: FamilyId;
  name: string;
  phase: Phase | null;
  fuel: string;
  scale: string;
  platform: string;
  gravity: Gravity | "lunar (simulated)" | "martian (simulated)" | null;
  kid: string;
};

export const FAMILIES: Record<FamilyId, Family> = {
  bass2: { id: "bass2", name: "BASS and BASS-II", phase: "solid", fuel: "thin plastic films, fabric and rods", scale: "centimetres", platform: "glovebox flow duct aboard the ISS", gravity: "microgravity", kid: "Small samples in a wind tunnel on the space station." },
  saffire: { id: "saffire", name: "Saffire", phase: "solid", fuel: "fabric, silicone, Nomex and thick PMMA", scale: "5 cm to almost 1 m", platform: "flow unit inside an empty Cygnus cargo ship", gravity: "microgravity", kid: "Big, deliberate fires inside an empty cargo spaceship." },
  luci: { id: "luci", name: "LUCI", phase: "solid", fuel: "fabric samples", scale: "centimetres", platform: "spinning New Shepard sounding rocket", gravity: "lunar (simulated)", kid: "A spinning rocket that made Moon-like gravity for a few minutes." },
  "partial-g": { id: "partial-g", name: "Martian-gravity drop tests", phase: "solid", fuel: "spacecraft materials", scale: "centimetres", platform: "drop tower", gravity: "martian (simulated)", kid: "Short falls in a drop tower that feel like Mars gravity." },
  sofie: { id: "sofie", name: "SoFIE", phase: "solid", fuel: "PMMA and engineering materials", scale: "centimetres", platform: "Combustion Integrated Rack aboard the ISS", gravity: "microgravity", kid: "A space-station lab built to test materials in Moon-base air." },
  fm2: { id: "fm2", name: "FM² (planned)", phase: "solid", fuel: "SIBAL fabric and PMMA rods", scale: "centimetres", platform: "robotic chamber on a lunar lander, not yet flown", gravity: "lunar", kid: "A fire test that will happen on the Moon itself. No results yet." },
  flex: { id: "flex", name: "FLEX", phase: "liquid", fuel: "methanol and heptane droplets (2 to 5 mm)", scale: "millimetres", platform: "Combustion Integrated Rack aboard the ISS", gravity: "microgravity", kid: "Tiny burning droplets that float in space." },
  acme: { id: "acme", name: "ACME", phase: "gas", fuel: "gaseous fuel jets", scale: "millimetres to centimetres", platform: "Combustion Integrated Rack aboard the ISS", gravity: "microgravity", kid: "Gas flames that form perfect spheres in space." },
  context: { id: "context", name: "Mission context", phase: null, fuel: "not a fire experiment", scale: "", platform: "", gravity: null, kid: "Information about the air a future Moon base might use." },
};

/** Which family each NASA source belongs to. The confinement study is a BASS-II campaign aboard the ISS. */
export const SOURCE_FAMILY: Record<string, FamilyId> = {
  "bass2-summary": "bass2",
  "bass2-results": "bass2",
  "pmma-rods-concurrent": "bass2",
  "sibal-concurrent": "bass2",
  "bass-thickness": "bass2",
  confinement: "bass2",
  "saffire-1-3": "saffire",
  "saffire-4-5": "saffire",
  "saffire-6": "saffire",
  luci: "luci",
  "partial-g": "partial-g",
  sofie: "sofie",
  flex: "flex",
  acme: "acme",
  "exploration-atmosphere": "context",
  "ea-alt": "context",
  "fm2-plan": "fm2",
  "fm2-atmospheres": "fm2",
  "ea-6": "context",
};

export const KIND_LABEL: Record<Finding["kind"], string> = {
  observed: "Reported observation",
  interpretation: "Authors' interpretation",
  context: "Background or objective",
};

/** One record seen through the shared dimensions. The original record keeps its own schema. */
export type EvidenceRecord = {
  id: string;
  family: FamilyId;
  label: string;
  href: string;
  material: string;
  geometry: string;
  sizeCm: number | null; // largest sample dimension recorded
  gravity: Gravity;
  oxygen: number | null;
  pressureKpa: [number, number] | null;
  flowCmS: number | null;
  flowDirection: string | null;
  outcome: OutcomeGroup;
  outcomeLabel: string;
  cite: { source_id: string; pdf_page: number; table?: string } | null;
};

export function fromBass(e: Experiment): EvidenceRecord {
  const p = e.pressure_kpa != null ? ([e.pressure_kpa, e.pressure_kpa] as [number, number]) : e.pressure_kpa_range ?? null;
  const size = Math.max(e.width_mm ?? 0, e.length_mm ?? 0) / 10;
  return {
    id: e.id,
    family: "bass2",
    label: `${e.investigation} test ${e.test_id}`,
    href: `/experiments/${e.id}`,
    material: e.material,
    geometry: e.geometry,
    sizeCm: size || null,
    gravity: "microgravity",
    oxygen: e.oxygen_vol_pct,
    pressureKpa: p,
    flowCmS: e.flow_initial_cm_s,
    flowDirection: e.flow_direction,
    outcome: e.outcome_group,
    outcomeLabel: e.outcome_label,
    cite: { source_id: e.provenance.record.source_id, pdf_page: e.provenance.record.pdf_page, table: e.provenance.record.table },
  };
}

export function fromSaffire(r: SaffireRun): EvidenceRecord {
  const size = Math.max(r.width_cm ?? 0, r.length_cm ?? 0);
  return {
    id: r.id,
    family: "saffire",
    label: `Saffire ${r.flight.replace("Saffire-", "")} sample ${r.sample}`,
    href: `/saffire#${r.id}`,
    material: r.material,
    geometry: r.geometry,
    sizeCm: size || null,
    gravity: "microgravity",
    oxygen: r.o2_pct,
    pressureKpa: r.pressure_kpa != null ? [r.pressure_kpa, r.pressure_kpa] : null,
    flowCmS: r.flow_cm_s,
    flowDirection: r.flow_direction,
    outcome: r.outcome_group,
    outcomeLabel: r.outcome_label,
    cite: (() => { const c = r.provenance.conditions ?? r.provenance.results ?? r.provenance.outcome; return c ? { source_id: c.source_id, pdf_page: c.pdf_page, table: c.table } : null; })(),
  };
}

export type MissionQuestion = { material?: string; oxygen?: number; pressureKpa?: number; gravity?: Gravity; flow?: number };

/** Project tolerances for "the same condition". Documented on /methodology. */
export type Tolerance = { oxygen: number; pressureKpa: number; flowFraction: number };
export const TOLERANCE: Tolerance = { oxygen: 1.5, pressureKpa: 10, flowFraction: 0.5 };

const GRAVITY_NAME: Record<Gravity, string> = { microgravity: "microgravity", lunar: "lunar gravity", martian: "Martian gravity" };

export type Difference = { dim: "material" | "gravity" | "oxygen" | "pressure" | "flow"; text: string; unknown?: boolean };

/** How one record differs from the question, dimension by dimension. Unrecorded values count as differences. */
export function differences(r: EvidenceRecord, q: MissionQuestion, tol: Tolerance = TOLERANCE): Difference[] {
  const out: Difference[] = [];
  if (q.material && r.material !== q.material) out.push({ dim: "material", text: `${r.material}, not ${q.material}` });
  if (q.gravity && q.gravity !== r.gravity) out.push({ dim: "gravity", text: `${GRAVITY_NAME[r.gravity]}, not ${GRAVITY_NAME[q.gravity]}` });
  if (q.oxygen != null) {
    if (r.oxygen == null) out.push({ dim: "oxygen", text: "oxygen not recorded", unknown: true });
    else if (Math.abs(r.oxygen - q.oxygen) > tol.oxygen) out.push({ dim: "oxygen", text: `${r.oxygen} % O₂, not ${q.oxygen} %` });
  }
  if (q.pressureKpa != null) {
    const p = r.pressureKpa;
    if (p == null) out.push({ dim: "pressure", text: "pressure not recorded", unknown: true });
    else if (q.pressureKpa < p[0] - tol.pressureKpa || q.pressureKpa > p[1] + tol.pressureKpa)
      out.push({ dim: "pressure", text: `${p[0] === p[1] ? p[0] : `${p[0]}–${p[1]}`} kPa, not ${q.pressureKpa} kPa` });
  }
  if (q.flow != null) {
    if (r.flowCmS == null) out.push({ dim: "flow", text: "airflow not recorded", unknown: true });
    else if (Math.abs(r.flowCmS - q.flow) > Math.max(1, q.flow * tol.flowFraction)) out.push({ dim: "flow", text: `${r.flowCmS} cm/s airflow, not ${q.flow} cm/s` });
  }
  return out;
}

export type LadderItem = { record: EvidenceRecord; differs: Difference[] };
export type LadderFinding = { finding: Finding; family: Family; why: string };
export type Gap = { dim: Difference["dim"] | "combination"; text: string };

export type Ladder = {
  direct: LadderItem[];
  analogous: LadderItem[];
  findings: { analogous: LadderFinding[]; mechanistic: LadderFinding[] };
  gaps: Gap[];
  /** The single experiment that would turn the closest analogous evidence into direct evidence. */
  nextExperiment: string | null;
};

const describe = (q: MissionQuestion) =>
  [q.material, q.oxygen != null && `${q.oxygen} % O₂`, q.pressureKpa != null && `${q.pressureKpa} kPa`, q.flow != null && `${q.flow} cm/s airflow`, q.gravity && GRAVITY_NAME[q.gravity]]
    .filter(Boolean)
    .join(", ");

/** Sort all evidence for a mission question into the ladder. Deterministic and order-stable. */
export function ladder(records: EvidenceRecord[], findings: Finding[], q: MissionQuestion, tol: Tolerance = TOLERANCE): Ladder {
  const scored = records.map((record) => ({ record, differs: differences(record, q, tol) }));
  const direct = scored.filter((x) => x.differs.length === 0);
  // fewer differences first, then fewer unknowns, then the smallest actual distance on oxygen and pressure
  const distance = (r: EvidenceRecord) =>
    (q.oxygen != null && r.oxygen != null ? Math.abs(r.oxygen - q.oxygen) / 5 : 0) +
    (q.pressureKpa != null && r.pressureKpa != null ? Math.abs((r.pressureKpa[0] + r.pressureKpa[1]) / 2 - q.pressureKpa) / 20 : 0);
  const analogous = scored
    .filter((x) => x.differs.length > 0)
    .sort(
      (a, b) =>
        a.differs.length - b.differs.length ||
        a.differs.filter((d) => d.unknown).length - b.differs.filter((d) => d.unknown).length ||
        distance(a.record) - distance(b.record) ||
        a.record.id.localeCompare(b.record.id),
    );

  // findings: other gravity levels and exploration atmospheres are analogous; other phases are mechanistic only
  const wantsGravity = q.gravity && q.gravity !== "microgravity";
  const wantsAtmosphere = q.pressureKpa != null && q.pressureKpa < 90;
  const fAnalog: LadderFinding[] = [];
  const fMech: LadderFinding[] = [];
  for (const f of findings) {
    const fam = FAMILIES[SOURCE_FAMILY[f.source_id] ?? "context"];
    if (fam.phase == null) continue; // mission context (such as the habitat-air study) is not combustion evidence
    if (fam.phase === "liquid" || fam.phase === "gas") {
      if (f.topics.some((t) => ["oxygen", "pressure", "suppression", "gas-flame"].includes(t)))
        fMech.push({ finding: f, family: fam, why: `${fam.name} burned ${fam.fuel}, a different physical regime: it can explain mechanisms such as oxygen limits, not how a solid material behaves.` });
      continue;
    }
    if (wantsGravity && f.topics.includes("partial-gravity"))
      fAnalog.push({ finding: f, family: fam, why: `About reduced gravity (${fam.name}, ${fam.platform || "NASA report"}).` });
    else if (wantsAtmosphere && f.topics.includes("pressure"))
      fAnalog.push({ finding: f, family: fam, why: `About exploration-like atmospheres (${fam.name}).` });
  }

  // gaps: dimensions no solid-phase record covers, then the combination
  const gaps: Gap[] = [];
  const covered = (dim: Difference["dim"]) => scored.some((x) => !x.differs.some((d) => d.dim === dim));
  if (q.gravity && q.gravity !== "microgravity" && !covered("gravity"))
    gaps.push({ dim: "gravity", text: `No test record in this atlas burned at ${GRAVITY_NAME[q.gravity]}. Short partial-gravity tests exist as reported findings, not test rows.` });
  if (q.oxygen != null && !covered("oxygen")) gaps.push({ dim: "oxygen", text: `No test record is within ±${tol.oxygen} points of ${q.oxygen} % oxygen.` });
  if (q.pressureKpa != null && !covered("pressure")) gaps.push({ dim: "pressure", text: `No test record is within ±${tol.pressureKpa} kPa of ${q.pressureKpa} kPa.` });
  if (q.material && !covered("material")) gaps.push({ dim: "material", text: `No test record used ${q.material}.` });
  if (q.flow != null && !covered("flow")) gaps.push({ dim: "flow", text: `No test record ran near ${q.flow} cm/s.` });
  if (!direct.length && gaps.length === 0) gaps.push({ dim: "combination", text: "Each condition was tested somewhere, but never all together in one test." });

  const best = analogous[0];
  const nextExperiment =
    direct.length || !best
      ? null
      : `${describe(q)}. The closest record, ${best.record.label}, differs in ${best.differs.map((d) => d.dim).join(", ")}.`;

  return { direct, analogous, findings: { analogous: fAnalog, mechanistic: fMech }, gaps, nextExperiment };
}

/**
 * "Why is this evidence shown?": the path from the question to one record, condition by condition.
 * Each step is a match, a difference or an unrecorded value; the last step is the rung it lands on.
 */
export type WhyStep = { kind: "question" | "match" | "differs" | "unknown" | "rung"; text: string };
export function whyPath(r: EvidenceRecord, q: MissionQuestion): WhyStep[] {
  const steps: WhyStep[] = [{ kind: "question", text: `Your question: ${describe(q) || "any conditions"}` }];
  const d = differences(r, q);
  const has = (dim: Difference["dim"]) => d.find((x) => x.dim === dim);
  const fam = FAMILIES[r.family];
  steps.push({ kind: "match", text: `Solid fuel, the same physical regime (${fam.name}: ${fam.fuel})` });
  const check = (dim: Difference["dim"], asked: unknown, ok: string) => {
    if (asked == null) return;
    const x = has(dim);
    steps.push(x ? { kind: x.unknown ? "unknown" : "differs", text: x.text } : { kind: "match", text: ok });
  };
  check("material", q.material, `Same material: ${r.material}`);
  check("gravity", q.gravity, `Same gravity: ${r.gravity}`);
  check("oxygen", q.oxygen, `Oxygen within ±${TOLERANCE.oxygen} points (${r.oxygen} %)`);
  check("pressure", q.pressureKpa, `Pressure within ±${TOLERANCE.pressureKpa} kPa (${r.pressureKpa?.[0]} kPa)`);
  check("flow", q.flow, `Airflow within ±${TOLERANCE.flowFraction * 100} % (${r.flowCmS} cm/s)`);
  steps.push({ kind: "rung", text: d.length === 0 ? "Direct evidence: every condition you set is matched" : `Analogous evidence: differs in ${d.map((x) => x.dim).join(", ")}` });
  return steps;
}
