import type { ReactNode } from "react";
import ex from "./ObsExtra.module.css";
import styles from "./AtlasObservatory.module.css";

export function ObsHero({ kicker, title, lead, kpis }: { kicker: string; title: ReactNode; lead: string; kpis: [string | number, string, string][] }) {
  return (
    <header>
      <p className={`${ex.cBlue} ${ex.m0} ${ex.ls} ${ex.f08}`}>{kicker.toUpperCase()}</p>
      <h1 className={ex.title}>{title}</h1>
      <p className={ex.lead}>{lead}</p>
      <div className={styles.kpis}>{kpis.map(([n, l, s]) => <div key={l} className={styles.kpi}><strong>{n}</strong><span>{l}<small>{s}</small></span></div>)}</div>
    </header>
  );
}
