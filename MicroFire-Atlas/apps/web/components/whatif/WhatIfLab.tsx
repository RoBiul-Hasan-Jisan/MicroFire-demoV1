"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { STATUS_LABEL, type GravityChoice, type Query, type Snapshot, type Status } from "@/lib/model-lab";
import { coverage, DIM_LABEL, interventions, similarity, sweepO2, whatIf, type Envelope, type Side, type Tier } from "@/lib/what-if";
import styles from "./WhatIf.module.css";

const MATERIALS = ["SIBAL fabric", "PMMA", "Nomex", "Silicone", "Cotton jersey"];
const GRAVITY: { id: GravityChoice; label: string }[] = [
  { id: "microgravity", label: "Orbit (microgravity)" },
  { id: "lunar", label: "Moon" },
  { id: "martian", label: "Mars" },
  { id: "earth", label: "Earth" },
];
const PRESETS: { label: string; note: string; base: Query; change: Partial<Query> }[] = [
  { label: "Fabric, then less oxygen", note: "in domain", base: { material: "SIBAL fabric", gravity: "microgravity", o2: 18.5, kpa: 101.3, flow: 10 }, change: { o2: 16.5 } },
  { label: "Fabric, then lower airflow", note: "records only", base: { material: "SIBAL fabric", gravity: "microgravity", o2: 18.5, kpa: 101.3, flow: 10 }, change: { flow: 5 } },
  { label: "Orbit scenario moved to the Moon", note: "blocked", base: { material: "SIBAL fabric", gravity: "microgravity", o2: 18.5, kpa: 101.3, flow: 10 }, change: { gravity: "lunar" } },
  { label: "Lunar habitat start", note: "no estimate", base: { material: "PMMA", gravity: "lunar", o2: 34, kpa: 56.5, flow: 10 }, change: { gravity: "microgravity", o2: 21, kpa: 101.3 } },
];
const MARK: Record<Status, string> = { in: "✓", near: "≈", out: "✗", insufficient: "?" };
const TIER_LABEL: Record<Tier, string> = { supported: "Inside tested range", sparse: "Just outside tested range", blocked: "No estimate" };
const pc = (x: number) => `${Math.round(x * 100)} %`;
const sgn = (x: number, d = 0) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(d)}`;

const O2_AX: [number, number] = [14, 31];
const FLOW_AX: [number, number] = [0, 25];

function Controls({ q, onSet, ref0, title }: { q: Query; onSet: <K extends keyof Query>(k: K, v: Query[K]) => void; ref0?: Query; title: string }) {
  const changed = (k: keyof Query) => ref0 !== undefined && ref0[k] !== q[k];
  const num = (k: "o2" | "kpa" | "flow", label: string, unit: string, min: number, max: number, step: number) => (
    <label className={`${styles.field} ${changed(k) ? styles.changed : ""}`}>
      <span>{label}{changed(k) ? " (changed)" : ""}</span>
      <span className={styles.numRow}>
        <input type="range" min={min} max={max} step={step} value={q[k]} onChange={(e) => onSet(k, Number(e.target.value))} aria-label={`${title} ${label} slider`} />
        <input type="number" min={min} max={max} step={step} value={q[k]} onChange={(e) => e.target.value !== "" && onSet(k, Number(e.target.value))} aria-label={`${title} ${label} in ${unit}`} />
        <small>{unit}</small>
      </span>
    </label>
  );
  return (
    <fieldset className={styles.group}>
      <legend>{title}</legend>
      <label className={`${styles.field} ${changed("material") ? styles.changed : ""}`}>
        <span>Material{changed("material") ? " (changed)" : ""}</span>
        <select value={q.material} onChange={(e) => onSet("material", e.target.value)} aria-label={`${title} material`}>{MATERIALS.map((m) => <option key={m}>{m}</option>)}</select>
      </label>
      <label className={`${styles.field} ${changed("gravity") ? styles.changed : ""}`}>
        <span>Gravity{changed("gravity") ? " (changed)" : ""}</span>
        <select value={q.gravity} onChange={(e) => onSet("gravity", e.target.value as GravityChoice)} aria-label={`${title} gravity`}>{GRAVITY.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
      </label>
      {num("o2", "Oxygen", "% O₂", 10, 40, 0.1)}
      {num("kpa", "Pressure", "kPa", 30, 110, 0.1)}
      {num("flow", "Starting airflow", "cm/s", 0, 30, 0.5)}
    </fieldset>
  );
}

function Band({ env }: { env: Envelope }) {
  if (env.p == null || env.lo == null || env.hi == null || !env.modelInterval) return null;
  const m = env.modelInterval;
  return (
    <>
      <div className={styles.track} aria-hidden="true">
        <span className={styles.env} ref={(el) => { if (el) { el.style.left = `${env.lo! * 100}%`; el.style.width = `${(env.hi! - env.lo!) * 100}%`; } }} />
        <span className={styles.mdl} ref={(el) => { if (el) { el.style.left = `${m[0] * 100}%`; el.style.width = `${(m[1] - m[0]) * 100}%`; } }} />
        <span className={styles.dot} ref={(el) => { if (el) el.style.left = `${env.p! * 100}%`; }} />
      </div>
      <p className={styles.legendRow}><span>Dark band: model interval {pc(m[0])}–{pc(m[1])}</span><span>Light band: envelope {pc(env.lo)}–{pc(env.hi)}</span></p>
    </>
  );
}

function ScenarioCard({ title, side }: { title: string; side: Side }) {
  const { env } = side;
  return (
    <section className={styles.card} data-tier={env.tier} aria-label={title}>
      <div className={styles.cardHead}>
        <h3>{title}</h3>
        <span className={styles.badge} data-tier={env.tier}>{TIER_LABEL[env.tier]}</span>
      </div>
      <p className={styles.support}>{MARK[side.status]} {STATUS_LABEL[side.status]}</p>
      {env.p != null ? (
        <>
          <p className={styles.big}><span className="num">{pc(env.p)}</span><small>estimated share of such NASA tests that establish a flame</small></p>
          <Band env={env} />
          <p className={styles.support}>
            {env.support} {side.q.material} test{env.support === 1 ? "" : "s"} within ±1 pp oxygen and ±3 cm/s; {env.established} established a flame.
            {env.tier === "sparse" && " Near domain: treat as an extrapolation."}
          </p>
        </>
      ) : (
        <>
          <p className={styles.none}>No estimate</p>
          <p className={styles.support}>These conditions are outside what the NASA tests support, so no number is shown. {env.support} same-material test{env.support === 1 ? "" : "s"} in the local window.</p>
        </>
      )}
      <ul className={styles.checks}>
        {side.checks.map((c) => <li key={c.dim}><span data-status={c.status} aria-label={STATUS_LABEL[c.status]}>{MARK[c.status]}</span><b>{c.dim}</b><span>{c.text}</span></li>)}
      </ul>
      <p className={styles.small}>Closest NASA tests (similarity is a MicroFire heuristic, not a probability):</p>
      <ul className={styles.nb}>
        {side.neighbors.slice(0, 3).map((n) => (
          <li key={n.row.id}>
            <Link className="link" href={`/experiments/${n.row.id}`}>{n.row.test}</Link> · {n.row.material} · {n.row.o2} % O₂, {n.row.flow} cm/s · {n.row.y ? "flame established" : "no flame established"} <small>(similarity {pc(similarity(side.q, n))}, PDF p. {n.row.cite.pdf_page})</small>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CoverageMap({ snap, base, mod }: { snap: Snapshot; base: Query; mod: Query }) {
  const cells = useMemo(() => coverage(snap, base.material, O2_AX, FLOW_AX), [snap, base.material]);
  const W = 520, H = 280, L = 44, B = 34, T = 8, R = 10;
  const pw = W - L - R, ph = H - T - B;
  const x = (o2: number) => L + ((o2 - O2_AX[0]) / (O2_AX[1] - O2_AX[0])) * pw;
  const y = (f: number) => T + ph - ((f - FLOW_AX[0]) / (FLOW_AX[1] - FLOW_AX[0])) * ph;
  const cw = pw / 24, ch = ph / 12;
  const rows = snap.rows.filter((r) => r.material === base.material);
  const inView = (q: Query) => q.o2 >= O2_AX[0] && q.o2 <= O2_AX[1] && q.flow >= FLOW_AX[0] && q.flow <= FLOW_AX[1];
  return (
    <>
      <svg className={styles.map} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Evidence coverage for ${base.material} by oxygen and airflow, with the starting and modified scenarios marked`}>
        {cells.map((c, i) => <rect key={i} data-tier={c.tier} x={x(c.o2) - cw / 2} y={y(c.flow) - ch / 2} width={cw} height={ch} />)}
        {rows.map((r) => <circle key={r.id} className={styles.rec} cx={x(r.o2)} cy={y(r.flow)} r={3} />)}
        {inView(base) && <circle className={styles.mkBase} cx={x(base.o2)} cy={y(base.flow)} r={5} />}
        {inView(mod) && (mod.o2 !== base.o2 || mod.flow !== base.flow) && <circle className={styles.mkMod} cx={x(mod.o2)} cy={y(mod.flow)} r={7} />}
        {[14, 18, 22, 26, 30].map((t) => <text key={t} x={x(t)} y={H - 18} textAnchor="middle">{t}</text>)}
        {[0, 5, 10, 15, 20, 25].map((t) => <text key={t} x={L - 6} y={y(t) + 4} textAnchor="end">{t}</text>)}
        <text x={L + pw / 2} y={H - 3} textAnchor="middle">Oxygen (% O₂)</text>
        <text x={10} y={T + ph / 2} textAnchor="middle" transform={`rotate(-90 10 ${T + ph / 2})`}>Airflow (cm/s)</text>
      </svg>
      <p className={styles.swatches}>
        <span><i className={styles.sw} data-tier="supported" />3 or more {base.material} tests nearby</span>
        <span><i className={styles.sw} data-tier="sparse" />1–2 tests nearby</span>
        <span><i className={styles.sw} data-tier="empty" />no test nearby</span>
        <span>● start · ○ modified · small rings: NASA tests</span>
      </p>
      {(!inView(base) || !inView(mod)) && <p className={styles.small}>A marker is missing when its oxygen or airflow lies off this map, which is itself outside every NASA test in the training set.</p>}
    </>
  );
}

function ResponseCurve({ snap, base, mod }: { snap: Snapshot; base: Query; mod: Query }) {
  const pts = useMemo(() => sweepO2(snap, base), [snap, base]);
  const W = 520, H = 250, L = 44, B = 34, T = 10, R = 10, pw = W - L - R, ph = H - T - B;
  const x = (o2: number) => L + ((o2 - 14) / 17) * pw, y = (p: number) => T + ph - p * ph;
  const runs: (typeof pts)[] = [];
  for (const pt of pts) { if (pt.p == null) { runs.push([]); continue; } if (!runs.length) runs.push([]); runs[runs.length - 1].push(pt); }
  const live = runs.filter((r) => r.length > 0);
  const step = pw / 34;
  return (
    <>
      <svg className={styles.curve} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Estimate as oxygen alone changes for ${base.material}; drawn only where the domain gate allows a number`}>
        <defs><pattern id="wi-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line className={styles.hatch} x1="0" y1="0" x2="0" y2="6" /></pattern></defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => <g key={t}><line className={styles.grid} x1={L} x2={W - R} y1={y(t)} y2={y(t)} /><text x={L - 6} y={y(t) + 4} textAnchor="end">{Math.round(t * 100)}</text></g>)}
        {pts.filter((p) => p.p == null).map((p) => <rect key={p.o2} className={styles.blk} x={x(p.o2) - step / 2} y={T} width={step} height={ph} />)}
        {live.map((r, i) => {
          const up = r.map((p) => `${x(p.o2)},${y(p.hi!)}`), dn = [...r].reverse().map((p) => `${x(p.o2)},${y(p.lo!)}`);
          return (
            <g key={i}>
              {r.length > 1 && <polygon className={styles.band} points={[...up, ...dn].join(" ")} />}
              {r.length > 1 && <polyline className={styles.ln} points={r.map((p) => `${x(p.o2)},${y(p.p!)}`).join(" ")} />}
              {r.map((p) => <circle key={p.o2} className={styles.pt} cx={x(p.o2)} cy={y(p.p!)} r={2.5} />)}
            </g>
          );
        })}
        {live.length > 0 && pts[0].p == null && <text className={styles.nolabel} x={x(14) + 4} y={T + 14}>no estimate</text>}
        {live.length > 0 && pts[pts.length - 1].p == null && <text className={styles.nolabel} x={W - R - 4} y={T + 14} textAnchor="end">no estimate: outside tested conditions</text>}
        {base.o2 >= 14 && base.o2 <= 31 && <line className={styles.vl} x1={x(base.o2)} x2={x(base.o2)} y1={T} y2={T + ph} />}
        {mod.o2 !== base.o2 && mod.o2 >= 14 && mod.o2 <= 31 && <line className={styles.vlm} x1={x(mod.o2)} x2={x(mod.o2)} y1={T} y2={T + ph} />}
        {[14, 18, 22, 26, 30].map((t) => <text key={t} x={x(t)} y={H - 18} textAnchor="middle">{t}</text>)}
        <text x={L + pw / 2} y={H - 3} textAnchor="middle">Oxygen (% O₂)</text>
        <text x={10} y={T + ph / 2} textAnchor="middle" transform={`rotate(-90 10 ${T + ph / 2})`}>Flame established (%)</text>
      </svg>
      <p className={styles.small}>
        {live.length === 0 ? "No oxygen value is inside the tested range for these conditions, so there is no curve." : "The curve and its envelope are drawn only where the domain gate allows a number. Hatched columns are oxygen values with no estimate."}
        {" "}Dashed lines mark the starting scenario{mod.o2 !== base.o2 ? " and the modified oxygen" : ""}. This is how the model responds to oxygen with everything else held fixed. It describes the model, not a physical law, and the model uses only oxygen and material.
      </p>
    </>
  );
}

export function WhatIfLab({ snap, pressure }: { snap: Snapshot; pressure: { n: number; of: number } }) {
  const [base, setBase] = useState<Query>(PRESETS[0].base);
  const [change, setChange] = useState<Partial<Query>>(PRESETS[0].change);
  const mod: Query = { ...base, ...change };
  const w = useMemo(() => whatIf(snap, base, change), [snap, base, change]);
  const levers = useMemo(() => interventions(snap, base, pressure), [snap, base, pressure]);

  const setB = <K extends keyof Query>(k: K, v: Query[K]) => setBase((b) => ({ ...b, [k]: v }));
  const setM = <K extends keyof Query>(k: K, v: Query[K]) => setChange((c) => { const n = { ...c }; if (v === base[k]) delete n[k]; else n[k] = v; return n; });
  const brief = `/mission/brief?${new URLSearchParams({ o2: String(base.o2), kpa: String(base.kpa), flow: String(base.flow), g: base.gravity === "earth" ? "microgravity" : base.gravity, m: base.material })}`;

  return (
    <div className={styles.wrap}>
      <div className={styles.controls} role="group" aria-label="What-if controls">
        <fieldset className={styles.group}>
          <legend>Try a scenario</legend>
          <div className={styles.presets}>
            {PRESETS.map((p) => (
              <button type="button" key={p.label} onClick={() => { setBase(p.base); setChange(p.change); }} aria-pressed={JSON.stringify([p.base, p.change]) === JSON.stringify([base, change])}>
                {p.label}<small>{p.note}</small>
              </button>
            ))}
          </div>
        </fieldset>
        <Controls q={base} onSet={setB} title="Starting scenario" />
        <Controls q={mod} onSet={setM} ref0={base} title="Modified scenario" />
        <button type="button" className={styles.reset} onClick={() => setChange({})}>Reset modified to the start</button>
      </div>

      <div className={styles.out} aria-live="polite">
        <div className={styles.reading}>
          <p><b>What the evidence says about this change.</b> {w.reading}</p>
          {w.changed.length > 0 && <p className={styles.not}>Changed: {w.changed.map((k) => DIM_LABEL[k]).join(", ")}.</p>}
          <p className={styles.not}>Not a fire-risk probability, a hazard rating or advice for a crew. A lower estimate means fewer nearby NASA tests established a flame. It does not mean a cabin is safer.</p>
        </div>

        <div className={styles.pair}>
          <ScenarioCard title="Starting scenario" side={w.base} />
          <ScenarioCard title="Modified scenario" side={w.modified} />
        </div>

        {w.delta && (
          <section>
            <h2 className={styles.h2}>What moved the estimate</h2>
            <p className={styles.sub}>
              Estimate change: <b className="num">{sgn(w.delta.pp)} percentage points</b>. {w.delta.distinguishable ? "The uncertainty envelopes do not overlap." : "The uncertainty envelopes overlap, so the tests cannot separate the two scenarios."}
            </p>
            {w.delta.byFeature.length > 0 ? (
              <ul className={styles.feat}>
                {w.delta.byFeature.map((f) => <li key={f.feature}>{f.feature}: {f.from} → {f.to} shifts the log-odds by <b className="num">{sgn(f.logOdds, 2)}</b> <span className={styles.not}>(exact for this linear model)</span></li>)}
              </ul>
            ) : <p className={styles.small}>The changed condition is not an input of the deployed model, so it cannot move the estimate. Pressure and gravity act only through the domain gate.</p>}
          </section>
        )}

        <section>
          <h2 className={styles.h2}>Compare changes to the starting scenario</h2>
          <p className={styles.sub}>
            Each row changes one condition. Rows with an estimate come first, ordered by how far the estimate moves; rows with only record counts follow; rows no NASA solid-fuel test covers come last, with no number.
            This ordering describes the evidence, it is not a ranking of what a crew should do.
          </p>
          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead><tr><th scope="col">Change</th><th scope="col">Basis</th><th scope="col">Result</th><th scope="col">Evidence</th><th scope="col"><span className="sr-only">Load</span></th></tr></thead>
              <tbody>
                {levers.map((l) => (
                  <tr key={l.id} data-kind={l.kind}>
                    <td>{l.label}</td>
                    <td><span className={styles.kind}>{l.kind === "modelled" ? "Model + records" : l.kind === "records" ? "Records only" : "No evidence"}</span></td>
                    <td className="num">
                      {l.kind === "modelled" && (l.result.delta
                        ? <>{pc(l.result.modified.env.p!)} <small>({sgn(l.result.delta.pp)} pp{l.result.delta.distinguishable ? "" : ", not distinguishable"})</small></>
                        : <>No estimate <small>({STATUS_LABEL[l.result.modified.status]})</small></>)}
                      {l.kind === "records" && (l.interval ? <>{l.established}/{l.support} <small>({pc(l.interval[0])}–{pc(l.interval[1])})</small></> : <>Too few tests</>)}
                      {l.kind === "gap" && "Not estimated"}
                    </td>
                    <td>
                      {l.kind === "modelled" && <>{l.result.modified.env.support} tests nearby{l.caveat && <small className={styles.caveat}>{l.caveat}</small>}</>}
                      {l.kind === "records" && l.why}
                      {l.kind === "gap" && <>{l.why} {l.evidence.map((e) => <small key={e.source_id}>({e.source_id}, PDF p. {e.pdf_page}) </small>)}</>}
                    </td>
                    <td>{l.kind !== "gap" && <button type="button" className={styles.load} onClick={() => setChange(l.change)}>Load</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className={styles.h2}>How the estimate responds to oxygen alone</h2>
          <p className={styles.sub}>Partial dependence for {base.material}: oxygen sweeps across the plot while material, airflow, pressure and gravity stay at the starting scenario. The curve stops where the NASA tests stop.</p>
          <ResponseCurve snap={snap} base={base} mod={mod} />
        </section>

        <section>
          <h2 className={styles.h2}>Where the evidence is thick, thin or missing</h2>
          <p className={styles.sub}>Coverage for {base.material}: how many NASA tests sit within the gate&apos;s window of each oxygen and airflow combination. Pressure and gravity are fixed by the domain gate and are not on this map.</p>
          <CoverageMap snap={snap} base={base} mod={mod} />
        </section>

        <nav className={styles.links} aria-label="Related pages">
          <Link href={brief}>Open the Evidence Brief for the starting scenario</Link>
          <Link href="/model-lab">How the model is validated</Link>
          <Link href="/next-tests">Which new test would remove the most uncertainty</Link>
          <Link href="/gaps">Evidence gaps</Link>
        </nav>
      </div>
    </div>
  );
}
