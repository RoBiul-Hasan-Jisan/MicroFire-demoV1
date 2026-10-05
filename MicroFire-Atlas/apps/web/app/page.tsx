import Link from "next/link";
import { FlowO2Plot } from "@/components/FlowO2Plot";
import { Legend } from "@/components/Outcome";
import { Cite, Quote } from "@/components/Cite";
import { Chamber } from "@/components/lab/Chamber";
import { HomeHero } from "@/components/home/HomeHero";
import { MissionSelector } from "@/components/home/MissionSelector";
import { EvidenceExperience } from "@/components/home/EvidenceExperience";
import { FrontierMatrix, type MiniRecord } from "@/components/home/FrontierMatrix";
import { MethodStrip } from "@/components/home/MethodStrip";
import { evidenceRecords, experiments, findings, sources } from "@/lib/data";
import { FAMILIES, KIND_LABEL, SOURCE_FAMILY } from "@/lib/ontology";
import s from "@/components/home/Home.module.css";

const FATES = ["bass2-B16", "bass2-B20", "bass2-B19"];
const WHY = ["low-flow-sensitivity", "dim-blue-low-flow", "tiny-flame-undetected", "low-g-burns-lower-o2"];

/**
 * Home: hero → choose a mission → experience the evidence → where it stops → how it works → act.
 * Depth is revealed through tabs, a matrix and a drawer instead of stacked full-width sections.
 */
export default function Home() {
  const byId = new Map(experiments.map((e) => [e.id, e]));
  const fates = FATES.map((id) => byId.get(id)!);
  const mini: MiniRecord[] = evidenceRecords.map((r) => ({
    id: r.id, label: r.label, href: r.href, material: r.material, family: r.family, gravity: r.gravity, o2: r.oxygen,
    kpa: r.pressureKpa ? Math.round(((r.pressureKpa[0] + r.pressureKpa[1]) / 2) * 10) / 10 : null, outcome: r.outcomeLabel,
  }));
  const cards = WHY.map((id) => findings.find((f) => f.id === id)!).map((f) => ({
    id: f.id, meta: `${FAMILIES[SOURCE_FAMILY[f.source_id] ?? "context"].name} · ${KIND_LABEL[f.kind]}`, node: <Quote f={f} />,
  }));

  const compareCopy = (
    <>
      <h3 className={s.consoleTitle}>Same film, near-identical oxygen. Airflow changed, and so did the ending.</h3>
      <p>Three 2-cm, 0.1-mm PMMA films at 16.4–16.5 % oxygen aboard the ISS:</p>
      <ol className={s.fates}>
        {fates.map((e) => <li key={e.id}><Link className="link" href={`/experiments/${e.id}`}>{e.test_id}</Link> <span>{e.flow_initial_cm_s} cm/s start</span> <b>{e.outcome_label}</b></li>)}
      </ol>
      <p className={s.small}>An association across three runs, not proof that airflow alone caused it. <Cite sourceId="bass2-summary" page={111} where="Table A.1 (B16)" />, <Cite sourceId="bass2-summary" page={112} where="Table A.1 (B20, B19)" /></p>
    </>
  );
  const compareStage = (
    <>
      <FlowO2Plot data={experiments} highlight={FATES} height={360} label="BASS tests plotted by oxygen and airflow. Tests B16, B20 and B19 are highlighted." />
      <Legend className="mt-2 px-1" />
    </>
  );
  const explainStage = (
    <>
      <figure><Chamber cfg={{ gravity: "earth", o2: 21, kpa: 101.3, flow: 0, material: "PMMA" }} phase="result" shown={{ visual: "conceptual", group: null, blowoff: false }} compact /><figcaption><b>Earth</b> · hot gas rises: tall, flickering. <em>Conceptual illustration.</em></figcaption></figure>
      <figure><Chamber cfg={{ gravity: "orbit", o2: 16.5, kpa: 101.3, flow: 5, material: "PMMA" }} phase="result" shown={{ visual: "nasa", group: "sustained", blowoff: false }} compact /><figcaption><b>Orbit</b> · NASA test B20 burned the whole sample in forced airflow. <em>Illustration of a NASA outcome.</em></figcaption></figure>
    </>
  );

  return (
    <>
      <HomeHero />
      <MissionSelector oxygen={evidenceRecords.flatMap((r) => (r.oxygen == null ? [] : [{ id: r.id, o2: r.oxygen, family: r.family }]))} />
      <EvidenceExperience compareStage={compareStage} compareCopy={compareCopy} explainStage={explainStage} findings={cards} />
      <FrontierMatrix records={mini} quotes={findings.length} />
      <MethodStrip
        stats={`${evidenceRecords.length} test records, ${findings.length} quoted findings, ${sources.length} NASA documents.`}
        pipeline={[
          { name: "NASA evidence", body: `${evidenceRecords.length} test records, ${findings.length} quoted findings, ${sources.length} NASA documents`, href: "/sources" },
          { name: "Structured retrieval", body: "Searches typed records and checked quotes, never the open web", href: "/methodology#data" },
          { name: "Evidence ranking", body: "Direct, analogous or mechanistic, with a stability check on every rank", href: "/methodology#ladder" },
          { name: "AI synthesis", body: "A language model explains only the evidence it was handed", href: "/challenge#stage-6" },
          { name: "Claim verification", body: "Citations, numbers, units and causal wording checked after generation", href: "/methodology#ai" },
          { name: "Mission interpretation", body: "Your cabin conditions against the closest NASA tests", href: "/mission" },
          { name: "Uncertainty and abstention", body: "Outside the evidence, the system says so and gives no number", href: "/model-lab" },
          { name: "Research gap", body: "The untested condition, written as the next research question", href: "/gaps" },
        ]}
        capabilities={[
          { name: "Evidence retrieval", body: "Find relevant NASA tests across BASS-II, Saffire and LUCI in one search.", href: "/ask", cta: "Ask a question" },
          { name: "AI synthesis", body: "Explain retrieved evidence in plain language. Live synthesis is paused on the public site; a saved answer is re-verified on every build.", href: "/ask#example-title", cta: "See a verified answer" },
          { name: "Claim verification", body: "Every generated claim must cite retrieved evidence and keep its numbers, units and gravity context.", href: "/methodology#evaluate", cta: "Try to fool the checker" },
          { name: "Evidence-bounded ML", body: "A validated model on 41 BASS-II tests that refuses to predict outside the conditions NASA tested.", href: "/model-lab", cta: "Open the Model Lab" },
        ]}
      />
      <section className={s.act} aria-labelledby="act-title">
        <div>
          <h2 id="act-title" className={s.h2}>Investigate deeper</h2>
          <p className={s.sub}>Decades of NASA fire research sit in separate reports. Here a researcher can:</p>
        </div>
        <ul className={s.verbs}>
          {[["Find", "experiments across three NASA families", "/atlas"], ["Compare", "conditions on the same dimensions", "/compare"], ["Trace", "every result to its page", "/sources"], ["Interpret", "without hiding uncertainty", "/mission"], ["Identify", "conditions NASA has not tested", "/gaps"], ["Plan", "the research question with most coverage", "/gaps#evidence-gain"]].map(([v, t, h]) => (
            <li key={v}><Link href={h}><b>{v}</b>{t}</Link></li>
          ))}
        </ul>
        <div className={s.actCtas}>
          <Link href="/challenge" className="story-cta">Enter Challenge Mode</Link>
          <Link href="/lab" className={s.ghostCta}>Open the Flame Lab</Link>
        </div>
      </section>
    </>
  );
}
