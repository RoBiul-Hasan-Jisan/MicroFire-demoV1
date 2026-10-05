"use client";

import { FAMILIES, TOLERANCE, type EvidenceRecord, type FamilyId } from "@/lib/ontology";
import type { Gravity } from "@/lib/relevance";
import styles from "./ConditionInstrument.module.css";

/**
 * The coverage instrument: every condition control sits on top of the NASA evidence for that condition.
 * Each tick is one real test record at its recorded value; the shaded window is the ladder tolerance around
 * your setting. You see where NASA has data, and where your mission sits in empty space.
 */
type Scale = { min: number; max: number; log?: boolean };
const pos = (v: number, s: Scale) => {
  const t = s.log ? (Math.log(v) - Math.log(s.min)) / (Math.log(s.max) - Math.log(s.min)) : (v - s.min) / (s.max - s.min);
  return Math.max(0, Math.min(1, t)) * 1000;
};
const fromPos = (p: number, s: Scale) => (s.log ? Math.exp(Math.log(s.min) + (p / 1000) * (Math.log(s.max) - Math.log(s.min))) : s.min + (p / 1000) * (s.max - s.min));

type Tick = { v: number; v2?: number; family: FamilyId; id: string };

function Track({ label, unit, value, scale, step, ticks, window: [lo, hi], onChange, fmt = (v) => String(v), note }: {
  label: string; unit: string; value: number; scale: Scale; step: number; ticks: Tick[]; window: [number, number];
  onChange: (v: number) => void; fmt?: (v: number) => string; note: string;
}) {
  const inside = ticks.filter((t) => (t.v2 ?? t.v) >= lo && t.v <= hi);
  const fams = [...new Set(inside.map((t) => t.family))];
  // five evenly spaced marks (in log space for airflow), laid out with flexbox: no inline positions under the strict CSP
  const marks = [0, 250, 500, 750, 1000].map((p) => { const v = fromPos(p, scale); return v < 10 ? Math.round(v * 10) / 10 : Math.round(v); });
  return (
    <div className={styles.row} data-covered={inside.length > 0}>
      <div className={styles.head}>
        <span className={styles.label}>{label}</span>
        <output className={styles.value}>{fmt(value)} <small>{unit}</small></output>
      </div>
      <div className={styles.track}>
        <svg viewBox="0 0 1000 56" preserveAspectRatio="none" className={styles.svg} aria-hidden="true">
          <rect x="0" y="22" width="1000" height="12" rx="6" className={styles.rail} />
          <rect x={pos(lo, scale)} y="6" width={Math.max(4, pos(hi, scale) - pos(lo, scale))} height="44" rx="4" className={styles.window} />
          {ticks.map((t) => {
            const x1 = pos(t.v, scale), x2 = t.v2 != null ? pos(t.v2, scale) : x1;
            const hit = (t.v2 ?? t.v) >= lo && t.v <= hi;
            return x2 - x1 > 3
              ? <rect key={t.id} x={x1} y={hit ? 12 : 18} width={x2 - x1} height={hit ? 32 : 20} rx="2" className={styles.tick} data-family={t.family} data-hit={hit} />
              : <rect key={t.id} x={x1 - 1.5} y={hit ? 12 : 18} width="3" height={hit ? 32 : 20} rx="1.5" className={styles.tick} data-family={t.family} data-hit={hit} />;
          })}
          <line x1={pos(value, scale)} x2={pos(value, scale)} y1="2" y2="54" className={styles.marker} />
        </svg>
        <input
          type="range" min={0} max={1000} step={1} value={pos(value, scale)}
          aria-label={`${label}, ${fmt(value)} ${unit}`} aria-valuetext={`${fmt(value)} ${unit}`}
          onChange={(e) => { const raw = fromPos(Number(e.target.value), scale); onChange(Math.round(raw / step) * step); }}
          onKeyDown={(e) => {
            // keyboard moves in real units (one step, or ten with Page keys), not in 1/1000ths of the track
            const by = { ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step, PageDown: -10 * step, PageUp: 10 * step } as Record<string, number>;
            const clamp = (v: number) => Math.min(scale.max, Math.max(scale.min, Math.round(v / step) * step));
            if (e.key in by) { e.preventDefault(); onChange(clamp(value + by[e.key])); }
            else if (e.key === "Home") { e.preventDefault(); onChange(clamp(scale.min)); }
            else if (e.key === "End") { e.preventDefault(); onChange(clamp(scale.max)); }
          }}
          className={styles.range}
        />
        <div className={styles.scale} aria-hidden="true">
          {marks.map((m) => <span key={m}>{m}</span>)}
        </div>
      </div>
      <p className={styles.status}>
        {inside.length
          ? <><strong>{inside.length}</strong> record{inside.length === 1 ? "" : "s"} within {note}{fams.length ? ` · ${fams.map((f) => FAMILIES[f].name).join(", ")}` : ""}</>
          : <><strong>No record</strong> within {note}. Your setting is outside the tested ground.</>}
      </p>
    </div>
  );
}

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { v: T; text: string; count: number; note?: string }[]; onChange: (v: T) => void }) {
  const cur = options.find((o) => o.v === value);
  return (
    <div className={styles.row} data-covered={(cur?.count ?? 0) > 0}>
      <div className={styles.head}><span className={styles.label}>{label}</span></div>
      <div className={styles.choices} role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o.v} role="radio" aria-checked={o.v === value} className={styles.choice} data-empty={o.count === 0} onClick={() => onChange(o.v)}>
            <span>{o.text}</span>
            <small>{o.count} record{o.count === 1 ? "" : "s"}</small>
          </button>
        ))}
      </div>
      <p className={styles.status}>
        {cur && cur.count > 0 ? <><strong>{cur.count}</strong> record{cur.count === 1 ? "" : "s"} {cur.note ?? ""}</> : <><strong>No test record</strong> {cur?.note ?? "for this choice"}.</>}
      </p>
    </div>
  );
}

export type InstrumentForm = { oxygen: number; flow: number; pressureKpa: number; gravity: Gravity; material: string; flowDirection: string };

export function ConditionInstrument({ form, set, records, joint }: {
  form: InstrumentForm;
  set: <K extends keyof InstrumentForm>(k: K, v: InstrumentForm[K]) => void;
  records: EvidenceRecord[];
  joint: number;
}) {
  const o2Ticks = records.flatMap((r) => (r.oxygen == null ? [] : [{ v: r.oxygen, family: r.family, id: r.id }]));
  const pTicks = records.flatMap((r) => (r.pressureKpa == null ? [] : [{ v: r.pressureKpa[0], v2: r.pressureKpa[1], family: r.family, id: r.id }]));
  const fTicks = records.flatMap((r) => (r.flowCmS == null ? [] : [{ v: r.flowCmS, family: r.family, id: r.id }]));
  const fTol = Math.max(1, form.flow * TOLERANCE.flowFraction);
  const count = (f: (r: EvidenceRecord) => boolean) => records.filter(f).length;
  const materials = ["any", ...[...new Set(records.map((r) => r.material))].sort()];
  return (
    <div className={styles.instrument}>
      <Track label="Oxygen" unit="%" value={form.oxygen} scale={{ min: 14, max: 36 }} step={0.5} ticks={o2Ticks} window={[form.oxygen - TOLERANCE.oxygen, form.oxygen + TOLERANCE.oxygen]} onChange={(v) => set("oxygen", v)} note={`±${TOLERANCE.oxygen} points`} />
      <Track label="Cabin pressure" unit="kPa" value={form.pressureKpa} scale={{ min: 50, max: 104 }} step={0.5} ticks={pTicks} window={[form.pressureKpa - TOLERANCE.pressureKpa, form.pressureKpa + TOLERANCE.pressureKpa]} onChange={(v) => set("pressureKpa", v)} note={`±${TOLERANCE.pressureKpa} kPa`} />
      <Choice
        label="Gravity" value={form.gravity} onChange={(v) => set("gravity", v)}
        options={[
          { v: "microgravity", text: "Orbit (microgravity)", count: count((r) => r.gravity === "microgravity"), note: "ran in orbit" },
          { v: "lunar", text: "Moon (1/6 g)", count: count((r) => r.gravity === "lunar"), note: "at lunar gravity, simulated on a spinning rocket (LUCI)" },
          { v: "martian", text: "Mars (3/8 g)", count: count((r) => r.gravity === "martian"), note: "at Martian gravity: only short drop-tower findings exist" },
        ]}
      />
      <Choice
        label="Material" value={form.material} onChange={(v) => set("material", v)}
        options={materials.map((m) => ({ v: m, text: m === "any" ? "Any material" : m, count: m === "any" ? records.length : count((r) => r.material === m), note: m === "any" ? "of any material" : `of ${m}` }))}
      />
      <Track label="Airflow" unit="cm/s" value={form.flow} scale={{ min: 0.5, max: 50, log: true }} step={0.5} ticks={fTicks} window={[form.flow - fTol, form.flow + fTol]} onChange={(v) => set("flow", Math.max(0.5, v))} note={`±${TOLERANCE.flowFraction * 100} % of your airflow`} />
      <p className={styles.joint} data-zero={joint === 0}>
        <span>All conditions together</span>
        <strong>{joint}</strong> record{joint === 1 ? "" : "s"} {joint === 0 ? "— each condition may be tested somewhere, but never all at once" : "match every condition"}
      </p>
      <p className={styles.legend}>
        <span data-family="bass2">BASS and BASS-II</span><span data-family="saffire">Saffire</span><span data-window>Tolerance window</span> Each tick is one NASA test record at its recorded value.
      </p>
    </div>
  );
}
