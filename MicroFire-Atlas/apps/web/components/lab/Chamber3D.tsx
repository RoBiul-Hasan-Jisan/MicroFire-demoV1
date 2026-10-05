"use client";

import { useEffect, useRef, useState } from "react";
import type { FlameScene, SceneState } from "@/components/three/FlameScene";
import { useExplorer } from "@/components/guide/EmberGuide";
import type { LabConfig } from "@/lib/flame-lab";
import { Chamber, type Phase, type Shown } from "./Chamber";
import styles from "./FlameLab.module.css";

const MAT: Record<string, SceneState["material"]> = { PMMA: "PMMA", "SIBAL fabric": "fabric", Nomex: "nomex", Silicone: "silicone", "Cotton jersey": "jersey" };

/** What the 3D flame should do. Quench and blow-off are told in order: it burns first, then goes out as NASA recorded. */
function outcomeFor(cfg: LabConfig, phase: Phase, shown: Shown, late: boolean): SceneState["outcome"] {
  if (phase !== "result" || !shown || shown.visual === "unknown" || shown.group === "not_ignited") return "none";
  if (shown.visual === "nasa" && shown.group === "extinguished") return late ? (shown.blowoff ? "blowoff" : "quench") : "burning";
  const dim = cfg.gravity === "orbit" && (cfg.flow < 1 || cfg.o2 < 17);
  return dim ? "dim" : "burning";
}

/** The Flame Lab's chamber in 3D (lazy three.js), with the SVG chamber as the no-WebGL fallback. */
export function Chamber3D({ cfg, phase, shown }: { cfg: LabConfig; phase: Phase; shown: Shown }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<FlameScene | null>(null);
  const [gl, setGl] = useState<boolean | null>(null);
  const [focus, setFocus] = useState(true);
  const [late, setLate] = useState(false);
  const { gentle } = useExplorer();

  const state: SceneState = {
    view: "duct", gravity: cfg.gravity, o2: cfg.o2, flow: cfg.flow, material: MAT[cfg.material] ?? "PMMA",
    outcome: outcomeFor(cfg, phase, shown, late), unknown: phase === "result" && shown?.visual === "unknown",
    igniter: phase === "ignition" || phase === "analyzing" || (phase === "result" && shown?.group === "not_ignited" && !late) ? 1 : 0,
    focus: true,
    zoom: focus ? "flame" : undefined,
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect -- WebGL support is only knowable in the browser
  useEffect(() => setGl(!!document.createElement("canvas").getContext("webgl2")), []);
  useEffect(() => {
    if (!gl || !canvas.current) return;
    let live = true;
    import("@/components/three/FlameScene").then(({ FlameScene }) => {
      if (!live || !canvas.current) return;
      scene.current = new FlameScene(canvas.current, state, { fit: true });
    });
    const io = new IntersectionObserver(([e]) => scene.current?.setRunning(e.isIntersecting && !document.hidden));
    io.observe(canvas.current);
    const vis = () => scene.current?.setRunning(!document.hidden);
    document.addEventListener("visibilitychange", vis);
    return () => { live = false; io.disconnect(); document.removeEventListener("visibilitychange", vis); scene.current?.dispose(); scene.current = null; };
  }, [gl]); // eslint-disable-line react-hooks/exhaustive-deps -- the scene is created once; state flows in below

  // a new result: burn, then (for NASA quench or blow-off) go out after a beat
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restart the burn-then-out sequence for each result
    setLate(false);
    if (phase !== "result") return;
    if (shown && shown.visual !== "unknown" && shown.group !== "not_ignited") scene.current?.ignite();
    const t = window.setTimeout(() => setLate(true), 2600);
    return () => clearTimeout(t);
  }, [phase, shown]);

  useEffect(() => { scene.current?.setState(state); });
  useEffect(() => { scene.current?.setGentle(gentle); }, [gentle]);

  if (gl === false) return <Chamber cfg={cfg} phase={phase} shown={shown} />;
  return (
    <div className={styles.three} data-env={cfg.gravity}>
      <canvas ref={canvas} className={styles.canvas} role="img" aria-label={`3D illustration of a BASS-style flow duct in a glovebox: ${cfg.material} sample, ${cfg.o2} % oxygen, ${cfg.flow} cm/s airflow, ${cfg.gravity}. ${state.unknown ? "No flame drawn: insufficient experimental evidence." : state.outcome === "none" ? "Sample not lit." : "Flame shown."}`} />
      <div className={styles.view} role="group" aria-label="Camera">
        <button type="button" aria-pressed={focus} onClick={() => setFocus(true)}>Close-up</button>
        <button type="button" aria-pressed={!focus} onClick={() => setFocus(false)}>Full rig</button>
        <span>Drag to orbit</span>
      </div>
    </div>
  );
}
