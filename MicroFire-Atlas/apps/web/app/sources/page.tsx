import type { Metadata } from "next";
import { QuestBoard } from "@/components/quest/QuestBoard";
import { findings, sources } from "@/lib/data";

export const metadata: Metadata = { title: "Sources" };

const DOWNLOADS: [file: string, label: string, note: string][] = [
  ["bass2-tests.csv", "BASS-II test records (CSV)", "Every test row: material, oxygen, pressure, airflow, outcome, NASA notes."],
  ["saffire-runs.csv", "Saffire runs (CSV)", "Large-scale spacecraft fires: conditions and measured results."],
  ["luci-runs.csv", "LUCI lunar-gravity burns (CSV)", "Two burns in simulated lunar gravity, each value with its NASA sentence and page."],
  ["findings.json", "Findings (JSON)", "Each quoted NASA finding, verified against the PDF text."],
  ["source-manifest.json", "Source manifest (JSON)", "NTRS records, PDF links and SHA-256 hashes."],
  ["flame-frame-metrics.csv", "Flame Vision frame metrics (CSV)", "Per-frame flame measurements, in pixels."],
  ["evidence-graph.json", "Evidence graph (JSON)", "Families, sources, records, findings and mission questions, with typed links."],
];

export default function SourcesPage() {
  return (
    <div className="explorer-page sources-page mx-auto max-w-5xl px-4 sm:px-6 py-12">
      <p className="text-signal text-sm">The station library</p>
      <h1 className="display text-4xl sm:text-5xl mt-3">Follow every clue to its source.</h1>
      <div className="mt-6"><QuestBoard page="sources" crew="mei" /></div>
      <p className="mt-3 text-muted max-w-[70ch]">
        Every NASA document the atlas draws on, from the NASA Technical Reports Server. Hashes let you confirm you hold the
        same file. Copyright status is NTRS&apos;s own determination.
      </p>
      <section aria-labelledby="downloads" className="mt-8 rounded-2xl border border-[var(--rule-strong)] p-5">
        <h2 id="downloads" className="text-lg font-semibold">Download the data</h2>
        <p className="mt-1 text-sm text-muted max-w-[70ch]">
          Everything the atlas shows, as plain files. Each row keeps its NASA source and PDF page, so you can check it yourself.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {DOWNLOADS.map(([file, label, note]) => (
            <li key={file}>
              <a href={`/downloads/${file}`} download className="link font-semibold">{label}</a>
              <span className="block text-sm text-muted">{note}</span>
            </li>
          ))}
        </ul>
      </section>
      <ol className="mt-10 space-y-10">
        {sources.map((s) => {
          const n = findings.filter((f) => f.source_id === s.source_id).length;
          return (
            <li key={s.source_id} className="source-document">
              <h2 className="text-lg font-semibold max-w-[70ch]">{s.title}</h2>
              <p className="mt-1 text-sm text-muted">
                {s.authors.join(", ")}
                {s.published && `. ${s.published.slice(0, 4)}`}. {s.document_type?.toLowerCase().replace(/_/g, " ")}.
              </p>
              <p className="mt-3 text-[15px]">{s.used_for}.</p>
              <dl className="mt-3 grid grid-cols-[8rem_minmax(0,1fr)] gap-y-1 text-sm">
                <dt className="text-muted">NTRS record</dt>
                <dd>
                  <a href={s.url} className="link" target="_blank" rel="noreferrer">
                    {s.ntrs_id}
                  </a>
                  {s.pdf_url && (
                    <>
                      {" "}
                      ·{" "}
                      <a href={s.pdf_url} className="link" target="_blank" rel="noreferrer">
                        PDF
                      </a>
                    </>
                  )}
                </dd>
                <dt className="text-muted">Copyright</dt>
                <dd>{s.copyright?.toLowerCase().replace(/_/g, " ") ?? "not stated"}</dd>
                <dt className="text-muted">SHA-256</dt>
                <dd className="break-all text-faint">{s.sha256 ?? "metadata-only record, no PDF on NTRS"}</dd>
                <dt className="text-muted">Quoted here</dt>
                <dd>{n === 0 ? "not quoted, data or context only" : `${n} finding${n === 1 ? "" : "s"}`}</dd>
              </dl>
              {s.abstract && (
                <details className="mt-3">
                  <summary className="text-sm text-signal cursor-pointer">Abstract</summary>
                  <p className="mt-2 text-[15px] text-muted whitespace-pre-line">{s.abstract}</p>
                </details>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
