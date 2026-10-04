import Link from "next/link";
import { Cite } from "@/components/Cite";
import { evidenceRecords, findings } from "@/lib/data";
import { FRONTIER } from "@/lib/frontier";
import { FAMILIES, SOURCE_FAMILY, TOLERANCE } from "@/lib/ontology";
import type { Finding } from "@/lib/types";
import styles from "./FrontierExtras.module.css";

const F = (id: string) => findings.find((f) => f.id === id)!;
const Q = ({ f }: { f: Finding }) => (
  <p className={styles.q}>“{f.quote}” <Cite sourceId={f.source_id} page={f.pdf_page} /></p>
);

/**
 * FM²'s planned conditions, read from NASA's own abstract: 34 % oxygen at 8.2 psia (56.5 kPa) for the PMMA rods and
 * 21 % at 14.7 psia (101.3 kPa, air) for the SIBAL fabric. No results exist yet, so FM² is never shown as evidence.
 */
const FM2_PLANS = [
  { material: "PMMA", o2: 34, kpa: 56.5 },
  { material: "SIBAL fabric", o2: 21, kpa: 101.3 },
];

export function ResearchHorizon() {
  const rows = FRONTIER.map((fq) => {
    const q = fq.q;
    const plan = FM2_PLANS.find((p) => p.material === q.material && q.oxygen != null && Math.abs(p.o2 - q.oxygen) <= TOLERANCE.oxygen && q.pressureKpa != null && Math.abs(p.kpa - q.pressureKpa) <= TOLERANCE.pressureKpa);
    const why = q.gravity !== "lunar" ? `FM² burns at lunar gravity, not ${q.gravity === "martian" ? "Martian gravity" : "in orbit"}` : !plan ? "FM² plans a different material or atmosphere" : "same material, atmosphere and gravity as an FM² sample";
    return { fq, closes: q.gravity === "lunar" && !!plan, why };
  });
  return (
    <div className={styles.horizon}>
      <div className={styles.hHead}>
        <span className={styles.badge}>Not yet evidence</span>
        <h3 className="display">FM²: Flammability of Materials on the Moon</h3>
        <p>A robotic burn chamber planned for a lander on the Moon. When its results are published, they will be the first fire tests on another world. Until then, MicroFire lists what it will measure, never what it might find.</p>
      </div>
      <div className={styles.hGrid}>
        <div><h4>Planned atmospheres</h4><Q f={F("fm2-atmospheres")} /></div>
        <div><h4>Planned samples</h4><Q f={F("fm2-samples")} /></div>
        <div><h4>What it will measure</h4><Q f={F("fm2-measurements")} /></div>
      </div>
      <h4 className={styles.closeTitle}>Which frontier questions it could answer directly</h4>
      <ul className={styles.closes}>
        {rows.map(({ fq, closes, why }) => (
          <li key={fq.id} data-closes={closes}>
            <span aria-hidden="true">{closes ? "◆" : "◇"}</span>
            <span><strong>{fq.title}</strong> {closes ? "Could gain its first direct evidence" : "Stays open"}: {why}.</span>
            <Link href={`/mission?context=${fq.context}`} className="link text-sm" data-quest="frontier-link">Evidence Ladder</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Spacecraft fire safety is more than flame spread. Coverage per domain, counted from the verified evidence. */
const DOMAINS: { name: string; kid: string; topics: string[]; rows: boolean }[] = [
  { name: "Flame spread", kid: "How fast fire crawls along a material", topics: ["airflow", "geometry", "scale"], rows: true },
  { name: "Extinction", kid: "When and why flames go out", topics: ["quench", "blowoff"], rows: true },
  { name: "Cabin atmosphere", kid: "Oxygen and air pressure", topics: ["oxygen", "pressure"], rows: true },
  { name: "Reduced gravity", kid: "The Moon and Mars", topics: ["partial-gravity"], rows: false },
  { name: "Smoke and detection", kid: "Noticing a fire and the gases it makes", topics: ["smoke", "detection"], rows: false },
  { name: "Material screening", kid: "Which materials NASA rates as safe to fly", topics: ["materials-screening"], rows: false },
  { name: "Suppression", kid: "Putting fires out", topics: ["suppression"], rows: false },
  { name: "Post-fire cleanup", kid: "Cleaning the air afterwards", topics: ["cleanup"], rows: false },
];

export function SafetyMatrix() {
  return (
    <ul className={styles.matrix}>
      {DOMAINS.map((d) => {
        const fs = findings.filter((f) => f.topics.some((t) => d.topics.includes(t)));
        const fams = [...new Set(fs.map((f) => SOURCE_FAMILY[f.source_id]).filter((x) => x && x !== "context"))];
        const level = d.rows && fs.length ? "rows" : fs.length ? "findings" : "none";
        return (
          <li key={d.name} data-level={level}>
            <span className={styles.mLevel}>{level === "rows" ? "Test records and findings" : level === "findings" ? "Findings only" : "Not covered here"}</span>
            <strong>{d.name}</strong>
            <small>{d.kid}</small>
            <span className={styles.mCount}>
              {level === "rows" && <><b>{evidenceRecords.length}</b> records · </>}
              <b>{fs.length}</b> verified finding{fs.length === 1 ? "" : "s"}
            </span>
            {fams.length > 0 && <span className={styles.mFams}>{fams.map((f) => FAMILIES[f!].name).join(", ")}</span>}
          </li>
        );
      })}
    </ul>
  );
}

/** From the 1-g screening test to the Moon: what each step adds, in NASA's words. */
export function GroundVsGravity() {
  const steps: { title: string; kid: string; ids: string[] }[] = [
    { title: "Screened on Earth", kid: "NASA's standard flammability test runs in normal gravity", ids: ["sofie-exploration-atmosphere"] },
    { title: "Burned in orbit", kid: "Without buoyancy, some materials keep burning at lower oxygen", ids: ["low-g-burns-lower-o2"] },
    { title: "Burned in lunar gravity", kid: "Short reduced-gravity tests show surprises", ids: ["sibal-lunar-downward", "lunar-goldilocks"] },
    { title: "Still unknown", kid: "What NASA says is needed next", ids: ["factor-of-safety", "saffire-partial-g-needed"] },
  ];
  return (
    <ol className={styles.chain}>
      {steps.map((s, i) => (
        <li key={s.title}>
          <span className={styles.cNo}>{i + 1}</span>
          <h4>{s.title}</h4>
          <p className={styles.cKid}>{s.kid}</p>
          {s.ids.map((id) => <Q key={id} f={F(id)} />)}
        </li>
      ))}
    </ol>
  );
}
