"use client";

import { useMemo, useState } from "react";
import { predictOutcome, type Model } from "@/lib/model";
import type { Report } from "@/app/predict/page";

const pct = (v: number) => `${Math.round(v * 100)}%`;
const LABELS: Record<string, string> = {
  baseline_series_prior: "No-skill baseline",
  logistic_oxygen_only: "Oxygen only",
  logistic_oxygen_flow_direction_SHIPPED: "Oxygen + flow + direction (used here)",
  logistic_all_features_with_material: "All features incl. material",
  logistic_no_material_leave_one_material_out: "Hide a whole material (stress test)",
  nested_selection_honest: "Honest score: feature choice made inside each fold (fair figure)",
};
const card = { background: "var(--panel)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, padding: 16 } as const;

export function PredictClient({ model, report }: { model: Model; report: Report }) {
  const [o2, setO2] = useState(21);
  const [flow, setFlow] = useState(10);
  const [direction, setDirection] = useState<"concurrent" | "opposed">("concurrent");
  const r = useMemo(() => predictOutcome(model, { o2, flow, direction }), [model, o2, flow, direction]);
  const outside = !r.inRange.o2 || !r.inRange.flow;

  return (
    <div className="mt-8 grid gap-8">
      <section aria-labelledby="calc" style={card}>
        <h2 id="calc" className="display text-2xl">Calculator</h2>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div className="grid gap-4">
            <label className="grid gap-1">Oxygen: <b>{o2.toFixed(1)}%</b>
              <input type="range" min={14} max={35} step={0.1} value={o2} onChange={(e) => setO2(+e.target.value)} /></label>
            <label className="grid gap-1">Airflow speed: <b>{flow.toFixed(1)} cm/s</b>
              <input type="range" min={1} max={40} step={0.5} value={flow} onChange={(e) => setFlow(+e.target.value)} /></label>
            <label className="grid gap-1">Flow direction
              <select value={direction} onChange={(e) => setDirection(e.target.value as "concurrent" | "opposed")} style={{ background: "transparent", border: "1px solid rgba(255,255,255,.2)", borderRadius: 8, padding: 6 }}>
                <option value="concurrent">Concurrent (with the flame spread)</option>
                <option value="opposed">Opposed (against it)</option>
              </select></label>
          </div>
          <div aria-live="polite">
            <p className="text-muted text-sm">Estimated chance the flame is sustained</p>
            <p className="display text-5xl mt-1">{pct(r.p)}</p>
            <p className="text-muted text-sm mt-1">90% bootstrap interval: {pct(r.lo)} to {pct(r.hi)}</p>
            <div role="img" aria-label={`Interval ${pct(r.lo)} to ${pct(r.hi)}, estimate ${pct(r.p)}`} style={{ position: "relative", height: 10, borderRadius: 5, background: "rgba(255,255,255,.1)", marginTop: 12 }}>
              <div style={{ position: "absolute", left: pct(r.lo), width: `calc(${pct(r.hi)} - ${pct(r.lo)})`, top: 0, bottom: 0, background: "var(--flame)", opacity: 0.35, borderRadius: 5 }} />
              <div style={{ position: "absolute", left: pct(r.p), top: -3, width: 4, height: 16, background: "var(--flame)" }} />
            </div>
            {outside && <p role="alert" className="mt-3 text-sm" style={{ color: "var(--flame)" }}>
              Outside the tested range ({model.ranges.o2_pct[0]}–{model.ranges.o2_pct[1]}% O₂, {model.ranges.flow_cm_s[0]}–{Math.round(model.ranges.flow_cm_s[1])} cm/s). Treat this number as an extrapolation, not a result.</p>}
            <p className="mt-3 text-sm text-muted">This is an estimate from {report.n_rows} tests, not a safety certification. It does not know your material.</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="near">
        <h2 id="near" className="display text-2xl">The five closest real NASA tests</h2>
        <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm">
          <thead className="text-muted"><tr><th>Test</th><th>Material</th><th>O₂ %</th><th>Flow cm/s</th><th>Direction</th><th>Result</th></tr></thead>
          <tbody>{r.nearest.map((p) => <tr key={p.id} className="border-t" style={{ borderColor: "rgba(255,255,255,.1)" }}>
            <td>{p.id}</td><td>{p.material}</td><td>{p.o2}</td><td>{p.flow}</td><td>{p.direction ?? "not stated"}</td><td>{p.sustained ? "Kept burning" : "Went out / no ignition"}</td></tr>)}</tbody>
        </table></div>
      </section>

      <section aria-labelledby="eval">
        <h2 id="eval" className="display text-2xl">How good is it? ({report.cv})</h2>
        <p className="mt-2 text-muted max-w-[78ch]">Each score comes from tests the model never saw: a whole flight or material group is hidden, then predicted. {report.n_sustained} rows sustained, {report.n_not_sustained} not, in {report.n_series} series. Lower Brier is better.</p>
        <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm">
          <thead className="text-muted"><tr><th>Model</th><th>Accuracy</th><th>Balanced acc.</th><th>Brier</th><th>Log loss</th></tr></thead>
          <tbody>{Object.entries(report.models).map(([k, v]) => <tr key={k} className="border-t" style={{ borderColor: "rgba(255,255,255,.1)" }}>
            <td>{LABELS[k] ?? k}</td><td>{v.accuracy}</td><td>{v.balanced_accuracy}</td><td>{v.brier}</td><td>{v.log_loss}</td></tr>)}</tbody>
        </table></div>
      </section>

      <section aria-labelledby="rank">
        <h2 id="rank" className="display text-2xl">Material ranking (observed, not predicted)</h2>
        <p className="mt-2 text-muted max-w-[78ch]">Share of each material&apos;s labelled tests where the flame was sustained, with a 95% Wilson interval. Different materials were tested at different oxygen and flow, so this is a summary of the evidence, not a fair head-to-head.</p>
        <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm">
          <thead className="text-muted"><tr><th>Material</th><th>Tests</th><th>Sustained</th><th>Rate (95% CI)</th><th>Lowest O₂ that sustained</th></tr></thead>
          <tbody>{report.ranking.map((x) => <tr key={x.material} className="border-t" style={{ borderColor: "rgba(255,255,255,.1)" }}>
            <td>{x.material}</td><td>{x.n_tests}</td><td>{x.sustained}</td><td>{pct(x.sustained_rate)} ({pct(x.rate_ci95[0] ?? 0)}–{pct(x.rate_ci95[1] ?? 0)})</td><td>{x.lowest_o2_sustained ?? "none observed"}</td></tr>)}</tbody>
        </table></div>
      </section>

      <section aria-labelledby="spread">
        <h2 id="spread" className="display text-2xl">Measured spread rates (reported, not modelled)</h2>
        <p className="mt-2 text-muted max-w-[78ch]">{report.spread_rate.note} All are Saffire fabric runs, so no trend with oxygen, flow or material can be claimed from them.</p>
        <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm">
          <thead className="text-muted"><tr><th>Run</th><th>Material</th><th>O₂ %</th><th>Flow cm/s</th><th>Direction</th><th>Spread rate mm/s</th></tr></thead>
          <tbody>{report.spread_rate.runs.map((x) => <tr key={x.id} className="border-t" style={{ borderColor: "rgba(255,255,255,.1)" }}>
            <td>{x.id}</td><td>{x.material}</td><td>{x.o2_pct ?? "not stated"}</td><td>{x.flow_cm_s ?? "not stated"}</td><td>{x.direction ?? "not stated"}</td><td>{x.spread_rate_mm_s}</td></tr>)}</tbody>
        </table></div>
      </section>

      <section aria-labelledby="limits" style={card}>
        <h2 id="limits" className="display text-2xl">Limits of this model</h2>
        <ul className="mt-3 grid gap-2 text-muted list-disc pl-5">{report.caveats.map((c) => <li key={c}>{c}</li>)}</ul>
      </section>
    </div>
  );
}
