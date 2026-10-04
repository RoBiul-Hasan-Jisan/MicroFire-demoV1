import Link from "next/link";
import { Cite } from "@/components/Cite";
import { evidenceRecords, findings } from "@/lib/data";
import { FRONTIER, frontier } from "@/lib/frontier";
import styles from "./FrontierCards.module.css";

/** One card per mission question: know, don't know, why, missing, and the test that would help. Server-rendered. */
export function FrontierCards() {
  const entries = FRONTIER.map((f) => frontier(f, evidenceRecords, findings));
  return (
    <ul className={styles.grid}>
      {entries.map((e) => (
        <li key={e.question.id} className={styles.card} data-closed={e.closed}>
          <div className={styles.top}>
            <svg className={styles.stars} viewBox="0 0 120 60" aria-hidden="true">
              <path d="M10 46 L34 22 L58 34 L84 12" className={styles.line} />
              {[[10, 46], [34, 22], [58, 34]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="4" className={styles.star} />)}
              {e.closed ? <circle cx="84" cy="12" r="5" className={styles.star} /> : <text x="84" y="18" textAnchor="middle" className={styles.q}>?</text>}
            </svg>
            <span className={styles.status}>{e.closed ? "Evidence exists" : "Open frontier"}</span>
          </div>
          <p className={styles.kid}>{e.question.kid}</p>
          <h3 className="display text-xl">{e.question.title}</h3>
          <dl className={styles.sections}>
            <div>
              <dt>What we know</dt>
              <dd><ul>{e.know.map((k) => <li key={k}>{k}</li>)}</ul></dd>
            </div>
            {e.dontKnow && (
              <div>
                <dt>What we don&apos;t know</dt>
                <dd>{e.dontKnow}</dd>
              </div>
            )}
            {e.why.length > 0 && (
              <div>
                <dt>Why the gap exists</dt>
                <dd>
                  <ul>
                    {e.why.map((w) => (
                      <li key={w.text}>{w.text}{w.finding && <> <Cite sourceId={findings.find((f) => f.id === w.finding)!.source_id} /></>}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
            {e.missing.length > 0 && (
              <div>
                <dt>Missing condition</dt>
                <dd className={styles.chips}>{e.missing.map((m) => <span key={m}>{m}</span>)}</dd>
              </div>
            )}
            {e.next && (
              <div className={styles.next}>
                <dt>What kind of test would reduce the uncertainty</dt>
                <dd>{e.next}</dd>
              </div>
            )}
          </dl>
          <Link href={`/mission?context=${e.question.context}`} className={styles.link} data-quest="frontier-link">
            Climb this question&apos;s Evidence Ladder
          </Link>
        </li>
      ))}
    </ul>
  );
}
