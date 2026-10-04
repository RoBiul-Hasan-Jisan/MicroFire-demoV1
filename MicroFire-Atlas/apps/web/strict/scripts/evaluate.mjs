import {readFileSync} from 'node:fs';
import {search,makeBrief} from '../src/compute/evidence.mjs';
const cases=JSON.parse(readFileSync(new URL('../data/evaluation.json',import.meta.url)));
let passed=0;
for(const c of cases){const result=search({question:c.question});const brief=makeBrief(c.question,result.records);const ok=c.abstain?brief.abstained:!brief.abstained&&c.ids.every(id=>brief.claims.some(x=>x.id===id));passed+=Number(ok);console.log(`${ok?'PASS':'FAIL'} ${c.question}`);}
console.log(`\n${passed}/${cases.length} offline retrieval/abstention cases passed. This is NOT live LLM or independent scientific validation.`);
if(passed!==cases.length)process.exitCode=1;
