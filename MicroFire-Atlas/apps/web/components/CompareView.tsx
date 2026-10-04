"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Cite, Quote } from "@/components/Cite";
import { FlowO2Plot } from "@/components/FlowO2Plot";
import { Legend, OutcomeTag } from "@/components/Outcome";
import { AtmosphereMap } from "@/components/AtmosphereMap";
import { experiments, evidenceRecords, findings, getExperiment, getSaffire, saffireRuns } from "@/lib/data";
import { analyze, compareFromBass, compareFromSaffire, type CompareRecord } from "@/lib/compare";
import { FAMILIES } from "@/lib/ontology";
import { PRESETS, getPreset } from "@/lib/presets";
import styles from "./CompareView.module.css";

const MAX = 4;

const toRecord = (id: string): CompareRecord | null => {
  const e = getExperiment(id);
  if (e) return compareFromBass(e);
  const r = getSaffire(id);
  return r ? compareFromSaffire(r) : null;
};

type RowDef = { label: string; get: (r: CompareRecord) => string };
const ROWS: RowDef[] = [
  { label: "Experiment", get: (r) => FAMILIES[r.family].name },
  { label: "Material", get: (r) => r.material },
  { label: "Thickness", get: (r) => (r.thicknessMm != null ? `${r.thicknessMm} mm` : "not stated") },
  { label: "Width", get: (r) => (r.widthMm != null ? (r.widthMm >= 50 ? `${r.widthMm / 10} cm` : `${r.widthMm} mm`) : "not stated") },
  { label: "Flow direction", get: (r) => r.flowDirection ?? "not stated" },
  { label: "Oxygen", get: (r) => (r.oxygen != null ? `${r.oxygen} %` : "not stated") },
  { label: "Airflow", get: (r) => r.airflow },
  { label: "Pressure", get: (r) => (r.pressureKpa ? (r.pressureKpa[0] === r.pressureKpa[1] ? `${r.pressureKpa[0]} kPa` : `${r.pressureKpa[0]}–${r.pressureKpa[1]} kPa`) : "not stated") },
];

export function CompareView() {
  const params = useSearchParams();
  const router = useRouter();
  const preset = getPreset(params.get("preset") ?? "") ?? (params.get("ids") ? undefined : PRESETS[0]);
  const ids = preset?.ids ?? (params.get("ids") ?? "").split(",").filter((id) => toRecord(id)).slice(0, MAX);
  const rows = ids.map((id) => toRecord(id)!);
  const analysis = rows.length >= 2 ? analyze(rows) : null;
  const bassIds = rows.filter((r) => r.family === "bass2").map((r) => r.id);
  const [query, setQuery] = useState("");

  const setIds = (next: string[]) => router.replace(`/compare?ids=${next.join(",")}`, { scroll: false });
  const toggle = (id: string) => setIds(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(-MAX));

  const quotes = (preset?.findings ?? []).map((id) => findings.find((f) => f.id === id)!).filter(Boolean);
  const pool = [
    ...experiments.map((e) => ({ id: e.id, name: e.test_id, hint: `${e.material}, ${e.oxygen_vol_pct}% O₂`, text: `${e.test_id} ${e.material} ${e.investigation}` })),
    ...saffireRuns.map((r) => ({ id: r.id, name: `Saffire ${r.sample}`, hint: `${r.material}${r.pressure_kpa ? `, ${r.pressure_kpa} kPa` : ""}`, text: `saffire ${r.sample} ${r.material} ${r.flight}` })),
  ];
  const matches = query ? pool.filter((x) => x.text.toLowerCase().includes(query.toLowerCase())).slice(0, 10) : [];

  return (
    <div className="comparison-workspace space-y-10">
      <div><h2 className="display text-2xl mb-4">Choose a mystery</h2>
      <nav data-guide="presets" aria-label="Comparison presets" className="comparison-presets flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Link
            key={p.id}
            href={`/compare?preset=${p.id}`}
            scroll={false}
            aria-current={preset?.id === p.id ? "true" : undefined}
            className={`text-sm px-3 py-2 rounded-sm border ${
              preset?.id === p.id ? "border-signal text-ink" : "border-rule text-muted hover:text-ink"
            }`}
          >
            {p.title}
          </Link>
        ))}
        <span className={`text-sm px-3 py-2 ${preset ? "text-faint" : "text-ink"}`}>{preset ? "or pick your own below" : "Your own selection"}</span>
      </nav>
      </div>

      {preset && (
        <header>
          <h2 className="display text-2xl sm:text-3xl max-w-[34ch]">{preset.question}</h2>
          <p className="mt-2 text-muted">What changes: {preset.varies}</p>
        </header>
      )}

      {analysis && <ComparePanel a={analysis} />}

      {rows.length === 0 ? (
        <p className="text-muted">Pick two to four tests below to compare them side by side.</p>
      ) : (
        <div className="grid gap-8 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div data-guide="matrix" className="instrument-panel data-table overflow-x-auto">
            <table className="w-full text-[15px]">
              <caption className="sr-only">Conditions and outcomes of the selected tests. Values that differ between tests are highlighted.</caption>
              <thead>
                <tr className="border-b border-rule-strong">
                  <th scope="col" className="text-left text-muted font-normal py-2 pr-4 w-36"></th>
                  {rows.map((e) => (
                    <th key={e.id} scope="col" className="text-left py-2 pr-4 align-bottom">
                      <Link href={e.href} className="display text-lg whitespace-nowrap hover:text-signal">
                        {e.label.replace("BASS-II ", "").replace("BASS ", "")}
                      </Link>
                      {!preset && (
                        <button onClick={() => toggle(e.id)} className="block text-xs text-faint hover:text-ink mt-1" aria-label={`Remove ${e.label}`}>
                          Remove
                        </button>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="num">
                {ROWS.map((r) => {
                  const vals = rows.map(r.get);
                  const differs = new Set(vals).size > 1;
                  return (
                    <tr key={r.label} className="border-b border-rule">
                      <th scope="row" className="text-left text-muted font-normal py-2.5 pr-4">
                        {r.label}
                        {differs && <span className="sr-only"> (differs)</span>}
                      </th>
                      {vals.map((v, i) => (
                        <td key={rows[i].id} className={`py-2.5 pr-4 ${differs ? "text-signal font-medium" : ""}`}>
                          {v}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                <tr className="border-b border-rule">
                  <th scope="row" className="text-left text-muted font-normal py-2.5 pr-4">
                    Outcome
                  </th>
                  {rows.map((e) => (
                    <td key={e.id} className="py-2.5 pr-4 font-semibold">
                      <OutcomeTag outcome={e.outcomeCode} label={e.outcomeLabel} />
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-rule align-top">
                  <th scope="row" className="text-left text-muted font-normal py-2.5 pr-4">
                    NASA notes
                  </th>
                  {rows.map((e) => (
                    <td key={e.id} className="py-2.5 pr-4 text-sm text-muted">
                      {e.note ? `“${e.note}”` : "No comment in table"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" className="text-left text-muted font-normal py-2.5 pr-4">
                    Source
                  </th>
                  {rows.map((e) => (
                    <td key={e.id} className="py-2.5 pr-4">
                      {e.cite ? <Cite sourceId={e.cite.source_id} page={e.cite.pdf_page} where={e.cite.table} /> : "—"}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
            <p className="mt-2 text-xs text-faint">Highlighted values differ between the selected tests.</p>
          </div>
          <div className="bg-panel border border-rule rounded-sm p-3 sm:p-4 self-start">
            {bassIds.length > 0 ? (
              <>
                <FlowO2Plot data={experiments} highlight={bassIds} height={340} label="All BASS-II tests with the compared ones highlighted" />
                <Legend className="mt-2 px-1 text-xs" />
                {bassIds.length < rows.length && <p className="mt-2 px-1 text-xs text-faint">Saffire runs are not on this BASS-II airflow map; see the atmosphere map on the Saffire page.</p>}
              </>
            ) : (
              <AtmosphereMap records={evidenceRecords} />
            )}
          </div>
        </div>
      )}

      {preset && (
        <section data-guide="observed" className="comparison-findings grid gap-4 lg:grid-cols-3" aria-label="What the comparison shows">
          <div className="bg-void p-6">
            <h3 className="font-semibold">Observed</h3>
            <p className="text-xs text-faint mt-1">Recorded in NASA&apos;s tables and reports</p>
            <ul className="mt-4 space-y-3 text-[15px]">
              {preset.observed.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </div>
          <div className="bg-void p-6">
            <h3 className="font-semibold">Interpretation</h3>
            <p className="text-xs text-faint mt-1">Our reading of the evidence, not NASA&apos;s statement</p>
            <p className="mt-4 text-[15px]">{preset.interpretation}</p>
          </div>
          <div className="bg-void p-6">
            <h3 className="font-semibold">Data gaps</h3>
            <p className="text-xs text-faint mt-1">What this comparison cannot tell you</p>
            <ul className="mt-4 space-y-3 text-[15px] text-muted">
              {preset.gaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {quotes.length > 0 && (
        <section>
          <h3 className="display text-xl">Published findings behind this comparison</h3>
          <div className="mt-6 grid gap-x-12 gap-y-8 md:grid-cols-2">
            {quotes.map((f) => (
              <Quote key={f.id} f={f} />
            ))}
          </div>
        </section>
      )}

      <section className="control-desk">
        <h3 className="font-semibold">Pick your own tests</h3>
        <label className="block mt-3 max-w-md">
          <span className="text-sm text-muted">Search by test ID or material</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. B16, Nomex, GMT45, Saffire VI-2"
            className="mt-1 w-full bg-panel border border-rule rounded-sm px-3 py-2"
          />
        </label>
        {matches.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {matches.map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => toggle(e.id)}
                  data-quest="pick-record"
                  className={`text-sm px-3 py-1.5 rounded-sm border ${ids.includes(e.id) && !preset ? "border-signal" : "border-rule hover:border-rule-strong"}`}
                >
                  {e.name} <span className="text-faint">{e.hint}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-faint">Up to {MAX} tests. Adding a test starts a custom comparison.</p>
      </section>
    </div>
  );
}

/** Held constant, changed, recorded; then what the comparison can and cannot support. */
function ComparePanel({ a }: { a: ReturnType<typeof analyze> }) {
  return (
    <section className={styles.panel} aria-label="What this comparison holds constant and what it can tell us">
      {a.crossFamily && (
        <div className={styles.warning} role="note" data-quest="cross-family">
          <strong>Comparability warning</strong>
          <p>These runs come from different experiments: {a.crossFamily.map((f) => `${f.name} (${f.fuel}, ${f.scale}, ${f.platform})`).join("; ")}. They illuminate related fire behaviour but are not replicas. Matching column names do not make the values interchangeable.</p>
        </div>
      )}
      <div className={styles.cols}>
        <div className={styles.col}>
          <h3>Held constant</h3>
          {a.held.length ? (
            <dl>{a.held.map((h) => <div key={h.label}><dt>{h.label}</dt><dd>{h.value}</dd></div>)}</dl>
          ) : <p className={styles.none}>Nothing recorded was the same for every test.</p>}
        </div>
        <div className={`${styles.col} ${styles.changed}`}>
          <h3>Changed</h3>
          {a.changed.length ? a.changed.map((c) => (
            <div key={c.label} className={styles.change}>
              <p>{c.label}</p>
              <ul>{c.values.map((v) => <li key={v.id}><span>{v.label}</span>{v.value}</li>)}</ul>
            </div>
          )) : <p className={styles.none}>No recorded condition changed.</p>}
        </div>
        <div className={`${styles.col} ${styles.recorded}`}>
          <h3>NASA recorded</h3>
          <ul>{a.recorded.map((r) => <li key={r.id} data-group={r.group}><span>{r.label}</span>{r.outcome}</li>)}</ul>
        </div>
      </div>
      <div className={styles.say}>
        <div>
          <h3>What we can say</h3>
          <ul>{a.canSay.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
        <div>
          <h3>What we can&apos;t say</h3>
          <ul>{a.cantSay.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      </div>
    </section>
  );
}
