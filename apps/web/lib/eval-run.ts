// Prints the MicroFire-Eval report:  node lib/eval-run.ts
import { readFileSync } from "node:fs";
import { runEval, runFindingEval, runFindingEvalV2 } from "./eval.ts";
const read = (f: string) => JSON.parse(readFileSync(new URL(f, import.meta.url), "utf8"));
const r = runEval(read("../eval/microfire-eval-v1.json").questions, read("../data/experiments.json"), read("../data/findings.json"), read("../data/saffire.json"), read("../data/luci.json"));
const { failures, ...summary } = r;
console.log(JSON.stringify(summary, null, 1));
for (const f of failures) console.log(`FAIL ${f.id} [${f.category}] ${f.q}\n     ${f.why.join("; ")} (signal ${f.signal})`);
console.log("Finding extension", JSON.stringify(runFindingEval(read("../eval/finding-labels-v1.json").cases,read("../data/experiments.json"),read("../data/findings.json"),read("../data/saffire.json"),read("../data/luci.json")),null,2));
const v2 = runFindingEvalV2(read("../eval/finding-gold-v2.json").cases,read("../data/experiments.json"),read("../data/findings.json"),read("../data/saffire.json"),read("../data/luci.json"));
console.log("Finding gold set v2", JSON.stringify({ ...v2, rows: undefined },null,1));
