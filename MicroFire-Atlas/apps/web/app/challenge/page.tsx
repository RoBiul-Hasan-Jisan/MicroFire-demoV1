import type { Metadata } from "next";
import Link from "next/link";
import { Cite } from "@/components/Cite";
import { evidenceRecords, experiments, findings, luciRuns, saffireRuns } from "@/lib/data";
import { checkSummary, EXAMPLE_ANSWER, EXAMPLE_QUESTION } from "@/lib/ask-example";
import { ATMOSPHERES } from "@/lib/atmospheres";
import { abstention, ABSTAIN_QUESTION, buildChallenge, CHALLENGE_ATMOSPHERES, TRACEABILITY, type ChallengeAtmosphere, type DimStatus } from "@/lib/challenge";
import { FAMILIES, KIND_LABEL, SOURCE_FAMILY } from "@/lib/ontology";
import { BriefActions, StageRail } from "@/components/challenge/StageRail";
import { deployedSnapshot, gate } from "@/lib/model-lab";
import { dossierUrl } from "@/lib/dossier";
import styles from "@/components/challenge/Challenge.module.css";

export const metadata: Metadata = {
  title: "Challenge Mode",
  description: "The whole MicroFire Atlas answer to one mission question in about 90 seconds: find, compare, summarize, rank, interpret, verify AI, and show where NASA's evidence stops.",
};

const DATA = { experiments, findings, saffire: saffireRuns, luci: luciRuns, records: evidenceRecords };
const MARK: Record<DimStatus, string> = { match: "✓ match", near: "≈ near", different: "✗ different", "not reported": "? not reported" };
const STAGES = ["Find", "Compare", "Summarize", "Rank", "Interpret", "AI", "Uncertainty", "Next experiment", "Traceability"];

function Stage({ n, verb, title, children }: { n: number; verb: string; title: string; children: React.ReactNode }) {
  return (
    <section id={`stage-${n}`} aria-labelledby={`stage-${n}-title`} className={styles.stage}>
      <header className={styles.stageHead}>
        <span className={styles.num} aria-hidden="true">{n}</span>
        <p className={styles.verb}>{verb}</p>
        <h2 id={`stage-${n}-title`} className={styles.stageTitle}>{title}</h2>
      </header>
      {children}
    </section>
  );
}

export default async function ChallengePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const atm = (CHALLENGE_ATMOSPHERES as readonly string[]).includes(String(sp.atm)) ? (sp.atm as ChallengeAtmosphere) : "ea-a";
  const c = buildChallenge(DATA, atm);
  const no = abstention(DATA);
  const checks = checkSummary(c.ai.checked);
  const keys = [...new Set(c.ai.checked.flatMap((x) => x.cites))];

  // Mission Evidence Brief: every line computed from the stages above
  const best = c.closest[0];
  const top = c.topFindings[0];
  const passed = c.ai.checked.filter((x) => x.verified).length;
  const tested = c.gap.coverage.map((d) => `${d.label.toLowerCase()} ${d.count > 0 ? `in ${d.count} record${d.count === 1 ? "" : "s"}` : "never"}`).join(", ");
  const dossierHref = dossierUrl(
    { material: c.q.material!, gravity: "lunar", o2: c.q.oxygen!, kpa: c.q.pressureKpa!, flow: c.q.flow! },
    { gravity: "microgravity", o2: 21, kpa: 101.3 },
  );
  const ml = gate(deployedSnapshot(experiments), { material: c.q.material!, gravity: "lunar", o2: c.q.oxygen!, kpa: c.q.pressureKpa!, flow: c.q.flow! });
  const blockedBy = ml.checks.filter((x) => x.status === "out" || x.status === "insufficient").map((x) => x.dim.toLowerCase());
  const brief: [string, string, string?][] = [
    ["Question", c.text, `Scenario: ${c.scenario}.`],
    ["What NASA directly tested", c.gap.direct ? `${c.gap.direct} record${c.gap.direct === 1 ? "" : "s"} match every condition.` : "No NASA test in this atlas matches every condition.", `Each condition on its own: ${tested}.`],
    ["Closest evidence", best ? `${best.record.label}. NASA recorded: ${best.record.outcomeLabel}.` : "None", best ? `Differs in: ${best.dims.filter((d) => d.status !== "match").map((d) => d.dim.toLowerCase()).join(", ") || "nothing"}.` : undefined],
    ["Most relevant finding", top ? `“${top.finding.quote}”` : "None", top ? `${FAMILIES[SOURCE_FAMILY[top.finding.source_id] ?? "context"].name}, ${top.result.rung} evidence.` : undefined],
    ["What AI contributed", `Synthesized the retrieved NASA evidence into plain language; ${passed} of ${c.ai.checked.length} claims passed every deterministic check.`, "Saved, verified example re-checked on every build, not a live request. The AI never decided what NASA observed."],
    ["Main uncertainty", c.gap.gaps[0]?.text ?? "No single condition is missing.", c.gap.gaps.length > 1 ? `${c.gap.gaps.length - 1} more named gap${c.gap.gaps.length === 2 ? "" : "s"}.` : undefined],
    ["What cannot yet be claimed", "Any outcome or probability for this condition.", `The AI Model Lab blocks a prediction here (${blockedBy.join(", ")} outside its evidence). ${no.reason ?? ""}`],
    ["Next research question", c.gap.nextExperiment ?? "Direct evidence exists for every condition.", "Computed from the missing conditions. Not a NASA-endorsed plan."],
  ];
  const traceCites = [best?.record.cite, top && { source_id: top.finding.source_id, pdf_page: top.finding.pdf_page, table: undefined }].filter((x): x is { source_id: string; pdf_page: number; table?: string } => !!x);
  const briefText = ["MicroFire Mission Evidence Brief (an evidence summary, not a NASA safety report)", "", ...brief.map(([k, v, d]) => `${k.toUpperCase()}\n${v}${d ? `\n${d}` : ""}`), "", `SOURCE TRACE\n${traceCites.map((t) => `${t.source_id}, PDF page ${t.pdf_page}`).join("\n")}`, "", "https://microfire-atlas.vercel.app/challenge"].join("\n\n");

  return (
    <div className={`explorer-page ${styles.page}`}>
      <header className={styles.hero}>
        <p className={styles.kicker}>Challenge Mode · the whole answer in about 90 seconds</p>
        <p className={styles.promise}>One question. Nine steps. Every claim traceable.</p>
        <h1 className={styles.question}>{c.text}</h1>
        <p className={styles.scenario}>Research scenario: {c.scenario}.</p>
        <div className={styles.atmos} role="group" aria-label="Atmosphere for the scenario">
          <span>Atmosphere</span>
          {CHALLENGE_ATMOSPHERES.map((id) => {
            const a = ATMOSPHERES.find((x) => x.id === id)!;
            return <Link key={id} href={id === "ea-a" ? "/challenge" : `/challenge?atm=${id}`} aria-current={atm === id ? "true" : undefined} className={styles.atm}>{a.name} · {a.short}</Link>;
          })}
          <Link href={`/mission?context=${atm === "ea-a" ? "moon-base" : "moon-base-alt"}`} className="link text-sm">Change every condition in Mission Analyst</Link>
        </div>
      </header>
      <StageRail stages={STAGES} />

      <Stage n={1} verb="Find" title="Find the evidence">
        <p className={styles.lead}>Searching the curated NASA evidence in this atlas. This is local, deterministic retrieval over checked records: no web search, no model.</p>
        <ul className={styles.families}>
          {c.find.map((f) => (
            <li key={f.id} data-role={f.role}>
              <strong>{f.name}</strong>
              <span>{f.role}</span>
              <small>{f.records ? `${f.records} test record${f.records === 1 ? "" : "s"} · ` : ""}{f.findings} verified finding{f.findings === 1 ? "" : "s"}</small>
            </li>
          ))}
        </ul>
      </Stage>

      <Stage n={2} verb="Compare" title="Compare what NASA actually tested">
        <p className={styles.lead}>The closest test records across every family. Close is not identical: each condition is marked.</p>
        <ol className={styles.compare}>
          {c.closest.map(({ record: r, dims }) => (
            <li key={r.id}>
              <h3><Link href={r.href} className="link">{r.label}</Link></h3>
              <p className={styles.meta}>{FAMILIES[r.family].name}{r.sizeCm ? ` · ${r.sizeCm} cm sample` : ""} · NASA recorded: {r.outcomeLabel}</p>
              <dl>
                {dims.map((d) => (
                  <div key={d.dim} data-status={d.status}>
                    <dt>{d.dim}</dt>
                    <dd><span className={styles.pill}>{MARK[d.status]}</span> {d.record}</dd>
                  </div>
                ))}
              </dl>
              {r.caveat && <p className={styles.caveat}>{r.caveat}</p>}
              {r.cite && <Cite sourceId={r.cite.source_id} page={r.cite.pdf_page} where={r.cite.table} />}
            </li>
          ))}
        </ol>
      </Stage>

      <Stage n={3} verb="Summarize" title="What NASA found">
        <ol className={styles.findings}>
          {c.topFindings.map(({ result: r, finding: f }) => (
            <li key={f.id}>
              <p className={styles.meta}>{FAMILIES[SOURCE_FAMILY[f.source_id] ?? "context"].name} · {r.rung} evidence · {KIND_LABEL[f.kind]}</p>
              <blockquote>“{f.quote}”</blockquote>
              <p className={styles.why}><b>Why it is relevant:</b> {r.whyRelevant[0]}</p>
              <p className={styles.limit}><b>Limitation:</b> {r.limitations[0]}</p>
              <Cite sourceId={f.source_id} page={f.pdf_page} />
            </li>
          ))}
        </ol>
      </Stage>

      <Stage n={4} verb="Rank" title="Which evidence matters most?">
        <p className={styles.lead}>Two rankings, kept separate. These are MicroFire ranking heuristics, not NASA safety scores. The best BASS-II row scores only {Math.round((c.topTests[0]?.relevance ?? 0) * 100)} / 100: those tests ran in orbit at sea-level pressure, far from this scenario. That low number is part of the answer.</p>
        <div className={styles.rankCols}>
          <div>
            <h3>Experiment relevance <small>BASS-II test rows, by condition similarity</small></h3>
            <ol className={styles.rankList}>
              {c.topTests.map((t, i) => (
                <li key={t.experiment.id}>
                  <b>#{i + 1}</b>
                  <Link href={`/experiments/${t.experiment.id}`} className="link">Test {t.experiment.test_id}</Link>
                  <span>Relevance {Math.round(t.relevance * 100)} / 100 · reported coverage {Math.round(t.coverage * 100)} %</span>
                  <span className={styles.whyRank}>{t.matches.length ? <>✓ {t.matches.join(", ")}</> : "✓ no condition scores well"}{t.misses.length > 0 && <> · ✗ {t.misses.join(", ")}</>}</span>
                  <span>Ranking stability: top 3 in {Math.round(t.stability.top3 * 100)} % of 1,000 weight variations</span>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h3>Finding relevance <small>NASA statements, by the question they address</small></h3>
            <ol className={styles.rankList}>
              {c.topFindings.map((t, i) => (
                <li key={t.finding.id}>
                  <b>#{i + 1}</b>
                  <span className={styles.fname}>{t.finding.quote.slice(0, 90)}{t.finding.quote.length > 90 ? "…" : ""}</span>
                  <span>Relevance {Math.round(t.result.relevance)} / 100 · {t.result.rung} evidence</span>
                  <span>Ranking stability: {t.top3 == null ? "not computed" : `top 3 in ${Math.round(t.top3 * 100)} % of weight variations`}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Stage>

      <Stage n={5} verb="Interpret" title="What does this mean for the mission question?">
        {c.insight ? (
          <dl className={styles.insight}>
            <div><dt>NASA observed</dt><dd>“{c.insight.observation}”</dd></div>
            <div><dt>Why it matters here</dt><dd>{c.insight.whyRelevant.slice(0, 2).join(" ")}</dd></div>
            <div><dt>MicroFire interpretation</dt><dd>{c.insight.interpretation}</dd></div>
            <div><dt>Limitation</dt><dd>{c.insight.limitations[0]}</dd></div>
            <div><dt>Source</dt><dd><Cite sourceId={c.insight.sourceId} page={findings.find((f) => f.id === c.insight!.findingId)?.pdf_page} /></dd></div>
          </dl>
        ) : (
          <p className={styles.lead}>No reviewed interpretation template applies to these findings, so MicroFire generates none. The ranked findings and their limitations above remain the answer.</p>
        )}
      </Stage>

      <Stage n={6} verb="AI-powered" title="Where AI helps">
        <p className={styles.lead}>The model never decides what NASA observed. MicroFire retrieves the evidence first and verifies generated factual claims afterward.</p>
        <ol className={styles.pipeline}>
          <li><b>Question</b><span>{EXAMPLE_QUESTION}</span></li>
          <li><b>NASA evidence retrieved first</b><span>{keys.map((k) => k.replace(/^[EFSL]:/, "").replace("bass2-", "")).join(" · ")}</span></li>
          <li><b>AI synthesis</b><span>{EXAMPLE_ANSWER.summary}</span></li>
          <li><b>Claim checker</b><ul>{checks.map((x) => <li key={x.label}>{x.pass ? "✓" : "✗"} {x.label}</li>)}</ul></li>
          <li data-ok={c.ai.valid}><b>{c.ai.valid ? "Verified" : "Flagged"}</b><span>Verified example: a saved answer re-checked by the current checker on every build. Not a live request. Deterministic checks do not prove every sentence is scientifically entailed.</span></li>
        </ol>
        <p className="mt-3 text-sm"><Link href="/ask" className="link">Ask your own question</Link></p>
      </Stage>

      <Stage n={7} verb="Uncertainty" title="What NASA has not tested yet">
        <ol className={styles.ladder} aria-label="Evidence Ladder for this scenario">
          <li data-empty={c.gap.direct === 0}><b>Direct</b><span>{c.gap.direct} record{c.gap.direct === 1 ? "" : "s"}</span></li>
          <li><b>Analogous</b><span>{c.gap.analogous} records</span></li>
          <li><b>Mechanistic</b><span>{c.gap.mechanistic} findings</span></li>
          <li data-gap="true"><b>Gap</b><span>{c.gap.gaps.length} named</span></li>
        </ol>
        <p className={styles.equation} aria-label="The missing combination">
          <span>{c.q.material}</span>+<span>lunar gravity</span>+<span>{c.q.pressureKpa} kPa · {c.q.oxygen} % O₂</span>+<span>{c.q.flow} cm/s</span>=<strong>{c.gap.direct ? `${c.gap.direct} direct match${c.gap.direct === 1 ? "" : "es"}` : "no direct match in the current atlas"}</strong>
        </p>
        <h3 className={styles.covTitle}>Each condition, and where NASA has tested it</h3>
        <ul className={styles.coverage}>
          {c.gap.coverage.map((d) => (
            <li key={d.dim} data-covered={d.count > 0}>
              <b>{d.count > 0 ? "✓" : "✗"} {d.label}</b>
              <span>{d.count > 0 ? `${d.count} record${d.count === 1 ? "" : "s"} within tolerance: ${d.families.join(", ")}` : "No record in this atlas"}</span>
            </li>
          ))}
        </ul>
        <p className={styles.lead}>{c.gap.coverage.some((d) => d.count === 0) ? "At least one condition has never been tested in this atlas." : "Every condition was tested somewhere, never all together."} No single record combines them.</p>
        <ul className={styles.gaps}>{c.gap.gaps.map((g) => <li key={g.dim + g.text}>{g.text}</li>)}</ul>
      </Stage>

      <Stage n={8} verb="Next question" title="The experiment that would close the gap">
        <p className="mb-5"><Link className="link" href={`/gaps?scenario=mission-${atm === "ea-a" ? "moon-base" : "moon-base-alt"}#research-planning`}>See how this gap compares with the whole research landscape</Link></p>
        <p className="mb-5"><Link className="link" href="/gaps#evidence-gain">Which experiment could address the most open gaps?</Link></p>
        <p className="mb-5"><Link className="link" href={dossierHref}>Turn this question into a full dossier, and see what would have to change for the evidence to apply</Link></p>
        {c.gap.nextExperiment ? (
          <div className={styles.next}>
            <p className={styles.meta}>Matched-condition research question</p>
            <p className={styles.nextText}>{c.gap.nextExperiment}</p>
            <p className={styles.meta}>Computed from the missing conditions. A research question, not a NASA-endorsed experiment plan.</p>
          </div>
        ) : <p className={styles.lead}>Direct evidence exists for every condition, so no single condition is missing.</p>}

        <div className={styles.no} aria-labelledby="says-no">
          <p className={styles.noKicker}>MicroFire says no</p>
          <h3 id="says-no">“{ABSTAIN_QUESTION}”</h3>
          <p className={styles.noVerdict}>{no.refuses ? "No valid probability can be estimated from the current evidence." : "Reviewing…"}</p>
          <dl>
            <div><dt>Why</dt><dd>{no.reason}</dd></div>
            {no.closest && <div><dt>Closest evidence</dt><dd><Link href={no.closest.record.href} className="link">{no.closest.record.label}</Link>{no.closest.record.caveat ? `. ${no.closest.record.caveat}.` : ""}</dd></div>}
            <div><dt>Main mismatches</dt><dd>{no.mismatches.join("; ")}</dd></div>
            {no.observed && <div><dt>What NASA has observed</dt><dd>“{no.observed.quote}” <Cite sourceId={no.observed.source_id} page={no.observed.pdf_page} /></dd></div>}
            <div><dt>What remains unknown</dt><dd>{no.unknown.join(" ")}</dd></div>
            {no.next && <div><dt>Matched-condition research question</dt><dd>{no.next}</dd></div>}
          </dl>
          <p className={styles.noLine}>Abstention is a scientific result.</p>
        </div>
      </Stage>

      <Stage n={9} verb="Traceability" title="How MicroFire answers the challenge">
        <ul className={styles.trace}>
          {TRACEABILITY.map((t) => (
            <li key={t.verb}>
              <b>✓ {t.verb}</b>
              <span>{t.what}</span>
              <Link href={t.href} className="link">{t.where}</Link>
            </li>
          ))}
        </ul>
        <p className={styles.final}>MicroFire shows both what NASA knows and where the evidence stops.</p>
      </Stage>

      <section id="brief" className={styles.brief} aria-labelledby="brief-title">
        <header className={styles.briefHead}>
          <div>
            <h2 id="brief-title">Mission Evidence Brief</h2>
            <p>The nine steps in one page. A MicroFire evidence summary, not a NASA safety report.</p>
          </div>
          <BriefActions text={briefText} />
        </header>
        <dl className={styles.briefGrid}>
          {brief.map(([k, v, d]) => (
            <div key={k} data-tone={k === "What cannot yet be claimed" || k === "Main uncertainty" ? "stop" : undefined}>
              <dt>{k}</dt>
              <dd>{v}{d && <small>{d}</small>}</dd>
            </div>
          ))}
          <div>
            <dt>Source trace</dt>
            <dd className={styles.trail}>{traceCites.map((t) => <Cite key={t.source_id + t.pdf_page} sourceId={t.source_id} page={t.pdf_page} where={t.table} />)}</dd>
          </div>
        </dl>
        <nav className={styles.briefLinks} aria-label="Go deeper">
          <a href="#stage-1">View details</a>
          <Link href={`/mission?context=${atm === "ea-a" ? "moon-base" : "moon-base-alt"}`}>Open Mission Analyst</Link>
          <Link href={dossierHref}>Open the Scenario Dossier</Link>
          <Link href="/model-lab">Why the model abstains</Link>
        </nav>
      </section>
    </div>
  );
}
