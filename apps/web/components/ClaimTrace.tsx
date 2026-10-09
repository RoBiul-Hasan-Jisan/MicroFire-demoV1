import Link from "next/link";
import { CHECKS } from "@/lib/ask-example";
import type { CheckedClaim, EvidenceItem } from "@/lib/ask-core";
import styles from "./ClaimTrace.module.css";

/** One row of ticks per claim, computed from the checker's real issues on that claim (never hard-coded). */
export function ClaimChecks({ issues }: { issues: string[] }) {
  return (
    <ul className={styles.checks} aria-label="Deterministic checks on this claim">
      {CHECKS.map((c) => {
        const fail = issues.find((i) => c.issue.test(i));
        return <li key={c.label} data-pass={!fail}><span aria-hidden="true">{fail ? "✗" : "✓"}</span>{c.label}{fail && <small>{fail}</small>}</li>;
      })}
    </ul>
  );
}

/** Question → retrieved evidence → AI synthesis → claims → verification → bounded answer. */
export function ClaimTrace({ question, summary, claims, items, provenance }: { question: string; summary: string; claims: CheckedClaim[]; items: EvidenceItem[]; provenance: string }) {
  const byKey = new Map(items.map((i) => [i.key, i]));
  const used = [...new Set(claims.flatMap((c) => c.cites))].map((k) => byKey.get(k)).filter((x): x is EvidenceItem => !!x);
  const allPass = claims.every((c) => c.verified);
  return (
    <ol className={styles.trace}>
      <li><b>Question</b><p>{question}</p></li>
      <li>
        <b>Retrieved NASA evidence <small>chosen by deterministic retrieval, before any model runs</small></b>
        <ul className={styles.items}>{used.map((i) => <li key={i.key}><Link className="link" href={i.href}>{i.title}</Link><span>{i.kind === "test" ? "test record" : "quoted finding"}{i.gravity === "partial" ? " · partial gravity" : " · microgravity"}</span></li>)}</ul>
        <small>{items.length} items were retrieved in total; {used.length} are cited below.</small>
      </li>
      <li><b>AI synthesis <small>{provenance}</small></b><p>{summary}</p></li>
      <li>
        <b>Claim extraction and verification <small>each factual claim is checked separately</small></b>
        <ol className={styles.claims}>
          {claims.map((c, i) => (
            <li key={i} data-verified={c.verified}>
              <p className={styles.claimHead}><span className={styles.type}>{c.type.toLowerCase()}</span>{c.verified ? "✓ passed every check" : "✗ flagged"}</p>
              <p>{c.text}</p>
              <ClaimChecks issues={c.issues} />
              <details>
                <summary>Show the evidence behind this claim</summary>
                {c.cites.map((k) => byKey.get(k) && <blockquote key={k}><Link className="link" href={byKey.get(k)!.href}>{byKey.get(k)!.title}</Link><span>{byKey.get(k)!.text}</span></blockquote>)}
              </details>
            </li>
          ))}
        </ol>
      </li>
      <li data-final={allPass}>
        <b>Final bounded answer</b>
        <p>{allPass ? "Shown, because every claim passed. " : "Withheld claims are marked. "}These checks test citations, numbers, units, gravity context and wording. They do not prove that every sentence is scientifically entailed by the evidence.</p>
      </li>
    </ol>
  );
}
