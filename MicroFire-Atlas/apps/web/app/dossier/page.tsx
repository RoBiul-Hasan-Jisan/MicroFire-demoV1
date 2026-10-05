import type { Metadata } from "next";
import Link from "next/link";
import { DossierActions } from "@/components/dossier/DossierActions";
import { evidenceRecords, experiments, findings } from "@/lib/data";
import { buildDossier, DOSSIER_GRAVITY, DOSSIER_MATERIALS, parseDossier } from "@/lib/dossier";
import { deployedSnapshot } from "@/lib/model-lab";
import type { NextTests } from "@/lib/next-tests";
import nextJson from "@/data/next_experiments.json";
import pressureJson from "@/data/pressure_report.json";
import styles from "@/components/dossier/Dossier.module.css";

export const metadata: Metadata = {
  title: "Scenario Dossier",
  description: "One scenario, five answers: what NASA's tests say, what changes if you change one thing, where the evidence is missing, which test would help, and what it does not say.",
  robots: { index: false },
};

const G_LABEL = { microgravity: "Orbit (microgravity)", lunar: "Moon", martian: "Mars", earth: "Earth" } as const;

export default async function DossierPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { q, change, ignored, fromUrl } = parseDossier(await searchParams);
  const dz = buildDossier(
    { snap: deployedSnapshot(experiments), records: evidenceRecords, findings, next: nextJson as unknown as NextTests, pressure: { n: pressureJson.n_with_pressure, of: pressureJson.n_usable_total } },
    q, change,
  );
  const mod = { ...q, ...change };
  const x = (k: keyof typeof change) => (change[k] === undefined ? "" : String(change[k]));

  return (
    <article className="brief">
      <div className={styles.page}>
        <p className={styles.kicker}>MicroFire Atlas · Scenario Dossier</p>
        <h1 className={styles.title}>{dz.scenario}</h1>
        <p className={styles.lede}>
          One scenario, five answers, in the order a mission planner asks them. Everything below comes from the NASA test records in this atlas and
          the same gated model as the AI Model Lab. Where the evidence stops, the dossier says so instead of guessing.
        </p>
        {!fromUrl && <p className={styles.note}>This is an example scenario. Edit it below; the address bar always holds a link to exactly what you see.</p>}
        {ignored.length > 0 && <p className={styles.note}>Some values in the link were out of range or not recognised and were ignored: {ignored.join(", ")}.</p>}

        <DossierActions markdown={dz.markdown} url={dz.url} />

        <details className={`${styles.edit} brief-actions`} open={!fromUrl}>
          <summary>Edit the scenario</summary>
          <form method="get" action="/dossier">
            <div className={styles.formGrid}>
              <fieldset className={styles.group}>
                <legend>Starting scenario</legend>
                <label>Material<select name="m" defaultValue={q.material}>{DOSSIER_MATERIALS.map((m) => <option key={m}>{m}</option>)}</select></label>
                <label>Gravity<select name="g" defaultValue={q.gravity}>{DOSSIER_GRAVITY.map((g) => <option key={g} value={g}>{G_LABEL[g]}</option>)}</select></label>
                <label>Oxygen (% O₂)<input name="o2" type="number" min={10} max={40} step={0.1} defaultValue={q.o2} /></label>
                <label>Pressure (kPa)<input name="kpa" type="number" min={30} max={110} step={0.1} defaultValue={q.kpa} /></label>
                <label>Starting airflow (cm/s)<input name="flow" type="number" min={0} max={30} step={0.5} defaultValue={q.flow} /></label>
              </fieldset>
              <fieldset className={styles.group}>
                <legend>Change one thing (leave the rest empty)</legend>
                <label>Material<select name="x_m" defaultValue={change.material ?? ""}><option value="">no change</option>{DOSSIER_MATERIALS.map((m) => <option key={m}>{m}</option>)}</select></label>
                <label>Gravity<select name="x_g" defaultValue={change.gravity ?? ""}><option value="">no change</option>{DOSSIER_GRAVITY.map((g) => <option key={g} value={g}>{G_LABEL[g]}</option>)}</select></label>
                <label>Oxygen (% O₂)<input name="x_o2" type="number" min={10} max={40} step={0.1} defaultValue={x("o2")} placeholder={String(mod.o2)} /></label>
                <label>Pressure (kPa)<input name="x_kpa" type="number" min={30} max={110} step={0.1} defaultValue={x("kpa")} placeholder={String(mod.kpa)} /></label>
                <label>Airflow (cm/s)<input name="x_flow" type="number" min={0} max={30} step={0.5} defaultValue={x("flow")} placeholder={String(mod.flow)} /></label>
              </fieldset>
            </div>
            <div className={styles.formFoot}>
              <button type="submit" className={styles.submit}>Build the dossier</button>
              <small>Works without JavaScript. Out-of-range values are ignored, not trusted.</small>
            </div>
          </form>
        </details>

        <div className={styles.sections}>
          {dz.sections.map((s) => (
            <section key={s.n} className={styles.card} data-n={s.n} aria-labelledby={`d-${s.n}`}>
              <div className={styles.cardHead}>
                <span className={styles.num} aria-hidden="true">{s.n}</span>
                <div>
                  <h2 id={`d-${s.n}`}>{s.title}</h2>
                  <p className={styles.headline}>{s.headline}</p>
                </div>
              </div>
              <ul>{s.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
            </section>
          ))}
        </div>

        {dz.trace.length > 0 && (
          <section className={styles.trace} aria-labelledby="d-trace">
            <h2 id="d-trace">Source trace</h2>
            <ul>
              {dz.trace.map((t) => <li key={t.id}><Link className="link" href={`/experiments/${t.id}`}>{t.test}</Link> · {t.source_id}, PDF p. {t.pdf_page}</li>)}
            </ul>
          </section>
        )}

        <nav className={styles.links} aria-label="Go deeper">
          <Link href={`/what-if`}>Explore the what-if live</Link>
          <Link href="/model-lab">How the model is validated</Link>
          <Link href="/next-tests">The research planner</Link>
          <Link href="/gaps">Evidence gaps</Link>
        </nav>
      </div>
    </article>
  );
}
