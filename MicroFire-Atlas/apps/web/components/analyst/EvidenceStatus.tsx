import Link from "next/link";
import { FAMILIES, TOLERANCE, type Ladder, type MissionQuestion } from "@/lib/ontology";
import styles from "./EvidenceStatus.module.css";

type Level = "exact" | "within" | "outside" | "unknown" | "regime";
const LEVEL_TEXT: Record<Level, string> = { exact: "Exact", within: "Within tolerance", outside: "Outside tolerance", unknown: "Not recorded", regime: "No test in this regime" };
const G = { microgravity: "orbit", lunar: "lunar gravity", martian: "Martian gravity" } as const;

/**
 * Evidence status: what the closest NASA record can and cannot tell you, condition by condition.
 * A mismatch budget, not a risk score: it names how far the evidence is from the question, never how dangerous a fire is.
 */
export function EvidenceStatus({ q, l, briefHref }: { q: MissionQuestion; l: Ladder; briefHref?: string }) {
  const best = l.direct[0] ?? l.analogous[0];
  const r = best?.record;
  const rows: { dim: string; you: string; record: string; level: Level; gap?: string }[] = [];
  if (r) {
    if (q.material) rows.push({ dim: "Material", you: q.material, record: r.material, level: r.material === q.material ? "exact" : "outside" });
    if (q.gravity) rows.push({ dim: "Gravity", you: G[q.gravity], record: G[r.gravity], level: r.gravity === q.gravity ? "exact" : "regime" });
    const num = (dim: string, you: number | undefined, rec: number | null, tol: number, unit: string) => {
      if (you == null) return;
      if (rec == null) return rows.push({ dim, you: `${you} ${unit}`, record: "not recorded", level: "unknown" });
      const d = Math.round(Math.abs(rec - you) * 10) / 10;
      rows.push({ dim, you: `${you} ${unit}`, record: `${rec} ${unit}`, level: d === 0 ? "exact" : d <= tol ? "within" : "outside", gap: d ? `${d} ${unit === "%" ? "points" : unit} apart` : undefined });
    };
    num("Oxygen", q.oxygen, r.oxygen, TOLERANCE.oxygen, "%");
    num("Pressure", q.pressureKpa, r.pressureKpa ? Math.round(((r.pressureKpa[0] + r.pressureKpa[1]) / 2) * 10) / 10 : null, TOLERANCE.pressureKpa, "kPa");
    if (q.flow != null) num("Airflow", q.flow, r.flowCmS, Math.max(1, q.flow * TOLERANCE.flowFraction), "cm/s");
  }
  const regime = rows.find((x) => x.level === "regime");
  const worst = regime ?? rows.find((x) => x.level === "outside") ?? rows.find((x) => x.level === "unknown");
  const set = [q.material && "material", q.oxygen != null && "oxygen", q.pressureKpa != null && "pressure", q.flow != null && "airflow", q.gravity && "gravity"].filter(Boolean).join(", ");
  const families = [...new Set([...l.direct, ...l.analogous].map((x) => x.record.family).concat(l.findings.analogous.map((x) => x.family.id), l.findings.mechanistic.map((x) => x.family.id)))];

  return (
    <div className={styles.status} data-direct={l.direct.length > 0}>
      <p className={styles.verdict}>
        {l.direct.length
          ? `${l.direct.length} NASA test record${l.direct.length === 1 ? "" : "s"} match every condition you set.`
          : `Current evidence does not directly cover this combination of ${set}.`}
      </p>
      <p className={styles.sub}>This is a statement about evidence, not a prediction: MicroFire does not estimate whether a fire would start or spread.</p>

      {r && (
        <div className={styles.budget}>
          <h4>
            Mismatch budget for the closest record, <Link href={r.href} className="link">{r.label}</Link>
          </h4>
          <ol>
            {rows.map((x) => (
              <li key={x.dim} data-level={x.level}>
                <span className={styles.dim}>{x.dim}</span>
                <span className={styles.bar} aria-hidden="true"><i /></span>
                <span className={styles.lvl}>{LEVEL_TEXT[x.level]}</span>
                <span className={styles.vals}>you {x.you} · record {x.record}{x.gap ? ` · ${x.gap}` : ""}</span>
              </li>
            ))}
          </ol>
          {worst && worst.level !== "exact" && worst.level !== "within" && (
            <p className={styles.worst}>
              <strong>Largest uncertainty:</strong>{" "}
              {worst.level === "regime" ? `gravity. No test record ran at ${worst.you}; only short reduced-gravity findings exist.` : `${worst.dim.toLowerCase()} (${worst.gap ?? worst.record}).`}
            </p>
          )}
        </div>
      )}

      <div className={styles.foot}>
        <div>
          <h4>Evidence families consulted</h4>
          <p className={styles.fams}>{families.map((f) => <span key={f} data-family={f}>{FAMILIES[f].name}</span>)}</p>
        </div>
        {l.nextExperiment && (
          <div>
            <h4>The test that would close the gap</h4>
            <p>{l.nextExperiment}</p>
          </div>
        )}
      </div>
      {briefHref && <Link href={briefHref} className={styles.brief}>Export a Mission Evidence Brief</Link>}
    </div>
  );
}
