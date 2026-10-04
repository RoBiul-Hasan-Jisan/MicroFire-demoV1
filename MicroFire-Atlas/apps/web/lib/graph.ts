/**
 * The evidence graph: the typed structure under the Evidence Constellation and the Evidence Ladder.
 * Built from the data, so it can be downloaded and checked. Plain JSON, no graph database needed.
 */
import type { Finding, Source } from "./types";
import { FAMILIES, ladder, SOURCE_FAMILY, type EvidenceRecord } from "./ontology.ts";
import type { FrontierQuestion } from "./frontier.ts";

export type NodeType = "Family" | "Source" | "Material" | "Record" | "Finding" | "Scenario" | "Gap";
export type EdgeType =
  | "RECORD_IN_FAMILY" | "RECORD_USES_MATERIAL" | "SOURCE_DOCUMENTS_RECORD" | "FINDING_SUPPORTED_BY_SOURCE"
  | "FINDING_ABOUT_RECORD" | "SOURCE_IN_FAMILY" | "SCENARIO_DIRECT" | "SCENARIO_ANALOGOUS" | "SCENARIO_MECHANISTIC" | "SCENARIO_MISSING";
export type GraphNode = { id: string; type: NodeType; label: string; data?: Record<string, unknown> };
export type GraphEdge = { from: string; to: string; type: EdgeType; note?: string };
export type EvidenceGraph = { version: string; nodes: GraphNode[]; edges: GraphEdge[] };

export function buildGraph(records: EvidenceRecord[], findings: Finding[], sources: Source[], scenarios: FrontierQuestion[]): EvidenceGraph {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const add = (n: GraphNode) => { if (!nodes.has(n.id)) nodes.set(n.id, n); };
  for (const f of Object.values(FAMILIES)) add({ id: `family:${f.id}`, type: "Family", label: f.name, data: { phase: f.phase, fuel: f.fuel, scale: f.scale, platform: f.platform } });
  for (const s of sources) {
    add({ id: `source:${s.source_id}`, type: "Source", label: s.title, data: { ntrs: s.ntrs_id, url: s.url } });
    edges.push({ from: `source:${s.source_id}`, to: `family:${SOURCE_FAMILY[s.source_id] ?? "context"}`, type: "SOURCE_IN_FAMILY" });
  }
  for (const r of records) {
    add({ id: `record:${r.id}`, type: "Record", label: r.label, data: { oxygen: r.oxygen, pressureKpa: r.pressureKpa, flowCmS: r.flowCmS, outcome: r.outcome, href: r.href } });
    add({ id: `material:${r.material}`, type: "Material", label: r.material });
    edges.push({ from: `record:${r.id}`, to: `family:${r.family}`, type: "RECORD_IN_FAMILY" });
    edges.push({ from: `record:${r.id}`, to: `material:${r.material}`, type: "RECORD_USES_MATERIAL" });
    if (r.cite) edges.push({ from: `source:${r.cite.source_id}`, to: `record:${r.id}`, type: "SOURCE_DOCUMENTS_RECORD", note: `PDF page ${r.cite.pdf_page}` });
  }
  for (const f of findings) {
    add({ id: `finding:${f.id}`, type: "Finding", label: f.quote.slice(0, 90), data: { kind: f.kind, topics: f.topics, page: f.pdf_page ?? null } });
    edges.push({ from: `finding:${f.id}`, to: `source:${f.source_id}`, type: "FINDING_SUPPORTED_BY_SOURCE" });
    if (Array.isArray(f.experiments)) for (const id of f.experiments) edges.push({ from: `finding:${f.id}`, to: `record:${id}`, type: "FINDING_ABOUT_RECORD" });
  }
  for (const sc of scenarios) {
    const l = ladder(records, findings, sc.q);
    add({ id: `scenario:${sc.id}`, type: "Scenario", label: sc.title, data: { ...sc.q } });
    for (const x of l.direct.slice(0, 10)) edges.push({ from: `scenario:${sc.id}`, to: `record:${x.record.id}`, type: "SCENARIO_DIRECT" });
    for (const x of l.analogous.slice(0, 5)) edges.push({ from: `scenario:${sc.id}`, to: `record:${x.record.id}`, type: "SCENARIO_ANALOGOUS", note: x.differs.map((d) => d.dim).join(", ") });
    for (const x of l.findings.mechanistic.slice(0, 3)) edges.push({ from: `scenario:${sc.id}`, to: `finding:${x.finding.id}`, type: "SCENARIO_MECHANISTIC" });
    for (const g of l.gaps) {
      const gid = `gap:${sc.id}:${g.dim}`;
      add({ id: gid, type: "Gap", label: g.text });
      edges.push({ from: `scenario:${sc.id}`, to: gid, type: "SCENARIO_MISSING" });
    }
  }
  return { version: "microfire-evidence-graph-1", nodes: [...nodes.values()], edges };
}
