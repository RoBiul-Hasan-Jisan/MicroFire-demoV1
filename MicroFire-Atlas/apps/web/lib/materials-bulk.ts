/**
 * Bulk material check: paste a list of materials, pick a cabin, get one evidence grade per material.
 * The grade says how much NASA test evidence in this atlas fits the cabin. It is not a flammability
 * rating and not a prediction.
 */
import { ladder, type EvidenceRecord, type MissionQuestion } from "./ontology.ts";
import type { Finding } from "./types";

export const ALIASES: Record<string, string[]> = {
  PMMA: ["pmma", "acrylic", "plexiglas", "plexiglass", "perspex", "lucite", "polymethyl methacrylate", "poly(methyl methacrylate)"],
  "SIBAL fabric": ["sibal", "sibal fabric", "cotton fiberglass", "cotton-fiberglass", "cotton/fiberglass", "cotton fiberglass fabric", "cotton-fiberglass blend", "cotton fiberglass blend"],
  Nomex: ["nomex", "nomex iii", "aramid", "aramid fabric"],
  Silicone: ["silicone", "silicone rubber"],
  "Cotton jersey": ["cotton jersey", "jersey cotton"],
};
const AMBIGUOUS: Record<string, string[]> = { cotton: ["Cotton jersey", "SIBAL fabric"] };

const norm = (s: string) => s.toLowerCase().replace(/[®™]/g, "").replace(/[^a-z0-9/()\- ]+/g, " ").replace(/\s+/g, " ").trim();

export type Resolved = { canonical: string | null; ambiguous?: string[] };

export function resolveMaterial(input: string): Resolved {
  const n = norm(input);
  if (!n) return { canonical: null };
  for (const [canon, names] of Object.entries(ALIASES)) if (names.includes(n) || norm(canon) === n) return { canonical: canon };
  if (AMBIGUOUS[n]) return { canonical: null, ambiguous: AMBIGUOUS[n] };
  let best: { canon: string; len: number } | null = null;
  for (const [canon, names] of Object.entries(ALIASES))
    for (const a of names) if (a.length >= 4 && n.includes(a) && (!best || a.length > best.len)) best = { canon, len: a.length };
  return best ? { canonical: best.canon } : { canonical: null };
}

export function parseList(text: string, max = 50): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of text.split(/[\n;]+|,(?![^()]*\))/)) {
    const t = part.trim();
    const k = t.toLowerCase();
    if (t && !seen.has(k)) { seen.add(k); out.push(t); }
    if (out.length >= max) break;
  }
  return out;
}

export type Grade = "direct" | "analogous" | "gap";
export type Row = {
  input: string; canonical: string | null; grade: Grade; label: string; tests: number;
  outcomes: { sustained: number; extinguished: number; not_ignited: number; unknown: number };
  closest: { label: string; href: string; differs: string[] } | null; note: string;
};

export type Cabin = Pick<MissionQuestion, "oxygen" | "pressureKpa" | "gravity" | "flow">;

export function gradeMaterials(inputs: string[], cabin: Cabin, records: EvidenceRecord[], findings: Finding[]): Row[] {
  return inputs.map((input) => {
    const r = resolveMaterial(input);
    const empty = { sustained: 0, extinguished: 0, not_ignited: 0, unknown: 0 };
    if (!r.canonical) {
      return { input, canonical: null, grade: "gap", label: "No evidence", tests: 0, outcomes: empty, closest: null,
        note: r.ambiguous ? `Ambiguous name. Did you mean ${r.ambiguous.join(" or ")}?` : "Not in the atlas: no NASA test of this material is recorded here. That is a gap, not a safety finding." };
    }
    const mine = records.filter((x) => x.material === r.canonical);
    const outcomes = { ...empty };
    for (const x of mine) outcomes[x.outcome] += 1;
    const l = ladder(records, findings, { material: r.canonical, ...cabin });
    if (l.direct.length)
      return { input, canonical: r.canonical, grade: "direct", label: "Direct evidence", tests: mine.length, outcomes, closest: null,
        note: `${l.direct.length} test${l.direct.length === 1 ? "" : "s"} match every condition you set.` };
    const near = l.analogous.find((x) => x.record.material === r.canonical);
    if (!near)
      return { input, canonical: r.canonical, grade: "gap", label: "No evidence", tests: mine.length, outcomes, closest: null, note: "No test of this material is close to the cabin." };
    return { input, canonical: r.canonical, grade: "analogous", label: "Analogous only", tests: mine.length, outcomes,
      closest: { label: near.record.label, href: near.record.href, differs: near.differs.map((d) => d.text) },
      note: `${mine.length} test${mine.length === 1 ? "" : "s"} of this material, none under your conditions.` };
  });
}

export function toCsv(rows: Row[]): string {
  const q = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
  const head = ["material_entered", "matched_to", "evidence_grade", "tests_of_material", "sustained", "extinguished", "not_ignited", "unknown", "closest_test", "differs_from_cabin", "note"];
  return [head.map(q).join(","), ...rows.map((r) => [r.input, r.canonical ?? "", r.label, r.tests, r.outcomes.sustained, r.outcomes.extinguished, r.outcomes.not_ignited, r.outcomes.unknown, r.closest?.label ?? "", r.closest?.differs.join("; ") ?? "", r.note].map(q).join(","))].join("\n");
}
