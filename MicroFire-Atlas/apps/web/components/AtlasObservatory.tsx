"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Experiment, LuciRun, SaffireRun } from "@/lib/types";
import ex from "./ObsExtra.module.css";
import styles from "./AtlasObservatory.module.css";

type Fam = "bass2" | "saffire" | "luci";
type Row = { id: string; code: string; fam: Fam; material: string; o2: number | null; flow: number | null; kpa: number | null; group: string; label: string; note: string | null; href: string };

const FAM: Record<Fam, string> = { bass2: "BASS / BASS-II", saffire: "Saffire", luci: "LUCI" };
const OUT: Record<string, { c: string; t: string }> = {
  sustained: { c: "#3ddc84", t: "Kept burning" },
  unknown: { c: "#ffb938", t: "Burned (end state not stated)" },
  extinguished: { c: "#4aa8ff", t: "Went out" },
  not_ignited: { c: "#9aa7bd", t: "Did not ignite" },
};
const key = (g: string) => (OUT[g] ? g : "other");
const st = (g: string) => OUT[g] ?? { c: "#b27cff", t: g };

export function AtlasObservatory({ data, saffire, luci }: { data: Experiment[]; saffire: SaffireRun[]; luci: LuciRun[] }) {
  const rows = useMemo<Row[]>(() => [
    ...data.map((e) => ({ id: e.id, code: e.test_id, fam: "bass2" as Fam, material: e.material, o2: e.oxygen_vol_pct, flow: e.flow_initial_cm_s, kpa: e.pressure_kpa ?? null, group: e.outcome_group, label: e.outcome_label, note: e.observations_verbatim, href: `/experiments/${e.id}` })),
    ...saffire.map((r) => ({ id: r.id, code: r.sample, fam: "saffire" as Fam, material: r.material, o2: r.o2_pct, flow: r.flow_cm_s, kpa: r.pressure_kpa ?? null, group: r.outcome_group, label: r.outcome_label, note: r.provenance.outcome?.quote ?? null, href: `/saffire#${r.id}` })),
    ...luci.map((r) => ({ id: r.id, code: r.sample, fam: "luci" as Fam, material: r.material, o2: r.o2_start_pct, flow: null, kpa: 101, group: r.outcome_group, label: r.outcome_label, note: r.provenance.outcome?.quote ?? null, href: `/atlas#${r.id}` })),
  ], [data, saffire, luci]);

  const [fams, setFams] = useState<Set<Fam>>(new Set(["bass2", "saffire", "luci"]));
  const [mats, setMats] = useState<Set<string> | null>(null);
  const [outs, setOuts] = useState<Set<string> | null>(null);
  const [maxFlow, setMaxFlow] = useState(100);
  const [pick, setPick] = useState<string | null>(null);

  const allMats = [...new Set(rows.map((r) => r.material))].sort();
  const allOuts = [...new Set(rows.map((r) => r.group))];
  const vis = rows.filter((r) => fams.has(r.fam) && (!mats || mats.has(r.material)) && (!outs || outs.has(r.group)) && (r.flow == null || r.flow <= maxFlow));
  const plot = vis.filter((r) => r.o2 != null && r.flow != null);
  const sel = rows.find((r) => r.id === pick) ?? plot[0] ?? vis[0] ?? null;
  const toggle = <T,>(s: Set<T> | null, all: T[], v: T) => { const n = new Set(s ?? all); n.has(v) ? n.delete(v) : n.add(v); return n; };

  const W = 640, H = 360, L = 48, B = 38, xmax = Math.max(50, ...plot.map((r) => r.flow!)), ymax = 100;
  const X = (v: number) => L + (v / xmax) * (W - L - 12), Y = (v: number) => H - B - (v / ymax) * (H - B - 12);
  const n = (f: (r: Row) => boolean) => vis.filter(f).length;

  return (
    <div className={styles.grid}>
      <aside className={styles.panel}>
        <div className={styles.head}><b>Filters</b><button onClick={() => { setFams(new Set(["bass2", "saffire", "luci"])); setMats(null); setOuts(null); setMaxFlow(100); }}>Reset all</button></div>
        <h4>Experiment family</h4>
        <div className={styles.chips}>{(Object.keys(FAM) as Fam[]).map((f) => (
          <button key={f} className={fams.has(f) ? styles.on : ""} onClick={() => setFams(toggle(fams, Object.keys(FAM) as Fam[], f))}>{FAM[f]} ({rows.filter((r) => r.fam === f).length})</button>))}</div>
        <h4>Material</h4>
        {allMats.map((m) => <label key={m}><input type="checkbox" checked={!mats || mats.has(m)} onChange={() => setMats(toggle(mats, allMats, m))} />{m}</label>)}
        <h4>Max airflow: {maxFlow} cm/s</h4>
        <input type="range" min={5} max={100} value={maxFlow} onChange={(e) => setMaxFlow(+e.target.value)} />
        <h4>Outcome</h4>
        {allOuts.map((o) => <label key={o}><input type="checkbox" checked={!outs || outs.has(o)} onChange={() => setOuts(toggle(outs, allOuts, o))} /><i className={ex["dot-" + key(o)]} />{st(o).t}</label>)}
      </aside>

      <main>
        <div className={styles.kpis}>
          {[["Visible tests", vis.length, `of ${rows.length} total`], ["Low-flow tests", n((r) => r.flow != null && r.flow <= 5), "≤ 5 cm/s"], ["Sustained flames", n((r) => r.group === "sustained"), "kept burning"], ["Not ignited", n((r) => r.group === "not_ignited"), "did not ignite"]].map(([a, b, c]) => (
            <div key={a as string} className={styles.kpi}><strong>{b}</strong><span>{a}<small>{c}</small></span></div>))}
        </div>
        <section className={styles.panel}>
          <h2>Fire test results</h2>
          <p className={styles.sub}>Oxygen concentration vs. airflow velocity · {plot.length} plottable tests (LUCI has no airflow value, so it is counted but not plotted)</p>
          <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label="Oxygen vs airflow scatter plot">
            {[0, 20, 40, 60, 80, 100].map((v) => <g key={v}><line x1={L} x2={W - 12} y1={Y(v)} y2={Y(v)} /><text x={L - 8} y={Y(v) + 4} textAnchor="end">{v}</text></g>)}
            {Array.from({ length: Math.floor(xmax / 10) + 1 }, (_, i) => i * 10).map((v) => <text key={v} x={X(v)} y={H - B + 18} textAnchor="middle">{v}</text>)}
            <text x={(W + L) / 2} y={H - 4} textAnchor="middle">Airflow velocity (cm/s)</text>
            <text transform={`translate(12 ${H / 2}) rotate(-90)`} textAnchor="middle">Oxygen (%)</text>
            {plot.map((r) => <circle key={r.id} cx={X(r.flow!)} cy={Y(r.o2!)} r={r.id === sel?.id ? 8 : 5} fill={st(r.group).c} fillOpacity=".85" stroke={r.id === sel?.id ? "#fff" : "none"} strokeWidth="2" tabIndex={0} onClick={() => setPick(r.id)} onKeyDown={(e) => e.key === "Enter" && setPick(r.id)}><title>{`${r.code} · ${r.material} · O₂ ${r.o2}% · ${r.flow} cm/s`}</title></circle>)}
          </svg>
        </section>
      </main>

      <aside className={styles.panel}>
        <div className={styles.head}><b>Selected test</b></div>
        {sel ? (<>
          <h3>{sel.code} <span className={styles.badge}>{FAM[sel.fam]}</span></h3>
          <dl>
            <dt>Material</dt><dd>{sel.material}</dd>
            <dt>Oxygen</dt><dd>{sel.o2 ?? "not reported"}{sel.o2 != null && "%"}</dd>
            <dt>Airflow</dt><dd>{sel.flow ?? "not reported"}{sel.flow != null && " cm/s"}</dd>
            <dt>Pressure</dt><dd>{sel.kpa ?? "not reported"}{sel.kpa != null && " kPa"}</dd>
          </dl>
          <p className={`${styles.outcome} ${ex["bd-" + key(sel.group)]}`}><small>Test outcome (as NASA recorded)</small>{sel.label}</p>
          {sel.note && <p className={styles.note}>{sel.note}</p>}
          <Link className={styles.cta} href={sel.href}>View NASA source record →</Link>
        </>) : <p>No tests match these filters.</p>}
      </aside>
    </div>
  );
}
