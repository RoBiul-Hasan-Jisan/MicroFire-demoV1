"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { ladderRobustness, RANGES, SAMPLES } from "@/lib/robustness";
import { useExplorer } from "@/components/guide/EmberGuide";
import { Cite } from "@/components/Cite";
import { evidenceRecords, findings } from "@/lib/data";
import { FAMILIES, KIND_LABEL, ladder, TOLERANCE, whyPath, type LadderItem, type MissionQuestion, type WhyStep } from "@/lib/ontology";
import type { OutcomeGroup } from "@/lib/types";
import styles from "./EvidenceLadder.module.css";

const OUTCOME: Record<OutcomeGroup, { label: string; tone: string }> = {
  sustained: { label: "Kept burning", tone: styles.toneFlame },
  extinguished: { label: "Went out", tone: styles.toneQuench },
  not_ignited: { label: "Did not ignite", tone: styles.toneInert },
  unknown: { label: "Outcome not stated", tone: styles.toneUnknown },
};

/**
 * The Evidence Ladder: how close NASA's evidence can get to one mission question.
 * Climbing up is stronger evidence. When nothing matches every condition, the top rung is missing,
 * and the missing rung is written as the experiment that would add it.
 */
export function EvidenceLadder({ q }: { q: MissionQuestion }) {
  const l = useMemo(() => ladder(evidenceRecords, findings, q), [q]);
  const [more, setMore] = useState(false);
  const settled = useDeferredValue(q);
  const rob = useMemo(() => ladderRobustness(evidenceRecords, findings, settled), [settled]);
  const top = l.direct.length ? 3 : l.analogous.length ? 2 : l.findings.mechanistic.length ? 1 : 0;
  const families = new Set([...l.direct, ...l.analogous].map((x) => x.record.family));
  const shown = more ? l.analogous.slice(0, 18) : l.analogous.slice(0, 6);

  return (
    <section aria-labelledby="ladder-title" className={styles.ladder} data-top={top}>
      <header className={styles.head}>
        <p className={styles.kicker}>Evidence Ladder</p>
        <h2 id="ladder-title" className="display text-2xl">
          {l.direct.length
            ? `${l.direct.length} NASA test${l.direct.length === 1 ? "" : "s"} match every condition you set`
            : "No NASA test matches every condition. Here is how close the evidence gets."}
        </h2>
        <ol className={styles.meter} aria-label="How far up the ladder the evidence reaches">
          <li data-on={l.findings.mechanistic.length > 0}>Mechanistic</li>
          <li data-on={l.analogous.length > 0}>Analogous</li>
          <li data-on={l.direct.length > 0} data-missing={!l.direct.length}>Direct{!l.direct.length && " ?"}</li>
        </ol>
        <p className={styles.sub}>
          Climbing up means stronger evidence. Tests from {families.size || "no"} experiment famil{families.size === 1 ? "y" : "ies"} are compared, each kept in its own physical regime.
        </p>
      </header>

      <div className={styles.body}>
        <svg key={top} className={styles.rail} viewBox="0 0 120 420" aria-hidden="true">
          <defs>
            <radialGradient id="ladder-spark">
              <stop offset="0" stopColor="#fff6d8" />
              <stop offset=".45" stopColor="#ffc35e" />
              <stop offset="1" stopColor="#ff8a1f" stopOpacity="0" />
            </radialGradient>
          </defs>
          <line x1="28" y1="18" x2="28" y2="410" className={styles.side} />
          <line x1="92" y1="18" x2="92" y2="410" className={styles.side} />
          <line x1="28" y1="40" x2="92" y2="40" className={l.direct.length ? styles.rungOn : styles.rungMissing} />
          <line x1="28" y1="160" x2="92" y2="160" className={l.analogous.length ? styles.rungOn : styles.rungOff} />
          <line x1="28" y1="280" x2="92" y2="280" className={l.findings.mechanistic.length ? styles.rungOn : styles.rungOff} />
          <line x1="28" y1="400" x2="92" y2="400" className={styles.rungOn} />
          {!l.direct.length && <text x="60" y="47" textAnchor="middle" className={styles.missingMark}>?</text>}
          <circle r="16" cx="60" cy="0" fill="url(#ladder-spark)" className={styles.spark} />
        </svg>

        <div className={styles.rungs}>
          <Rung title="Direct" note="Same material and gravity, every condition within tolerance" on={!!l.direct.length} missing={!l.direct.length}>
            {l.direct.length ? (
              <Cards items={l.direct.slice(0, 6)} q={q} />
            ) : (
              <div className={styles.missingCard}>
                <p className={styles.missingTitle}>The top rung is missing</p>
                <ul className={styles.gapList}>
                  {l.gaps.map((g) => (
                    <li key={g.dim + g.text}>{g.text}</li>
                  ))}
                </ul>
                {l.nextExperiment && (
                  <p className={styles.next}>
                    <span>The experiment that would add this rung</span>
                    {l.nextExperiment}
                  </p>
                )}
              </div>
            )}
          </Rung>

          <Rung title="Analogous" note="Solid-fuel tests that differ in named ways" on={!!l.analogous.length}>
            <Cards items={shown} q={q} />
            {l.analogous.length > 6 && (
              <button className={styles.more} onClick={() => setMore((m) => !m)} aria-expanded={more}>
                {more ? "Show fewer" : `Show ${Math.min(l.analogous.length, 18) - 6} more`}
              </button>
            )}
            {l.findings.analogous.length > 0 && (
              <ul className={styles.quotes} aria-label="Related findings">
                {l.findings.analogous.slice(0, 4).map(({ finding: f, family, why }) => (
                  <li key={f.id}>
                    <span className={styles.famChip} data-family={family.id}>{family.name}</span>
                    <blockquote>“{f.quote}”</blockquote>
                    <p className={styles.why}>{why} {KIND_LABEL[f.kind]}. <Cite sourceId={f.source_id} page={f.pdf_page} /></p>
                  </li>
                ))}
              </ul>
            )}
          </Rung>

          <Rung title="Mechanistic" note="Other physical regimes: explain mechanisms, never material outcomes" on={!!l.findings.mechanistic.length}>
            {l.findings.mechanistic.length ? (
              <ul className={styles.quotes}>
                {l.findings.mechanistic.slice(0, 3).map(({ finding: f, family, why }) => (
                  <li key={f.id}>
                    <span className={styles.famChip} data-family={family.id}>{family.name}</span>
                    <blockquote>“{f.quote}”</blockquote>
                    <p className={styles.why}>{why} <Cite sourceId={f.source_id} page={f.pdf_page} /></p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>No droplet or gas-flame finding speaks to these conditions.</p>
            )}
          </Rung>

          <p className={styles.ground}>
            Tolerances: oxygen ±{TOLERANCE.oxygen} points, pressure ±{TOLERANCE.pressureKpa} kPa, airflow ±{TOLERANCE.flowFraction * 100} %. A missing value never counts as a match.{" "}
            <Link href="/methodology#ladder" className="link">How the ladder works</Link>
          </p>
          <p className={styles.ground} data-robust>
            <strong>Tolerance check.</strong> Across {SAMPLES.toLocaleString("en-US")} variations of these tolerances (oxygen ±{RANGES.oxygen[0]}–{RANGES.oxygen[1]} points,
            pressure ±{RANGES.pressureKpa[0]}–{RANGES.pressureKpa[1]} kPa, airflow ±{RANGES.flowFraction[0] * 100}–{RANGES.flowFraction[1] * 100} %),{" "}
            {rob.directEmpty === 1
              ? "the direct rung stays empty every time."
              : rob.directEmpty === 0
                ? `the direct rung always holds evidence (${rob.directCount[0]}–${rob.directCount[1]} records).`
                : `the direct rung is empty in ${Math.round(rob.directEmpty * 100)} % of them (${rob.directCount[0]}–${rob.directCount[1]} direct records).`}
            {rob.closest && ` ${rob.closest.label} stays the closest record in ${Math.round(rob.closest.first * 100)} %.`}
          </p>
        </div>
      </div>
    </section>
  );
}

function Rung({ title, note, on, missing = false, children }: { title: string; note: string; on: boolean; missing?: boolean; children: React.ReactNode }) {
  return (
    <div className={styles.rung} data-on={on} data-missing={missing}>
      <h3 className={styles.rungTitle}>
        {title} <span>{note}</span>
      </h3>
      {children}
    </div>
  );
}

const MARK: Record<WhyStep["kind"], string> = { question: "?", match: "✓", differs: "✗", unknown: "–", rung: "▲" };

function Cards({ items, q }: { items: LadderItem[]; q: MissionQuestion }) {
  const { discover } = useExplorer();
  return (
    <ul className={styles.cards}>
      {items.map(({ record: r, differs }) => (
        <li key={r.id} className={styles.card}>
          <Link href={r.href} className={styles.cardLink}>
            <span className={styles.famChip} data-family={r.family}>{FAMILIES[r.family].name}</span>
            <strong>{r.label}</strong>
            <span className={styles.facts}>
              {r.material} · {r.oxygen ?? "?"} % O₂ · {r.pressureKpa ? `${r.pressureKpa[0]} kPa` : "pressure ?"} · {r.flowCmS ?? "?"} cm/s{r.sizeCm ? ` · ${r.sizeCm} cm sample` : ""}
            </span>
            <span className={`${styles.outcome} ${OUTCOME[r.outcome].tone}`}>{r.outcomeLabel}</span>
            {r.caveat && <span className={styles.caveat}>{r.caveat}</span>}
            {differs.length > 0 && (
              <span className={styles.differs}>
                {differs.map((d) => (
                  <em key={d.dim} data-unknown={d.unknown ? "" : undefined}>{d.text}</em>
                ))}
              </span>
            )}
          </Link>
          <details className={styles.whyBox} onToggle={(e) => { if (e.currentTarget.open) discover("whypath"); }}>
            <summary>Why is this evidence shown?</summary>
            <ol className={styles.whyPath}>
              {whyPath(r, q).map((st, i) => (
                <li key={i} data-kind={st.kind}>
                  <span className={styles.whyMark} aria-hidden="true">{MARK[st.kind]}</span>
                  <span>{st.text}</span>
                </li>
              ))}
              {r.cite && (
                <li data-kind="source">
                  <span className={styles.whyMark} aria-hidden="true">📄</span>
                  <span>NASA source: <Cite sourceId={r.cite.source_id} page={r.cite.pdf_page} where={r.cite.table} /></span>
                </li>
              )}
            </ol>
          </details>
        </li>
      ))}
    </ul>
  );
}
