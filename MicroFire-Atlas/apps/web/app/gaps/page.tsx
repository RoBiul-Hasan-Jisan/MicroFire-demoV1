import type { Metadata } from "next";
import { FrontierCards } from "@/components/FrontierCards";
import { GroundVsGravity, ResearchHorizon, SafetyMatrix } from "@/components/FrontierExtras";
import { EvidenceSpace } from "@/components/EvidenceSpace";
import { GapObservatory } from "@/components/GapObservatory";
import { ObsHero } from "@/components/ObsHero";
import { ResearchPlanning } from "@/components/ResearchPlanning";
import ex from "@/components/ObsExtra.module.css";
import styles from "@/components/AtlasObservatory.module.css";
import { evidenceRecords, experiments, findings } from "@/lib/data";
import { gapGrid } from "@/lib/gaps";
import { MISSION_SCENARIOS } from "@/lib/mission-scenarios";
import { buildResearchPlan } from "@/lib/research-planning";

export const metadata: Metadata = { title: "Research Frontier" };

export default async function GapsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const initialScenario = typeof sp.scenario === "string" ? sp.scenario : undefined;
  const plan = buildResearchPlan(MISSION_SCENARIOS, evidenceRecords, findings);
  const grid = gapGrid(experiments), cells = grid.flat();
  const count = (z: string) => cells.filter((c) => c.zone === z).length;
  const S = ({ id, title, lead, children }: { id: string; title: string; lead: string; children: React.ReactNode }) => (
    <section id={id} className={`${styles.panel} ${ex.sec}`}><h2>{title}</h2><p>{lead}</p><div className={`${ex.mt16}`}>{children}</div></section>);
  return (
    <div className={`explorer-page ${ex.page}`}>
      <ObsHero kicker="Research frontier" title={<>Where the evidence <em>runs out</em></>}
        lead="Each view is worked out from every test record in the atlas. A gap is not a verdict of danger or safety: it is a question no test has answered yet. Suggested tests are research ideas, not NASA plans."
        kpis={[[count("observed"), "Well-covered cells", `${3}+ tests each`], [count("sparse"), "Sparse cells", "1–2 tests"], [count("outside"), "Untested cells", "no BASS-II test"], [experiments.length, "BASS-II tests", "in the grid"]]} />
      <nav className={ex.chipnav} aria-label="Sections">{[["research-planning", "Research planning"], ["frontier", "Frontier"], ["gaps-tool", "Evidence space"], ["horizon", "Horizon"], ["matrix", "Safety matrix"], ["ground", "Earth to Moon"]].map(([h, l]) => <a key={h} href={`#${h}`}>{l}</a>)}</nav>
      <GapObservatory grid={grid} />
      <section id="research-planning" className={`${styles.panel} ${ex.sec}`}><ResearchPlanning key={initialScenario ?? "all"} plan={plan} initialScenario={initialScenario} /></section>
      <S id="frontier" title="Where the evidence runs out, and what would push it further" lead="Each card is a question no test has answered yet."><FrontierCards /></S>
      <S id="gaps-tool" title="Combustion Evidence Space" lead="Every mark is a real NASA test record. Nothing is drawn between them. Set a mission condition to see whether any test sits close enough to count as direct evidence."><EvidenceSpace /></S>
      <S id="horizon" title="Research horizon" lead="The next experiment NASA has planned on the Moon, and which open questions it is designed to reach."><ResearchHorizon /></S>
      <S id="matrix" title="Spacecraft fire safety: what this atlas covers" lead="An empty area means we have not collected it yet, not that NASA has no work there."><SafetyMatrix /></S>
      <S id="ground" title="From the Earth test to the Moon" lead="NASA screens materials with a standard test in normal gravity (NASA-STD-6001). Reduced-gravity experiments show why that is not the whole story."><GroundVsGravity /></S>
    </div>
  );
}
