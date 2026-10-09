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
import { buildEvidence, checkAnswer, parseQuestion, type ClaimType, type EvidenceItem } from "./ask-core.ts";
import { fromBass, fromSaffire, fromLuci, type MissionQuestion } from "./ontology.ts";
import { rankFindings, fireInsight, validateInsight, findingRobustness, type FindingRung } from "./finding-relevance.ts";
import type { Experiment, Finding, LuciRun, SaffireRun } from "./types";

export type EvalQuestion = {
  id: string;
  category: string;
  q: string;
  gold?: string[];
  anyOf?: string[];
  expect?: { signal?: "direct" | "gap" | "abstain"; gaps?: string[]; mechanistic?: boolean };
};
export type Signal = "direct" | "gap" | "empty" | "partial";

/** Supplemental finding labels extend MicroFire-Eval; the frozen 100-question set is unchanged. */
export type FindingEvalCase = { id: string; q: string; gold: string[]; abstain?: boolean; rationale: string };
export function runFindingEval(cases: FindingEvalCase[], exps: Experiment[], finds: Finding[], saffire: SaffireRun[], luci: LuciRun[]) {
  const records = [...exps.map(fromBass), ...saffire.map(fromSaffire), ...luci.map(fromLuci)];
  const rows = cases.map(c => {
    const parsed = parseQuestion(c.q);
    const ranked = rankFindings(finds, records, { scenario: parsed.scenario, topics: [...parsed.topics] });
    const ids = ranked.map(r => r.findingId);
    const positions = c.gold.map(id => ids.indexOf(id)).filter(i => i >= 0);
    const insight = fireInsight(ranked, finds);
    // Wrong-regime promotion means non-solid evidence ordered before relevant solid evidence.
    const firstMechanism = ranked.findIndex(r => r.rung === "mechanistic");
    const wrongRegime = firstMechanism >= 0 && ranked.some((r,i) => i > firstMechanism && (r.rung === "direct" || r.rung === "analogous"));
    const rejected = insight ? ["This material is safe on the Moon.", "Turn off ventilation.", "The probability of fire is 2 %."]
      .filter(interpretation => !validateInsight({...insight, interpretation}, finds)).length : 0;
    return { id:c.id, top5:ids.slice(0,5), recall3:c.gold.length ? c.gold.filter(id=>ids.slice(0,3).includes(id)).length/c.gold.length : null,
      recall5:c.gold.length ? c.gold.filter(id=>ids.slice(0,5).includes(id)).length/c.gold.length : null,
      reciprocalRank:c.gold.length ? (positions.length ? 1/(Math.min(...positions)+1) : 0) : null,
      wrongRegime, implication:!!insight, unsupportedImplication:!!insight&&!validateInsight(insight,finds), mutationChecks:insight?3:0, rejected,
      abstention:c.abstain ? signalOf(buildEvidence(c.q,exps,finds,saffire,luci)) === "gap" && !ranked.some(r=>r.rung==="direct") : null };
  });
  // Independently specified expectations for the labelled quotes: unknown PDF sections must stay unknown.
  const roles: Record<string,string|undefined> = { "luci-first-lunar":"abstract", "tiny-flame-undetected":"abstract", "sibal-quench-speeds":"abstract", "dim-blue-low-flow":undefined, "saffire-alarm-981-s":undefined, "saffire-co-co2-limits":undefined, "saffire-flame-jumped-gap":undefined, "sibal-5-duration":undefined };
  const roleResults = Object.entries(roles).map(([id, expected]) => {
    const f = finds.find(f=>f.id===id);
    return !!f && rankFindings([f],records,{scenario:{},topics:f.topics})[0]?.sourceRole===expected;
  });
  const mean = (key:"recall3"|"recall5"|"reciprocalRank") => { const a=rows.flatMap(r=>r[key]===null?[]:[r[key]]);return a.length?a.reduce((a,b)=>a+b,0)/a.length:null; };
  const implications=rows.filter(r=>r.implication).length;
  return { cases:rows.length, labelled:rows.filter(r=>r.recall3!==null).length, recall3:mean("recall3"), recall5:mean("recall5"), mrr:mean("reciprocalRank"),
    wrongRegimePromotions:rows.filter(r=>r.wrongRegime).length, implications, unsupportedMissionImplicationRate:implications?rows.filter(r=>r.unsupportedImplication).length/implications:null,
    sourceRoles:{correct:roleResults.filter(Boolean).length,n:roleResults.length}, abstention:{correct:rows.filter(r=>r.abstention===true).length,n:rows.filter(r=>r.abstention!==null).length},
    adversarialImplications:{rejected:rows.reduce((s,r)=>s+r.rejected,0),n:rows.reduce((s,r)=>s+r.mutationChecks,0)}, rows };
}

/**
 * Finding gold set v2: hand-labelled cases with an explicit scenario and topics, so this scores the finding
 * ranker itself rather than the question parser. v1 above stays frozen.
 */
export type FindingGoldCase = {
  id: string; category: string; question: string; scenario: MissionQuestion; topics: string[];
  gold_primary: string[]; gold_acceptable: string[]; forbidden_promotions: string[];
  expected_rung: FindingRung | "none"; abstain?: boolean; notes: string;
};
export function runFindingEvalV2(cases: FindingGoldCase[], exps: Experiment[], finds: Finding[], saffire: SaffireRun[], luci: LuciRun[]) {
  const records = [...exps.map(fromBass), ...saffire.map(fromSaffire), ...luci.map(fromLuci)];
  const rows = cases.map(c => {
    if (c.abstain) {
      // An unanswerable question must be flagged as a gap, and no insight may be attached to it
      const ev = buildEvidence(c.question, exps, finds, saffire, luci);
      const ranked = rankFindings(finds, records, { scenario: c.scenario, topics: c.topics });
      return { id: c.id, category: c.category, abstain: true as const, top5: ranked.slice(0, 5).map(r => r.findingId),
        abstained: signalOf(ev) === "gap" && fireInsight(ranked, finds) === null };
    }
    const query = { scenario: c.scenario, topics: c.topics };
    const ranked = rankFindings(finds, records, query);
    const ids = ranked.map(r => r.findingId);
    const pos = (set: string[]) => { const p = set.map(id => ids.indexOf(id)).filter(i => i >= 0); return p.length ? Math.min(...p) : -1; };
    const best = pos(c.gold_primary), relaxed = pos([...c.gold_primary, ...c.gold_acceptable]);
    const hit = (p: number, k: number) => p >= 0 && p < k;
    // anything ranked above the best primary answer (or in the top 5 when the primary is missing)
    const above = ranked.slice(0, best >= 0 ? best : 5);
    const solidExpected = c.expected_rung === "direct" || c.expected_rung === "analogous";
    const insight = fireInsight(ranked, finds);
    const stability = best >= 0 ? findingRobustness(finds, records, query)[ids[best]]?.top3 ?? 0 : 0;
    return { id: c.id, category: c.category, abstain: false as const, top5: ids.slice(0, 5), bestPrimaryRank: best >= 0 ? best + 1 : null,
      r1: hit(best, 1), r3: hit(best, 3), r5: hit(best, 5), relaxedR3: hit(relaxed, 3), rr: best >= 0 ? 1 / (best + 1) : 0,
      rung: best >= 0 ? ranked[best].rung : null, rungMatch: best >= 0 && ranked[best].rung === c.expected_rung,
      forbidden: above.some(r => c.forbidden_promotions.includes(r.findingId)),
      mechanisticOverSolid: solidExpected && above.some(r => r.rung === "mechanistic"),
      contextOverObservation: solidExpected && above.some(r => r.rung === "context"),
      implication: !!insight, unsupportedImplication: !!insight && !validateInsight(insight, finds), stability };
  });
  const answer = rows.filter(r => !r.abstain) as Extract<typeof rows[number], { abstain: false }>[];
  const abst = rows.filter(r => r.abstain) as Extract<typeof rows[number], { abstain: true }>[];
  const rate = (f: (r: typeof answer[number]) => boolean) => answer.filter(f).length / answer.length;
  const solid = answer.filter(r => { const c = cases.find(c => c.id === r.id)!; return c.expected_rung === "direct" || c.expected_rung === "analogous"; });
  const implications = answer.filter(r => r.implication).length;
  return {
    cases: rows.length, answerable: answer.length, unanswerable: abst.length,
    recall1: rate(r => r.r1), recall3: rate(r => r.r3), recall5: rate(r => r.r5), relaxedRecall3: rate(r => r.relaxedR3),
    mrr: answer.reduce((s, r) => s + r.rr, 0) / answer.length, rungAgreement: rate(r => r.rungMatch),
    forbiddenPromotions: answer.filter(r => r.forbidden).length,
    mechanisticOverSolid: { n: solid.length, count: solid.filter(r => r.mechanisticOverSolid).length },
    contextOverObservation: { n: solid.length, count: solid.filter(r => r.contextOverObservation).length },
    implications, unsupportedImplications: answer.filter(r => r.unsupportedImplication).length,
    abstention: { correct: abst.filter(r => r.abstained).length, n: abst.length },
    meanTop3Stability: answer.reduce((s, r) => s + r.stability, 0) / answer.length,
    byCategory: Object.fromEntries([...new Set(answer.map(r => r.category))].map(cat => {
      const a = answer.filter(r => r.category === cat);
      return [cat, { n: a.length, recall3: a.filter(r => r.r3).length / a.length }];
    })),
    misses: answer.filter(r => !r.r3).map(r => ({ id: r.id, bestPrimaryRank: r.bestPrimaryRank, top5: r.top5 })),
    rows,
  };
}

export function signalOf(ev: ReturnType<typeof buildEvidence>): Signal {
  // a missing named record, a forecast request or a false premise outranks any matching evidence
  if (ev.gapDims.some((d) => d === "record" || d === "prediction" || d === "premise")) return "gap";
  if (ev.items.some((i) => i.rung === "direct")) return "direct";
  if (ev.outside.length) return "gap";
  if (!ev.items.length) return "empty";
  return "partial";
}

export type QuestionResult = { id: string; category: string; q: string; pass: boolean; why: string[]; recall5: number | null; recallAll: number | null; signal: Signal };

export function scoreQuestion(x: EvalQuestion, exps: Experiment[], finds: Finding[], saffire: SaffireRun[], luci: LuciRun[] = []): QuestionResult {
  const ev = buildEvidence(x.q, exps, finds, saffire, luci);
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

export function runEval(qs: EvalQuestion[], exps: Experiment[], finds: Finding[], saffire: SaffireRun[], luci: LuciRun[] = []): EvalReport {
  const rs = qs.map((x) => scoreQuestion(x, exps, finds, saffire, luci));
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
