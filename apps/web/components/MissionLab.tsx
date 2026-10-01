"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Quote } from "@/components/Cite";
import { FlowO2Plot } from "@/components/FlowO2Plot";
import { Legend, OutcomeTag } from "@/components/Outcome";
import { experiments, findings, GROUP_LABEL } from "@/lib/data";
import { confidence, outsideEvidence, rank, type Gravity, type Scenario } from "@/lib/relevance";
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
    label: "Exploration atmosphere",
    detail: "56.5 kPa with 34 % oxygen, the cabin atmosphere NASA recommends for Moon and Mars missions.",
    form: { oxygen: 34, flow: 10, pressureKpa: 56.5, gravity: "microgravity", material: "any", flowDirection: "any" },
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

export function MissionLab() {
  const params = useSearchParams();
  const initial = CONTEXTS.find((c) => c.id === params.get("context")) ?? CONTEXTS[0];
  const [ctx, setCtx] = useState(initial.id);
  const [form, setForm] = useState<Form>(initial.form);
  const [open, setOpen] = useState<string | null>(null);

  const ranked = useMemo(() => rank(experiments, toScenario(form)), [form]);
  const outside = useMemo(() => outsideEvidence(experiments, toScenario(form)), [form]);
  const top = ranked.slice(0, 12);
  const strong = ranked.filter((r) => r.score >= STRONG);
  const tally = strong.reduce<Partial<Record<OutcomeGroup, number>>>((acc, r) => {
    acc[r.experiment.outcome_group] = (acc[r.experiment.outcome_group] ?? 0) + 1;
    return acc;
  }, {});
  const quotes = findingsForScenario(form);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setCtx("custom");
    setForm((f) => ({ ...f, [k]: v }));
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside aria-label="Scenario" className="space-y-7 lg:sticky lg:top-6 lg:self-start">
        <fieldset>
          <legend className="text-sm text-muted">Start from a mission context</legend>
          <div className="mt-2 grid gap-2">
            {CONTEXTS.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setCtx(c.id);
                  setForm(c.form);
                }}
                aria-pressed={ctx === c.id}
                className={`text-left px-3 py-2.5 rounded-sm border text-sm ${
                  ctx === c.id ? "border-signal bg-panel" : "border-rule hover:border-rule-strong"
                }`}
              >
                <span className="font-medium">{c.label}</span>
                <span className="block text-xs text-muted mt-0.5">{c.detail}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-5 text-sm">
          <legend className="text-muted">Or set conditions</legend>
          <Slider label="Oxygen" unit="%" value={form.oxygen} min={14} max={36} step={0.5} onChange={(v) => set("oxygen", v)} />
          <Slider label="Airflow" unit="cm/s" value={form.flow} min={0.5} max={60} step={0.5} onChange={(v) => set("flow", v)} />
          <Slider label="Pressure" unit="kPa" value={form.pressureKpa} min={50} max={102} step={0.5} onChange={(v) => set("pressureKpa", v)} />
          <label className="block">
            <span className="text-muted">Gravity</span>
            <select value={form.gravity} onChange={(e) => set("gravity", e.target.value as Gravity)} className="mt-1 w-full bg-panel border border-rule rounded-sm px-2 py-2">
              <option value="microgravity">Microgravity (orbit)</option>
              <option value="lunar">Lunar</option>
              <option value="martian">Martian</option>
            </select>
          </label>
          <label className="block">
            <span className="text-muted">Material</span>
            <select value={form.material} onChange={(e) => set("material", e.target.value)} className="mt-1 w-full bg-panel border border-rule rounded-sm px-2 py-2">
              <option value="any">Any material</option>
              <option>PMMA</option>
              <option>SIBAL fabric</option>
              <option>Nomex</option>
            </select>
          </label>
          <label className="block">
            <span className="text-muted">Flow direction</span>
            <select value={form.flowDirection} onChange={(e) => set("flowDirection", e.target.value)} className="mt-1 w-full bg-panel border border-rule rounded-sm px-2 py-2">
              <option value="any">Either</option>
              <option value="opposed">Opposed</option>
              <option value="concurrent">Concurrent</option>
            </select>
          </label>
        </fieldset>
      </aside>

      <div className="min-w-0 space-y-10">
        {outside.length > 0 ? (
          <section role="status" className="border border-flame/60 bg-panel rounded-sm p-5">
            <h2 className="font-semibold text-flame">Direct evidence under these exact conditions is limited</h2>
            <ul className="mt-2 space-y-1 text-[15px]">
              {outside.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-muted">
              The tests below are the nearest evidence available, not a prediction for your scenario.
            </p>
          </section>
        ) : (
          <section role="status" className="border border-rule bg-panel rounded-sm p-5">
            <h2 className="font-semibold">Your scenario sits inside the tested range</h2>
            <p className="mt-1 text-sm text-muted">Oxygen, airflow and pressure are all within values NASA tested in this atlas.</p>
          </section>
        )}

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
          <h2 id="ranked" className="display text-xl">
            Most relevant NASA tests
          </h2>
          <p className="mt-1 text-sm text-faint">
            Mission Relevance and Evidence Confidence are project heuristics, not NASA ratings.{" "}
            <Link href="/methodology" className="link">
              See the formula
            </Link>
          </p>
          <ol className="mt-4 divide-y divide-rule border-y border-rule">
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
                    </span>
                    <span className="flex items-center gap-2" aria-label={`Relevance ${Math.round(r.score * 100)} of 100`}>
                      {/* SVG attributes, not inline styles, so the strict CSP needs no 'unsafe-inline' */}
                      <svg className="flex-1 h-1.5" aria-hidden="true">
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
        </section>

        {quotes.length > 0 && (
          <section aria-labelledby="context-findings">
            <h2 id="context-findings" className="display text-xl">
              What NASA reports about conditions like these
            </h2>
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

function Slider(props: { label: string; unit: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="flex justify-between">
        <span className="text-muted">{props.label}</span>
        <span className="num">
          {props.value} {props.unit}
        </span>
      </span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[var(--signal)]"
      />
    </label>
  );
}
