import type { Metadata } from "next";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const metadata: Metadata = { title: "NASA fire response and the evidence behind it" };
export const dynamic = "force-dynamic";

type Step = { n: number; step: string; detail: string | null; statusLabel: string; evidence: { text: string; source: { label: string; url: string } | null }[] };
type Doc = { title: string; source: { name?: string; url?: string } | string; verification?: string; limitations?: string[]; steps: Step[] };

export default async function Page() {
  const href = pathToFileURL(path.join(process.cwd(), "strict", "src", "compute", "response.mjs")).href;
  const doc = ((await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ href)).FIRE_RESPONSE) as Doc;
  return (
    <div className="explorer-page mx-auto max-w-4xl px-4 sm:px-6 py-12">
      <h1 className="display text-3xl">NASA's ISS fire response, and what the tests say about each step</h1>
      <p className="mt-3 text-muted max-w-[75ch]">
        The steps are NASA's own wording, in NASA's order. Under each one is the evidence in this atlas, with its status. A step with
        "No data found" is a gap, not a finding. This page never turns evidence into a danger level.
      </p>
      <ol className="mt-8" style={{ display: "grid", gap: 20 }}>
        {doc.steps.map((s) => (
          <li key={s.n} style={{ borderTop: "1px solid rgba(128,128,128,.35)", paddingTop: 12 }}>
            <h2 className="display text-xl">{s.step} <span className="text-muted text-sm">· {s.statusLabel}</span></h2>
            {s.detail && <p className="text-muted mt-1">{s.detail}</p>}
            <ul className="mt-2" style={{ display: "grid", gap: 6 }}>
              {s.evidence.map((e, i) => (
                <li key={i} className="text-sm max-w-[78ch]">{e.text} {e.source ? <a href={e.source.url} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>{e.source.label}</a> : <em>(NASA table, computed; see Sources)</em>}</li>
              ))}
              {s.evidence.length === 0 && <li className="text-muted text-sm">No evidence in this atlas yet.</li>}
            </ul>
          </li>
        ))}
      </ol>
      <p className="mt-10 text-muted text-sm max-w-[75ch]">{doc.verification}</p>
      {doc.limitations?.map((l) => <p key={l} className="text-muted text-sm max-w-[75ch]">Limit: {l}</p>)}
    </div>
  );
}
