"use client";
import { useState } from "react";
import ex from "./ObsExtra.module.css";
import styles from "./AtlasObservatory.module.css";

export type Doc = { source_id: string; title: string; authors: string[]; published?: string | null; document_type?: string | null; url: string; pdf_url?: string | null; sha256?: string | null; used_for?: string | null; copyright?: string | null; abstract?: string | null; n: number };
export function SourcesLibrary({ docs, downloads }: { docs: Doc[]; downloads: [string, string, string][] }) {
  const [q, setQ] = useState(""), [pdf, setPdf] = useState(false), [quoted, setQuoted] = useState(false), [copied, setCopied] = useState("");
  const list = docs.filter((d) => (!pdf || d.pdf_url) && (!quoted || d.n > 0) && `${d.title} ${d.used_for} ${d.authors.join(" ")}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className={ex.page}>
      <p className={`${ex.cBlue} ${ex.m0}`}>SOURCES</p>
      <h1 className={ex.title}>Follow every clue to its source.</h1>
      <p className={ex.lead}>Every NASA document in MicroFire Atlas links to its NASA Technical Reports Server record, with a direct PDF when available and SHA-256 hashes so you can verify the file. Copyright status is NTRS&apos;s own determination.</p>
      <section className={styles.panel}>
        <h2>Evidence library</h2>
        <input className={ex.search} placeholder="Search NASA documents, findings, and data…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className={styles.chips}>
          <button className={pdf ? styles.on : ""} onClick={() => setPdf(!pdf)}>PDF available</button>
          <button className={quoted ? styles.on : ""} onClick={() => setQuoted(!quoted)}>Quoted findings</button>
          <span className={`${ex.asc} ${ex.cMuted} ${ex.f08}`}>{list.length} of {docs.length} documents</span>
        </div>
        <div className={ex.docs}>
          {list.map((d) => (
            <article key={d.source_id} className={`${styles.panel} ${ex.doc}`}>
              <h3>{d.title}</h3>
              <small>{d.authors.slice(0, 3).join(", ")}{d.authors.length > 3 && " et al."}{d.published && ` · ${d.published.slice(0, 4)}`}</small>
              <div className={ex.tags}><span>{d.document_type?.toLowerCase().replace(/_/g, " ") ?? "document"}</span><span>{d.n ? `${d.n} finding${d.n > 1 ? "s" : ""}` : "data / context"}</span><span>{d.copyright?.toLowerCase().replace(/_/g, " ") ?? "copyright not stated"}</span></div>
              {d.used_for && <p>{d.used_for}.</p>}
              <div className={ex.links}><a href={d.url} target="_blank" rel="noreferrer">View NTRS record →</a>{d.pdf_url && <a href={d.pdf_url} target="_blank" rel="noreferrer">View PDF →</a>}</div>
              <div className={ex.hash} onClick={() => { d.sha256 && navigator.clipboard?.writeText(d.sha256); setCopied(d.source_id); }}>
                {d.sha256 ? <>SHA-256 · {d.sha256} {copied === d.source_id && "(copied)"}</> : "Metadata-only record, no PDF on NTRS"}
              </div>
            </article>))}
        </div>
      </section>
      <section className={`${styles.panel} ${ex.mt16}`}>
        <h2>Download the data</h2>
        <p className={`${ex.lead} ${ex.my4}`}>Each row keeps its NASA source and PDF page.</p>
        <div className={ex.dl}>{downloads.map(([f, l, n]) => <a key={f} href={`/downloads/${f}`} download><b>{l}</b><span>{n}</span></a>)}</div>
      </section>
    </div>
  );
}
