import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cite, Quote } from "@/components/Cite";
import { FlowO2Plot } from "@/components/FlowO2Plot";
import { OutcomeTag } from "@/components/Outcome";
import { experiments, FLAG_LABELS, findingsFor, getExperiment, getSource } from "@/lib/data";
import { confidence, rank } from "@/lib/relevance";
import type { Experiment } from "@/lib/types";

export function generateStaticParams() {
  return experiments.map((e) => ({ id: e.id }));
}

export async function generateMetadata({ params }: PageProps<"/experiments/[id]">): Promise<Metadata> {
  const e = getExperiment((await params).id);
  return { title: e ? `${e.investigation} test ${e.test_id}` : "Test not found" };
}

type Basis = "observed" | "series" | "derived" | "missing";

const BASIS_TEXT: Record<Basis, string> = {
  observed: "Recorded for this test",
  series: "Stated for the whole test series",
  derived: "Derived by MicroFire Atlas",
  missing: "Not stated in the source",
};

function basisOf(e: Experiment, field: string, value: unknown): Basis {
  if (value == null) return "missing";
  if (field in e.provenance.series) return "series";
  if (field in e.provenance.derived) return "derived";
  return "observed";
}

function Row({ e, field, label, value }: { e: Experiment; field: string; label: string; value: string | null }) {
  const basis = basisOf(e, field, value);
  const series = e.provenance.series[field];
  const derived = e.provenance.derived[field];
  return (
    <div className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-4 py-3 border-b border-rule">
      <dt className="text-muted">{label}</dt>
      <dd>
        <span className={basis === "missing" ? "text-faint" : "num"}>{value ?? "Not stated"}</span>
        <span className="block text-xs text-faint mt-0.5">
          {BASIS_TEXT[basis]}
          {series && (
            <>
              {": "}“{series.quote}” <Cite sourceId={series.source_id} page={series.pdf_page} where={`§${series.section}`} className="!text-xs" />
              {series.note && <span className="block">{series.note}</span>}
            </>
          )}
          {derived && basis === "derived" && <span className="block">{derived}</span>}
          {e.provenance.notes[field] && <span className="block">{e.provenance.notes[field]}</span>}
        </span>
      </dd>
    </div>
  );
}

export default async function ExperimentPage({ params }: PageProps<"/experiments/[id]">) {
  const e = getExperiment((await params).id);
  if (!e) notFound();

  const src = getSource(e.provenance.record.source_id)!;
  const conf = confidence(e, experiments);
  const related = rank(
    experiments.filter((o) => o.id !== e.id),
    {
      oxygen: e.oxygen_vol_pct ?? undefined,
      flow: e.flow_initial_cm_s ?? undefined,
      material: e.material,
      flowDirection: e.flow_direction,
      thicknessMm: e.thickness_mm ?? undefined,
      widthMm: e.width_mm ?? undefined,
    },
  ).slice(0, 5);
  const quotes = findingsFor(e);
  const gases = e.co2_vol_pct && e.co2_vol_pct.some((v) => v != null);

  return (
    <article className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <p className="text-sm text-muted">
        <Link href="/atlas" className="link">
          Atlas
        </Link>{" "}
        / {e.family}
      </p>
      <header className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <h1 className="display text-4xl sm:text-5xl">
            {e.investigation} test {e.test_id}
          </h1>
          <p className="mt-3 text-muted">
            {e.material_verbatim}, {e.flow_direction} flow, {e.gravity_regime}
            {e.principal_investigator && <>. Principal investigator: {e.principal_investigator}</>}
            {e.date && <>. Listed date {e.date}</>}
          </p>
        </div>
        <p className="text-lg font-semibold">
          <OutcomeTag outcome={e.outcome} label={e.outcome_label} />
        </p>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="space-y-12">
          <section aria-labelledby="conditions">
            <h2 id="conditions" className="display text-xl">
              Conditions and sample
            </h2>
            <dl className="mt-3 text-[15px]">
              <Row e={e} field="oxygen_vol_pct" label="Oxygen" value={e.oxygen_vol_pct != null ? `${e.oxygen_vol_pct} % by volume` : null} />
              <Row e={e} field="flow_verbatim" label="Airflow as recorded" value={`${e.flow_verbatim}${e.flow_varied ? " (changed during the test)" : ""}`} />
              <Row e={e} field="flow_initial_cm_s" label="Starting airflow" value={e.flow_initial_cm_s != null ? `${e.flow_initial_cm_s} cm/s` : null} />
              {e.flow_final_cm_s != null && <Row e={e} field="flow_final_cm_s" label="Final airflow" value={`${e.flow_final_cm_s} cm/s`} />}
              <Row
                e={e}
                field={e.pressure_kpa != null ? "pressure_kpa" : "pressure_kpa_range"}
                label="Pressure"
                value={e.pressure_kpa != null ? `${e.pressure_kpa} kPa (1 atm)` : e.pressure_kpa_range ? `${e.pressure_kpa_range[0]}–${e.pressure_kpa_range[1]} kPa` : null}
              />
              <Row e={e} field="thickness_mm" label="Thickness" value={e.thickness_mm != null ? `${e.thickness_mm} mm` : null} />
              <Row e={e} field="width_mm" label="Width" value={e.width_mm != null ? `${e.width_mm} mm` : null} />
              <Row e={e} field="length_mm" label="Exposed length" value={e.length_mm != null ? `${e.length_mm} mm` : null} />
              <Row e={e} field="outcome" label="Outcome code" value={e.outcome_label} />
            </dl>
          </section>

          <section aria-labelledby="notes">
            <h2 id="notes" className="display text-xl">
              What the crew and ground team wrote
            </h2>
            {e.observations_verbatim ? (
              <blockquote className="mt-4 border-l-2 border-flame pl-5 text-lg">“{e.observations_verbatim}”</blockquote>
            ) : (
              <p className="mt-4 text-muted">NASA&apos;s table has no comment for this test.</p>
            )}
            {e.quality_flags.length > 0 && (
              <ul className="mt-4 space-y-1 text-sm">
                {e.quality_flags.map((f) => (
                  <li key={f} className="text-flame">
                    Caution: {FLAG_LABELS[f] ?? f}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {gases && (
            <section aria-labelledby="gases">
              <h2 id="gases" className="display text-xl">
                Gas readings before and after the burn
              </h2>
              <table className="mt-4 text-[15px] num condensed">
                <thead className="text-muted">
                  <tr>
                    <th className="text-left pr-8 font-medium py-1"></th>
                    <th className="text-left pr-8 font-medium">Initial</th>
                    <th className="text-left font-medium">Final</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["O₂, vol %", e.oxygen_vol_pct, e.oxygen_final_vol_pct],
                    ["CO₂, vol %", ...(e.co2_vol_pct ?? [])],
                    ["CO, ppm", ...(e.co_ppm ?? [])],
                  ].map(([k, a, b]) => (
                    <tr key={String(k)} className="border-t border-rule">
                      <th scope="row" className="text-left text-muted font-normal pr-8 py-1.5">
                        {k}
                      </th>
                      <td className="pr-8">{a ?? "—"}</td>
                      <td>{b ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-faint">
                Readings of the glovebox work volume, from NASA&apos;s table columns. They describe the enclosure, not the flame.
              </p>
            </section>
          )}

          {quotes.length > 0 && (
            <section aria-labelledby="findings">
              <h2 id="findings" className="display text-xl">
                Published findings about this test family
              </h2>
              <div className="mt-6 space-y-8">
                {quotes.map((f) => (
                  <div key={f.id}>
                    <Quote f={f} />
                    {f.experiments_basis && <p className="mt-2 text-xs text-faint">Why linked here: {f.experiments_basis}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-10">
          <section aria-labelledby="source" className="bg-panel border border-rule rounded-sm p-5">
            <h2 id="source" className="font-semibold">
              Source
            </h2>
            <p className="mt-2 text-sm text-muted">{src.title}</p>
            <p className="mt-1 text-sm text-faint">
              {src.authors.slice(0, 4).join(", ")}
              {src.authors.length > 4 && " et al."}. NASA {src.document_type?.toLowerCase().replace(/_/g, " ")}, NTRS {src.ntrs_id}
            </p>
            <p className="mt-3">
              <Cite
                sourceId={src.source_id}
                page={e.provenance.record.pdf_page}
                where={e.provenance.record.table}
              />
            </p>
            <p className="mt-3 text-xs text-faint">
              Transcribed by hand into <code>data/curated/</code>; file SHA-256 {src.sha256?.slice(0, 12)}…
            </p>
          </section>

          <section aria-labelledby="confidence">
            <h2 id="confidence" className="font-semibold">
              Evidence confidence: {conf.level}
            </h2>
            <p className="text-xs text-faint mt-1">
              A project checklist, not a NASA rating.{" "}
              <Link href="/methodology#confidence" className="link">
                How it works
              </Link>
            </p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {conf.checks.map((c) => (
                <li key={c.label} className="flex gap-2">
                  <span aria-hidden="true" className={c.pass ? "text-signal" : "text-faint"}>
                    {c.pass ? "✓" : "–"}
                  </span>
                  <span className={c.pass ? "" : "text-muted"}>
                    <span className="sr-only">{c.pass ? "Yes: " : "No: "}</span>
                    {c.label}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="map">
            <h2 id="map" className="font-semibold">
              Where it sits among all tests
            </h2>
            <div className="mt-3 bg-panel border border-rule rounded-sm p-2">
              <FlowO2Plot data={experiments} highlight={[e.id]} height={300} label={`All tests, with ${e.test_id} highlighted`} />
            </div>
          </section>

          <section aria-labelledby="related">
            <h2 id="related" className="font-semibold">
              Closest other tests
            </h2>
            <ol className="mt-3 text-sm divide-y divide-rule border-y border-rule">
              {related.map((r) => (
                <li key={r.experiment.id} className="py-2 flex items-center justify-between gap-3">
                  <Link href={`/experiments/${r.experiment.id}`} className="link">
                    {r.experiment.test_id}
                  </Link>
                  <span className="text-muted flex-1 truncate">
                    {r.experiment.material}, {r.experiment.oxygen_vol_pct}% O₂
                  </span>
                  <span className="num text-faint">{Math.round(r.score * 100)}</span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-faint">Ranked by Mission Relevance against this test&apos;s own conditions.</p>
            <Link href={`/compare?ids=${[e.id, ...related.slice(0, 2).map((r) => r.experiment.id)].join(",")}`} className="link text-sm mt-3 inline-block">
              Compare with the two closest
            </Link>
          </section>
        </aside>
      </div>
    </article>
  );
}
