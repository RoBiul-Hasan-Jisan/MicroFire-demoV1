import type { Metadata } from "next";
import Link from "next/link";
import { StartTour } from "@/components/JudgeTour";
import { evidenceRecords, experiments, findings } from "@/lib/data";
import { DEMOS, TOUR } from "@/lib/judge";
import { deployedSnapshot, gate, STATUS_LABEL } from "@/lib/model-lab";
import { ladder } from "@/lib/ontology";

export const metadata: Metadata = {
  title: "Judge Mode",
  description: "MicroFire Atlas for judges: three one-click demonstrations and a guided 90-second tour.",
};

/** Judge Mode. Each demonstration's result is computed here from the Evidence Ladder and the model gate. */
export default function TourPage() {
  const snap = deployedSnapshot(experiments);
  const demos = DEMOS.map((d) => {
    const l = ladder(evidenceRecords, findings, d.q);
    const g = gate(snap, d.model);
    const closest = l.direct[0] ?? l.analogous[0];
    return { ...d, direct: l.direct.length, analogous: l.analogous.length, closest, gate: g, gaps: l.gaps };
  });
  return (
    <div className="explorer-page mx-auto max-w-6xl px-4 sm:px-6 py-14">
      <p className="text-signal text-sm">Judge Mode</p>
      <h1 className="display text-4xl sm:text-5xl mt-3">Three questions show what MicroFire does.</h1>
      <p className="mt-4 text-lg text-muted max-w-[66ch]">
        One where NASA tested the condition, one where only nearby evidence exists, and one where the honest answer is that nobody knows yet.
        Every result below is computed from {evidenceRecords.length} NASA test records and {findings.length} checked findings when this page is built.
      </p>

      <ul className="judge-demos">
        {demos.map((d) => (
          <li key={d.id} className="judge-demo" data-kind={d.id}>
            <p className="judge-demo-cap">{d.capability}</p>
            <h2 className="display text-xl">{d.title}</h2>
            <dl>
              <div><dt>Direct tests</dt><dd>{d.direct}</dd></div>
              <div><dt>Analogous</dt><dd>{d.analogous} records</dd></div>
              <div><dt>Closest</dt><dd>{d.closest ? <Link className="link" href={d.closest.record.href}>{d.closest.record.label}</Link> : "none"}{d.closest && d.closest.differs.length > 0 && <> (differs in {d.closest.differs.map((x) => x.dim).join(", ")})</>}</dd></div>
              <div><dt>ML model</dt><dd>{STATUS_LABEL[d.gate.status]}{d.gate.status === "out" || d.gate.status === "insufficient" ? ": prediction blocked" : ""}</dd></div>
              {d.gaps[0] && <div><dt>Main gap</dt><dd>{d.gaps[0].text}</dd></div>}
            </dl>
            <Link href={d.href} className="tour-go">{d.cta}</Link>
          </li>
        ))}
      </ul>

      <section className="mt-16" aria-labelledby="tour-title">
        <h2 id="tour-title" className="display text-3xl">The 90-second judge tour</h2>
        <p className="mt-3 text-muted max-w-[64ch]">A small guide follows you from page to page and says what to look at. Every page stays fully usable; leave the tour at any time.</p>
        <div className="mt-5"><StartTour /></div>
        <ol className="tour-steps mt-8">
          {TOUR.map((s, i) => (
            <li key={s.href} className="tour-step">
              <span className="tour-n" aria-hidden="true">{i + 1}</span>
              <div>
                <p className="tour-meta">{s.seconds} s · {s.criteria}</p>
                <h3 className="display text-xl">{s.title}</h3>
                <p className="mt-1 text-[15px] text-muted">{s.look}</p>
                <Link href={s.href} className="link text-sm">Open this stop</Link>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <p id="done" className="mt-10 text-sm text-faint">
        Characters and scenery are illustrations. NASA footage, photographs, test records and quotations are the evidence. Not affiliated with
        or endorsed by NASA.
      </p>
    </div>
  );
}
