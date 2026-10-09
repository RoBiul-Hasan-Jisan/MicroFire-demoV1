import Link from "next/link";
import { Cite } from "@/components/Cite";
import { evidenceRecords, findings, sources } from "@/lib/data";
import { FRONTIER, frontier } from "@/lib/frontier";
import { describeTest, pct, type NextTests } from "@/lib/next-tests";
import nextJson from "@/data/next_experiments.json";
import modelJson from "@/data/model.json";
import styles from "./HomeDashboard.module.css";

const SUMMARY = ["low-flow-sensitivity", "dim-blue-low-flow", "low-g-burns-lower-o2"];

type Report = { models: Record<string, { balanced_accuracy: number }> };

/** The dashboard the challenge asks for, on one screen: summarised findings, a ranked test plan, and an interpretation of what is still unknown. */
export function HomeDashboard() {
  const next = nextJson as unknown as NextTests;
  const batch = next.headline.batch;
  const together = batch.length ? batch[batch.length - 1].cumulative_uncertainty_removed : 0;
  const report = (modelJson as unknown as { report: Report }).report;
  const honest = report.models.nested_selection_honest.balanced_accuracy;
  const baseline = report.models.baseline_series_prior.balanced_accuracy;
  const summary = SUMMARY.map((id) => findings.find((f) => f.id === id)).filter((f) => f != null);
  const entries = FRONTIER.map((f) => frontier(f, evidenceRecords, findings));
  const materials = new Set(evidenceRecords.map((r) => r.material)).size;

  const stats: [string, string][] = [
    [String(evidenceRecords.length), "NASA test records"],
    [String(materials), "materials"],
    [String(sources.length), "NASA documents"],
    [String(findings.length), "quotes checked against the source"],
    [honest.toFixed(2), `model score on unseen flights (${baseline.toFixed(2)} = no skill)`],
  ];

  return (
    <section className={styles.wrap} aria-labelledby="dash-title">
      <h2 id="dash-title" className="sr-only">Dashboard</h2>
      <ul className={styles.stats}>
        {stats.map(([n, label]) => (
          <li key={label}><strong className="num">{n}</strong><span>{label}</span></li>
        ))}
      </ul>

      <div className={styles.grid}>
        <article className={styles.panel}>
          <p className={styles.kicker}>Summarised</p>
          <h3 className="display">What NASA found</h3>
          <ul className={styles.list}>
            {summary.map((f) => (
              <li key={f.id}>
                <blockquote className={styles.quote}>“{f.quote}”</blockquote>
                <Cite sourceId={f.source_id} page={f.pdf_page} />
              </li>
            ))}
          </ul>
          <Link href="/sources" className={styles.more}>All sources</Link>
        </article>

        <article className={styles.panel}>
          <p className={styles.kicker}>Ranked</p>
          <h3 className="display">The {batch.length} tests that would teach us most</h3>
          <ol className={styles.list}>
            {batch.map((s) => (
              <li key={s.rank}><span className={styles.rank}>{s.rank}</span><span>{describeTest(s)}</span></li>
            ))}
          </ol>
          <p className={styles.note}>Together they remove about {pct(together)} of our uncertainty about five Moon and Mars cabins. A research idea, not a NASA plan.</p>
          <Link href="/next-tests" className={styles.more}>See the full ranking</Link>
        </article>

        <article className={styles.panel}>
          <p className={styles.kicker}>Interpreted</p>
          <h3 className="display">Do we know it yet?</h3>
          <ul className={styles.list}>
            {entries.map((e) => (
              <li key={e.question.id}>
                <span className={styles.badge} data-closed={e.closed}>{e.closed ? "Evidence exists" : "Open frontier"}</span>
                <span>{e.question.title}</span>
              </li>
            ))}
          </ul>
          <Link href="/gaps" className={styles.more}>Open the Research Frontier</Link>
        </article>
      </div>
    </section>
  );
}
