import {createHash} from "node:crypto";
import type {Finding,Source} from "./types";
import type {EvidenceRecord} from "./ontology";
import {buildResearchGraph} from "./graph.ts";
import {PLANNING_LIMITS,RESEARCH_VERSION,type ResearchPlan} from "./research-planning.ts";

export const RESEARCH_DOWNLOADS=["mission-scenarios","gap-registry","candidate-experiments","evidence-gain","research-planning-graph"] as const;
export type ResearchDownload=typeof RESEARCH_DOWNLOADS[number];
const digest=(x:unknown)=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
export function researchExport(name:ResearchDownload,plan:ResearchPlan,records:EvidenceRecord[],findings:Finding[],sources:Source[]) {
  const sortedSources=[...sources].sort((a,b)=>a.source_id.localeCompare(b.source_id));
  const body=name==="mission-scenarios"?plan.registry.scenarios:name==="gap-registry"?plan.registry.gaps:name==="candidate-experiments"?plan.candidates:name==="evidence-gain"?plan.gains:buildResearchGraph(plan,records,findings,sources);
  return {schema_version:1,description:`${name}: deterministic MicroFire research-planning output, not observed NASA results.`,
    status:"derived-research-planning",generated_from:{algorithm:RESEARCH_VERSION,scenario_registry_sha256:digest(plan.registry.scenarios),
      corpus_sha256:digest({records:[...records].sort((a,b)=>a.id.localeCompare(b.id)),findings:[...findings].sort((a,b)=>a.id.localeCompare(b.id)),sources:sortedSources})},
    source_manifest_sha256:digest(sortedSources),source_manifest_url:"/downloads/source-manifest.json",
    identity_method:"SHA-256 of compact JSON.stringify: manifest sorted by source_id; normalized planner records/findings sorted by id. No runtime timestamp.",
    corpus:{records:records.length,findings:findings.length,sources:sources.length,families:new Set(records.map(r=>r.family)).size},
    limitations:PLANNING_LIMITS,summary:plan.summary,data:body};
}
