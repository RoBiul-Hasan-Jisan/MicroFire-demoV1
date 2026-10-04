import type { Metadata } from "next";
import Link from "next/link";
import { Cite } from "@/components/Cite";
import { OutcomeMark } from "@/components/Outcome";
import { evidenceRecords, experiments, findings, OUTCOME_STYLE, saffireRuns, sources } from "@/lib/data";
import { FAMILIES, ladder, TOLERANCE } from "@/lib/ontology";
import { FRONTIER } from "@/lib/frontier";
import { OBSERVED_MIN } from "@/lib/gaps";
import { LABELS, MATERIAL_CLASS, PRESSURE_SCALE_KPA, rank, SAME_CLASS_CREDIT, scalesFrom, WEIGHTS } from "@/lib/relevance";
import { ladderRobustness, RANGES, rankRobustness, SAMPLES } from "@/lib/robustness";
import { runEval, type EvalQuestion } from "@/lib/eval";
import { FoolTheChecker } from "@/components/method/FoolTheChecker";
import { WeightPlayground } from "@/components/method/WeightPlayground";
import { QuestBoard } from "@/components/quest/QuestBoard";
import mstyles from "@/components/method/Method.module.css";
import modelJson from "@/data/model.json";
import evalSet from "@/eval/microfire-eval-v1.json";
import live from "@/eval/results-live.json";

export const metadata: Metadata = { title: "Methodology" };

type ModelReport = { n_rows: number; n_sustained: number; n_not_sustained: number; n_series: number; cv: string; models: Record<string, { accuracy: number; balanced_accuracy: number; brier: number; log_loss: number }>; coefficients_standardised: Record<string, number>; caveats: string[] };
const MODEL_REPORT = (modelJson as unknown as { report: ModelReport }).report;
const MODEL_NAMES: Record<string, string> = {
  baseline_series_prior: "No-skill baseline",
  logistic_oxygen_only: "Oxygen only",
  logistic_oxygen_flow_direction_SHIPPED: "Oxygen + flow + direction (shipped)",
  logistic_all_features_with_material: "All features incl. material",
  logistic_no_material_leave_one_material_out: "Hide a whole material (stress test)",
};

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

export default function MethodologyPage() {
  const sc = scalesFrom(experiments);
  const moon = FRONTIER.find((f) => f.id === "moon-base")!;
  const ml = ladder(evidenceRecords, findings, moon.q);
  const demo = { material: "PMMA", oxygen: 16.5, flow: 5, gravity: "microgravity" as const, flowDirection: "opposed" };
  const demoRank = rank(experiments, demo).slice(0, 5);
  const demoRob = rankRobustness(experiments, demo);
  const moonRob = ladderRobustness(evidenceRecords, findings, moon.q);
  const ev = runEval(evalSet.questions as EvalQuestion[], experiments, findings, saffireRuns);
  const pc = (x: number | null) => (x == null ? "—" : `${Math.round(x * 1000) / 10} %`);
  const lm = live.metrics, lr = live.rescored;
  return (
    <div className="explorer-page method-page mx-auto max-w-7xl px-4 sm:px-6 py-12 grid grid-cols-1 gap-12 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label="On this page" className="text-sm lg:sticky lg:top-6 lg:self-start">
        <ul className="space-y-2 text-muted">
          {[
            ["data", "Where the data comes from"],
            ["ladder", "The Evidence Ladder"],
            ["labels", "Observed, series, derived"],
            ["outcomes", "Outcome codes"],
            ["relevance", "Mission Relevance"],
            ["robustness", "Ranking robustness"],
            ["confidence", "Evidence Confidence"],
            ["gaps", "Evidence gaps"],
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
            <dd className="text-muted">Solid-fuel tests that differ in named ways, listed on each card. Fewer differences rank higher.</dd>
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
                        {f.phase !== "solid" ? "Mechanistic" : f.id === "bass2" || f.id === "saffire" ? "Direct (test rows)" : "Analogous (findings)"}
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

        <Section id="ai" title="Where AI is used">
          <p>
            Ranking, the Evidence Ladder, comparison and the gap map are deterministic code. The Ask page uses a language model
            only to phrase answers from an evidence package of these records and verified quotes. Each claim in an answer is
            checked before it is shown: cited IDs must be in the package, numbers must appear in the cited record, and the page
            flags unit mix-ups, microgravity results described as lunar, causal or safety wording, and predictions. Without the
            model, every other page works unchanged.
          </p>
        </Section>

        <Section id="model" title="Outcome model">
          <p>
            The <Link href="/predict" className="link">Outcome Model</Link> estimates the chance that a microgravity flame is sustained, given oxygen,
            airflow speed and flow direction. It is a regularised logistic regression trained offline by <code>pipelines/train_models.py</code> on{" "}
            {MODEL_REPORT.n_rows} labelled tests ({MODEL_REPORT.n_sustained} sustained, {MODEL_REPORT.n_not_sustained} went out or never ignited) in{" "}
            {MODEL_REPORT.n_series} test series. Rows with no stated outcome, and rows where the crew shut the flow off themselves, are excluded.
            Nothing is filled in: a value the source does not state stays empty.
          </p>
          <p>
            Scores come from {MODEL_REPORT.cv} cross-validation: a whole flight or material group is hidden, then predicted, so near-duplicate tests cannot
            leak between training and testing. Lower Brier and log loss are better.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted"><tr><th>Model</th><th>Accuracy</th><th>Balanced acc.</th><th>Brier</th><th>Log loss</th></tr></thead>
              <tbody>
                {Object.entries(MODEL_REPORT.models).map(([k, v]) => (
                  <tr key={k} className="border-t border-rule"><td>{MODEL_NAMES[k] ?? k}</td><td>{v.accuracy}</td><td>{v.balanced_accuracy}</td><td>{v.brier}</td><td>{v.log_loss}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Material and thickness did not improve the cross-validated scores, so the shipped model leaves them out; materials are compared in the observed
            ranking instead. Each prediction carries a 90 % bootstrap interval (200 refits) and a warning when the inputs are outside the tested range. The
            feature set was chosen with the same cross-validation it is scored on, so the scores are slightly optimistic, and with this few rows a few points
            between models is noise. Spread rate has only 4 measured values and is reported, not modelled.
          </p>
          <p>
            On the Ask page the estimate enters the evidence package as one extra item, <code>M:outcome-model</code>, placed after all NASA evidence. It is only
            added when the question gives both oxygen and airflow, never for lunar or Mars gravity, and the claim checker treats it like any other cited item.
          </p>
        </Section>

        <Section id="evaluate" title="Evaluate MicroFire AI">
          <p>
            MicroFire-Eval v1 is {ev.questions} questions written before the measurements and then frozen: direct lookups, numbers,
            comparisons, synthesis across reports, mission scenarios, deliberately unanswerable questions and misleading premises.
            Gold answers are NASA record IDs taken from the data, not from the system. When the system failed a question, the
            system was changed, never the question.{" "}
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
          <h3 className="text-lg font-semibold">With the model: one paid run, {lm.ranAt.slice(0, 10)}</h3>
          <p>
            All {lm.questions} questions were sent to the live Ask pipeline with {lm.model}. {lm.questions - lm.aiAnswers} matched no
            evidence, so the model was never called. The {lm.claims} claims in the other answers were checked by
            the same verifier users see. Re-scored: the saved answers re-checked after we fixed verifier false alarms (chemical
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
              (large samples, some at reduced pressure, 54 to 73 kPa). All {evidenceRecords.length} test rows ran in microgravity: no test row
              comes from Moon or Mars gravity.
            </li>
            <li>Many flows ended at fan settings with no recorded velocity, so exact quench and blowoff speeds are often unknown.</li>
            <li>Outcome codes are our reading of short crew and ground notes.</li>
            <li>Spread rates appear in NASA figures, not tables, and are not transcribed.</li>
            <li>Flame Vision measures published NASA media in pixels. Without calibration, it cannot report physical flame size or speed.</li>
            <li>The Outcome Model is a statistical estimate from about {MODEL_REPORT.n_rows} microgravity tests, not a NASA safety rating, and it is not valid for Moon or Mars gravity or for conditions far outside the tested range. Nothing else here is a fire-risk prediction.</li>
          </ul>
        </Section>
      </div>
    </div>
  );
}
