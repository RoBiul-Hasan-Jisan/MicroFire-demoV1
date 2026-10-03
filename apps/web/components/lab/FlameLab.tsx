"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Quote } from "@/components/Cite";
import { OutcomeTag } from "@/components/Outcome";
import { CONTEXTS } from "@/components/MissionLab";
import { FlameChamber, FlameShape } from "@/components/lab/FlameChamber";
import { ExperimentDrawer } from "@/components/lab/ExperimentDrawer";
import { LabGuide, type GuideTip } from "@/components/lab/LabGuide";
import { experiments, findings } from "@/lib/data";
import { confidence } from "@/lib/relevance";
import {
  BADGES, DEFAULT_STATE, FRESH_SAVE, FUELS, GUESSES, RANGES, SAFETY, STEPS, VIEWS, VERDICT_LABEL, WORLDS,
  add, applyAction, badgesOf, evaluateAction, insightFor, judge, lookOf, progressOf, readEvidence, testedRanges, worldOf,
  type Fuel, type Guess, type LabSave, type LabState, type SafetyScenario, type StepId, type ViewId, type WorldId,
} from "@/lib/lab-model";

const KEY = "microfire-lab-v1";
const GRAVITY_TO_WORLD = { microgravity: "micro", lunar: "moon", martian: "mars" } as const;
const TESTED = testedRanges(experiments);

const scrollTo = (id: string) => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
};

export function FlameLab() {
  const [st, setSt] = useState<LabState>(DEFAULT_STATE);
  const [view, setView] = useState<ViewId>("flame");
  const [lit, setLit] = useState(false);
  const [igniteKey, setIgniteKey] = useState(0);
  const [replay, setReplay] = useState<"sustained" | "extinguished" | "not_ignited" | null>(null);
  const [save, setSave] = useState<LabSave>(FRESH_SAVE);
  const [ready, setReady] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [guess, setGuess] = useState<Guess | null>(null);
  const [revealedFor, setRevealedFor] = useState<string | null>(null);
  const [scId, setScId] = useState(SAFETY[0].id);
  const [picked, setPicked] = useState<{ sc: string; action: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const replayTimer = useRef<number | undefined>(undefined);
  const prevBadges = useRef<string[] | null>(null);

  /* ---------- persistence: progress only, never the data ---------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from storage
      if (raw) setSave({ ...FRESH_SAVE, ...JSON.parse(raw) });
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(save));
    } catch {}
  }, [save, ready]);

  const mark = useCallback((fn: (s: LabSave) => LabSave) => setSave(fn), []);

  /* ---------- evidence (existing ranking, unchanged) ---------- */
  const ev = useMemo(() => readEvidence(experiments, st), [st]);
  const insight = useMemo(() => insightFor(st, ev.verdict), [st, ev.verdict]);
  const stateKey = `${st.world}|${st.oxygen}|${st.flow}|${st.pressureKpa}|${st.fuel}`;
  const look = lookOf(st);
  const world = worldOf(st.world);
  const progress = progressOf(save);
  const earned = badgesOf(save);
  const verdictLabel = VERDICT_LABEL[ev.verdict.kind];
  const openRanked = openId ? ev.ranked.find((r) => r.experiment.id === openId) ?? null : null;

  /* ---------- badge toasts ---------- */
  useEffect(() => {
    if (!ready) return;
    if (prevBadges.current == null) {
      prevBadges.current = earned;
      return;
    }
    const fresh = earned.filter((b) => !prevBadges.current!.includes(b));
    prevBadges.current = earned;
    if (fresh.length) {
      const b = BADGES.find((x) => x.id === fresh[0])!;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- announce a newly earned badge
      setToast(`${b.icon} Badge unlocked: ${b.name}`);
      const t = window.setTimeout(() => setToast(null), 3600);
      return () => window.clearTimeout(t);
    }
  }, [earned, ready]);

  /* ---------- discovery flags that come from the evidence itself ---------- */
  useEffect(() => {
    if (lit && ev.verdict.reason === "outside" && !save.pushedLimits) mark((s) => ({ ...s, pushedLimits: true }));
  }, [lit, ev.verdict.reason, save.pushedLimits, mark]);
  useEffect(() => () => window.clearTimeout(replayTimer.current), []);

  /* ---------- actions ---------- */
  const patch = (p: Partial<LabState>, control?: string) => {
    window.clearTimeout(replayTimer.current);
    setReplay(null);
    setSt((s) => ({ ...s, ...p }));
    mark((s) => ({
      ...s,
      touched: control ? add(s.touched, control) : s.touched,
      worlds: p.world ? add(s.worlds, p.world) : s.worlds,
    }));
  };

  const pickView = (v: ViewId) => {
    setView(v);
    mark((s) => ({ ...s, views: add(s.views, v) }));
  };

  const ignite = () => {
    window.clearTimeout(replayTimer.current);
    setReplay(null);
    if (lit) return setLit(false);
    setLit(true);
    setIgniteKey((k) => k + 1);
    mark((s) => ({ ...s, ignitions: s.ignitions + 1 }));
  };

  const canReplay = st.world === "micro" && (ev.verdict.kind === "sustained" || ev.verdict.kind === "extinguished" || ev.verdict.kind === "not_ignited");
  const playReplay = () => {
    if (!canReplay) return;
    const kind = ev.verdict.kind as "sustained" | "extinguished" | "not_ignited";
    window.clearTimeout(replayTimer.current);
    setLit(true);
    setIgniteKey((k) => k + 1);
    setReplay(null);
    window.setTimeout(() => setReplay(kind), 700);
    replayTimer.current = window.setTimeout(() => {
      setReplay(null);
      if (kind !== "sustained") setLit(false);
      if (kind === "extinguished") mark((s) => ({ ...s, wentOut: true }));
    }, 4200);
  };

  const applyContext = (id: string) => {
    const c = CONTEXTS.find((x) => x.id === id);
    if (!c) return;
    patch({ world: GRAVITY_TO_WORLD[c.form.gravity as keyof typeof GRAVITY_TO_WORLD], oxygen: c.form.oxygen, flow: c.form.flow, pressureKpa: c.form.pressureKpa }, "scenario");
  };

  const reveal = () => {
    if (!guess) return;
    setRevealedFor(stateKey);
    const j = judge(guess, ev.verdict);
    mark((s) => ({ ...s, predictions: s.predictions + 1, matches: s.matches + (j.result === "match" ? 1 : 0) }));
    if (!lit) {
      setLit(true);
      setIgniteKey((k) => k + 1);
      mark((s) => ({ ...s, ignitions: s.ignitions + 1 }));
    }
  };
  const revealed = revealedFor === stateKey;
  const judgement = guess && revealed ? judge(guess, ev.verdict) : null;

  const sc: SafetyScenario = SAFETY.find((s) => s.id === scId)!;
  const choose = (actionId: string) => {
    const a = sc.actions.find((x) => x.id === actionId)!;
    window.clearTimeout(replayTimer.current);
    setReplay(null);
    setSt(applyAction(sc, a));
    setView("safety");
    setLit(true);
    setIgniteKey((k) => k + 1);
    setPicked({ sc: sc.id, action: a.id });
    mark((s) => ({ ...s, safetyDone: add(s.safetyDone, sc.id), views: add(s.views, "safety"), ignitions: Math.max(1, s.ignitions), worlds: add(s.worlds, "micro") }));
  };
  const result = picked && picked.sc === sc.id ? evaluateAction(experiments, sc, sc.actions.find((a) => a.id === picked.action)!) : null;

  const resetMission = () => {
    setSave({ ...FRESH_SAVE, brief: true });
    setSt(DEFAULT_STATE);
    setView("flame");
    setLit(false);
    setPicked(null);
    setGuess(null);
    setRevealedFor(null);
    prevBadges.current = [];
  };

  /* ---------- Ember's contextual tip ---------- */
  const current: StepId = STEPS.find((s) => !progress[s.id])?.id ?? "discover";
  const nextHint: Record<StepId, string> = {
    brief: "Start the mission",
    explore: "Move three controls",
    experiment: "Ignite the experiment",
    compare: "Try all four worlds",
    analyze: "Switch views or open a NASA test",
    safety: "Pick a safety action",
    discover: "Check your badges",
  };
  const tip: GuideTip = useMemo(() => {
    if (!save.brief) return { text: "Welcome to the lab! Read the mission brief, then press Start mission.", mood: "happy" };
    if (!lit) return { text: "Set your conditions, then press Ignite Experiment. Everything you change afterwards reacts live.", mood: "curious" };
    if (st.world !== "micro") return { text: `I can draw a ${worldOf(st.world).label} flame, but NASA's atlas has no tests at that gravity, so I will not count outcomes.`, mood: "curious" };
    if (ev.verdict.reason === "outside") return { text: "Careful: these settings are outside everything NASA tested. The nearest tests are shown, but no outcome is counted.", mood: "surprised" };
    if (st.flow <= 1.5) return { text: "Almost no airflow. NASA reported dim blue, very stable flames at speeds this low. Open the Safety view to see which tests it came from.", mood: "worried" };
    if (ev.verdict.kind === "extinguished") return { text: "Most close tests went out. Try raising airflow or oxygen and watch how the evidence changes.", mood: "worried" };
    if (ev.verdict.kind === "sustained") return { text: "Close tests mostly kept burning here. Lower the oxygen a little and see if that changes.", mood: "surprised" };
    if (ev.verdict.kind === "unstated") return { text: "NASA's tables mostly do not say how these tests ended. That gap is worth knowing about.", mood: "curious" };
    return { text: "The evidence splits here, so small changes may matter. Nudge a slider and compare.", mood: "curious" };
  }, [save.brief, lit, st.world, st.flow, ev.verdict]);

  const insightFindings = insight.explanationIds.map((id) => findings.find((f) => f.id === id)).filter((f): f is NonNullable<typeof f> => !!f);
  const sizeWord = look.size < 0.75 ? "small" : look.size < 1.0 ? "medium" : "large";
  const leanWord = look.lean < 0.12 ? "upright" : look.lean < 0.4 ? "leaning slightly" : "leaning hard";
  const status = replay ? "REPLAY" : lit ? "IGNITED" : "STANDBY";

  return (
    <div className="lab" id="lab-top">
      {/* ---------------- mission rail ---------------- */}
      <nav className="lab-rail" aria-label="Mission progress">
        <ol>
          {STEPS.map((s, i) => {
            const done = progress[s.id];
            const now = s.id === current;
            return (
              <li key={s.id}>
                <button className={`lab-step ${done ? "lab-step-done" : ""} ${now ? "lab-step-now" : ""}`} aria-current={now ? "step" : undefined} onClick={() => scrollTo(s.anchor)}>
                  <span className="lab-step-n">{done ? "✓" : i + 1}</span>
                  <span className="lab-step-t">{s.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* ---------------- brief ---------------- */}
      <header className="lab-hero">
        <div className="lab-hero-orbit" aria-hidden="true"><i /><i /><i /></div>
        <p className="lab-kicker">Mission 01 · NASA Space Apps · Flame in Freefall</p>
        <h1 className="display lab-title">Microgravity Flame Lab</h1>
        <p className="lab-lede">
          Change gravity, oxygen, airflow and fuel, light the flame, and see what NASA&apos;s space-station fire tests recorded at conditions like yours. The flame is an illustration; the evidence is real.
        </p>
        <ul className="lab-flow" aria-label="How the lab works">
          {["See", "Click", "Change", "Watch", "Compare", "Discover", "Decide"].map((w) => <li key={w}>{w}</li>)}
        </ul>
        {!save.brief ? (
          <button className="lab-btn lab-btn-ignite mt-7" onClick={() => { mark((s) => ({ ...s, brief: true })); scrollTo("lab-chamber"); }}>
            Start mission
          </button>
        ) : (
          <p className="mt-6 text-sm text-muted">{ready ? `${earned.length} of ${BADGES.length} badges · ${STEPS.filter((s) => progress[s.id]).length} of ${STEPS.length} steps` : "\u00a0"}</p>
        )}
      </header>

      {/* ---------------- chamber + controls ---------------- */}
      <section id="lab-chamber" className="lab-grid" aria-label="Flame chamber">
        <aside className="lab-panel lab-controls" aria-label="Experiment controls">
          <h2 className="lab-h">Controls</h2>

          <fieldset>
            <legend className="lab-label">Gravity</legend>
            <div className="lab-worlds" role="group" aria-label="Gravity">
              {WORLDS.map((w) => (
                <button key={w.id} className={`lab-world ${st.world === w.id ? "lab-world-on" : ""}`} aria-pressed={st.world === w.id} onClick={() => patch({ world: w.id }, "gravity")}>
                  <svg viewBox="-34 -78 68 92" aria-hidden="true">
                    <FlameShape look={{ g: w.g, size: 0.8, lean: 0, intensity: 1, quench: false }} base={26} />
                  </svg>
                  <span className="lab-world-n">{w.label}</span>
                  <span className="lab-world-g num">{w.gLabel}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <Slider label="Oxygen" unit="%" value={st.oxygen} min={RANGES.oxygen[0]} max={RANGES.oxygen[1]} step={0.5} tested={TESTED.oxygen} onChange={(v) => patch({ oxygen: v }, "oxygen")} />
          <Slider label="Airflow" unit="cm/s" value={st.flow} min={RANGES.flow[0]} max={RANGES.flow[1]} step={0.5} tested={TESTED.flow} onChange={(v) => patch({ flow: v }, "airflow")} />

          <fieldset>
            <legend className="lab-label">Fuel</legend>
            <div className="lab-fuels" role="group" aria-label="Fuel">
              {FUELS.map((f) => (
                <button key={f.id} className={`lab-fuel ${st.fuel === f.id ? "lab-fuel-on" : ""}`} aria-pressed={st.fuel === f.id} onClick={() => patch({ fuel: f.id as Fuel }, "fuel")}>
                  <span className="lab-fuel-n">{f.label}</span>
                  <span className="lab-fuel-b">{f.blurb}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <details className="lab-more">
            <summary>Pressure and quick scenarios</summary>
            <Slider label="Pressure" unit="kPa" value={st.pressureKpa} min={50} max={102} step={0.5} onChange={(v) => patch({ pressureKpa: v }, "pressure")} />
            <p className="lab-label mt-4">Mission contexts</p>
            <div className="lab-chips">
              {CONTEXTS.map((c) => (
                <button key={c.id} className="lab-chip" title={c.detail} onClick={() => applyContext(c.id)}>{c.label}</button>
              ))}
            </div>
          </details>
        </aside>

        <div className="lab-stage">
          {/* live HUD */}
          <div className="lab-hud" aria-label="Live readout">
            <Hud k="Gravity" v={world.gLabel} />
            <Hud k="O₂" v={`${st.oxygen} %`} />
            <Hud k="Flow" v={`${st.flow} cm/s`} />
            <Hud k="Fuel" v={st.fuel} />
            <Hud k="Pressure" v={`${st.pressureKpa} kPa`} />
            <Hud k="Status" v={status} tone={lit ? "hot" : "idle"} />
          </div>

          <div className={`lab-chamber-wrap ${lit ? "lab-lit" : ""}`}>
            <FlameChamber state={st} view={view} lit={lit} igniteKey={igniteKey} replay={replay} nearest={ev.ranked} verdictLabel={verdictLabel} onPick={(id) => { setOpenId(id); mark((s) => ({ ...s, opened: add(s.opened, id) })); }} />
            <p className="lab-flamenote" aria-live="polite">
              <b>{world.shape}</b> · {sizeWord} · {leanWord}
            </p>
          </div>

          {/* view switcher */}
          <div className="lab-views" role="tablist" aria-label="Chamber view">
            {VIEWS.map((v) => (
              <button key={v.id} role="tab" aria-selected={view === v.id} className={`lab-view ${view === v.id ? "lab-view-on" : ""}`} onClick={() => pickView(v.id)}>{v.label}</button>
            ))}
          </div>
          <p className="lab-viewhint">{VIEWS.find((v) => v.id === view)!.hint}. The picture is an illustration of the controls, not a measurement.</p>

          <div className="lab-actions">
            <button className={`lab-btn ${lit ? "lab-btn-out" : "lab-btn-ignite"}`} onClick={ignite}>{lit ? "Extinguish" : "Ignite Experiment"}</button>
            {view === "safety" && (
              <button className="lab-btn" onClick={playReplay} disabled={!canReplay} title={canReplay ? "Replay what most close tests recorded" : "Needs a clear outcome from microgravity tests"}>
                Replay NASA&apos;s recorded outcome
              </button>
            )}
            <span className={`lab-verdict lab-verdict-${ev.verdict.kind}`}>{verdictLabel}</span>
          </div>
        </div>
      </section>

      {/* ---------------- insight + prediction ---------------- */}
      <section id="lab-insight" className="lab-two">
        <div className="lab-panel" aria-live="polite">
          <h2 className="lab-h">Insight</h2>
          <p className="lab-sub">Read from NASA&apos;s recorded tests and verified quotes, step by step.</p>
          {lit ? (
            <ol key={`${stateKey}${igniteKey}`} className="lab-chain">
              <li className="lab-link lab-link-1">
                <span className="lab-link-k">1 · Observation</span>
                <p>{insight.observation}</p>
                {insight.nearestLine && <p className="lab-small">{insight.nearestLine}</p>}
                {ev.outside.length > 0 && <p className="lab-warn">{ev.outside[0]}</p>}
              </li>
              <li className="lab-link lab-link-2">
                <span className="lab-link-k">2 · Explanation</span>
                <p className="lab-small">{insight.background}</p>
                {insightFindings.map((f) => <Quote key={f.id} f={f} className="lab-q" />)}
              </li>
              <li className="lab-link lab-link-3">
                <span className="lab-link-k">3 · Safety implication</span>
                <p>{insight.implication}</p>
                <p className="lab-small">{insight.caution}</p>
              </li>
            </ol>
          ) : (
            <p className="lab-empty">Light the flame and the insight appears here, then changes as you move the controls.</p>
          )}
          <p className="mt-4 text-sm"><Link href="/ask" className="link">Ask the evidence assistant a question</Link></p>
        </div>

        <div className="lab-panel" id="lab-predict">
          <h2 className="lab-h">Predict, then reveal</h2>
          <p className="lab-sub">At these exact settings, what do you expect a flame to do?</p>
          <div className="lab-guesses" role="group" aria-label="Your prediction">
            {GUESSES.map((g) => (
              <button key={g.id} className={`lab-guess ${guess === g.id ? "lab-guess-on" : ""}`} aria-pressed={guess === g.id} onClick={() => setGuess(g.id)}>{g.label}</button>
            ))}
          </div>
          <button className="lab-btn mt-4" disabled={!guess} onClick={reveal}>Reveal what NASA recorded</button>
          {judgement && (
            <div key={stateKey} className={`lab-result lab-result-${judgement.result}`} role="status">
              <p className="lab-result-t">
                {judgement.result === "match" ? "Matches the evidence" : judgement.result === "miss" ? "Not what the evidence shows" : judgement.result === "split" ? "Evidence is split" : "Not enough evidence"}
              </p>
              <p>{judgement.message}</p>
              <p className="lab-small">Score so far: {save.matches} of {save.predictions} predictions matched. This is a quiz about past tests, not a forecast.</p>
            </div>
          )}
        </div>
      </section>

      {/* ---------------- compare ---------------- */}
      <section id="lab-compare" className="lab-section" aria-labelledby="cmp-h">
        <h2 id="cmp-h" className="display lab-h2">Earth, Moon, Mars, orbit</h2>
        <p className="lab-sub max-w-[70ch]">Same oxygen, same airflow, four gravities. Pick one to load it into the chamber. Only the orbit flame has NASA tests behind it.</p>
        <div className="lab-compare">
          {WORLDS.map((w) => {
            const l = lookOf({ ...st, world: w.id as WorldId });
            const active = st.world === w.id;
            return (
              <button key={w.id} className={`lab-cmp ${active ? "lab-cmp-on" : ""}`} aria-pressed={active} onClick={() => patch({ world: w.id }, "gravity")}>
                <svg viewBox="-90 -190 180 214" aria-hidden="true">
                  <FlameShape look={{ g: l.g, size: l.size, lean: l.lean, intensity: 1, quench: false }} base={44} />
                  <path d="M-70 4H70" stroke="#2c3a58" strokeWidth="4" strokeLinecap="round" />
                </svg>
                <span className="lab-cmp-h">{w.label} <span className="num">{w.gLabel}</span></span>
                <span className="lab-cmp-s">{w.shape}</span>
                <span className="lab-cmp-p">{w.background}</span>
                <span className={`lab-cmp-e ${w.id === "micro" ? "lab-cmp-e-yes" : ""}`}>{w.id === "micro" ? `${experiments.length} NASA ISS tests in the atlas` : "No tests at this gravity in the atlas"}</span>
              </button>
            );
          })}
        </div>
        <div className="lab-quotes">
          {["low-g-burns-lower-o2", "luci-first-lunar"].map((id) => findings.find((f) => f.id === id)).filter((f): f is NonNullable<typeof f> => !!f).map((f) => <Quote key={f.id} f={f} className="lab-q" />)}
        </div>
      </section>

      {/* ---------------- evidence cards ---------------- */}
      <section id="lab-evidence" className="lab-section" aria-labelledby="ev-h">
        <h2 id="ev-h" className="display lab-h2">The closest NASA tests</h2>
        <p className="lab-sub max-w-[70ch]">Ranked by Mission Relevance for your current settings. Open any card for the full record.</p>
        <ul className="lab-cards">
          {ev.ranked.slice(0, 8).map((r, i) => {
            const e = r.experiment;
            const conf = confidence(e, experiments);
            return (
              <li key={e.id}>
                <button className="lab-card" onClick={() => { setOpenId(e.id); mark((s) => ({ ...s, opened: add(s.opened, e.id) })); }}>
                  <span className="lab-card-top"><span className="lab-card-id">{e.test_id}</span><span className="lab-card-rank num">#{i + 1}</span></span>
                  <span className="lab-card-o"><OutcomeTag outcome={e.outcome} label={e.outcome_label} /></span>
                  <span className="lab-card-m">{e.material} · {e.oxygen_vol_pct ?? "?"} % O₂ · {e.flow_initial_cm_s ?? "?"} cm/s</span>
                  <svg className="lab-card-bar" viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true">
                    <rect width="100" height="6" rx="3" fill="#1e2940" /><rect width={Math.round(r.score * 100)} height="6" rx="3" fill="#56d4e4" />
                  </svg>
                  <span className="lab-card-f"><span>Relevance <b className="num">{Math.round(r.score * 100)}</b></span><span>{conf.level} evidence</span></span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-sm text-faint">Relevance and confidence are project heuristics, not NASA ratings. <Link href="/methodology" className="link">See the formula</Link></p>
      </section>

      {/* ---------------- safety mission ---------------- */}
      <section id="lab-safety" className="lab-section" aria-labelledby="sf-h">
        <h2 id="sf-h" className="display lab-h2">Safety mission</h2>
        <p className="lab-sub max-w-[70ch]">Choose an action. The chamber reacts and the evidence explains. This is a thinking exercise about past NASA tests, not fire-response guidance.</p>
        <div className="lab-tabs" role="tablist" aria-label="Safety scenario">
          {SAFETY.map((s) => (
            <button key={s.id} role="tab" aria-selected={scId === s.id} className={`lab-tab ${scId === s.id ? "lab-tab-on" : ""}`} onClick={() => { setScId(s.id); setPicked(null); }}>
              {save.safetyDone.includes(s.id) ? "✓ " : ""}{s.title}
            </button>
          ))}
        </div>
        <div className="lab-alert" role="note"><span className="lab-alert-k">ALERT</span> {sc.alert}</div>
        <p className="mt-4 font-medium">{sc.goal}</p>
        <div className="lab-opts">
          {sc.actions.map((a) => (
            <button key={a.id} className={`lab-opt ${picked?.sc === sc.id && picked.action === a.id ? "lab-opt-on" : ""}`} onClick={() => choose(a.id)}>
              <span className="lab-opt-n">{a.label}</span><span className="lab-opt-d">{a.detail}</span>
            </button>
          ))}
        </div>
        {result && (
          <div key={`${picked!.sc}${picked!.action}`} className={`lab-outcome lab-outcome-${result.after.kind}`} role="status">
            <p className="lab-link-k">What the evidence says</p>
            <p className="text-lg">{VERDICT_LABEL[result.after.kind]}</p>
            <p>{insightFor(result.state, result.after).observation}</p>
            {result.outside.length > 0 && <p className="lab-warn">{result.outside[0]}</p>}
            <p className="lab-small">{insightFor(result.state, result.after).implication}</p>
            <table className="lab-table num">
              <caption>All options for this scenario</caption>
              <tbody>
                {sc.actions.map((a) => {
                  const r = evaluateAction(experiments, sc, a);
                  return (
                    <tr key={a.id} className={a.id === picked!.action ? "lab-row-on" : ""}>
                      <th scope="row">{a.label}</th><td>{VERDICT_LABEL[r.after.kind]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---------------- discoveries ---------------- */}
      <section id="lab-discover" className="lab-section" aria-labelledby="dc-h">
        <h2 id="dc-h" className="display lab-h2">Discoveries</h2>
        <p className="lab-sub">{progress.discover ? "Mission complete. You have seen how gravity, air and fuel change a flame, and where NASA's evidence stops." : "Badges unlock as you explore. Nothing is required, and nothing leaves your browser."}</p>
        <ul className="lab-badges">
          {BADGES.map((b) => {
            const on = earned.includes(b.id);
            return (
              <li key={b.id} className={`lab-badge ${on ? "lab-badge-on" : ""}`}>
                <span className="lab-badge-i" aria-hidden="true">{on ? b.icon : "🔒"}</span>
                <span className="lab-badge-n">{b.name}</span>
                <span className="lab-badge-h">{b.how}</span>
              </li>
            );
          })}
        </ul>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/mission" className="lab-btn">Run a full mission scenario</Link>
          <Link href="/compare" className="lab-btn lab-btn-ghost">Compare tests side by side</Link>
          <button className="lab-btn lab-btn-ghost" onClick={resetMission}>Reset mission</button>
        </div>
      </section>

      <ExperimentDrawer ranked={openRanked} onClose={() => setOpenId(null)} />
      <LabGuide tip={tip} form={st.world === "micro" ? "orbit" : "earth"} next={{ label: nextHint[current], done: current === "discover" && progress.discover }} onNext={() => scrollTo(STEPS.find((s) => s.id === current)!.anchor)} />
      {toast && <div className="lab-toast" role="status">{toast}</div>}
    </div>
  );
}

function Hud({ k, v, tone = "idle" }: { k: string; v: string; tone?: "idle" | "hot" }) {
  return (
    <div className={`lab-hud-c ${tone === "hot" ? "lab-hud-hot" : ""}`}>
      <span className="lab-hud-k">{k}</span>
      <span className="lab-hud-v num">{v}</span>
    </div>
  );
}

function Slider(props: { label: string; unit: string; value: number; min: number; max: number; step: number; tested?: [number, number]; onChange: (v: number) => void }) {
  const { min, max, tested } = props;
  const pct = (v: number) => Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100));
  return (
    <label className="lab-slider">
      <span className="lab-slider-top">
        <span className="lab-label">{props.label}</span>
        <span className="lab-slider-v num">{props.value} <small>{props.unit}</small></span>
      </span>
      <input type="range" min={min} max={max} step={props.step} value={props.value} onChange={(e) => props.onChange(Number(e.target.value))} />
      {tested && (
        <svg className="lab-tested" viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true">
          <rect width="100" height="4" y="1" rx="2" fill="#1e2940" />
          <rect x={pct(tested[0])} width={Math.max(1, pct(tested[1]) - pct(tested[0]))} height="4" y="1" rx="2" fill="#56d4e4" fillOpacity=".7" />
        </svg>
      )}
      {tested && <span className="lab-tested-t">Cyan marks what NASA tested: {tested[0]}–{tested[1]} {props.unit}</span>}
    </label>
  );
}
