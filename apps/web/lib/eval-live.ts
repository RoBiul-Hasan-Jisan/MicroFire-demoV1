/**
 * MicroFire-Eval, live part: sends every question to a running site's /api/ask and scores the model's answers
 * with the same claim verifier users see. Costs API money, so it never runs in tests or builds.
 *
 *   SITE=http://localhost:3418 node lib/eval-live.ts      (the server needs OPENAI_API_KEY or ANTHROPIC_API_KEY)
 * Writes eval/results-live.json: metrics plus every answer, so the numbers can be audited.
 *
 *   node lib/eval-live.ts --rescore    re-checks the saved answers with the current verifier: no API calls, no cost
 */
import { readFileSync, writeFileSync } from "node:fs";
import { buildEvidence, checkAnswer, type CheckedClaim } from "./ask-core.ts";
import type { EvalQuestion } from "./eval.ts";

const SITE = process.env.SITE ?? "http://localhost:3418";
const { questions } = JSON.parse(readFileSync(new URL("../eval/microfire-eval-v1.json", import.meta.url), "utf8")) as { questions: EvalQuestion[] };
const OUT = new URL("../eval/results-live.json", import.meta.url);

type Row = { id: string; category: string; q: string; ms: number; mode: string; provider?: string; summary?: string; claims: CheckedClaim[]; reason?: string };

/** Citation keys contain a colon ("F:flex-loi-lower"), so split the issue text after its first ": " only. */
const removedKeys = (c: CheckedClaim) => {
  const i = c.issues.find((x) => x.startsWith("Removed citations"));
  return i ? i.slice(i.indexOf(": ") + 2).split(",").map((x) => x.trim()).filter(Boolean) : [];
};

function metricsOf(rows: Row[], extra: Record<string, unknown>) {
  const claims = rows.flatMap((r) => r.claims);
  const has = (c: CheckedClaim, s: string) => c.issues.some((i) => i.startsWith(s));
  const removed = claims.reduce((n, c) => n + (removedKeys(c).length), 0);
  const kept = claims.reduce((n, c) => n + c.cites.length, 0);
  const factual = claims.filter((c) => c.type === "OBSERVED" || c.type === "DERIVED");
  const gapQs = questions.filter((x) => x.expect?.signal === "gap" || x.expect?.signal === "abstain").map((x) => x.id);
  const gapRows = rows.filter((r) => gapQs.includes(r.id));
  const admits = (r: Row) => r.mode !== "ai" || r.claims.some((c) => c.type === "DATA_GAP");
  const ms = rows.map((r) => r.ms).sort((a, b) => a - b);
  return {
    ...extra,
    provider: rows.find((r) => r.provider)?.provider ?? null,
    questions: rows.length,
    aiAnswers: rows.filter((r) => r.mode === "ai").length,
    claims: claims.length,
    citationPrecision: kept + removed ? kept / (kept + removed) : null,
    numericFidelity: factual.length ? factual.filter((c) => !has(c, "Numbers not found")).length / factual.length : null,
    unitFidelity: factual.length ? factual.filter((c) => !has(c, "Unit mismatch")).length / factual.length : null,
    crossGravityMisattributions: claims.filter((c) => has(c, "Describes microgravity")).length,
    unsupportedClaimRate: claims.length ? claims.filter((c) => !c.verified).length / claims.length : null,
    gapAdmission: { n: gapRows.length, admitted: gapRows.filter(admits).length },
    latencyMs: { p50: ms[Math.floor(ms.length * 0.5)], p95: ms[Math.min(ms.length - 1, Math.floor(ms.length * 0.95))] },
  };
}

if (process.argv[2] === "--rescore") {
  const saved = JSON.parse(readFileSync(OUT, "utf8"));
  const exps = JSON.parse(readFileSync(new URL("../data/experiments.json", import.meta.url), "utf8"));
  const finds = JSON.parse(readFileSync(new URL("../data/findings.json", import.meta.url), "utf8"));
  const saff = JSON.parse(readFileSync(new URL("../data/saffire.json", import.meta.url), "utf8"));
  const rows: Row[] = saved.rows.map((r: Row) => {
    if (r.mode !== "ai") return r;
    const { items } = buildEvidence(r.q, exps, finds, saff);
    // restore citations the run-time verifier removed, so they are judged again
    const raw = r.claims.map((c) => ({ text: c.text, type: c.type, cites: [...c.cites, ...removedKeys(c)] }));
    return { ...r, claims: checkAnswer({ summary: r.summary ?? "", claims: raw }, items, r.q) };
  });
  const metrics = metricsOf(rows, { rescoredAt: new Date().toISOString(), note: "Same saved answers, re-checked with the current verifier. No new model calls." });
  writeFileSync(OUT, JSON.stringify({ ...saved, rescored: metrics }, null, 1) + "\n");
  console.log(JSON.stringify({ atRun: saved.metrics, rescored: metrics }, null, 1));
  process.exit(0);
}

const only = Number(process.argv[2] ?? 0); // optional: first N questions only
const rows: Row[] = [];
const todo = only ? questions.slice(0, only) : questions;
let next = 0;
async function worker() {
  while (next < todo.length) {
    const x = todo[next++];
    const t0 = performance.now();
    const res = await fetch(`${SITE}/api/ask`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: x.q }) });
    const body = await res.json();
    rows.push({ id: x.id, category: x.category, q: x.q, ms: Math.round(performance.now() - t0), mode: body.mode, provider: body.provider, summary: body.summary, claims: body.claims ?? [], reason: body.reason ?? body.error });
    process.stdout.write(`${x.id} ${body.mode} ${Math.round(performance.now() - t0)} ms\n`);
  }
}
await Promise.all([worker(), worker(), worker()]);
rows.sort((a, b) => a.id.localeCompare(b.id));
const metrics = metricsOf(rows, { ranAt: new Date().toISOString(), model: process.env.OPENAI_MODEL ?? "server default (gpt-5-mini)" });
writeFileSync(OUT, JSON.stringify({ metrics, rows }, null, 1) + "\n");
console.log(JSON.stringify(metrics, null, 1));
