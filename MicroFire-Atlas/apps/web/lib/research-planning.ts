/** Local coverage planning. Hypothetical candidates have no measured outcome, record family or NASA citation. */
import { conditionDifferences, ladder, SOURCE_FAMILY, type EvidenceRecord, type MissionQuestion } from "./ontology.ts";
import { rankFindings } from "./finding-relevance.ts";
import type { Finding } from "./types";
import type { MissionScenario } from "./mission-scenarios";

export const RESEARCH_VERSION = "microfire-research-1";
export const PLANNING_LIMITS = [
  "MicroFire research-planning heuristic, not NASA prioritization or an endorsed experiment recommendation.",
  "Matched on the dimensions represented by this planner: material, gravity, oxygen, pressure and airflow only.",
  "Geometry, scale, duration, ignition, confinement, orientation, hardware and sample history remain unmodelled.",
  "Coverage only: no prediction of outcome, information entropy, feasibility, cost, crew risk, TRL, schedule, funding priority or safety impact.",
  "Curated questions are not a survey of demand; repeated wording or extra scenarios can bias breadth.",
  "LUCI provides simulated lunar gravity, not Moon-surface measurements. Current atlas coverage is not the complete NASA archive.",
];
export const CONDITION_KEYS = ["material","gravity","oxygen","pressureKpa","flow"] as const;
const dimension = (k:string)=> k==="pressureKpa"?"pressure":k;
const sorted = (xs:string[])=>[...new Set(xs)].sort();

/** Exact canonical values for identity; tolerances are for coverage only. Unknowns are absent. */
export function normalizeConditions(q: MissionQuestion): MissionQuestion {
  const out: Record<string,string|number> = {};
  for(const k of Object.keys(q)) if(!CONDITION_KEYS.includes(k as typeof CONDITION_KEYS[number])) throw new Error(`Unsupported planner dimension: ${k}`);
  for(const k of CONDITION_KEYS) {
    const v=q[k];if(v==null)continue;
    if((k==="material"||k==="gravity") ? typeof v!=="string" : typeof v!=="number")throw new Error(`Invalid type for ${k}`);
    if(typeof v==="number" && (!Number.isFinite(v)||v<0||(k==="oxygen"&&v>100)||(k==="pressureKpa"&&v===0)))throw new Error(`Invalid ${k}`);
    if(typeof v==="string" && (!v.trim()||v==="any"||(k==="gravity"&&!["microgravity","lunar","martian"].includes(v))))throw new Error(`Invalid ${k}`);
    out[k]=v;
  }
  return out as MissionQuestion;
}
export const conditionKey=(q:MissionQuestion)=>JSON.stringify(normalizeConditions(q));
// Full canonical encoding avoids hash collisions and remains stable across corpus/order changes.
export const gapId=(q:MissionQuestion)=>`research-gap-${encodeURIComponent(conditionKey(q))}`;
export const describeConditions=(q:MissionQuestion)=>CONDITION_KEYS.filter(k=>q[k]!=null).map(k=>`${k}: ${q[k]}${k==="oxygen"?" %":k==="pressureKpa"?" kPa":k==="flow"?" cm/s":""}`).join(" · ");
export type PlannedCoverage = { status:"planned"; program:"FM²"; findingIds:string[]; overlappingDimensions:string[]; limitations:string[] };
export type CandidateExperimentSpec = {
  id:string; conditions:MissionQuestion; sourceGapIds:string[]; assumptions:string[]; unknownDimensions:string[];
  status:"hypothetical-research-question";
};
export type EvidenceGap = {
  id:string; scenarioIds:string[]; categories:string[]; title:string; conditions:MissionQuestion; missingDimensions:string[];
  directCount:number; analogousCount:number; mechanisticCount:number; evidenceFamilies:string[]; closestRecordIds:string[];
  relevantFindingIds:string[]; nextExperimentText:string|null; nextExperimentSpec:CandidateExperimentSpec;
  plannedCoverage:PlannedCoverage[]; limitations:string[];
};
export type GapRegistry = { scenarios:MissionScenario[]; gaps:EvidenceGap[]; directlyCoveredScenarioIds:string[] };

function plannedOverlap(q:MissionQuestion, findings:Finding[]):PlannedCoverage[] {
  const ids=["fm2-atmospheres","fm2-samples","fm2-measurements"];
  if(q.gravity!=="lunar"||!ids.every(id=>findings.some(f=>f.id===id&&f.kind==="context")))return [];
  const overlap=["gravity"];
  // Material overlap only. Do not infer row-specific atmosphere, flow or geometry from a publication's broad plan.
  if(q.material==="PMMA"||q.material==="SIBAL fabric")overlap.push("material");
  return [{status:"planned",program:"FM²",findingIds:ids,overlappingDimensions:overlap,
    limitations:["Published plan overlaps these dimensions only. Flow, sample geometry and full joint conditions are not matched here; no completed FM² results are counted."]}];
}

export function buildGapRegistry(input:MissionScenario[], records:EvidenceRecord[], findings:Finding[]):GapRegistry {
  const unique=new Map<string,MissionScenario>();const ids=new Map<string,string>();
  for(const s of [...input].sort((a,b)=>a.id.localeCompare(b.id))) {
    const scenario=normalizeConditions(s.scenario);if(!Object.keys(scenario).length)throw new Error("Empty research scenario");
    const key=`${conditionKey(scenario)}|${s.question.trim().toLowerCase().replace(/\s+/g," ")}`;
    if(ids.has(s.id)&&ids.get(s.id)!==key)throw new Error(`Conflicting scenario id ${s.id}`);
    ids.set(s.id,key);if(!unique.has(key))unique.set(key,{...s,scenario});
  }
  const scenarios=[...unique.values()];const map=new Map<string,EvidenceGap>();const directlyCoveredScenarioIds:string[]=[];
  // This planner only uses the existing structured completed-test families. Future families require review, not automatic admission.
  const observed=records.filter(r=>["bass2","saffire","luci"].includes(r.family));
  for(const s of scenarios) {
    const l=ladder(observed,findings,s.scenario);
    if(l.direct.length){directlyCoveredScenarioIds.push(s.id);continue;}
    const id=gapId(s.scenario);const existing=map.get(id);
    if(existing){existing.scenarioIds=sorted([...existing.scenarioIds,s.id]);existing.categories=sorted([...existing.categories,s.category]);continue;}
    const ranked=rankFindings(findings,observed,{scenario:s.scenario}).filter(r=>r.rung!=="context"&&SOURCE_FAMILY[r.sourceId]!=="fm2").slice(0,5);
    const closest=l.analogous.slice(0,5).map(x=>x.record);
    const spec:CandidateExperimentSpec={id:`research-candidate-${encodeURIComponent(conditionKey(s.scenario))}`,conditions:{...s.scenario},sourceGapIds:[id],status:"hypothetical-research-question",
      unknownDimensions:[...CONDITION_KEYS.filter(k=>s.scenario[k]==null),"flowDirection","thicknessMm","widthMm","geometry","scale","duration","ignition","confinement","orientation","hardware","sampleHistory"],
      assumptions:["A valid completed solid-fuel experiment would report the requested conditions and measured results; none exist for this candidate today.","No unrequested condition is copied from a nearby test or filled with a default."]};
    map.set(id,{id,scenarioIds:[s.id],categories:[s.category],title:describeConditions(s.scenario),conditions:s.scenario,
      missingDimensions:sorted(l.gaps.map(g=>g.dim)),directCount:0,analogousCount:l.analogous.filter(x=>(!s.scenario.material||x.record.material===s.scenario.material)&&x.differs.length<=2).length,
      mechanisticCount:l.findings.mechanistic.filter(x=>x.finding.kind!=="context").length,
      evidenceFamilies:sorted([...closest.map(r=>r.family),...ranked.map(r=>SOURCE_FAMILY[r.sourceId]??"context")]),closestRecordIds:closest.map(r=>r.id),relevantFindingIds:ranked.map(r=>r.findingId),
      nextExperimentText:l.nextExperiment,nextExperimentSpec:spec,plannedCoverage:plannedOverlap(s.scenario,findings),
      limitations:[...PLANNING_LIMITS,"Analogous support counts rows matching the requested material with at most two mismatched condition dimensions; it is not evidential strength. Closest links may include more distant rows. Families describe the five closest records and five selected findings.",...sorted(closest.flatMap(r=>r.caveat?[r.caveat]:[]))]});
  }
  return {scenarios,gaps:[...map.values()].sort((a,b)=>a.id.localeCompare(b.id)),directlyCoveredScenarioIds:sorted(directlyCoveredScenarioIds)};
}

export function generateCandidates(gaps:EvidenceGap[]):CandidateExperimentSpec[] {
  const map=new Map<string,CandidateExperimentSpec>();
  for(const g of gaps){const c=g.nextExperimentSpec;const key=conditionKey(c.conditions);const old=map.get(key);
    if(old)old.sourceGapIds=sorted([...old.sourceGapIds,g.id]);else map.set(key,{...c,conditions:{...c.conditions},sourceGapIds:[g.id]});}
  return [...map.values()].sort((a,b)=>a.id.localeCompare(b.id));
}

export function wouldAddressGap(c:CandidateExperimentSpec,g:EvidenceGap) {
  if(c.status!=="hypothetical-research-question")throw new Error("Coverage candidates must be explicitly hypothetical");
  const q=normalizeConditions(c.conditions);
  const diffs=conditionDifferences({material:q.material,gravity:q.gravity,oxygen:q.oxygen??null,pressureKpa:q.pressureKpa==null?null:[q.pressureKpa,q.pressureKpa],flowCmS:q.flow??null},g.conditions);
  const covered=CONDITION_KEYS.filter(k=>g.conditions[k]!=null&&!diffs.some(d=>d.dim===dimension(k))).map(dimension);
  const incompatibleAnchor=diffs.some(d=>d.dim==="gravity"||d.dim==="material");
  const relevant=g.missingDimensions.includes("combination")?covered.length>=2:covered.some(d=>g.missingDimensions.includes(d));
  return {direct:diffs.length===0,partial:diffs.length>0&&!incompatibleAnchor&&relevant,covered,unmatched:diffs.map(d=>d.dim)};
}
export function simulateEvidenceGain(c:CandidateExperimentSpec,registry:GapRegistry) {
  const checks=registry.gaps.map(g=>({g,match:wouldAddressGap(c,g)}));
  const direct=checks.filter(x=>x.match.direct);const partial=checks.filter(x=>x.match.partial);
  const affectedScenarioIds=sorted(direct.flatMap(x=>x.g.scenarioIds));
  return {candidateId:c.id,directGapsPotentiallyClosed:direct.map(x=>x.g.id),partialGapsReduced:partial.map(x=>x.g.id),
    affectedScenarioIds,affectedCategories:sorted(direct.flatMap(x=>x.g.categories)),coveredDimensions:sorted(direct.flatMap(x=>x.match.covered)),
    gapsNotAddressed:checks.filter(x=>!x.match.direct).map(x=>x.g.id),
    currentDirectQuestions:registry.directlyCoveredScenarioIds.length,potentialDirectQuestions:registry.directlyCoveredScenarioIds.length+affectedScenarioIds.length,
    assumptions:c.assumptions,limitations:[...PLANNING_LIMITS,"Partial overlap is a research lead, not counted as new direct coverage or proof that a gap shrinks. Unspecified dimensions still require an experiment design."]};
}
export type EvidenceGain = ReturnType<typeof simulateEvidenceGain>;
export type PlanningSort="shared"|"direct"|"categories"|"analogous"|"planned"|"gain";
export function sortGaps(gaps:EvidenceGap[],mode:PlanningSort,gains:EvidenceGain[]=[]) {
  const n=(g:EvidenceGap)=>mode==="shared"?g.scenarioIds.length:mode==="direct"?-g.directCount:mode==="categories"?g.categories.length:mode==="analogous"?g.analogousCount:mode==="planned"?g.plannedCoverage.length:Math.max(0,...gains.filter(x=>x.directGapsPotentiallyClosed.includes(g.id)).map(x=>x.directGapsPotentiallyClosed.length));
  return [...gaps].sort((a,b)=>n(b)-n(a)||(mode==="direct"?a.analogousCount-b.analogousCount:0)||a.id.localeCompare(b.id));
}
export function buildResearchPlan(scenarios:MissionScenario[],records:EvidenceRecord[],findings:Finding[]) {
  const registry=buildGapRegistry(scenarios,records,findings);const candidates=generateCandidates(registry.gaps);
  const gains=candidates.map(c=>simulateEvidenceGain(c,registry)).sort((a,b)=>b.directGapsPotentiallyClosed.length-a.directGapsPotentiallyClosed.length||b.affectedScenarioIds.length-a.affectedScenarioIds.length||a.candidateId.localeCompare(b.candidateId));
  return {registry,candidates,gains,summary:{scenarios:registry.scenarios.length,openQuestions:registry.scenarios.length-registry.directlyCoveredScenarioIds.length,
    gaps:registry.gaps.length,sharedGaps:registry.gaps.filter(g=>g.scenarioIds.length>1).length,candidates:candidates.length,highestGain:gains[0]??null,
    recurringDimensions:sorted(registry.gaps.flatMap(g=>g.missingDimensions)).map(d=>({dimension:d,gaps:registry.gaps.filter(g=>g.missingDimensions.includes(d)).length,questions:sorted(registry.gaps.filter(g=>g.missingDimensions.includes(d)).flatMap(g=>g.scenarioIds)).length})).sort((a,b)=>b.gaps-a.gaps||a.dimension.localeCompare(b.dimension))}};
}
export type ResearchPlan=ReturnType<typeof buildResearchPlan>;
