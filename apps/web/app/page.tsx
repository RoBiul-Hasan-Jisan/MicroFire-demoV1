import Link from "next/link";
import { FlowO2Plot } from "@/components/FlowO2Plot";
import { SparkJourney } from "@/components/world/CinematicWorld";
import { RealFlameReveal } from "@/components/world/RealFlameReveal";
import { HomePaths } from "@/components/HomePaths";
import { Legend } from "@/components/Outcome";
import { Cite, Quote } from "@/components/Cite";
import { evidenceRecords, experiments, findings, saffireRuns, sources } from "@/lib/data";

const FATES = ["bass2-B16", "bass2-B20", "bass2-B19"];
const WHY = ["low-flow-sensitivity", "dim-blue-low-flow", "tiny-flame-undetected", "low-g-burns-lower-o2"];

const STEPS = [
  {
    title: "Read NASA's own test tables",
    body: "Each record is typed from a published NASA test matrix, with the original units and the crew's notes kept word for word.",
  },
  {
    title: "Check every number and quote",
    body: "Units are converted by tested code. Every quoted finding is matched against the source text at build time and fails the build if it isn't there.",
  },
  {
    title: "Sort the evidence for your mission",
    body: "Mission Evidence places every test on the Evidence Ladder (direct, analogous or mechanistic) and names what is missing.",
  },
  {
    title: "Interpret with citations",
    body: "Summaries quote NASA findings and link to the PDF page. Where no test covers your conditions, the site says so.",
  },
];

export default function Home() {
  const why = WHY.map((id) => findings.find((f) => f.id === id)!);
  const materials = new Set(evidenceRecords.map((r) => r.material)).size;

  return (
    <>
      <SparkJourney />
      <HomePaths />
      <RealFlameReveal />
      <section className="home-learn mx-auto max-w-7xl px-5 py-10" aria-labelledby="learn-teaser">
        <div>
          <h2 id="learn-teaser" className="display text-2xl sm:text-3xl">Why does a flame change shape in space?</h2>
          <p className="text-muted mt-2 max-w-[60ch]">Flip gravity off yourself, then scroll through three real tests where only the airflow changed.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/learn" className="story-cta inline-flex">Explore the science</Link>
          <Link href="/lab" className="border border-rule-strong px-5 py-3 rounded-full hover:border-signal">Enter the Flame Lab</Link>
        </div>
      </section>

      <section className="border-b border-rule">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16 grid gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:items-center">
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

      <section className="border-y border-rule bg-panel">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16">
          <h2 className="display text-2xl sm:text-3xl">What NASA found about fire without gravity</h2>
          <div className="mt-10 grid gap-x-12 gap-y-10 md:grid-cols-2">
            {why.map((f) => (
              <Quote key={f.id} f={f} />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-16 grid gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
        <div>
          <h2 className="display text-2xl sm:text-3xl">How the atlas works</h2>
          <p className="mt-4 text-muted">
            {evidenceRecords.length} test records ({experiments.length} BASS and BASS-II, {saffireRuns.length} Saffire
            {evidenceRecords.length > experiments.length + saffireRuns.length ? `, ${evidenceRecords.length - experiments.length - saffireRuns.length} LUCI lunar-gravity` : ""}) across {materials} materials, drawn from {sources.length} NASA
            documents, with {findings.length} quoted findings checked against the original text.
          </p>
        </div>
        <ol className="grid gap-8 sm:grid-cols-2">
          {STEPS.map((s, i) => (
            <li key={s.title} className="border-t border-rule-strong pt-4">
              <span className="text-sm text-faint num">Step {i + 1}</span>
              <h3 className="mt-1 font-semibold text-lg">{s.title}</h3>
              <p className="mt-2 text-muted text-[15px]">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="home-thesis" aria-labelledby="thesis">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-20 text-center">
          <p className="text-signal text-sm">Where the evidence stops</p>
          <h2 id="thesis" className="display text-4xl sm:text-5xl mt-3">Good science does not hide what it doesn&apos;t know.</h2>
          <p className="mt-5 text-lg text-muted max-w-[62ch] mx-auto">
            Every test row in this atlas ran in microgravity. No test reached the 34 % oxygen NASA proposes for Moon and Mars habitats, and long
            burns at lunar gravity are only beginning. MicroFire Atlas shows that gap instead of guessing across it. <Cite sourceId="luci" />
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/mission?context=moon-base" className="story-cta">Explore the evidence</Link>
            <Link href="/gaps" className="border border-rule-strong px-5 py-3 rounded-sm hover:border-signal">See the Research Frontier</Link>
          </div>
        </div>
      </section>
    </>
  );
}
