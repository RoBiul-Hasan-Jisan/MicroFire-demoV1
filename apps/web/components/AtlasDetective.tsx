"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useExplorer } from "@/components/guide/EmberGuide";
import { OutcomeTag } from "@/components/Outcome";
import type { Experiment } from "@/lib/types";
import styles from "./AtlasDetective.module.css";

type SortKey = "test_id" | "oxygen_vol_pct" | "flow_initial_cm_s" | "thickness_mm";

/**
 * The data-detective table: the same NASA rows, read as a game. Each challenge's answer is computed from the
 * data (never typed in), and the player answers by tapping a row. Sorting is the tool that makes it solvable.
 */
export function AtlasDetective({ rows }: { rows: Experiment[] }) {
  const { discover } = useExplorer();
  const challenges = useMemo(() => {
    const sustained = rows.filter((e) => e.outcome_group === "sustained" && e.oxygen_vol_pct != null);
    const low = Math.min(...sustained.map((e) => e.oxygen_vol_pct!));
    return [
      { q: "Find the lowest oxygen where a flame kept burning.", tip: "Sort by oxygen, then look for an orange “kept burning” tag near the bottom.", answers: sustained.filter((e) => e.oxygen_vol_pct === low).map((e) => e.id), why: `${low} % oxygen: the flame burned the whole sample.` },
      { q: "Find a test where strong airflow blew the flame out.", tip: "Look for “blew off” in the outcome column, often at higher airflow.", answers: rows.filter((e) => e.outcome === "blowoff").map((e) => e.id), why: "NASA's notes say the flame blew off as the airflow rose." },
      { q: "Find a test whose oxygen reading NASA flagged as possibly wrong.", tip: "A flagged reading has a question mark next to the oxygen value.", answers: rows.filter((e) => e.quality_flags.includes("o2_reading_suspect")).map((e) => e.id), why: "Good scientists keep doubtful readings, and label them." },
    ].filter((c) => c.answers.length);
  }, [rows]);
  const [ci, setCi] = useState(0);
  const [result, setResult] = useState<{ id: string; right: boolean } | null>(null);
  const [solved, setSolved] = useState<number[]>([]);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "test_id", dir: 1 });
  const ch = challenges[ci % Math.max(1, challenges.length)];

  const sorted = [...rows].sort((a, b) => {
    const av = a[sort.key] ?? -Infinity, bv = b[sort.key] ?? -Infinity;
    return (av < bv ? -1 : av > bv ? 1 : a.id.localeCompare(b.id, "en", { numeric: true })) * sort.dir;
  });
  const maxO2 = 22, minO2 = 13;
  const flowPct = (v: number | null) => (v == null ? 0 : Math.round((Math.log(v / 0.5) / Math.log(60 / 0.5)) * 100));
  const o2Pct = (v: number | null) => (v == null ? 0 : Math.round(((v - minO2) / (maxO2 - minO2)) * 100));

  const pick = (e: Experiment) => {
    if (!ch) return;
    const right = ch.answers.includes(e.id);
    setResult({ id: e.id, right });
    if (right) { setSolved((s) => (s.includes(ci) ? s : [...s, ci])); discover("detective"); }
  };
  return (
    <div className={styles.detective} data-guide="table">
      {ch && (
        <div className={styles.case} data-state={result ? (result.right ? "right" : "wrong") : "open"}>
          <p className={styles.caseNo}>Case {ci % challenges.length + 1} of {challenges.length} · {solved.length} solved</p>
          <p className={styles.caseQ}>{ch.q}</p>
          <p className={styles.caseHint} aria-live="polite">
            {result == null ? <>Tap the row you think answers it. Tip: {ch.tip}</> : result.right ? <>Solved! {ch.why}</> : <>Not this one. {ch.tip}</>}
          </p>
          <div className={styles.caseActions}>
            {result?.right && <button className={styles.next} onClick={() => { setCi((i) => i + 1); setResult(null); }}>Next case</button>}
          </div>
        </div>
      )}
      <div className={styles.sorts} role="group" aria-label="Sort the rows">
        <span>Sort by</span>
        {([["test_id", "Test name"], ["oxygen_vol_pct", "Oxygen"], ["flow_initial_cm_s", "Airflow"], ["thickness_mm", "Thickness"]] as [SortKey, string][]).map(([k, label]) => (
          <button key={k} className={styles.sort} aria-pressed={sort.key === k} onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? ((-s.dir) as 1 | -1) : k === "oxygen_vol_pct" ? -1 : 1 }))}>
            {label}{sort.key === k ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
          </button>
        ))}
      </div>
      <ol className={styles.rows}>
        {sorted.map((e) => (
          <li key={e.id} data-picked={result?.id === e.id ? (result.right ? "right" : "wrong") : undefined}>
            <button className={styles.row} onClick={() => pick(e)} aria-label={`Answer with test ${e.test_id}`}>
              <span className={styles.id}>{e.test_id}<small>{e.material}{e.thickness_mm != null ? ` · ${e.thickness_mm} mm` : ""}</small></span>
              <span className={styles.meter} title={`Oxygen ${e.oxygen_vol_pct} %`}>
                <span className={styles.mLabel}>O₂ {e.oxygen_vol_pct ?? "?"}%{e.quality_flags.includes("o2_reading_suspect") && <b title="NASA marks this oxygen reading as possibly inaccurate"> ?</b>}</span>
                <span className={styles.track}><i data-o2 data-w={Math.round(o2Pct(e.oxygen_vol_pct) / 5) * 5} /></span>
              </span>
              <span className={styles.meter} title={`Airflow as recorded: ${e.flow_verbatim}`}>
                <span className={styles.mLabel}>Air {e.flow_verbatim}</span>
                <span className={styles.track}><i data-flow data-w={Math.round(flowPct(e.flow_initial_cm_s) / 5) * 5} /></span>
              </span>
              <span className={styles.out}><OutcomeTag outcome={e.outcome} label={e.outcome_label} /></span>
            </button>
            <Link href={`/experiments/${e.id}`} className={styles.open} aria-label={`Open the full record for ${e.test_id}`}>Open ↗</Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
