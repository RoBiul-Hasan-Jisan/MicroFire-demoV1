"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CheckedClaim, ClaimType, EvidenceItem, EvidenceRung } from "@/lib/ask-core";
import { buildEvidence } from "@/lib/ask-core";
import { experiments, findings, saffireRuns } from "@/lib/data";
import { FAMILIES } from "@/lib/ontology";
import { useExplorer } from "@/components/guide/EmberGuide";
import styles from "./AskPanel.module.css";

type Result = {
  mode?: "ai" | "evidence-only";
  provider?: string;
  cached?: boolean;
  aiStatus?: "coming-soon";
  reason?: string;
  summary?: string;
  claims?: CheckedClaim[];
  evidence?: EvidenceItem[];
  outside?: string[];
  error?: string;
};

const SUGGESTED = [
  "What changed between B16, B20 and B19?",
  "What evidence exists for PMMA at 34% oxygen and 56.5 kPa on the Moon?",
  "How big were the Saffire fires, and what about the smoke?",
  "What does NASA report about flames at very low airflow?",
  "Would a fabric fire behave the same on the Moon?",
  "What did the FLEX droplet tests find about the oxygen limit?",
];

const RUNG: Record<EvidenceRung, { label: string; note: string }> = {
  direct: { label: "Direct", note: "matches every condition asked" },
  analogous: { label: "Analogous", note: "solid fuels, differing in named ways" },
  mechanistic: { label: "Mechanistic", note: "droplets or gas flames: mechanisms only" },
  context: { label: "Context", note: "background, not results" },
};
const RUNG_ORDER: EvidenceRung[] = ["direct", "analogous", "mechanistic", "context"];

const TYPE_LABEL: Record<ClaimType, { label: string; cls: string }> = {
  OBSERVED: { label: "Observed", cls: "border-flame/70 text-flame" },
  DERIVED: { label: "Derived", cls: "border-signal/70 text-signal" },
  INTERPRETATION: { label: "Interpretation", cls: "border-rule-strong text-muted" },
  DATA_GAP: { label: "Data gap", cls: "border-quench/70 text-quench" },
};

export function AskPanel({ onAnswered, initialQuestion }: { onAnswered?: () => void; initialQuestion?: string } = {}) {
  const { discover } = useExplorer();
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [focus, setFocus] = useState<string | null>(null);

  async function ask(q: string) {
    setQuestion(q);
    setBusy(true);
    setFocus(null);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const answer = await res.json() as Result;
      setResult(answer);
      if (!answer.error && answer.evidence?.length) { discover("askpix"); onAnswered?.(); }
    } catch {
      const local = buildEvidence(q, experiments, findings, saffireRuns);
      setResult({ mode: "evidence-only", reason: "Offline evidence notebook: these saved NASA records match your question. No AI answer was generated.", evidence: local.items, outside: local.outside });
      if (local.items.length) { discover("askpix"); onAnswered?.(); }
    } finally {
      setBusy(false);
    }
  }

  // A question in the URL (from the judges' tour) is asked once on arrival.
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current || !initialQuestion || initialQuestion.trim().length < 3) return;
    asked.current = true;
    void ask(initialQuestion.trim().slice(0, 400));
  }); // runs after every render, guarded by the ref so the question is asked once

  const evidence = result?.evidence ?? [];
  const byKey = new Map(evidence.map((i) => [i.key, i]));
  const tests = evidence.filter((i) => i.kind === "test");
  const familyCounts = [...tests.reduce((m, i) => m.set(i.family ?? "bass2", (m.get(i.family ?? "bass2") ?? 0) + 1), new Map<string, number>())];
  const findingCount = evidence.filter((i) => i.kind === "finding" && i.rung !== "mechanistic").length;
  const mechanistic = evidence.filter((i) => i.rung === "mechanistic").length;
  const direct = tests.filter((i) => i.rung === "direct").length;

  return (
    <div className="question-workspace grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <div>
        <form data-guide="ask-box" className="question-console"
          onSubmit={(e) => {
            e.preventDefault();
            if (question.trim().length >= 3) ask(question.trim());
          }}
        >
          <label htmlFor="q" className="display text-2xl">
            What are you curious about?
          </label>
          <p className="text-sm text-muted mt-2 mb-4">Ask about a test, a material, or a mystery in space.</p>
          <textarea
            id="q"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={400}
            rows={4}
            className="mt-1 w-full bg-panel border border-rule rounded-sm px-3 py-2.5 text-[16px]"
            placeholder="e.g. What happened to thin PMMA at 16.5% oxygen?"
          />
          <div className="mt-3 flex items-center gap-4">
            <button
              type="submit"
              disabled={busy || question.trim().length < 3}
              className="story-cta disabled:opacity-50"
            >
              {busy ? "Searching the evidence…" : "Find the evidence"}
            </button>
            <span className="text-xs text-faint">{question.length}/400</span>
          </div>
        </form>

        <div className="mt-6">
          <p className="text-sm text-muted">Try one of these</p>
          <ul className="question-starters mt-3">
            {SUGGESTED.map((s) => (
              <li key={s}>
                <button onClick={() => ask(s)} disabled={busy} className="text-sm text-left px-3 py-1.5 border border-rule rounded-sm hover:border-rule-strong">
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div aria-live="polite" aria-busy={busy} className="answer-space mt-10">
          {result?.error && <p className="text-flame">{result.error}</p>}
          {result && !result.error && (
            <>
              <section className={styles.found} aria-label="Evidence found">
                <p className={styles.foundKicker}>Evidence found, before any AI writing</p>
                <ul className={styles.counts}>
                  <li><strong>{tests.length}</strong> NASA test record{tests.length === 1 ? "" : "s"}
                    <span className={styles.chips}>{familyCounts.map(([f, n]) => <span key={f} className={styles.fam} data-family={f}>{n} {FAMILIES[f as keyof typeof FAMILIES]?.name ?? f}</span>)}</span>
                  </li>
                  <li><strong>{findingCount}</strong> verified NASA finding{findingCount === 1 ? "" : "s"}</li>
                  {mechanistic > 0 && <li><strong>{mechanistic}</strong> mechanistic (droplet or gas flame)</li>}
                  <li><strong>{direct}</strong> direct match{direct === 1 ? "" : "es"}{tests.length > 0 && direct === 0 ? ": nearest evidence only" : ""}</li>
                </ul>
                {result.outside && result.outside.length > 0 && (
                  <div className={styles.gaps}>
                    <p>What this evidence does not cover</p>
                    <ul>{result.outside.map((o) => <li key={o}>{o}</li>)}</ul>
                  </div>
                )}
              </section>
              {result.mode === "ai" ? (
                <section>
                  <h2 className="display text-xl">Answer</h2>
                  <p className="mt-3 text-[17px]">{result.summary}</p>
                  <ol className={styles.claims}>
                    {result.claims?.map((c, i) => (
                      <li key={i} className={styles.claim} data-verified={c.verified}>
                        <div className={styles.claimHead}>
                          <span className={`inline-block text-xs border rounded-sm px-1.5 py-0.5 ${TYPE_LABEL[c.type].cls}`}>{TYPE_LABEL[c.type].label}</span>
                          <span className={styles.check}>{c.verified ? "✓ checked against the evidence" : "⚠ not verified"}</span>
                        </div>
                        <p className="mt-2 text-[16px]">{c.text}</p>
                        {c.cites.length > 0 && (
                          <p className={styles.citeRow}>
                            {c.cites.map((k) => (
                              <button key={k} onClick={() => setFocus(focus === `${i}:${k}` ? null : `${i}:${k}`)} aria-expanded={focus === `${i}:${k}`} className={styles.citeChip} data-family={byKey.get(k)?.family} data-quest="cite-chip">
                                {byKey.get(k)?.title ?? k}
                              </button>
                            ))}
                          </p>
                        )}
                        {c.cites.map((k) => focus === `${i}:${k}` && byKey.get(k) && (
                          <div key={k} className={styles.citeDetail}>
                            <p className={styles.citeMeta}>
                              {FAMILIES[byKey.get(k)!.family ?? "context"].name} · {RUNG[byKey.get(k)!.rung ?? "context"].label}: {RUNG[byKey.get(k)!.rung ?? "context"].note}
                            </p>
                            <p>{byKey.get(k)!.text}</p>
                            <Link href={byKey.get(k)!.href} className="link text-sm">{byKey.get(k)!.kind === "test" ? "Open the full record" : byKey.get(k)!.kind === "model" ? "See how the model works" : "See all sources"}</Link>
                          </div>
                        ))}
                        {!c.verified && (
                          <p className="mt-2 text-sm text-flame">Not verified: {c.issues.join("; ")}. Treat this claim with caution.</p>
                        )}
                      </li>
                    ))}
                  </ol>
                  <p className="mt-6 text-xs text-faint">
                    Written by a language model{result.provider ? ` (${result.provider})` : ""} from the evidence listed here only{result.cached ? ", served from the answer cache" : ""}. Every
                    citation, number and unit was checked, and causal, safety and prediction wording is flagged.
                  </p>
                </section>
              ) : (
                result.aiStatus === "coming-soon" ? (
                  <AiComingSoon />
                ) : (
                  <section>
                    <h2 className="display text-xl">Matching evidence</h2>
                    <p className="mt-2 text-muted">{result.reason}</p>
                  </section>
                )
              )}
            </>
          )}
        </div>
      </div>

      <aside data-guide="evidence" aria-label="Evidence used" className="evidence-drawer lg:sticky lg:top-20 lg:self-start">
        <p className="text-signal text-sm">Your source trail</p>
        <h2 className="display text-2xl mt-2">The evidence notebook</h2>
        <p className="text-xs text-faint mt-1">
          These NASA records are selected before an answer is written. Follow a test link to read the original record.
        </p>
        {evidence.length === 0 ? (
          <div className="notebook-empty"><span aria-hidden="true">✧</span><h3 className="display text-xl">Your clues will appear here.</h3><p>Ask a question, read the answer, then check the NASA records that support it.</p><ol><li>Ask something you wonder about</li><li>Look for the evidence labels</li><li>Open a source and check it</li></ol></div>
        ) : (
          <div className="mt-4 space-y-5">
            {RUNG_ORDER.filter((r) => evidence.some((i) => (i.rung ?? "context") === r)).map((r) => (
              <section key={r}>
                <h3 className={styles.rungHead}>{RUNG[r].label} <span>{RUNG[r].note}</span></h3>
                <ul className="mt-2 space-y-3">
                  {evidence.filter((i) => (i.rung ?? "context") === r).map((i) => (
                    <li key={i.key} id={i.key} className={`border rounded-sm p-3 text-sm ${focus?.endsWith(`:${i.key}`) ? "border-signal bg-panel" : "border-rule"}`}>
                      <p className="font-medium flex flex-wrap items-center gap-2">
                        {i.family && <span className={styles.fam} data-family={i.family}>{FAMILIES[i.family].name}</span>}
                        {i.kind === "test" || i.kind === "model" ? <Link href={i.href} className="link">{i.title}</Link> : i.title}
                      </p>
                      <p className="mt-1 text-muted">{i.text}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

/** Shown until an AI key is configured: the evidence step works today, the writing and checking steps are coming. */
function AiComingSoon() {
  const steps: [string, string, boolean][] = [
    ["Find the evidence", "NASA records chosen by rules, not by AI", true],
    ["Write a short answer", "only from the evidence found", false],
    ["Check every claim", "citations, numbers, units, causes and predictions", false],
  ];
  return (
    <section className={styles.soon} aria-labelledby="ai-soon">
      <div className={styles.soonHead}>
        {/* eslint-disable-next-line @next/next/no-img-element -- next/image writes inline styles, which the strict CSP blocks */}
        <img src="/art/pix.webp" alt="" width={96} height={80} className={styles.soonPix} />
        <div>
          <p className={styles.soonKicker}>PIX is getting its AI brain</p>
          <h2 id="ai-soon" className="display text-2xl">AI synthesis is coming soon</h2>
          <p className="mt-2 text-[15px] text-muted max-w-[52ch]">
            Soon PIX will write a short answer from the evidence found, and every claim will be checked against NASA&apos;s records before you see it.
            The evidence is ready now.
          </p>
        </div>
      </div>
      <ol className={styles.steps}>
        {steps.map(([t, n, live], i) => (
          <li key={t} data-live={live}>
            <span className={styles.stepDot}>{live ? "✓" : i + 1}</span>
            <strong>{t}</strong>
            <small>{n}</small>
            <em>{live ? "Live now" : "Coming soon"}</em>
          </li>
        ))}
      </ol>
      <div className={styles.ghosts} aria-hidden="true">
        {["Observed", "Derived", "Data gap"].map((t) => (
          <div key={t} className={styles.ghost}><span>{t}</span><i /><i /></div>
        ))}
      </div>
    </section>
  );
}
