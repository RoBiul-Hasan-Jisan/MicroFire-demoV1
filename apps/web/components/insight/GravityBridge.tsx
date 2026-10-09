"use client";

import { useMemo, useState } from "react";
import type { Model } from "@/lib/model";
import { bridgeCurves, type BridgeSpec, type ClaimCheck, type Gravity } from "@/lib/gravity-bridge";
import { GRAVITY_LABEL, pct } from "@/lib/next-tests";
import css from "./Insight.module.css";

const COLOR: Record<Gravity, string> = { microgravity: "var(--quench)", lunar: "var(--signal)", martian: "var(--flame)" };
const GRAVS: Gravity[] = ["microgravity", "lunar", "martian"];
const XS = [0, 1, 2, 3, 5, 7.5, 10, 15, 20, 25];
const W = 640, H = 300, L = 46, R = 96, T = 14, B = 40;

export function GravityBridgeView({ model, spec, checks, quotes, validationN }: { model: Model; spec: BridgeSpec; checks: ClaimCheck[]; quotes: Record<string, string>; validationN: number }) {
  const [o2, setO2] = useState(21);
  const [direction, setDirection] = useState<"concurrent" | "opposed">("concurrent");
  const [u, setU] = useState<[number, number]>(spec.u_ref_cm_s);
  const [n, setN] = useState<[number, number]>(spec.exponent);
  const ranges = useMemo(() => ({ uRef: u, exponent: n }), [u, n]);
  const curves = useMemo(() => bridgeCurves(model, spec, o2, direction, XS, ranges), [model, spec, o2, direction, ranges]);
  const x = (f: number) => L + (f / 25) * (W - L - R);
  const y = (p: number) => T + (1 - p) * (H - T - B);
  const [pick, setPick] = useState(0);
  const f0 = model.ranges.flow_cm_s[0];

  return (
    <div className={css.page}>
      <section className={css.card} aria-labelledby="status">
        <p><span className={`${css.badge} ${css.warn}`}>{validationN === 0 ? "Unvalidated hypothesis" : `${validationN} real partial-gravity results added`}</span></p>
        <h2 id="status" className="display text-xl mt-3">What this is</h2>
        <p className="mt-2 text-sm text-muted max-w-[78ch]">{spec.idea}</p>
        <p className="mt-2 text-sm"><code>{spec.equation}</code></p>
      </section>

      <section aria-labelledby="play" className={css.card}>
        <h2 id="play" className="display text-xl">Try it</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className={css.field}>Oxygen: <b>{o2.toFixed(1)} %</b><input type="range" min={14} max={36} step={0.5} value={o2} onChange={(e) => setO2(+e.target.value)} /></label>
          <label className={css.field}>Flow direction
            <select className={css.input} value={direction} onChange={(e) => setDirection(e.target.value as "concurrent" | "opposed")}>
              <option value="concurrent">Concurrent</option><option value="opposed">Opposed</option></select></label>
          <label className={css.field}>Forced airflow for the readout: <b>{XS[pick]} cm/s</b><input type="range" min={0} max={XS.length - 1} step={1} value={pick} onChange={(e) => setPick(+e.target.value)} /></label>
          <label className={css.field}>Assumed buoyant scale at 1 g, low: <b>{u[0]} cm/s</b><input type="range" min={5} max={60} step={1} value={u[0]} onChange={(e) => setU([Math.min(+e.target.value, u[1]), u[1]])} /></label>
          <label className={css.field}>…high: <b>{u[1]} cm/s</b><input type="range" min={5} max={60} step={1} value={u[1]} onChange={(e) => setU([u[0], Math.max(+e.target.value, u[0])])} /></label>
          <label className={css.field}>Exponent n: <b>{n[0].toFixed(2)}–{n[1].toFixed(2)}</b>
            <input type="range" min={0.25} max={0.75} step={0.01} value={n[1]} onChange={(e) => setN([Math.min(n[0], +e.target.value), +e.target.value])} aria-label="Upper exponent" /></label>
        </div>
        <button className={`${css.btn} mt-3`} onClick={() => { setU(spec.u_ref_cm_s); setN(spec.exponent); }}>Reset assumptions</button>

        <div className={`${css.scroll} mt-5`}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, minWidth: 420 }} role="img" aria-label="Chance the flame is sustained against forced airflow, for ISS microgravity, lunar and Martian gravity, with 90 percent bands">
            <rect x={x(0)} y={T} width={x(f0) - x(0)} height={H - T - B} className={css.hatch} />
            {[0, 0.25, 0.5, 0.75, 1].map((p) => <g key={p}><line x1={L} x2={W - R} y1={y(p)} y2={y(p)} stroke="rgba(255,255,255,.12)" /><text x={L - 6} y={y(p) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{pct(p)}</text></g>)}
            {[0, 5, 10, 15, 20, 25].map((f) => <text key={f} x={x(f)} y={H - B + 16} textAnchor="middle" fontSize="11" fill="var(--muted)">{f}</text>)}
            <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" fontSize="12" fill="var(--muted)">Forced airflow, cm/s (hatched = below the lowest tested airflow)</text>
            {GRAVS.map((gv) => {
              const pts = curves[gv];
              const band = [...pts.map((q) => `${x(q.forced)},${y(q.p95)}`), ...[...pts].reverse().map((q) => `${x(q.forced)},${y(q.p05)}`)].join(" ");
              const line = pts.map((q) => `${x(q.forced)},${y(q.p50)}`).join(" ");
              const last = pts[pts.length - 1];
              return <g key={gv}><polygon points={band} fill={COLOR[gv]} opacity="0.18" /><polyline points={line} fill="none" stroke={COLOR[gv]} strokeWidth="2.5" strokeDasharray={gv === "microgravity" ? "0" : "0"} />
                <text x={x(25) + 6} y={y(last.p50) + 4} fontSize="12" fill={COLOR[gv]}>{gv === "microgravity" ? "ISS" : gv === "lunar" ? "Moon" : "Mars"}</text></g>;
            })}
          </svg>
        </div>

        <div className={`${css.cards} mt-4`} aria-live="polite">
          {GRAVS.map((gv) => { const q = curves[gv][pick]; return <div key={gv} className={css.card}>
            <p className="text-sm" style={{ color: COLOR[gv] }}>{GRAVITY_LABEL[gv]}</p>
            <p className="display text-3xl mt-1 mono">{pct(q.p50)}</p>
            <p className="text-xs text-muted">90 % range {pct(q.p05)}–{pct(q.p95)}; effective airflow {q.effectiveFlow[0].toFixed(1)}–{q.effectiveFlow[1].toFixed(1)} cm/s</p>
            {(q.extrapolated.o2 || q.extrapolated.flow) && <p className="text-xs mt-1 warn">Extrapolating beyond the ISS tests ({[q.extrapolated.o2 && "oxygen", q.extrapolated.flow && "airflow"].filter(Boolean).join(" and ")}).</p>}
          </div>; })}
        </div>
      </section>

      {spec.derivation && (
        <section aria-labelledby="deriv" className={css.card}>
          <h2 id="deriv" className="display text-xl">Where the 10–30 cm/s figure comes from</h2>
          <p className="mt-2 text-sm"><code>{spec.derivation.formula}</code>, with g = {spec.derivation.g_earth_cm_s2} cm/s². Over an assumed flame length scale L:</p>
          <table className={`${css.tbl} mt-2`} style={{ maxWidth: 420 }}>
            <thead><tr><th>L (cm)</th><th>u_ref (cm/s)</th></tr></thead>
            <tbody>{[0.1, 0.3, 1].map((L) => <tr key={L}><td className={css.mono}>{L}</td><td className={css.mono}>{Math.sqrt(spec.derivation!.g_earth_cm_s2 * L).toFixed(1)}</td></tr>)}</tbody>
          </table>
          <p className="mt-2 text-sm text-muted max-w-[78ch]">{spec.derivation.note} The Next tests page re-runs its plan with weaker and stronger buoyancy to show how much this choice matters.</p>
        </section>
      )}

      <section aria-labelledby="score" className={css.card}>
        <h2 id="score" className="display text-xl">Is the bridge right? The scorecard</h2>
        <p className="mt-2 text-sm text-muted max-w-[78ch]">
          {validationN === 0 ? "No real partial-gravity test result has been added yet, so nothing here confirms the bridge. The checks below use NASA statements already in the atlas." : `${validationN} cited partial-gravity result(s) have been used to re-weight the bridge.`}
        </p>
        <ul className="mt-4 grid gap-4">
          {checks.map((c) => (
            <li key={c.claim.id} className={css.card} style={{ background: "var(--panel-2)" }}>
              <p><span className={`${css.badge} ${c.verdict === "agrees" ? css.cool : c.verdict === "disagrees" ? css.warn : ""}`}>{c.verdict}</span></p>
              <p className={`${css.quote} mt-2`}>{quotes[c.claim.findingId]}</p>
              <p className="text-sm mt-2">{c.claim.why}</p>
              <p className="text-sm mt-1 text-muted">{c.detail}</p>
            </li>
          ))}
        </ul>
        <h3 className="font-semibold mt-5">Add real results</h3>
        <p className="text-sm text-muted mt-1 max-w-[78ch]">Put cited partial-gravity rows in <code>data/curated/partial_gravity_validation.csv</code> and run <code>python3 pipelines/retrain.py</code>. The bridge parameters are re-weighted against them, the next-test plan updates, and this page reports how many results agree. NASA&apos;s planned lunar-surface experiment (FM2) is the kind of result that would test it.</p>
      </section>

      <section aria-labelledby="ass" className={css.card}>
        <h2 id="ass" className="display text-xl">Assumptions you should challenge</h2>
        <ul className="mt-3 grid gap-2 text-sm text-muted list-disc pl-5">{spec.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
      </section>
    </div>
  );
}
