/* eslint-disable @next/next/no-img-element -- next/image writes inline style attributes, which the strict CSP blocks */

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
