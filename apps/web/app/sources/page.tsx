import type { Metadata } from "next";
import { findings, sources } from "@/lib/data";

export const metadata: Metadata = { title: "Sources" };

export default function SourcesPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12">
      <h1 className="display text-3xl sm:text-4xl">Sources</h1>
      <p className="mt-3 text-muted max-w-[70ch]">
        Every NASA document the atlas draws on, from the NASA Technical Reports Server. Hashes let you confirm you hold the
        same file. Copyright status is NTRS&apos;s own determination.
      </p>
      <ol className="mt-10 space-y-10">
        {sources.map((s) => {
          const n = findings.filter((f) => f.source_id === s.source_id).length;
          return (
            <li key={s.source_id} className="border-t border-rule pt-6">
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
