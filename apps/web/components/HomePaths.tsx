import Link from "next/link";
import { evidenceRecords } from "@/lib/data";
import modelJson from "@/data/model.json";
import styles from "./HomePaths.module.css";

/** Two ways in: the mission-evidence desk, or the trained outcome model. The story pages live under Extras in the nav. */
export function HomePaths() {
  const report = (modelJson as unknown as { report: { n_rows: number; models: Record<string, { balanced_accuracy: number }> } }).report;
  const x = (o2: number) => ((o2 - 14) / (36 - 14)) * 1000;
  return (
    <section aria-labelledby="paths" className={styles.paths} data-guide="paths">
      <h2 id="paths" className={styles.title}>Two ways into the NASA evidence</h2>
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
        <Link href="/predict" className={styles.card} data-path="model">
          <span className={styles.kicker}>Outcome Model</span>
          <strong>Will the flame keep burning? A model trained on {report.n_rows} NASA microgravity tests</strong>
          <span className={styles.body}>
            Set oxygen, airflow and direction to get an estimate with an interval and the closest real tests. Scored on flights it never saw:
            balanced accuracy {report.models.logistic_oxygen_flow_direction_SHIPPED.balanced_accuracy} against 0.5 for a no-skill baseline.
          </span>
          <span className={styles.cta}>Open the model</span>
        </Link>
      </div>
    </section>
  );
}
