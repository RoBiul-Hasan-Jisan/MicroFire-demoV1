"use client";

import { useMemo, useState } from "react";
import { costLens, describeTest, GRAVITY_LABEL, pct, type NextTests } from "@/lib/next-tests";
import styles from "./CostLens.module.css";

export function CostLens({ grid, alwaysPartial }: { grid: NextTests["grid"]; alwaysPartial: boolean }) {
  const [ratio, setRatio] = useState(1);
  const rows = useMemo(() => costLens(grid, ratio), [grid, ratio]);
  const sorted = [...rows].sort((a, b) => a.rank - b.rank);
  const first = sorted[0];
  const set = (v: number) => { if (Number.isFinite(v) && v > 0) setRatio(Math.min(20, Math.max(0.1, v))); };
  return (
    <section className={styles.box} aria-labelledby="cost-lens">
      <h2 id="cost-lens">Cost lens: what if some tests cost more?</h2>
      <p className={styles.sub}>
        The atlas holds no cost data, so cost is your assumption. Set how many times more a partial-gravity (Moon or Mars) test costs than an ISS test, and the best single test
        for each gravity is re-ranked by uncertainty removed per unit cost. At 1× the order is the planner&apos;s own.
      </p>
      <label className={styles.ctrl}>
        <input type="range" min={0.1} max={10} step={0.1} value={Math.min(10, ratio)} onChange={(e) => set(Number(e.target.value))} aria-label="Partial-gravity test cost as a multiple of an ISS test" />
        <input type="number" min={0.1} max={20} step={0.1} value={ratio} onChange={(e) => e.target.value !== "" && set(Number(e.target.value))} aria-label="Cost multiple" />
        <small>× the cost of an ISS test</small>
      </label>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead><tr><th scope="col">Rank</th><th scope="col">Best single test</th><th scope="col">Uncertainty removed</th><th scope="col">Assumed cost</th><th scope="col">Removed per unit cost</th></tr></thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.gravity} data-first={r.rank === 1}>
                <td className="num">{r.rank}</td>
                <td>{describeTest({ gravity: r.gravity, o2: r.o2, forced: r.forced, direction: "concurrent" })}</td>
                <td className="num">{pct(r.gain)}</td>
                <td className="num">{r.cost === 1 ? "1×" : `${r.cost.toFixed(1)}×`}</td>
                <td className="num">{(r.perCost * 100).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.read} aria-live="polite">
        <p>At {ratio.toFixed(1)}× the top-ranked single test is <b>{GRAVITY_LABEL[first.gravity]}</b>.</p>
        {rows.filter((r) => r.breakEven !== null).map((r) => (
          <p key={r.gravity}>
            A {GRAVITY_LABEL[r.gravity].toLowerCase()} test beats the best ISS test only if it costs less than <b className="num">{r.breakEven!.toFixed(2)}×</b> as much.
          </p>
        ))}
      </div>
      <p className={styles.not}>
        This is a reader-set assumption, not a NASA cost estimate, and it ranks single tests only.
        {alwaysPartial && " The planner's full batch of picks still includes a partial-gravity test in every sensitivity setting that was tried, because those are the only tests that can speak to Moon and Mars gravity."}
      </p>
    </section>
  );
}
