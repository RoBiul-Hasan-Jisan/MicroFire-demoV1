import type { Metadata } from "next";
import { QuestBoard } from "@/components/quest/QuestBoard";
import { Cite, Quote } from "@/components/Cite";
import { FrontierCards } from "@/components/FrontierCards";
import { GroundVsGravity, ResearchHorizon, SafetyMatrix } from "@/components/FrontierExtras";
import { GapMap } from "@/components/GapMap";
import { evidenceRecords, findings, saffireRuns } from "@/lib/data";
import { RouteStage } from "@/components/world/RouteStage";

export const metadata: Metadata = { title: "Research Frontier" };

const GAP_QUOTES = ["luci-first-lunar", "luci-fm2", "low-g-burns-lower-o2", "exploration-atmosphere", "saffire-vs-bass", "saffire-partial-g-needed"];

export default function GapsPage() {
  const quotes = GAP_QUOTES.map((id) => findings.find((f) => f.id === id)!);
  return (
    <div className="explorer-page mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <RouteStage kind="gaps" />
      <div className="mt-6"><QuestBoard page="gaps" crew="tala" /></div>
      <section className="mt-10" aria-labelledby="frontier">
        <p className="text-signal text-sm">Research Frontier</p>
        <h2 id="frontier" className="display text-3xl mt-2">Where the evidence runs out, and what would push it further</h2>
        <p className="mt-3 text-muted max-w-[78ch]">
          Each card is worked out from every test record in the atlas. A gap is not a verdict of danger or safety: it is a question
          no test has answered yet. The suggested tests are research ideas, not NASA plans.
        </p>
        <div className="mt-8"><FrontierCards /></div>
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

      <section className="mt-20" aria-labelledby="map-title">
        <h2 id="map-title" className="display text-2xl">The BASS-II oxygen and airflow map</h2>
        <p className="mt-2 text-sm text-muted max-w-[78ch]">
          Dense cells are well observed; dashed cells have no BASS-II test at all. Saffire runs sit on a different map, by pressure and
          oxygen, on the <a href="/saffire" className="link">Saffire page</a>.
        </p>
        <div id="gaps-tool" className="scroll-mt-20 mt-6">
          <GapMap />
        </div>
      </section>

      <section className="mt-20">
        <h2 className="display text-2xl">Gaps across the whole atlas</h2>
        <dl className="mt-6 grid gap-px bg-rule border border-rule md:grid-cols-2 lg:grid-cols-4">
          {[
            ["Gravity", `All ${evidenceRecords.length} test records ran in microgravity. Lunar and Martian results exist only as reported findings, not test rows.`],
            ["Pressure", `BASS-II ran near 1 atm. Saffire IV to VI went down to ${Math.min(...saffireRuns.filter((r) => r.pressure_kpa != null).map((r) => r.pressure_kpa!))} kPa. NASA's proposed exploration atmosphere is 56.5 kPa with 34 % oxygen.`],
            ["Materials", `${[...new Set(evidenceRecords.map((r) => r.material))].join(", ")}. Real cabins hold many more.`],
            ["Scale", `From a ${Math.min(...evidenceRecords.filter((r) => r.sizeCm).map((r) => r.sizeCm!))} cm strip to a ${Math.max(...evidenceRecords.filter((r) => r.sizeCm).map((r) => r.sizeCm!))} cm sheet. NASA reports that larger Saffire burns spread more slowly than small-duct tests of the same fabric.`],
          ].map(([k, v]) => (
            <div key={k} className="bg-void p-6">
              <dt className="font-semibold">{k}</dt>
              <dd className="mt-2 text-[15px] text-muted">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-16">
        <h2 className="display text-2xl">What NASA says about the edges of this evidence</h2>
        <div className="mt-8 grid gap-x-12 gap-y-10 md:grid-cols-2">
          {quotes.map((f) => (
            <Quote key={f.id} f={f} />
          ))}
        </div>
        <p className="mt-8 text-sm text-muted">
          Lunar and Martian results exist in NASA&apos;s reports as findings; they are not test-level rows here.{" "}
          <Cite sourceId="partial-g" />, <Cite sourceId="luci" />
        </p>
      </section>
    </div>
  );
}
