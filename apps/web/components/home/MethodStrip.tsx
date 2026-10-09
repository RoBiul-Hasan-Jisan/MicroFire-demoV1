"use client";

import Link from "next/link";
import { useRef } from "react";
import s from "./Home.module.css";

const STEPS = [
  { name: "Observe", body: "NASA test tables, footage and reports" },
  { name: "Extract", body: "Typed records in NASA's own units and words" },
  { name: "Validate", body: "Every quote and number checked against the PDF" },
  { name: "Compare", body: "Evidence Ladder and ranking with stability checks" },
  { name: "Explain", body: "AI synthesis, then claim-by-claim verification" },
  { name: "Abstain", body: "No number where NASA has not tested" },
];

/** How MicroFire works, in one row. The full pipeline opens in a drawer instead of taking permanent page height. */
export function MethodStrip({ stats, capabilities, pipeline }: { stats: string; capabilities: { name: string; body: string; href: string; cta: string }[]; pipeline: { name: string; body: string; href: string }[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <section className={s.method} aria-labelledby="method-title">
      <h2 id="method-title" className={s.methodTitle}>How MicroFire thinks</h2>
      <ol className={s.methodSteps}>
        {STEPS.map((x, i) => <li key={x.name} data-stop={i === STEPS.length - 1 || undefined}><b>{x.name}</b><small>{x.body}</small></li>)}
      </ol>
      <button type="button" className={s.ghostCta} onClick={() => dialog.current?.showModal()}>View methodology</button>

      <dialog ref={dialog} className={s.drawer} aria-labelledby="drawer-title" onClick={(e) => { if (e.target === dialog.current) dialog.current?.close(); }}>
        <div className={s.drawerInner}>
          <header>
            <h2 id="drawer-title" className={s.h2}>How MicroFire thinks</h2>
            <button type="button" onClick={() => dialog.current?.close()} aria-label="Close methodology">✕</button>
          </header>
          <p className={s.sub}>From a NASA test table to a bounded answer. AI is used where it helps and stopped where the evidence stops. {stats}</p>
          <ol className={s.pipeline}>
            {pipeline.map((p, i) => <li key={p.name}><Link href={p.href}><span className="num">{String(i + 1).padStart(2, "0")}</span><b>{p.name}</b><small>{p.body}</small></Link></li>)}
          </ol>
          <h3 className={s.h3}>What the AI does, and does not do</h3>
          <ul className={s.caps}>
            {capabilities.map((c) => <li key={c.name}><b>{c.name}</b><p>{c.body}</p><Link className="link" href={c.href}>{c.cta}</Link></li>)}
          </ul>
          <Link href="/methodology" className="story-cta">Read the full methodology</Link>
        </div>
      </dialog>
    </section>
  );
}
