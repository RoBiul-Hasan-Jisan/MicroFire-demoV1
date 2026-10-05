import type { Metadata } from "next";
import Link from "next/link";
import { ModelQuery } from "@/components/modellab/ModelQuery";
import { Cite } from "@/components/Cite";
import { experiments, luciRuns, saffireRuns } from "@/lib/data";
import {
  BOOTSTRAPS, deployedSnapshot, DRAFT_RULE_PICK, FOLDS, labReport, LAMBDA, LOCAL, MODEL_VERSION, MODELS, NEAR,
  PRESSURE_DOMAIN, REPEATS, TARGET, type Interval,
} from "@/lib/model-lab";
import styles from "@/components/modellab/ModelLab.module.css";

export const metadata: Metadata = {
  title: "AI Model Lab",
  description: "Evidence-bounded outcome modeling on NASA BASS-II test records: a small, validated classifier that refuses to predict outside its evidence.",
};

const f = (x: number | null | undefined, d = 2) => (x == null ? "n/a" : x.toFixed(d));
const ci = (x: Interval | null) => (x ? `${f(x.lo)}–${f(x.hi)}` : "");

export default function ModelLabPage() {
  const { rows, excluded, evals, pick, transfer } = labReport(experiments);
  const snap = pick === "logit-o2-material" ? deployedSnapshot(experiments) : null;
  const deployed = evals.find((e) => e.id === pick);
  const base = evals.find((e) => e.id === "baseline")!;
  const neg = rows.filter((r) => !r.y).length;
  const byReason = Object.entries(excluded.reduce<Record<string, string[]>>((acc, e) => ((acc[e.reason] ??= []).push(e.test), acc), {}));

  return (
    <div className={`explorer-page ${styles.page}`}>
      <header className={styles.hero}>
        <p className={styles.kicker}>AI Model Lab · evidence-bounded outcome modeling</p>
        <h1 className={styles.title}>A small model that knows where its evidence stops</h1>
        <p className={styles.lede}>
          Machine learning on NASA test records, with a gate in front of it. The model answers only inside the conditions NASA actually tested.
          Everywhere else it abstains and points you to the closest evidence.
        </p>
        <ul className={styles.facts}>
          <li><b className="num">{rows.length}</b> NASA tests used</li>
          <li><b className="num">{neg}</b> without an established flame</li>
          <li><b className="num">{excluded.length}</b> excluded, each with a reason</li>
          <li><b>1</b> experiment family: BASS-II, ISS glovebox</li>
        </ul>
        <p className={styles.disclaimer}>Not a NASA operational fire-safety model. It predicts an experimental outcome, never a mission or crew risk.</p>
      </header>

      <section aria-labelledby="query-title" className={styles.section}>
        <h2 id="query-title" className={styles.h2}>Ask the model</h2>
        <p className={styles.sub}>Every request is checked first. You get one of four states: in domain, near domain, out of domain or insufficient evidence. Only the first two receive a number.</p>
        {snap ? <ModelQuery snap={snap} /> : <p className={styles.blockedTitle}>No model passed the deployment rule, so none is deployed. The validation results below are the finding.</p>}
      </section>

      <section aria-labelledby="audit-title" className={styles.section}>
        <h2 id="audit-title" className={styles.h2}>What the data can support</h2>
        <p className={styles.sub}>We audited every family before training. Pooling incompatible experiments would raise the record count and lower the science.</p>
        <table className={styles.table}>
          <thead><tr><th scope="col">Evidence</th><th scope="col">Records</th><th scope="col">Decision</th><th scope="col">Why</th></tr></thead>
          <tbody>
            <tr><td>BASS-II SIBAL fabric, concurrent flow</td><td className="num">{rows.filter((r) => r.material === "SIBAL fabric").length} used</td><td>Used</td><td>Oxygen, starting airflow and 1 atm pressure stated; both outcomes observed; crew sessions recorded, so we can validate across sessions.</td></tr>
            <tr><td>BASS-II PMMA film, opposed flow</td><td className="num">{rows.filter((r) => r.material === "PMMA").length} used</td><td>Used, with a material term</td><td>Same apparatus, gravity and ignition system. Pressure is not stated in the table. Only one PMMA test failed to establish a flame (B14, 14.1 % O₂).</td></tr>
            <tr><td>BASS-II Nomex</td><td className="num">3</td><td>Excluded</td><td>All three failed to sustain a flame. One outcome cannot teach a condition effect. Queries return “insufficient evidence”.</td></tr>
            <tr><td>Saffire</td><td className="num">{saffireRuns.length}</td><td>Not pooled</td><td>Metre-scale samples in a cargo ship at a fixed 20 to 25 cm/s; the outcome is set by material (silicone and Nomex never spread). A different regime from centimetre BASS-II samples.</td></tr>
            <tr><td>LUCI</td><td className="num">{luciRuns.length}</td><td>Not pooled</td><td>Simulated lunar gravity on a spinning rocket, two burns. Not enough to model, and a different gravity regime.</td></tr>
          </tbody>
        </table>
        <div className={styles.cols}>
          <div>
            <h3 className={styles.h3}>What the model predicts</h3>
            <p>{TARGET}. Coded by MicroFire from NASA&apos;s verbatim comments: “no ignition” and “brief flash, no sustained flame” are 0; every test that ignited and spread is 1, however it ended.</p>
            <h3 className={styles.h3}>Why not “did the flame survive?”</h3>
            <p>Most BASS-II flames that “went out” were put out on purpose: the crew turned the fan down step by step until the flame quenched, or up until it blew off. That label records the test procedure, so a model trained on it would learn the procedure. We do not train on it.</p>
          </div>
          <div>
            <h3 className={styles.h3}>Excluded records</h3>
            <ul className={styles.excluded}>
              {byReason.map(([reason, tests]) => <li key={reason}><b>{tests.join(", ")}</b><span>{reason}</span></li>)}
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="bench-title" className={styles.section}>
        <h2 id="bench-title" className={styles.h2}>Benchmark: five models, honest validation</h2>
        <p className={styles.sub}>
          Main scheme: leave one crew session out, so tests from the same day never sit on both sides of the split. Intervals are 95 % bootstrap intervals over the held-out predictions.
          Gradient boosting was not run: {neg} minority-class events cannot support it.
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th scope="col">Model</th><th scope="col">Brier score ↓</th><th scope="col">Log loss ↓</th><th scope="col">ROC-AUC</th><th scope="col">Balanced accuracy at 0.5</th><th scope="col">Repeated stratified CV AUC</th></tr></thead>
            <tbody>
              {evals.map((e) => (
                <tr key={e.id} data-picked={e.id === pick || undefined}>
                  <td>{e.name}{e.id === pick && <b className={styles.pick}> deployed</b>}</td>
                  <td className="num">{f(e.grouped.brier, 3)} <small>{ci(e.grouped.ci.brier)}</small></td>
                  <td className="num">{f(e.grouped.logLoss, 3)}</td>
                  <td className="num">{e.grouped.auc == null ? "not meaningful" : <>{f(e.grouped.auc)} <small>{ci(e.grouped.ci.auc)}</small></>}</td>
                  <td className="num">{f(e.grouped.balancedAccuracy)} <small>{ci(e.grouped.ci.balancedAccuracy)}</small></td>
                  <td className="num">{e.repeated.auc ? <>{f(e.repeated.auc.est)} <small>{ci(e.repeated.auc)}</small></> : "n/a"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.cols}>
          <div>
            <h3 className={styles.h3}>How the deployed model was chosen</h3>
            <p>A model must beat the baseline on grouped Brier score and log loss, and the lower end of its AUC interval must be above 0.5. The simplest model within 0.01 Brier of the best then wins. That is the {deployed?.name.toLowerCase()}.</p>
            <p className={styles.small}>Disclosure: our first draft rule also required balanced accuracy at a 0.5 cut-off. Under that rule the {MODELS.find((m) => m.id === DRAFT_RULE_PICK)!.name.toLowerCase()} would have been chosen. We dropped the criterion because the Lab outputs probabilities, never classes, and with 10 % prevalence a 0.5 cut-off is arbitrary. The tree&apos;s AUC interval also reaches down to 0.20.</p>
          </div>
          <div>
            <h3 className={styles.h3}>What the numbers really say</h3>
            <p>The deployed model ranks tests well (AUC {f(deployed?.grouped.auc)}, interval {ci(deployed?.grouped.ci.auc ?? null)}) but its Brier interval overlaps the baseline&apos;s ({ci(base.grouped.ci.brier)}). With {neg} failures, it cannot be shown to be better calibrated than always guessing the base rate. It never outputs “no flame” at a 0.5 cut-off, so balanced accuracy at 0.5 stays at chance.</p>
            <p>Repeated stratified CV ({REPEATS} × {FOLDS} folds) looks much better (AUC near {f(deployed?.repeated.auc?.est)}) because tests from one session can land on both sides of a split. We report it, but we trust the session-grouped numbers.</p>
          </div>
        </div>
        {deployed && (
          <div className={styles.cols}>
            <div>
              <h3 className={styles.h3}>Confusion matrix (session-grouped, cut-off 0.5)</h3>
              <table className={styles.confusion}>
                <thead><tr><th scope="col"></th><th scope="col">Predicted established</th><th scope="col">Predicted not</th></tr></thead>
                <tbody>
                  <tr><th scope="row">Flame established</th><td className="num">{deployed.grouped.confusion.tp}</td><td className="num">{deployed.grouped.confusion.fn}</td></tr>
                  <tr><th scope="row">No flame</th><td className="num">{deployed.grouped.confusion.fp}</td><td className="num">{deployed.grouped.confusion.tn}</td></tr>
                </tbody>
              </table>
              <p className={styles.small}>Minority class (no flame): precision {f(deployed.grouped.precision)}, recall {f(deployed.grouped.recall)}, F1 {f(deployed.grouped.f1)}.</p>
            </div>
            <div>
              <h3 className={styles.h3}>Calibration (session-grouped)</h3>
              <table className={styles.table}>
                <thead><tr><th scope="col">Predicted range</th><th scope="col">Tests</th><th scope="col">Mean prediction</th><th scope="col">Observed rate</th></tr></thead>
                <tbody>{deployed.calibration.map((b) => <tr key={b.bin}><td>{b.bin}</td><td className="num">{b.n}</td><td className="num">{b.n ? f(b.meanP) : "–"}</td><td className="num">{b.n ? f(b.observed) : "–"}</td></tr>)}</tbody>
              </table>
              <p className={styles.small}>Three bins, because 41 tests cannot support a finer reliability curve. Calibration status: plausible in the 0.8+ bin, not assessable below 0.5.</p>
            </div>
          </div>
        )}
        <h3 className={styles.h3}>Stress test: does it transfer to an unseen material?</h3>
        <table className={styles.table}>
          <thead><tr><th scope="col">Held-out material</th><th scope="col">Test records</th><th scope="col">No-flame tests</th><th scope="col">Brier</th><th scope="col">AUC</th><th scope="col">Balanced accuracy</th></tr></thead>
          <tbody>{transfer.map((t) => <tr key={t.held}><td>{t.held}</td><td className="num">{t.testN}</td><td className="num">{t.testNegatives}</td><td className="num">{f(t.brier, 3)}</td><td className="num">{f(t.auc)}</td><td className="num">{f(t.balancedAccuracy)}</td></tr>)}</tbody>
        </table>
        <p className={styles.small}>An oxygen-only model trained on PMMA ranks the fabric tests correctly but calls every one of them “established”. In these tests the fabric failed to ignite at 16.4–16.8 % oxygen, where PMMA films still burned. Ranking transfers; probabilities do not. That is why the gate blocks every material without training data.</p>
      </section>

      <section aria-labelledby="card-title" className={styles.section}>
        <h2 id="card-title" className={styles.h2}>Model Card</h2>
        <dl className={styles.card}>
          <div><dt>Version</dt><dd>{MODEL_VERSION}</dd></div>
          <div><dt>Purpose</dt><dd>Show what genuine machine learning on NASA records can support, and where it must stop.</dd></div>
          <div><dt>Predicts</dt><dd>{TARGET}.</dd></div>
          <div><dt>Does not predict</dt><dd>Mission fire risk, crew safety, spacecraft fire probability, flame spread rate, extinction, or any outcome in lunar, Martian or Earth gravity, in other atmospheres or for other materials.</dd></div>
          <div><dt>Dataset</dt><dd>BASS-II test tables (<Cite sourceId="bass2-summary" page={104} where="Table 7.1" />, <Cite sourceId="bass2-summary" page={111} where="Table A.1" />): {rows.length} usable tests of {experiments.length}; {neg} without an established flame.</dd></div>
          <div><dt>Features</dt><dd>Oxygen (volume %) and material (PMMA vs SIBAL), standardised. Starting airflow was benchmarked and did not help.</dd></div>
          <div><dt>Outcome encoding</dt><dd>0 = “no ignition” or “brief flash, no sustained flame”; 1 = ignited and spread, however the test ended.</dd></div>
          <div><dt>Missing data</dt><dd>No imputation. Tests without oxygen or starting airflow would be excluded (none were). Unstated PMMA pressure stays unstated.</dd></div>
          <div><dt>Algorithm</dt><dd>L2-regularised logistic regression (λ = {LAMBDA} on standardised features, intercept unpenalised), fitted by Newton&apos;s method. Uncertainty: {BOOTSTRAPS} class-stratified bootstrap refits; the interval is their 5th–95th percentile.</dd></div>
          <div><dt>Validation</dt><dd>Leave-one-crew-session-out (main), {REPEATS} × repeated stratified {FOLDS}-fold, 1,000-sample bootstrap intervals, leave-one-material-out stress test.</dd></div>
          <div><dt>Metrics</dt><dd>Brier {f(deployed?.grouped.brier, 3)}, log loss {f(deployed?.grouped.logLoss, 3)}, AUC {f(deployed?.grouped.auc)} ({ci(deployed?.grouped.ci.auc ?? null)}). Baseline Brier {f(base.grouped.brier, 3)}.</dd></div>
          <div><dt>Domain rules</dt><dd>Gravity must be microgravity. Material must be SIBAL fabric or PMMA. Pressure {PRESSURE_DOMAIN[0]}–{PRESSURE_DOMAIN[1]} kPa. Oxygen and airflow inside each material&apos;s tested range (near domain up to {NEAR.o2} pp and {NEAR.flow} cm/s beyond it). At least {LOCAL.min} same-material tests within ±{LOCAL.o2} pp and ±{LOCAL.flow} cm/s.</dd></div>
          <div><dt>Known weaknesses</dt><dd>Only {neg} negative outcomes; one for PMMA. Calibration cannot be shown to beat the base rate. A shared oxygen slope is assumed across two materials and flow configurations. Sessions differ in crew, sample batch and date.</dd></div>
          <div><dt>Gravity, pressure</dt><dd>Microgravity only. Fabric tests state 1 atm; PMMA tests state no pressure. Nothing here says anything about 56.5 or 70 kPa cabins.</dd></div>
          <div><dt>Potential bias</dt><dd>Test conditions were chosen by NASA researchers to probe limits, so the data over-represent near-limit oxygen and low flows. That is not a random sample of cabin conditions.</dd></div>
          <div><dt>Reproduce</dt><dd><code>cd apps/web &amp;&amp; npm run model-lab</code>. The pipeline, this page and the tests (<code>lib/model-lab.test.ts</code>) run the same seeded code in <code>lib/model-lab.ts</code>.</dd></div>
        </dl>
        <p className={styles.disclaimer}>Not a NASA operational fire-safety model. Not endorsed by NASA.</p>
        <p className={styles.small}><Link className="link" href="/methodology">Full methodology</Link> · <Link className="link" href="/atlas">See every record</Link></p>
      </section>
    </div>
  );
}
