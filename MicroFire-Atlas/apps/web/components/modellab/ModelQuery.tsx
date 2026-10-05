"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { gate, predict, STATUS_LABEL, type GravityChoice, type Query, type Snapshot, type Status } from "@/lib/model-lab";
import styles from "./ModelLab.module.css";

const MATERIALS = ["SIBAL fabric", "PMMA", "Nomex", "Silicone", "Cotton jersey"];
const GRAVITY: { id: GravityChoice; label: string }[] = [
  { id: "microgravity", label: "Orbit (microgravity)" },
  { id: "lunar", label: "Moon" },
  { id: "martian", label: "Mars" },
  { id: "earth", label: "Earth" },
];
const PRESETS: { label: string; note: string; q: Query }[] = [
  { label: "Fabric near its limit", note: "in domain", q: { material: "SIBAL fabric", gravity: "microgravity", o2: 17, kpa: 101.3, flow: 5 } },
  { label: "PMMA just past the data", note: "near domain", q: { material: "PMMA", gravity: "microgravity", o2: 21, kpa: 101.3, flow: 5 } },
  { label: "PMMA at 15 % oxygen", note: "too few tests nearby", q: { material: "PMMA", gravity: "microgravity", o2: 15, kpa: 101.3, flow: 5 } },
  { label: "Lunar habitat scenario", note: "blocked", q: { material: "PMMA", gravity: "lunar", o2: 34, kpa: 56.5, flow: 10 } },
  { label: "Mars habitat scenario", note: "blocked", q: { material: "SIBAL fabric", gravity: "martian", o2: 30, kpa: 70, flow: 10 } },
];
const MARK: Record<Status, string> = { in: "✓", near: "≈", out: "✗", insufficient: "?" };
const pc = (x: number) => `${Math.round(x * 100)} %`;

export function ModelQuery({ snap }: { snap: Snapshot }) {
  const [q, setQ] = useState<Query>(PRESETS[0].q);
  const g = useMemo(() => gate(snap, q), [snap, q]);
  const p = useMemo(() => predict(snap, q), [snap, q]);
  const set = <K extends keyof Query>(k: K, v: Query[K]) => setQ((x) => ({ ...x, [k]: v }));
  const num = (k: "o2" | "kpa" | "flow", label: string, unit: string, min: number, max: number, step: number) => (
    <label className={styles.field}>
      <span>{label}</span>
      <span className={styles.numRow}>
        <input type="range" min={min} max={max} step={step} value={q[k]} onChange={(e) => set(k, Number(e.target.value))} aria-label={`${label} slider`} />
        <input type="number" min={min} max={max} step={step} value={q[k]} onChange={(e) => e.target.value !== "" && set(k, Number(e.target.value))} aria-label={`${label} in ${unit}`} />
        <small>{unit}</small>
      </span>
    </label>
  );
  const brief = `/mission/brief?${new URLSearchParams({ o2: String(q.o2), kpa: String(q.kpa), flow: String(q.flow), g: q.gravity === "earth" ? "microgravity" : q.gravity, m: q.material })}`;
  const maxAbs = p ? Math.max(0.5, ...p.contributions.map((c) => Math.abs(c.logOdds))) : 1;

  return (
    <div className={styles.instrument}>
      <div className={styles.controls} role="group" aria-label="Model query">
        <fieldset className={styles.presets}>
          <legend>Try a condition</legend>
          {PRESETS.map((x) => (
            <button type="button" key={x.label} onClick={() => setQ(x.q)} aria-pressed={JSON.stringify(x.q) === JSON.stringify(q)}>
              {x.label}<small>{x.note}</small>
            </button>
          ))}
        </fieldset>
        <label className={styles.field}>
          <span>Material</span>
          <select value={q.material} onChange={(e) => set("material", e.target.value)}>{MATERIALS.map((m) => <option key={m}>{m}</option>)}</select>
        </label>
        <fieldset className={styles.seg}>
          <legend>Gravity</legend>
          {GRAVITY.map((x) => (
            <label key={x.id}><input type="radio" name="gravity" checked={q.gravity === x.id} onChange={() => set("gravity", x.id)} />{x.label}</label>
          ))}
        </fieldset>
        {num("o2", "Oxygen", "% O₂", 10, 40, 0.1)}
        {num("kpa", "Pressure", "kPa", 30, 110, 0.1)}
        {num("flow", "Starting airflow", "cm/s", 0, 30, 0.5)}
      </div>

      <section className={styles.result} data-status={g.status} aria-live="polite" aria-labelledby="mq-status">
        <p className={styles.statusRow}>
          <span className={styles.badge} data-status={g.status} id="mq-status">{MARK[g.status]} {STATUS_LABEL[g.status]}</span>
          <span className={styles.version}>{snap.version} · {snap.rows.length} NASA tests</span>
        </p>

        {p ? (
          <div className={styles.prediction}>
            <p className={styles.target}>Predicted experimental outcome probability: a flame is established after the ignition attempt</p>
            <p className={styles.big}><span className="num">{pc(p.p)}</span><small>90 % bootstrap interval {pc(p.lo)}–{pc(p.hi)}</small></p>
            <div className={styles.band} aria-hidden="true"><span className={styles.bandRange} ref={(el) => { if (el) { el.style.left = `${p.lo * 100}%`; el.style.width = `${(p.hi - p.lo) * 100}%`; } }} /><span className={styles.bandDot} ref={(el) => { if (el) el.style.left = `${p.p * 100}%`; }} /></div>
            {g.status === "near" && <p className={styles.warn}>Near domain: at least one condition sits just outside the tested range. Treat this number as an extrapolation.</p>}
            <p className={styles.not}>Not a mission fire risk, not a crew safety probability, not a probability of a spacecraft fire. It describes one kind of NASA glovebox test.</p>
            <details className={styles.why}>
              <summary>Why did the model say this?</summary>
              <p>Each bar is that condition&apos;s push on the log-odds, compared with the average training test. For a logistic model these contributions are exact, not an approximation.</p>
              <ul className={styles.contrib}>
                {p.contributions.map((c) => (
                  <li key={c.feature}>
                    <span>{c.feature} = {c.value}</span>
                    <span className={styles.contribTrack}><span data-sign={c.logOdds >= 0 ? "up" : "down"} ref={(el) => { if (el) { const w = (Math.abs(c.logOdds) / maxAbs) * 50; el.style.width = `${w}%`; el.style.left = c.logOdds >= 0 ? "50%" : `${50 - w}%`; } }} /></span>
                    <span className="num">{c.logOdds >= 0 ? "+" : "−"}{Math.abs(c.logOdds).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
              <p className={styles.small}>Average training test: log-odds {p.baseLogOdds.toFixed(2)} ({pc(1 / (1 + Math.exp(-p.baseLogOdds)))}).</p>
            </details>
          </div>
        ) : (
          <div className={styles.blocked}>
            <p className={styles.blockedTitle}>Prediction blocked</p>
            <p>The model could compute a number here. MicroFire does not show one, because these conditions are outside what the NASA tests support.</p>
            <ul className={styles.reasons}>
              {g.checks.filter((c) => c.status === "out" || c.status === "insufficient").map((c) => <li key={c.dim}><b>{c.dim}</b> {c.text}</li>)}
            </ul>
            <nav className={styles.next} aria-label="Where to go instead">
              <Link href={brief}>Explore the closest NASA evidence</Link>
              <Link href="/mission">Open Mission Analyst</Link>
              <Link href="/gaps">See the evidence gap</Link>
              <Link href="/gaps#evidence-gain">Investigate the required experiment</Link>
            </nav>
            <p className={styles.abstain}>Abstention is a scientific result.</p>
          </div>
        )}

        <h3 className={styles.h3}>Domain checks</h3>
        <ul className={styles.checks}>
          {g.checks.map((c) => <li key={c.dim} data-status={c.status}><span aria-label={STATUS_LABEL[c.status]}>{MARK[c.status]}</span><b>{c.dim}</b><span>{c.text}</span></li>)}
        </ul>

        <h3 className={styles.h3}>Nearest NASA tests in the training data</h3>
        <p className={styles.small}>Distance is a MicroFire heuristic: oxygen and airflow differences in training standard deviations, same material first. It is not a NASA score.</p>
        <table className={styles.table}>
          <thead><tr><th scope="col">Test</th><th scope="col">Material</th><th scope="col">ΔO₂</th><th scope="col">ΔAirflow</th><th scope="col">NASA recorded</th></tr></thead>
          <tbody>
            {g.neighbors.map((n) => (
              <tr key={n.row.id}>
                <td><Link className="link" href={`/experiments/${n.row.id}`}>{n.row.test}</Link></td>
                <td>{n.row.material === q.material ? "✓ " : "✗ "}{n.row.material}</td>
                <td className="num">{n.dO2 >= 0 ? "+" : "−"}{Math.abs(n.dO2).toFixed(1)} pp</td>
                <td className="num">{n.dFlow >= 0 ? "+" : "−"}{Math.abs(n.dFlow).toFixed(1)} cm/s</td>
                <td>{n.row.y ? "Flame established" : "No flame established"} <small>({n.row.outcome})</small></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
