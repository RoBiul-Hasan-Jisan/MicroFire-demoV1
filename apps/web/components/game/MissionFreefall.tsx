"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CloudPoint, FlameScene, PartId, SceneState } from "@/components/three/FlameScene";
import { Cite } from "@/components/Cite";
import { Ember, EmberSays, type Form, type Mood } from "@/components/game/Ember";
import { Sparks } from "@/components/game/Sparks";
import { SpaceBg } from "@/components/game/SpaceBg";
import { useSound } from "@/components/game/sound";
import { experiments, findings, getExperiment } from "@/lib/data";
import { BADGES, blockedBy, CHAPTERS, LAB_TARGET, MOON, PARTS, PREDICTIONS, type ChapterId } from "@/lib/game";

/* ---------------- screens ---------------- */

type ScreenId = "hello" | "gravity" | "build" | "built" | "lab" | "b16" | "b19" | "fabric" | "log" | "quiet" | "moon" | "debrief";
const SCREENS: { id: ScreenId; chapter: ChapterId }[] = [
  { id: "hello", chapter: "brief" },
  { id: "gravity", chapter: "brief" },
  { id: "build", chapter: "build" },
  { id: "built", chapter: "build" },
  { id: "lab", chapter: "lab" },
  { id: "b16", chapter: "predict" },
  { id: "b19", chapter: "predict" },
  { id: "fabric", chapter: "predict" },
  { id: "log", chapter: "log" },
  { id: "quiet", chapter: "quiet" },
  { id: "moon", chapter: "moon" },
  { id: "debrief", chapter: "debrief" },
];

type Save = {
  screen: number;
  installed: string[];
  answers: Record<string, number>;
  labLit: boolean;
  gravityToggled: boolean;
};
const FRESH: Save = { screen: 0, installed: [], answers: {}, labLit: false, gravityToggled: false };
const KEY = "microfire-mission-freefall-v1";

const HEX: Record<string, string> = {
  sustained_no_blowoff: "#f0a044", burned_entire_sample: "#f0a044", burned_outcome_not_stated: "#f0a044",
  quenched_low_flow: "#5b8cff", extinguished_flow_off: "#5b8cff", no_sustained_flame: "#5b8cff",
  blowoff: "#d6e4ff", not_ignited: "#4a5570",
};
const LANE: Record<string, number> = { PMMA: -1.3, "SIBAL fabric": 0, Nomex: 1.3 };
function cloudPoints(): CloudPoint[] {
  return experiments
    .filter((e) => e.flow_initial_cm_s != null && e.oxygen_vol_pct != null)
    .map((e, i) => ({
      id: e.id,
      label: e.test_id,
      x: -4 + (Math.log(e.flow_final_cm_s ?? e.flow_initial_cm_s!) / Math.log(60)) * 8,
      y: -2 + ((e.oxygen_vol_pct! - 13.5) / 8) * 4,
      z: (LANE[e.material] ?? 0) + (((i * 37) % 7) - 3) * 0.09,
      color: HEX[e.outcome] ?? "#8f9ab1",
      hollow: e.outcome === "burned_outcome_not_stated" || e.outcome === "no_sustained_flame",
    }));
}

const LOG_TESTS = ["bass2-B1", "bass2-B9", "bass2-B16", "bass2-B19", "bass2-F1", "sibal-GMT45-T4"];
const quote = (id?: string) => (id ? findings.find((f) => f.id === id) : undefined);

/* ---------------- component ---------------- */

export function MissionFreefall() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<FlameScene | null>(null);
  const [started, setStarted] = useState(false);
  const [save, setSave] = useState<Save>(FRESH);
  const [hasSave, setHasSave] = useState(false);
  const [noGL, setNoGL] = useState(false);
  const [burst, setBurst] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gentle, setGentle] = useState(false);
  const [selected, setSelected] = useState<PartId | null>(null);
  const [toast, setToast] = useState<{ text: string; finding?: string } | null>(null);
  const [gravityOn, setGravityOn] = useState(true);
  const [o2, setO2] = useState(20.9);
  const [flow, setFlow] = useState(10);
  const [heat, setHeat] = useState(0);
  const [revealAt, setRevealAt] = useState<Record<string, boolean>>({});
  const [logFocus, setLogFocus] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ part: PartId; x: number; y: number } | null>(null);
  const holdRef = useRef<number | null>(null);
  const sound = useSound();
  const cloud = useMemo(() => cloudPoints(), []);

  const screen = SCREENS[save.screen];
  const chapterIdx = CHAPTERS.findIndex((c) => c.id === screen.chapter);
  const installed = useMemo(() => new Set(save.installed), [save.installed]);
  const allBuilt = PARTS.every((p) => installed.has(p.id));
  const score = PREDICTIONS.filter((p) => save.answers[p.id] != null && p.choices[save.answers[p.id]].correct).length;
  const moonRight = save.answers.moon != null && MOON.choices[save.answers.moon].correct;

  // load / persist progress
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = { ...FRESH, ...JSON.parse(raw) } as Save;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from storage
        setSave(s);
        setHasSave(s.screen > 0);
      }
    } catch {}
  }, []);
  useEffect(() => {
    if (!started) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(save));
    } catch {}
  }, [save, started]);

  const update = useCallback((patch: Partial<Save>) => setSave((s) => ({ ...s, ...patch })), []);

  /* ---------- scene state per screen ---------- */
  const sceneState = useMemo((): SceneState => {
    const base = { cloud } as const;
    const pred = PREDICTIONS.find((p) => p.id === screen.id);
    switch (screen.id) {
      case "hello":
        return { ...base, view: "bench", gravity: "earth", o2: 21, flow: 0, outcome: "burning" };
      case "gravity":
        return { ...base, view: "bench", gravity: gravityOn ? "earth" : "orbit", o2: 21, flow: 0, outcome: gravityOn ? "burning" : "dim" };
      case "build":
        return { ...base, view: "duct", gravity: "orbit", o2: 21, flow: 0, outcome: "none", parts: save.installed, ghost: selected ?? drag?.part ?? null };
      case "built":
        return { ...base, view: "duct", gravity: "orbit", o2: 21, flow: 4, outcome: "none", parts: save.installed };
      case "lab":
        return { ...base, view: "duct", gravity: "orbit", o2, flow, outcome: save.labLit ? "burning" : "none", igniter: save.labLit ? 0.25 : heat };
      case "b16":
      case "b19":
      case "fabric": {
        const sc = pred!.scene, done = save.answers[pred!.id] != null && revealAt[pred!.id];
        return { ...base, view: "duct", gravity: "orbit", o2: sc.o2, flow: done ? sc.afterFlow : sc.flow, outcome: done ? sc.after : sc.before, material: sc.material };
      }
      case "log":
        return { ...base, view: "cloud", gravity: "orbit", o2: 18, flow: 5, outcome: "none", highlight: logFocus ? [logFocus] : LOG_TESTS };
      case "quiet":
        return { ...base, view: "duct", gravity: "orbit", o2: 20.6, flow: 0.6, outcome: "dim" };
      case "moon":
        return { ...base, view: "cloud", gravity: "orbit", o2: 34, flow: 5, outcome: "none", voidRegion: { y: 2.9, label: "34 % O₂, 56.5 kPa: no tests here" } };
      default:
        return { ...base, view: "duct", gravity: "orbit", o2: 21, flow: 5, outcome: "burning" };
    }
  }, [screen.id, cloud, gravityOn, save.installed, save.labLit, save.answers, selected, drag, o2, flow, heat, revealAt, logFocus]);

  // boot the 3D scene after the title screen
  useEffect(() => {
    if (!started || noGL || !canvasRef.current || sceneRef.current) return;
    let alive = true;
    import("@/components/three/FlameScene").then(({ FlameScene }) => {
      if (!alive || !canvasRef.current) return;
      sceneRef.current = new FlameScene(canvasRef.current, sceneState, { panelLeft: true });
      sceneRef.current.setGentle(gentle);
    });
    const onVis = () => sceneRef.current?.setRunning(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [started, noGL]); // eslint-disable-line react-hooks/exhaustive-deps -- boot once; later state flows through setState below
  useEffect(() => () => sceneRef.current?.dispose(), []);
  useEffect(() => sceneRef.current?.setState(sceneState), [sceneState]);
  useEffect(() => sceneRef.current?.setGentle(gentle), [gentle]);
  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 2400);
    return () => clearTimeout(t);
  }, [banner]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  /* ---------- navigation ---------- */
  const canAdvance =
    (screen.id === "gravity" && save.gravityToggled) ||
    (screen.id === "build" && allBuilt) ||
    (screen.id === "lab" && save.labLit) ||
    (["b16", "b19", "fabric"].includes(screen.id) && save.answers[screen.id] != null) ||
    (screen.id === "moon" && save.answers.moon != null) ||
    ["hello", "built", "log", "quiet"].includes(screen.id);

  const go = useCallback(
    (d: 1 | -1) => {
      if (d === 1 && !canAdvance) return;
      const n = Math.max(0, Math.min(SCREENS.length - 1, save.screen + d));
      if (n === save.screen) return;
      if (d === 1 && SCREENS[n].id === "built") { setBurst((b) => b + 1); setBanner("Wind tunnel ready!"); sound.play("fanfare"); }
      else if (d === 1 && SCREENS[n].id === "debrief") { setBurst((b) => b + 1); setBanner("Mission complete!"); sound.play("fanfare"); }
      else sound.play("tick");
      setSelected(null);
      setLogFocus(null);
      update({ screen: n });
    },
    [canAdvance, save.screen, sound, update],
  );

  useEffect(() => {
    if (!started) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, [role=slider]")) return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "Escape") { setNotesOpen(false); setSettingsOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, started]);

  /* ---------- build ---------- */
  const install = useCallback(
    (id: PartId) => {
      const part = PARTS.find((p) => p.id === id)!;
      if (installed.has(id)) return;
      const why = blockedBy(part, installed);
      if (why) {
        setToast({ text: why });
        sound.play("wrong");
        return;
      }
      const next = [...save.installed, id];
      update({ installed: next });
      setSelected(null);
      setToast({ text: `${part.name} installed. ${part.role}`, finding: part.finding });
      sound.play("snap");
    },
    [installed, save.installed, sound, update],
  );
  const quickBuild = () => {
    update({ installed: PARTS.map((p) => p.id) });
    sound.play("snap");
    setToast({ text: "Quick build: every part installed in a valid order." });
  };

  // pointer drag from shelf onto the 3D view
  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d));
    const up = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el === canvasRef.current) install(drag.part);
      setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [drag, install]);
  const ghostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (drag && ghostRef.current) ghostRef.current.style.transform = `translate(${drag.x + 14}px, ${drag.y + 14}px)`; // CSSOM: allowed by CSP
  }, [drag]);

  /* ---------- ignition lab ---------- */
  const inBand = Math.abs(o2 - LAB_TARGET.o2) <= LAB_TARGET.o2Tol && Math.abs(flow - LAB_TARGET.flow) <= LAB_TARGET.flowTol;
  const startHold = () => {
    if (!inBand || save.labLit) return;
    const t0 = performance.now();
    const tick = () => {
      const h = Math.min(1, (performance.now() - t0) / 1400);
      setHeat(h);
      if (h >= 1) {
        update({ labLit: true });
        setBurst((b) => b + 1);
        setBanner("Ignition!");
        sound.play("ignite");
        holdRef.current = null;
        return;
      }
      holdRef.current = requestAnimationFrame(tick);
    };
    holdRef.current = requestAnimationFrame(tick);
  };
  const stopHold = () => {
    if (holdRef.current) cancelAnimationFrame(holdRef.current);
    holdRef.current = null;
    if (!save.labLit) setHeat(0);
  };

  /* ---------- predictions ---------- */
  const answer = (id: string, k: number, correct: boolean) => {
    if (save.answers[id] != null) return;
    update({ answers: { ...save.answers, [id]: k } });
    sound.play(correct ? "right" : "wrong");
    setTimeout(() => setRevealAt((r) => ({ ...r, [id]: true })), 600);
  };

  /* ---------- Ember per screen ---------- */
  const ember: { form: Form; mood: Mood } = (() => {
    const form: Form = screen.id === "hello" || (screen.id === "gravity" && gravityOn) ? "earth" : "orbit";
    const a = save.answers[screen.id];
    const p = PREDICTIONS.find((x) => x.id === screen.id);
    if (p && a != null) return { form, mood: p.choices[a].correct ? "proud" : "surprised" };
    if (screen.id === "moon" && a != null) return { form, mood: moonRight ? "proud" : "curious" };
    const m: Partial<Record<ScreenId, Mood>> = { hello: "happy", gravity: "curious", build: "happy", built: "proud", lab: save.labLit ? "proud" : "curious", log: "curious", quiet: "worried", moon: "curious", debrief: "proud" };
    return { form, mood: m[screen.id] ?? "happy" };
  })();

  /* ---------- title screen ---------- */
  if (!started)
    return (
      <section className="gx relative min-h-[calc(100vh-3.5rem)] overflow-hidden flex items-center">
        <SpaceBg interactive onSfx={(k) => sound.play(k)} />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-14 pb-44 grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] items-center w-full">
          <div>
            <p className="text-signal text-sm font-semibold">Mission Freefall, a MicroFire Atlas adventure</p>
            <h1 className="display text-5xl sm:text-6xl lg:text-7xl mt-4 max-w-[12ch]">Build it. Light it. Call it.</h1>
            <p className="mt-6 text-lg text-muted max-w-[50ch]">
              Assemble NASA&apos;s real space-station fire experiment, light a sample in zero gravity, and predict what the
              flames did before the crew&apos;s own notes reveal the truth.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  setNoGL(!document.createElement("canvas").getContext("webgl2"));
                  setStarted(true);
                  window.scrollTo(0, 0);
                  sound.play("whoosh");
                }}
                className="gx-btn gx-btn-play"
              >
                {hasSave ? "Continue mission" : "Start the mission"}
              </button>
              {hasSave && (
                <button onClick={() => { setSave(FRESH); setStarted(true); window.scrollTo(0, 0); }} className="border border-rule-strong px-5 py-3 rounded-full hover:border-signal">
                  Start over
                </button>
              )}
              <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
                <input type="checkbox" checked={sound.on} onChange={(e) => sound.setOn(e.target.checked)} className="accent-[var(--signal)]" />
                Sound effects
              </label>
            </div>
            <ol className="mt-10 grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-muted max-w-xl">
              {CHAPTERS.map((c) => (
                <li key={c.id} className="flex gap-3">
                  <span className="num text-signal">{c.n}</span>
                  {c.title}
                </li>
              ))}
            </ol>
          </div>
          <div className="flex flex-col items-center gap-6">
            <Ember form="earth" mood="happy" size={240} />
            <div className="ember-bubble max-w-sm">
              <p className="text-[11px] font-semibold text-signal">Ember, your flame guide</p>
              <p className="mt-1">Hi, I&apos;m Ember. On Earth I&apos;m tall and orange. Take gravity away and I change completely. Come and see.</p>
            </div>
          </div>
        </div>
      </section>
    );

  /* ---------- game ---------- */
  const pred = PREDICTIONS.find((p) => p.id === screen.id);
  const chapter = CHAPTERS[chapterIdx];

  return (
    <section className="gx fixed inset-x-0 bottom-0 top-14 z-30 overflow-hidden" aria-label="Mission Freefall">
      <SpaceBg />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" aria-hidden="true" />
      {noGL && <p className="absolute inset-x-0 top-1/3 text-center text-muted">3D is not available on this device. The mission still works in the panel.</p>}
      <Sparks burst={burst} />
      {banner && (
        <div className="pointer-events-none absolute inset-0 z-40 grid place-items-center" role="status">
          <div className="game-banner">
            <Ember form="orbit" mood="proud" size={120} label={false} />
            <p className="display text-4xl sm:text-6xl mt-2">{banner}</p>
          </div>
        </div>
      )}

      {/* top bar */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 game-topbar">
        <div className="min-w-0">
          <p className="text-xs text-muted num">
            Chapter {chapter.n} of {CHAPTERS.length}
          </p>
          <p className="display text-lg truncate">{chapter.title}</p>
        </div>
        <ol className="hidden md:flex items-center gap-1.5" aria-label="Chapters">
          {CHAPTERS.map((c, k) => (
            <li key={c.id} title={c.title} className={`game-chip ${k < chapterIdx ? "game-chip-done" : k === chapterIdx ? "game-chip-now" : ""}`}>
              <span className="num">{c.n}</span>
              <span className="sr-only">{c.title}{k === chapterIdx ? ", current" : k < chapterIdx ? ", done" : ""}</span>
            </li>
          ))}
        </ol>
        <div className="flex items-center gap-2">
          <span className="gx-plate" title="Calls matched"><span className="gx-chip-icon coin" aria-hidden="true" />Calls {score}/{PREDICTIONS.length}</span>
          <button onClick={() => setNotesOpen((o) => !o)} aria-expanded={notesOpen} className="game-btn">Field notes</button>
          <button onClick={() => setSettingsOpen((o) => !o)} aria-expanded={settingsOpen} className="game-btn">Settings</button>
        </div>
      </div>

      {settingsOpen && (
        <div className="absolute right-4 sm:right-6 top-16 z-40 game-pop w-64" role="dialog" aria-label="Settings">
          <label className="flex items-center justify-between py-2"><span>Sound effects</span><input type="checkbox" checked={sound.on} onChange={(e) => sound.setOn(e.target.checked)} className="accent-[var(--signal)]" /></label>
          <label className="flex items-center justify-between py-2"><span>Gentle motion</span><input type="checkbox" checked={gentle} onChange={(e) => setGentle(e.target.checked)} className="accent-[var(--signal)]" /></label>
          <button onClick={() => { setSave({ ...FRESH }); setRevealAt({}); setGravityOn(true); setSettingsOpen(false); setO2(20.9); setFlow(10); setHeat(0); }} className="mt-2 w-full game-btn">Start a new mission</button>
        </div>
      )}

      {/* field notes drawer */}
      <aside className={`game-drawer ${notesOpen ? "game-drawer-open" : ""}`} aria-hidden={!notesOpen} aria-label="Field notes">
        <div className="flex items-center justify-between">
          <h2 className="display text-xl">Field notes</h2>
          <button onClick={() => setNotesOpen(false)} className="game-btn" tabIndex={notesOpen ? 0 : -1}>Close</button>
        </div>
        <FieldNotes screen={screen.id} installed={installed} />
      </aside>

      {/* drag ghost */}
      {drag && (
        <div ref={ghostRef} className="fixed left-0 top-0 z-50 pointer-events-none game-ghost">
          {PARTS.find((p) => p.id === drag.part)!.name}
        </div>
      )}

      {/* toast */}
      {toast && (
        <div className="absolute left-1/2 -translate-x-1/2 top-20 z-40 game-toast max-w-xl" role="status">
          <p>{toast.text}</p>
          {toast.finding && quote(toast.finding) && (
            <p className="mt-1 text-xs text-muted">
              NASA: “{quote(toast.finding)!.quote}” <Cite sourceId={quote(toast.finding)!.source_id} page={quote(toast.finding)!.pdf_page} />
            </p>
          )}
        </div>
      )}

      {/* live readout */}
      {["lab", "b16", "b19", "fabric", "quiet", "gravity"].includes(screen.id) && (
        <div className="hidden sm:block absolute right-6 top-20 story-hud" aria-hidden="true">
          <div><span>O₂</span><b className="num">{sceneState.o2}%</b></div>
          <div><span>Airflow</span><b className="num">{sceneState.view === "bench" ? 0 : sceneState.flow} cm/s</b></div>
          <div><span>Gravity</span><b>{sceneState.gravity === "earth" ? "1 g" : "~0 g"}</b></div>
          <div><span>Flame</span><b className={sceneState.outcome === "quench" || sceneState.outcome === "dim" ? "text-quench" : sceneState.outcome === "blowoff" ? "text-blowoff" : sceneState.outcome === "none" ? "text-faint" : "text-flame"}>
            {{ burning: "burning", quench: "quenching", blowoff: "blowing off", dim: "dim blue", none: "not lit" }[sceneState.outcome]}
          </b></div>
          <p className="text-[11px] text-faint mt-2">Illustration, not a simulation. Drag to rotate.</p>
        </div>
      )}

      {/* main panel */}
      <div key={screen.id} className="story-panel absolute left-3 right-3 bottom-3 sm:left-6 sm:right-auto sm:bottom-6 sm:w-[500px] max-h-[calc(100%-6.5rem)] overflow-y-auto">
        <EmberSays form={ember.form} mood={ember.mood} size={84}>
          <Line id={screen.id} gravityOn={gravityOn} labLit={save.labLit} built={installed.size} />
        </EmberSays>

        {screen.id === "gravity" && (
          <button
            onClick={() => { setGravityOn((g) => !g); update({ gravityToggled: true }); sound.play("whoosh"); }}
            className="mt-4 story-action"
          >
            {gravityOn ? "Switch off gravity" : "Switch gravity back on"}
          </button>
        )}

        {screen.id === "build" && (
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted num">{installed.size} of {PARTS.length} parts installed</p>
              <button onClick={quickBuild} className="game-btn">Quick build</button>
            </div>
            <div className="mt-1 h-1.5 bg-rule rounded-full overflow-hidden">
              <svg className="block w-full h-1.5" aria-hidden="true"><rect width={`${(installed.size / PARTS.length) * 100}%`} height="100%" fill="var(--signal)" /></svg>
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-2">
              {PARTS.map((p) => {
                const done = installed.has(p.id);
                const blocked = !done && blockedBy(p, installed);
                return (
                  <li key={p.id}>
                    <button
                      disabled={done}
                      onClick={() => (selected === p.id ? install(p.id) : setSelected(p.id))}
                      onPointerDown={(e) => { if (!done && e.pointerType === "mouse") setDrag({ part: p.id, x: e.clientX, y: e.clientY }); }}
                      aria-pressed={selected === p.id}
                      className={`game-part ${done ? "game-part-done" : selected === p.id ? "game-part-sel" : blocked ? "opacity-60" : ""}`}
                    >
                      <span className="font-medium text-[14px]">{p.name}</span>
                      <span className="block text-[11px] text-muted">{done ? "Installed" : selected === p.id ? "Tap again to install" : blocked ? "Needs another part first" : "Drag onto the tunnel, or tap"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {screen.id === "lab" && (
          <div className="mt-4 space-y-4">
            <p className="text-sm">
              Target, from NASA test B20: <b className="num">16.5 % oxygen</b> and <b className="num">5 cm/s</b> airflow. Bring both dials into the green band.
            </p>
            <Dial label="Oxygen (add nitrogen to lower it)" unit="%" min={14} max={21} step={0.1} value={o2} onChange={setO2} disabled={save.labLit} band="left-[31.4%] w-[8.6%]" ok={Math.abs(o2 - LAB_TARGET.o2) <= LAB_TARGET.o2Tol} />
            <Dial label="Fan speed" unit="cm/s" min={0} max={12} step={0.1} value={flow} onChange={setFlow} disabled={save.labLit} band="left-[37.5%] w-[8.4%]" ok={Math.abs(flow - LAB_TARGET.flow) <= LAB_TARGET.flowTol} />
            {!save.labLit ? (
              <button
                onPointerDown={startHold}
                onPointerUp={stopHold}
                onPointerLeave={stopHold}
                onKeyDown={(e) => { if ((e.key === " " || e.key === "Enter") && !holdRef.current) startHold(); }}
                onKeyUp={stopHold}
                disabled={!inBand}
                className="game-ignite"
              >
                <svg width="34" height="34" viewBox="0 0 36 36" aria-hidden="true" className="-rotate-90">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="var(--rule-strong)" strokeWidth="4" />
                  <circle cx="18" cy="18" r="15" fill="none" stroke="#ff7a2a" strokeWidth="4" strokeDasharray={`${heat * 94.2} 94.2`} strokeLinecap="round" />
                </svg>
                {inBand ? "Hold to fire the igniter" : "Dial in the target first"}
              </button>
            ) : (
              <div className="story-reveal">
                <p className="font-semibold">Ignition! You set up the same conditions as test B20.</p>
                <p className="mt-1 text-sm text-muted">
                  NASA&apos;s note for B20: “{getExperiment("bass2-B20")!.observations_verbatim}” <Cite sourceId="bass2-summary" page={getExperiment("bass2-B20")!.provenance.record.pdf_page} where="Table A.1" />
                </p>
              </div>
            )}
          </div>
        )}

        {pred && (
          <fieldset className="mt-4">
            <legend className="text-[15px]">{pred.setup}</legend>
            <p className="mt-3 font-semibold">{pred.question}</p>
            <div className="mt-2 grid gap-2">
              {pred.choices.map((c, k) => {
                const chosen = save.answers[pred.id];
                const cls = chosen == null ? "" : c.correct ? "story-choice-right" : chosen === k ? "story-choice-wrong" : "opacity-50";
                return (
                  <button key={c.label} onClick={() => answer(pred.id, k, c.correct)} disabled={chosen != null} className={`story-choice ${cls}`}>
                    <span className="story-choice-key">{String.fromCharCode(65 + k)}</span>
                    {c.label}
                    {chosen != null && c.correct && <span className="ml-auto text-xs">NASA record</span>}
                  </button>
                );
              })}
            </div>
            {save.answers[pred.id] != null && (
              <div className="mt-3 story-reveal" role="status">
                <p className="font-semibold">{pred.choices[save.answers[pred.id]].correct ? "You called it." : "Not quite."} {pred.reveal}</p>
                {pred.testId && (
                  <p className="mt-1 text-sm text-muted">
                    Crew and ground note for {getExperiment(pred.testId)!.test_id}: “{getExperiment(pred.testId)!.observations_verbatim}”{" "}
                    <Cite sourceId="bass2-summary" page={getExperiment(pred.testId)!.provenance.record.pdf_page} where={getExperiment(pred.testId)!.provenance.record.table} />
                  </p>
                )}
                {quote(pred.finding) && (
                  <p className="mt-1 text-sm text-muted">
                    NASA: “{quote(pred.finding)!.quote}” <Cite sourceId={quote(pred.finding)!.source_id} page={quote(pred.finding)!.pdf_page} />
                  </p>
                )}
              </div>
            )}
          </fieldset>
        )}

        {screen.id === "log" && (
          <ul className="mt-4 space-y-2">
            {LOG_TESTS.map((id) => {
              const e = getExperiment(id)!;
              return (
                <li key={id}>
                  <button onClick={() => setLogFocus(logFocus === id ? null : id)} aria-pressed={logFocus === id} className={`story-choice !items-start ${logFocus === id ? "story-choice-right" : ""}`}>
                    <span className="story-choice-key !w-auto px-1.5">{e.test_id}</span>
                    <span className="text-sm">
                      “{e.observations_verbatim}”
                      <span className="block text-xs text-faint mt-0.5">{e.material}, {e.oxygen_vol_pct}% O₂{e.date ? `, ${e.date}` : ""}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {screen.id === "quiet" && (
          <div className="mt-4">
            <button onClick={() => { sceneRef.current?.gust(); sound.play("whoosh"); }} className="story-action">Gust the fan</button>
            <p className="mt-3 text-sm text-muted border-l-2 border-rule-strong pl-3">
              “{quote("tiny-flame-undetected")!.quote}” <Cite sourceId="bass-thickness" />
            </p>
          </div>
        )}

        {screen.id === "moon" && (
          <fieldset className="mt-4">
            <legend className="text-[15px]">
              NASA recommends a cabin of <b>34 % oxygen at 56.5 kPa</b> for Moon and Mars missions. <Cite sourceId="exploration-atmosphere" />
            </legend>
            <p className="mt-3 font-semibold">{MOON.question}</p>
            <div className="mt-2 grid gap-2">
              {MOON.choices.map((c, k) => {
                const chosen = save.answers.moon;
                const cls = chosen == null ? "" : c.correct ? "story-choice-right" : chosen === k ? "story-choice-wrong" : "opacity-50";
                return (
                  <button key={c.label} onClick={() => { if (chosen == null) { update({ answers: { ...save.answers, moon: k } }); sound.play(c.correct ? "right" : "wrong"); } }} disabled={chosen != null} className={`story-choice ${cls}`}>
                    <span className="story-choice-key">{String.fromCharCode(65 + k)}</span>
                    {c.label}
                    {chosen != null && c.correct && <span className="ml-auto text-xs">Atlas evidence</span>}
                  </button>
                );
              })}
            </div>
            {save.answers.moon != null && (
              <div className="mt-3 story-reveal" role="status">
                <p className="font-semibold">{moonRight ? "Exactly." : "Careful."} {MOON.reveal}</p>
                <p className="mt-1 text-sm text-muted">
                  NASA: “{quote("luci-fm2")!.quote}” <Cite sourceId="luci" />
                </p>
              </div>
            )}
          </fieldset>
        )}

        {screen.id === "debrief" && (
          <div className="mt-4">
            <ul className="grid grid-cols-2 gap-2">
              {BADGES.map((b) => {
                const got = b.id === "builder" ? allBuilt : b.id === "igniter" ? save.labLit : b.id === "caller" ? score === PREDICTIONS.length : moonRight;
                return (
                  <li key={b.id} className={`game-badge ${got ? "game-badge-on" : ""}`}>
                    <span className="game-badge-icon" aria-hidden="true">{got ? "★" : "☆"}</span>
                    <span className="font-semibold text-sm">{b.name}</span>
                    <span className="block text-[11px] text-muted">{got ? b.earned : "Not earned this time"}</span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-sm">
              Calls matched: <b className="num text-signal">{score}/{PREDICTIONS.length}</b>. Edge found: <b>{moonRight ? "yes" : "not yet"}</b>.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/mission" className="story-cta !py-2.5 !px-5">Plan your own mission</Link>
              <Link href="/atlas" className="game-btn !py-2.5">All {experiments.length} tests</Link>
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          <button onClick={() => go(-1)} disabled={save.screen === 0} className="text-sm text-muted hover:text-ink disabled:opacity-30">Back</button>
          <span className="text-xs text-faint hidden sm:inline">← → keys work too</span>
          {screen.id !== "debrief" && (
            <button onClick={() => go(1)} disabled={!canAdvance} className="story-cta !py-2.5 !px-5 disabled:opacity-40">
              {nextLabel(screen.id, canAdvance)}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function nextLabel(id: ScreenId, ok: boolean) {
  if (!ok) return { gravity: "Try the switch", build: "Install every part", lab: "Light the sample", moon: "Make your call" }[id as "gravity"] ?? "Make your call";
  return { built: "Into the lab", lab: "Start predicting", quiet: "To the Moon", moon: "Finish mission" }[id as "built"] ?? "Continue";
}

/* ---------- Ember's lines ---------- */
function Line({ id, gravityOn, labLit, built }: { id: ScreenId; gravityOn: boolean; labLit: boolean; built: number }) {
  switch (id) {
    case "hello":
      return <>On Earth, hot gas rises and pulls fresh air in from below. That&apos;s why I stand tall and flicker.</>;
    case "gravity":
      return gravityOn ? (
        <>Flip the switch and take gravity away. Watch what happens to me.</>
      ) : (
        <>See? Nothing rises in orbit. I turn small, round and blue, and only get the oxygen that drifts in. Ventilation decides everything now.</>
      );
    case "build":
      return built === 0 ? (
        <>Let&apos;s build the real thing: NASA&apos;s BASS-II wind tunnel from the space station. Start with the duct, then add parts. Drag them onto the tunnel or tap twice.</>
      ) : (
        <>Nice. Each part you add shows NASA&apos;s own description. Some parts need others first, just like on the station.</>
      );
    case "built":
      return <>Wind tunnel ready! That&apos;s the hardware astronauts used inside the station&apos;s glovebox in 2014.</>;
    case "lab":
      return labLit ? <>Lit! Same oxygen and airflow as NASA&apos;s test B20.</> : <>Your turn to run a test. Match NASA&apos;s settings, then hold the button to heat the igniter coil.</>;
    case "b16":
    case "b19":
    case "fabric":
      return <>Here&apos;s a real test. Make your call before the crew&apos;s notes reveal what happened.</>;
    case "log":
      return <>These are real lines from the crew and ground logbook, typed exactly as NASA printed them. Tap one to find it among all 56 tests.</>;
    case "quiet":
      return <>At the lowest flows I get dim, blue and very stable. I could hide for a long time. Try gusting the fan.</>;
    case "moon":
      return <>Future crews may breathe much richer air. Let&apos;s check what the evidence can tell them.</>;
    default:
      return <>Mission complete! Here&apos;s how you did.</>;
  }
}

/* ---------- field notes ---------- */
function FieldNotes({ screen, installed }: { screen: ScreenId; installed: Set<string> }) {
  const notes: string[] =
    screen === "build" || screen === "built"
      ? PARTS.filter((p) => installed.has(p.id)).map((p) => p.finding)
      : screen === "lab"
        ? ["hw-igniter", "hw-nitrogen", "hw-fan"]
        : screen === "quiet"
          ? ["dim-blue-low-flow", "tiny-flame-undetected"]
          : screen === "moon"
            ? ["exploration-atmosphere", "luci-first-lunar", "low-g-burns-lower-o2"]
            : ["low-flow-sensitivity", "bass-duct", "pmma-rod-limits"];
  return (
    <div className="mt-5 space-y-5 text-sm">
      {notes.length === 0 && <p className="text-muted">Install a part to see NASA&apos;s description of it here.</p>}
      {[...new Set(notes)].map((id) => {
        const f = quote(id);
        if (!f) return null;
        return (
          <figure key={id} className="m-0">
            <blockquote className="text-[14px]">“{f.quote}”</blockquote>
            <figcaption className="mt-1"><Cite sourceId={f.source_id} page={f.pdf_page} /></figcaption>
          </figure>
        );
      })}
      <div className="border-t border-rule pt-4">
        <h3 className="font-semibold">Glossary</h3>
        <dl className="mt-2 space-y-2 text-muted">
          <div><dt className="text-ink inline">Opposed flow: </dt><dd className="inline">air moves against the direction the flame spreads.</dd></div>
          <div><dt className="text-ink inline">Concurrent flow: </dt><dd className="inline">air moves the same way the flame spreads.</dd></div>
          <div><dt className="text-ink inline">Quench: </dt><dd className="inline">the flame goes out because too little flow reaches it.</dd></div>
          <div><dt className="text-ink inline">Blowoff: </dt><dd className="inline">the flame goes out because the flow is too strong.</dd></div>
        </dl>
      </div>
      <p className="text-muted">
        Every quote is checked word for word against NASA&apos;s PDFs. <Link href="/sources" className="link">All sources</Link>
      </p>
    </div>
  );
}

/* ---------- dial ---------- */
function Dial(props: { label: string; unit: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; disabled?: boolean; band: string; ok: boolean }) {
  return (
    <label className="block">
      <span className="flex justify-between text-sm">
        <span className="text-muted">{props.label}</span>
        <b className={`num ${props.ok ? "text-signal" : ""}`}>{props.value.toFixed(1)} {props.unit}{props.ok ? " ✓" : ""}</b>
      </span>
      <span className="relative block mt-2">
        <span className={`absolute top-1/2 -translate-y-1/2 h-3 rounded-sm bg-[rgba(86,212,228,0.35)] ${props.band}`} aria-hidden="true" />
        <input
          type="range"
          min={props.min}
          max={props.max}
          step={props.step}
          value={props.value}
          disabled={props.disabled}
          onChange={(e) => props.onChange(Number(e.target.value))}
          className="relative w-full accent-[var(--signal)]"
        />
      </span>
    </label>
  );
}
