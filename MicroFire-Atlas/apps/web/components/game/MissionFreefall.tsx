"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CloudPoint, FlameScene, PartId, SceneState } from "@/components/three/FlameScene";
import { Cite } from "@/components/Cite";
import { Apparatus2D } from "@/components/game/Apparatus2D";
import { CrewDirector, type CrewCue } from "@/components/game/CrewDirector";
import { Ember, EmberSays, type Form, type Mood } from "@/components/game/Ember";
import { Sparks } from "@/components/game/Sparks";
import { useSound } from "@/components/game/sound";
import { useExplorer } from "@/components/guide/EmberGuide";
import { EvidenceConstellation } from "@/components/world/EvidenceConstellation";
import { CinematicWorld } from "@/components/world/CinematicWorld";
import { experiments, findings, getExperiment } from "@/lib/data";
import { blockedBy, CHAPTERS, FABRIC_QUENCH, LAB_TARGET, LOG_CLUES, MOON, MOON_AIR, PARTS, PREDICTIONS, type ChapterId } from "@/lib/game";
import { CREW, type CrewId } from "@/lib/guide";

/* ---------------- screens ---------------- */

type ScreenId = "hello" | "gravity" | "build" | "check" | "lab" | "b16" | "b19" | "fabric" | "log" | "quiet" | "moon" | "debrief";
const SCREENS: { id: ScreenId; chapter: ChapterId; goal: string }[] = [
  { id: "hello", chapter: "brief", goal: "Meet Ember" },
  { id: "gravity", chapter: "brief", goal: "Switch gravity off and watch the flame" },
  { id: "build", chapter: "build", goal: "Install all 10 BASS-II parts" },
  { id: "check", chapter: "build", goal: "Find and fix 2 setup mix-ups" },
  { id: "lab", chapter: "lab", goal: "Match test B20, then fire the igniter" },
  { id: "b16", chapter: "predict", goal: "Guess, then turn the fan down" },
  { id: "b19", chapter: "predict", goal: "Guess, then move the fan lever" },
  { id: "fabric", chapter: "predict", goal: "Guess, then line up 6 fabric records" },
  { id: "log", chapter: "log", goal: "Pin one real crew clue to your notebook" },
  { id: "quiet", chapter: "quiet", goal: "Find the hidden flame, then gust the fan" },
  { id: "moon", chapter: "moon", goal: "Mark atmosphere A on the map" },
  { id: "debrief", chapter: "debrief", goal: "See your evidence trail" },
];

type Save = {
  screen: number;
  reached: number;
  installed: string[];
  fixes: { sample: boolean; fan: boolean };
  answers: Record<string, number>;
  observed: Record<string, boolean>;
  labLit: boolean;
  gravityToggled: boolean;
  gravityOn: boolean;
  pinned: string | null;
  quietFound: boolean;
  gusted: boolean;
  placed: string[];
  marker: boolean;
};
const FRESH: Save = {
  screen: 0, reached: 0, installed: [], fixes: { sample: false, fan: false }, answers: {}, observed: {}, labLit: false,
  gravityToggled: false, gravityOn: true, pinned: null, quietFound: false, gusted: false, placed: [], marker: false,
};
const KEY = "microfire-mission-freefall-v2";

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

const quote = (id?: string) => (id ? findings.find((f) => f.id === id) : undefined);
const exp = (id: string) => getExperiment(id)!;
const RECAP_MS = 2600;

/* ---------------- component ---------------- */

export function MissionFreefall() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<FlameScene | null>(null);
  const { gentle, setGentle, discover } = useExplorer();
  const [started, setStarted] = useState(false);
  const [titleGuide, setTitleGuide] = useState<CrewId>("tala");
  const [save, setSave] = useState<Save>(FRESH);
  const [hasSave, setHasSave] = useState(false);
  const [noGL, setNoGL] = useState(false);
  const [flat, setFlat] = useState(false); // child chose the 2D view
  const [burst, setBurst] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sheetMin, setSheetMin] = useState(false);
  const [selected, setSelected] = useState<PartId | null>(null);
  const [toast, setToast] = useState<{ text: string; finding?: string } | null>(null);
  const [gravityOn, setGravityOn] = useState(true);
  const [o2, setO2] = useState(20.9);
  const [flow, setFlow] = useState(10);
  const [heat, setHeat] = useState(0);
  const [igniting, setIgniting] = useState(false);
  const [fanDown, setFanDown] = useState(0); // B16 turn-down animation between the two logged endpoints, 0..1
  const [lever, setLever] = useState<5 | 10>(5); // B19 fan lever: B20's 5 cm/s or B19's 10 cm/s
  const [hint, setHint] = useState<string | null>(null);
  const [recap, setRecap] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ part: PartId; x: number; y: number } | null>(null);
  const igniteRef = useRef<number | null>(null);
  const turnRef = useRef<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const sound = useSound();
  const cloud = useMemo(() => cloudPoints(), []);
  const twoD = noGL || flat;

  const screen = SCREENS[save.screen];
  const chapterIdx = CHAPTERS.findIndex((c) => c.id === screen.chapter);
  const reachedChapter = CHAPTERS.findIndex((c) => c.id === SCREENS[save.reached].chapter);
  const installed = useMemo(() => new Set(save.installed), [save.installed]);
  const allBuilt = PARTS.every((p) => installed.has(p.id));
  const fixed = save.fixes.sample && save.fixes.fan;

  // load / persist progress
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const old = JSON.parse(raw) as Partial<Save>;
        const s = { ...FRESH, ...old, gravityToggled: old.gravityOn == null ? false : old.gravityToggled } as Save;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from storage
        setSave(s);
        setGravityOn(s.gravityOn);
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

  const start = useCallback(
    (fresh = false) => {
      setNoGL(!document.createElement("canvas").getContext("webgl2"));
      if (fresh) { setSave(FRESH); setGravityOn(true); }
      setStarted(true);
      window.scrollTo(0, 0);
      sound.play("whoosh");
    },
    [sound],
  );
  // arriving from Home's "Start the mission" trip skips the title card
  useEffect(() => {
    if (new URLSearchParams(location.search).get("start") === "1") {
      history.replaceState(null, "", "/story");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time handoff from the home transition
      start();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once on mount

  /* ---------- scene state per screen ---------- */
  const pred = PREDICTIONS.find((p) => p.id === screen.id);
  const sceneState = useMemo((): SceneState => {
    const base = { cloud } as const;
    if (screen.id === "debrief" && recap != null) {
      if (recap === 0) return { ...base, view: "duct", gravity: "orbit", o2: 16.5, flow: 5, outcome: "burning" };
      if (recap === 1) return { ...base, view: "cloud", gravity: "orbit", o2: 18, flow: 5, outcome: "none", highlight: [save.pinned ?? LAB_TARGET.testId] };
      return { ...base, view: "cloud", gravity: "orbit", o2: 34, flow: 5, outcome: "none", voidRegion: { y: 2.9, label: "34 % O₂, 56.5 kPa: no atlas tests here" } };
    }
    switch (screen.id) {
      case "hello":
        return { ...base, view: "bench", gravity: "earth", o2: 21, flow: 0, outcome: "burning" };
      case "gravity":
        return { ...base, view: "bench", gravity: gravityOn ? "earth" : "orbit", o2: 21, flow: 0, outcome: gravityOn ? "burning" : "dim" };
      case "build":
        return { ...base, view: "duct", gravity: "orbit", o2: 21, flow: 0, outcome: "none", parts: save.installed, ghost: selected ?? drag?.part ?? null };
      case "check":
        return { ...base, view: "duct", gravity: "orbit", o2: 21, flow: 4, outcome: "none", sampleLoose: !save.fixes.sample, fanReversed: !save.fixes.fan };
      case "lab":
        return { ...base, view: "duct", gravity: "orbit", o2, flow, outcome: save.labLit && !igniting ? "burning" : "none", igniter: igniting ? heat : save.labLit ? 0.2 : 0, focus: save.labLit };
      case "b16":
      case "b19":
      case "fabric": {
        const sc = pred!.scene, seen = !!save.observed[pred!.id];
        const f = screen.id === "b16" ? sc.flow - fanDown * (sc.flow - sc.afterFlow) : screen.id === "b19" ? lever : seen ? sc.afterFlow : sc.flow;
        return { ...base, view: "duct", gravity: "orbit", o2: sc.o2, flow: f, outcome: seen ? sc.after : sc.before, material: sc.material, focus: true };
      }
      case "log":
        return { ...base, view: "cloud", gravity: "orbit", o2: 18, flow: 5, outcome: "none", highlight: save.pinned ? [save.pinned] : LOG_CLUES.map((c) => c.id) };
      case "quiet":
        return { ...base, view: "duct", gravity: "orbit", o2: 20.6, flow: 0.6, outcome: "dim", seek: save.quietFound ? "found" : "hidden", focus: true };
      case "moon":
        return { ...base, view: "cloud", gravity: "orbit", o2: 34, flow: 5, outcome: "none", voidRegion: save.marker ? { y: 2.9, label: "34 % O₂, 56.5 kPa: no atlas tests here" } : null };
      default:
        return { ...base, view: "duct", gravity: "orbit", o2: 16.5, flow: 5, outcome: "burning" };
    }
  }, [screen.id, cloud, gravityOn, save.installed, save.fixes, save.labLit, save.observed, save.pinned, save.quietFound, save.marker, selected, drag, o2, flow, heat, igniting, fanDown, lever, pred, recap]);

  // boot the 3D scene after the title screen
  useEffect(() => {
    if (!started || twoD || !canvasRef.current || sceneRef.current) return;
    let alive = true;
    import("@/components/three/FlameScene").then(({ FlameScene }) => {
      if (!alive || !canvasRef.current) return;
      try {
        sceneRef.current = new FlameScene(canvasRef.current, sceneState, { panelLeft: true });
        sceneRef.current.setGentle(gentle);
      } catch {
        setNoGL(true); // context creation failed: the 2D surface takes over with the same choices
      }
    });
    const onVis = () => sceneRef.current?.setRunning(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [started, twoD]); // eslint-disable-line react-hooks/exhaustive-deps -- boot once; later state flows through setState below
  useEffect(() => {
    if (twoD && sceneRef.current) {
      sceneRef.current.dispose();
      sceneRef.current = null;
    }
  }, [twoD]);
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
  // debrief recap: three short shots, then hold on the postcard
  useEffect(() => {
    if (recap == null) return;
    const t = setTimeout(() => setRecap(recap >= 2 ? null : recap + 1), gentle ? 1200 : RECAP_MS);
    return () => clearTimeout(t);
  }, [recap, gentle]);

  const celebrate = useCallback(
    (text: string, d?: string) => {
      setBurst((b) => b + 1);
      setBanner(text);
      sound.play("fanfare");
      if (d) discover(d);
    },
    [discover, sound],
  );

  /* ---------- navigation ---------- */
  const canAdvance =
    (screen.id === "gravity" && save.gravityToggled) ||
    (screen.id === "build" && allBuilt) ||
    (screen.id === "check" && fixed) ||
    (screen.id === "lab" && save.labLit) ||
    (["b16", "b19", "fabric"].includes(screen.id) && !!save.observed[screen.id]) ||
    (screen.id === "log" && !!save.pinned) ||
    (screen.id === "quiet" && save.quietFound) ||
    (screen.id === "moon" && save.answers.moon != null) ||
    screen.id === "hello";

  const goTo = useCallback(
    (n: number) => {
      n = Math.max(0, Math.min(SCREENS.length - 1, n));
      if (n === save.screen) return;
      setSelected(null);
      setHint(null);
      setRecap(null);
      setSheetMin(false);
      sound.play("tick");
      update({ screen: n, reached: Math.max(save.reached, n) });
      if (SCREENS[n].id === "debrief" && n > save.reached) {
        celebrate("Mission complete!");
        setRecap(0);
      }
    },
    [save.screen, save.reached, sound, update, celebrate],
  );
  const go = useCallback((d: 1 | -1) => (d === 1 && !canAdvance ? undefined : goTo(save.screen + d)), [canAdvance, goTo, save.screen]);

  useEffect(() => {
    if (!started) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, [role=slider], button, a")) return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "Escape") { setNotesOpen(false); setSettingsOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, started]);

  /* ---------- 02 build ---------- */
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
      if (next.length === PARTS.length) celebrate("Wind tunnel built!", "built");
    },
    [installed, save.installed, sound, update, celebrate],
  );
  const quickBuild = () => {
    update({ installed: PARTS.map((p) => p.id) });
    sound.play("snap");
    setToast({ text: "Quick build: every part installed in a valid order." });
    discover("built");
  };
  // pointer drag from shelf onto the stage
  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d));
    const up = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el?.closest("[data-stage]")) install(drag.part);
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

  /* ---------- 02b readiness check ---------- */
  const fix = (which: "sample" | "fan") => {
    if (save.fixes[which]) return;
    const fixes = { ...save.fixes, [which]: true };
    update({ fixes });
    sound.play("snap");
    if (fixes.sample && fixes.fan) celebrate("Setup ready!", "fixed");
  };

  /* ---------- 03 ignition: prepare → flash → held result, replayable and skippable ---------- */
  const inBand = Math.abs(o2 - LAB_TARGET.o2) <= LAB_TARGET.o2Tol && Math.abs(flow - LAB_TARGET.flow) <= LAB_TARGET.flowTol;
  const finishIgnition = useCallback(() => {
    if (igniteRef.current) cancelAnimationFrame(igniteRef.current);
    igniteRef.current = null;
    setIgniting(false);
    setHeat(0);
    sceneRef.current?.ignite();
    sound.play("ignite");
    if (!save.labLit) {
      update({ labLit: true });
      celebrate("Ignition!", "b20");
    }
  }, [celebrate, save.labLit, sound, update]);
  const fire = () => {
    if (!inBand || igniting) return;
    if (gentle) return finishIgnition();
    setIgniting(true);
    const t0 = performance.now();
    const tick = () => {
      const h = Math.min(1, (performance.now() - t0) / 1400);
      setHeat(h);
      if (h >= 1) return finishIgnition();
      igniteRef.current = requestAnimationFrame(tick);
    };
    igniteRef.current = requestAnimationFrame(tick);
  };
  useEffect(() => () => { if (igniteRef.current) cancelAnimationFrame(igniteRef.current); }, []);

  /* ---------- 04 predictions: guess first, then a different gesture reveals the record ---------- */
  const guess = (id: string, k: number) => {
    if (save.answers[id] != null) return;
    update({ answers: { ...save.answers, [id]: k } });
    sound.play("tick");
  };
  const observe = useCallback(
    (id: string) => {
      if (save.observed[id]) return;
      update({ observed: { ...save.observed, [id]: true } });
      sound.play(id === "b19" ? "whoosh" : "right");
      discover(id);
    },
    [save.observed, update, sound, discover],
  );
  // B16: holding the dial plays the turn-down from the logged start to the logged end. Letting go
  // early springs back to the start, so no in-between state is ever held or shown as a reading.
  const stopTurn = () => {
    if (turnRef.current) cancelAnimationFrame(turnRef.current);
    turnRef.current = null;
  };
  const turnDown = () => {
    if (turnRef.current || save.observed.b16) return;
    if (gentle) {
      setFanDown(1);
      return observe("b16");
    }
    const t0 = performance.now() - fanDown * 1800;
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / 1800);
      setFanDown(k);
      if (k >= 1) {
        turnRef.current = null;
        return observe("b16");
      }
      turnRef.current = requestAnimationFrame(tick);
    };
    turnRef.current = requestAnimationFrame(tick);
  };
  const releaseTurn = () => {
    if (!turnRef.current) return;
    stopTurn();
    setFanDown(0);
  };
  useEffect(() => stopTurn, []);
  const place = (id: string) => {
    if (save.placed.includes(id)) return;
    const placed = [...save.placed, id];
    update({ placed });
    sound.play("snap");
    if (placed.length === FABRIC_QUENCH.length) observe("fabric");
  };

  /* ---------- 05 log ---------- */
  const pin = (id: string) => {
    update({ pinned: id });
    sound.play("snap");
    discover("clue");
  };

  /* ---------- 07 moon map ---------- */
  const tapMap = (kpa: number, pct: number) => {
    if (save.marker) return;
    if (Math.abs(kpa - MOON_AIR.kpa) <= 8 && Math.abs(pct - MOON_AIR.o2) <= 3) {
      update({ marker: true });
      sound.play("snap");
    } else {
      setHint(`Your marker is at ${Math.round(pct)} % oxygen and ${Math.round(kpa)} kPa. NASA-studied atmosphere A is ${MOON_AIR.o2} % and ${MOON_AIR.kpa} kPa: ${pct < MOON_AIR.o2 ? "go higher" : "go lower"}${kpa > MOON_AIR.kpa + 8 ? " and further left" : kpa < MOON_AIR.kpa - 8 ? " and further right" : ""}.`);
      sound.play("tick");
    }
  };

  // when a new gesture or result appears, bring it into the task sheet's view (phones scroll the sheet)
  const stage = `${screen.id}:${save.answers[screen.id] ?? ""}:${save.observed[screen.id] ?? ""}:${save.marker}:${save.answers.moon ?? ""}:${save.quietFound}:${save.labLit}`;
  useEffect(() => {
    const els = sheetRef.current?.querySelectorAll("[data-focus]");
    els?.[els.length - 1]?.scrollIntoView({ block: "nearest", behavior: gentle ? "auto" : "smooth" });
  }, [stage, gentle]);

  /* ---------- Ember per screen ---------- */
  const ember: { form: Form; mood: Mood } = (() => {
    const form: Form = screen.id === "hello" || (screen.id === "gravity" && gravityOn) ? "earth" : "orbit";
    if (pred && save.observed[pred.id]) return { form, mood: "surprised" };
    const m: Partial<Record<ScreenId, Mood>> = {
      hello: "happy", gravity: "curious", build: "happy", check: fixed ? "proud" : "worried", lab: save.labLit ? "proud" : "curious",
      log: "curious", quiet: save.quietFound ? "proud" : "worried", moon: save.marker ? "proud" : "curious", debrief: "proud",
    };
    return { form, mood: m[screen.id] ?? "curious" };
  })();

  const crewCue: CrewCue = (() => {
    switch (screen.id) {
      case "hello": return { crew: "tala", phase: "welcome", pose: "welcome", line: "Welcome aboard! Ember has one strange flame to show you.", aim: "Tap Let's go, then change gravity." };
      case "gravity": return save.gravityToggled
        ? { crew: "tala", phase: "seen", pose: "cheer", line: "You saw the illustration change. Now let's investigate real tests.", aim: "Continue to the wind tunnel." }
        : { crew: "tala", phase: "try", pose: "point", line: "Watch Ember when gravity changes. What do you notice?", aim: "Tap Switch off gravity." };
      case "build": return allBuilt
        ? { crew: "kofi", phase: "built", pose: "cheer", line: "All ten parts are in place. Our experiment is ready for a check.", aim: "Open the setup check." }
        : { crew: "kofi", phase: installed.size ? "building" : "begin", pose: "point", line: installed.size ? `${installed.size} of ten parts installed. Find what fits next.` : "Let's build the BASS-II wind tunnel. The flow duct goes first.", aim: "Tap a part to preview it, then tap again to install." };
      case "check": return fixed
        ? { crew: "kofi", phase: "fixed", pose: "cheer", line: "Both practice mix-ups are fixed. Time to run a recorded test.", aim: "Continue to the ignition lab." }
        : { crew: "kofi", phase: "checking", pose: "focus", line: "Two things look wrong in this practice setup. Can you spot them?", aim: "Check the sample and the fan." };
      case "lab": return save.labLit
        ? { crew: "kofi", phase: "lit", pose: "cheer", line: "Ignition! You matched the settings recorded for test B20.", aim: "Open B20's result and source." }
        : inBand
          ? { crew: "kofi", phase: "matched", pose: "point", line: "The oxygen and fan now match B20's recorded settings.", aim: "Fire the igniter coil." }
          : { crew: "kofi", phase: "setting", pose: "focus", line: "Set the controls to B20's starting conditions.", aim: "16.5% oxygen · 5 cm/s airflow." };
      case "b16": return save.observed.b16
        ? { crew: "mei", phase: "result", pose: "wonder", line: "B16 quenched as the flow fell. Another slow-air flame can behave differently.", aim: "Read B16's crew note and source." }
        : { crew: "mei", phase: save.answers.b16 == null ? "guess" : "turn", pose: save.answers.b16 == null ? "focus" : "point", line: save.answers.b16 == null ? "What happened when the B16 fan slowed? Make your prediction." : "Now turn the fan down, as the crew did.", aim: save.answers.b16 == null ? "Choose one prediction." : "Hold the fan dial to reveal the record." };
      case "b19": return save.observed.b19
        ? { crew: "mei", phase: "result", pose: "wonder", line: "B19 started at 10 cm/s, then blew out after the fan changed.", aim: "Read B19's crew note and source." }
        : { crew: "mei", phase: save.answers.b19 == null ? "guess" : "lever", pose: save.answers.b19 == null ? "focus" : "point", line: save.answers.b19 == null ? "Would more airflow keep B19 burning? Make your prediction." : "Now move between the two recorded fan positions.", aim: save.answers.b19 == null ? "Choose one prediction." : "Switch from 5 to 10 cm/s." };
      case "fabric": return save.observed.fabric
        ? { crew: "mei", phase: "result", pose: "cheer", line: "You lined up six real fabric records. Look at where each flame went out.", aim: "Inspect the plotted values and sources." }
        : { crew: "mei", phase: save.answers.fabric == null ? "guess" : "place", pose: "point", line: save.answers.fabric == null ? "How might oxygen change the airflow needed for a flame?" : `${save.placed.length} of six records placed. Compare their oxygen and flow.`, aim: save.answers.fabric == null ? "Choose a prediction." : "Place the remaining record cards." };
      case "log": return save.pinned
        ? { crew: "mei", phase: "pinned", pose: "cheer", line: `You pinned the crew note for ${exp(save.pinned).test_id}.`, aim: "Open its full record or continue." }
        : { crew: "mei", phase: "search", pose: "focus", line: "These clues come from real crew notes. Which one catches your eye?", aim: "Pin one note to your notebook." };
      case "quiet": return save.quietFound
        ? { crew: "mei", phase: save.gusted ? "gusted" : "found", pose: "wonder", line: save.gusted ? "Airflow changed the scene. Compare that illustration with the cited finding." : "You found the dim flame. Some low-flow flames can stay lit.", aim: save.gusted ? "Read the source before continuing." : "Try the gust, then inspect the evidence." }
        : { crew: "mei", phase: "seek", pose: "focus", line: "A flame can be hard to see when it is dim and blue.", aim: "Find the flame in the chamber." };
      case "moon": return save.answers.moon != null
        ? { crew: "tala", phase: "gap", pose: "wonder", line: "These atlas rows do not cover NASA-studied atmosphere A. That's a real question to keep.", aim: "Open the evidence gap or finish the mission." }
        : { crew: "tala", phase: save.marker ? "marked" : "map", pose: "point", line: save.marker ? "Your marker sits beyond the conditions in this atlas. What can we honestly say?" : "Let's mark NASA-studied atmosphere A on our evidence map.", aim: save.marker ? "Choose the evidence answer." : "Mark 34% oxygen at 56.5 kPa." };
      case "debrief": return { crew: "tala", phase: "debrief", pose: "cheer", line: "Look at your evidence trail. Which NASA clue would you show someone else?", aim: "Revisit a test or explore the atlas." };
    }
  })();

  /* ---------- title screen ---------- */
  if (!started)
    return (
      <section className="mission-intro relative min-h-[calc(100vh-3.5rem)] overflow-hidden">
        <CinematicWorld world="portal" priority />
        <div className="mission-intro-inner relative mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14">
          <div className="mission-intro-copy">
            <p className="mission-intro-kicker"><span aria-hidden="true">✦</span> Mission Freefall · eight chapters of discovery</p>
            <h1 className="display mission-intro-title">Build it.<br />Light it.<br /><em>Call it.</em></h1>
            <p className="mission-intro-deck">
              Assemble NASA&apos;s real space-station fire experiment, light a sample, and guess what the flames did before the
              crew&apos;s own notes show you.
            </p>
            <div className="mission-intro-actions">
              <button onClick={() => start()} className="story-cta">
                {hasSave ? "Continue mission" : "Start the mission"} <span aria-hidden="true">↗</span>
              </button>
              {hasSave && (
                <button onClick={() => start(true)} className="border border-rule-strong px-5 py-3 rounded-full hover:border-signal bg-void/60">
                  Start over
                </button>
              )}
              <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
                <input type="checkbox" checked={sound.on} onChange={(e) => sound.setOn(e.target.checked)} className="accent-[var(--signal)]" />
                Sound effects
              </label>
            </div>
          </div>
          <div className="mission-intro-crew" aria-label="Meet your mission crew">
            <div className="mission-crew-orbit" aria-hidden="true"><span /><span /><span /></div>
            {/* eslint-disable-next-line @next/next/no-img-element -- original illustrated character cutout */}
            <img key={titleGuide} src={CREW[titleGuide].img} alt="" className="mission-crew-actor" decoding="async" />
            <div className="mission-crew-speech" aria-live="polite">
              <p className="mission-crew-name">{CREW[titleGuide].name} <span>· {CREW[titleGuide].job.split(":")[0]}</span></p>
              <p>{{ tala: "I'll guide you from the station to the edge of what these tests can tell us. Ready to meet Ember?", kofi: "We'll build the BASS-II wind tunnel, check its parts, then set up a recorded test.", mei: "I'll help you make a prediction, read the crew's notes, and find the NASA evidence." }[titleGuide]}</p>
            </div>
            <div className="mission-crew-select" role="group" aria-label="Choose a crew guide">
              {(["tala", "kofi", "mei"] as const).map((id) => (
                <button type="button" key={id} className={`mission-crew-choice ${titleGuide === id ? "mission-crew-choice-active" : ""}`} aria-pressed={titleGuide === id} onClick={() => setTitleGuide(id)}>
                  <span>{CREW[id].name}</span><small>{CREW[id].job.split(":")[0]}</small>
                </button>
              ))}
            </div>
          </div>
          <ol className="mission-intro-path" aria-label="Eight mission chapters">
            {CHAPTERS.map((c) => <li key={c.id}><span className="num">{c.n}</span><span>{c.title}</span></li>)}
          </ol>
        </div>
      </section>
    );

  /* ---------- game ---------- */
  const chapter = CHAPTERS[chapterIdx];
  const nextLabel = !canAdvance
    ? "Finish the task first"
    : ({ hello: "Let's go", check: "Into the lab", lab: "Next test", fabric: "Open the logbook", quiet: "To the Moon", moon: "Finish mission" } as Partial<Record<ScreenId, string>>)[screen.id] ?? "Continue";

  return (
    <section className={`fixed inset-x-0 bottom-0 top-14 z-30 overflow-clip bg-void game-${screen.id}`} aria-label="Mission Freefall">
      <div className="game-cinematic-backdrop"><CinematicWorld world={screen.id === "moon" ? "moon" : screen.id === "debrief" || screen.id === "log" ? "constellation" : "lab"} /></div>
      <div className="absolute inset-0 story-stars" aria-hidden="true" />
      <div className="game-bay" data-view={sceneState.view} aria-hidden="true"><span className="game-bay-window" /><span className="game-bay-strut" /><span className="game-bay-light" /></div>
      {screen.id === "moon" && <div className="moon-window" aria-hidden="true" />}
      <div data-stage className="absolute inset-0">
        {twoD ? (
          <div className="game-2d">
            <Apparatus2D s={sceneState} />
          </div>
        ) : (
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" aria-hidden="true" />
        )}
      </div>
      {sceneState.view === "bench" && <p className="game-scene-label" aria-live="polite">{sceneState.gravity === "earth" ? "On Earth" : "In orbit"} <span>· illustration</span></p>}
      <Sparks burst={burst} />
      <CrewDirector cue={crewCue} />
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
          <p className="text-xs text-muted num">Chapter {chapter.n} of {CHAPTERS.length}</p>
          <p className="display text-lg leading-tight">{chapter.title}</p>
        </div>
        <ol className="hidden md:flex items-center gap-1.5" aria-label="Chapters">
          {CHAPTERS.map((c, k) => {
            const open = k <= reachedChapter;
            return (
              <li key={c.id}>
                <button
                  disabled={!open}
                  onClick={() => goTo(SCREENS.findIndex((x) => x.chapter === c.id))}
                  title={open ? `Go to ${c.title}` : `${c.title} (not reached yet)`}
                  aria-current={k === chapterIdx ? "step" : undefined}
                  className={`game-chip ${k < chapterIdx ? "game-chip-done" : k === chapterIdx ? "game-chip-now" : ""}`}
                >
                  <span className="num">{c.n}</span>
                  <span className="sr-only">{c.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="flex items-center gap-2">
          {!twoD && <button onClick={() => sceneRef.current?.recenter()} className="game-btn" title="Point the camera back at the experiment" aria-label="Recenter experiment"><span className="hidden sm:inline">Recenter</span><span className="sm:hidden" aria-hidden="true">◎</span></button>}
          <button onClick={() => setNotesOpen((o) => !o)} aria-expanded={notesOpen} aria-label="Notebook" className="game-btn"><span className="hidden sm:inline">Notebook</span><span className="sm:hidden" aria-hidden="true">▤</span></button>
          <button onClick={() => setSettingsOpen((o) => !o)} aria-expanded={settingsOpen} className="game-btn" aria-label="Settings">⚙</button>
        </div>
      </div>

      {settingsOpen && (
        <div className="absolute right-4 sm:right-6 top-16 z-40 game-pop w-64" role="dialog" aria-label="Settings">
          <label className="flex items-center justify-between py-2"><span>Sound effects</span><input type="checkbox" checked={sound.on} onChange={(e) => sound.setOn(e.target.checked)} className="accent-[var(--signal)]" /></label>
          <label className="flex items-center justify-between py-2"><span>Pause motion</span><input type="checkbox" checked={gentle} onChange={(e) => setGentle(e.target.checked)} className="accent-[var(--signal)]" /></label>
          <label className="flex items-center justify-between py-2"><span>2D view</span><input type="checkbox" checked={twoD} disabled={noGL} onChange={(e) => setFlat(e.target.checked)} className="accent-[var(--signal)]" /></label>
          {noGL && <p className="text-xs text-muted">3D isn&apos;t available here, so you&apos;re playing in 2D. Every task still works.</p>}
          <button onClick={() => { setSave({ ...FRESH }); setGravityOn(true); setSettingsOpen(false); setO2(20.9); setFlow(10); setFanDown(0); setLever(5); }} className="mt-2 w-full game-btn">Start a new mission</button>
        </div>
      )}

      {/* notebook drawer */}
      <aside className={`game-drawer ${notesOpen ? "game-drawer-open" : ""}`} aria-hidden={!notesOpen} aria-label="Notebook">
        <div className="flex items-center justify-between">
          <h2 className="display text-xl">Notebook</h2>
          <button onClick={() => setNotesOpen(false)} className="game-btn" tabIndex={notesOpen ? 0 : -1}>Close</button>
        </div>
        <FieldNotes screen={screen.id} installed={installed} pinned={save.pinned} />
      </aside>

      {/* drag ghost */}
      {drag && (
        <div ref={ghostRef} className="fixed left-0 top-0 z-50 pointer-events-none game-ghost">
          {PARTS.find((p) => p.id === drag.part)!.name}
        </div>
      )}

      {/* toast */}
      {toast && (
        <div className="absolute left-1/2 -translate-x-1/2 top-20 z-40 game-toast w-[calc(100%-2rem)] max-w-xl" role="status">
          <p>{toast.text}</p>
          {toast.finding && quote(toast.finding) && (
            <p className="mt-1 text-xs text-muted">
              NASA: “{quote(toast.finding)!.quote}” <Cite sourceId={quote(toast.finding)!.source_id} page={quote(toast.finding)!.pdf_page} />
            </p>
          )}
        </div>
      )}

      {/* debrief recap control */}
      {screen.id === "debrief" && recap != null && (
        <div className="absolute left-1/2 -translate-x-1/2 top-20 z-40 game-toast w-[calc(100%-2rem)] max-w-md text-center" role="status">
          <p className="font-semibold">{["Your wind tunnel, lit at B20's settings", save.pinned ? `Your pinned clue: ${exp(save.pinned).test_id}` : "Test B20 among all 56 tests", "The edge you found: no tests up here"][recap]}</p>
          <button onClick={() => setRecap(null)} className="mt-1 text-sm link">Skip recap</button>
        </div>
      )}

      {/* main task sheet */}
      <div key={screen.id} ref={sheetRef} className={`story-panel game-sheet ${sheetMin ? "game-sheet-min" : ""}`}>
        <div className="flex items-start justify-between gap-3">
          <p className="game-goal"><span aria-hidden="true">◎ </span>{screen.goal}</p>
          <button onClick={() => setSheetMin((m) => !m)} className="sm:hidden text-xs text-muted px-2 py-1 border border-rule rounded-full" aria-expanded={!sheetMin}>
            {sheetMin ? "Show task" : "Watch"}
          </button>
        </div>
        <div className="game-sheet-body">
          <EmberSays form={ember.form} mood={ember.mood} size={76}>
            <Line id={screen.id} gravityOn={gravityOn} labLit={save.labLit} built={installed.size} fixed={fixed} found={save.quietFound} observed={!!(pred && save.observed[pred.id])} />
          </EmberSays>

          {screen.id === "gravity" && (
            <button onClick={() => { const next = !gravityOn; setGravityOn(next); update({ gravityToggled: true, gravityOn: next }); sound.play("whoosh"); discover("gravity"); }} className="mt-4 story-action">
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
                        <span className="font-medium text-[14px]">{done ? "✓ " : ""}{p.name}</span>
                        <span className="block text-[11px] text-muted">{done ? "Installed" : selected === p.id ? "Tap again to install" : blocked ? "Needs another part first" : "Tap to preview, or drag in"}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-[11px] text-faint">3D illustration. Camera and glove models: Poly Haven (CC0) and NASA 3D Resources.</p>
            </div>
          )}

          {screen.id === "check" && (
            <div className="mt-4">
              <ul className="space-y-2">
                <Check ok label="All 10 parts installed" />
                <Check ok={save.fixes.sample} label="Sample sits flat in its holder" action={save.fixes.sample ? undefined : { text: "Slide the sample in", run: () => fix("sample") }} problem="The sample is floating loose above the holder." />
                <Check ok={save.fixes.fan} label="Fan blows air toward the sample" action={save.fixes.fan ? undefined : { text: "Flip the fan around", run: () => fix("fan") }} problem="The airflow streaks run backwards, away from the sample." />
                <Check ok label="Cameras look through the windows" />
              </ul>
              <p className="mt-3 text-xs text-faint">
                Practice check: we mixed these two things up on purpose. It&apos;s a game puzzle, not a mistake NASA&apos;s crew made.
              </p>
            </div>
          )}

          {screen.id === "lab" && (
            <div className="mt-4 space-y-4">
              <p className="text-sm">
                NASA&apos;s recorded settings for test B20: <b className="num">16.5 % oxygen</b> and <b className="num">5 cm/s</b> airflow. Move both dials into the green band.
              </p>
              <Dial label="Oxygen (add nitrogen to lower it)" unit="%" min={14} max={21} step={0.1} value={o2} onChange={setO2} disabled={save.labLit} band="left-[31.4%] w-[8.6%]" ok={Math.abs(o2 - LAB_TARGET.o2) <= LAB_TARGET.o2Tol} />
              <Dial label="Fan speed" unit="cm/s" min={0} max={12} step={0.1} value={flow} onChange={setFlow} disabled={save.labLit} band="left-[37.5%] w-[8.4%]" ok={Math.abs(flow - LAB_TARGET.flow) <= LAB_TARGET.flowTol} />
              <p className="text-[11px] text-faint">The dials are a practice control. Only the green-band values come from NASA&apos;s record; other positions are not test results.</p>
              {!save.labLit || igniting ? (
                <div className="flex items-center gap-3">
                  <button onClick={fire} disabled={!inBand || igniting} className="game-ignite">
                    <svg width="34" height="34" viewBox="0 0 36 36" aria-hidden="true" className="-rotate-90">
                      <circle cx="18" cy="18" r="15" fill="none" stroke="var(--rule-strong)" strokeWidth="4" />
                      <circle cx="18" cy="18" r="15" fill="none" stroke="#ff7a2a" strokeWidth="4" strokeDasharray={`${heat * 94.2} 94.2`} strokeLinecap="round" />
                    </svg>
                    {igniting ? "Heating the coil…" : inBand ? "Fire the igniter" : "Dial in the target first"}
                  </button>
                  {igniting && <button onClick={finishIgnition} className="text-sm link">Skip</button>}
                </div>
              ) : (
                <div className="story-reveal" data-focus>
                  <p className="font-semibold">Lit! You matched the settings of NASA&apos;s test B20.</p>
                  <p className="mt-1 text-sm text-muted">
                    NASA&apos;s note for B20: “{exp("bass2-B20").observations_verbatim}” <Cite sourceId="bass2-summary" page={exp("bass2-B20").provenance.record.pdf_page} where="Table A.1" />
                  </p>
                  <button onClick={fire} className="mt-2 text-sm link">Replay ignition</button>
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
                  const seen = save.observed[pred.id];
                  const cls = chosen === k ? "story-choice-picked" : chosen != null ? "opacity-60" : "";
                  return (
                    <button key={c.label} onClick={() => guess(pred.id, k)} disabled={chosen != null} className={`story-choice ${cls}`}>
                      <span className="story-choice-key">{String.fromCharCode(65 + k)}</span>
                      {c.label}
                      {chosen === k && <span className="ml-auto text-xs">Your guess</span>}
                      {seen && c.correct && <span className="ml-auto text-xs text-flame">NASA record</span>}
                    </button>
                  );
                })}
              </div>

              {save.answers[pred.id] != null && !save.observed[pred.id] && (
                <div className="mt-4 game-gesture" data-focus>
                  {pred.id === "b16" && (
                    <div>
                      <p className="text-sm font-semibold">Now turn the fan down, like the crew did. Press and hold the dial.</p>
                      <div className="mt-2 flex items-center gap-4">
                        <button
                          className="game-dial"
                          onPointerDown={turnDown}
                          onPointerUp={releaseTurn}
                          onPointerLeave={releaseTurn}
                          onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); turnDown(); } }}
                          onKeyUp={releaseTurn}
                          aria-label="Hold to turn the fan down from the starting breeze to the lowest logged setting"
                        >
                          <svg viewBox="0 0 60 60" aria-hidden="true">
                            <circle cx="30" cy="30" r="26" fill="#121b30" stroke="var(--rule-strong)" strokeWidth="3" />
                            <line x1="30" y1="30" x2="30" y2="9" stroke="var(--signal)" strokeWidth="4" strokeLinecap="round" transform={`rotate(${-fanDown * 150} 30 30)`} />
                          </svg>
                        </button>
                        <dl className="text-xs space-y-1.5">
                          <div><dt className="text-faint">Logged start</dt><dd><b className="num">3 cm/s</b> <Cite sourceId="bass2-summary" page={exp("bass2-B16").provenance.record.pdf_page} where="Table A.1, B16" /></dd></div>
                          <div><dt className="text-faint">Logged end</dt><dd><b className="num">fan dial 0.4</b> (a dial setting, not a speed) <Cite sourceId="bass2-summary" page={exp("bass2-B16").provenance.record.pdf_page} where="Table A.1, B16" /></dd></div>
                        </dl>
                      </div>
                      <p className="mt-2 text-[11px] text-faint">The log for B16 reads “{exp("bass2-B16").flow_verbatim}”. Only those settings were written down; the animation just links them.</p>
                      <button onClick={() => { setFanDown(1); observe("b16"); }} className="mt-1 text-sm link">Turn it for me</button>
                    </div>
                  )}
                  {pred.id === "b19" && (
                    <div>
                      <p className="text-sm font-semibold">Move the fan lever to B19&apos;s airflow</p>
                      <div className="mt-2 game-lever" role="radiogroup" aria-label="Fan lever">
                        <button role="radio" aria-checked={lever === 5} onClick={() => setLever(5)}>5 cm/s<small>test B20: burned</small></button>
                        <button role="radio" aria-checked={lever === 10} onClick={() => { setLever(10); observe("b19"); }}>10 cm/s<small>test B19</small></button>
                      </div>
                      <p className="mt-2 text-xs text-muted">
                        5 cm/s: <Cite sourceId="bass2-summary" page={exp("bass2-B20").provenance.record.pdf_page} where="Table A.1, B20" />. 10 cm/s:{" "}
                        <Cite sourceId="bass2-summary" page={exp("bass2-B19").provenance.record.pdf_page} where="Table A.1, B19" />. The lever has only these two logged positions.
                      </p>
                    </div>
                  )}
                  {pred.id === "fabric" && <FabricLineup placed={save.placed} onPlace={place} />}
                </div>
              )}

              {save.observed[pred.id] && (
                <div className="mt-3 story-reveal" role="status" data-focus>
                  <p className="font-semibold">
                    {pred.choices[save.answers[pred.id]].correct ? "You called it! " : "Surprise! "}
                    {pred.reveal}
                  </p>
                  {pred.id === "fabric" && <FabricLineup placed={save.placed} onPlace={place} done />}
                  {pred.testId && (
                    <p className="mt-1 text-sm text-muted">
                      Crew and ground note for {exp(pred.testId).test_id}: “{exp(pred.testId).observations_verbatim}”{" "}
                      <Cite sourceId="bass2-summary" page={exp(pred.testId).provenance.record.pdf_page} where={exp(pred.testId).provenance.record.table} />
                    </p>
                  )}
                  {quote(pred.finding) && (
                    <p className="mt-1 text-sm text-muted">
                      NASA: “{quote(pred.finding)!.quote}” <Cite sourceId={quote(pred.finding)!.source_id} page={quote(pred.finding)!.pdf_page} />
                    </p>
                  )}
                  {pred.id === "b16" && <p className="mt-1 text-xs text-faint">Not every slow-air flame goes out: in chapter 6 you&apos;ll find one that stays dim and blue.</p>}
                  <button
                    onClick={() => {
                      update({ observed: { ...save.observed, [pred.id]: false } });
                      if (pred.id === "b16") setFanDown(0);
                      if (pred.id === "b19") setLever(5);
                      if (pred.id === "fabric") update({ observed: { ...save.observed, fabric: false }, placed: [] });
                    }}
                    className="mt-2 text-sm link"
                  >
                    Watch it again
                  </button>
                </div>
              )}
            </fieldset>
          )}

          {screen.id === "log" && (
            <div className="mt-4">
              <ul className="grid grid-cols-2 gap-2">
                {LOG_CLUES.map((c) => {
                  const e = exp(c.id);
                  const on = save.pinned === c.id;
                  return (
                    <li key={c.id}>
                      <button onClick={() => pin(c.id)} aria-pressed={on} className={`clue ${on ? "clue-on" : ""}`}>
                        <span className="clue-tag num">{e.test_id}</span>
                        <span className="block font-semibold text-[14px] mt-1">{c.headline}</span>
                        <span className="block text-[12px] text-muted mt-1">“{e.observations_verbatim}”</span>
                        <span className="block text-[11px] mt-1.5 text-signal">{on ? "📌 Pinned" : "Pin this clue"}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {save.pinned && (
                <p className="mt-3 text-sm">
                  Pinned {exp(save.pinned).test_id}. <Link href={`/experiments/${save.pinned}`} className="link" target="_blank">Open its full record</Link>{" "}
                  or <Cite sourceId={exp(save.pinned).provenance.record.source_id} page={exp(save.pinned).provenance.record.pdf_page} where={exp(save.pinned).provenance.record.table} />
                </p>
              )}
            </div>
          )}

          {screen.id === "quiet" && (
            <div className="mt-4 space-y-3">
              {!save.quietFound ? (
                <button onClick={() => { update({ quietFound: true }); sound.play("right"); discover("quiet"); }} className="story-action">
                  Turn on the camera&apos;s low-light filter
                </button>
              ) : (
                <>
                  <p className="text-sm font-semibold">Found it: a dim blue flame, still burning in very slow air.</p>
                  <button onClick={() => { sceneRef.current?.gust(); update({ gusted: true }); sound.play("whoosh"); }} className="story-action">
                    Gust the fan (illustration)
                  </button>
                  {save.gusted && <p className="text-sm text-muted">A sudden breeze can make a hidden flame flare up. That&apos;s why NASA studies how small flames behave.</p>}
                </>
              )}
              <p className="text-sm text-muted border-l-2 border-rule-strong pl-3">
                “{quote("tiny-flame-undetected")!.quote}” <Cite sourceId="bass-thickness" />
              </p>
              <p className="text-[11px] text-faint">This is one finding about small flames, not advice to switch air on or off in a real fire.</p>
            </div>
          )}

          {screen.id === "moon" && (
            <div className="mt-4">
              <p className="text-[15px]">
                NASA has studied an exploration atmosphere with <b>{MOON_AIR.o2} % oxygen at {MOON_AIR.kpa} kPa</b> for exploration habitats; it is not a final, universal lunar-habitat atmosphere. <Cite sourceId="exploration-atmosphere" />
              </p>
              <MoonMap marker={save.marker} onTap={tapMap} />
              {hint && !save.marker && <p className="mt-2 text-sm text-flame" role="status">{hint}</p>}
              {!save.marker && (
                <button onClick={() => tapMap(MOON_AIR.kpa, MOON_AIR.o2)} className="mt-2 text-sm link">Place it for me</button>
              )}
              {save.marker && (
                <fieldset className="mt-3" data-focus>
                  <legend className="font-semibold">{MOON.question}</legend>
                  <div className="mt-2 grid gap-2">
                    {MOON.choices.map((c, k) => {
                      const chosen = save.answers.moon;
                      return (
                        <button
                          key={c.label}
                          onClick={() => { if (chosen == null) { update({ answers: { ...save.answers, moon: k } }); sound.play("right"); discover("edge"); } }}
                          disabled={chosen != null}
                          className={`story-choice ${chosen === k ? "story-choice-picked" : chosen != null ? "opacity-60" : ""}`}
                        >
                          <span className="story-choice-key">{String.fromCharCode(65 + k)}</span>
                          {c.label}
                          {chosen != null && c.correct && <span className="ml-auto text-xs text-flame">What the atlas supports</span>}
                        </button>
                      );
                    })}
                  </div>
                  {save.answers.moon != null && (
                    <div className="mt-3 story-reveal" role="status" data-focus>
                      <p className="font-semibold">You found the edge of the evidence! {MOON.reveal}</p>
                      <p className="mt-1 text-sm text-muted">
                        Other research does reach toward partial gravity: “{quote("luci-first-lunar")!.quote}” <Cite sourceId="luci" />
                      </p>
                    </div>
                  )}
                </fieldset>
              )}
            </div>
          )}

          {screen.id === "debrief" && <Debrief save={save} onRecap={() => setRecap(0)} />}

          <div className="mt-5 flex items-center justify-between gap-3">
            <button onClick={() => go(-1)} disabled={save.screen === 0} className="text-sm text-muted hover:text-ink disabled:opacity-30">Back</button>
            {screen.id !== "debrief" && (
              <button onClick={() => go(1)} disabled={!canAdvance} className="story-cta !py-2.5 !px-5 disabled:opacity-40">
                {nextLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- small pieces ---------- */

function Check({ ok, label, action, problem }: { ok: boolean; label: string; action?: { text: string; run: () => void }; problem?: string }) {
  return (
    <li className={`check ${ok ? "check-ok" : "check-bad"}`}>
      <span className="check-dot" aria-hidden="true">{ok ? "✓" : "!"}</span>
      <span className="flex-1">
        <span className="block font-medium">{label}</span>
        {!ok && problem && <span className="block text-xs text-muted">{problem}</span>}
      </span>
      {action && <button onClick={action.run} className="game-btn !border-flame">{action.text}</button>}
      <span className="sr-only">{ok ? "ready" : "needs fixing"}</span>
    </li>
  );
}

/** Fabric chapter: tap each real quench record to place it on an oxygen vs quench-speed chart. */
function FabricLineup({ placed, onPlace, done = false }: { placed: string[]; onPlace: (id: string) => void; done?: boolean }) {
  const W = 300, H = 150, x = (o2: number) => 30 + ((o2 - 16.6) / 2.4) * (W - 46), y = (v: number) => H - 22 - ((v - 1.5) / 4) * (H - 36);
  const on = FABRIC_QUENCH.filter((r) => placed.includes(r.id));
  return (
    <div className={done ? "mt-2" : ""}>
      {!done && <p className="text-sm font-semibold">Now tap each fabric record to put it on the chart</p>}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full mt-2" role="img" aria-label={`Chart: oxygen against the airflow where the fabric flame went out. ${on.length} of ${FABRIC_QUENCH.length} records placed.`}>
        <line x1="30" y1={H - 22} x2={W - 10} y2={H - 22} stroke="var(--rule-strong)" />
        <line x1="30" y1="8" x2="30" y2={H - 22} stroke="var(--rule-strong)" />
        <text x={W - 10} y="12" textAnchor="end" className="fab-ax">oxygen % along the bottom →</text>
        <text x="4" y="12" className="fab-ax">went out at (cm/s)</text>
        {[17, 18, 19].map((v) => <text key={v} x={x(v)} y={H - 10} textAnchor="middle" className="fab-ax">{v}</text>)}
        {[2, 3, 4, 5].map((v) => <text key={v} x="24" y={y(v) + 3} textAnchor="end" className="fab-ax">{v}</text>)}
        {on.map((r) => (
          <g key={r.id} className="fab-dot">
            <circle cx={x(r.o2)} cy={y(r.quench)} r="5" fill="#5b8cff" />
            <text x={x(r.o2)} y={y(r.quench) - 8} textAnchor="middle" className="fab-ax">{r.quench}</text>
          </g>
        ))}
      </svg>
      {!done && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {FABRIC_QUENCH.map((r) => (
            <button key={r.id} disabled={placed.includes(r.id)} onClick={() => onPlace(r.id)} className="game-btn !text-xs disabled:opacity-40">
              {r.test}: {r.o2} % → {r.quench} cm/s
            </button>
          ))}
        </div>
      )}
      <p className="mt-1 text-[11px] text-faint">Six SIBAL fabric tests that quenched (fabric table, NASA/TM-20210011385). Mostly: less oxygen, higher quench speed.</p>
    </div>
  );
}

/** Moon chapter: an oxygen vs pressure map. BASS rows with recorded pressure sit near sea-level pressure; the child marks NASA-studied atmosphere A. */
function MoonMap({ marker, onTap }: { marker: boolean; onTap: (kpa: number, pct: number) => void }) {
  const W = 300, H = 180, kx = (k: number) => 28 + ((k - 40) / 75) * (W - 40), oy = (o: number) => H - 20 - ((o - 14) / 24) * (H - 30);
  const rows = experiments.filter((e) => e.oxygen_vol_pct != null && e.pressure_kpa != null);
  const noP = experiments.length - rows.length;
  return (
    <div className="mt-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full moon-map"
        role="img"
        aria-label={`Map of oxygen against pressure. ${rows.length} atlas tests sit near ${rows[0]?.pressure_kpa} kPa between 14 and 21 % oxygen.${marker ? " Your marker is at 34 %, 56.5 kPa, where there are no atlas tests." : ""}`}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W, py = ((e.clientY - r.top) / r.height) * H;
          onTap(40 + ((px - 28) / (W - 40)) * 75, 14 + ((H - 20 - py) / (H - 30)) * 24);
        }}
      >
        <rect x="28" y="10" width={W - 40} height={H - 30} fill="#0b1222" stroke="var(--rule-strong)" />
        <rect x={kx(97)} y={oy(21.5)} width={kx(105) - kx(97)} height={oy(14) - oy(21.5)} rx="3" className={marker ? "moon-known moon-known-on" : "moon-known"} />
        {rows.map((e) => <circle key={e.id} cx={kx(e.pressure_kpa!)} cy={oy(e.oxygen_vol_pct!)} r="2" fill="#f0a044" opacity=".8" />)}
        {[50, 75, 100].map((k) => <text key={k} x={kx(k)} y={H - 6} textAnchor="middle" className="fab-ax">{k}</text>)}
        {[15, 20, 25, 30, 35].map((o) => <text key={o} x="22" y={oy(o) + 3} textAnchor="end" className="fab-ax">{o}</text>)}
        <text x={W - 14} y="22" textAnchor="end" className="fab-ax">pressure (kPa) along the bottom →</text>
        <text x="30" y="20" className="fab-ax">oxygen %</text>
        {marker && (
          <g className="moon-marker">
            <circle cx={kx(MOON_AIR.kpa)} cy={oy(MOON_AIR.o2)} r="14" fill="rgba(240,160,68,.15)" stroke="#f0a044" strokeDasharray="3 3" />
            <text x={kx(MOON_AIR.kpa)} y={oy(MOON_AIR.o2) + 4} textAnchor="middle" className="moon-q">?</text>
            <text x={kx(MOON_AIR.kpa) + 18} y={oy(MOON_AIR.o2) + 4} className="fab-ax">unknown territory</text>
          </g>
        )}
      </svg>
      <p className="text-[11px] text-faint">
        Tap the map at NASA-studied atmosphere A. Orange dots: BASS tests ({noP} more have no recorded pressure). The box is the area the tests cover.
      </p>
    </div>
  );
}

function Debrief({ save, onRecap }: { save: Save; onRecap: () => void }) {
  const { found } = useExplorer();
  const calls = PREDICTIONS.filter((p) => save.answers[p.id] != null);
  const stamps = [
    { on: save.installed.length === PARTS.length, text: `Built the wind tunnel (${save.installed.length}/${PARTS.length} parts)` },
    { on: save.fixes.sample && save.fixes.fan, text: "Fixed the setup before testing" },
    { on: save.labLit, text: "Lit a sample at B20's settings" },
    { on: !!save.pinned, text: save.pinned ? `Pinned clue ${exp(save.pinned).test_id}` : "Pin a crew clue" },
    { on: save.quietFound, text: save.gusted ? "Found the hidden flame and gusted it" : "Found the hidden dim flame" },
    { on: save.answers.moon != null, text: "Found the edge of the evidence" },
    { on: found.includes("source"), text: "Opened a real NASA report" },
  ];
  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap gap-2">
        <button onClick={onRecap} className="game-btn">▶ Play my recap</button>
        <Link href="/atlas" className="game-btn">Explore all {experiments.length} tests</Link>
        <Link href="/gaps" className="game-btn">See the evidence gaps</Link>
      </div>
      <figure className="m-0">
        <Apparatus2D s={{ view: "duct", gravity: "orbit", o2: 16.5, flow: save.labLit ? 5 : 0, outcome: save.labLit ? "burning" : "none", parts: save.installed, labels: false }} className="app2d-mini" />
        <figcaption className="text-xs text-muted mt-1">
          Your wind tunnel: {save.installed.length} of {PARTS.length} parts{save.labLit ? ", lit at test B20's settings" : ""}. (Drawing)
        </figcaption>
      </figure>
      <ul className="grid grid-cols-2 gap-2">
        {stamps.map((s) => (
          <li key={s.text} className={`game-badge ${s.on ? "game-badge-on" : ""}`}>
            <span className="game-badge-icon" aria-hidden="true">{s.on ? "★" : "☆"}</span>
            <span className="text-[13px]">{s.text}</span>
            {!s.on && <span className="block text-[11px] text-muted">Still to explore: go back any time</span>}
          </li>
        ))}
      </ul>
      {calls.length > 0 && (
        <div>
          <h3 className="font-semibold text-sm">Your guesses and NASA&apos;s records</h3>
          <ul className="mt-1 space-y-1 text-[13px]">
            {calls.map((p) => (
              <li key={p.id}>
                <b>{p.title}:</b> you guessed “{p.choices[save.answers[p.id]].label}”. NASA recorded “{p.choices.find((c) => c.correct)!.label}”.
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-faint">Guessing first, then checking the record, is exactly what scientists do.</p>
        </div>
      )}
      <div>
        <h3 className="font-semibold text-sm">Your evidence map</h3>
        <EvidenceConstellation compact />
      </div>
    </div>
  );
}

/* ---------- Ember's lines ---------- */
function Line({ id, gravityOn, labLit, built, fixed, found, observed }: { id: ScreenId; gravityOn: boolean; labLit: boolean; built: number; fixed: boolean; found: boolean; observed: boolean }) {
  switch (id) {
    case "hello":
      return <>On Earth, hot gas rises and pulls fresh air in from below. That&apos;s why I stand tall and flicker.</>;
    case "gravity":
      return gravityOn ? <>Flip the switch and take gravity away. Watch what happens to me.</> : <>See? Nothing rises in orbit. I go small, round and blue, and only get the oxygen that drifts in.</>;
    case "build":
      return built === 0 ? <>Let&apos;s build NASA&apos;s real BASS-II wind tunnel. Tap a part to see where it goes, tap again to install it.</> : <>Nice! Each part shows NASA&apos;s own description. Some parts need others first, just like on the station.</>;
    case "check":
      return fixed ? <>Everything&apos;s ready. Good scientists always check before they test!</> : <>Wait! Two things look wrong. Can you spot them in the tunnel and fix them?</>;
    case "lab":
      return labLit ? <>Lit! Same oxygen and airflow as NASA&apos;s test B20.</> : <>Your turn to run a test. Match NASA&apos;s settings, then fire the igniter coil.</>;
    case "b16":
    case "b19":
    case "fabric":
      return observed ? <>That&apos;s what really happened on the space station.</> : <>Here&apos;s a real test. Make your guess, then do what the crew did to find out.</>;
    case "log":
      return <>These are real lines from the crew logbook, word for word. Pin the clue you find most interesting.</>;
    case "quiet":
      return found ? <>There I am! At the slowest flows I get dim, blue and very steady.</> : <>I&apos;m in here somewhere, but I&apos;m very faint. Can you find me?</>;
    case "moon":
      return <>Future crews may breathe richer air at lower pressure. Let&apos;s see if our tests cover it.</>;
    default:
      return <>Mission complete! Here&apos;s everything you discovered.</>;
  }
}

/* ---------- notebook ---------- */
function FieldNotes({ screen, installed, pinned }: { screen: ScreenId; installed: Set<string>; pinned: string | null }) {
  const notes: string[] =
    screen === "build" || screen === "check"
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
      {pinned && (
        <div className="clue clue-on">
          <span className="clue-tag num">📌 {exp(pinned).test_id}</span>
          <span className="block mt-1">“{exp(pinned).observations_verbatim}”</span>
          <Link href={`/experiments/${pinned}`} className="link text-xs">Open the full record</Link>
        </div>
      )}
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
        <h3 className="font-semibold">Words to know</h3>
        <dl className="mt-2 space-y-2 text-muted">
          <div><dt className="text-ink inline">Recorded: </dt><dd className="inline">written down by NASA during the test.</dd></div>
          <div><dt className="text-ink inline">Opposed flow: </dt><dd className="inline">air moves against the direction the flame spreads.</dd></div>
          <div><dt className="text-ink inline">Quench: </dt><dd className="inline">the flame goes out because too little air reaches it.</dd></div>
          <div><dt className="text-ink inline">Blowoff: </dt><dd className="inline">the flame goes out because the air rushes past too fast.</dd></div>
          <div><dt className="text-ink inline">Not tested: </dt><dd className="inline">no test in this atlas checked it, so we can&apos;t say.</dd></div>
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
        <input type="range" min={props.min} max={props.max} step={props.step} value={props.value} disabled={props.disabled} onChange={(e) => props.onChange(Number(e.target.value))} className="relative w-full accent-[var(--signal)]" />
      </span>
    </label>
  );
}
