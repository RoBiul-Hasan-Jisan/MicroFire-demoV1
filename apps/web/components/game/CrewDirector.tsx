"use client";

import { CREW, type CrewId } from "@/lib/guide";
import styles from "./CrewDirector.module.css";

export type CrewCue = {
  crew: CrewId;
  phase: string;
  pose: "welcome" | "point" | "focus" | "cheer" | "wonder";
  line: string;
  aim: string;
};

/** A scene actor: direction changes when the child's task state changes, not on a timer. */
export function CrewDirector({ cue }: { cue: CrewCue }) {
  const crew = CREW[cue.crew];
  return (
    <aside className={styles.stage} aria-label={`${crew.name}, your ${crew.job.split(":")[0].toLowerCase()}`}>
      <div key={`${cue.crew}:${cue.phase}`} className={`${styles.actor} ${styles[cue.pose]}`}>
        <div className={styles.halo} aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element -- original illustrated cutout, sized by the scene */}
        <img src={crew.img} alt="" className={styles.crew} decoding="async" />
        <span className={styles.spark} aria-hidden="true">✦</span>
      </div>
      <div className={styles.message} aria-live="polite" aria-atomic="true">
        <p className={styles.name}>{crew.name} <span>· {crew.job.split(":")[0]}</span></p>
        <p className={styles.line}>{cue.line}</p>
        <p className={styles.aim}><span aria-hidden="true">↗</span> {cue.aim}</p>
      </div>
    </aside>
  );
}
