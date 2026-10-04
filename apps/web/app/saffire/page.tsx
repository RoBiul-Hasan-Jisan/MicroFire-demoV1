import type { Metadata } from "next";
import Link from "next/link";
import { AtmosphereMap } from "@/components/AtmosphereMap";
import { Cite, Quote } from "@/components/Cite";
import { CinematicWorld } from "@/components/world/CinematicWorld";
import { evidenceRecords, findings, saffireRuns } from "@/lib/data";
import { SOURCE_FAMILY } from "@/lib/ontology";
import type { SaffireRun } from "@/lib/types";

export const metadata: Metadata = {
  title: "Saffire: fires inside a spacecraft",
  description: "Twenty large-scale fire runs NASA set on purpose inside uncrewed Cygnus cargo ships, every value traced to its NASA table.",
};

const GROUPS: { title: string; flights: string[]; blurb: string }[] = [
  { title: "Saffire 1 and 2 (Saffire I to III flew in 2016 and 2017)", flights: ["Saffire-1", "Saffire-2"], blurb: "One wide cotton-fiberglass sheet burned for seven minutes, then nine small samples, including a material rated \"safe\" on Earth." },
  { title: "Saffire IV and V (2020 to 2021)", flights: ["Saffire-IV", "Saffire-V"], blurb: "Thick fuels and longer burns, and the first runs at lower pressure with more oxygen." },
  { title: "Saffire VI", flights: ["Saffire-VI"], blurb: "Pressure near 55 kPa and oxygen near 30 %, the closest any test in this atlas gets to proposed Moon-base air." },
];

const OUTCOME_COLOR: Record<SaffireRun["outcome_group"], string> = {
  sustained: "text-flame",
  extinguished: "text-quench",
  not_ignited: "text-[#93a0bb]",
  unknown: "text-faint",
};

const fmt = (v: number | null, unit: string) => (v == null ? "not stated" : `${v} ${unit}`);

export default function SaffirePage() {
  const saffireFindings = findings.filter((f) => SOURCE_FAMILY[f.source_id] === "saffire" && f.source_id !== "confinement");
  const largest = saffireRuns.find((r) => r.id === "saffire-1-1")!;
  const lowest = saffireRuns.filter((r) => r.pressure_kpa != null).sort((a, b) => a.pressure_kpa! - b.pressure_kpa!)[0];
  return (
    <div className="explorer-page">
      <section className="relative isolate overflow-hidden border-b border-rule">
        <CinematicWorld world="portal" />
        <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
          <p className="text-signal text-sm">Experiment family · large-scale fires</p>
          <h1 className="display text-4xl sm:text-6xl mt-3 max-w-[16ch]">Real fires inside a spacecraft.</h1>
          <p className="mt-5 max-w-[60ch] text-lg text-[#d3e1ee]">
            After a Cygnus cargo ship left the space station, empty of crew, NASA lit fires inside it on purpose and watched them
            spread. NASA calls Saffire the first time a large-scale fire was set on purpose inside a spacecraft in orbit.
          </p>
          <dl className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl">
            {[
              [String(saffireRuns.length), "runs, each from a NASA table"],
              [`${largest.width_cm} × ${largest.length_cm} cm`, "largest sample (Saffire 1)"],
              [`${lowest.pressure_kpa} kPa`, `lowest pressure (${lowest.sample})`],
              ["3", "NASA documents, every value cited"],
            ].map(([n, l]) => (
              <div key={l} className="rounded-xl border border-rule-strong bg-[#0b1626cc] px-4 py-3">
                <dt className="display text-2xl text-flame">{n}</dt>
                <dd className="text-xs text-muted mt-1">{l}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-xs text-faint">Background scenery is an illustration. Every number on this page comes from NASA.</p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 space-y-16">
        <section aria-labelledby="atm" className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] items-start">
          <div className="rounded-2xl border border-rule bg-panel p-4">
            <AtmosphereMap records={evidenceRecords} />
          </div>
          <div>
            <h2 id="atm" className="display text-3xl">How close does the evidence get to Moon-base air?</h2>
            <p className="mt-4 text-[17px] leading-relaxed">
              Every BASS-II test ran near sea-level pressure. Saffire IV to VI lowered the pressure and raised the oxygen. Saffire VI
              reached about 55 kPa with 29 to 31 % oxygen: close to NASA&apos;s proposed 34 % at 56.5 kPa, but still not there, and
              still in microgravity, not lunar gravity.
            </p>
            <p className="mt-4 text-muted">
              That is why the <Link href="/mission?context=moon-base" className="link">Evidence Ladder</Link> calls Saffire VI the
              closest <em>analogous</em> evidence, never <em>direct</em> evidence.
            </p>
          </div>
        </section>

        <section aria-labelledby="why-different" className="rounded-2xl border border-rule bg-panel p-6">
          <h2 id="why-different" className="display text-2xl">Why Saffire is kept separate from BASS-II</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-3 text-[15px]">
            <li><strong className="text-flame">Scale.</strong> Samples up to 94 cm long, against 10 cm or less in BASS-II.</li>
            <li><strong className="text-flame">Place.</strong> A flow unit inside a cargo ship, not a glovebox duct on the station.</li>
            <li><strong className="text-flame">Air.</strong> Pressure and oxygen were changed for later flights; BASS-II stayed near 1 atm.</li>
          </ul>
          <p className="mt-4 text-sm text-muted">The atlas compares the two families on shared dimensions, but never merges their rows into one table.</p>
        </section>

        {GROUPS.map((g) => (
          <section key={g.title} aria-labelledby={g.title}>
            <h2 id={g.title} className="display text-2xl">{g.title}</h2>
            <p className="mt-2 text-muted max-w-[70ch]">{g.blurb}</p>
            <ul className="mt-5 grid gap-4 md:grid-cols-2">
              {saffireRuns.filter((r) => g.flights.includes(r.flight)).map((r) => (
                <li key={r.id} id={r.id} className="scroll-mt-24 rounded-2xl border border-rule bg-panel p-5 target:border-signal">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-lg font-semibold">Sample {r.sample} · {r.material_verbatim}</h3>
                    <span className={`text-sm font-semibold ${OUTCOME_COLOR[r.outcome_group]}`}>{r.outcome_label}</span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
                    <div><dt className="text-faint text-xs">Size</dt><dd>{r.width_cm ? `${r.width_cm} × ` : ""}{fmt(r.length_cm, "cm")}</dd></div>
                    <div><dt className="text-faint text-xs">Thickness</dt><dd>{fmt(r.thickness_mm, "mm")}</dd></div>
                    <div><dt className="text-faint text-xs">Airflow</dt><dd>{r.flow_cm_s == null ? "not stated" : `${r.flow_cm_s} cm/s ${r.flow_direction}`}</dd></div>
                    <div><dt className="text-faint text-xs">Pressure</dt><dd>{fmt(r.pressure_kpa, "kPa")}</dd></div>
                    <div><dt className="text-faint text-xs">Oxygen</dt><dd>{r.o2_pct == null ? "not stated" : `${r.o2_basis === "recorded" ? "" : "~"}${r.o2_pct} %`}</dd></div>
                    <div><dt className="text-faint text-xs">Burn time</dt><dd>{fmt(r.burn_duration_s, "s")}</dd></div>
                    {r.spread_rate_mm_s != null && <div><dt className="text-faint text-xs">Spread rate</dt><dd>{r.spread_rate_mm_s} mm/s</dd></div>}
                    {(r.heat_release_avg_w ?? r.heat_release_peak_w) != null && (
                      <div><dt className="text-faint text-xs">Heat release</dt><dd>{r.heat_release_avg_w ? `${r.heat_release_avg_w.toLocaleString("en-US")} W avg` : `${r.heat_release_peak_w!.toLocaleString("en-US")} W peak`}</dd></div>
                    )}
                    {r.one_g && <div><dt className="text-faint text-xs">Same sample on Earth</dt><dd>burned {r.one_g.burn_length.replace("~ ", "~")}</dd></div>}
                  </dl>
                  {r.provenance.outcome && <blockquote className="mt-4 border-l-2 border-flame/60 pl-3 text-[15px]">“{r.provenance.outcome.quote}”</blockquote>}
                  <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                    {r.provenance.conditions && <Cite sourceId={r.provenance.conditions.source_id} page={r.provenance.conditions.pdf_page} where={r.provenance.conditions.table} />}
                    {r.provenance.results && <Cite sourceId={r.provenance.results.source_id} page={r.provenance.results.pdf_page} where={r.provenance.results.table} />}
                    {r.provenance.outcome && <Cite sourceId={r.provenance.outcome.source_id} page={r.provenance.outcome.pdf_page} />}
                    {r.provenance.thickness && <Cite sourceId={r.provenance.thickness.source_id} page={r.provenance.thickness.pdf_page} where="thickness" />}
                  </p>
                  {r.notes.length > 0 && (
                    <ul className="mt-3 space-y-1 text-xs text-muted">
                      {r.notes.map((n) => <li key={n}>{n}</li>)}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section aria-labelledby="sf">
          <h2 id="sf" className="display text-2xl">What NASA concluded</h2>
          <ul className="mt-5 grid gap-6 md:grid-cols-2">
            {saffireFindings.map((f) => (
              <li key={f.id} className="rounded-2xl border border-rule bg-panel p-5"><Quote f={f} /></li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
