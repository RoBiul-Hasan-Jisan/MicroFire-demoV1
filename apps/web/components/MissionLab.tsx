"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";
import { Quote } from "@/components/Cite";
import { EvidenceLadder } from "@/components/EvidenceLadder";
import { AtmosphereProfiles } from "@/components/analyst/AtmosphereProfiles";
import { ConditionInstrument } from "@/components/analyst/ConditionInstrument";
import { EvidenceStatus } from "@/components/analyst/EvidenceStatus";
import { QuestBoard } from "@/components/quest/QuestBoard";
import { ladder } from "@/lib/ontology";
import { FlowO2Plot } from "@/components/FlowO2Plot";
import { Legend, OutcomeTag } from "@/components/Outcome";
import { evidenceRecords, experiments, findings, GROUP_LABEL } from "@/lib/data";
import { confidence, rank, type Gravity, type Scenario } from "@/lib/relevance";
import { RANGES, rankRobustness, SAMPLES, type RankStability } from "@/lib/robustness";
import type { OutcomeGroup } from "@/lib/types";

type Form = {
  oxygen: number;
  flow: number;
  pressureKpa: number;
  gravity: Gravity;
  material: string;
  flowDirection: string;
};

export const CONTEXTS: { id: string; label: string; detail: string; form: Form }[] = [
  {
    id: "iss",
    label: "ISS cabin, fans running",
    detail: "Normal air, near 1 atm, a moderate ventilation flow.",
    form: { oxygen: 21, flow: 10, pressureKpa: 101.3, gravity: "microgravity", material: "any", flowDirection: "any" },
  },
  {
    id: "still-air",
    label: "ISS cabin, ventilation lost",
    detail: "Normal air with almost no airflow, the regime where NASA saw dim, long-lived flames.",
    form: { oxygen: 21, flow: 1, pressureKpa: 101.3, gravity: "microgravity", material: "any", flowDirection: "any" },
  },
  {
    id: "low-o2",
    label: "Reduced-oxygen corner",
    detail: "Oxygen lowered to about 17 % with gentle flow, where many tests quenched.",
    form: { oxygen: 17, flow: 3, pressureKpa: 101.3, gravity: "microgravity", material: "any", flowDirection: "any" },
  },
  {
    id: "exploration",
    label: "Exploration atmosphere A, in orbit",
    detail: "56.5 kPa with 34 % oxygen: one NASA exploration-atmosphere scenario, recommended for future Moon and Mars missions.",
    form: { oxygen: 34, flow: 10, pressureKpa: 56.5, gravity: "microgravity", material: "any", flowDirection: "any" },
  },
  {
    id: "moon-base",
    label: "Lunar habitat, atmosphere A",
    detail: "PMMA in 34 % oxygen at 56.5 kPa, at lunar gravity: the hardest question in this atlas.",
    form: { oxygen: 34, flow: 20, pressureKpa: 56.5, gravity: "lunar", material: "PMMA", flowDirection: "any" },
  },
  {
    id: "mars-fabric",
    label: "Mars habitat, atmosphere A",
    detail: "Cotton-fiberglass fabric in 34 % oxygen at 56.5 kPa, at Martian gravity.",
    form: { oxygen: 34, flow: 10, pressureKpa: 56.5, gravity: "martian", material: "SIBAL fabric", flowDirection: "any" },
  },
  {
    id: "moon-base-alt",
    label: "Lunar habitat, alternate atmosphere",
    detail: "PMMA in 28.5 % oxygen at 66.2 kPa, the alternate exploration atmosphere NASA evaluated later, at lunar gravity.",
    form: { oxygen: 28.5, flow: 20, pressureKpa: 66.2, gravity: "lunar", material: "PMMA", flowDirection: "any" },
  },
  {
    id: "lunar",
    label: "Lunar habitat, normal air",
    detail: "Same air as the ISS, but at lunar gravity, where buoyancy returns.",
    form: { oxygen: 21, flow: 10, pressureKpa: 101.3, gravity: "lunar", material: "any", flowDirection: "any" },
  },
];

const STRONG = 0.6;

function toScenario(f: Form): Scenario {
  return {
    oxygen: f.oxygen,
    flow: f.flow,
    pressureKpa: f.pressureKpa,
    gravity: f.gravity,
    material: f.material === "any" ? undefined : f.material,
    flowDirection: f.flowDirection === "any" ? undefined : f.flowDirection,
  };
}

/** Findings relevant to where the scenario sits. Topic-matched, never generated. */
function findingsForScenario(f: Form) {
  const topics = new Set<string>();
  if (f.flow <= 5) topics.add("airflow");
  if (f.gravity !== "microgravity") topics.add("partial-gravity");
  if (f.oxygen > 21 || f.pressureKpa < 95) topics.add("pressure");
  if (f.oxygen < 19) topics.add("quench");
  return findings.filter((x) => x.topics.some((t) => topics.has(t))).slice(0, 4);
}

/** One line: how stable this test's place is when MicroFire's own weights change. */
function Robust({ r }: { r: RankStability }) {
  return (
    <span className="robust-chip" data-level={r.level} title="Ranking robustness: how stable this rank is when the weights change">
      {r.level === "High" ? "Stable rank" : r.level === "Moderate" ? "Fairly stable" : "Rank shifts"} · rank {r.lo === r.hi ? r.lo : `${r.lo}–${r.hi}`} · top 3 in {Math.round(r.top3 * 100)} %
    </span>
  );
}

export function MissionLab() {
  const params = useSearchParams();
  const initial = CONTEXTS.find((c) => c.id === params.get("context")) ?? CONTEXTS[0];
  const [ctx, setCtx] = useState(initial.id);
  const [form, setForm] = useState<Form>(initial.form);
  const [open, setOpen] = useState<string | null>(null);

  const ranked = useMemo(() => rank(experiments, toScenario(form)), [form]);
  const settled = useDeferredValue(form); // robustness reruns the ranking 1,000 times, so it trails slider drags
  const robust = useMemo(() => rankRobustness(experiments, toScenario(settled)), [settled]);
  const top = ranked.slice(0, 12);
  const strong = ranked.filter((r) => r.score >= STRONG);
  const tally = strong.reduce<Partial<Record<OutcomeGroup, number>>>((acc, r) => {
    acc[r.experiment.outcome_group] = (acc[r.experiment.outcome_group] ?? 0) + 1;
    return acc;
  }, {});
  const quotes = findingsForScenario(form);
  const question = useMemo(
    () => ({ material: form.material === "any" ? undefined : form.material, oxygen: form.oxygen, pressureKpa: form.pressureKpa, gravity: form.gravity, flow: form.flow }),
    [form],
  );

  const lad = useMemo(() => ladder(evidenceRecords, findings, question), [question]);
  const briefHref = `/mission/brief?${new URLSearchParams({ o2: String(form.oxygen), kpa: String(form.pressureKpa), flow: String(form.flow), g: form.gravity, m: form.material, dir: form.flowDirection })}`;

  const best = lad.direct[0] ?? lad.analogous[0];
  const gaps = best ? [...new Set(best.differs.map((d) => d.dim === "flow" ? "airflow" : d.dim))] : [];
  const gravityName = form.gravity === "microgravity" ? "microgravity" : form.gravity === "lunar" ? "lunar gravity" : "Martian gravity";
  const askHref = `/ask?${new URLSearchParams({ q: `What does NASA evidence say about ${form.material === "any" ? "materials" : form.material} at ${form.oxygen}% oxygen, ${form.pressureKpa} kPa and ${form.flow} cm/s airflow in ${gravityName}?` })}`;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setCtx("custom");
    setForm((f) => ({ ...f, [k]: v }));
  };

  return (
    <div className="mission-workspace analyst space-y-12">
      <QuestBoard page="mission" crew="tala" />
      <section aria-labelledby="presets" className="analyst-presets" data-guide="contexts">
        <h2 id="presets" className="sr-only">Mission presets</h2>
        <p className="text-sm text-muted">Start from a mission</p>
        <div className="analyst-preset-row">
          {CONTEXTS.map((c) => (
            <button key={c.id} onClick={() => { setCtx(c.id); setForm(c.form); }} aria-pressed={ctx === c.id} className="analyst-preset" title={c.detail}>
              {c.label}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="at-a-glance" className="mission-glance" data-direct={lad.direct.length > 0}>
        <h2 id="at-a-glance" className="mission-glance-h">For this scenario</h2>
        <p className="mission-glance-v">
          {lad.direct.length > 0
            ? `${lad.direct.length} NASA test record${lad.direct.length === 1 ? "" : "s"} match every condition you set.`
            : "No NASA test matches every condition you set."}
        </p>
        <dl className="mission-glance-d">
          {best && (<div><dt>Closest record</dt><dd><Link href={best.record.href} className="link">{best.record.label}</Link></dd></div>)}
          {gaps.length > 0 && (<div><dt>Where it differs</dt><dd>{gaps.join(", ")}</dd></div>)}
          <div><dt>Records within all tolerances</dt><dd>{lad.direct.length} of {evidenceRecords.length}</dd></div>
        </dl>
        <p className="mission-glance-n">This is a statement about evidence, not a prediction of how a fire would behave.</p>
        <div className="mission-glance-a">
          <Link href={askHref} className="mission-glance-btn">Explain this result (AI, with NASA sources)</Link>
          <Link href={briefHref} className="mission-glance-btn mission-glance-btn-2">Export an evidence brief</Link>
        </div>
      </section>

      <section aria-labelledby="step-atmosphere" className="analyst-step">
        <h2 id="step-atmosphere" className="analyst-step-title"><span>1</span>Cabin atmosphere</h2>
        <AtmosphereProfiles o2={form.oxygen} kpa={form.pressureKpa} onPick={(o2, kpa) => { setCtx("custom"); setForm((f) => ({ ...f, oxygen: o2, pressureKpa: kpa })); }} />
      </section>

      <section aria-labelledby="step-conditions" className="analyst-step" data-guide="sliders">
        <h2 id="step-conditions" className="analyst-step-title"><span>2</span>Mission conditions, on top of NASA&apos;s evidence</h2>
        <p className="analyst-step-note">Drag a marker. Each tick underneath is one NASA test record at its recorded value, and the dashed window is the tolerance the Evidence Ladder uses.</p>
        <ConditionInstrument form={form} set={set} records={evidenceRecords} joint={lad.direct.length} />
      </section>

      <section aria-labelledby="step-status" className="analyst-step">
        <h2 id="step-status" className="analyst-step-title"><span>3</span>Evidence status</h2>
        <EvidenceStatus q={question} l={lad} briefHref={briefHref} />
      </section>

      <div className="min-w-0 space-y-10">
        <h2 className="analyst-step-title"><span>4</span>How close the evidence gets</h2>
        <EvidenceLadder q={question} />

        <section aria-labelledby="summary">
          <h2 id="summary" className="display text-2xl">
            {strong.length === 0
              ? "No test scores 60 or higher for this scenario"
              : `${strong.length} test${strong.length === 1 ? "" : "s"} score 60 or higher`}
          </h2>
          {strong.length > 0 && (
            <p className="mt-2 text-muted max-w-[70ch]">
              Among them, NASA recorded:{" "}
              {(Object.keys(tally) as OutcomeGroup[])
                .map((g) => `${tally[g]} ${GROUP_LABEL[g].toLowerCase()}`)
                .join(", ")}
              . This is a count of past tests near your conditions, not a probability that a fire will behave this way.
            </p>
          )}
          <div className="mt-6 bg-panel border border-rule rounded-sm p-3 sm:p-4">
            <FlowO2Plot
              data={experiments}
              highlight={top.slice(0, 5).map((r) => r.experiment.id)}
              scenario={{ oxygen: form.oxygen, flow: form.flow }}
              height={340}
              label="All tests; dashed lines mark your scenario, the five most relevant are highlighted"
            />
            <Legend className="mt-2 px-1 text-xs" />
            <p className="mt-2 px-1 text-xs text-faint">Dashed cyan lines mark your oxygen and airflow. Oxygen above 21.5 % lies off the top of the chart: no test went there.</p>
          </div>
        </section>

        <section aria-labelledby="ranked">
          <h2 id="ranked" className="analyst-step-title"><span>5</span>Most similar BASS-II tests, with the arithmetic</h2>
          <p className="mt-2 text-sm text-muted max-w-[78ch]">
            Why this list can differ from the ladder above: the ladder looks at every NASA family (Saffire and the lunar-gravity rocket tests included) and ranks by how many conditions match. This list scores only the BASS and BASS-II space-station tests, using MicroFire&apos;s weighted similarity score, so its first row need not be the ladder&apos;s closest record.
          </p>
          <p className="mt-1 text-sm text-faint">
            Mission Relevance, Evidence Confidence and Ranking Robustness are three separate project heuristics, not NASA
            ratings. Robustness reranks every test {SAMPLES.toLocaleString("en-US")} times with each weight varied ×
            {RANGES.weight[0]}–{RANGES.weight[1]}, the pressure scale {RANGES.pressureScaleKpa[0]}–{RANGES.pressureScaleKpa[1]} kPa and
            the similar-material credit {RANGES.classCredit[0]}–{RANGES.classCredit[1]}.{" "}
            <Link href="/methodology" className="link">
              See the formula
            </Link>
          </p>
          <details className="mission-ranked-fold" open={strong.length > 0}>
            <summary>{strong.length > 0 ? "Show the ranked tests" : "No close BASS-II match (every score is below 60). Show the 12 most similar anyway"}</summary>
          <ol className="ranked-records mt-4">
            {top.map((r, i) => {
              const e = r.experiment;
              const conf = confidence(e, experiments);
              const isOpen = open === e.id;
              return (
                <li key={e.id} className="py-3">
                  <div className="grid grid-cols-[2rem_minmax(0,1fr)_auto] sm:grid-cols-[2rem_6rem_minmax(0,1fr)_10rem_7rem] gap-x-4 gap-y-1 items-center">
                    <span className="text-faint num">{i + 1}</span>
                    <Link href={`/experiments/${e.id}`} className="link font-medium">
                      {e.test_id}
                    </Link>
                    <span className="text-sm text-muted col-span-2 sm:col-span-1 order-last sm:order-none">
                      {e.material}, {e.oxygen_vol_pct}% O₂, {e.flow_direction}{" "}
                      <span className="block sm:inline">
                        <OutcomeTag outcome={e.outcome} label={e.outcome_label} />
                      </span>
                      {robust.get(e.id) && <Robust r={robust.get(e.id)!} />}
                    </span>
                    <span className="flex items-center gap-2 w-28 sm:w-auto" aria-label={`Relevance ${Math.round(r.score * 100)} of 100`}>
                      {/* SVG attributes, not inline styles, so the strict CSP needs no 'unsafe-inline' */}
                      <svg className="flex-1 min-w-0 h-1.5" aria-hidden="true">
                        <rect width="100%" height="100%" rx="3" fill="var(--rule)" />
                        <rect width={`${r.score * 100}%`} height="100%" rx="3" fill="var(--signal)" />
                      </svg>
                      <span className="num text-sm w-7 text-right">{Math.round(r.score * 100)}</span>
                    </span>
                    <button
                      onClick={() => setOpen(isOpen ? null : e.id)}
                      aria-expanded={isOpen}
                      className="text-xs text-muted hover:text-ink text-right hidden sm:block"
                    >
                      {isOpen ? "Hide" : "Why this score"}
                    </button>
                  </div>
                  <button onClick={() => setOpen(isOpen ? null : e.id)} aria-expanded={isOpen} className="sm:hidden text-xs text-muted mt-1 ml-12">
                    {isOpen ? "Hide" : "Why this score"}
                  </button>
                  {isOpen && (
                    <div className="mt-3 ml-0 sm:ml-12 grid gap-6 md:grid-cols-2 text-sm">
                      <table className="num condensed w-full">
                        <caption className="text-left text-muted mb-1">Relevance terms (weight × match)</caption>
                        <tbody>
                          {r.terms.map((t) => (
                            <tr key={t.key} className="border-t border-rule">
                              <th scope="row" className="text-left font-normal text-muted py-1 pr-3">
                                {t.label}
                              </th>
                              <td className="pr-3">{t.testValue}</td>
                              <td className="pr-3 text-faint">×{t.weight}</td>
                              <td className={t.sim == null ? "text-flame" : ""}>{t.sim == null ? "not reported" : t.sim.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div>
                        <p className="text-muted">
                          Evidence confidence: <span className="text-ink">{conf.level}</span>, coverage {Math.round(r.coverage * 100)}%
                        </p>
                        {robust.get(e.id) && (
                          <p className="mt-1 text-muted">
                            Ranking robustness: median rank {robust.get(e.id)!.median}, range {robust.get(e.id)!.lo}–{robust.get(e.id)!.hi} (5th–95th
                            percentile), top 3 in {Math.round(robust.get(e.id)!.top3 * 100)} % of variations.
                          </p>
                        )}
                        <ul className="mt-2 space-y-1">
                          {conf.checks.map((c) => (
                            <li key={c.label} className={c.pass ? "" : "text-faint"}>
                              {c.pass ? "✓" : "–"} {c.label}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          </details>
        </section>

        {quotes.length > 0 && (
          <section aria-labelledby="context-findings">
            <h2 id="context-findings" className="analyst-step-title"><span>6</span>What NASA reports about conditions like these</h2>
            <div className="mt-6 grid gap-x-10 gap-y-8 md:grid-cols-2">
              {quotes.map((f) => (
                <Quote key={f.id} f={f} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
