"use client";

import { Cite } from "@/components/Cite";
import { findings } from "@/lib/data";
import { ATMOSPHERES, profileFor } from "@/lib/atmospheres";
import { useExplorer } from "@/components/guide/EmberGuide";
import styles from "./AtmosphereProfiles.module.css";

/** Mission atmosphere profiles, each with its NASA source. None of them is "the" Moon-base atmosphere. */
export function AtmosphereProfiles({ o2, kpa, onPick }: { o2: number; kpa: number; onPick: (o2: number, kpa: number) => void }) {
  const cur = profileFor(o2, kpa);
  const { discover } = useExplorer();
  const f = cur.finding ? findings.find((x) => x.id === cur.finding) : null;
  return (
    <div className={styles.wrap}>
      <div className={styles.cards} role="radiogroup" aria-label="Mission atmosphere profile">
        {ATMOSPHERES.map((a) => (
          <button
            key={a.id} role="radio" aria-checked={cur.id === a.id} className={styles.card} data-profile={a.id}
            onClick={() => { if (a.o2 == null || a.kpa == null) return; onPick(a.o2, a.kpa); if (a.id === "ea-alt") discover("profile"); }}
            disabled={a.id === "custom" && cur.id !== "custom"}
          >
            <span className={styles.gauge} aria-hidden="true">
              <svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="24" className={styles.ring} /><circle cx="30" cy="30" r="24" className={styles.fillRing} data-o2={a.o2 ?? "custom"} /></svg>
              <b>{a.o2 ?? "·"}{a.o2 != null && <small>%</small>}</b>
            </span>
            <span className={styles.name}>{a.name}</span>
            <span className={styles.short}>{a.id === "custom" && cur.id === "custom" ? `${kpa} kPa · ${o2} %` : a.short}</span>
          </button>
        ))}
      </div>
      <div className={styles.info} aria-live="polite">
        <p className={styles.status}>{cur.status}</p>
        <p className={styles.why}>{cur.why}</p>
        {f && (
          <p className={styles.quote}>
            “{f.quote}” <Cite sourceId={f.source_id} page={f.pdf_page} />
          </p>
        )}
        {cur.id !== "custom" && cur.id !== "iss" && (
          <p className={styles.caveat}>One NASA exploration-atmosphere scenario, not a universal Moon-base specification. {cur.where}.</p>
        )}
        {cur.id === "custom" && <p className={styles.caveat}>Set oxygen and pressure below. Pick a profile to return to a NASA scenario.</p>}
      </div>
    </div>
  );
}
