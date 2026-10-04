import type { Metadata } from "next";
import Link from "next/link";
import { Cite } from "@/components/Cite";
import { EvidenceStatus } from "@/components/analyst/EvidenceStatus";
import { evidenceRecords, experiments, findings, sources } from "@/lib/data";
import { profileFor } from "@/lib/atmospheres";
import { FAMILIES, ladder, TOLERANCE, type MissionQuestion } from "@/lib/ontology";
import { rank, type Gravity } from "@/lib/relevance";
import { ladderRobustness, rankRobustness, SAMPLES } from "@/lib/robustness";
import { PrintButton } from "./PrintButton";
import { Discover } from "@/components/quest/Discover";

export const metadata: Metadata = { title: "Mission Evidence Brief", robots: { index: false } };

const num = (v: string | string[] | undefined, lo: number, hi: number, d: number) => {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isFinite(n) && n >= lo && n <= hi ? n : d;
};
const GRAVITY: Gravity[] = ["microgravity", "lunar", "martian"];
const G_NAME = { microgravity: "microgravity (orbit)", lunar: "lunar gravity", martian: "Martian gravity" } as const;

/** A printable record of one mission question: what the evidence covers, what it does not, and the test that would close the gap. */
export default async function BriefPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined));
  const materials = new Set(evidenceRecords.map((r) => r.material));
  const g = one("g");
  const m = one("m");
  const q: MissionQuestion = {
    oxygen: num(sp.o2, 10, 40, 34),
    pressureKpa: num(sp.kpa, 30, 110, 56.5),
    flow: num(sp.flow, 0.5, 60, 20),
    gravity: GRAVITY.includes(g as Gravity) ? (g as Gravity) : "lunar",
    material: m && materials.has(m) ? m : undefined,
  };
  const dir = one("dir");
  const l = ladder(evidenceRecords, findings, q);
  const rob = ladderRobustness(evidenceRecords, findings, q);
  const scenario = { oxygen: q.oxygen, flow: q.flow, pressureKpa: q.pressureKpa, gravity: q.gravity, material: q.material, flowDirection: dir === "opposed" || dir === "concurrent" ? dir : undefined };
  const top = rank(experiments, scenario).slice(0, 5);
  const rr = rankRobustness(experiments, scenario);
  const profile = profileFor(q.oxygen!, q.pressureKpa!);
  const corpus = sources.map((s) => s.retrieved).filter(Boolean).sort().pop();
  const generated = new Date().toISOString().slice(0, 10);

  return (
    <article className="brief mx-auto max-w-4xl px-4 sm:px-6 py-10">
      <Discover id="brief" />
      <header className="brief-head">
        <p className="text-signal text-sm">MicroFire Atlas · Mission Evidence Brief</p>
        <h1 className="display text-3xl sm:text-4xl mt-2">
          {q.material ?? "Any material"} at {q.oxygen} % oxygen, {q.pressureKpa} kPa, {q.flow} <span className="font-sans">cm/s</span> airflow, {G_NAME[q.gravity!]}
        </h1>
        <dl className="brief-meta">
          <div><dt>Atmosphere profile</dt><dd>{profile.name}{profile.id !== "custom" && ` (${profile.short})`}</dd></div>
          <div><dt>Generated</dt><dd>{generated}</dd></div>
          <div><dt>Evidence corpus retrieved</dt><dd>{corpus} · {evidenceRecords.length} test records · {findings.length} verified findings · {sources.length} NASA documents</dd></div>
          <div><dt>Method</dt><dd>Evidence Ladder (tolerances ±{TOLERANCE.oxygen} points O₂, ±{TOLERANCE.pressureKpa} kPa, ±{TOLERANCE.flowFraction * 100} % airflow) and Mission Relevance v1, robustness over {SAMPLES.toLocaleString("en-US")} variations</dd></div>
        </dl>
        <div className="brief-actions">
          <PrintButton />
          <Link href={`/mission?context=custom`} className="link text-sm">Back to Mission Lab</Link>
        </div>
      </header>

      <section className="brief-section">
        <h2>1. Evidence status</h2>
        <EvidenceStatus q={q} l={l} />
        <p className="brief-note">
          Tolerance check: across {SAMPLES.toLocaleString("en-US")} variations of the ladder tolerances, the direct rung is empty in {Math.round(rob.directEmpty * 100)} %
          {rob.closest && ` and ${rob.closest.label} stays the closest record in ${Math.round(rob.closest.first * 100)} %`}.
        </p>
      </section>

      <section className="brief-section">
        <h2>2. Closest NASA test records</h2>
        <table className="brief-table">
          <thead><tr><th>Record</th><th>Family</th><th>Conditions</th><th>NASA recorded</th><th>Differs in</th><th>Source</th></tr></thead>
          <tbody>
            {[...l.direct, ...l.analogous].slice(0, 8).map(({ record: r, differs }) => (
              <tr key={r.id}>
                <td>{r.label}</td>
                <td>{FAMILIES[r.family].name}</td>
                <td>{r.material}, {r.oxygen ?? "?"} % O₂, {r.pressureKpa ? `${r.pressureKpa[0]} kPa` : "pressure ?"}, {r.flowCmS ?? "?"} cm/s</td>
                <td>{r.outcomeLabel}</td>
                <td>{differs.length ? differs.map((d) => d.text).join("; ") : "nothing: direct evidence"}</td>
                <td>{r.cite ? <Cite sourceId={r.cite.source_id} page={r.cite.pdf_page} where={r.cite.table} /> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {(l.findings.analogous.length > 0 || l.findings.mechanistic.length > 0) && (
        <section className="brief-section">
          <h2>3. What NASA reports, verbatim</h2>
          <ul className="brief-quotes">
            {[...l.findings.analogous.slice(0, 5).map((x) => ({ ...x, rung: "Analogous" })), ...l.findings.mechanistic.slice(0, 2).map((x) => ({ ...x, rung: "Mechanistic only" }))].map(({ finding: f, family, rung }) => (
              <li key={f.id}>
                <span>{rung} · {family.name}</span>
                <blockquote>“{f.quote}”</blockquote>
                <Cite sourceId={f.source_id} page={f.pdf_page} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="brief-section">
        <h2>4. Gaps, and the test that would close them</h2>
        <ul className="list-disc pl-5 space-y-1">{l.gaps.map((x) => <li key={x.dim + x.text}>{x.text}</li>)}</ul>
        {l.nextExperiment && <p className="mt-3"><strong>Matched-condition test:</strong> {l.nextExperiment}</p>}
      </section>

      <section className="brief-section">
        <h2>5. Most similar BASS-II tests, with ranking robustness</h2>
        <table className="brief-table">
          <thead><tr><th>Test</th><th>Mission Relevance</th><th>Median rank</th><th>Rank range</th><th>Top 3</th></tr></thead>
          <tbody>
            {top.map((r) => { const s = rr.get(r.experiment.id)!; return (
              <tr key={r.experiment.id}><td>{r.experiment.test_id}</td><td>{Math.round(r.score * 100)}</td><td>{s.median}</td><td>{s.lo}–{s.hi}</td><td>{Math.round(s.top3 * 100)} %</td></tr>
            ); })}
          </tbody>
        </table>
      </section>

      <footer className="brief-section brief-fine">
        Mission Relevance, Evidence Confidence and Ranking Robustness are MicroFire Atlas heuristics, documented on the Methodology page. NASA did
        not set, review or endorse them. This brief describes evidence coverage. It is not a fire-risk assessment, a safety rating or a
        prediction. Not affiliated with or endorsed by NASA.
      </footer>
    </article>
  );
}
