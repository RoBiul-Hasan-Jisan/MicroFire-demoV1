import Link from "next/link";
import { Cite, shortName } from "@/components/Cite";
import { evidenceRecords, findings } from "@/lib/data";
import { FAMILIES, KIND_LABEL, SOURCE_FAMILY } from "@/lib/ontology";
import { FINDING_VARIATIONS, whyAhead, type FindingResult, type FireInsight } from "@/lib/finding-relevance";
import styles from "./RankedFindings.module.css";

const DIM: Record<string, string> = { pressureKpa: "pressure", flow: "airflow" };
const TOPIC: Record<string, string> = { "partial-gravity": "reduced gravity", "materials-screening": "material screening", quench: "flames going out", blowoff: "flames blown out" };

export function RankedFindings({ ranked, stability, scenario = {} }: { ranked: FindingResult[]; stability: Record<string, { top3: number; samples: number }>; scenario?: { material?: string; gravity?: string } }) {
  return <section id="ranked-findings" aria-labelledby="findings-title" className={styles.section}>
    <h2 id="findings-title" className="analyst-step-title"><span>4</span>Top relevant NASA findings</h2>
    <p className={styles.intro}>Finding relevance ranks scientific observations and context. Experiment relevance ranks physical conditions. Neither is a safety rating. <Link href="/methodology#finding-relevance" className="link">How findings are ranked</Link></p>
    {!ranked.length && <p className={styles.empty}>No finding matches the requested topics or a documented material association. Choose a scientific question above. No answer has been inferred.</p>}
    <ol className={styles.cards}>{ranked.slice(0,3).map((r,i) => {
      const f = findings.find(f => f.id === r.findingId)!;
      const family = FAMILIES[SOURCE_FAMILY[f.source_id] ?? "context"];
      return <li key={r.findingId} className={styles.card}>
        <header><b>#{i+1}</b><span>{family.name} · {r.rung}</span></header>
        <h3>{shortName(f.source_id)}</h3>
        <p className={styles.topics}>{r.matchedTopics.length ? `Matches: ${r.matchedTopics.map((t) => TOPIC[t] ?? t).join(", ")}` : "Matches: material"}</p>
        <div className={styles.why}>
          <p className={styles.label}>Why #{i+1}?</p>
          <ul>
            <li data-ok={r.rung === "direct" || r.rung === "analogous"}>Evidence type: {r.rung}{r.rung === "context" ? " (not a combustion result)" : r.rung === "mechanistic" ? " (liquid or gas mechanism, not a solid-material result)" : ""}</li>
            {r.requestedTopics.length > 0 && <li data-ok={r.matchedTopics.length === r.requestedTopics.length}>Topics: {r.matchedTopics.length} of {r.requestedTopics.length} requested</li>}
            {scenario.material && <li data-ok={r.materialMatch}>Material {r.materialMatch ? "matches" : "not matched"}: {scenario.material}</li>}
            {scenario.gravity && <li data-ok={r.gravityMatch}>Gravity {r.gravityMatch ? "overlaps" : "not matched"}: {scenario.gravity}</li>}
          </ul>
          {i === 0 && ranked[1] && <p>Ahead of #2 because {whyAhead(r, ranked[1])}.</p>}
          {i > 0 && <p>#{i} is ahead because {whyAhead(ranked[i-1], r)}.</p>}
        </div>
        <p className={styles.label}>Why this is relevant</p>
        <ul>{r.whyRelevant.map(t=><li key={t}>{t}</li>)}</ul>
        <p className={styles.label}>NASA · {KIND_LABEL[f.kind]}</p>
        <blockquote>“{f.quote}”</blockquote>
        <dl className={styles.metrics}>
          <div><dt>Relevance heuristic</dt><dd>{Math.round(r.relevance)} / 100</dd></div>
          <div><dt>Evidence type</dt><dd>{r.rung}</dd></div>
          <div><dt>Curated record links</dt><dd>{r.supportCount || "None; publication-level"}</dd></div>
          <div><dt>Reported-condition coverage</dt><dd>{r.coverage == null ? "Unknown" : `${Math.round(r.coverage*100)}%`}</dd></div>
          <div><dt>Ranking stability</dt><dd>{stability[r.findingId] ? `Top 3 in ${Math.round(stability[r.findingId].top3*100)}% of ${stability[r.findingId].samples} variations` : "Updating…"}</dd></div>
          <div><dt>Source section</dt><dd>{r.sourceRole ?? "Not classified"}</dd></div>
        </dl>
        <p className={styles.limit}><strong>Limitation</strong><br/>{r.limitations[0]} {r.unmatchedRequestedDimensions.length > 0 && `Condition match not established: ${r.unmatchedRequestedDimensions.map((d) => DIM[d] ?? d).join(", ")}.`}</p>
        <details><summary>All limitations and related records</summary><ul>{r.limitations.slice(1).map(t=><li key={t}>{t}</li>)}</ul>{r.supportingRecordIds.map(id=>{const record=evidenceRecords.find(x=>x.id===id)!;return <p key={id}><Link href={record.href} className="link">{record.label}</Link></p>;})}</details>
        <Cite sourceId={f.source_id} page={f.pdf_page} />
      </li>;
    })}</ol>
    {ranked.length > 0 && <p className={styles.intro}>Fixed evidence-type ordering; weights vary ±25% across {FINDING_VARIATIONS} seeded runs. This measures sensitivity to MicroFire’s ranking choices, not scientific confidence. Showing 3 of {ranked.length} topic/material matches.</p>}
  </section>;
}

export function FireSafetyInsight({ insight }: { insight: FireInsight | null }) {
  const f = insight && findings.find(f=>f.id===insight.findingId);
  return <section id="fire-safety-insight" aria-labelledby="insight-title" className={styles.insight}>
    <h2 id="insight-title" className="analyst-step-title"><span>7</span>Evidence-backed fire-safety insight</h2>
    {insight && f ? <>
      <h3>NASA observed</h3><blockquote>“{insight.observation}”</blockquote>
      <h3>Why it matters for this question</h3><ul>{insight.whyRelevant.map(t=><li key={t}>{t}</li>)}</ul>
      <h3>{insight.label}</h3><p>{insight.interpretation}</p>
      <h3>Evidence limitation</h3><ul>{insight.limitations.map(t=><li key={t}>{t}</li>)}</ul>
      <Cite sourceId={insight.sourceId} page={f.pdf_page}/>
    </> : <p>No reviewed insight template applies to the selected findings. The ranked sources and their limitations remain available; no mission implication is generated.</p>}
  </section>;
}
