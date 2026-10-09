import Link from "next/link";
import { CinematicWorld } from "@/components/world/CinematicWorld";
import { evidenceRecords, experiments, findings, sources } from "@/lib/data";
import { DEMOS } from "@/lib/judge";
import { deployedSnapshot, gate } from "@/lib/model-lab";
import { ladder } from "@/lib/ontology";
import s from "./Home.module.css";

/**
 * One viewport, no pinned scroll: the purpose, the NASA context, a live answer computed from the records,
 * and the evidence base. The scenery is illustration; the readout is computed from NASA data.
 */
export function HomeHero() {
  const moon = DEMOS.find((d) => d.id === "moon")!;
  const l = ladder(evidenceRecords, findings, moon.q);
  const g = gate(deployedSnapshot(experiments), moon.model);
  const closest = l.analogous[0];
  const families = new Set(evidenceRecords.map((r) => r.family)).size;
  return (
    <section className={s.hero} data-guide="hero" data-home aria-labelledby="hero-title">
      <CinematicWorld world="portal" priority />
      <div className={s.heroInner}>
        <div className={s.heroCopy}>
          <p className={s.kicker}>NASA Space Apps 2026 · Flame in Freefall</p>
          <h1 id="hero-title" className="display">Fire behaves differently<br />when nothing rises.</h1>
          <p className={s.lede}>
            MicroFire Atlas turns NASA&apos;s microgravity combustion tests into traceable evidence for safer spacecraft, and shows exactly where that evidence stops.
          </p>
          <div className={s.heroCtas}>
            <Link href="/challenge" className="story-cta">Enter Challenge Mode</Link>
            <Link href="/atlas" className={s.ghostCta}>Explore the Atlas</Link>
          </div>
          <ul className={s.rail} aria-label="The evidence base">
            <li><Link href="/atlas"><b className="num">{evidenceRecords.length}</b> NASA test records</Link></li>
            <li><Link href="/atlas"><b className="num">{families}</b> experiment families</Link></li>
            <li><Link href="/sources"><b className="num">{findings.length}</b> quotes page-checked</Link></li>
            <li><Link href="/sources"><b className="num">{sources.length}</b> NASA documents</Link></li>
          </ul>
          <p className={s.railNote}>Every value links to its NASA page. Scenery is illustration; the evidence is real.</p>
        </div>

        <aside className={s.readout} aria-labelledby="readout-q">
          <p className={s.readoutKicker}><span className={s.live} aria-hidden="true" />Computed from the NASA records</p>
          <p id="readout-q" className={s.readoutQ}>PMMA in a lunar habitat at {moon.q.oxygen} % O₂ and {moon.q.pressureKpa} kPa</p>
          <dl className={s.readoutGrid}>
            <div><dt>Direct NASA tests</dt><dd className={s.zero}>{l.direct.length}</dd></div>
            <div><dt>Analogous records</dt><dd>{l.analogous.length}</dd></div>
            <div className={s.wide}><dt>Closest</dt><dd>{closest ? <Link className="link" href={closest.record.href}>{closest.record.label}</Link> : "none"}{closest && <small> differs in {closest.differs.map((d) => d.dim).join(", ")}</small>}</dd></div>
            <div className={s.wide}><dt>ML model</dt><dd>{g.status === "out" || g.status === "insufficient" ? "Prediction blocked: outside the evidence" : "In domain"}</dd></div>
          </dl>
          <p className={s.readoutLine}>The honest answer is: no test has burned PMMA there yet.</p>
          <Link href="/tour" className={s.readoutLink}>See three cases in Judge Mode</Link>
        </aside>
      </div>

    </section>
  );
}
