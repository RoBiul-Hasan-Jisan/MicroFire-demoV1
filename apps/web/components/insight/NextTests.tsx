"use client";

import { useState } from "react";
import type { Gravity } from "@/lib/gravity-bridge";
import { describeTest, GRAVITY_LABEL, pct, whyThisTest, type NextTests, type Sensitivity } from "@/lib/next-tests";
import css from "./Insight.module.css";

const GRAVS: Gravity[] = ["microgravity", "lunar", "martian"];

export function NextTestsView({ data, o2Max, sens }: { data: NextTests; o2Max: number; sens: Sensitivity }) {
  const [g, setG] = useState<Gravity>("lunar");
  const cells = data.grid[g];
  const o2s = [...new Set(cells.map((c) => c.o2))].sort((a, b) => a - b);
  const flows = [...new Set(cells.map((c) => c.forced))].sort((a, b) => b - a);
  const max = Math.max(...GRAVS.flatMap((x) => data.grid[x].map((c) => c.gain)));
  const at = (o: number, f: number) => cells.find((c) => c.o2 === o && c.forced === f);
  const picks = data.headline.batch;
  const pickAt = (o: number, f: number) => picks.find((s) => s.gravity === g && s.o2 === o && s.forced === f);
  const total = picks[picks.length - 1].cumulative_uncertainty_removed;

  return (
    <div className={css.page}>
      <section aria-labelledby="batch">
        <h2 id="batch" className="display text-2xl">If NASA could run only {picks.length} more tests</h2>
        <p className="mt-2 text-muted max-w-[78ch]">
          Run in this order, they are expected to remove about <b>{pct(total)}</b> of today&apos;s uncertainty about {data.targets.length} mission cabins. Each pick is chosen given the ones before it, so it never repeats what an earlier test already settles.
        </p>
        <ol className={`${css.steps} mt-4`}>
          {picks.map((s) => (
            <li key={s.rank} className={css.step}>
              <span className={css.num} aria-hidden="true">{s.rank}</span>
              <div>
                <h3 className="font-semibold">{describeTest(s)}</h3>
                <p className="text-sm text-muted mt-1">{whyThisTest(s, s.o2 > o2Max)}</p>
                <div className={css.bar} role="img" aria-label={`${pct(s.cumulative_uncertainty_removed)} of uncertainty removed after ${s.rank} tests`}><i style={{ width: pct(s.cumulative_uncertainty_removed) }} /></div>
                <p className="text-xs text-muted mt-1">Cumulative uncertainty removed: {pct(s.cumulative_uncertainty_removed)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="best">
        <h2 id="best" className="display text-2xl">Best single test in each gravity</h2>
        <div className={`${css.cards} mt-4`}>
          {GRAVS.map((x) => {
            const b = data.headline.best_by_gravity[x];
            return <div key={x} className={css.card}><p className="text-signal text-sm">{GRAVITY_LABEL[x]}</p><p className="mt-1 font-semibold">{describeTest({ ...b, direction: b.direction as "concurrent" | "opposed" })}</p><p className="text-sm text-muted mt-1">Alone removes {pct(b.alone_uncertainty_removed)}.</p></div>;
          })}
        </div>
      </section>

      <section aria-labelledby="map">
        <h2 id="map" className="display text-2xl">Where one more test is worth most</h2>
        <p className="mt-2 text-muted max-w-[78ch]">Each cell is the share of uncertainty a single test there is expected to remove (best flow direction). Numbered badges mark the batch above. Blank cells were not scored.</p>
        <div className={`${css.tabs} mt-3`} role="group" aria-label="Gravity">
          {GRAVS.map((x) => <button key={x} className={css.tab} aria-pressed={g === x} onClick={() => setG(x)}>{GRAVITY_LABEL[x]}</button>)}
        </div>
        <div className={`${css.scroll} mt-3`}>
          <table className={css.heat}>
            <caption className="sr-only">Expected uncertainty removed by a single test, by oxygen and forced airflow</caption>
            <thead><tr><th scope="col">Forced flow ↓ / O₂ % →</th>{o2s.map((o) => <th key={o} scope="col">{o}</th>)}</tr></thead>
            <tbody>
              {flows.map((f) => (
                <tr key={f}>
                  <th scope="row">{f === 0 ? "none" : `${f} cm/s`}</th>
                  {o2s.map((o) => {
                    const c = at(o, f);
                    const k = pickAt(o, f);
                    return <td key={o} style={{ background: c ? `rgba(86,212,228,${0.08 + 0.85 * (c.gain / max)})` : "transparent", color: c && c.gain / max > 0.6 ? "#04161a" : undefined }}>
                      {c ? pct(c.gain) : ""}{k && <span className={css.pick} aria-label={`Recommended test number ${k.rank}`}>{k.rank}</span>}
                    </td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="targets" className={css.card}>
        <h2 id="targets" className="display text-xl">What the tests are meant to pin down</h2>
        <ul className="mt-3 grid gap-2 text-sm">
          {data.targets.map((t) => { const p = data.headline.target_prior.find((x) => x.id === t.id)!; return <li key={t.id}>{t.label}: model currently says <b>{pct(p.p_mean)}</b> chance of a sustained flame, ± {pct(p.p_sd)}.</li>; })}
        </ul>
      </section>

      <section aria-labelledby="sens" className={css.card}>
        <h2 id="sens" className="display text-xl">Do the picks survive different assumptions?</h2>
        <p className="mt-2 text-sm text-muted max-w-[78ch]">Two assumptions in this plan are ours, not NASA&apos;s: how strong buoyant flow is, and how unsure the model is outside its tested range. We re-ran the whole plan under {sens.settings.length} settings.</p>
        <p className="mt-3 text-sm"><b>{sens.always_includes_partial_gravity_test ? "Every setting still puts at least one partial-gravity test in the batch." : "In some settings no partial-gravity test makes the batch."}</b> {sens.default_batch_identical_everywhere ? "The exact batch is identical in every setting." : "The exact order does change, so read the ranking as the kind of test to run, not a fixed order."}</p>
        <div className={`${css.scroll} mt-3`}>
          <table className={css.tbl}>
            <thead><tr><th>Setting</th><th>Four tests chosen</th><th>Uncertainty removed</th></tr></thead>
            <tbody>{sens.settings.map((s) => <tr key={s.id}><td>{s.label}</td><td className="text-xs">{s.batch.map((b) => `${b.gravity === "microgravity" ? "ISS" : b.gravity === "lunar" ? "Moon" : "Mars"} ${b.o2} %${b.forced ? ` ${b.forced} cm/s` : ""}`).join(" · ")}</td><td className={css.mono}>{pct(s.uncertainty_removed_by_batch)}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-muted">How often each default pick appears: {sens.default_picks_survival.map((p) => `#${p.rank} in ${p.appears_in} of ${p.of} settings`).join("; ")}. The recommendation is robust in kind (high-oxygen, partial-gravity tests with no forced airflow) and less so in exact order.</p>
      </section>

      <section aria-labelledby="assume" className={css.card}>
        <h2 id="assume" className="display text-xl">How much to trust this</h2>
        <ul className="mt-3 grid gap-2 text-sm text-muted list-disc pl-5">{data.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
        <p className="mt-4 text-sm"><b>What changes without the extrapolation assumption?</b> Using only the bootstrap spread and the bridge, the first four tests would be: {data.bootstrap_only.batch.map((s) => describeTest(s)).join("; ")}. {sameTop(data) ? "The top pick is the same either way." : "The order shifts, so treat the ranking as a guide to the kind of test, not an exact order."}</p>
      </section>
    </div>
  );
}

const sameTop = (d: NextTests) => {
  const a = d.headline.batch[0], b = d.bootstrap_only.batch[0];
  return a.gravity === b.gravity && a.o2 === b.o2 && a.forced === b.forced;
};
