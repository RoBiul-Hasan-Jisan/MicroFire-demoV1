"use client";
/* eslint-disable @next/next/no-img-element -- next/image writes inline style attributes, which the strict CSP blocks */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useExplorer } from "@/components/guide/EmberGuide";
import styles from "./CinematicWorld.module.css";

export type World = "portal" | "lab" | "moon" | "constellation" | "bay" | "moonlab" | "starfield";

/** Original artwork is scenery. No generated flame is presented as experimental evidence. */
export function CinematicWorld({ world, priority = false }: { world: World; priority?: boolean }) {
  return <div className={styles.world} aria-hidden="true" data-world={world}>
    <img key={world} src={`/art/worlds/${world}.webp`} alt="" decoding="async" fetchPriority={priority ? "high" : "auto"} className={styles.plate} />
    <div className={styles.shade} />
    <div className={styles.dust}><i /><i /><i /><i /><i /><i /><i /><i /></div>
    <div className={styles.orbit} /><div className={styles.orbitTwo} />
  </div>;
}

const STOPS = [
  { world: "portal", label: "Follow the spark", title: "Fire behaves differently\nwhen nothing rises.", line: "Come aboard with Tala and PIX. Watch real NASA flames, uncover clues, and find out what we still don't know.", call: "Follow the Spark", crew: "I'm Tala. Ready to become a flame detective?" },
  { world: "lab", label: "Enter the laboratory", title: "Your eyes.\nA computer's outline.", line: "Look closely at NASA footage. Trace the flame, inspect a measurement, and check the source behind it.", call: "Head for the Moon", crew: "Let's turn a beautiful mystery into something we can measure." },
  { world: "moon", label: "Follow the evidence", title: "The next question\nis yours to find.", line: "Which experiments give a Moon habitat useful clues? Discover why a close match is never a promise of safety.", call: "Begin the adventure", crew: "Finding what we don't know is a discovery, too." },
] as const;

export function SparkJourney() {
  const router = useRouter();
  const root = useRef<HTMLElement>(null);
  const [stop, setStop] = useState(0);
  const { gentle, setGentle } = useExplorer();
  const [still, setStill] = useState(false);

  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setStill(media.matches);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (gentle || still) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      const el = root.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, -r.top / Math.max(1, r.height - innerHeight + 56)));
      setStop(Math.min(2, Math.floor(progress * 3)));
      el.style.setProperty("--journey-progress", String(progress));
    };
    const scroll = () => { if (!frame) frame = requestAnimationFrame(read); };
    addEventListener("scroll", scroll, { passive: true });
    addEventListener("resize", scroll); read();
    return () => { cancelAnimationFrame(frame); removeEventListener("scroll", scroll); removeEventListener("resize", scroll); };
  }, [gentle, still]);

  function choose(n: number) {
    if (gentle || still) { setStop(n); return; }
    const el = root.current;
    if (!el) return;
    const distance = el.offsetHeight - innerHeight + 56;
    window.scrollTo({ top: el.getBoundingClientRect().top + scrollY + distance * (n / 3 + .04), behavior: "smooth" });
  }
  const scene = STOPS[stop];
  return <section ref={root} className={`${styles.journey} ${gentle || still ? styles.still : ""}`} aria-label="Follow the spark" data-guide="hero">
    <div className={styles.sticky}>
      <CinematicWorld world={scene.world} priority />
      <div className={styles.content}>
        <p className={styles.eyebrow}>MicroFire Atlas · NASA fire-safety evidence for Moon and Mars missions</p>
        <div key={stop} className={styles.copy}>
          <h1 className="display">{scene.title}</h1>
          <p>{scene.line}</p>
          <div className={styles.actions}>
            {stop < 2 ? <button className="story-cta" onClick={() => choose(stop + 1)}>{scene.call} <span aria-hidden="true">✦</span></button> : <Link href="/expedition" className="story-cta">{scene.call} <span aria-hidden="true">↗</span></Link>}
            <Link href={stop === 0 ? "/atlas" : "/expedition"} className={styles.direct}>{stop === 0 ? "Explore NASA evidence" : "Jump into the adventure"}</Link>
            <Link href="/mission?context=moon-base" className={styles.direct}>Open the Mission Analyst</Link>
          </div>
        </div>
        <div className={styles.guide}>
          <img src="/art/tala.webp" alt="Tala, your junior explorer guide" />
          <p key={stop}><strong>Tala</strong>{scene.crew}</p>
        </div>
      </div>
      <button className={styles.spark} onClick={() => stop < 2 ? choose(stop + 1) : router.push('/expedition')} aria-label={stop < 2 ? scene.call : "Begin the adventure"}><span /><b>Follow me</b></button>
      <div className={styles.bottom}>
        <nav aria-label="Scenery chapters">{STOPS.map((s, i) => <button key={s.world} aria-current={stop === i ? "step" : undefined} onClick={() => choose(i)}><span>{i + 1}</span>{s.label}</button>)}</nav>
        <button className={styles.motion} onClick={() => setGentle(!gentle)} aria-pressed={gentle}>{gentle ? "Resume motion" : "Pause motion"}</button>
        <small>Fantasy illustration · real evidence inside</small>
      </div>
    </div>
  </section>;
}
