import type { Metadata } from "next";
import Link from "next/link";
import { Cite } from "@/components/Cite";
import { OutcomeMark } from "@/components/Outcome";
import { experiments, findings, OUTCOME_STYLE, sources } from "@/lib/data";
import { OBSERVED_MIN } from "@/lib/gaps";
import { LABELS, MATERIAL_CLASS, PRESSURE_SCALE_KPA, SAME_CLASS_CREDIT, scalesFrom, WEIGHTS } from "@/lib/relevance";

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

export default function MethodologyPage() {
  const sc = scalesFrom(experiments);
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 grid gap-12 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label="On this page" className="text-sm lg:sticky lg:top-6 lg:self-start">
        <ul className="space-y-2 text-muted">
          {[
            ["data", "Where the data comes from"],
            ["labels", "Observed, series, derived"],
            ["outcomes", "Outcome codes"],
            ["relevance", "Mission Relevance"],
            ["confidence", "Evidence Confidence"],
            ["gaps", "Evidence gaps"],
            ["ai", "Where AI is used"],
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
        <header>
          <h1 className="display text-3xl sm:text-4xl">How MicroFire Atlas works</h1>
          <p className="mt-3 text-muted max-w-[70ch]">
            Every number and rule behind the site, so you can check it. The scores here are MicroFire Atlas heuristics.
            NASA did not set, review or endorse them.
          </p>
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
            Ranking, comparison and the gap map are deterministic code. The Ask page uses a language model only to phrase
            answers from an evidence package of these records and verified quotes. Every cited ID in an answer is checked against
            that package, and the page states when the evidence does not cover a question. Without the model, every other page
            works unchanged.
          </p>
        </Section>

        <Section id="limits" title="Limitations">
          <ul className="list-disc pl-5 space-y-2">
            <li>{experiments.length} tests, three materials, all thin samples in a small duct, all in orbit near 1 atm.</li>
            <li>Many flows ended at fan settings with no recorded velocity, so exact quench and blowoff speeds are often unknown.</li>
            <li>Outcome codes are our reading of short crew and ground notes.</li>
            <li>Spread rates appear in NASA figures, not tables, and are not transcribed.</li>
            <li>No flame video is included yet, so there is no image analysis on this site.</li>
            <li>Nothing here is a fire-risk prediction or a NASA safety rating.</li>
          </ul>
        </Section>
      </div>
    </div>
  );
}
