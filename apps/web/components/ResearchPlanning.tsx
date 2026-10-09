"use client";
import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { Cite } from "./Cite";
import { evidenceRecords, findings } from "@/lib/data";
import { FAMILIES, type FamilyId, type MissionQuestion } from "@/lib/ontology";
import { PLANNING_LIMITS, sortGaps, type PlanningSort, type ResearchPlan } from "@/lib/research-planning";
import styles from "./ResearchPlanning.module.css";

const SORTS: [PlanningSort, string][] = [["shared", "Most shared gaps"], ["direct", "Least directly studied"], ["categories", "Most cross-mission"], ["analogous", "Most analogous support"], ["planned", "Future program overlap"], ["gain", "Evidence gain"]];
const GRAVITY: Record<string, string> = { microgravity: "Microgravity", lunar: "Lunar gravity", martian: "Martian gravity", earth: "Earth gravity" };
const DIM_LABEL: Record<string, string> = { combination: "never tested together", material: "material", gravity: "gravity", oxygen: "oxygen", pressure: "pressure", flow: "airflow" };
/** Conditions in plain words, for places that need text (select options, link labels). */
const plain = (q: MissionQuestion) => [q.material, q.gravity && (GRAVITY[q.gravity] ?? q.gravity), q.oxygen != null && `${q.oxygen} % O₂`, q.pressureKpa != null && `${q.pressureKpa} kPa`, q.flow != null && `${q.flow} cm/s airflow`].filter(Boolean).join(" · ");
const words = (k: string) => k.replace(/Mm$/, "").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
const n = (k: number, one: string, many = `${one}s`) => `${k} ${k === 1 ? one : many}`;

/** Conditions as plain-language chips; a chip is flagged when the gap names that dimension as missing. */
function Conditions({ q, missing = [] }: { q: MissionQuestion; missing?: string[] }) {
  const chips: [string, string | null][] = [
    ["material", q.material ?? null], ["gravity", q.gravity ? GRAVITY[q.gravity] ?? q.gravity : null],
    ["oxygen", q.oxygen != null ? `${q.oxygen} % O₂` : null], ["pressure", q.pressureKpa != null ? `${q.pressureKpa} kPa` : null],
    ["flow", q.flow != null ? `${q.flow} cm/s airflow` : null],
  ];
  return <span className={styles.chips}>{chips.filter(([, t]) => t).map(([dim, t]) => <span key={dim} className={styles.chip} data-missing={missing.includes(dim) || undefined}>{t}</span>)}</span>;
}

export function ResearchPlanning({ plan, initialScenario }: { plan: ResearchPlan; initialScenario?: string }) {
  const [sort, setSort] = useState<PlanningSort>("shared"); const [family, setFamily] = useState("all"); const [category, setCategory] = useState("all");
  const start = plan.registry.gaps.find((g) => g.scenarioIds.includes(initialScenario ?? ""));
  const [selected, setSelected] = useState(start?.id ?? plan.registry.gaps[0]?.id);
  const [candidate, setCandidate] = useState(start?.nextExperimentSpec.id ?? plan.gains[0]?.candidateId);
  const gaps = useMemo(() => sortGaps(plan.registry.gaps, sort, plan.gains).filter((g) => (family === "all" || g.evidenceFamilies.includes(family)) && (category === "all" || g.categories.includes(category))), [plan, sort, family, category]);
  const gap = gaps.find((g) => g.id === selected) ?? gaps[0];
  const c = plan.candidates.find((c) => c.id === candidate); const gain = plan.gains.find((g) => g.candidateId === candidate);
  const chooseGap = (id: string) => { setFamily("all"); setCategory("all"); setSelected(id); };
  const families = [...new Set(plan.registry.gaps.flatMap((g) => g.evidenceFamilies))].sort();
  const S = plan.summary, total = S.scenarios;
  const best = S.highestGain;
  const bar = (v: number) => <svg className={styles.bar} viewBox={`0 0 ${total} 1`} preserveAspectRatio="none" aria-hidden="true"><rect width={total} height="1" className={styles.barBg} /><rect width={v} height="1" className={styles.barFill} /></svg>;

  return <section id="research-planning" className={styles.root} aria-labelledby="research-title">
    <header className={styles.hero}>
      <p className={styles.kicker}>Research planning · professional system view</p>
      <h2 id="research-title" className={styles.title}>From one question to shared evidence gaps</h2>
      <p className={styles.lede}>For spacecraft-fire researchers and early-stage evidence analysts, before formal engineering assessment: which missing NASA evidence connects our mission questions? These are coverage questions across a finite curated registry.</p>
      <p className={styles.badge}>MicroFire research-planning heuristic, not NASA prioritization</p>
    </header>

    <ol className={styles.pipeline} aria-label="Research landscape">
      <li><b>{total}</b><span>curated mission questions</span></li>
      <li><b>{total - S.openQuestions}</b><span>already have a direct condition match</span></li>
      <li data-tone="gap"><b>{S.gaps}</b><span>unique open gaps · {S.sharedGaps} shared by distinct questions</span></li>
      <li data-tone="hypo"><b>{S.candidates}</b><span>hypothetical research candidates</span></li>
      {best && <li data-tone="gain"><b>+{best.affectedScenarioIds.length}</b><span>questions the best candidate could cover</span></li>}
    </ol>

    {best && <div className={styles.callout}>
      <div><p className={styles.calloutKicker}>Highest-coverage candidate under this heuristic</p>
        <p className={styles.calloutText}>Could supply represented-condition coverage for {n(best.directGapsPotentiallyClosed.length, "current gap")} and {n(best.affectedScenarioIds.length, "curated question")}.</p>
        <Conditions q={plan.candidates.find((x) => x.id === best.candidateId)!.conditions} /></div>
      <a className={styles.cta} href="#evidence-gain" onClick={() => setCandidate(best.candidateId)}>Inspect it in the planner</a>
    </div>}

    <div className={styles.recurring}><span>Missing most often:</span>{S.recurringDimensions.map((d) => <span key={d.dimension} className={styles.chip} data-missing>{DIM_LABEL[d.dimension] ?? d.dimension} · {n(d.gaps, "gap")} / {n(d.questions, "question")}</span>)}</div>
    <p className={styles.note}>Questions from Challenge Mode reuse the Mission preset; identical questions are not counted again. Dimension counts group distinct physical combinations without merging those gaps. {S.sharedGaps === 0 && "No exact gap is shared by distinct questions in this registry; broader and narrower requirements can still overlap under candidate coverage."}</p>

    <nav className={styles.links} aria-label="Research views"><a href="#research-board">Priority Board</a><a href="#evidence-gain">Evidence Gain Planner</a><a href="#research-scenarios">Mission questions</a><Link href="/methodology#research-planning-method">Rules &amp; limitations</Link></nav>

    <section id="research-board" aria-labelledby="board-title" className={styles.panel}>
      <div className={styles.panelHead}>
        <div><h3 id="board-title">Research Priority Board</h3><p className={styles.note}>Separate dimensions, no composite score. Every registered gap has zero direct records. Analogous support: requested material, at most two condition mismatches. Trace the system from a NASA family or a mission category: families follow the closest records and selected findings; publication findings stay findings, and planned work is listed separately.</p></div>
        <div className={styles.toolbar} aria-label="Trace the system: experiment family → linked evidence → mission questions → open gap → candidate → potential coverage">
          <label>NASA family<select value={family} onChange={(e) => setFamily(e.target.value)}><option value="all">All linked families</option>{families.map((f) => <option value={f} key={f}>{FAMILIES[f as FamilyId]?.name ?? f}</option>)}</select></label>
          <label>Mission category<select value={category} onChange={(e) => setCategory(e.target.value)}><option value="all">All categories</option>{[...new Set(plan.registry.scenarios.map((s) => s.category))].sort().map((k) => <option key={k}>{k}</option>)}</select></label>
          <label>Sort by<select value={sort} onChange={(e) => setSort(e.target.value as PlanningSort)}>{SORTS.map(([id, title]) => <option value={id} key={id}>{title}</option>)}</select></label>
        </div>
      </div>

      <div className={styles.split}>
        <div className={styles.board} role="group" aria-label="Registered gaps">
          {gaps.map((g, i) => <button type="button" key={g.id} aria-pressed={gap?.id === g.id} onClick={() => setSelected(g.id)}>
            <span className={styles.rank}>{i + 1}</span>
            <Conditions q={g.conditions} missing={g.missingDimensions} />
            <span className={styles.missing}>Missing: {g.missingDimensions.map((d) => DIM_LABEL[d] ?? d).join(" + ")}</span>
            <span className={styles.stats}><b>{n(g.scenarioIds.length, "question")}</b><b>{g.directCount} direct</b><b>{g.analogousCount} analogous</b><b>{g.mechanisticCount} mechanistic</b>{g.plannedCoverage.length > 0 && <b data-tone="hypo">FM² planned overlap</b>}</span>
          </button>)}
          {!gaps.length && <p role="status" className={styles.note}>No registered gap matches these filters.</p>}
        </div>

        {gap && <article className={styles.detail} aria-label="Selected research gap" aria-live="polite">
          <p className={styles.tag}>Unresolved atlas coverage · not a NASA experiment</p>
          <Conditions q={gap.conditions} missing={gap.missingDimensions} />
          <p className={styles.missingBig}>Missing together: {gap.missingDimensions.map((d) => DIM_LABEL[d] ?? d).join(" + ")}</p>
          <h4>Affected mission questions</h4>
          <ul>{gap.scenarioIds.map((id) => <li key={id}><a className="link" href={`#${id}`}>{plan.registry.scenarios.find((s) => s.id === id)?.question}</a></li>)}</ul>
          <h4>Closest completed NASA evidence</h4>
          <ul className={styles.records}>{gap.closestRecordIds.map((id) => { const r = evidenceRecords.find((r) => r.id === id)!; return <li key={id}><Link className="link" href={r.href}>{r.label}</Link>{r.caveat && <small>{r.caveat}</small>}</li>; })}</ul>
          <details><summary>Relevant publication findings ({gap.relevantFindingIds.length})</summary><ul>{gap.relevantFindingIds.map((id) => { const f = findings.find((f) => f.id === id)!; return <li key={id}>“{f.quote}” <Cite sourceId={f.source_id} page={f.pdf_page} /></li>; })}</ul></details>
          <h4>Planned NASA overlap</h4>
          {gap.plannedCoverage.length ? gap.plannedCoverage.map((p) => <div key={p.program} className={styles.planned}>
            <p><b>{p.program}: planned, no results counted.</b> Overlaps {p.overlappingDimensions.join(" + ")}.</p><p>{p.limitations.join(" ")}</p>
            <p className={styles.cites}>{p.findingIds.map((id, i) => { const f = findings.find((f) => f.id === id)!; return <Fragment key={`${id}-${i}`}>{i > 0 && <span aria-hidden="true"> · </span>}<Cite sourceId={f.source_id} page={f.pdf_page} /></Fragment>; })}</p>
          </div>) : <p className={styles.note}>No verified planned overlap assigned for this gap.</p>}
          <h4>Matched-condition research question</h4>
          <p className={styles.question}>{gap.nextExperimentText ?? `A valid completed test reporting ${plain(gap.conditions)}.`}</p>
          <div className={styles.actions}><a className={styles.cta} href="#evidence-gain" onClick={() => setCandidate(gap.nextExperimentSpec.id)}>Evaluate this candidate&apos;s coverage</a></div>
          <details><summary>Gap and platform limitations</summary><ul>{gap.limitations.map((l) => <li key={l}>{l}</li>)}</ul></details>
        </article>}
      </div>
    </section>

    <section id="evidence-gain" aria-labelledby="gain-title" className={styles.panel}>
      <div className={styles.panelHead}><div><h3 id="gain-title">Evidence Gain Planner</h3><p className={styles.note}>If a valid experimental record existed at these conditions, which registered questions would gain matched-condition coverage?</p></div>
        <div className={styles.toolbar}><label className={styles.wide}>Hypothetical research candidate<select value={candidate ?? ""} onChange={(e) => setCandidate(e.target.value)}>{plan.gains.map((g) => { const spec = plan.candidates.find((c) => c.id === g.candidateId)!; return <option key={g.candidateId} value={g.candidateId}>{n(g.directGapsPotentiallyClosed.length, "gap")} · {plain(spec.conditions)}</option>; })}</select></label></div></div>
      {c && gain ? <div className={styles.candidate}>
        <p className={styles.tag}>Hypothetical research question · no measured outcome · cannot be cited as NASA evidence</p>
        <Conditions q={c.conditions} />
        <div className={styles.coverage}>
          <div><span>Today: direct-condition coverage</span><b>{gain.currentDirectQuestions} / {total} questions</b>{bar(gain.currentDirectQuestions)}<meter className="sr-only" aria-label="Current direct-condition coverage" min={0} max={total} value={gain.currentDirectQuestions} /></div>
          <div data-tone="gain"><span>If a valid record existed</span><b>{gain.potentialDirectQuestions} / {total} questions</b>{bar(gain.potentialDirectQuestions)}<meter className="sr-only" aria-label="Potential direct-condition coverage" min={0} max={total} value={gain.potentialDirectQuestions} /></div>
        </div>
        <p><b>Could supply matched-condition coverage for {n(gain.directGapsPotentiallyClosed.length, "registered gap")} and {n(gain.affectedScenarioIds.length, "curated question")} across {n(gain.affectedCategories.length, "category", "categories")}.</b> Matched on represented dimensions only. Its exact conditions come from {n(c.sourceGapIds.length, "registered gap requirement")}; no combinations were generated at random.</p>
        <div className={styles.twoCol}>
          <div><h4>Could directly address</h4><ul>{gain.directGapsPotentiallyClosed.map((id) => <li key={id}><button className={styles.linkBtn} onClick={() => chooseGap(id)}>{plain(plan.registry.gaps.find((g) => g.id === id)!.conditions)}</button></li>)}</ul></div>
          <div><h4>Questions that gain condition coverage</h4><ul>{gain.affectedScenarioIds.map((id) => <li key={id}><a className="link" href={`#${id}`}>{plan.registry.scenarios.find((s) => s.id === id)?.question}</a></li>)}</ul></div>
        </div>
        <details><summary>Remaining gaps ({gain.gapsNotAddressed.length}); partial overlap ({gain.partialGapsReduced.length})</summary><p className={styles.note}>Partial overlap is not counted as direct coverage or proof of gap reduction.</p><ul>{gain.gapsNotAddressed.map((id) => <li key={id}><button className={styles.linkBtn} onClick={() => chooseGap(id)}>{plain(plan.registry.gaps.find((g) => g.id === id)!.conditions)}</button>{gain.partialGapsReduced.includes(id) && " — partial dimensional overlap only"}</li>)}</ul></details>
        <p className={styles.note}><b>Unknown or unmodelled:</b> {c.unknownDimensions.map(words).join(", ")}.</p>
        <details><summary>Assumptions and limits of this counterfactual</summary><ul>{[...gain.assumptions, ...gain.limitations].map((l) => <li key={l}>{l}</li>)}</ul></details>
      </div> : <p className={styles.note}>No hypothetical candidate is needed for the current registered conditions.</p>}
      <p className={styles.note}>This planner measures evidence coverage only. It does not estimate experimental feasibility, cost, risk, scientific outcome or NASA priority. Human usability impact study pending.</p>
    </section>

    <details id="research-scenarios" className={styles.more}><summary>Curated mission questions and their origins ({total})</summary>
      <div className={styles.scenarios}>{plan.registry.scenarios.map((s) => { const covered = plan.registry.directlyCoveredScenarioIds.includes(s.id); return <article id={s.id} key={s.id} data-covered={covered || undefined}>
        <p className={styles.tag}>{s.category} · {s.origin}</p><h4>{s.title}</h4><p>{s.question}</p><Conditions q={s.scenario} />
        <p className={styles.note}>{s.rationale} {covered ? "Condition match exists under current ontology; platform and geometry limitations remain." : "No current direct condition match."}</p>
        <p className={styles.cites}>{s.sourceContext.map((id, i) => <Fragment key={id}>{i > 0 && <span aria-hidden="true"> · </span>}<Cite sourceId={id} /></Fragment>)}</p>
      </article>; })}</div>
    </details>
    <details className={styles.more}><summary>Open research data and all limitations</summary><div className={styles.links}>{["mission-scenarios", "gap-registry", "candidate-experiments", "evidence-gain", "research-planning-graph"].map((k) => <a key={k} href={`/downloads/${k}.json`}>{k}.json</a>)}</div><ul>{PLANNING_LIMITS.map((l) => <li key={l}>{l}</li>)}</ul></details>
  </section>;
}
