import type { Metadata } from "next";
import { QuestBoard } from "@/components/quest/QuestBoard";
import { FrontierCards } from "@/components/FrontierCards";
import { GroundVsGravity, ResearchHorizon, SafetyMatrix } from "@/components/FrontierExtras";
import { EvidenceSpace } from "@/components/EvidenceSpace";
import { evidenceRecords, findings } from "@/lib/data";
import { RouteStage } from "@/components/world/RouteStage";
import { ResearchPlanning } from "@/components/ResearchPlanning";
import { MISSION_SCENARIOS } from "@/lib/mission-scenarios";
import { buildResearchPlan } from "@/lib/research-planning";

export const metadata: Metadata = { title: "Research Frontier" };

export default async function GapsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const sp=await searchParams;
  const initialScenario=typeof sp.scenario==="string"?sp.scenario:undefined;
  const plan=buildResearchPlan(MISSION_SCENARIOS,evidenceRecords,findings);
  return (
    <div className="explorer-page mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <RouteStage kind="gaps" />
      <div className="mt-6"><QuestBoard page="gaps" crew="tala" /></div>
      <ResearchPlanning key={initialScenario??"all"} plan={plan} initialScenario={initialScenario}/>
      <section className="mt-10" aria-labelledby="frontier">
        <p className="text-signal text-sm">Research Frontier</p>
        <h2 id="frontier" className="display text-3xl mt-2">Where the evidence runs out, and what would push it further</h2>
        <p className="mt-3 text-muted max-w-[78ch]">
          Each card is worked out from every test record in the atlas. A gap is not a verdict of danger or safety: it is a question
          no test has answered yet. The suggested tests are research ideas, not NASA plans.
        </p>
        <div className="mt-8"><FrontierCards /></div>
      </section>

      <section className="mt-16" aria-labelledby="map-title">
        <h2 id="map-title" className="display text-2xl">Combustion Evidence Space</h2>
        <p className="mt-2 text-sm text-muted max-w-[78ch]">
          Every mark is a real NASA test record from BASS/BASS-II, Saffire or LUCI. Nothing is drawn between them. Set a mission condition and the
          box shows whether any test sits close enough to count as direct evidence.
        </p>
        <div id="gaps-tool" className="scroll-mt-20 mt-6">
          <EvidenceSpace />
        </div>
      </section>


      <section className="mt-16" aria-labelledby="horizon">
        <h2 id="horizon" className="display text-2xl">Research horizon</h2>
        <p className="mt-2 text-muted max-w-[78ch]">The next experiment NASA has planned on the Moon, and which of the open questions above it is designed to reach.</p>
        <div className="mt-6"><ResearchHorizon /></div>
      </section>

      <section className="mt-16" aria-labelledby="matrix">
        <h2 id="matrix" className="display text-2xl">Spacecraft fire safety: what this atlas covers</h2>
        <p className="mt-2 text-muted max-w-[78ch]">
          Fire safety is more than how a flame spreads. Each area counts the verified NASA evidence in this atlas. An empty area
          means we have not collected it yet, not that NASA has no work there.
        </p>
        <div className="mt-6"><SafetyMatrix /></div>
      </section>

      <section className="mt-16" aria-labelledby="ground">
        <h2 id="ground" className="display text-2xl">From the Earth test to the Moon</h2>
        <p className="mt-2 text-muted max-w-[78ch]">
          NASA screens materials with a standard test in normal gravity (NASA-STD-6001). Reduced-gravity experiments show why that
          is not the whole story. Every step below is NASA&apos;s own words.
        </p>
        <div className="mt-8"><GroundVsGravity /></div>
      </section>

    </div>
  );
}
