import ex from "./ObsExtra.module.css";
import styles from "./AtlasObservatory.module.css";
import { FLOW_BINS, O2_BINS, OBSERVED_MIN, type Cell } from "@/lib/gaps";

export function GapObservatory({ grid }: { grid: Cell[][] }) {
  const lab = (b: [number, number]) => `${b[0]}–${b[1]}`;
  return (
    <section className={`${styles.panel} ${ex.sec}`}>
      <h2>Coverage heat map</h2>
      <p>Each cell counts the BASS-II tests whose oxygen and airflow fall in it. Green has {OBSERVED_MIN} or more tests, amber has 1 or 2, and dark cells have none. The {OBSERVED_MIN}-test threshold is a project choice, and an empty cell is a question no test has answered, not a verdict of danger or safety.</p>
      <div className={`${ex.hm} ${ex.mt12}`}>
        <div />{FLOW_BINS.map((f) => <div key={lab(f)} className={ex.hh}>{lab(f)} cm/s</div>)}
        {grid.map((row, i) => (<><div key={`r${i}`} className={ex.hr}>{lab(O2_BINS[i])}% O₂</div>
          {row.map((c, j) => <div key={`${i}-${j}`} className={`${ex.hc} ${ex["z-" + c.zone]}`} title={`${c.tests.length} test(s)`}>{c.tests.length || "–"}</div>)}</>))}
      </div>
      <div className={ex.legend}><span><i className={ex.swObs} />Observed</span><span><i className={ex.swSparse} />Sparse</span><span><i className={ex.swNone} />No test</span></div>
    </section>
  );
}
