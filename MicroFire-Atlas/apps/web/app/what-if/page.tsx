import type { Metadata } from "next";
import Link from "next/link";
import { WhatIfLab } from "@/components/whatif/WhatIfLab";
import { experiments } from "@/lib/data";
import { deployedSnapshot } from "@/lib/model-lab";
import pressureJson from "@/data/pressure_report.json";
import styles from "@/components/modellab/ModelLab.module.css";

export const metadata: Metadata = {
  title: "What-if Lab",
  description: "Change one condition of a NASA-tested scenario and see how the evidence, the estimate and its uncertainty respond, or where they stop.",
};

export default function WhatIfPage() {
  const snap = deployedSnapshot(experiments);
  const pressure = { n: pressureJson.n_with_pressure, of: pressureJson.n_usable_total };
  return (
    <div className={`explorer-page ${styles.page}`}>
      <header className={styles.hero}>
        <p className={styles.kicker}>What-if Lab · counterfactual evidence explorer</p>
        <h1 className={styles.title}>Change one thing. See what NASA&apos;s tests can still say.</h1>
        <p className={styles.lede}>
          Set a starting scenario, then change oxygen, airflow, pressure, gravity or material. The lab shows how the estimate and its uncertainty move,
          which NASA tests sit behind it, and the exact point where the evidence stops and the answer becomes &ldquo;no estimate&rdquo;.
        </p>
        <p className={styles.disclaimer}>
          The estimate describes one kind of NASA test: whether a flame was established after the ignition attempt in an ISS glovebox. It is not a fire-risk
          probability, a hazard rating or crew advice, and it never extends to the Moon or Mars. It is the same gated model as the <Link className="link" href="/model-lab">AI Model Lab</Link>.
        </p>
      </header>
      <section aria-labelledby="wi-title" className={styles.section}>
        <h2 id="wi-title" className={styles.h2}>Counterfactual explorer</h2>
        <p className={styles.sub}>
          The uncertainty envelope is never narrower than either the model&apos;s own 90 % bootstrap interval or the interval from the raw NASA tests nearby, so a
          confident-looking number cannot hide a thin evidence base.
        </p>
        <WhatIfLab snap={snap} pressure={pressure} />
      </section>
    </div>
  );
}
