"use client";

import { useState } from "react";
import css from "./Insight.module.css";

export type LocData = {
  o2_tested_range: [number, number]; flow_tested_range: [number, number]; definition: string; limits: string[];
  curves: Record<"concurrent" | "opposed", { flow: number; o2_p05: number | null; o2_p50: number | null; o2_p95: number | null; inside_tested_o2: boolean }[]>;
  points: { id: string; o2: number; flow: number; direction: string; sustained: number; material: string }[];
  observed_by_flow_bin: { flow_from: number; flow_to: number; n: number; lowest_o2_that_burned: number | null; highest_o2_that_went_out: number | null; overlap: boolean }[];
};
export type PressureData = {
  n_with_pressure: number; n_usable_total: number; n_series: number; distinct_pressures_kpa: number[];
  variants: Record<string, { accuracy: number; brier: number }>; verdict_text: string; caveats: string[];
};

const W = 640, H = 340, L = 50, R = 20, T = 14, B = 44;
const NAMES: Record<string, string> = { no_skill_baseline: "No-skill baseline", oxygen_only: "Oxygen only", oxygen_flow_direction: "Oxygen + airflow + direction", oxygen_flow_direction_plus_pressure: "…plus pressure", partial_pressure_o2_flow_direction: "Partial pressure of oxygen + airflow + direction" };

export function LocView({ loc, pressure }: { loc: LocData; pressure: PressureData }) {
  const [dir, setDir] = useState<"concurrent" | "opposed">("concurrent");
  const [lo, hi] = loc.o2_tested_range;
  const yMin = 12, yMax = 34, xMax = 26;
  const x = (f: number) => L + ((Math.log(f) - Math.log(1.5)) / (Math.log(xMax) - Math.log(1.5))) * (W - L - R);
  const y = (o: number) => T + (1 - (o - yMin) / (yMax - yMin)) * (H - T - B);
  const rows = loc.curves[dir].filter((r) => r.o2_p50 != null);
  const band = [...rows.map((r) => `${x(r.flow)},${y(Math.min(yMax, r.o2_p95 ?? 0))}`), ...[...rows].reverse().map((r) => `${x(r.flow)},${y(Math.max(yMin, r.o2_p05 ?? 0))}`)].join(" ");
  const line = rows.map((r) => `${x(r.flow)},${y(r.o2_p50 ?? 0)}`).join(" ");
  const pts = loc.points.filter((p) => p.direction === dir);

  return (
    <div className={css.page}>
      <section className={css.card} aria-labelledby="curve">
        <h2 id="curve" className="display text-xl">Oxygen needed at each airflow</h2>
        <p className="text-sm text-muted mt-2 max-w-[78ch]">{loc.definition}</p>
        <div className={`${css.tabs} mt-3`} role="group" aria-label="Flow direction">
          {(["concurrent", "opposed"] as const).map((d) => <button key={d} className={css.tab} aria-pressed={dir === d} onClick={() => setDir(d)}>{d === "concurrent" ? "Concurrent flow" : "Opposed flow"}</button>)}
        </div>
        <div className={`${css.scroll} mt-3`}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, minWidth: 420 }} role="img" aria-label="Oxygen percentage the model needs for a fifty percent chance of a sustained flame, against airflow, with a ninety percent band and the real test points">
            <rect x={L} y={T} width={W - L - R} height={y(hi) - T} className={css.hatch} />
            <rect x={L} y={y(lo)} width={W - L - R} height={H - B - y(lo)} className={css.hatch} />
            {[14, 18, 22, 26, 30, 34].map((o) => <g key={o}><line x1={L} x2={W - R} y1={y(o)} y2={y(o)} stroke="rgba(255,255,255,.12)" /><text x={L - 6} y={y(o) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{o}</text></g>)}
            {[2, 3, 5, 10, 20].map((f) => <text key={f} x={x(f)} y={H - B + 16} textAnchor="middle" fontSize="11" fill="var(--muted)">{f}</text>)}
            <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" fontSize="12" fill="var(--muted)">Airflow, cm/s (log scale). Hatched = outside the oxygen range tested.</text>
            <text x={12} y={(T + H - B) / 2} fontSize="12" fill="var(--muted)" transform={`rotate(-90 12 ${(T + H - B) / 2})`} textAnchor="middle">Oxygen, vol %</text>
            <polygon points={band} fill="var(--signal)" opacity="0.2" />
            <polyline points={line} fill="none" stroke="var(--signal)" strokeWidth="2.5" />
            {pts.map((p) => <circle key={p.id} cx={x(Math.max(p.flow, 1.5))} cy={y(p.o2)} r={4.5} fill={p.sustained ? "var(--flame)" : "none"} stroke={p.sustained ? "var(--flame)" : "var(--muted)"} strokeWidth="1.6"><title>{`${p.material}: ${p.o2} % O₂, ${p.flow} cm/s, ${p.sustained ? "kept burning" : "went out or did not ignite"}`}</title></circle>)}
          </svg>
        </div>
        <div className={`${css.legend} mt-2`}>
          <span><i className={css.sw} style={{ background: "var(--signal)" }} />Model: 50 % chance of a sustained flame (band = 90 %)</span>
          <span><i className={css.sw} style={{ background: "var(--flame)" }} />● Real test: kept burning</span>
          <span><i className={css.sw} style={{ border: "2px solid var(--muted)", background: "transparent" }} />○ Real test: went out or did not ignite</span>
        </div>
        <p className="text-sm mt-3">Above the line a flame is more likely than not to be sustained; below it, less likely. At the lowest tested airflow (2 cm/s) the model needs about {Math.round(loc.curves[dir][0].o2_p50 ?? 0)} % oxygen; at 20 cm/s about {Math.round(loc.curves[dir].find((r) => r.flow === 20)?.o2_p50 ?? 0)} %.</p>
      </section>

      <section className={css.card} aria-labelledby="raw">
        <h2 id="raw" className="display text-xl">What the raw tests say, with no model</h2>
        <table className={`${css.tbl} mt-3`}>
          <thead><tr><th>Airflow bin</th><th>Tests</th><th>Lowest O₂ that burned</th><th>Highest O₂ that went out</th><th>Overlap?</th></tr></thead>
          <tbody>{loc.observed_by_flow_bin.map((b) => <tr key={b.flow_from}><td>{b.flow_from}–{b.flow_to} cm/s</td><td className={css.mono}>{b.n}</td><td className={css.mono}>{b.lowest_o2_that_burned ?? "none burned"}</td><td className={css.mono}>{b.highest_o2_that_went_out ?? "none went out"}</td><td>{b.overlap ? "yes: mixed outcomes at the same oxygen (material and other factors differ)" : "no"}</td></tr>)}</tbody>
        </table>
      </section>

      <section className={css.card} aria-labelledby="lim">
        <h2 id="lim" className="display text-xl">Limits of this curve</h2>
        <ul className="mt-3 grid gap-2 text-sm text-muted list-disc pl-5">{loc.limits.map((l) => <li key={l}>{l}</li>)}</ul>
      </section>

      <section className={css.card} aria-labelledby="press">
        <h2 id="press" className="display text-xl">Does pressure matter? The data cannot say yet</h2>
        <p className="text-sm text-muted mt-2 max-w-[78ch]">The exploration atmospheres differ mainly in pressure, but pressure is a model input only if the tests state it. It is stated for {pressure.n_with_pressure} of {pressure.n_usable_total} labelled tests (never guessed). We compared models on those rows:</p>
        <table className={`${css.tbl} mt-3`}>
          <thead><tr><th>Model on the {pressure.n_with_pressure} rows with pressure</th><th>Accuracy</th><th>Brier (lower is better)</th></tr></thead>
          <tbody>{Object.entries(pressure.variants).map(([k, v]) => <tr key={k}><td>{NAMES[k] ?? k}</td><td className={css.mono}>{v.accuracy}</td><td className={css.mono}>{v.brier}</td></tr>)}</tbody>
        </table>
        <p className="text-sm mt-3"><b>{pressure.verdict_text}</b></p>
        <ul className="mt-2 grid gap-1 text-xs text-muted list-disc pl-5">{pressure.caveats.map((c) => <li key={c}>{c}</li>)}</ul>
      </section>
    </div>
  );
}
