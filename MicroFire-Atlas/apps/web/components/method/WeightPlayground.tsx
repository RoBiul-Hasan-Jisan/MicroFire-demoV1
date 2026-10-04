"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useExplorer } from "@/components/guide/EmberGuide";
import { experiments } from "@/lib/data";
import { rank, RANK_DEFAULTS, WEIGHTS, type Scenario } from "@/lib/relevance";
import styles from "./Method.module.css";

const DEMO: Scenario = { material: "PMMA", oxygen: 16.5, flow: 5, gravity: "microgravity", flowDirection: "opposed" };
const KNOBS = [["oxygen", "Oxygen"], ["flow", "Airflow"], ["material", "Material"]] as const;

/** Change MicroFire's own weights and watch the ranking move: the robustness idea, by hand. */
export function WeightPlayground() {
  const { discover } = useExplorer();
  const [mult, setMult] = useState<Record<string, number>>({ oxygen: 1, flow: 1, material: 1 });
  const base = useMemo(() => rank(experiments, DEMO).slice(0, 5).map((r) => r.experiment.id), []);
  const now = useMemo(() => {
    const weights = { ...RANK_DEFAULTS.weights, ...Object.fromEntries(KNOBS.map(([k]) => [k, WEIGHTS[k] * mult[k]])) } as typeof RANK_DEFAULTS.weights;
    return rank(experiments, DEMO, { ...RANK_DEFAULTS, weights }).slice(0, 5);
  }, [mult]);
  const moved = now.some((r, i) => r.experiment.id !== base[i]);
  return (
    <div className={styles.play}>
      <p className={styles.playQ}>Question: <strong>PMMA at 16.5 % oxygen, 5 cm/s opposed airflow, in orbit.</strong> Drag a weight and watch the five closest tests.</p>
      <div className={styles.knobs}>
        {KNOBS.map(([k, label]) => (
          <label key={k} className={styles.knob}>
            <span>{label} weight <b>×{mult[k].toFixed(2)}</b></span>
            <input type="range" min={0.25} max={2} step={0.25} value={mult[k]} onChange={(e) => { setMult((m) => ({ ...m, [k]: Number(e.target.value) })); discover("weights"); }} />
          </label>
        ))}
        <button className={styles.resetBtn} onClick={() => setMult({ oxygen: 1, flow: 1, material: 1 })}>Back to MicroFire&apos;s weights</button>
      </div>
      <ol className={styles.rankList}>
        {now.map((r, i) => {
          const was = base.indexOf(r.experiment.id);
          const d = was === -1 ? "new" : was - i;
          return (
            <li key={r.experiment.id}>
              <span className={styles.rankNo}>{i + 1}</span>
              <Link href={`/experiments/${r.experiment.id}`} className="link font-semibold">{r.experiment.test_id}</Link>
              <span className={styles.rankMeta}>{r.experiment.material}, {r.experiment.oxygen_vol_pct} % O₂, {r.experiment.flow_verbatim} cm/s</span>
              <span className={styles.rankScore}>{Math.round(r.score * 100)}</span>
              <span className={styles.move} data-dir={d === "new" ? "new" : d > 0 ? "up" : d < 0 ? "down" : "same"}>{d === "new" ? "new" : d > 0 ? `↑${d}` : d < 0 ? `↓${-d}` : "="}</span>
            </li>
          );
        })}
      </ol>
      <p className={styles.playNote}>
        {moved
          ? "The order changed. That is why MicroFire reports ranking robustness: a test that stays near the top under many weights is a sturdier answer."
          : "The top five held. Push a weight further: some places hold firm, others do not."}
      </p>
    </div>
  );
}
