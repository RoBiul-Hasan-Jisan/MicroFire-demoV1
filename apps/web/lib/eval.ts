/**
 * MicroFire-Eval: measures the parts of Ask that run before and after the language model.
 *
 * 1. Retrieval: does the evidence package contain the gold NASA records for each question (Recall@5, Recall@package)?
 * 2. Coverage signal: for mission, unanswerable and misleading questions, does the package say "direct evidence
 *    exists", or flag the gap / come back empty, as it should?
 * 3. Claim verifier: on deliberately broken claims (invented citations, wrong numbers, swapped units,
 *    microgravity told as lunar, causal wording, predictions, uncited facts), how many are caught, and how many
 *    correct claims are wrongly flagged?
 * None of this calls a model, so it costs nothing and runs in the test suite. Live model metrics come from
 * eval-live.ts, which needs an API key.
 */
import { buildEvidence, checkAnswer, type ClaimType, type EvidenceItem } from "./ask-core.ts";
import type { Experiment, Finding, SaffireRun } from "./types";

export type EvalQuestion = {
  id: string;
  category: string;
  q: string;
  gold?: string[];
  anyOf?: string[];
  expect?: { signal?: "direct" | "gap" | "abstain"; gaps?: string[]; mechanistic?: boolean };
};
export type Signal = "direct" | "gap" | "empty" | "partial";

export function signalOf(ev: ReturnType<typeof buildEvidence>): Signal {
  if (ev.items.some((i) => i.rung === "direct")) return "direct";
  if (ev.outside.length) return "gap";
  if (!ev.items.length) return "empty";
  return "partial";
}

export type QuestionResult = { id: string; category: string; q: string; pass: boolean; why: string[]; recall5: number | null; recallAll: number | null; signal: Signal };

export function scoreQuestion(x: EvalQuestion, exps: Experiment[], finds: Finding[], saffire: SaffireRun[]): QuestionResult {
  const ev = buildEvidence(x.q, exps, finds, saffire);
  const keys = ev.items.map((i) => i.key);
  const top5 = keys.slice(0, 5);
  const why: string[] = [];
  let recall5: number | null = null, recallAll: number | null = null;
  if (x.gold?.length) {
    recall5 = x.gold.filter((k) => top5.includes(k)).length / x.gold.length;
    recallAll = x.gold.filter((k) => keys.includes(k)).length / x.gold.length;
    const missing = x.gold.filter((k) => !keys.includes(k));
    if (missing.length) why.push(`missing ${missing.join(", ")}`);
  }
  if (x.anyOf?.length) {
    const hit = x.anyOf.some((k) => keys.includes(k));
    recall5 = Math.max(recall5 ?? 0, x.anyOf.some((k) => top5.includes(k)) ? 1 : 0);
    recallAll = Math.max(recallAll ?? 0, hit ? 1 : 0);
    if (!hit) why.push(`none of ${x.anyOf.join(", ")}`);
  }
  const signal = signalOf(ev);
  const e = x.expect;
  if (e?.signal === "direct" && signal !== "direct") why.push(`expected direct evidence, got ${signal}`);
  if (e?.signal === "gap" && signal !== "gap") why.push(`expected a flagged gap, got ${signal}`);
  if (e?.signal === "abstain" && signal !== "gap" && signal !== "empty") why.push(`expected a gap or no evidence, got ${signal}`);
  for (const g of e?.gaps ?? []) if (!ev.gapDims.includes(g as never)) why.push(`gap "${g}" not flagged`);
  if (e?.mechanistic && !ev.items.some((i) => i.rung === "mechanistic")) why.push("no mechanistic-only label on other-regime evidence");
  return { id: x.id, category: x.category, q: x.q, pass: why.length === 0, why, recall5, recallAll, signal };
}

/** Deliberately broken claims, built from real records so every "correct" claim is checkably true. */
export type ClaimCase = { fault: string; claim: { text: string; type: ClaimType; cites: string[] }; items: EvidenceItem[] };

export function claimCases(exps: Experiment[], finds: Finding[], saffire: SaffireRun[]): ClaimCase[] {
  const out: ClaimCase[] = [];
  const picks = exps.filter((e) => e.oxygen_vol_pct != null).filter((_, i) => i % 6 === 0).slice(0, 10);
  for (const e of picks) {
    const ev = buildEvidence(`What happened in test ${e.test_id}?`, exps, finds, saffire);
    const key = `E:${e.id}`, o2 = String(e.oxygen_vol_pct);
    const wrong = String(Math.round((e.oxygen_vol_pct! + 3.7) * 10) / 10);
    const c = (fault: string, text: string, type: ClaimType = "OBSERVED", cites = [key]) => out.push({ fault, claim: { text, type, cites }, items: ev.items });
    c("none", `${e.test_id} ran at ${o2} % oxygen.`);
    c("none", `This test ran in microgravity, not on the Moon.`);
    c("none", `No test in this package was run at lunar gravity.`, "DATA_GAP", []);
    c("invented citation", `${e.test_id} ran at ${o2} % oxygen.`, "OBSERVED", ["E:bass2-B99"]);
    c("wrong number", `${e.test_id} ran at ${wrong} % oxygen.`);
    c("unit swap", `${e.test_id} ran at ${o2} cm/s.`);
    c("microgravity told as lunar", `${e.test_id} shows how ${e.material} burns on the Moon.`);
    c("causal wording", `Low oxygen caused the outcome in ${e.test_id}.`);
    c("prediction", `${e.material} will behave the same way in a lunar habitat.`, "INTERPRETATION");
    c("uncited fact", `${e.test_id} ran at ${o2} % oxygen.`, "OBSERVED", []);
  }
  return out;
}

export type EvalReport = {
  questions: number;
  passed: number;
  byCategory: Record<string, { n: number; passed: number }>;
  recall5: number;
  recallAll: number;
  abstention: { n: number; correct: number };
  gapFlags: { n: number; correct: number };
  overClaims: number; // unanswerable or gap questions that came back with "direct" evidence
  verifier: { faulty: number; caught: number; correct: number; falseAlarms: number; byFault: Record<string, { n: number; caught: number }> };
  failures: QuestionResult[];
};

export function runEval(qs: EvalQuestion[], exps: Experiment[], finds: Finding[], saffire: SaffireRun[]): EvalReport {
  const rs = qs.map((x) => scoreQuestion(x, exps, finds, saffire));
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const byCategory: EvalReport["byCategory"] = {};
  for (const r of rs) {
    byCategory[r.category] ??= { n: 0, passed: 0 };
    byCategory[r.category].n++;
    if (r.pass) byCategory[r.category].passed++;
  }
  const abst = qs.filter((x) => x.expect?.signal === "abstain");
  const gapQs = qs.filter((x) => x.expect?.signal === "gap");
  const res = (x: EvalQuestion) => rs.find((r) => r.id === x.id)!;
  const cases = claimCases(exps, finds, saffire);
  const byFault: EvalReport["verifier"]["byFault"] = {};
  let caught = 0, falseAlarms = 0, correct = 0, faulty = 0;
  for (const k of cases) {
    const [checked] = checkAnswer({ summary: "", claims: [k.claim] }, k.items);
    const flagged = !checked.verified;
    if (k.fault === "none") { correct++; if (flagged) falseAlarms++; continue; }
    faulty++;
    byFault[k.fault] ??= { n: 0, caught: 0 };
    byFault[k.fault].n++;
    if (flagged) { caught++; byFault[k.fault].caught++; }
  }
  return {
    questions: rs.length,
    passed: rs.filter((r) => r.pass).length,
    byCategory,
    recall5: mean(rs.filter((r) => r.recall5 != null).map((r) => r.recall5!)),
    recallAll: mean(rs.filter((r) => r.recallAll != null).map((r) => r.recallAll!)),
    abstention: { n: abst.length, correct: abst.filter((x) => ["gap", "empty"].includes(res(x).signal)).length },
    gapFlags: { n: gapQs.length, correct: gapQs.filter((x) => res(x).pass).length },
    overClaims: [...abst, ...gapQs].filter((x) => res(x).signal === "direct").length,
    verifier: { faulty, caught, correct, falseAlarms, byFault },
    failures: rs.filter((r) => !r.pass),
  };
}
