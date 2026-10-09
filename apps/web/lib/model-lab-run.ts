// Reproduces the AI Model Lab from the NASA records:  npm run model-lab
// Same code and seeds as the /model-lab page and lib/model-lab.test.ts, so the numbers match exactly.
import { readFileSync } from "node:fs";
import { buildDataset, chooseModel, evaluate, materialTransfer, MODEL_VERSION, snapshot } from "./model-lab.ts";

const exps = JSON.parse(readFileSync(new URL("../data/experiments.json", import.meta.url), "utf8"));
const { rows, excluded } = buildDataset(exps);
const f = (x: number | null | undefined, d = 3) => (x == null ? "n/a" : x.toFixed(d));
const ci = (x: { lo: number; hi: number } | null) => (x ? `[${f(x.lo, 2)}, ${f(x.hi, 2)}]` : "");

console.log(`${MODEL_VERSION}\nUsable records: ${rows.length} (${rows.filter((r) => !r.y).length} without an established flame). Excluded: ${excluded.length}`);
for (const e of excluded) console.log(`  - ${e.test} (${e.material}): ${e.reason}`);

const evals = evaluate(rows);
console.log("\nGrouped (leave-one-session-out) cross-validation, 95 % bootstrap intervals:");
for (const e of evals)
  console.log(`  ${e.name.padEnd(64)} Brier ${f(e.grouped.brier)} ${ci(e.grouped.ci.brier)}  log loss ${f(e.grouped.logLoss)}  AUC ${f(e.grouped.auc, 2)} ${ci(e.grouped.ci.auc)}  bal.acc ${f(e.grouped.balancedAccuracy, 2)}`);

const pick = chooseModel(evals);
console.log(`\nDeployed: ${pick ?? "nothing (no model beats the baseline)"}`);
console.log("\nLeave-one-material-out (oxygen-only logistic):");
for (const t of materialTransfer(rows)) console.log(`  held out ${t.held}: n=${t.testN}, negatives=${t.testNegatives}, Brier ${f(t.brier)}, AUC ${f(t.auc, 2)}, bal.acc ${f(t.balancedAccuracy, 2)}`);
if (pick) {
  const s = snapshot(rows, pick as "logit-o2-material");
  console.log("\nCoefficients (standardised features):", s.features.map((n, j) => `${n} ${f(s.model.w[j])}`).join(", "), `intercept ${f(s.model.b)}`);
}
