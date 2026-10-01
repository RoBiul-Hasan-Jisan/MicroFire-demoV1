"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CloudPoint, FlameScene, SceneState } from "@/components/three/FlameScene";
import { Cite } from "@/components/Cite";
import { Ember } from "@/components/game/Ember";
import { experiments, getExperiment } from "@/lib/data";

const HEX: Record<string, string> = {
  sustained_no_blowoff: "#f0a044", burned_entire_sample: "#f0a044", burned_outcome_not_stated: "#f0a044",
  quenched_low_flow: "#5b8cff", extinguished_flow_off: "#5b8cff", no_sustained_flame: "#5b8cff",
  blowoff: "#d6e4ff", not_ignited: "#4a5570",
};
const LANE: Record<string, number> = { PMMA: -1.3, "SIBAL fabric": 0, Nomex: 1.3 };

type Beat = {
  id: string;
  kicker: string;
  title: string;
  body: React.ReactNode;
  scene: Omit<SceneState, "cloud">;
};

/**
 * Scroll-driven story for the home page: a pinned 3D scene changes as each text beat
 * scrolls into the middle of the screen. Every outcome shown is NASA's recorded one.
 */
export function ScrollStory() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<FlameScene | null>(null);
  const [active, setActive] = useState(0);
  const cloud = useMemo<CloudPoint[]>(
    () =>
      experiments
        .filter((e) => e.flow_initial_cm_s != null && e.oxygen_vol_pct != null)
        .map((e, i) => ({
          id: e.id,
          label: e.test_id,
          x: -4 + (Math.log(e.flow_final_cm_s ?? e.flow_initial_cm_s!) / Math.log(60)) * 8,
          y: -2 + ((e.oxygen_vol_pct! - 13.5) / 8) * 4,
          z: (LANE[e.material] ?? 0) + (((i * 37) % 7) - 3) * 0.09,
          color: HEX[e.outcome] ?? "#8f9ab1",
          hollow: e.outcome === "burned_outcome_not_stated" || e.outcome === "no_sustained_flame",
        })),
    [],
  );
  const b16 = getExperiment("bass2-B16")!, b19 = getExperiment("bass2-B19")!, b20 = getExperiment("bass2-B20")!;

  const beats: Beat[] = [
    {
      id: "earth",
      kicker: "On Earth",
      title: "A flame stands up because hot gas rises",
      body: <>Buoyancy pulls fresh air in from below and drags the flame upward into the familiar flickering teardrop.</>,
      scene: { view: "bench", gravity: "earth", o2: 21, flow: 0, outcome: "burning" },
    },
    {
      id: "orbit",
      kicker: "In orbit",
      title: "Take gravity away and nothing rises",
      body: <>Without buoyancy, the flame only gets the oxygen that drifts or is blown in. It turns small, round and blue. The ventilation fan now decides its fate.</>,
      scene: { view: "bench", gravity: "orbit", o2: 21, flow: 0, outcome: "dim" },
    },
    {
      id: "duct",
      kicker: "The experiment",
      title: "So NASA built a wind tunnel in space",
      body: (
        <>
          In 2014, astronauts burned samples in a duct just 7.6 by 7.6 by 17 cm inside the station&apos;s glovebox, setting
          oxygen and airflow for every test. <Cite sourceId="bass2-summary" page={74} />
        </>
      ),
      scene: { view: "duct", gravity: "orbit", o2: 20.6, flow: 5, outcome: "burning" },
    },
    {
      id: "b16",
      kicker: "Test B16",
      title: "Too little air: the flame quenched",
      body: (
        <>
          Thin acrylic at {b16.oxygen_vol_pct} % oxygen. As the crew turned the fan down, NASA noted: “{b16.observations_verbatim}”{" "}
          <Cite sourceId="bass2-summary" page={b16.provenance.record.pdf_page} where="Table A.1" />
        </>
      ),
      scene: { view: "duct", gravity: "orbit", o2: 16.5, flow: 0.6, outcome: "quench" },
    },
    {
      id: "b20",
      kicker: "Test B20",
      title: "In between: it burned the whole sample",
      body: (
        <>
          Same film, {b20.oxygen_vol_pct} % oxygen, moderate flow: “{b20.observations_verbatim}”{" "}
          <Cite sourceId="bass2-summary" page={b20.provenance.record.pdf_page} where="Table A.1" />
        </>
      ),
      scene: { view: "duct", gravity: "orbit", o2: 16.5, flow: 4, outcome: "burning" },
    },
    {
      id: "b19",
      kicker: "Test B19",
      title: "Too much air: it blew off",
      body: (
        <>
          Same film, {b19.oxygen_vol_pct} % oxygen, 10 cm/s: “{b19.observations_verbatim}”{" "}
          <Cite sourceId="bass2-summary" page={b19.provenance.record.pdf_page} where="Table A.1" />
        </>
      ),
      scene: { view: "duct", gravity: "orbit", o2: 16.4, flow: 14, outcome: "blowoff" },
    },
    {
      id: "cloud",
      kicker: "All the evidence",
      title: `${experiments.length} real tests, one map`,
      body: <>Every burn in the atlas, placed by airflow, oxygen and material, and coloured by what NASA recorded. Amber kept burning, blue went out, pale blew off.</>,
      scene: { view: "cloud", gravity: "orbit", o2: 18, flow: 5, outcome: "none", highlight: ["bass2-B16", "bass2-B20", "bass2-B19"] },
    },
    {
      id: "moon",
      kicker: "Moon and Mars",
      title: "And here the evidence stops",
      body: (
        <>
          NASA recommends 34 % oxygen at 56.5 kPa for future Moon and Mars cabins. No test in this atlas went there. That gap is
          where new experiments matter. <Cite sourceId="exploration-atmosphere" />
        </>
      ),
      scene: { view: "cloud", gravity: "orbit", o2: 34, flow: 5, outcome: "none", voidRegion: { y: 2.9, label: "34 % O₂, 56.5 kPa: no tests here" } },
    },
  ];

  useEffect(() => {
    if (!canvas.current || !document.createElement("canvas").getContext("webgl2")) return;
    let alive = true;
    import("@/components/three/FlameScene").then(({ FlameScene }) => {
      if (!alive || !canvas.current) return;
      scene.current = new FlameScene(canvas.current, { ...beats[0].scene, cloud });
    });
    return () => {
      alive = false;
      scene.current?.dispose();
      scene.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- boot once

  useEffect(() => {
    scene.current?.setState({ ...beats[active].scene, cloud });
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps -- beats are static

  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>("[data-beat]");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.beat));
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <section className="relative border-y border-rule" aria-label="Scroll story">
      <div className="lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="sticky top-14 z-0 h-[42vh] lg:h-[calc(100vh-3.5rem)] lg:order-2 lg:self-start" aria-hidden="true">
          <canvas ref={canvas} className="w-full h-full" />
          <div className="absolute right-6 bottom-6 hidden lg:flex items-center gap-3">
            <Ember form={active === 0 ? "earth" : "orbit"} mood={active === 3 || active === 5 ? "surprised" : active === 7 ? "curious" : "happy"} size={64} label={false} />
            <span className="text-xs text-faint max-w-[16ch]">Illustration driven by NASA&apos;s recorded outcomes</span>
          </div>
        </div>
        <div className="relative z-10 lg:order-1 px-4 sm:px-6 lg:pl-[max(1.5rem,calc((100vw-80rem)/2+1.5rem))]">
          {beats.map((b, i) => (
            <article key={b.id} data-beat={i} className={`scroll-beat ${active === i ? "scroll-beat-on" : ""}`}>
              <div className="scroll-beat-card">
                <p className="text-signal text-sm font-semibold num">
                  {String(i + 1).padStart(2, "0")} &nbsp;{b.kicker}
                </p>
                <h2 className="display text-3xl sm:text-4xl mt-3 max-w-[16ch]">{b.title}</h2>
                <p className="mt-4 text-[17px] text-[#c9d1e3] max-w-[46ch]">{b.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
