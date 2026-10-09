/**
 * The evidence graph: the typed structure under the Evidence Constellation and the Evidence Ladder.
 * Built from the data, so it can be downloaded and checked. Plain JSON, no graph database needed.
 */
import type { Finding, Source } from "./types";
import { FAMILIES, ladder, SOURCE_FAMILY, type EvidenceRecord } from "./ontology.ts";
import type { FrontierQuestion } from "./frontier.ts";
import type { ResearchPlan } from "./research-planning";

type EvidenceNodeType = "Family" | "Source" | "Material" | "Record" | "Finding" | "Scenario" | "Gap";
export type NodeType = EvidenceNodeType | "MissionScenario" | "EvidenceGap" | "CandidateExperiment" | "PlannedExperiment";
export type EdgeType =
  | "RECORD_IN_FAMILY" | "RECORD_USES_MATERIAL" | "SOURCE_DOCUMENTS_RECORD" | "FINDING_SUPPORTED_BY_SOURCE"
  | "FINDING_ABOUT_RECORD" | "SOURCE_IN_FAMILY" | "SCENARIO_DIRECT" | "SCENARIO_ANALOGOUS" | "SCENARIO_MECHANISTIC" | "SCENARIO_MISSING"
  | "HAS_GAP" | "INFORMED_BY" | "ADDRESSES" | "COULD_INFORM" | "MAY_ADDRESS" | "PLAN_SUPPORTED_BY_FINDING";
export type GraphNode = { id: string; type: EvidenceNodeType | "MissionScenario" | "EvidenceGap"; label: string; data?: Record<string, unknown> }
  | { id:string; type:"CandidateExperiment"; status:"hypothetical-research-question"; label:string; data:{conditions:Record<string,unknown>;unknownDimensions:string[]} }
  | { id:string; type:"PlannedExperiment"; status:"planned"; label:string; data?:Record<string,unknown> };
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

/** The planning layer extends the SAME evidence nodes and source edges; candidates never become Record nodes. */
export function buildResearchGraph(plan:ResearchPlan,records:EvidenceRecord[],findings:Finding[],sources:Source[]):EvidenceGraph {
  const completed=records.filter(r=>["bass2","saffire","luci"].includes(r.family));
  const graph=buildGraph(completed,findings,sources,[]);
  for(const s of plan.registry.scenarios){
    graph.nodes.push({id:`mission-scenario:${s.id}`,type:"MissionScenario",label:s.question,data:{conditions:s.scenario,category:s.category,origin:s.origin}});
    const l=ladder(completed,findings,s.scenario);
    for(const r of l.direct)graph.edges.push({from:`mission-scenario:${s.id}`,to:`record:${r.record.id}`,type:"SCENARIO_DIRECT",note:r.record.caveat});
  }
  const plans=new Set<string>();
  for(const gap of plan.registry.gaps){
    graph.nodes.push({id:gap.id,type:"EvidenceGap",label:gap.title,data:{conditions:gap.conditions,missingDimensions:gap.missingDimensions}});
    for(const id of gap.scenarioIds)graph.edges.push({from:`mission-scenario:${id}`,to:gap.id,type:"HAS_GAP"});
    for(const id of gap.closestRecordIds)graph.edges.push({from:gap.id,to:`record:${id}`,type:"INFORMED_BY",note:"Analogous, not a direct match"});
    for(const id of gap.relevantFindingIds)graph.edges.push({from:gap.id,to:`finding:${id}`,type:"INFORMED_BY",note:"Publication finding, not a test row"});
    for(const p of gap.plannedCoverage){const id=`planned:${p.program}`;
      if(!plans.has(id)){graph.nodes.push({id,type:"PlannedExperiment",status:"planned",label:p.program});plans.add(id);
        for(const f of p.findingIds)graph.edges.push({from:id,to:`finding:${f}`,type:"PLAN_SUPPORTED_BY_FINDING"});}
      graph.edges.push({from:id,to:gap.id,type:"MAY_ADDRESS",note:`Planned dimensional overlap only: ${p.overlappingDimensions.join(", ")}`});}
  }
  for(const c of plan.candidates){
    graph.nodes.push({id:c.id,type:"CandidateExperiment",status:c.status,label:`Hypothetical: ${c.id}`,data:{conditions:{...c.conditions},unknownDimensions:c.unknownDimensions}});
    const gain=plan.gains.find(g=>g.candidateId===c.id)!;
    for(const gap of gain.directGapsPotentiallyClosed)graph.edges.push({from:c.id,to:gap,type:"ADDRESSES",note:"Potential represented-condition coverage only"});
    for(const s of gain.affectedScenarioIds)graph.edges.push({from:c.id,to:`mission-scenario:${s}`,type:"COULD_INFORM"});
  }
  return {...graph,version:"microfire-evidence-graph-research-1",nodes:graph.nodes.sort((a,b)=>a.id.localeCompare(b.id)),edges:graph.edges.sort((a,b)=>`${a.from}|${a.type}|${a.to}`.localeCompare(`${b.from}|${b.type}|${b.to}`))};
}
