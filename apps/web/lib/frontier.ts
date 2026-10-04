/**
 * Research Frontier: for a mission question, what the evidence covers, what it does not, why the gap
 * exists, and what kind of matched-condition test would reduce the uncertainty. Computed from the
 * Evidence Ladder, so it updates itself when records are added. A research-planning aid, not a NASA plan.
 */
import type { Finding } from "./types";
import { ladder, type EvidenceRecord, type MissionQuestion } from "./ontology.ts";

export type FrontierQuestion = { id: string; title: string; kid: string; q: MissionQuestion; context: string };

export const FRONTIER: FrontierQuestion[] = [
  { id: "moon-base", title: "A Moon base in exploration atmosphere A", kid: "Could a plastic panel burn in a Moon base with extra oxygen?", q: { material: "PMMA", oxygen: 34, pressureKpa: 56.5, gravity: "lunar", flow: 20 }, context: "moon-base" },
  { id: "mars-fabric", title: "Fabric in a Mars habitat, atmosphere A", kid: "What about cloth on Mars?", q: { material: "SIBAL fabric", oxygen: 34, pressureKpa: 56.5, gravity: "martian" }, context: "mars-fabric" },
  { id: "lunar-normal-air", title: "A lunar habitat with Earth-like air", kid: "Moon gravity, normal air", q: { material: "SIBAL fabric", oxygen: 21, pressureKpa: 101.3, gravity: "lunar" }, context: "lunar" },
  { id: "iss-still-air", title: "The ISS with its fans off", kid: "Space station with the fans off", q: { material: "PMMA", oxygen: 21, pressureKpa: 101.3, gravity: "microgravity", flow: 1 }, context: "still-air" },
];

export type Why = { text: string; finding?: string };
export type FrontierEntry = {
  question: FrontierQuestion;
  closed: boolean; // direct evidence exists
  know: string[];
  dontKnow: string | null;
  why: Why[];
  missing: string[];
  next: string | null;
};

const GRAVITY = { microgravity: "microgravity", lunar: "lunar gravity", martian: "Martian gravity" } as const;
const describe = (q: MissionQuestion) =>
  [q.oxygen != null && `${q.oxygen} % oxygen`, q.pressureKpa != null && `${q.pressureKpa} kPa`, q.flow != null && `${q.flow} cm/s airflow`, q.gravity && GRAVITY[q.gravity]].filter(Boolean).join(", ");
const pressureMid = (r: EvidenceRecord) => (r.pressureKpa ? Math.round(((r.pressureKpa[0] + r.pressureKpa[1]) / 2) * 10) / 10 : null);

export function frontier(fq: FrontierQuestion, records: EvidenceRecord[], findings: Finding[]): FrontierEntry {
  const { q } = fq;
  const l = ladder(records, findings, q);
  const know: string[] = [];
  if (l.direct.length) know.push(`${l.direct.length} NASA test${l.direct.length === 1 ? "" : "s"} match every condition: for example ${l.direct.slice(0, 3).map((x) => x.record.label).join(", ")}.`);
  for (const { record: r } of l.analogous.slice(0, l.direct.length ? 0 : 2)) {
    const p = pressureMid(r);
    know.push(`${r.label}: ${r.material}, ${r.oxygen ?? "?"} % oxygen${p != null ? `, ${p} kPa` : ""}, microgravity. NASA recorded: ${r.outcomeLabel.toLowerCase()}.`);
  }
  if (!l.direct.length && l.analogous.length > 2) know.push(`${l.analogous.length - 2} more solid-fuel tests differ from this question in named ways.`);
  if (l.findings.analogous.length) know.push(`${l.findings.analogous.length} NASA finding${l.findings.analogous.length === 1 ? "" : "s"} about reduced gravity or exploration atmospheres.`);

  const why: Why[] = [];
  for (const g of l.gaps) {
    if (g.dim === "gravity")
      why.push(
        q.gravity === "martian"
          ? { text: "Long burns at Martian gravity are hard to make: NASA's Martian-gravity flammability tests used a drop tower, which gives only seconds of reduced gravity. Every test row in this atlas ran in orbit.", finding: "low-g-burns-lower-o2" }
          : { text: "Long burns at partial gravity are hard to make: drop towers give seconds. NASA describes its spinning-rocket LUCI tests as the first combustion tests longer than 25 seconds in simulated lunar gravity. Every test row in this atlas ran in orbit.", finding: "luci-first-lunar" },
      );
    else if (g.dim === "oxygen") {
      const top = [...records].filter((r) => r.oxygen != null).sort((a, b) => b.oxygen! - a.oxygen!)[0];
      why.push({ text: `No test record reaches ${q.oxygen} % oxygen. The highest is ${top.oxygen} % (${top.label}).` });
    } else if (g.dim === "pressure") {
      const close = [...records].filter((r) => r.pressureKpa).sort((a, b) => Math.abs(pressureMid(a)! - q.pressureKpa!) - Math.abs(pressureMid(b)! - q.pressureKpa!))[0];
      why.push({ text: `No test record ran within the tolerance of ${q.pressureKpa} kPa. The closest is ${pressureMid(close)} kPa (${close.label}).` });
    } else why.push({ text: g.text });
  }

  const nasaNext = q.gravity === "lunar" ? " NASA's own next step is a lunar-surface burn test, FM2." : "";
  return {
    question: fq,
    closed: l.direct.length > 0,
    know,
    dontKnow: l.direct.length ? null : `How ${q.material ?? "these materials"} burns with ${describe(q)} all at once.`,
    why,
    missing: l.gaps.map((g) => (g.dim === "combination" ? "the combination" : g.dim)),
    next: l.nextExperiment ? `A matched-condition test: ${l.nextExperiment}${nasaNext}` : null,
  };
}
