"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Chamber, type Phase, type Shown } from "./Chamber";
import { Chamber3D } from "./Chamber3D";
import { EvidenceSpace } from "@/components/EvidenceSpace";
import { buildEvidence } from "@/lib/ask-core";
import { evidenceRecords, experiments, findings, getSource, luciRuns, pdfLink, saffireRuns } from "@/lib/data";
import {
  assess, CLASS_LABEL, detectiveAnswer, differing, DIM_NAME, explain, GRAVITY_LABEL, MISSIONS, PATCHES, PRESETS, recordRun,
  type DimRow, type DimStatus, type EvidenceClass, type LabConfig, type LabGravity, type Run,
} from "@/lib/flame-lab";
import { gate, predict, STATUS_LABEL, type Snapshot } from "@/lib/model-lab";
import { MEDIA_CONTEXT } from "@/lib/media";
import { FAMILIES, type EvidenceRecord } from "@/lib/ontology";
import styles from "./FlameLab.module.css";

type Mode = "explorer" | "scientist";
type Tab = "notebook" | "compare" | "map" | "missions" | "media";
type Saved = { runs: Run[]; pins: string[]; mode: Mode; fast: boolean; solved: string[] };
const KEY = "microfire-flame-lab-v1";
const load = (): Partial<Saved> => { try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; } };
const save = (s: Saved) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode: the lab still works for this visit */ } };

const MATERIALS: { id: string; explorer: string }[] = [
  { id: "PMMA", explorer: "PMMA (acrylic plastic)" },
  { id: "SIBAL fabric", explorer: "Cotton/fiberglass fabric" },
  { id: "Nomex", explorer: "Nomex (fire-resistant fabric)" },
  { id: "Silicone", explorer: "Silicone" },
  { id: "Cotton jersey", explorer: "Cotton jersey" },
];
const GRAVS: { id: LabGravity; label: string; glyph: string }[] = [
  { id: "earth", label: "Earth", glyph: "1 g" }, { id: "moon", label: "Moon", glyph: "⅙ g" }, { id: "mars", label: "Mars", glyph: "⅜ g" }, { id: "orbit", label: "Orbit", glyph: "≈0 g" },
];
const FLOWS = [{ v: 0, l: "Still" }, { v: 2, l: "Low" }, { v: 5, l: "Medium" }, { v: 10, l: "High" }];
const PRESSURES = [{ v: 101.3, l: "101.3 (ISS)" }, { v: 70, l: "70" }, { v: 56.5, l: "56.5" }];
const O2S = [16, 21, 30, 34];
const MARK: Record<DimStatus, string> = { match: "●", close: "◐", outside: "○", unknown: "?" };
const WORD: Record<DimStatus, string> = { match: "Match", close: "Close", outside: "Outside range", unknown: "Not stated" };
const METER: Record<EvidenceClass, number> = { direct: 4, analog: 3, mechanistic: 2, none: 1 };
/** Why the largest mismatch matters, stated without claiming an outcome. */
const WHY_MATTERS: Record<DimRow["dim"], string> = {
  Gravity: "Gravity decides whether hot gas rises away from the flame, so a test in another gravity is a different physical regime, not a nearby value.",
  Material: "Each material burns differently; a result for one material does not transfer to another.",
  Oxygen: "No test in this atlas reached this oxygen level, so its effect on this flame is untested here.",
  Pressure: "NASA burned samples below sea-level pressure only in Saffire IV–VI; flames at this pressure are not covered for this setup.",
  Airflow: "NASA found flames especially sensitive to airflow at low speeds, so a different flow is not a safe stand-in.",
};
const SEQ: Phase[] = ["config", "atmosphere", "airflow", "ignition", "analyzing", "result"];
const SEQ_MS = 380;

const modelQuery = (c: LabConfig) => ({ material: c.material, o2: c.o2, kpa: c.kpa, flow: c.flow, gravity: c.gravity === "orbit" ? "microgravity" as const : c.gravity === "moon" ? "lunar" as const : c.gravity === "mars" ? "martian" as const : "earth" as const });
const cfgFromRecord = (r: EvidenceRecord): LabConfig => ({
  gravity: r.family === "luci" ? "moon" : "orbit", material: r.material, o2: r.oxygen ?? 21, flow: r.flowCmS ?? 0,
  kpa: r.pressureKpa ? Math.round(((r.pressureKpa[0] + r.pressureKpa[1]) / 2) * 10) / 10 : 101.3,
});

export function FlameLab({ snap }: { snap: Snapshot }) {
  const [cfg, setCfg] = useState<LabConfig>(PRESETS[2].cfg);
  const [mode, setMode] = useState<Mode>("explorer");
  const [phase, setPhase] = useState<Phase>("idle");
  const [shown, setShown] = useState<Shown>(null);
  const [fast, setFast] = useState(false);
  const [runs, setRuns] = useState<Run[]>([]);
  const [pins, setPins] = useState<string[]>([]);
  const [solved, setSolved] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab | null>(null);
  const [sheet, setSheet] = useState<"setup" | "analysis" | null>(null);
  const [help, setHelp] = useState(false);
  const [ask, setAsk] = useState(false);
  const [lock, setLock] = useState<keyof LabConfig>("flow");
  const [pulse, setPulse] = useState(0);
  const [guess, setGuess] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  const ready = useRef(false);

  // restore once from storage (only readable after mount), then persist every change
  useEffect(() => {
    const s = load();
    /* eslint-disable react-hooks/set-state-in-effect -- one-time restore from storage */
    if (s.runs) setRuns(s.runs); if (s.pins) setPins(s.pins); if (s.mode) setMode(s.mode); if (s.fast != null) setFast(s.fast); if (s.solved) setSolved(s.solved);
    /* eslint-enable react-hooks/set-state-in-effect */
    ready.current = true;
  }, []);
  useEffect(() => { if (ready.current) save({ runs, pins, mode, fast, solved }); }, [runs, pins, mode, fast, solved]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const a = useMemo(() => assess(cfg, evidenceRecords, findings), [cfg]);
  const why = useMemo(() => explain(cfg), [cfg]);
  const ml = useMemo(() => ({ g: gate(snap, modelQuery(cfg)), p: predict(snap, modelQuery(cfg)) }), [snap, cfg]);
  const missionsDone = useMemo(() => new Set([...MISSIONS.filter((m) => m.done(runs)).map((m) => m.id), ...solved]), [runs, solved]);
  const patches = PATCHES.filter((p) => p.earned(runs, missionsDone));
  const sci = mode === "scientist";
  const findingById = (id: string) => findings.find((f) => f.id === id);
  const lastRun = runs[runs.length - 1];
  const resultIsCurrent = phase === "result" && lastRun && JSON.stringify(lastRun.cfg) === JSON.stringify(cfg);

  const set = <K extends keyof LabConfig>(k: K, v: LabConfig[K]) => { setCfg((c) => ({ ...c, [k]: v })); if (phase === "result") { setPhase("idle"); setShown(null); } };
  const loadCfg = (c: LabConfig) => { setCfg(c); setPhase("idle"); setShown(null); };

  const run = () => {
    timers.current.forEach(clearTimeout); timers.current = [];
    const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finish = () => {
      setShown({ visual: a.visual, group: a.observed?.group ?? null, blowoff: !!a.direct[0] && /blow/i.test(a.direct[0].outcomeLabel) });
      setPhase("result"); setPulse((x) => x + 1);
      setRuns((rs) => [...rs, recordRun((rs[rs.length - 1]?.n ?? 0) + 1, cfg, a)]);
    };
    if (fast || reduced) { finish(); return; }
    SEQ.slice(0, -1).forEach((p, i) => timers.current.push(window.setTimeout(() => setPhase(p), i * SEQ_MS)));
    timers.current.push(window.setTimeout(finish, (SEQ.length - 1) * SEQ_MS));
  };
  const reset = () => { timers.current.forEach(clearTimeout); loadCfg(PRESETS[2].cfg); };
  const pin = (id: string) => setPins((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(-4)));
  const pinned = runs.filter((r) => pins.includes(r.id));
  const media = cfg.material === "PMMA" ? "saffire-vi-pmma" : cfg.gravity === "orbit" && cfg.o2 < 20 ? "bass2-reduced-o2-gmt213" : "bass-cassidy-2013";
  const askQ = `What does NASA evidence say about ${cfg.material} at ${cfg.o2} % oxygen, ${cfg.kpa} kPa and ${cfg.flow} cm/s airflow in ${cfg.gravity === "orbit" ? "microgravity" : cfg.gravity === "moon" ? "lunar gravity" : cfg.gravity === "mars" ? "Martian gravity" : "Earth gravity"}?`;
  const askEv = useMemo(() => (ask ? buildEvidence(askQ, experiments, findings, saffireRuns, luciRuns) : null), [ask, askQ]);
  const edge = a.cls === "mechanistic" || a.cls === "none";

  const stateTag = phase !== "result" || !shown ? (phase === "idle" ? "Ready: press Run experiment" : "Running…")
    : shown.visual === "nasa" ? `NASA observation · ${a.direct[0]?.label ?? ""}` : shown.visual === "conceptual" ? "Conceptual visualization" : "Insufficient experimental evidence";

  /* ---------------- panels ---------------- */
  const setup = (
    <div className={styles.controls}>
      <section aria-labelledby="lab-presets">
        <h2 id="lab-presets" className={styles.h}>Mission presets</h2>
        <div className={styles.presets}>
          {PRESETS.map((p) => <button type="button" key={p.id} onClick={() => loadCfg(p.cfg)} aria-pressed={JSON.stringify(p.cfg) === JSON.stringify(cfg)}><b>{p.label}</b><small>{p.note}</small></button>)}
        </div>
      </section>
      <fieldset className={styles.seg4}>
        <legend className={styles.h}>Gravity</legend>
        {GRAVS.map((g) => <label key={g.id}><input type="radio" name="lab-g" checked={cfg.gravity === g.id} onChange={() => set("gravity", g.id)} /><b>{g.label}</b><small>{g.glyph}</small></label>)}
      </fieldset>
      <div className={styles.field}>
        <p className={styles.h} id="lab-o2">Oxygen <output className="num">{cfg.o2} %</output></p>
        <input type="range" min={10} max={40} step={0.5} value={cfg.o2} onChange={(e) => set("o2", Number(e.target.value))} aria-labelledby="lab-o2" />
        <div className={styles.chips}>{O2S.map((v) => <button type="button" key={v} aria-pressed={cfg.o2 === v} onClick={() => set("o2", v)}>{v} %</button>)}{sci && <input type="number" min={10} max={40} step={0.1} value={cfg.o2} onChange={(e) => e.target.value !== "" && set("o2", Number(e.target.value))} aria-label="Oxygen, percent by volume" />}</div>
      </div>
      <div className={styles.field}>
        <p className={styles.h} id="lab-flow">Airflow <output className="num">{cfg.flow} cm/s</output></p>
        <div className={styles.chips}>{FLOWS.map((f) => <button type="button" key={f.v} aria-pressed={cfg.flow === f.v} onClick={() => set("flow", f.v)}>{f.l}</button>)}</div>
        {sci && <><input type="range" min={0} max={25} step={0.5} value={cfg.flow} onChange={(e) => set("flow", Number(e.target.value))} aria-labelledby="lab-flow" /><input className={styles.numIn} type="number" min={0} max={25} step={0.1} value={cfg.flow} onChange={(e) => e.target.value !== "" && set("flow", Number(e.target.value))} aria-label="Airflow in cm/s" /></>}
      </div>
      <div className={styles.field}>
        <p className={styles.h} id="lab-kpa">Pressure <output className="num">{cfg.kpa} kPa</output></p>
        <div className={styles.chips}>{PRESSURES.map((p) => <button type="button" key={p.v} aria-pressed={cfg.kpa === p.v} onClick={() => set("kpa", p.v)}>{p.l}</button>)}</div>
        {sci && <input type="range" min={40} max={105} step={0.5} value={cfg.kpa} onChange={(e) => set("kpa", Number(e.target.value))} aria-labelledby="lab-kpa" />}
        <small className={styles.note}>NASA tests in this atlas span 54–101 kPa (Saffire IV–VI and BASS-II).</small>
      </div>
      <fieldset className={styles.materials}>
        <legend className={styles.h}>Material</legend>
        {MATERIALS.map((m) => <label key={m.id}><input type="radio" name="lab-m" checked={cfg.material === m.id} onChange={() => set("material", m.id)} />{sci ? m.id : m.explorer}<small>{evidenceRecords.filter((r) => r.material === m.id).length} NASA tests</small></label>)}
      </fieldset>
    </div>
  );

  const matchCard = a.closest && (
    <section className={styles.card} aria-labelledby="lab-match" data-cls={a.cls} key={`m${pulse}`}>
      <p className={styles.acq}>{a.cls === "direct" ? "NASA evidence acquired" : "Evidence boundary reached"}</p>
      <h2 id="lab-match" className={styles.cardTitle}>{a.cls === "direct" ? "NASA evidence match" : "No direct NASA test"}</h2>
      <p className={styles.recName}>{a.cls === "direct" ? "" : "Closest evidence: "}<Link className="link" href={(a.cls === "direct" ? a.direct[0] : a.closest).href}>{(a.cls === "direct" ? a.direct[0] : a.closest).label}</Link></p>
      <p className={styles.small}>{FAMILIES[a.closest.family].name}{a.closest.caveat ? ` · ${a.closest.caveat}` : ""}</p>
      <div className={styles.distance} aria-label="Your condition compared with this NASA test">
        <p className={styles.distHead}><span>Your condition</span><span aria-hidden="true">↓</span><span>NASA test</span></p>
        <ul>
          {a.rows.map((r: DimRow) => (
            <li key={r.dim} data-status={r.status}>
              <span>{r.dim}</span>
              <span className={styles.mark} aria-hidden="true">{MARK[r.status]}</span>
              <span>{WORD[r.status]}{sci && r.delta && r.status !== "match" ? ` · ${r.delta}` : ""}</span>
              {sci && <small>{r.you} vs {r.nasa}</small>}
            </li>
          ))}
        </ul>
        {a.largest && <p className={styles.small}>Largest uncertainty: <b>{a.largest}</b></p>}
        <p className={styles.heur}>MicroFire evidence-matching heuristic, not a NASA score.</p>
      </div>
      {a.cls === "direct" && a.observed && <p className={styles.observed}><b>NASA recorded:</b> {a.observed.label}</p>}
      {a.cls === "direct" && a.direct.length > 1 && <p className={styles.small}>{a.direct.length} NASA tests match these settings.</p>}
      {a.cls !== "direct" && <p className={styles.restraint}>We cannot claim an experimental outcome for this condition.</p>}
      {a.closest.cite && <p className={styles.small}>Source: <a className="link" href={pdfLink(a.closest.cite.source_id, a.closest.cite.pdf_page)} target="_blank" rel="noreferrer">{getSource(a.closest.cite.source_id)?.title}, PDF p. {a.closest.cite.pdf_page}</a></p>}
    </section>
  );

  const analysis = (
    <div className={styles.analysis}>
      <div className={styles.meter} data-cls={a.cls} aria-label={`Evidence class: ${CLASS_LABEL[a.cls]}`}>
        <span className={styles.bars} aria-hidden="true">{[1, 2, 3, 4].map((i) => <i key={i} data-on={i <= METER[a.cls] || undefined} />)}</span>
        <b>{CLASS_LABEL[a.cls]}</b>
      </div>
      {edge && (
        <section className={styles.edge} aria-labelledby="lab-edge">
          <h2 id="lab-edge">You have reached the edge of the evidence.</h2>
          <p>NASA&apos;s records in MicroFire Atlas do not directly cover this condition.</p>
          <ol>
            <li><b>Closest evidence</b> {a.closest ? a.closest.label : "none"}</li>
            <li><b>What is different</b> {a.rows.filter((r) => r.status === "outside").map((r) => r.dim.toLowerCase()).join(", ") || (cfg.gravity === "earth" ? "gravity: every test here burned in orbit or simulated lunar gravity" : "several conditions")}</li>
            <li><b>Why it matters</b> {WHY_MATTERS[cfg.gravity === "earth" ? "Gravity" : a.largest ?? "Gravity"]}</li>
            <li><b>What could close the gap</b> {a.next ?? a.gaps[0]}</li>
          </ol>
          <Link className={styles.cta} href="/gaps#research-planning">Open the Research Frontier</Link>
        </section>
      )}
      {matchCard}
      <section className={styles.card} aria-labelledby="lab-why">
        <h2 id="lab-why" className={styles.cardTitle}>Why did this happen?</h2>
        {why.map((w, i) => (
          <div key={i} className={styles.why}>
            <p>{sci ? w.scientist : w.explorer}</p>
            <p className={styles.small}>
              {w.findingIds.map((id) => { const f = findingById(id); return f ? <a key={id} className="link" href={pdfLink(f.source_id, f.pdf_page)} target="_blank" rel="noreferrer">{sci ? `“${f.quote.slice(0, 80)}…” (${getSource(f.source_id)?.title?.slice(0, 40)}…${f.pdf_page ? `, p. ${f.pdf_page}` : ""})` : `From NASA: ${getSource(f.source_id)?.title?.slice(0, 48)}…`}</a> : null; }).reduce<React.ReactNode[]>((acc, x, j) => (x ? [...acc, j ? " · " : "", x] : acc), [])}
            </p>
          </div>
        ))}
        <p className={styles.heur}>{a.visual === "nasa" ? "The flame drawing illustrates NASA's recorded outcome; it is not footage." : a.visual === "conceptual" ? "The flame is a conceptual illustration of established physics, not a prediction." : "No flame is drawn: there is no matching experimental evidence."}</p>
      </section>
      {sci && (
        <section className={styles.card} aria-labelledby="lab-ml">
          <h2 id="lab-ml" className={styles.cardTitle}>Evidence-bounded ML</h2>
          <p><b>{STATUS_LABEL[ml.g.status]}</b>{ml.p ? `: ${Math.round(ml.p.p * 100)} % (90 % interval ${Math.round(ml.p.lo * 100)}–${Math.round(ml.p.hi * 100)} %) that a flame is established in a BASS-II-style test` : ": prediction blocked"}</p>
          {!ml.p && <ul className={styles.small}>{ml.g.checks.filter((c) => c.status === "out" || c.status === "insufficient").slice(0, 3).map((c) => <li key={c.dim}>{c.dim}: {c.text}</li>)}</ul>}
          <Link className="link text-sm" href="/model-lab">Model card and validation</Link>
        </section>
      )}
      <section className={styles.card} aria-labelledby="lab-ask">
        <h2 id="lab-ask" className={styles.cardTitle}>Ask about this experiment</h2>
        {!ask ? <button type="button" className={styles.ghostBtn} onClick={() => setAsk(true)}>Retrieve NASA evidence for this setup</button> : (
          <div className={styles.askBox}>
            <p className={styles.small}>Question: {askQ}</p>
            <p className={styles.h}>Retrieved evidence (deterministic, before any AI)</p>
            <ul>{askEv?.items.slice(0, 5).map((it) => <li key={it.key}><Link className="link" href={it.href}>{it.title}</Link></li>)}</ul>
            {askEv && askEv.outside.length > 0 && <p className={styles.small}>Not covered: {askEv.outside[0]}</p>}
            <p className={styles.small}>AI explanation: live synthesis is paused on the public site. Every AI claim is checked against this evidence before it is shown.</p>
            <Link className="link text-sm" href={`/ask?q=${encodeURIComponent(askQ)}`}>Open in Ask</Link>
          </div>
        )}
      </section>
    </div>
  );

  /* ---------------- dock ---------------- */
  const notebook = (
    <div className={styles.notebook}>
      {runs.length === 0 ? <p className={styles.empty}>No runs yet. Configure the chamber and press Run experiment. Every run is recorded here, including the ones where MicroFire refuses to infer an outcome.</p> : (
        <ol>
          {[...runs].reverse().map((r) => (
            <li key={r.id} data-abstained={r.abstained || undefined}>
              <p className={styles.runN}>Run {String(r.n).padStart(3, "0")}</p>
              <p>{GRAVITY_LABEL[r.cfg.gravity]} · {r.cfg.o2} % O₂ · {r.cfg.kpa} kPa · {r.cfg.flow} cm/s · {r.cfg.material}</p>
              <p><b>Evidence:</b> {CLASS_LABEL[r.cls]}</p>
              <p><b>Result:</b> {r.abstained ? <span className={styles.abst}>Insufficient evidence: abstained</span> : r.result}</p>
              {r.ref && <p className={styles.small}>{r.cls === "direct" ? "NASA reference" : "Closest evidence"}: {r.refHref ? <Link className="link" href={r.refHref}>{r.ref}</Link> : r.ref}</p>}
              <div className={styles.runActions}>
                <button type="button" onClick={() => loadCfg(r.cfg)}>Load</button>
                <button type="button" aria-pressed={pins.includes(r.id)} onClick={() => pin(r.id)}>{pins.includes(r.id) ? "Pinned" : "Pin to compare"}</button>
              </div>
            </li>
          ))}
        </ol>
      )}
      {runs.length > 0 && <button type="button" className={styles.ghostBtn} onClick={() => { setRuns([]); setPins([]); }}>Clear notebook</button>}
    </div>
  );

  const diffs = differing(pinned);
  const compare = (
    <div className={styles.compare}>
      {pinned.length < 2 ? <p className={styles.empty}>Pin two to four runs from the Notebook to compare them side by side.</p> : <>
        <div className={styles.lockRow}>
          <label>Lock everything except
            <select value={lock} onChange={(e) => setLock(e.target.value as keyof LabConfig)}>{(Object.keys(DIM_NAME) as (keyof LabConfig)[]).map((k) => <option key={k} value={k}>{DIM_NAME[k]}</option>)}</select>
          </label>
          <p data-fair={diffs.length === 1 && diffs[0] === lock}>{diffs.length === 1 && diffs[0] === lock ? `Fair comparison: only ${DIM_NAME[lock].toLowerCase()} changes.` : diffs.length === 0 ? "These runs are identical." : `Not a fair test of ${DIM_NAME[lock].toLowerCase()}: ${diffs.filter((d) => d !== lock).map((d) => DIM_NAME[d].toLowerCase()).join(", ") || "it does not change"}${diffs.some((d) => d !== lock) ? " also change" : ""}.`}</p>
        </div>
        <div className={styles.cols}>
          {pinned.map((r, i) => {
            const ra = assess(r.cfg, evidenceRecords, findings);
            return (
              <div key={r.id} className={styles.col}>
                <p className={styles.runN}>Run {String.fromCharCode(65 + i)} · {String(r.n).padStart(3, "0")}</p>
                <Chamber cfg={r.cfg} phase="result" shown={{ visual: ra.visual, group: ra.observed?.group ?? null, blowoff: !!ra.direct[0] && /blow/i.test(ra.direct[0].outcomeLabel) }} compact />
                <dl>
                  {(Object.keys(DIM_NAME) as (keyof LabConfig)[]).map((k) => <div key={k} data-diff={diffs.includes(k) || undefined}><dt>{DIM_NAME[k]}</dt><dd>{k === "gravity" ? GRAVITY_LABEL[r.cfg.gravity] : String(r.cfg[k])}</dd></div>)}
                  <div><dt>Evidence</dt><dd>{CLASS_LABEL[r.cls]}</dd></div>
                  <div><dt>NASA analogue</dt><dd>{r.ref ?? "none"}</dd></div>
                  <div><dt>Observed</dt><dd>{r.abstained ? "Abstained" : r.result}</dd></div>
                </dl>
              </div>
            );
          })}
        </div>
      </>}
    </div>
  );

  const det = detectiveAnswer(evidenceRecords, findings);
  const missions = (
    <div className={styles.missions}>
      <ol>
        {MISSIONS.map((m, i) => (
          <li key={m.id} data-done={missionsDone.has(m.id) || undefined}>
            <p className={styles.runN}>Mission {String(i + 1).padStart(2, "0")} {missionsDone.has(m.id) ? "· complete" : ""}</p>
            <h3>{m.title}</h3>
            <p>{m.goal}</p>
            {m.id === "detective" && !missionsDone.has(m.id) && (
              <div className={styles.chips}>{(["Gravity", "Material", "Oxygen", "Pressure", "Airflow"] as const).map((d) => <button type="button" key={d} aria-pressed={guess === d} onClick={() => { setGuess(d); if (d === det) setSolved((s) => [...new Set([...s, "detective"])]); }}>{d}</button>)}</div>
            )}
            {m.id === "detective" && guess && guess !== det && !missionsDone.has(m.id) && <p className={styles.small}>Not quite. Run the lunar habitat preset and read “Largest uncertainty” in the evidence card.</p>}
            {missionsDone.has(m.id) && <p className={styles.lesson}>{m.id === "detective" ? `${det}. ` : ""}{m.lesson}</p>}
          </li>
        ))}
      </ol>
      <h3 className={styles.h}>{sci ? "Milestones" : "Mission patches"}</h3>
      <ul className={styles.patches}>
        {PATCHES.map((p) => <li key={p.id} data-earned={patches.includes(p) || undefined}><b>{sci ? (patches.includes(p) ? "✓ " : "○ ") : ""}{p.name}</b><small>{p.why}</small></li>)}
      </ul>
    </div>
  );

  const mc = MEDIA_CONTEXT[media];
  const mediaView = (
    <div className={styles.split}>
      <figure>
        <figcaption><b>Illustration</b> · {shown?.visual === "nasa" ? "drawn from NASA's recorded outcome" : "conceptual, not a measurement"}</figcaption>
        <Chamber cfg={cfg} phase={phase === "result" ? "result" : "idle"} shown={shown} compact />
      </figure>
      <figure>
        <figcaption><b>NASA footage</b> · {mc?.label}</figcaption>
        {media.startsWith("saffire")
          ? <video src={`/media/${media}/video.mp4`} poster={`/media/${media}/poster.jpg`} controls muted playsInline preload="none" className={styles.video} />
          // eslint-disable-next-line @next/next/no-img-element -- static NASA image
          : <img src={`/media/${media}/image.jpg`} alt={mc?.label ?? "NASA flame"} className={styles.video} />}
        <p className={styles.small}>{mc?.experiment}. {mc?.unknown} Not matched to your settings.</p>
      </figure>
    </div>
  );

  const TABS: { id: Tab; label: string }[] = [
    { id: "notebook", label: `Notebook${runs.length ? ` (${runs.length})` : ""}` }, { id: "compare", label: `Compare${pins.length ? ` (${pins.length})` : ""}` },
    { id: "map", label: "Evidence map" }, { id: "missions", label: "Missions" }, { id: "media", label: "Real NASA flame" },
  ];

  return (
    <div className={styles.lab} data-mode={mode}>
      <header className={styles.top}>
        <p className={styles.brand}>MicroFire Flame Lab</p>
        <div role="radiogroup" aria-label="Presentation" className={styles.modes}>
          {(["explorer", "scientist"] as Mode[]).map((m) => <button type="button" role="radio" aria-checked={mode === m} key={m} onClick={() => setMode(m)}>{m === "explorer" ? "Explorer" : "Scientist"}</button>)}
        </div>
        <p className={styles.indicator} data-cls={a.cls}><span aria-hidden="true">{a.cls === "direct" ? "●" : a.cls === "analog" ? "◐" : "○"}</span> {CLASS_LABEL[a.cls]}</p>
        <p className={styles.status} aria-live="polite">{phase === "idle" ? "Ready" : phase === "result" ? (resultIsCurrent ? "Result" : "Ready") : "Running"}</p>
        <label className={styles.fast}><input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} /> Fast runs</label>
        <button type="button" onClick={reset}>Reset</button>
        <button type="button" onClick={() => setHelp(true)}>Help</button>
        <Link href="/" className={styles.exit}>Exit Lab</Link>
      </header>

      <aside className={styles.left} data-open={sheet === "setup" || undefined} aria-label="Experiment configuration">
        <button type="button" className={styles.sheetClose} onClick={() => setSheet(null)}>Close</button>
        {setup}
        <div className={styles.actions}>
          <button type="button" className={styles.run} onClick={() => { run(); setSheet(null); }} disabled={phase !== "idle" && phase !== "result"}>Run experiment</button>
          <button type="button" onClick={() => { if (lastRun) { pin(lastRun.id); setTab("compare"); } }} disabled={!lastRun}>Compare</button>
          <button type="button" onClick={() => setTab("notebook")} disabled={!lastRun}>Saved: {runs.length} runs</button>
        </div>
      </aside>

      <section className={styles.center} aria-label="Combustion chamber">
        <div className={styles.hud} aria-live="polite">
          <dl>
            <div><dt>Gravity</dt><dd>{GRAVITY_LABEL[cfg.gravity]}</dd></div>
            <div><dt>O₂</dt><dd className="num">{cfg.o2} %</dd></div>
            <div><dt>Pressure</dt><dd className="num">{cfg.kpa} kPa</dd></div>
            <div><dt>Airflow</dt><dd className="num">{cfg.flow} cm/s</dd></div>
            <div><dt>Material</dt><dd>{sci ? cfg.material : MATERIALS.find((m) => m.id === cfg.material)?.explorer}</dd></div>
          </dl>
          <p className={styles.tag} data-visual={phase === "result" ? shown?.visual : "idle"}>{stateTag}</p>
        </div>
        <div className={styles.stage}>
          <Chamber3D cfg={cfg} phase={phase} shown={shown} />
          {phase === "analyzing" && <div className={styles.scan} aria-hidden="true" />}
          {phase !== "idle" && phase !== "result" && (
            <div className={styles.console} role="status">
              <p>Chamber configuration</p>
              <p>Gravity <span>{GRAVITY_LABEL[cfg.gravity].toUpperCase()}</span></p>
              <p>Oxygen <span>{cfg.o2} %</span></p>
              <p>Airflow <span>{cfg.flow} cm/s</span></p>
              <p>Material <span>{cfg.material.toUpperCase()}</span></p>
              {SEQ.indexOf(phase) >= 1 && <p className={styles.ok}>Atmosphere set</p>}
              {SEQ.indexOf(phase) >= 2 && <p className={styles.ok}>Airflow stable</p>}
              {SEQ.indexOf(phase) >= 3 && <p className={styles.ok}>Ignition</p>}
              {SEQ.indexOf(phase) >= 4 && <p className={styles.ok}>Comparing with <span className="num">{evidenceRecords.length}</span> NASA records…</p>}
            </div>
          )}
          {phase === "idle" && <button type="button" className={styles.runFloat} onClick={run}>Run experiment</button>}
        </div>
        {phase === "result" && resultIsCurrent && (
          <p className={styles.verdict} data-cls={a.cls} key={pulse}>
            {a.observed ? <>NASA recorded: <b>{a.observed.label}</b></>
              : a.visual === "conceptual" ? <><b>Conceptual only.</b> The flame shows established physics, not a NASA observation. No NASA test in this atlas matches, so no outcome is claimed.</>
              : <><b>Abstained.</b> No NASA test matches this condition, so MicroFire draws no outcome.</>}
          </p>
        )}
      </section>

      <aside className={styles.right} data-open={sheet === "analysis" || undefined} aria-label="Live analysis and evidence">
        <button type="button" className={styles.sheetClose} onClick={() => setSheet(null)}>Close</button>
        {analysis}
      </aside>

      <section className={styles.dock} data-open={tab ? true : undefined} aria-label="Lab tools">
        <div role="tablist" className={styles.tabs}>
          {TABS.map((t) => <button type="button" role="tab" key={t.id} aria-selected={tab === t.id} onClick={() => setTab(tab === t.id ? null : t.id)}>{t.label}</button>)}
          {tab && <button type="button" className={styles.collapse} onClick={() => setTab(null)} aria-label="Close the tray">Close ↓</button>}
        </div>
        {tab && (
          <div className={styles.tray} role="tabpanel">
            {tab === "notebook" && notebook}
            {tab === "compare" && compare}
            {tab === "map" && <EvidenceSpace compact initial={{ o2: cfg.o2, flow: cfg.flow, kpa: cfg.kpa, material: cfg.material, label: "Your lab condition" }} onPick={(r) => { loadCfg(cfgFromRecord(r)); }} key={JSON.stringify(cfg)} />}
            {tab === "missions" && missions}
            {tab === "media" && mediaView}
          </div>
        )}
      </section>

      <nav className={styles.mobileNav} aria-label="Lab panels">
        <button type="button" aria-pressed={sheet === "setup"} onClick={() => { setSheet(sheet === "setup" ? null : "setup"); setTab(null); }}>Setup</button>
        <button type="button" aria-pressed={sheet === "analysis"} onClick={() => { setSheet(sheet === "analysis" ? null : "analysis"); setTab(null); }}>Analysis</button>
        <button type="button" aria-pressed={tab === "map"} onClick={() => { setSheet(null); setTab(tab === "map" ? null : "map"); }}>Evidence</button>
        <button type="button" aria-pressed={tab === "notebook"} onClick={() => { setSheet(null); setTab(tab === "notebook" ? null : "notebook"); }}>Notebook</button>
      </nav>

      {help && (
        <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="lab-help" onKeyDown={(e) => e.key === "Escape" && setHelp(false)}>
          <div>
            <h2 id="lab-help">How the Flame Lab works</h2>
            <ol>
              <li>Set gravity, oxygen, airflow, pressure and material, then press <b>Run experiment</b>.</li>
              <li>MicroFire compares your settings with every NASA test in the atlas and names the evidence class.</li>
              <li>The flame is drawn three ways, always labelled: <b>NASA observation</b> (a matching test exists), <b>conceptual visualization</b> (established physics, not a prediction) or <b>insufficient experimental evidence</b> (no flame is drawn).</li>
              <li>Every run goes in the Notebook, including the ones where MicroFire refuses to infer an outcome.</li>
            </ol>
            <p className={styles.small}>The chamber is an illustration. It does not predict how fire behaves on the Moon or Mars. 3D camera and glove models: Poly Haven (CC0) and NASA 3D Resources.</p>
            <button type="button" autoFocus onClick={() => setHelp(false)}>Got it</button>
          </div>
        </div>
      )}
    </div>
  );
}
