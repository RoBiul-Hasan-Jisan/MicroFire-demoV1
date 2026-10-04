import Link from "next/link";
import { evidenceRecords } from "@/lib/data";
import styles from "./HomePaths.module.css";

/** Two ways in: the same evidence, told for young explorers or examined by mission analysts. */
export function HomePaths() {
  const x = (o2: number) => ((o2 - 14) / (36 - 14)) * 1000;
  return (
    <section aria-labelledby="paths" className={styles.paths} data-guide="paths">
      <h2 id="paths" className={styles.title}>Two ways into the same NASA evidence</h2>
      <div className={styles.grid}>
        <Link href="/mission?context=moon-base" className={styles.card} data-path="analyst">
          <span className={styles.kicker}>Mission Analyst</span>
          <strong>What does NASA actually know about fire under your mission conditions?</strong>
          <span className={styles.flow} aria-label="Atmosphere, gravity, material, ventilation, then direct, analogous, mechanistic and missing evidence">
            <i>Atmosphere</i><i>Gravity</i><i>Material</i><i>Ventilation</i><b>→</b><i data-r="d">Direct</i><i data-r="a">Analogous</i><i data-r="m">Mechanistic</i><i data-r="g">Missing</i>
          </span>
          <svg viewBox="0 0 1000 70" className={styles.strip} aria-hidden="true" preserveAspectRatio="none">
            <rect x="0" y="28" width="1000" height="10" rx="5" className={styles.rail} />
            {evidenceRecords.flatMap((r) => (r.oxygen == null ? [] : [<rect key={r.id} x={x(r.oxygen) - 1.5} y="20" width="3" height="26" rx="1.5" data-family={r.family} className={styles.tick} />]))}
            <rect x={x(32.5)} y="10" width={x(35.5) - x(32.5)} height="46" rx="4" className={styles.window} />
            <line x1={x(34)} x2={x(34)} y1="6" y2="60" className={styles.marker} />
          </svg>
          <span className={styles.stripNote}>Oxygen in every NASA record in this atlas. The marker is exploration atmosphere A, 34 %: no record sits there.</span>
          <span className={styles.cta}>Investigate a future lunar habitat</span>
        </Link>
        <Link href="/expedition" className={styles.card} data-path="explorer">
          {/* eslint-disable-next-line @next/next/no-img-element -- static art; next/image would add inline styles the CSP blocks */}
          <img src="/art/crew/tala-pointing.webp" alt="" className={styles.art} />
          <span className={styles.kicker}>Explorer</span>
          <strong>Learn why fire behaves differently in space</strong>
          <span className={styles.body}>A guided adventure with a crew, real NASA footage, predictions and discoveries. For students and curious people.</span>
          <span className={styles.cta}>Follow the Spark</span>
        </Link>
      </div>
    </section>
  );
}
