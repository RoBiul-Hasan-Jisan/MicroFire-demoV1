"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Cite, Quote } from "@/components/Cite";
import { FlowO2Plot } from "@/components/FlowO2Plot";
import { Legend, OutcomeTag } from "@/components/Outcome";
import { experiments, findings, getExperiment } from "@/lib/data";
import { PRESETS, getPreset } from "@/lib/presets";
import type { Experiment } from "@/lib/types";

const MAX = 4;

type RowDef = { label: string; get: (e: Experiment) => string };

const ROWS: RowDef[] = [
  { label: "Material", get: (e) => e.material },
  { label: "Thickness", get: (e) => (e.thickness_mm != null ? `${e.thickness_mm} mm` : "not stated") },
  { label: "Width", get: (e) => (e.width_mm != null ? `${e.width_mm} mm` : "not stated") },
  { label: "Flow direction", get: (e) => e.flow_direction },
  { label: "Oxygen", get: (e) => (e.oxygen_vol_pct != null ? `${e.oxygen_vol_pct} %` : "not stated") },
  {
    label: "Airflow",
    get: (e) =>
      e.flow_final_cm_s != null && e.flow_final_cm_s !== e.flow_initial_cm_s
        ? `${e.flow_initial_cm_s} → ${e.flow_final_cm_s} cm/s`
        : `“${e.flow_verbatim}”`,
  },
  { label: "Investigation", get: (e) => e.investigation },
];

export function CompareView() {
  const params = useSearchParams();
  const router = useRouter();
  const preset = getPreset(params.get("preset") ?? "") ?? (params.get("ids") ? undefined : PRESETS[0]);
  const ids = preset?.ids ?? (params.get("ids") ?? "").split(",").filter((id) => getExperiment(id)).slice(0, MAX);
  const rows = ids.map((id) => getExperiment(id)!);
  const [query, setQuery] = useState("");

  const setIds = (next: string[]) => router.replace(`/compare?ids=${next.join(",")}`, { scroll: false });
  const toggle = (id: string) => setIds(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(-MAX));

  const quotes = (preset?.findings ?? []).map((id) => findings.find((f) => f.id === id)!).filter(Boolean);
  const matches = query
    ? experiments.filter((e) => `${e.test_id} ${e.material} ${e.investigation}`.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : [];

  return (
    <div className="space-y-10">
      <nav aria-label="Comparison presets" className="flex flex-wrap gap-2">
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

      {preset && (
        <header>
          <h2 className="display text-2xl sm:text-3xl max-w-[34ch]">{preset.question}</h2>
          <p className="mt-2 text-muted">Main variable that changes: {preset.varies}</p>
        </header>
      )}

      {rows.length === 0 ? (
        <p className="text-muted">Pick two to four tests below to compare them side by side.</p>
      ) : (
        <div className="grid gap-8 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div className="overflow-x-auto">
            <table className="w-full text-[15px]">
              <caption className="sr-only">Conditions and outcomes of the selected tests. Values that differ between tests are highlighted.</caption>
              <thead>
                <tr className="border-b border-rule-strong">
                  <th scope="col" className="text-left text-muted font-normal py-2 pr-4 w-36"></th>
                  {rows.map((e) => (
                    <th key={e.id} scope="col" className="text-left py-2 pr-4 align-bottom">
                      <Link href={`/experiments/${e.id}`} className="display text-lg whitespace-nowrap hover:text-signal">
                        {e.test_id}
                      </Link>
                      {!preset && (
                        <button onClick={() => toggle(e.id)} className="block text-xs text-faint hover:text-ink mt-1" aria-label={`Remove ${e.test_id}`}>
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
                      <OutcomeTag outcome={e.outcome} label={e.outcome_label} />
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-rule align-top">
                  <th scope="row" className="text-left text-muted font-normal py-2.5 pr-4">
                    NASA notes
                  </th>
                  {rows.map((e) => (
                    <td key={e.id} className="py-2.5 pr-4 text-sm text-muted">
                      {e.observations_verbatim ? `“${e.observations_verbatim}”` : "No comment in table"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" className="text-left text-muted font-normal py-2.5 pr-4">
                    Source
                  </th>
                  {rows.map((e) => (
                    <td key={e.id} className="py-2.5 pr-4">
                      <Cite sourceId={e.provenance.record.source_id} page={e.provenance.record.pdf_page} where={e.provenance.record.table} />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
            <p className="mt-2 text-xs text-faint">Highlighted values differ between the selected tests.</p>
          </div>
          <div className="bg-panel border border-rule rounded-sm p-3 sm:p-4 self-start">
            <FlowO2Plot data={experiments} highlight={ids} height={340} label="All tests with the compared ones highlighted" />
            <Legend className="mt-2 px-1 text-xs" />
          </div>
        </div>
      )}

      {preset && (
        <section className="grid gap-px bg-rule border border-rule lg:grid-cols-3" aria-label="What the comparison shows">
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

      <section className="border-t border-rule pt-8">
        <h3 className="font-semibold">Pick your own tests</h3>
        <label className="block mt-3 max-w-md">
          <span className="text-sm text-muted">Search by test ID or material</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. B16, Nomex, GMT45"
            className="mt-1 w-full bg-panel border border-rule rounded-sm px-3 py-2"
          />
        </label>
        {matches.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {matches.map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => toggle(e.id)}
                  className={`text-sm px-3 py-1.5 rounded-sm border ${ids.includes(e.id) && !preset ? "border-signal" : "border-rule hover:border-rule-strong"}`}
                >
                  {e.test_id} <span className="text-faint">{e.material}, {e.oxygen_vol_pct}% O₂</span>
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
