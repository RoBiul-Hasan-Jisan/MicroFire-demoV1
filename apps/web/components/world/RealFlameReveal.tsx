"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useExplorer } from "@/components/guide/EmberGuide";
import styles from "./RealFlameReveal.module.css";

const SLUG = "saffire-vi-pmma";
const PAGE = "https://images.nasa.gov/details/Saf-VI%20S8C3%2BC4%201-sided%20PMMA_unmapped_jpeg-20x%20no%20text";

/**
 * The trust moment: right after the illustrated world, a real NASA flame. Plays silently only when it is on
 * screen, never under reduced motion or Pause motion, and always has a pause control.
 */
export function RealFlameReveal() {
  const video = useRef<HTMLVideoElement>(null);
  const { gentle } = useExplorer();
  const [playing, setPlaying] = useState(false);
  const [user, setUser] = useState<boolean | null>(null); // the viewer's own choice wins

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const still = gentle || matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver(([e]) => {
      const want = user ?? !still;
      if (e.isIntersecting && want) v.play().catch(() => {});
      else v.pause();
    }, { threshold: 0.35 });
    io.observe(v);
    return () => io.disconnect();
  }, [gentle, user]);

  const toggle = () => {
    const v = video.current!;
    if (v.paused) { setUser(true); v.play().catch(() => {}); } else { setUser(false); v.pause(); }
  };

  return (
    <section className={styles.reveal} aria-labelledby="real-flame">
      <div className={styles.copy}>
        <p className={styles.kicker}>Real NASA footage · not animation</p>
        <h2 id="real-flame" className="display">This isn&apos;t animation. NASA burned this material in space.</h2>
        <p className={styles.body}>
          Saffire VI, inside an uncrewed Cygnus cargo ship at the end of the NG-19 mission: a one-sided PMMA sample, filmed by NASA.
          Shown at the speed NASA released it.
        </p>
        <a href={PAGE} target="_blank" rel="noreferrer" className={styles.source}>NASA Image and Video Library ↗</a>
        <ol className={styles.steps}>
          <li><Link href={`/analyze/${SLUG}`}><span>1</span><strong>Watch</strong><small>Real footage, frame by frame</small></Link></li>
          <li><Link href={`/analyze/${SLUG}`}><span>2</span><strong>Measure</strong><small>Computer vision, in pixels</small></Link></li>
          <li><Link href="/compare?preset=pmma-flow-window"><span>3</span><strong>Compare</strong><small>One change, three outcomes</small></Link></li>
        </ol>
      </div>
      <figure className={styles.frame}>
        <video ref={video} src={`/media/${SLUG}/video.mp4`} poster={`/media/${SLUG}/poster.jpg`} muted loop playsInline preload="metadata"
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} aria-label="NASA video: a PMMA sample burning during Saffire VI" />
        <span className={styles.badge}>Real NASA video</span>
        <button className={styles.toggle} onClick={toggle} aria-label={playing ? "Pause the NASA video" : "Play the NASA video"}>
          {playing ? (
            <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16"><rect x="3.5" y="3" width="3" height="10" rx="1" fill="currentColor" /><rect x="9.5" y="3" width="3" height="10" rx="1" fill="currentColor" /></svg>
          ) : (
            <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" className={styles.play}><path d="M5 3.2v9.6L12.6 8z" fill="currentColor" /></svg>
          )}
        </button>
      </figure>
    </section>
  );
}
