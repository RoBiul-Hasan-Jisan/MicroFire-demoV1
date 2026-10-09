import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fromBass,fromSaffire,fromLuci} from "./ontology.ts";
import {MISSION_SCENARIOS,type MissionScenario} from "./mission-scenarios.ts";
import {buildResearchPlan,buildGapRegistry,conditionKey,generateCandidates,gapId,normalizeConditions,PLANNING_LIMITS,sortGaps,wouldAddressGap} from "./research-planning.ts";
import {buildResearchGraph} from "./graph.ts";
import {RESEARCH_DOWNLOADS,researchExport} from "./research-exports.ts";
const read=(n:string)=>JSON.parse(readFileSync(new URL(`../data/${n}.json`,import.meta.url),"utf8"));
const findings=read("findings"),records=[...read("experiments").map(fromBass),...read("saffire").map(fromSaffire),...read("luci").map(fromLuci)];
const data=JSON.stringify(records);const plan=buildResearchPlan(MISSION_SCENARIOS,records,findings);
const moon=MISSION_SCENARIOS.find(s=>s.id==="mission-moon-base")!;
const scenario=(id:string,q:MissionScenario["scenario"],question=id):MissionScenario=>({...moon,id,question,scenario:q});

test("research registry is deterministic; exact identity preserves unknown and different physical values",()=>{
 assert.deepEqual(plan,buildResearchPlan([...MISSION_SCENARIOS].reverse(),[...records].reverse(),[...findings].reverse()));
 assert.equal(gapId({oxygen:34,gravity:"lunar"}),gapId({gravity:"lunar",oxygen:34}));
 for(const q of [{oxygen:34.1,gravity:"lunar" as const},{oxygen:34,gravity:"martian" as const},{oxygen:34,gravity:"lunar" as const,pressureKpa:56.5}])assert.notEqual(gapId(q),gapId({oxygen:34,gravity:"lunar"}));
 assert.deepEqual(normalizeConditions({gravity:"lunar"}),{gravity:"lunar"});
 for(const n of [NaN,Infinity,-1])assert.throws(()=>normalizeConditions({oxygen:n}));
 assert.throws(()=>normalizeConditions({oxygen:"34"} as never));
 assert.throws(()=>normalizeConditions({flowDirection:"concurrent"} as never));
 assert.doesNotMatch(JSON.stringify(plan),/NaN|Infinity/);
});
test("equivalent gaps merge distinct questions; duplicated questions do not inflate breadth",()=>{
 const a=scenario("a",moon.scenario,"What is the recorded flame behavior?");
 const b=scenario("b",moon.scenario,"Which source reports this condition combination?");
 const p=buildGapRegistry([a,b,a,{...a,id:"duplicate"}],records,findings);
 assert.equal(p.gaps.length,1);assert.deepEqual(p.gaps[0].scenarioIds,["a","b"]);assert.equal(p.scenarios.length,2);
 assert.throws(()=>buildGapRegistry([a,{...a,scenario:{gravity:"martian"}}],records,findings));
});
test("completed direct matches are not registered as gaps; plans and publications are not rows",()=>{
 const exact=scenario("exact",{material:"PMMA",gravity:"microgravity",oxygen:16.5,pressureKpa:101.3,flow:5});
 assert.equal(buildGapRegistry([exact],records,findings).gaps.length,0);
 const future={...records[0],id:"planned-fm2",family:"fm2" as const,material:"PMMA",gravity:"lunar" as const,oxygen:34,pressureKpa:[56.5,56.5] as [number,number],flowCmS:20};
 const p=buildGapRegistry([moon],[future],findings);
 assert.equal(p.gaps[0].directCount,0);assert.equal(p.gaps[0].analogousCount,0);assert.equal(p.gaps[0].closestRecordIds.length,0);
 assert.equal(p.gaps[0].plannedCoverage[0].status,"planned");assert.equal(JSON.stringify(records),data);
 assert.ok(plan.registry.gaps.every(g=>!g.evidenceFamilies.includes("fm2")));
});
test("candidates come only from exact gap requirements and cannot fill unspecified fields",()=>{
 for(const c of plan.candidates){assert.equal(c.status,"hypothetical-research-question");assert.ok(c.sourceGapIds.length);assert.equal("outcome" in c,false);assert.equal("cite" in c,false);
  for(const id of c.sourceGapIds)assert.equal(conditionKey(c.conditions),conditionKey(plan.registry.gaps.find(g=>g.id===id)!.conditions));}
 const sparse=buildResearchPlan([scenario("sparse",{material:"PMMA",gravity:"lunar",oxygen:34})],records,findings);
 assert.equal(sparse.candidates[0].conditions.pressureKpa,undefined);assert.ok(sparse.candidates[0].unknownDimensions.includes("pressureKpa"));
 assert.equal(generateCandidates([...plan.registry.gaps,...plan.registry.gaps]).length,plan.candidates.length);
});
test("evidence gain matches multiple gaps but rejects gravity/material and missing requirements",()=>{
 const p=buildResearchPlan([scenario("full",moon.scenario),scenario("broad",{material:"PMMA",gravity:"lunar",oxygen:34}),scenario("mars",{...moon.scenario,gravity:"martian"}),scenario("fabric",{...moon.scenario,material:"SIBAL fabric"}),scenario("different-air",{...moon.scenario,oxygen:28.5})],records,findings);
 const c=p.candidates.find(c=>conditionKey(c.conditions)===conditionKey(moon.scenario))!;
 assert.throws(()=>wouldAddressGap({...c,status:"planned"} as never,p.registry.gaps[0]));
 const g=p.gains.find(g=>g.candidateId===c.id)!;assert.equal(g.directGapsPotentiallyClosed.length,2);
 for(const id of ["mars","fabric"]) {const gap=p.registry.gaps.find(g=>g.scenarioIds.includes(id))!;const m=wouldAddressGap(c,gap);assert.equal(m.direct,false);assert.equal(m.partial,false);assert.ok(g.gapsNotAddressed.includes(gap.id));}
 const different=p.registry.gaps.find(g=>g.scenarioIds.includes("different-air"))!;assert.equal(wouldAddressGap(c,different).direct,false);assert.equal(wouldAddressGap(c,different).partial,true);
 const broad=p.candidates.find(c=>c.conditions.pressureKpa==null)!;assert.equal(wouldAddressGap(broad,p.registry.gaps.find(g=>g.scenarioIds.includes("full"))!).direct,false);
 assert.equal(JSON.stringify(records),data);
});
test("sorts retain deterministic ties; generated language stays bounded",()=>{
 for(const mode of ["shared","direct","categories","analogous","planned","gain"] as const)assert.deepEqual(sortGaps(plan.registry.gaps,mode,plan.gains),sortGaps([...plan.registry.gaps].reverse(),mode,plan.gains));
 const text=JSON.stringify({limits:PLANNING_LIMITS,candidates:plan.candidates,gains:plan.gains});
 assert.doesNotMatch(text,/NASA should|NASA recommends this experiment|highest priority for NASA|\bsafe\b|\bunsafe\b|will prevent fire|will reduce risk|probability of success|optimal experiment|best experiment for NASA/i);
});

test("planning graph connects existing NASA nodes without giving candidates observed identity or citations",()=>{
 const g=buildResearchGraph(plan,records,findings,read("sources"));const ids=new Set(g.nodes.map(n=>n.id));
 assert.equal(ids.size,g.nodes.length);
 for(const e of g.edges)assert.ok(ids.has(e.from)&&ids.has(e.to),JSON.stringify(e));
 for(const c of plan.candidates){const n=g.nodes.find(n=>n.id===c.id)!;assert.equal(n.type,"CandidateExperiment");
  assert.ok(n.type==="CandidateExperiment"&&n.status==="hypothetical-research-question");
  assert.equal(g.edges.some(e=>e.type==="SOURCE_DOCUMENTS_RECORD"&&e.to===c.id),false);}
 for(const n of g.nodes.filter(n=>n.type==="PlannedExperiment"))assert.ok(n.type==="PlannedExperiment"&&n.status==="planned");
 assert.ok(g.edges.some(e=>e.type==="ADDRESSES"));assert.ok(g.edges.some(e=>e.type==="MAY_ADDRESS"));
});
test("five research exports retain deterministic corpus/version identity and explicit statuses",()=>{
 for(const name of RESEARCH_DOWNLOADS){const a=researchExport(name,plan,records,findings,read("sources"));
  assert.deepEqual(a,researchExport(name,plan,records,findings,read("sources")));assert.equal(a.schema_version,1);
  assert.equal(a.status,"derived-research-planning");assert.match(a.source_manifest_sha256,/^[a-f0-9]{64}$/);
  assert.equal(a.corpus.records,78);assert.ok(a.limitations.length);assert.equal("timestamp" in a.generated_from,false);}
});
