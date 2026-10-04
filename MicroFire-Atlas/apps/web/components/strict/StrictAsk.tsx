"use client";
import { useEffect, useState } from "react";

type Chip = { field: string; value: string; from: string };
type Check = { key: string; label: string; yours: string; tested: string; statusLabel: string; ok: boolean };
type Answer = {
  error?: string; question: string; notices: string[]; understood: Chip[]; checks: Check[];
  verdict: { state: string; stamp: string; count: string; headline: string; sub: string };
  gaps: { topic: string; text: string; source?: { name: string; url: string } }[] | { topic: string; text: string; source?: { name: string; url: string } } | null;
  closest: Record<string, unknown>[] | null;
  nearest: { label: string; changes: string; params: Record<string, string> } | null;
};

const TRY = [
  "Will it burn on a Moon base at 34% oxygen?",
  "Will a 1 mm acrylic sheet burn on the ISS in Earth-normal air?",
  "Will Nomex burn on Mars?",
  "1 mm acrylic at 16.8% oxygen and 21 cm/s",
  "What is the safest material for Mars?",
];

export function StrictAsk() {
  const [q, setQ] = useState(TRY[0]);
  const [a, setA] = useState<Answer | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(question: string, extra: Record<string, string> = {}) {
    setBusy(true);
    const sp = new URLSearchParams({ q: question, ...extra });
    const r = await fetch(`/api/strict?${sp}`);
    setA((await r.json()) as Answer);
    setBusy(false);
  }
  useEffect(() => { void run(TRY[0]); }, []);

  const gaps = !a?.gaps ? [] : Array.isArray(a.gaps) ? a.gaps : [a.gaps];
  const tone = a?.verdict.state === "no-data" || a?.verdict.state === "unclear" ? "var(--muted, #888)" : "var(--signal, #ff7a1a)";

  return (
    <div>
      <div role="search" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label htmlFor="sq" className="sr-only">Question about a cabin fire</label>
        <input id="sq" value={q} maxLength={500} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run(q)}
          style={{ flex: "1 1 320px", padding: "12px 14px", borderRadius: 10, border: "1px solid currentColor", background: "transparent", color: "inherit" }} />
        <button onClick={() => run(q)} disabled={busy} className="btn" style={{ padding: "12px 20px", fontWeight: 600 }}>{busy ? "Checking…" : "Ask"}</button>
      </div>
      <p style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {TRY.map((t) => <button key={t} onClick={() => { setQ(t); void run(t); }} style={{ fontSize: 13, textDecoration: "underline", background: "none", color: "inherit" }}>{t}</button>)}
      </p>

      {a?.error && <p role="alert" style={{ marginTop: 20 }}>{a.error}</p>}
      {a && !a.error && (
        <div aria-live="polite" style={{ marginTop: 24 }}>
          <p className="text-muted text-sm">Read as</p>
          <p style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {a.understood.map((c) => (
              <span key={c.field} title={`from ${c.from}`} style={{ padding: "3px 10px", borderRadius: 999, border: c.from === "default" ? "1px dashed currentColor" : "1px solid currentColor", fontSize: 13 }}>
                {c.field}: {c.value}
              </span>
            ))}
          </p>
          {a.notices.map((n) => <p key={n} className="text-muted text-sm">Note: {n}</p>)}

          <h2 className="display" style={{ fontSize: 44, color: tone, marginTop: 20 }}>{a.verdict.stamp}</h2>
          <p className="text-muted">{a.verdict.count}</p>
          <p style={{ fontSize: 20, marginTop: 8 }}>{a.verdict.headline}</p>
          <p className="text-muted" style={{ maxWidth: "70ch" }}>{a.verdict.sub}</p>

          {a.checks?.length > 0 && (
            <table style={{ marginTop: 20, width: "100%", maxWidth: 720, borderCollapse: "collapse" }}>
              <caption className="text-muted text-sm" style={{ textAlign: "left" }}>Your cabin next to what NASA's tests recorded</caption>
              <tbody>
                {a.checks.map((c) => (
                  <tr key={c.key} style={{ borderTop: "1px solid rgba(128,128,128,.3)" }}>
                    <th scope="row" style={{ textAlign: "left", padding: 6 }}>{c.label}</th>
                    <td style={{ padding: 6 }}>{c.yours}</td><td style={{ padding: 6 }}>{c.tested}</td>
                    <td style={{ padding: 6, fontWeight: 600 }}>{c.ok ? "✓ " : "✕ "}{c.statusLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {gaps.length > 0 && <h3 className="display" style={{ fontSize: 20, marginTop: 24 }}>What is missing, and where it may exist</h3>}
          {gaps.map((g) => (
            <p key={g.topic + g.text} style={{ marginTop: 8, maxWidth: "75ch" }}>
              <strong>{g.topic}.</strong> {g.text}{" "}
              {g.source && <a href={g.source.url} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>{g.source.name}</a>}
            </p>
          ))}

          {a.closest && a.closest.length > 0 && (
            <>
              <h3 className="display" style={{ fontSize: 20, marginTop: 24 }}>Closest tests (not matches)</h3>
              <ul style={{ marginTop: 6 }}>
                {a.closest.map((c, i) => (
                  <li key={i} className="text-muted text-sm">
                    {Object.entries(c).filter(([, v]) => typeof v === "string" || typeof v === "number").map(([k, v]) => `${k}: ${v}`).join(" · ")}
                  </li>
                ))}
              </ul>
            </>
          )}

          {a.nearest && (
            <button onClick={() => run(q, a.nearest!.params)} className="btn" style={{ marginTop: 20, padding: "10px 18px", fontWeight: 600 }}>
              {a.nearest.label}
              <span className="text-muted text-sm" style={{ display: "block", fontWeight: 400 }}>{a.nearest.changes}</span>
            </button>
          )}
        </div>
      )}
      <p className="text-muted text-sm" style={{ marginTop: 32, maxWidth: "75ch" }}>
        This page uses fixed rules, not the trained model: a test counts only if its own row recorded every condition you gave. It is not a safety rating.
        Method and source: NASA/TM-20210011385 and the FlameScope evidence core (Apache-2.0), see /strict/LICENSE.
      </p>
    </div>
  );
}
