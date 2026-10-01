"use client";

import Link from "next/link";
import { useState } from "react";
import type { CheckedClaim, ClaimType, EvidenceItem } from "@/lib/ask-core";

type Result = {
  mode?: "ai" | "evidence-only";
  reason?: string;
  summary?: string;
  claims?: CheckedClaim[];
  evidence?: EvidenceItem[];
  outside?: string[];
  error?: string;
};

const SUGGESTED = [
  "What changed between B16, B20 and B19?",
  "Show PMMA tests near 16.5% oxygen and 10 cm/s",
  "What does NASA report about flames at very low airflow?",
  "Would a fabric fire behave the same on the Moon?",
  "Where did fabric flames quench as oxygen dropped?",
];

const TYPE_LABEL: Record<ClaimType, { label: string; cls: string }> = {
  OBSERVED: { label: "Observed", cls: "border-flame/70 text-flame" },
  DERIVED: { label: "Derived", cls: "border-signal/70 text-signal" },
  INTERPRETATION: { label: "Interpretation", cls: "border-rule-strong text-muted" },
  DATA_GAP: { label: "Data gap", cls: "border-quench/70 text-quench" },
};

export function AskPanel() {
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
      setResult(await res.json());
    } catch {
      setResult({ error: "The question could not be sent. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  const evidence = result?.evidence ?? [];
  const byKey = new Map(evidence.map((i) => [i.key, i]));

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (question.trim().length >= 3) ask(question.trim());
          }}
        >
          <label htmlFor="q" className="text-sm text-muted">
            Your question
          </label>
          <textarea
            id="q"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={400}
            rows={3}
            className="mt-1 w-full bg-panel border border-rule rounded-sm px-3 py-2.5 text-[16px]"
            placeholder="e.g. What happened to thin PMMA at 16.5% oxygen?"
          />
          <div className="mt-3 flex items-center gap-4">
            <button
              type="submit"
              disabled={busy || question.trim().length < 3}
              className="bg-signal text-void font-semibold px-5 py-2.5 rounded-sm disabled:opacity-50"
            >
              {busy ? "Searching the evidence…" : "Ask"}
            </button>
            <span className="text-xs text-faint">{question.length}/400</span>
          </div>
        </form>

        <div className="mt-6">
          <p className="text-sm text-muted">Try one of these</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {SUGGESTED.map((s) => (
              <li key={s}>
                <button onClick={() => ask(s)} disabled={busy} className="text-sm text-left px-3 py-1.5 border border-rule rounded-sm hover:border-rule-strong">
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div aria-live="polite" className="mt-10">
          {result?.error && <p className="text-flame">{result.error}</p>}
          {result && !result.error && (
            <>
              {result.outside && result.outside.length > 0 && (
                <div className="border border-flame/60 rounded-sm p-4 mb-6 text-[15px]">
                  <p className="font-semibold text-flame">Direct evidence under these exact conditions is limited</p>
                  <ul className="mt-1 text-muted">
                    {result.outside.map((o) => (
                      <li key={o}>{o}</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.mode === "ai" ? (
                <section>
                  <h2 className="display text-xl">Answer</h2>
                  <p className="mt-3 text-[17px]">{result.summary}</p>
                  <ol className="mt-6 space-y-4">
                    {result.claims?.map((c, i) => (
                      <li key={i} className={`border-l-2 pl-4 ${c.verified ? "border-rule-strong" : "border-flame"}`}>
                        <span className={`inline-block text-xs border rounded-sm px-1.5 py-0.5 ${TYPE_LABEL[c.type].cls}`}>{TYPE_LABEL[c.type].label}</span>
                        <p className="mt-1.5 text-[16px]">{c.text}</p>
                        <p className="mt-1 flex flex-wrap gap-2 text-sm">
                          {c.cites.map((k) => (
                            <button key={k} onClick={() => setFocus(k)} className="link">
                              {byKey.get(k)?.title ?? k}
                            </button>
                          ))}
                        </p>
                        {!c.verified && (
                          <p className="mt-1 text-sm text-flame">Not verified: {c.issues.join("; ")}. Treat this claim with caution.</p>
                        )}
                      </li>
                    ))}
                  </ol>
                  <p className="mt-6 text-xs text-faint">
                    Written by a language model from the evidence on the right only. Every citation and number was checked
                    against that evidence; unverified claims are marked.
                  </p>
                </section>
              ) : (
                <section>
                  <h2 className="display text-xl">Matching evidence</h2>
                  <p className="mt-2 text-muted">{result.reason}</p>
                </section>
              )}
            </>
          )}
        </div>
      </div>

      <aside aria-label="Evidence used" className="lg:sticky lg:top-6 lg:self-start">
        <h2 className="font-semibold">Evidence package</h2>
        <p className="text-xs text-faint mt-1">
          Retrieved by deterministic search before any AI runs. Only these items can be cited.
        </p>
        {evidence.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Ask a question to see the NASA tests and findings it matches.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {evidence.map((i) => (
              <li
                key={i.key}
                id={i.key}
                className={`border rounded-sm p-3 text-sm ${focus === i.key ? "border-signal bg-panel" : "border-rule"}`}
              >
                <p className="font-medium">
                  {i.kind === "test" ? (
                    <Link href={i.href} className="link">
                      {i.title}
                    </Link>
                  ) : (
                    i.title
                  )}
                </p>
                <p className="mt-1 text-muted">{i.text}</p>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
