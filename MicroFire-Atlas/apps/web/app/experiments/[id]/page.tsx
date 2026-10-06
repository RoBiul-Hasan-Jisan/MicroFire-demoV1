import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cite, Quote } from "@/components/Cite";
import { FlowO2Plot } from "@/components/FlowO2Plot";
import { OutcomeTag } from "@/components/Outcome";
import { experiments, FLAG_LABELS, findingsFor, getExperiment, getSource } from "@/lib/data";
import { confidence, rank } from "@/lib/relevance";
import type { Experiment } from "@/lib/types";
import ex from "@/components/ObsExtra.module.css";
import styles from "@/components/AtlasObservatory.module.css";

export function generateStaticParams() {
  return experiments.map((e) => ({ id: e.id }));
}

export async function generateMetadata({ params }: PageProps<"/experiments/[id]">): Promise<Metadata> {
  const e = getExperiment((await params).id);
  return { title: e ? `${e.investigation} test ${e.test_id}` : "Test not found" };
}

const OC: Record<string, string> = { sustained: "#3ddc84", unknown: "#ffb938", extinguished: "#4aa8ff", not_ignited: "#9aa7bd" };
const Gauge = ({ label, v, max, unit, mark, markLabel }: { label: string; v: number | null; max: number; unit: string; mark?: number; markLabel?: string }) => (
  <div className={ex.gauge}>
    <div><span>{label}</span><b>{v == null ? "not stated" : `${v} ${unit}`}</b></div>
    <div className={ex.track}><div className={`${ex.fill} ${ex["w" + Math.round(Math.min(100, ((v ?? 0) / max) * 100))]} ${v == null ? ex.dim : ""}`} />{mark != null && <div className={`${ex.tick} ${ex["l" + Math.round((mark / max) * 100)]}`} />}</div>
    {markLabel && <div className={`${ex.tickl} ${ex["ml" + Math.round(Math.min(80, (mark! / max) * 100))]}`}>{markLabel}</div>}
  </div>
);

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

  const siblings = experiments.filter((o) => o.family === e.family);
  const idx = experiments.findIndex((o) => o.id === e.id);
  const prev = experiments[idx - 1], next = experiments[idx + 1];
  const kpa = e.pressure_kpa ?? (e.pressure_kpa_range ? (e.pressure_kpa_range[0] + e.pressure_kpa_range[1]) / 2 : null);
  const gk = OC[e.outcome_group] ? e.outcome_group : "other";
  return (
    <article className={`explorer-page ${ex.page}`}>
      <p className={ex.crumb}><Link href="/atlas">Atlas</Link> / {e.family}</p>
      <div className={ex.hero}>
        <div>
          <h1 className={ex.title}>{e.investigation} test <em>{e.test_id}</em></h1>
          <p className={`${ex.lead} ${ex.mb0}`}>{e.material_verbatim}, {e.flow_direction} flow, {e.gravity_regime}{e.principal_investigator && <>. Principal investigator: {e.principal_investigator}</>}{e.date && <>. Listed date {e.date}</>}</p>
        </div>
        <span className={`${ex.pill} ${ex["bdc-" + gk]}`}><i className={ex["dot-" + gk]} />{e.outcome_label}</span>
      </div>
      <div className={`${styles.kpis} ${ex.mt18}`}>
        {[[e.oxygen_vol_pct != null ? `${e.oxygen_vol_pct}%` : "—", "Oxygen", "by volume"], [e.flow_initial_cm_s != null ? e.flow_initial_cm_s : "—", "Airflow", e.flow_varied ? "cm/s, changed during test" : "cm/s"], [kpa != null ? Math.round(kpa * 10) / 10 : "—", "Pressure", e.pressure_kpa == null ? "kPa, series range" : "kPa"], [e.thickness_mm != null ? e.thickness_mm : "—", "Thickness", "mm"]].map(([n, l, sub]) => (
          <div key={l as string} className={styles.kpi}><strong>{n}</strong><span>{l}<small>{sub}</small></span></div>))}
      </div>

      <div className={ex.main2}>
        <div className={ex.stack}>
          <section className={styles.panel} data-guide="conditions" aria-labelledby="conditions">
            <h2 id="conditions">Conditions at a glance</h2>
            <Gauge label="Oxygen" v={e.oxygen_vol_pct} max={40} unit="%" mark={20.9} markLabel="21% = normal air" />
            <Gauge label="Starting airflow" v={e.flow_initial_cm_s} max={50} unit="cm/s" />
            <Gauge label="Pressure" v={kpa} max={110} unit="kPa" mark={101.3} markLabel="1 atm" />
            <h3 className={`${ex.m20} ${ex.cSoft} ${ex.f085}`}>Full record, with where each value comes from</h3>
            <dl className={`mt-1 text-[15px] ${ex.dlblock}`}>
              <Row e={e} field="oxygen_vol_pct" label="Oxygen" value={e.oxygen_vol_pct != null ? `${e.oxygen_vol_pct} % by volume` : null} />
              <Row e={e} field="flow_verbatim" label="Airflow as recorded" value={`${e.flow_verbatim}${e.flow_varied ? " (changed during the test)" : ""}`} />
              <Row e={e} field="flow_initial_cm_s" label="Starting airflow" value={e.flow_initial_cm_s != null ? `${e.flow_initial_cm_s} cm/s` : null} />
              {e.flow_final_cm_s != null && <Row e={e} field="flow_final_cm_s" label="Final airflow" value={`${e.flow_final_cm_s} cm/s`} />}
              <Row e={e} field={e.pressure_kpa != null ? "pressure_kpa" : "pressure_kpa_range"} label="Pressure" value={e.pressure_kpa != null ? `${e.pressure_kpa} kPa (1 atm)` : e.pressure_kpa_range ? `${e.pressure_kpa_range[0]}–${e.pressure_kpa_range[1]} kPa` : null} />
              <Row e={e} field="thickness_mm" label="Thickness" value={e.thickness_mm != null ? `${e.thickness_mm} mm` : null} />
              <Row e={e} field="width_mm" label="Width" value={e.width_mm != null ? `${e.width_mm} mm` : null} />
              <Row e={e} field="length_mm" label="Exposed length" value={e.length_mm != null ? `${e.length_mm} mm` : null} />
              <Row e={e} field="outcome" label="Outcome code" value={e.outcome_label} />
            </dl>
          </section>

          <section className={styles.panel} data-guide="notes" aria-labelledby="notes">
            <h2 id="notes">What the crew and ground team wrote</h2>
            {e.observations_verbatim ? <blockquote className={ex.quote}>“{e.observations_verbatim}”</blockquote> : <p className={ex.lead}>NASA&apos;s table has no comment for this test.</p>}
            {e.quality_flags.map((f) => <p key={f} className={ex.caution}>⚠ Caution: {FLAG_LABELS[f] ?? f}</p>)}
          </section>

          {gases && (
            <section className={styles.panel} aria-labelledby="gases">
              <h2 id="gases">Gas readings before and after the burn</h2>
              <div className={`${ex.gas} ${ex.cMuted} ${ex.bt0}`}><span /><span>Initial</span><span>Final</span></div>
              {[["O₂, vol %", e.oxygen_vol_pct, e.oxygen_final_vol_pct], ["CO₂, vol %", ...(e.co2_vol_pct ?? [])], ["CO, ppm", ...(e.co_ppm ?? [])]].map(([k, a, b]) => (
                <div key={String(k)} className={ex.gas}><span className={`${ex.cSoft}`}>{k}</span><b>{a ?? "—"}</b><b>{b ?? "—"}</b></div>))}
              <p className={styles.sub}>Readings of the glovebox work volume, from NASA&apos;s table columns. They describe the enclosure, not the flame.</p>
            </section>
          )}

          {quotes.length > 0 && (
            <section className={styles.panel} aria-labelledby="findings">
              <h2 id="findings">Published findings about this test family</h2>
              <div className="mt-4 space-y-6">
                {quotes.map((f) => (<div key={f.id}><Quote f={f} />{f.experiments_basis && <p className={styles.sub}>Why linked here: {f.experiments_basis}</p>}</div>))}
              </div>
            </section>
          )}
        </div>

        <aside className={ex.stack}>
          {siblings.length > 1 && (
            <section className={styles.panel}>
              <h2>Same test series ({siblings.length})</h2>
              <div className={`${ex.strip} ${ex.mt10}`}>{siblings.map((o) => <Link key={o.id} href={`/experiments/${o.id}`} className={o.id === e.id ? ex.cur : ""}><i className={ex["dot-" + (OC[o.outcome_group] ? o.outcome_group : "other")]} />{o.test_id}</Link>)}</div>
            </section>
          )}
          <section className={styles.panel} aria-labelledby="map">
            <h2 id="map">Where it sits among all tests</h2>
            <div className={`${ex.mt10}`}><FlowO2Plot data={experiments} highlight={[e.id]} height={300} label={`All tests, with ${e.test_id} highlighted`} /></div>
          </section>
          <section className={styles.panel} data-guide="confidence" aria-labelledby="confidence">
            <h2 id="confidence">Evidence confidence: {conf.level}</h2>
            <p className={styles.sub}>A project checklist, not a NASA rating. <Link href="/methodology#confidence" className={`${ex.cBlue}`}>How it works</Link></p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {conf.checks.map((c) => (<li key={c.label} className="flex gap-2"><span aria-hidden="true" className={c.pass ? ex.cGreen : ex.cMuted}>{c.pass ? "✓" : "–"}</span><span className={c.pass ? "" : ex.dim65}><span className="sr-only">{c.pass ? "Yes: " : "No: "}</span>{c.label}</span></li>))}
            </ul>
          </section>
          <section className={styles.panel} aria-labelledby="source">
            <h2 id="source">Source</h2>
            <p className={`${styles.sub} ${ex.cPale}`}>{src.title}</p>
            <p className={styles.sub}>{src.authors.slice(0, 4).join(", ")}{src.authors.length > 4 && " et al."}. NASA {src.document_type?.toLowerCase().replace(/_/g, " ")}, NTRS {src.ntrs_id}</p>
            <p className="mt-2"><Cite sourceId={src.source_id} page={e.provenance.record.pdf_page} where={e.provenance.record.table} /></p>
            <p className={styles.sub}>Transcribed by hand into <code>data/curated/</code>; file SHA-256 {src.sha256?.slice(0, 12)}…</p>
          </section>
          <section className={styles.panel} aria-labelledby="related">
            <h2 id="related">Closest other tests</h2>
            <ul className={ex.list}>{related.map((r) => (<li key={r.experiment.id}><Link href={`/experiments/${r.experiment.id}`}>{r.experiment.test_id}</Link> · {r.experiment.material}, {r.experiment.oxygen_vol_pct}% O₂ <span className={`${ex.fr} ${ex.cMuted}`}>{Math.round(r.score * 100)}</span></li>))}</ul>
            <p className={styles.sub}>Ranked by Mission Relevance against this test&apos;s own conditions.</p>
            <Link href={`/compare?ids=${[e.id, ...related.slice(0, 2).map((r) => r.experiment.id)].join(",")}`} className={styles.cta}>Compare with the two closest →</Link>
          </section>
        </aside>
      </div>
      <div className={ex.nav2}>{prev ? <Link href={`/experiments/${prev.id}`}>← {prev.test_id}</Link> : <span />}{next ? <Link href={`/experiments/${next.id}`}>{next.test_id} →</Link> : <span />}</div>
    </article>
  );
}
