import Link from "next/link";
import { evidenceRecords } from "@/lib/data";
import styles from "./HomeHero.module.css";

const MIN = 14, MAX = 36;                 // oxygen axis, % by volume
const X0 = 40, X1 = 960, BASE = 168;      // plot area in the 1000 x 236 viewBox
const x = (o2: number) => X0 + ((o2 - MIN) / (MAX - MIN)) * (X1 - X0);
const MOON = { lo: 32.5, hi: 35.5, mid: 34 }; // NASA exploration atmosphere A

/** Stack records that share an oxygen level (to the nearest 0.5 %) so no dot hides another. */
function dots() {
  const stack = new Map<number, number>();
  return evidenceRecords
    .filter((r) => r.oxygen != null)
    .sort((a, b) => a.oxygen! - b.oxygen!)
    .map((r) => {
      const bin = Math.round(r.oxygen! * 2) / 2;
      const n = stack.get(bin) ?? 0;
      stack.set(bin, n + 1);
      return { id: r.id, family: r.family === "saffire" ? "saffire" : "bass", cx: x(bin), cy: BASE - 7 - n * 12 };
    });
}

export function HomeHero() {
  const total = evidenceRecords.length;
  const atMoon = evidenceRecords.filter((r) => r.oxygen != null && r.oxygen >= MOON.lo && r.oxygen <= MOON.hi).length;
  const ticks = [15, 20, 25, 30, 35];

  return (
    <section className={styles.hero} aria-labelledby="hero-title" data-guide="hero">
      <div className={styles.copy}>
        <p className={styles.eyebrow}>MicroFire Atlas · NASA fire evidence for Moon and Mars missions</p>
        <h1 id="hero-title" className={`display ${styles.title}`}>
          {total} NASA fire tests.{" "}
          <span className={styles.accent}>{atMoon === 0 ? "None at Moon-base oxygen." : `${atMoon} at Moon-base oxygen.`}</span>
        </h1>
        <p className={styles.lede}>
          NASA plans Moon habitats with air richer in oxygen than any space-fire test has used. MicroFire Atlas puts every test on one
          map, links every number to its NASA page, and tells you plainly when nothing matches your cabin.
        </p>
        <div className={styles.actions}>
          <Link href="/will-it-burn" className="story-cta">Check a cabin</Link>
          <Link href="/atlas" className={styles.ghost}>Explore the tests</Link>
        </div>
      </div>

      <figure className={styles.chart}>
        <figcaption className={styles.cap}>Every NASA test in the atlas, by oxygen level</figcaption>
        <svg viewBox="0 0 1000 236" role="img" aria-label={`${total} NASA fire tests plotted by oxygen level. They run from 14 to 31 percent. The 34 percent oxygen NASA proposes for Moon habitats has no test.`}>
          <rect x={x(MOON.lo)} y="14" width={x(MOON.hi) - x(MOON.lo)} height={BASE - 14} rx="8" className={styles.window} />
          <text x={x(MOON.mid)} y="48" textAnchor="middle" className={styles.winLabel}>Moon-base air</text>
          <text x={x(MOON.mid)} y="76" textAnchor="middle" className={styles.winBig}>34 %</text>
          <text x={x(MOON.mid)} y="104" textAnchor="middle" className={styles.winLabel}>no test</text>
          <line x1={x(21)} x2={x(21)} y1="30" y2={BASE} className={styles.earth} />
          <text x={x(21)} y="22" textAnchor="middle" className={styles.earthLabel}>Earth air 21 %</text>
          <line x1={X0} x2={X1} y1={BASE} y2={BASE} className={styles.axis} />
          <g className={styles.dots}>
            {dots().map((d) => <circle key={d.id} cx={d.cx} cy={d.cy} r="5" data-family={d.family} />)}
          </g>
          {ticks.map((t) => <text key={t} x={x(t)} y={BASE + 28} textAnchor="middle" className={styles.tickLabel}>{t} %</text>)}
          <text x={(X0 + X1) / 2} y={BASE + 58} textAnchor="middle" className={styles.axisTitle}>Oxygen in the test atmosphere</text>
        </svg>
        <ul className={styles.legend}>
          <li><i data-family="bass" /> BASS and BASS-II, on the space station</li>
          <li><i data-family="saffire" /> Saffire, inside a spacecraft</li>
        </ul>
      </figure>

      <ol className={styles.ways} data-guide="paths">
        <li><Link href="/will-it-burn"><span>1 · Ask</span><strong>Did NASA test a cabin like yours?</strong><small>Burned, mixed, no data. Never a guess.</small></Link></li>
        <li><Link href="/predict"><span>2 · Predict</span><strong>Will the flame keep burning?</strong><small>A model trained on NASA tests and scored on flights it never saw.</small></Link></li>
        <li><Link href="/gaps"><span>3 · See the gaps</span><strong>Where does the evidence stop?</strong><small>The questions no test has answered, and which test comes next.</small></Link></li>
      </ol>
    </section>
  );
}
