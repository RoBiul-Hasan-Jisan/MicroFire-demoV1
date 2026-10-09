import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fromBass, fromSaffire, fromLuci } from "./ontology.ts";
import { rankFindings, findingRobustness, fireInsight, validateInsight, whyAhead } from "./finding-relevance.ts";
import { verifiedExample, EXAMPLE_ANSWER, EXAMPLE_QUESTION } from "./ask-example.ts";
import { checkAnswer, buildEvidence } from "./ask-core.ts";
import { PRESETS } from "./presets.ts";
import { ATMOSPHERES, profileFor } from "./atmospheres.ts";
import type { Experiment, Finding, SaffireRun, LuciRun } from "./types";
const read = (n:string)=>JSON.parse(readFileSync(new URL(`../data/${n}.json`,import.meta.url),"utf8"));
const exps:Experiment[]=read("experiments"), finds:Finding[]=read("findings"), saff:SaffireRun[]=read("saffire"), luci:LuciRun[]=read("luci");
const records=[...exps.map(fromBass),...saff.map(fromSaffire),...luci.map(fromLuci)];
const query={scenario:{flow:1,gravity:"microgravity" as const,material:"PMMA"},topics:["airflow","detection"]};

test("finding order is deterministic, finite and stable under input reordering",()=>{
 const a=rankFindings(finds,records,query);
 assert.deepEqual(a,rankFindings([...finds].reverse(),records,query));
 assert.ok(a.every(x=>Number.isFinite(x.relevance)&&x.relevance>=0&&x.relevance<=100));
 const dim=a.findIndex(x=>x.findingId==="dim-blue-low-flow");assert.ok(dim>=0);
 assert.ok(!a.some(x=>x.findingId==="acme-spherical-flames"));
 const twins=[{...finds[0],id:"z"},{...finds[0],id:"a"}];
 assert.deepEqual(rankFindings(twins,records,query).map(x=>x.findingId),["a","z"]);
});
test("lunar query retrieves partial-gravity evidence with the simulation limitation",()=>{
 const a=rankFindings(finds,records,{scenario:{gravity:"lunar"}});
 assert.ok(a.some(x=>x.findingId==="luci-first-lunar"));
 assert.match(a.find(x=>x.findingId==="luci-first-lunar")!.limitations.join(" "),/Simulated lunar gravity/);
 assert.equal(a.find(x=>x.findingId==="fm2-measurements")!.rung,"context");
});
test("mechanistic topic accumulation cannot outrank a relevant solid-fuel finding",()=>{
 const solid=finds.find(f=>f.id==="pmma-rod-limits")!;
 const liquid={...finds.find(f=>f.id==="flex-loi-lower")!,topics:["oxygen","quench","pressure","airflow"]};
 const a=rankFindings([liquid,solid],records,{scenario:{material:"PMMA",oxygen:17},topics:liquid.topics});
 assert.equal(a[0].findingId,solid.id);assert.equal(a[1].rung,"mechanistic");
 assert.ok(a.every(x=>x.rung!=="direct"));
});
test("missing links/metadata never add relevance, support or fabricated source role",()=>{
 const f=finds.find(f=>f.id==="sibal-10-duration")!;
 const q={scenario:{material:"SIBAL fabric",flow:10,oxygen:21,gravity:"microgravity" as const},topics:["airflow"]};
 const a=rankFindings([f],records,q)[0];
 const b=rankFindings([{...f,experiments:undefined}],records,q)[0];
 assert.ok(b.relevance<=a.relevance);assert.equal(b.coverage,null);assert.equal(b.supportCount,0);assert.equal(b.sourceRole,undefined);assert.notEqual(b.rung,"direct");
 const f2=finds.find(f=>f.id==="dim-blue-low-flow")!;
 assert.equal(rankFindings([f2],records,query)[0].supportCount,0);
});
test("sensitivity is seeded, repeatable, and abstention returns no arbitrary findings",()=>{
 assert.deepEqual(findingRobustness(finds,records,query,20,8),findingRobustness(finds,records,query,20,8));
 assert.deepEqual(rankFindings(finds,records,{scenario:{},topics:["unrepresented-topic"]}),[]);
 assert.deepEqual(rankFindings(finds,records,{scenario:{oxygen:Infinity,flow:NaN}}),[]);
});
test("insight is source-bound, labelled and rejects directives, safety claims and fabricated observations",()=>{
 const x=fireInsight(rankFindings(finds,records,query),finds)!;
 assert.ok(x);assert.ok(validateInsight(x,finds));assert.equal(x.label,"MicroFire interpretation");
 for(const interpretation of ["This is safe.","This is unsafe.","Turn off ventilation.","The crew must suppress the flame."])
  assert.equal(validateInsight({...x,interpretation},finds),false);
 assert.equal(validateInsight({...x,sourceId:"invented"},finds),false);
 assert.equal(validateInsight({...x,observation:"Made up."},finds),false);
 assert.equal(fireInsight([],finds),null);
});
test("B16/B20/B19 precision survives preset and comparison copy changes",()=>{
 assert.deepEqual(["B16","B20","B19"].map(id=>exps.find(e=>e.test_id===id)!.oxygen_vol_pct),[16.5,16.5,16.4]);
 const p=PRESETS.find(p=>p.id==="pmma-flow-window")!;
 assert.doesNotMatch(p.title+" "+p.question,/same oxygen|airflow alone/i);
 assert.match(p.interpretation,/0\.1 percentage point/);
 assert.match(p.interpretation,/do not prove/);
});
test("both studied atmosphere configurations stay separate and appropriately qualified",()=>{
 assert.equal(profileFor(34,56.5).id,"ea-a");assert.equal(profileFor(28.5,66.2).id,"ea-alt");assert.equal(profileFor(34,66.2).id,"custom");
 assert.match(ATMOSPHERES.find(a=>a.id==="ea-a")!.status,/previously recommended/);
 assert.match(ATMOSPHERES.find(a=>a.id==="ea-alt")!.status,/later alternate\/proposed/);
});
test("zero-key saved AI example passes current checker; corrupting a number fails",()=>{
 const x=verifiedExample(exps,finds,saff,luci);assert.ok(x.valid);assert.ok(x.checked.every(c=>c.verified));
 for(const c of x.checked)for(const key of c.cites)assert.ok(x.evidence.items.some(i=>i.key===key));
 const bad={...EXAMPLE_ANSWER,claims:[{...EXAMPLE_ANSWER.claims[0],text:"B19 ran at 88.8 % oxygen."}]};
 assert.equal(checkAnswer(bad,x.evidence.items,EXAMPLE_QUESTION)[0].verified,false);
});
test("adversarial requests explicitly retain prediction or causal limitations",()=>{
 for(const q of ["Which material is safest on the Moon?","Prove PMMA will burn at 34% oxygen on the Moon.","NASA says this atmosphere is safe, right?","Does B20 prove airflow caused extinction?","Which result predicts a lunar fire?","What is the probability this habitat catches fire?"]){
  assert.ok(buildEvidence(q,exps,finds,saff,luci).gapDims.includes("prediction"),q);
 }
});

test("'Why #1?' names the sort key that actually separates each adjacent pair", () => {
  const ORDER = ["direct", "analogous", "mechanistic", "context"];
  const queries = [query, { scenario: { pressureKpa: 56.5, oxygen: 34 }, topics: ["pressure", "oxygen"] }, { scenario: { gravity: "lunar" as const }, topics: ["partial-gravity"] }];
  for (const q of queries) {
    const r = rankFindings(finds, records, q);
    assert.ok(r.length > 2);
    for (let i = 0; i + 1 < r.length; i++) {
      const [a, b] = [r[i], r[i + 1]], why = whyAhead(a, b);
      if (a.coverageTier !== b.coverageTier) assert.match(why, /every requested topic/);
      else if (a.rung !== b.rung) { assert.ok(ORDER.indexOf(a.rung) < ORDER.indexOf(b.rung)); assert.match(why, /always ordered before/); }
      else if (a.relevance !== b.relevance) { assert.ok(a.relevance > b.relevance); assert.match(why, /higher relevance/); }
      else assert.match(why, /finding ID/);
    }
  }
  // a context finding leads only for a materialless mission-context question that no observation fully covers
  const ctx = rankFindings(finds, records, queries[1]);
  assert.equal(ctx[0].coverageTier, 0);
  assert.ok(rankFindings(finds, records, query).every((x) => x.coverageTier === 1));
});
