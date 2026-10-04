import { FlowO2Plot } from "@/components/FlowO2Plot";
import { HomeHero } from "@/components/HomeHero";
import { HomeDashboard } from "@/components/HomeDashboard";
import { RealFlameReveal } from "@/components/world/RealFlameReveal";
import { Legend } from "@/components/Outcome";
import { Cite } from "@/components/Cite";
import { experiments } from "@/lib/data";

const FATES = ["bass2-B16", "bass2-B20", "bass2-B19"];

/** Home = the dashboard: what we found (summarised), what to test next (ranked), what is unknown (interpreted). */
export default function Home() {
  return (
    <>
      <HomeHero />
      <HomeDashboard />

      <section className="border-y border-rule">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-14 grid gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:items-center">
          <div>
            <h2 className="display text-2xl sm:text-3xl">Every test on one map</h2>
            <p className="mt-3 text-muted">
              Each dot is a real test aboard the ISS, placed by its oxygen level and airflow and coloured by what NASA
              recorded. Select any dot to open its record.
            </p>
            <p className="mt-4 text-sm text-muted">
              Highlighted: the same 2-cm-wide, 0.1-mm PMMA film at about 16.5 % oxygen. The main difference between the runs
              was airflow, and the outcome changed three ways. <Cite sourceId="bass2-summary" page={111} where="Table A.1 (B16)" />,{" "}
              <Cite sourceId="bass2-summary" page={112} where="Table A.1 (B20, B19)" />
            </p>
          </div>
          <div className="bg-panel border border-rule rounded-sm p-3 sm:p-5">
            <FlowO2Plot
              data={experiments}
              highlight={FATES}
              label="Every NASA test in the atlas, plotted by oxygen and airflow. Tests B16, B20 and B19 are highlighted."
            />
            <Legend className="mt-3 px-1" />
            <p className="mt-3 px-1 text-xs text-faint">
              “Burned, end state not stated” means NASA&apos;s test table lists the run but not how it ended. The atlas shows that gap instead of guessing.
            </p>
          </div>
        </div>
      </section>

      <RealFlameReveal />
    </>
  );
}
