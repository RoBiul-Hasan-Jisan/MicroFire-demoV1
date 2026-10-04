"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Cite } from "@/components/Cite";
import { OutcomeTag } from "@/components/Outcome";
import { experiments, FLAG_LABELS, fmt } from "@/lib/data";
import { confidence, type Ranked } from "@/lib/relevance";

/** Detail drawer for one NASA test. Everything shown is read straight from the existing data and scoring. */
export function ExperimentDrawer({ ranked, onClose }: { ranked: Ranked | null; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const e = ranked?.experiment;

  useEffect(() => {
    if (!e) return;
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
      if (ev.key !== "Tab" || !panelRef.current) return;
      const items = panelRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (ev.shiftKey && document.activeElement === first) {
        ev.preventDefault();
        last.focus();
      } else if (!ev.shiftKey && document.activeElement === last) {
        ev.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [e, onClose]);

  if (!ranked || !e) return null;
  const conf = confidence(e, experiments);
  const rec = e.provenance.record;

  return (
    <div className="lab-drawer-wrap" role="presentation">
      <button className="lab-drawer-scrim" aria-label="Close details" tabIndex={-1} onClick={onClose} />
      <aside ref={panelRef} className="lab-drawer" role="dialog" aria-modal="true" aria-labelledby="lab-drawer-title">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="lab-kicker">{e.investigation} · NASA test</p>
            <h2 id="lab-drawer-title" className="display text-3xl mt-1">{e.test_id}</h2>
            <p className="mt-2 text-sm"><OutcomeTag outcome={e.outcome} label={e.outcome_label} /></p>
          </div>
          <button ref={closeRef} className="lab-btn lab-btn-ghost" onClick={onClose}>Close</button>
        </header>

        <dl className="lab-facts mt-6">
          <div><dt>Material</dt><dd>{e.material}</dd></div>
          <div><dt>Oxygen</dt><dd className="num">{fmt(e.oxygen_vol_pct, "%")}</dd></div>
          <div><dt>Airflow</dt><dd className="num">{fmt(e.flow_initial_cm_s, "cm/s")}{e.flow_final_cm_s != null && e.flow_final_cm_s !== e.flow_initial_cm_s ? ` → ${e.flow_final_cm_s}` : ""}</dd></div>
          <div><dt>Flow direction</dt><dd>{e.flow_direction}</dd></div>
          <div><dt>Pressure</dt><dd className="num">{fmt(e.pressure_kpa, "kPa")}</dd></div>
          <div><dt>Thickness</dt><dd className="num">{fmt(e.thickness_mm, "mm")}</dd></div>
        </dl>

        {e.observations_verbatim && (
          <figure className="mt-6 lab-quote">
            <blockquote>“{e.observations_verbatim}”</blockquote>
            <figcaption className="mt-2 text-sm text-muted">What NASA noted, word for word · <Cite sourceId={rec.source_id} page={rec.pdf_page} /></figcaption>
          </figure>
        )}

        {e.quality_flags.length > 0 && (
          <ul className="mt-5 space-y-2">
            {e.quality_flags.map((f) => (
              <li key={f} className="lab-flag">{FLAG_LABELS[f] ?? f}</li>
            ))}
          </ul>
        )}

        <section className="mt-7">
          <h3 className="font-semibold">Why it scored {Math.round(ranked.score * 100)} for your settings</h3>
          <table className="num condensed w-full mt-2 text-sm">
            <tbody>
              {ranked.terms.map((t) => (
                <tr key={t.key} className="border-t border-rule">
                  <th scope="row" className="text-left font-normal text-muted py-1 pr-3">{t.label}</th>
                  <td className="pr-3">{t.testValue}</td>
                  <td className="pr-3 text-faint">×{t.weight}</td>
                  <td className={t.sim == null ? "text-flame" : ""}>{t.sim == null ? "not reported" : t.sim.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mt-7">
          <h3 className="font-semibold">Evidence confidence: {conf.level}</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {conf.checks.map((c) => (
              <li key={c.label} className={c.pass ? "" : "text-faint"}>{c.pass ? "✓" : "–"} {c.label}</li>
            ))}
          </ul>
        </section>

        <p className="mt-7 text-xs text-faint">Relevance and confidence are project heuristics, not NASA ratings.</p>
        <Link href={`/experiments/${e.id}`} className="lab-btn mt-4 inline-flex">Open the full record</Link>
      </aside>
    </div>
  );
}
