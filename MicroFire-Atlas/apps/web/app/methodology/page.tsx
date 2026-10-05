import type { Metadata } from "next";
import Link from "next/link";
import { buildDataset } from "@/lib/model-lab";
import { Cite } from "@/components/Cite";
import { OutcomeMark } from "@/components/Outcome";
import { evidenceRecords, experiments, findings, luciRuns, OUTCOME_STYLE, saffireRuns, sources } from "@/lib/data";
import { FAMILIES, ladder, TOLERANCE } from "@/lib/ontology";
import { FRONTIER } from "@/lib/frontier";
import { OBSERVED_MIN } from "@/lib/gaps";
import { LABELS, MATERIAL_CLASS, PRESSURE_SCALE_KPA, rank, SAME_CLASS_CREDIT, scalesFrom, WEIGHTS } from "@/lib/relevance";
import { ladderRobustness, RANGES, rankRobustness, SAMPLES } from "@/lib/robustness";
import { runEval, runFindingEval, runFindingEvalV2, type EvalQuestion, type FindingGoldCase } from "@/lib/eval";
import { TRACEABILITY } from "@/lib/challenge";
import { FoolTheChecker } from "@/components/method/FoolTheChecker";
import { WeightPlayground } from "@/components/method/WeightPlayground";
import { QuestBoard } from "@/components/quest/QuestBoard";
import mstyles from "@/components/method/Method.module.css";
import evalSet from "@/eval/microfire-eval-v1.json";
import live from "@/eval/results-live.json";
import findingLabels from "@/eval/finding-labels-v1.json";
import findingGold from "@/eval/finding-gold-v2.json";
import { FINDING_VARIATIONS } from "@/lib/finding-relevance";

export const metadata: Metadata = { title: "Methodology" };

const OUTCOME_RULES: [string, string][] = [
  ["quenched_low_flow", "NASA notes the flame quenched or went out as the crew turned the flow down."],
  ["blowoff", "NASA notes the flame blew off or blew out as flow was raised."],
  ["extinguished_flow_off", "The flow was switched off and the flame went out."],
  ["no_sustained_flame", "Ignited only briefly; NASA notes no sustained flame."],
  ["not_ignited", "NASA notes no ignition."],
  ["sustained_no_blowoff", "NASA notes the flame kept spreading at high flow without blowing off."],
  ["burned_entire_sample", "NASA notes complete burnout of the sample."],
  ["burned_outcome_not_stated", "The test burned but the table states no end state. We do not guess one."],
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8 border-t border-rule pt-10">
      <h2 className="display text-2xl">{title}</h2>
      <div className="mt-5 space-y-4 text-[16px] max-w-[75ch]">{children}</div>
    </section>
  );
}

const MODEL_ROWS = buildDataset(experiments);

export default function MethodologyPage() {
  const sc = scalesFrom(experiments);
  const moon = FRONTIER.find((f) => f.id === "moon-base")!;
  const ml = ladder(evidenceRecords, findings, moon.q);
  const demo = { material: "PMMA", oxygen: 16.5, flow: 5, gravity: "microgravity" as const, flowDirection: "opposed" };
  const demoRank = rank(experiments, demo).slice(0, 5);
  const demoRob = rankRobustness(experiments, demo);
  const moonRob = ladderRobustness(evidenceRecords, findings, moon.q);
  const ev = runEval(evalSet.questions as EvalQuestion[], experiments, findings, saffireRuns, luciRuns);
  const fev = runFindingEval(findingLabels.cases, experiments, findings, saffireRuns, luciRuns);
  const fg = runFindingEvalV2(findingGold.cases as FindingGoldCase[], experiments, findings, saffireRuns, luciRuns);
  const pc = (x: number | null) => (x == null ? "—" : `${Math.round(x * 1000) / 10} %`);
  const lm = live.metrics, lr = live.rescored;
  return (
    <div className="explorer-page method-page mx-auto max-w-7xl px-4 sm:px-6 py-12 grid grid-cols-1 gap-12 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label="On this page" className="text-sm lg:sticky lg:top-6 lg:self-start">
        <ul className="space-y-2 text-muted">
          {[
            ["challenge", "How MicroFire answers the challenge"],
            ["data", "Where the data comes from"],
            ["ladder", "The Evidence Ladder"],
            ["labels", "Observed, series, derived"],
            ["outcomes", "Outcome codes"],
            ["relevance", "Mission Relevance"],
            ["finding-relevance", "How findings are ranked"],
            ["robustness", "Ranking robustness"],
            ["confidence", "Evidence Confidence"],
            ["gaps", "Evidence gaps"],
            ["research-planning-method", "Research opportunities"],
            ["model", "Evidence-bounded ML"],
            ["ai", "Where AI is used"],
            ["evaluate", "Evaluate MicroFire AI"],
            ["limits", "Limitations"],
          ].map(([id, l]) => (
            <li key={id}>
              <a href={`#${id}`} className="hover:text-ink">
                {l}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-14">
        <header className="space-y-8">
          <div>
            <p className="text-signal text-sm">Showing our work</p>
            <h1 className="display text-4xl sm:text-5xl mt-2">How MicroFire knows what it knows</h1>
            <p className="mt-3 text-muted max-w-[68ch] text-[17px]">
              Five steps turn NASA&apos;s reports into answers you can check. Tap a step to see how it works, and try the two games
              below: they run the real code. The scores are MicroFire Atlas heuristics; NASA did not set, review or endorse them.
            </p>
          </div>
          <nav className={mstyles.pipeline} aria-label="How the atlas is built">
            <a href="#data"><b>{sources.length}</b><strong>NASA reports</strong><span>Downloaded from NASA&apos;s technical reports server, each with a fingerprint (SHA-256)</span></a>
            <a href="#data"><b>{evidenceRecords.length}</b><strong>Test records typed in</strong><span>From NASA&apos;s own test tables, in NASA&apos;s units and words</span></a>
            <a href="#data"><b>{findings.length}</b><strong>Quotes verified</strong><span>The build fails if one word is missing from the PDF</span></a>
            <a href="#ladder"><b>4</b><strong>Evidence Ladder rungs</strong><span>Direct, analogous, mechanistic, gap, stress-tested {SAMPLES.toLocaleString("en-US")} ways</span></a>
            <a href="#evaluate"><b>{ev.questions}</b><strong>Test questions for the AI</strong><span>Every AI claim is checked against the cited NASA text</span></a>
          </nav>
          <QuestBoard page="methodology" crew="mei" />
        </header>

        <Section id="challenge" title="How MicroFire answers the challenge">
          <p>
            The challenge asks for an interactive, AI-powered dashboard that summarizes, ranks and interprets microgravity combustion
            findings to deliver fire-safety insights for human space exploration. Each word maps to one place in the product.{" "}
            <Link href="/challenge" className="link">See all of it answer one mission question</Link>.
          </p>
          <ul className="space-y-2">
            {TRACEABILITY.map((t) => (
              <li key={t.verb} className="grid gap-1 sm:grid-cols-[11rem_minmax(0,1fr)]">
                <strong>✓ {t.verb}</strong>
                <span className="text-muted">{t.what}. <Link href={t.href} className="link">{t.where}</Link></span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="data" title="Where the data comes from">
          <p>
            The {experiments.length} test records are typed by hand from three tables in NASA&apos;s BASS-II Summary Report:
            Table 7.1 (SIBAL fabric, including four tests from the original BASS experiment), Table A.1 (PMMA films) and Table
            A.2 (Nomex). <Cite sourceId="bass2-summary" page={104} where="Table 7.1" />
          </p>
          <p>
            The transcriptions live in <code>data/curated/*.csv</code> with NASA&apos;s original units and wording. A Python
            build step converts units (cm to mm, µm to mm, atm to kPa), codes outcomes and writes the JSON this site reads.
            Unit tests check the conversions and spot-check values against the PDF.
          </p>
          <p>
            The {luciRuns.length} LUCI burns, in lunar gravity simulated on a spinning New Shepard rocket, come from NASA&apos;s 2025 LUCI
            results. Every value is stored with the exact sentence and PDF page it came from, and the build fails if that sentence is not on
            that page or does not contain the value.
          </p>
          <p>
            The {saffireRuns.length} Saffire runs come from the test-matrix and results tables of three NASA Saffire reports.
            A build check finds every transcribed number on the exact table line it came from, and fails if one is missing. Each run links to its table and PDF page on the{" "}
            <Link href="/saffire" className="link">Saffire page</Link>.
          </p>
          <p>
            The {findings.length} quoted findings are checked automatically: the build fails if any quote does not appear
            word for word in its source&apos;s abstract or PDF text, and records the PDF page where it was found.
          </p>
          <p>
            {sources.length} NASA documents are listed with their NTRS record, publication type and SHA-256 hash on the{" "}
            <Link href="/sources" className="link">
              Sources page
            </Link>
            .
          </p>
        </Section>

        <Section id="ladder" title="The Evidence Ladder">
          <p>
            NASA&apos;s fire experiments burn different things in different physical regimes, so they are never merged into one
            table. Each record keeps its own columns and is also described along shared dimensions: fuel phase, material, size,
            gravity, oxygen, pressure and airflow. A mission question then sorts the evidence onto four rungs:
          </p>
          <dl className="grid grid-cols-1 sm:grid-cols-[9rem_minmax(0,1fr)] gap-x-4 gap-y-2">
            <dt className="font-semibold">Direct</dt>
            <dd className="text-muted">Same fuel phase, same material and same gravity, with every condition you set within tolerance.</dd>
            <dt className="font-semibold">Analogous</dt>
            <dd className="text-muted">Solid-fuel tests that differ in named ways, listed on each card. Fewer differences rank higher; a gravity difference counts double, because it is a different physical regime.</dd>
            <dt className="font-semibold">Mechanistic</dt>
            <dd className="text-muted">Other regimes, such as droplets or gas flames. They explain how flames behave, never how a material burns.</dd>
            <dt className="font-semibold">Gap</dt>
            <dd className="text-muted">What no record covers, written as the matched-condition test that would fill it.</dd>
          </dl>
          <p>
            Tolerances: oxygen ±{TOLERANCE.oxygen} percentage points, pressure ±{TOLERANCE.pressureKpa} kPa, airflow ±
            {TOLERANCE.flowFraction * 100} %. A value a record does not state never counts as a match. These are MicroFire Atlas
            choices, not NASA criteria. Every ladder card has a &ldquo;Why is this evidence shown?&rdquo; path that walks
            through each check.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[14px]">
              <caption className="text-left text-muted mb-2">Experiment families</caption>
              <thead>
                <tr className="border-b border-rule text-left text-muted">
                  <th className="font-normal py-1.5 pr-4">Family</th>
                  <th className="font-normal py-1.5 pr-4">Fuel</th>
                  <th className="font-normal py-1.5 pr-4">Where</th>
                  <th className="font-normal py-1.5">Highest rung</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(FAMILIES)
                  .filter((f) => f.phase)
                  .map((f) => (
                    <tr key={f.id} className="border-b border-rule align-top">
                      <th scope="row" className="text-left font-semibold py-2 pr-4 whitespace-nowrap">{f.name}</th>
                      <td className="py-2 pr-4 text-muted">{f.fuel}</td>
                      <td className="py-2 pr-4 text-muted">{f.platform}</td>
                      <td className="py-2">
                        {f.phase !== "solid" ? "Mechanistic" : f.id === "fm2" ? "None yet (planned)" : f.id === "bass2" || f.id === "saffire" || f.id === "luci" ? "Direct (test rows)" : "Analogous (findings)"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p>
            Worked example, computed live: <strong>{moon.title}</strong>. Direct:{" "}
            {ml.direct.length} tests. Analogous: {ml.analogous.length} tests, the closest being {ml.analogous[0]?.record.label} (
            {ml.analogous[0]?.differs.map((d) => d.text).join("; ")}). Missing: {ml.gaps.map((g) => g.dim).join(", ")}.{" "}
            <Link href="/mission?context=moon-base" className="link">See this ladder</Link>
          </p>
        </Section>

        <Section id="labels" title="Observed, series, derived">
          <p>Each value on a test page carries one of four labels:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Recorded for this test</strong>: a value in that test&apos;s row of NASA&apos;s table.
            </li>
            <li>
              <strong>Stated for the whole test series</strong>: a value NASA gives once for a group of tests, quoted with its
              page, such as the SIBAL sample thickness or the 99.2–99.5 kPa pressure range of one investigator&apos;s series.
              It is never presented as a per-test reading.
            </li>
            <li>
              <strong>Derived by MicroFire Atlas</strong>: our coding of NASA&apos;s words, such as an outcome code or the first
              numeric value of a flow column, with the rule shown.
            </li>
            <li>
              <strong>Not stated in the source</strong>: left blank. We do not fill gaps with typical values.
            </li>
          </ul>
          <p>
            Airflow in Table A.1 mixes velocities in cm/s with fan potentiometer settings (“pot”). We keep the column word for
            word and only use the numbers that are velocities.
          </p>
        </Section>

        <Section id="outcomes" title="Outcome codes">
          <table className="w-full text-[15px]">
            <tbody>
              {OUTCOME_RULES.map(([code, rule]) => (
                <tr key={code} className="border-b border-rule align-top">
                  <th scope="row" className="text-left font-normal py-2 pr-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-2">
                      <OutcomeMark style={OUTCOME_STYLE[code]} />
                      {OUTCOME_STYLE[code].legend}
                    </span>
                  </th>
                  <td className="py-2 text-muted">{rule}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section id="relevance" title="Mission Relevance">
          <p>How close a NASA test is to the scenario you describe, from 0 to 100:</p>
          <pre className="bg-panel border border-rule rounded-sm p-4 text-sm overflow-x-auto">
            {`relevance = Σ wᵢ · simᵢ / Σ wᵢ      over the variables you set
coverage  = Σ wᵢ (reported by the test) / Σ wᵢ`}
          </pre>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              Numeric variables use <code>sim = exp(−|Δ| / scale)</code>. The scale is the standard deviation of that variable
              across all {experiments.length} tests: oxygen {sc.oxygen.toFixed(2)} %, airflow {sc.flow.toFixed(2)} cm/s, width{" "}
              {sc.widthMm.toFixed(1)} mm, and log-thickness {sc.logThickness.toFixed(2)}.
            </li>
            <li>If your airflow falls inside the range a test ramped through, the airflow match is 1.</li>
            <li>
              Pressure uses a fixed {PRESSURE_SCALE_KPA} kPa scale, because every test ran near 1 atm and the data&apos;s own
              spread is too narrow to be fair. A value inside a reported range matches fully.
            </li>
            <li>
              Material: 1 for the same material, {SAME_CLASS_CREDIT} for the same broad class (
              {Object.entries(MATERIAL_CLASS)
                .map(([m, c]) => `${m}: ${c}`)
                .join("; ")}
              ), otherwise 0. Flow direction and gravity: 1 if equal, otherwise 0.
            </li>
            <li>
              <strong>A variable the test does not report adds 0 but keeps its weight</strong>, so missing data lowers a score
              and is listed as “not reported”. It is never treated as a match.
            </li>
          </ul>
          <table className="text-[15px] num">
            <caption className="text-left text-muted mb-2">Weights</caption>
            <tbody>
              {(Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).map((k) => (
                <tr key={k} className="border-b border-rule">
                  <th scope="row" className="text-left font-normal pr-10 py-1.5">
                    {LABELS[k]}
                  </th>
                  <td>{WEIGHTS[k]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-muted">
            Ties are broken by coverage, then by test ID, so the ranking is deterministic. A scenario outside the tested range
            of oxygen, airflow or pressure, or at a gravity level no test used, triggers the notice “Direct evidence under these
            exact conditions is limited”.
          </p>
        </Section>

        <Section id="robustness" title="Ranking robustness">
          <p>
            The weights, the pressure scale and the ladder tolerances above are our choices. A fair question is whether the
            answer depends on them. So every ranking is recomputed {SAMPLES.toLocaleString("en-US")} times with those choices
            varied over a stated range, from a fixed random seed so the result is repeatable:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>each relevance weight multiplied by {RANGES.weight[0]} to {RANGES.weight[1]};</li>
            <li>the pressure scale between {RANGES.pressureScaleKpa[0]} and {RANGES.pressureScaleKpa[1]} kPa, and the similar-material credit between {RANGES.classCredit[0]} and {RANGES.classCredit[1]};</li>
            <li>
              for the Evidence Ladder: oxygen tolerance ±{RANGES.oxygen[0]}–{RANGES.oxygen[1]} points, pressure ±{RANGES.pressureKpa[0]}–{RANGES.pressureKpa[1]} kPa, airflow ±
              {RANGES.flowFraction[0] * 100}–{RANGES.flowFraction[1] * 100} %.
            </li>
          </ul>
          <p>
            For each test we report the median rank, the rank range (5th to 95th percentile) and how often it stays in the top
            three. &ldquo;Stable rank&rdquo; means a range of 3 places or fewer, &ldquo;fairly stable&rdquo; up to 7. Robustness is shown beside
            relevance and never merged into it: a stable rank means the test stays among the closest under many reasonable
            assumptions, not that a fire is likely or unlikely.
          </p>
          <WeightPlayground />
          <div className="overflow-x-auto">
            <table className="w-full text-[14px] num">
              <caption className="text-left text-muted mb-2">
                Worked example, computed live: PMMA, 16.5 % oxygen, 5 cm/s opposed flow, microgravity
              </caption>
              <thead>
                <tr className="border-b border-rule text-left text-muted">
                  <th className="font-normal py-1.5 pr-4">Test</th>
                  <th className="font-normal py-1.5 pr-4">Relevance</th>
                  <th className="font-normal py-1.5 pr-4">Median rank</th>
                  <th className="font-normal py-1.5 pr-4">Rank range</th>
                  <th className="font-normal py-1.5">Top 3</th>
                </tr>
              </thead>
              <tbody>
                {demoRank.map((r) => {
                  const st = demoRob.get(r.experiment.id)!;
                  return (
                    <tr key={r.experiment.id} className="border-b border-rule">
                      <th scope="row" className="text-left font-semibold py-1.5 pr-4">
                        <Link href={`/experiments/${r.experiment.id}`} className="link">{r.experiment.test_id}</Link>
                      </th>
                      <td className="pr-4">{Math.round(r.score * 100)}</td>
                      <td className="pr-4">{st.median}</td>
                      <td className="pr-4">{st.lo}–{st.hi}</td>
                      <td>{Math.round(st.top3 * 100)} %</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p>
            For {moon.title}, the direct rung stays empty in {Math.round(moonRob.directEmpty * 100)} % of tolerance variations
            {moonRob.closest && <>, and {moonRob.closest.label} stays the closest record in {Math.round(moonRob.closest.first * 100)} %</>}. Loosening
            our tolerances cannot turn orbit tests into lunar-gravity evidence.
          </p>
        </Section>

        <Section id="confidence" title="Evidence Confidence">
          <p>
            Separate from relevance: how solid one test&apos;s record is, whatever your scenario. Seven equal-weight checks:
            test-level NASA row; outcome stated by NASA; oxygen reading not flagged by NASA; pressure documented; CO₂/CO readings
            present; fresh (not reused) sample; at least two related tests in the same family within ±1 % oxygen and ±2 cm/s.
          </p>
          <p>Strong is 80 % or more of checks, Moderate 55 % or more, otherwise Limited.</p>
        </Section>

        <Section id="gaps" title="Evidence gaps">
          <p>
            The gap map bins tests by oxygen and airflow. A ramped-flow test counts in every airflow range it passed through. A
            cell with {OBSERVED_MIN} or more tests is an observed region, 1–2 is sparse, and an empty cell is outside available
            evidence. The site makes no claim about empty cells and never interpolates across them.
          </p>
        </Section>

        <Section id="finding-relevance" title="How findings are ranked">
          <p>Finding Relevance ranks verified NASA statements for a question; experiment relevance compares individual test conditions. Both are MicroFire heuristics. NASA did not create, validate or endorse this ranking.</p>
          <p>Requested topics come from the question selector plus explicit triggers: airflow at ≤5 cm/s; oxygen above 21 % or below 19 %; quench below 19 %; pressure below 95 kPa; partial gravity when lunar or Martian gravity is selected. These thresholds organize retrieval; they are not combustion limits.</p>
          <p><code>Relevance = 100 × (5 × topic recall + 3 × material match + 2 × gravity match) / requested-feature weights.</code> Topic recall is the fraction of requested topics found in the curated tags. Exact material and gravity matches are 1, otherwise 0. Unrequested features leave the denominator; requested features with unknown metadata remain in it and contribute zero. A finding must match a topic or material to enter the list.</p>
          <p>Evidence type constrains sorting first: direct, analogous, mechanistic, context; only then relevance descending, with finding ID as the stable tie-break. Direct requires an observed finding with explicit row links and all linked rows matching the selected conditions under the existing Evidence Ladder tolerances, without platform caveats. Publication-level solid-fuel findings remain analogous. Liquid/gas evidence stays mechanistic; planned FM² work and background remain context. One exception (ranking v1.1): when no material is named, several topics are requested and no observation addresses all of them, findings that address every requested topic sort first, still in evidence-type order and still labelled. A mission-context question such as “which exploration atmospheres has NASA studied?” then shows the atmosphere studies first. Whenever an observation addresses the whole question, observations stay first.</p>
          <p>Material comes from explicit row links, material-specific sources, or literal material names in the quote. Gravity comes from linked records or a known experiment family. LUCI always retains its simulated-lunar-gravity limitation. These associations do not establish matched pressure, oxygen, geometry or flow history.</p>
          <p>Only explicit curated record IDs count as supporting records; a shared family or publication never creates row links. Support count is not a replication count. Coverage is the average fraction of requested condition fields reported in linked rows, not the fraction matching. Publication-level coverage is unknown. Only curated abstract labels establish source role; an unspecified PDF section stays unclassified.</p>
          <p>For example, weak-flow PMMA questions retrieve low-airflow findings. A lunar question also retrieves partial-gravity findings, with the simulated-platform limitation. A droplet result cannot outrank relevant solid-fuel evidence through topic count alone. A high relevance number can coexist with an analogous rung and unknown coverage.</p>
          <p>Finding sensitivity uses 200 repeatable variations (seed 19), independently multiplying each weight by a uniform factor from 0.75 to 1.25. Evidence-type ordering stays fixed. Top-3 frequency is reported separately from relevance; it measures sensitivity to project weights, not measurement uncertainty or scientific confidence. Existing experiment sensitivity still uses 1,000 variations.</p>
          <p>Fire-Safety Insight uses a small set of source-bound interpretation templates. NASA observations retain their exact quotes; MicroFire interpretations are labelled and preserve mismatches. Without a reviewed template, the panel abstains. This is neither mission certification nor a crew procedure.</p>
        </Section>

        <Section id="research-planning-method" title="How MicroFire identifies research opportunities">
          <p>Research planning supports spacecraft-fire researchers and early-stage mission evidence analysts before formal engineering assessment. It uses the current curated atlas; it does not determine whether a mission or material is safe.</p>
          <h3 className="text-lg font-semibold">Mission Scenario Registry</h3>
          <p>The finite registry reuses eight Mission Analyst presets and three additional Research Frontier questions. The duplicate Moon-base frontier and Challenge questions reuse existing presets. No Cartesian product is generated. Each question retains its origin, rationale, category and source context. Unspecified conditions remain unknown. Questions with identical normalized wording and conditions count once even if repeated under different IDs; distinct questions at identical conditions share one gap.</p>
          <h3 className="text-lg font-semibold">Gap normalization, deduplication and shared gaps</h3>
          <p>Normalize material, gravity, oxygen, pressure and airflow into a fixed key order; reject unsupported dimensions, invalid numbers and malformed values. The full canonical condition object determines the stable gap ID. Exact values define identity: 34 and 34.1 % remain different gaps even though they can be close under coverage tolerances. Missing pressure never equals a specified pressure.</p>
          <p>Run the existing Evidence Ladder for each scenario against completed BASS, Saffire and LUCI records. A direct condition match prevents a coverage-gap entry; all platform caveats still apply. Findings and future FM² plans never become rows. Uncovered scenarios sharing exact conditions merge, retaining distinct scenario links and categories. The missing dimensions and next-experiment text come from the Ladder. A joint-condition gap remains even if each condition was tested separately.</p>
          <p>Analogous support counts nonmatching rows with the requested material and at most two differing condition dimensions. It is a transparent proximity filter, not evidence strength. Links show the five closest rows even if more distant. Cross-family breadth uses those links and five selected non-context findings; mechanistic support remains a separate count of non-context liquid/gas findings.</p>
          <h3 className="text-lg font-semibold">Candidate generation and Evidence Gain</h3>
          <p>Each unresolved condition combination becomes a hypothetical research question. Only exact identical candidate specifications merge; no extra condition is borrowed from an analogue. Candidate objects have no measured outcome, NASA citation or experimental record family, and never enter the evidence corpus.</p>
          <p>For every candidate–gap pair, reuse the Evidence Ladder&apos;s condition comparison: exact material/gravity, oxygen ±1.5 percentage points, pressure ±10 kPa, airflow ±max(1 cm/s, 50 % of requested flow). Missing requested candidate values fail. All requested dimensions matching means potential direct-condition coverage. Gravity or material mismatch excludes even partial coverage. Partial overlap requires a matched missing dimension (or two matched dimensions for a joint-combination gap); it remains a research lead, never counted as direct coverage or demonstrated gap reduction.</p>
          <pre className="overflow-x-auto text-sm bg-panel p-4 rounded-lg">{`for each unique curated question:
  classify current completed records with Evidence Ladder
  if no direct condition match: group gap by EXACT conditions
for each unique gap condition object:
  create hypothetical candidate; keep unknown fields absent
  compare candidate conditions with every registered gap
  count matching gaps and UNION their distinct question IDs
potential direct questions = current direct questions + new unique matches`}</pre>
          <p>“Evidence Gain” means potential coverage if a valid completed record existed. It is not expected scientific information gain, entropy, Bayesian design, active learning or a prediction of experimental outcome. A broad question can be covered by a more specific candidate, but the reverse fails where required values are missing.</p>
          <h3 className="text-lg font-semibold">Planned NASA overlap and sorting</h3>
          <p>Verified FM² plan findings identify lunar-gravity and PMMA/SIBAL material overlap. This deliberately conservative mapping does not infer full atmosphere, flow or geometry compatibility. Plans count only as planned overlap and never increase observed coverage.</p>
          <p>Board sorts expose separate dimensions: distinct questions, direct count ascending (then analogous support ascending), distinct categories, analogous support, planned overlap, or maximum candidate gap coverage. Descending sorts break ties by stable gap ID. Candidate order uses directly addressable gaps, then affected questions, then stable ID. There is no composite or official NASA priority score.</p>
          <h3 className="text-lg font-semibold">Limits and non-goals</h3>
          <p>Geometry, scale, duration, ignition method, confinement, orientation, hardware and sample history are not jointly represented. LUCI&apos;s lunar gravity is simulated. Even a direct match only covers represented dimensions under project tolerances. Counts depend on a small curated question set and do not measure researcher demand; repeated or selectively added scenarios can bias apparent breadth.</p>
          <p>The planner does not estimate information entropy, outcome value, experiment cost, hardware feasibility, crew risk, TRL, schedule, program/funding/political priority, safety impact or probability of experiment success. NASA has not validated or endorsed these planning heuristics. Human usability impact study pending; no performance-improvement claim is made.</p>
          <p><Link href="/gaps#research-planning" className="link">Open the research landscape</Link>. Versioned JSON exports retain corpus identity, assumptions and hypothetical/planned status. Source updates require human review before the evidence layer changes.</p>
        </Section>

        <Section id="model" title="Evidence-bounded machine learning">
          <p>
            The <Link href="/model-lab" className="link">AI Model Lab</Link> trains a regularised logistic regression on {MODEL_ROWS.rows.length} BASS-II tests
            (SIBAL fabric and PMMA; reused samples, suspect oxygen readings and the all-negative Nomex family excluded). It predicts one thing: whether a
            flame was established after the ignition attempt. Final outcomes are not modelled, because most BASS-II flames were extinguished on purpose
            by turning the fan down. Saffire and LUCI are not pooled: different scale, different gravity regime.
          </p>
          <p>
            Validation leaves one crew session out at a time, with bootstrap intervals, a repeated stratified check and a leave-one-material-out stress
            test. Five models are benchmarked against a baseline; the simplest one that beats it on proper scores is deployed.
          </p>
          <p>
            Every query passes a domain gate first: gravity must be microgravity, the material must be in the training data, pressure must be ISS-cabin
            pressure, oxygen and airflow must sit inside each material&apos;s tested range, and at least three similar tests must lie nearby. Otherwise the
            answer is “out of domain” or “insufficient evidence”, and no number is shown. Reproduce it with <code>npm run model-lab</code>.
          </p>
        </Section>

        <Section id="ai" title="Where AI is used">
          <p>
            Ranking, the Evidence Ladder, comparison and the gap map are deterministic code. The Ask page uses a language model
            only to phrase answers from an evidence package of these records and verified quotes. Each claim in an answer is
            checked before it is shown: cited IDs must be in the package, numbers must appear in the cited record, and the page
            flags unit mix-ups, microgravity results described as lunar, causal or safety wording, and predictions. Without the
            model, every other page works unchanged.
          </p>
          <p>The Verified Example on Ask is a saved synthesis rechecked against the current evidence and checker at build/test time; it makes no live request. The checker detects defined citation, numeric, unit and wording errors. It cannot prove full semantic entailment or real-world transfer.</p>
          <p>Flame Vision is classical OpenCV segmentation, with no trained fire-prediction model. Not yet validated against hand-annotated real frames. Pixel measurements describe the image, not temperature or a calibrated physical flame size.</p>
        </Section>

        <Section id="evaluate" title="Evaluate MicroFire AI">
          <p>
            MicroFire-Eval v{evalSet.version} is {ev.questions} questions written before the measurements and then frozen: direct lookups, numbers,
            comparisons, synthesis across reports, mission scenarios, deliberately unanswerable questions and misleading premises.
            Gold answers are NASA record IDs taken from the data, not from the system. When the system failed a question, the
            system was changed, never the question. When the evidence itself changed (two LUCI lunar-gravity burns were added), the
            expectations that depend on it were updated, and each change is listed with its reason in the changelog.{" "}
            <a href="https://github.com/A-K-M-Asifuzzaman/MicroFire-Atlas/blob/main/apps/web/eval/microfire-eval-v1.json" className="link">Read every question</a>
          </p>
          <h3 className="text-lg font-semibold">Play: fool the checker</h3>
          <FoolTheChecker />
          <h3 className="text-lg font-semibold">Before the model: retrieval and the claim checker (recomputed on every build)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[14px] num">
              <tbody>
                {[
                  ["Questions passed", `${ev.passed} of ${ev.questions}`],
                  ["Gold evidence retrieved (anywhere in the package)", pc(ev.recallAll)],
                  ["Gold evidence in the first five items", pc(ev.recall5)],
                  ["Unanswerable questions that flag a gap or return nothing", `${ev.abstention.correct} of ${ev.abstention.n}`],
                  ["Gap questions that name the right missing conditions", `${ev.gapFlags.correct} of ${ev.gapFlags.n}`],
                  ["Unanswerable or gap questions given “direct” evidence", String(ev.overClaims)],
                  ["Broken claims caught by the checker", `${ev.verifier.caught} of ${ev.verifier.faulty}`],
                  ["Correct claims wrongly flagged", `${ev.verifier.falseAlarms} of ${ev.verifier.correct}`],
                ].map(([k, v]) => (
                  <tr key={k} className="border-b border-rule"><th scope="row" className="text-left font-normal py-1.5 pr-6">{k}</th><td>{v}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted">
            The broken claims cover invented citations, wrong numbers, swapped units, microgravity results told as lunar, causal
            wording, predictions and uncited facts, ten of each. Still failing: {ev.failures.map((f) => `“${f.q}”`).join(" and ")}.
          </p>
          <h3 className="text-lg font-semibold">Finding-ranking extension — provisional source-reading labels</h3>
          <p>Seven existing benchmark questions have finding-ID labels read from verified quotes, plus six supplemental adversarial questions. These are engineering labels awaiting independent scientific adjudication, not LLM-generated reference answers. They measure the finding ranker using the existing question parser; Mission Analyst uses explicit condition and topic controls.</p>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div><dt>Gold finding Recall@3 / Recall@5</dt><dd>{pc(fev.recall3)} / {pc(fev.recall5)}</dd></div>
            <div><dt>Mean reciprocal rank</dt><dd>{fev.mrr?.toFixed(3) ?? "—"}</dd></div>
            <div><dt>Wrong-regime ordering violations</dt><dd>{fev.wrongRegimePromotions} / {fev.cases} cases</dd></div>
            <div><dt>Source-role checks</dt><dd>{fev.sourceRoles.correct} / {fev.sourceRoles.n}</dd></div>
            <div><dt>Adversarial finding-gap handling</dt><dd>{fev.abstention.correct} / {fev.abstention.n}</dd></div>
            <div><dt>Template-rule unsupported implication rate</dt><dd>{pc(fev.unsupportedMissionImplicationRate)} across {fev.implications} outputs</dd></div>
            <div><dt>Injected unsafe/directive/probability claims rejected</dt><dd>{fev.adversarialImplications.rejected} / {fev.adversarialImplications.n}</dd></div>
          </dl>
          <p className="text-sm text-muted">Wrong-regime checks detect mechanistic findings promoted ahead of relevant solid evidence. Implication checks enforce source-bound templates and reject injected prohibited statements; a zero rate is not an independent semantic or scientific accuracy measurement. Abstention requires a flagged request limitation and no direct finding. Source-role checks include correctly leaving PDF sections unknown. Labels and per-case output are in <code>eval/finding-labels-v1.json</code> and <code>node lib/eval-run.ts</code>.</p>
          <h3 className="text-lg font-semibold">Finding gold set v2: {fg.cases} hand-labelled cases</h3>
          <p>
            Each case names a scenario and topics directly, so this measures the finding ranker itself, not the question parser.
            Labels were assigned by reading each finding&apos;s quote, kind and topics before running the ranker: a primary answer,
            other acceptable findings, and findings that must never rank above the primary. {fg.unanswerable} cases are
            questions NASA evidence cannot answer (safest material, probabilities, proof, predictions).
          </p>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div><dt>Recall@1 / @3 / @5 (a primary answer in the top k)</dt><dd>{pc(fg.recall1)} / {pc(fg.recall3)} / {pc(fg.recall5)} of {fg.answerable}</dd></div>
            <div><dt>Recall@3 counting acceptable findings</dt><dd>{pc(fg.relaxedRecall3)}</dd></div>
            <div><dt>Mean reciprocal rank</dt><dd>{fg.mrr.toFixed(3)}</dd></div>
            <div><dt>Forbidden findings ranked above the answer</dt><dd>{fg.forbiddenPromotions} / {fg.answerable}</dd></div>
            <div><dt>Mechanism-only evidence above a solid-fuel answer</dt><dd>{fg.mechanisticOverSolid.count} / {fg.mechanisticOverSolid.n}</dd></div>
            <div><dt>Context or planned work above an observation answer</dt><dd>{fg.contextOverObservation.count} / {fg.contextOverObservation.n}</dd></div>
            <div><dt>Unanswerable questions flagged, with no insight attached</dt><dd>{fg.abstention.correct} / {fg.abstention.n}</dd></div>
            <div><dt>Unsupported implications</dt><dd>{fg.unsupportedImplications} of {fg.implications}</dd></div>
            <div><dt>Evidence-rung agreement with the label</dt><dd>{pc(fg.rungAgreement)}</dd></div>
            <div><dt>Mean top-3 stability of the answer ({FINDING_VARIATIONS} weight variations)</dt><dd>{pc(fg.meanTop3Stability)}</dd></div>
          </dl>
          <p className="text-sm text-muted">
            Still missed in the top 3: {fg.misses.map((m) => `${m.id} (rank ${m.bestPrimaryRank ?? "not ranked"})`).join(", ")}.
            The first run of this set found that mission-context questions (which exploration atmospheres NASA studied, what FM²
            will use) buried the context findings that answer them below observations that matched only one topic. Ranking
            v1.1 lets findings that address every requested topic lead only when no observation does and no material is named;
            observations otherwise stay first. That lifted Recall@3 from 71 % to {pc(fg.recall3)} with every guardrail above at
            zero. Labels are engineering labels awaiting independent scientific adjudication. File:{" "}
            <code>eval/finding-gold-v2.json</code>.
          </p>
          <h3 className="text-lg font-semibold">Historical live-model run</h3>
          <p>
            All {lm.questions} questions were sent to the live Ask pipeline with {lm.model}. {lm.questions - lm.aiAnswers} matched no
            evidence, so the model was never called. The {lm.claims} claims in the other answers were checked by
            the verifier at that time. These are saved historical metrics, not a new run or a rescore of this hardening pass. Re-scored: the saved answers re-checked after we fixed verifier false alarms (chemical
            formulas read as numbers, the question&apos;s own numbers, arithmetic in derived claims, negated safety words), with no
            new model calls.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[14px] num">
              <thead><tr className="border-b border-rule text-left text-muted"><th className="font-normal py-1.5 pr-6">Metric</th><th className="font-normal pr-6">At run time</th><th className="font-normal">Re-scored</th></tr></thead>
              <tbody>
                {([
                  ["Citation precision (cited IDs that exist in the evidence)", pc(lm.citationPrecision), pc(lr.citationPrecision)],
                  ["Numeric fidelity (numbers found in the cited evidence)", pc(lm.numericFidelity), pc(lr.numericFidelity)],
                  ["Unit fidelity", pc(lm.unitFidelity), pc(lr.unitFidelity)],
                  ["Microgravity results told as lunar or Martian", String(lm.crossGravityMisattributions), String(lr.crossGravityMisattributions)],
                  ["Claims flagged as unverified on screen", pc(lm.unsupportedClaimRate), pc(lr.unsupportedClaimRate)],
                  ["Gap and unanswerable questions where the answer admits the gap", `${lm.gapAdmission.admitted} of ${lm.gapAdmission.n}`, `${lr.gapAdmission.admitted} of ${lr.gapAdmission.n}`],
                  ["Latency, median and 95th percentile", `${(lm.latencyMs.p50 / 1000).toFixed(1)} s, ${(lm.latencyMs.p95 / 1000).toFixed(1)} s`, "same answers"],
                ] as const).map(([k, a, b]) => (
                  <tr key={k} className="border-b border-rule"><th scope="row" className="text-left font-normal py-1.5 pr-6">{k}</th><td className="pr-6">{a}</td><td>{b}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted">
            Flagged claims stay visible with the reason shown; most remaining flags are rounded ranges (“about 21–22 %”) or unit
            conversions the checker cannot confirm. These checks measure faithfulness to the cited NASA text, not whether NASA&apos;s
            results transfer to a mission. Every answer is in{" "}
            <a href="https://github.com/A-K-M-Asifuzzaman/MicroFire-Atlas/blob/main/apps/web/eval/results-live.json" className="link">results-live.json</a>.
          </p>
        </Section>

        <Section id="limits" title="Limitations">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              {experiments.length} BASS tests (thin samples in a small duct, near 1 atm) and {saffireRuns.length} Saffire runs
              (large samples, some at reduced pressure, 54 to 73 kPa) ran in microgravity. Two LUCI burns ran in lunar gravity simulated on a
              spinning rocket, in normal air. No test row comes from the Moon itself or from Martian gravity.
            </li>
            <li>Many flows ended at fan settings with no recorded velocity, so exact quench and blowoff speeds are often unknown.</li>
            <li>Outcome codes are our reading of short crew and ground notes.</li>
            <li>Spread rates appear in NASA figures, not tables, and are not transcribed.</li>
            <li>Flame Vision measures published NASA media in pixels. Without calibration, it cannot report physical flame size or speed.</li>
            <li>Nothing here is a fire-risk prediction or a NASA safety rating.</li>
          </ul>
        </Section>
      </div>
    </div>
  );
}
