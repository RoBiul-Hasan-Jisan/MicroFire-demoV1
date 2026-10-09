"use client";
import { useState } from "react";
import ex from "./ObsExtra.module.css";
import styles from "./AtlasObservatory.module.css";
import type { SaffireRun } from "@/lib/types";

const GROUPS = [
  { k: "I–III", c: "#4aa8ff", yrs: "2016–2017", f: ["Saffire-1", "Saffire-2"], t: "Early experiments: one wide fabric sheet, then small samples including silicone." },
  { k: "IV–V", c: "#2ee6c0", yrs: "2020–2021", f: ["Saffire-IV", "Saffire-V"], t: "Thick fuels, longer burns, first lower-pressure runs." },
  { k: "VI", c: "#ff7a2f", yrs: "2022", f: ["Saffire-VI"], t: "Pressure near 55 kPa and oxygen near 30%: closest to exploration atmospheres." },
];
const gi = (r: SaffireRun) => GROUPS.findIndex((g) => g.f.includes(r.flight));
export type Src = { source_id: string; title: string; url: string; pdf_url?: string | null };

export function SaffireMission({ runs, sources }: { runs: SaffireRun[]; sources: Src[] }) {
  const [g, setG] = useState<number | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const vis = runs.filter((r) => g == null || gi(r) === g);
  const plot = vis.filter((r) => r.o2_pct != null && r.pressure_kpa != null);
  const sel = runs.find((r) => r.id === pick) ?? plot[plot.length - 1] ?? vis[0];
  const W = 640, H = 320, L = 48, B = 36;
  const X = (v: number) => L + ((v - 15) / 30) * (W - L - 12), Y = (v: number) => H - B - ((v - 20) / 100) * (H - B - 12);
  const s = sel as unknown as Record<string, number | string | null>;
  return (
    <div className={ex.page}>
      <h1 className={ex.title}>SAFFIRE: <em>fire, after departure</em></h1>
      <p className={ex.lead}>NASA set {runs.length} fires on purpose inside uncrewed Cygnus cargo ships after they left the ISS, to see how fire behaves in microgravity. Every value traces to a NASA table.</p>
      <div className={styles.kpis}>
        {[[runs.length, "ignition runs"], [GROUPS.length, "flight groups"], [new Set(runs.map((r) => r.material)).size, "materials"], [sources.length, "NASA documents"]].map(([n, l]) => <div key={l as string} className={styles.kpi}><strong>{n}</strong><span>{l}</span></div>)}
      </div>
      <div className={ex.two}>
        <section className={styles.panel}>
          <h2>Test conditions</h2>
          <p className={styles.sub}>Each point is one run (those with a stated pressure). Select a point for details.</p>
          <div className={`${styles.chips} ${ex.mb8}`}>{GROUPS.map((x, i) => <span key={x.k} className={`${ex["tc-g" + i]} ${ex.f08}`}>● {x.k} ({x.yrs})</span>)}</div>
          <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg}>
            {[20, 40, 60, 80, 100, 120].map((v) => <g key={v}><line x1={L} x2={W - 12} y1={Y(v)} y2={Y(v)} /><text x={L - 8} y={Y(v) + 4} textAnchor="end">{v}</text></g>)}
            {[15, 20, 25, 30, 35, 40, 45].map((v) => <text key={v} x={X(v)} y={H - B + 16} textAnchor="middle">{v}</text>)}
            <text x={W / 2} y={H - 4} textAnchor="middle">Oxygen (%)</text><text transform={`translate(12 ${H / 2}) rotate(-90)`} textAnchor="middle">Pressure (kPa)</text>
            {plot.map((r) => <circle key={r.id} cx={X(r.o2_pct!)} cy={Y(r.pressure_kpa!)} r={r.id === sel?.id ? 8 : 5} fill={GROUPS[gi(r)]?.c ?? "#999"} stroke={r.id === sel?.id ? "#fff" : "none"} strokeWidth="2" onClick={() => setPick(r.id)}><title>{`${r.flight} ${r.sample}`}</title></circle>)}
          </svg>
        </section>
        <aside className={styles.panel}>
          <h3 className={`${ex.cOrange}`}>{sel?.flight} · {sel?.sample}</h3>
          <dl>
            <dt>Material</dt><dd>{sel?.material}</dd>
            <dt>Pressure</dt><dd>{sel?.pressure_kpa ?? "not stated"}{sel?.pressure_kpa != null && " kPa"}</dd>
            <dt>Oxygen</dt><dd>{sel?.o2_pct ?? "not stated"}{sel?.o2_pct != null && "%"}</dd>
            <dt>Airflow</dt><dd>{sel?.flow_cm_s ?? "not stated"}{sel?.flow_cm_s != null && " cm/s"}</dd>
            <dt>Burn time</dt><dd>{s.burn_duration_s ?? "not stated"}{s.burn_duration_s != null && " s"}</dd>
            <dt>Spread rate</dt><dd>{s.spread_rate_mm_s ?? "not stated"}{s.spread_rate_mm_s != null && " mm/s"}</dd>
          </dl>
          <p className={`${styles.outcome} ${ex.bdFlame}`}><small>Outcome (as NASA recorded)</small>{sel?.outcome_label}</p>
        </aside>
      </div>
      <div className={ex.cards}>{GROUPS.map((x, i) => (
        <button key={x.k} className={`${ex.card} ${g === i ? ex.on : ""}`} onClick={() => setG(g === i ? null : i)}>
          <h3>Saffire {x.k}</h3><small className={ex["tc-g" + i]}>{x.yrs} · {runs.filter((r) => gi(r) === i).length} runs</small><p>{x.t}</p></button>))}</div>
      <section className={`${styles.panel} ${ex.mt16}`}>
        <h2>NASA source records</h2>
        <ul className={ex.list}>{sources.map((d) => <li key={d.source_id}>{d.title} · <a href={d.url} target="_blank" rel="noreferrer">NTRS</a>{d.pdf_url && <> · <a href={d.pdf_url} target="_blank" rel="noreferrer">PDF</a></>}</li>)}</ul>
      </section>
    </div>
  );
}
