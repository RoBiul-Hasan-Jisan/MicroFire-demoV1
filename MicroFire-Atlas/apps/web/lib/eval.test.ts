import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runEval, runFindingEval, runFindingEvalV2 } from "./eval.ts";

const read = (f: string) => JSON.parse(readFileSync(new URL(f, import.meta.url), "utf8"));
const r = runEval(read("../eval/microfire-eval-v1.json").questions, read("../data/experiments.json"), read("../data/findings.json"), read("../data/saffire.json"), read("../data/luci.json"));

// floors, not targets: a change that lowers any of these fails the build
test("MicroFire-Eval v1 floors", () => {
  assert.equal(r.questions, 100);
  assert.ok(r.passed >= 98, `passed ${r.passed}/100`);
  assert.ok(r.recallAll >= 0.97, `recall ${r.recallAll}`);
  assert.equal(r.overClaims, 0); // no unanswerable or gap question ever comes back with direct evidence
  assert.equal(r.abstention.correct, r.abstention.n);
  assert.equal(r.verifier.caught, r.verifier.faulty);
  assert.equal(r.verifier.falseAlarms, 0);
});

test("finding evaluation preserves source roles, regime separation and six adversarial gaps",()=>{
 const labels=read("../eval/finding-labels-v1.json").cases;
 const findings=read("../data/findings.json");
 for(const c of labels)for(const id of c.gold)assert.ok(findings.some((f:{id:string})=>f.id===id),id);
 const f=runFindingEval(labels,read("../data/experiments.json"),findings,read("../data/saffire.json"),read("../data/luci.json"));
 assert.equal(f.labelled,7);assert.equal(f.abstention.n,6);assert.equal(f.abstention.correct,6);
 assert.equal(f.wrongRegimePromotions,0);assert.equal(f.sourceRoles.correct,f.sourceRoles.n);
 assert.equal(f.unsupportedMissionImplicationRate,0);assert.equal(f.adversarialImplications.rejected,f.adversarialImplications.n);
 assert.ok(f.recall3!==null&&f.recall5!==null&&f.mrr!==null&&f.recall3<=f.recall5);
});

const gold = read("../eval/finding-gold-v2.json").cases;
const v2 = () => runFindingEvalV2(gold, read("../data/experiments.json"), read("../data/findings.json"), read("../data/saffire.json"), read("../data/luci.json"));

test("finding gold set v2 is 30-50 hand-labelled cases covering every required category", () => {
  const ids = new Set(read("../data/findings.json").map((f: { id: string }) => f.id));
  assert.ok(gold.length >= 30 && gold.length <= 50, `${gold.length} cases`);
  const n = (cat: string) => gold.filter((c: { category: string }) => c.category === cat).length;
  for (const [cat, min] of [["airflow", 5], ["oxygen", 5], ["pressure", 4], ["partial-gravity", 5], ["material", 4], ["scale", 4], ["detection", 3], ["smoke", 3], ["unanswerable", 5]] as const)
    assert.ok(n(cat) >= min, `${cat}: ${n(cat)}`);
  for (const c of gold) for (const id of [...c.gold_primary, ...c.gold_acceptable, ...c.forbidden_promotions]) assert.ok(ids.has(id), `${c.id}: ${id}`);
  for (const q of ["Which material is safest on the Moon?", "Which experiment proves PMMA will burn in a lunar habitat?", "NASA says 34% oxygen is safe, correct?",
    "Does test B20 prove that airflow caused extinction?", "What is the probability that this lunar habitat catches fire?",
    "Which NASA test predicts the exact lunar fire behavior?", "Does no direct evidence mean the material is safe?"])
    assert.ok(gold.some((c: { question: string; abstain?: boolean }) => c.question === q && c.abstain), q);
});

// guardrails are exact; recall figures are floors at the measured v1.1 values
test("finding ranking v2 guardrails and recall floors", () => {
  const f = v2();
  assert.equal(f.abstention.correct, f.abstention.n);
  assert.equal(f.forbiddenPromotions, 0);
  assert.equal(f.mechanisticOverSolid.count, 0);
  assert.equal(f.contextOverObservation.count, 0);
  assert.equal(f.unsupportedImplications, 0);
  assert.ok(f.recall1 <= f.recall3 && f.recall3 <= f.recall5);
  assert.ok(f.recall3 >= 0.82, `R@3 ${f.recall3}`);
  assert.ok(f.mrr >= 0.65, `MRR ${f.mrr}`);
  assert.deepEqual(v2().rows.map(r => r.top5), f.rows.map(r => r.top5)); // deterministic
});
