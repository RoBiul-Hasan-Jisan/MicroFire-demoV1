import Link from "next/link";
import { CREW, type CrewId } from "@/lib/guide";
import styles from "./RouteStage.module.css";
import { CinematicWorld } from "./CinematicWorld";

type Kind = "atlas" | "analyze" | "compare" | "mission" | "gaps" | "ask";

const SCENES: Record<Kind, { crew: CrewId; place: string; title: string; line: string; action: string; href: string; prompt: string }> = {
  atlas: { crew: "mei", place: "The evidence observatory", title: "Find a real flame test.", line: "Every point is a recorded test. Choose one and see the crew's result, conditions, and NASA source.", action: "Explore the test map", href: "#atlas-tool", prompt: "Pick a point. What did the crew see?" },
  analyze: { crew: "kofi", place: "The observation station", title: "Can you spot the flame?", line: "Watch real NASA media. Then compare the original frame with the computer's measured outline.", action: "Choose real footage", href: "#analyze-tool", prompt: "Look closely. The outline is computed in pixels." },
  compare: { crew: "mei", place: "The comparison bench", title: "Two tests. One mystery.", line: "Compare near-matched conditions, check every difference, and inspect what NASA recorded.", action: "Compare the tests", href: "#compare-tool", prompt: "What changed between the runs?" },
  mission: { crew: "kofi", place: "The mission desk", title: "Find the closest evidence.", line: "Describe a crew cabin. We'll rank real tests by similarity and show how much each test reports.", action: "Set up a scenario", href: "#mission-tool", prompt: "A close match is evidence, not a safety prediction." },
  gaps: { crew: "tala", place: "The frontier map", title: "Find the blank spaces.", line: "A blank part of the map is a question scientists have not answered in this atlas.", action: "Investigate a gap", href: "#gaps-tool", prompt: "Where does our evidence stop?" },
  ask: { crew: "mei", place: "The question room", title: "Ask the evidence.", line: "Ask about a flame test. The answer will show its NASA sources or say what we do not know.", action: "Ask a question", href: "#ask-tool", prompt: "Every useful answer leads back to a source." },
};

export function RouteStage({ kind, mediaPoster, mediaHref }: { kind: Kind; mediaPoster?: string; mediaHref?: string }) {
  const scene = SCENES[kind];
  const crew = CREW[scene.crew];
  return (
    <section className={styles.stage} data-kind={kind} aria-labelledby={`${kind}-title`}>
      <CinematicWorld world={kind === "mission" ? "moon" : kind === "atlas" || kind === "gaps" || kind === "ask" ? "constellation" : "lab"} />
      <div className={styles.copy}>
        <p className={styles.place}>{scene.place}</p>
        <h1 id={`${kind}-title`} className={`display ${styles.title}`}>{scene.title}</h1>
        <p className={styles.line}>{scene.line}</p>
        <a href={scene.href} className={styles.action}>{scene.action} <span aria-hidden="true">↗</span></a>
      </div>

      <div className={styles.world} aria-label={kind === "analyze" ? "NASA media preview" : "Illustrated mission scene"}>
        {kind === "atlas" && <div className={styles.constellation}>
          <span className={styles.orbit} aria-hidden="true" />
          <Link href="/experiments/bass2-B16" className={styles.starA}>B16</Link>
          <Link href="/experiments/bass2-B20" className={styles.starB}>B20</Link>
          <Link href="/experiments/bass2-B19" className={styles.starC}>B19</Link>
        </div>}
        {kind === "analyze" && mediaPoster && mediaHref && <Link href={mediaHref} className={styles.film} aria-label="Open NASA media in Flame Vision">
          {/* eslint-disable-next-line @next/next/no-img-element -- local NASA media poster */}
          <img src={mediaPoster} alt="NASA combustion media preview" />
          <span className={styles.play} aria-hidden="true">▶</span>
          <span className={styles.visualLabel}>Real NASA media</span>
        </Link>}
        {kind === "compare" && <Link href="/compare?preset=pmma-flow-window#compare-tool" className={styles.pair} aria-label="Compare real tests B16, B20 and B19">
          <span>B16</span><span className={styles.pairMiddle}>B20</span><span>B19</span>
          <small>Similar film and oxygen · different airflow</small>
        </Link>}
        {kind === "mission" && <div className={styles.scope} aria-hidden="true"><span>oxygen</span><span>airflow</span><span>material</span><b>closest<br />evidence</b></div>}
        {kind === "gaps" && <div className={styles.gapMap} aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /><span /><span /><b>?</b></div>}
        {kind === "ask" && <div className={styles.askGlow} aria-hidden="true"><span>?</span><i /><i /><i /></div>}
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element -- original illustrated character */}
      <img src={crew.img} alt="" className={styles.crew} decoding="async" />
      <p className={styles.guide}><strong>{crew.name}</strong> · {scene.prompt}</p>
    </section>
  );
}
