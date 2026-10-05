"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { evidenceRecords, getSource, GROUP_LABEL, pdfLink } from "@/lib/data";
import { FAMILIES, TOLERANCE, type EvidenceRecord } from "@/lib/ontology";
import type { OutcomeGroup } from "@/lib/types";
import styles from "./EvidenceSpace.module.css";

/**
 * Combustion Evidence Space. Every mark is one real test record; nothing is interpolated between them.
 * The mission condition is a separate marker, and the tolerance box around it shows at a glance whether any
 * record sits close enough to count as direct evidence on the plotted dimensions.
 */
export type Mark = { o2: number; flow: number; kpa: number; material?: string; label?: string };
type View = "o2-flow" | "o2-kpa";

const W = 640, H = 380, PAD = { l: 52, r: 16, t: 16, b: 44 };
const X: [number, number] = [10, 36];
const Y: Record<View, [number, number]> = { "o2-flow": [0, 30], "o2-kpa": [40, 110] };
const sx = (v: number) => PAD.l + ((v - X[0]) / (X[1] - X[0])) * (W - PAD.l - PAD.r);
const sy = (v: number, view: View) => H - PAD.b - ((v - Y[view][0]) / (Y[view][1] - Y[view][0])) * (H - PAD.t - PAD.b);
const kpaOf = (r: EvidenceRecord) => (r.pressureKpa ? (r.pressureKpa[0] + r.pressureKpa[1]) / 2 : null);
const yOf = (r: EvidenceRecord, view: View) => (view === "o2-flow" ? r.flowCmS : kpaOf(r));
const SHAPE: Record<string, string> = { bass2: "circle", saffire: "square", luci: "triangle" };
const OUTCOMES: OutcomeGroup[] = ["sustained", "extinguished", "not_ignited", "unknown"];

function Glyph({ shape, x, y, outcome, active }: { shape: string; x: number; y: number; outcome: OutcomeGroup; active: boolean }) {
  const r = active ? 7 : 5;
  const cls = `${styles.glyph} ${styles[outcome]}`;
  if (shape === "square") return <rect className={cls} x={x - r} y={y - r} width={r * 2} height={r * 2} />;
  if (shape === "triangle") return <path className={cls} d={`M${x} ${y - r - 1}L${x + r + 1} ${y + r}L${x - r - 1} ${y + r}Z`} />;
  return <circle className={cls} cx={x} cy={y} r={r} />;
}

export function EvidenceSpace({ initial, onPick, compact = false }: { initial?: Mark; onPick?: (r: EvidenceRecord) => void; compact?: boolean }) {
  const [view, setView] = useState<View>("o2-flow");
  const [material, setMaterial] = useState(initial?.material ?? "all");
  const [outcomes, setOutcomes] = useState<Set<OutcomeGroup>>(new Set(OUTCOMES));
  const [mark, setMark] = useState<Mark>(initial ?? { o2: 34, flow: 20, kpa: 56.5, label: "Exploration atmosphere A scenario" });
  const [active, setActive] = useState<EvidenceRecord | null>(null);
  const materials = useMemo(() => [...new Set(evidenceRecords.map((r) => r.material))].sort(), []);

  const shown = evidenceRecords.filter((r) => (material === "all" || r.material === material) && outcomes.has(r.outcome));
  const plotted = shown.filter((r) => r.oxygen != null && yOf(r, view) != null);
  const missing = shown.length - plotted.length;
  const my = view === "o2-flow" ? mark.flow : mark.kpa;
  const tolY = view === "o2-flow" ? Math.max(1, mark.flow * TOLERANCE.flowFraction) : TOLERANCE.pressureKpa;
  const inBox = plotted.filter((r) => Math.abs(r.oxygen! - mark.o2) <= TOLERANCE.oxygen && Math.abs(yOf(r, view)! - my) <= tolY);
  const box = { x0: sx(Math.max(X[0], mark.o2 - TOLERANCE.oxygen)), x1: sx(Math.min(X[1], mark.o2 + TOLERANCE.oxygen)), y0: sy(Math.min(Y[view][1], my + tolY), view), y1: sy(Math.max(Y[view][0], my - tolY), view) };
  const yLabel = view === "o2-flow" ? "Airflow (cm/s)" : "Pressure (kPa)";
  const yTicks = view === "o2-flow" ? [0, 5, 10, 15, 20, 25, 30] : [40, 55, 70, 85, 101.3];
  const toggle = (o: OutcomeGroup) => setOutcomes((s) => { const n = new Set(s); if (n.has(o)) n.delete(o); else n.add(o); return n.size ? n : s; });
  const pick = (r: EvidenceRecord) => { setActive(r); onPick?.(r); };
  const num = (k: "o2" | "flow" | "kpa", label: string, min: number, max: number, step: number) => (
    <label className={styles.num}>{label}<input type="number" min={min} max={max} step={step} value={mark[k]} onChange={(e) => e.target.value !== "" && setMark((m) => ({ ...m, [k]: Number(e.target.value), label: "Your condition" }))} /></label>
  );

  return (
    <div className={styles.space} data-compact={compact || undefined}>
      <div className={styles.toolbar}>
        <div role="group" aria-label="Chart view" className={styles.views}>
          <button type="button" aria-pressed={view === "o2-flow"} onClick={() => setView("o2-flow")}>Oxygen × airflow</button>
          <button type="button" aria-pressed={view === "o2-kpa"} onClick={() => setView("o2-kpa")}>Oxygen × pressure</button>
        </div>
        <label className={styles.num}>Material
          <select value={material} onChange={(e) => setMaterial(e.target.value)}><option value="all">All materials</option>{materials.map((m) => <option key={m}>{m}</option>)}</select>
        </label>
        {!compact && <fieldset className={styles.marker}><legend>Mission condition</legend>{num("o2", "O₂ %", 10, 36, 0.5)}{num("flow", "cm/s", 0, 30, 0.5)}{num("kpa", "kPa", 40, 110, 0.5)}</fieldset>}
      </div>
      <div role="group" aria-label="Show outcomes" className={styles.outcomes}>
        {OUTCOMES.map((o) => (
          <button type="button" key={o} aria-pressed={outcomes.has(o)} onClick={() => toggle(o)}><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="4.5" className={`${styles.glyph} ${styles[o]}`} /></svg>{GROUP_LABEL[o]}</button>
        ))}
        <span className={styles.shapes} aria-hidden="true">● BASS/BASS-II · ■ Saffire · ▲ LUCI (simulated lunar g)</span>
      </div>

      <div className={styles.body}>
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.chart} role="img" aria-labelledby="es-desc">
          <desc id="es-desc">{`${plotted.length} NASA test records plotted by oxygen and ${view === "o2-flow" ? "airflow" : "pressure"}. ${inBox.length ? `${inBox.length} lie within tolerance of the mission condition.` : "No record lies within tolerance of the mission condition."}`}</desc>
          {[10, 15, 20, 25, 30, 35].map((t) => <g key={t}><line className={styles.grid} x1={sx(t)} x2={sx(t)} y1={PAD.t} y2={H - PAD.b} /><text className={styles.tick} x={sx(t)} y={H - PAD.b + 16} textAnchor="middle">{t}</text></g>)}
          {yTicks.map((t) => <g key={t}><line className={styles.grid} x1={PAD.l} x2={W - PAD.r} y1={sy(t, view)} y2={sy(t, view)} /><text className={styles.tick} x={PAD.l - 8} y={sy(t, view) + 4} textAnchor="end">{t}</text></g>)}
          <text className={styles.axis} x={(W + PAD.l) / 2} y={H - 6} textAnchor="middle">Oxygen (% by volume)</text>
          <text className={styles.axis} transform={`translate(14 ${(H - PAD.b + PAD.t) / 2}) rotate(-90)`} textAnchor="middle">{yLabel}</text>

          <rect className={inBox.length ? styles.boxHit : styles.boxEmpty} x={box.x0} y={box.y0} width={Math.max(2, box.x1 - box.x0)} height={Math.max(2, box.y1 - box.y0)} />
          {plotted.map((r) => (
            <g key={r.id} tabIndex={0} role="button" aria-label={`${r.label}: ${r.material}, ${r.oxygen} % oxygen, ${yOf(r, view)} ${view === "o2-flow" ? "cm/s" : "kPa"}, ${r.outcomeLabel}`}
              onMouseEnter={() => setActive(r)} onFocus={() => setActive(r)} onClick={() => pick(r)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(r); } }} className={styles.pt}>
              <Glyph shape={SHAPE[r.family] ?? "circle"} x={sx(r.oxygen!)} y={sy(yOf(r, view)!, view)} outcome={r.outcome} active={active?.id === r.id} />
            </g>
          ))}
          <g className={styles.mark} aria-hidden="true">
            <circle cx={sx(mark.o2)} cy={sy(my, view)} r={11} /><line x1={sx(mark.o2) - 17} x2={sx(mark.o2) + 17} y1={sy(my, view)} y2={sy(my, view)} /><line x1={sx(mark.o2)} x2={sx(mark.o2)} y1={sy(my, view) - 17} y2={sy(my, view) + 17} />
          </g>
          {!inBox.length && <text className={styles.noEv} x={Math.min(W - PAD.r - 4, Math.max(PAD.l + 4, sx(mark.o2)))} y={Math.max(PAD.t + 12, box.y0 - 8)} textAnchor={sx(mark.o2) > W - 140 ? "end" : sx(mark.o2) < PAD.l + 140 ? "start" : "middle"}>No direct evidence here</text>}
        </svg>

        <aside className={styles.panel} aria-live="polite">
          <p className={styles.verdict} data-hit={inBox.length > 0}>
            {inBox.length ? `${inBox.length} test record${inBox.length === 1 ? "" : "s"} within tolerance` : "No direct evidence here"}
          </p>
          <p className={styles.small}>{mark.label ?? "Mission condition"}: {mark.o2} % O₂, {view === "o2-flow" ? `${mark.flow} cm/s` : `${mark.kpa} kPa`}. Box = ±{TOLERANCE.oxygen} pp oxygen, ±{view === "o2-flow" ? `${Math.round(TOLERANCE.flowFraction * 100)} % airflow` : `${TOLERANCE.pressureKpa} kPa`} (MicroFire tolerances). Gravity is not on this chart: every plotted point burned in orbit, except LUCI.</p>
          {active ? (
            <dl className={styles.rec}>
              <div><dt>Test</dt><dd>{active.label}</dd></div>
              <div><dt>Experiment</dt><dd>{FAMILIES[active.family].name}</dd></div>
              <div><dt>Material</dt><dd>{active.material}</dd></div>
              <div><dt>O₂</dt><dd>{active.oxygen ?? "not stated"} %</dd></div>
              <div><dt>Pressure</dt><dd>{kpaOf(active) ?? "not stated"}{kpaOf(active) != null ? " kPa" : ""}</dd></div>
              <div><dt>Airflow</dt><dd>{active.flowCmS ?? "not stated"}{active.flowCmS != null ? " cm/s" : ""}</dd></div>
              <div><dt>Gravity</dt><dd>{active.family === "luci" ? "lunar (simulated)" : active.gravity}</dd></div>
              <div><dt>Outcome</dt><dd>{active.outcomeLabel}</dd></div>
              {active.cite && <div><dt>Source</dt><dd><a className="link" href={pdfLink(active.cite.source_id, active.cite.pdf_page)} target="_blank" rel="noreferrer">{getSource(active.cite.source_id)?.title ?? active.cite.source_id}, PDF p. {active.cite.pdf_page}</a></dd></div>}
              <div><dt></dt><dd>{onPick ? <button type="button" className="link" onClick={() => onPick(active)}>Load this test</button> : <Link className="link" href={active.href}>Open the record</Link>}</dd></div>
            </dl>
          ) : <p className={styles.small}>Hover, focus or tap a point to read its record.</p>}
          {missing > 0 && <p className={styles.small}>{missing} matching record{missing === 1 ? "" : "s"} not plotted: {view === "o2-flow" ? "airflow" : "pressure"} not stated in the source.</p>}
        </aside>
      </div>
    </div>
  );
}
