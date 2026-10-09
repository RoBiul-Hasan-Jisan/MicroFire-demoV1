"use client";

import { useMemo, useState } from "react";
import type { EvidenceRecord } from "@/lib/ontology";
import type { Finding } from "@/lib/types";
import { ATMOSPHERES } from "@/lib/atmospheres";
import { gradeMaterials, parseList, toCsv, type Grade } from "@/lib/materials-bulk";
import type { Gravity } from "@/lib/relevance";
import css from "./Insight.module.css";

const MARK: Record<Grade, string> = { direct: "● ", analogous: "◐ ", gap: "○ " };
const EXAMPLE = "PMMA\nNomex\nSIBAL fabric\nSilicone\nCotton jersey\nKevlar-wrapped foam";

export function MaterialsBulkView({ records, findings }: { records: EvidenceRecord[]; findings: Finding[] }) {
  const [text, setText] = useState(EXAMPLE);
  const [atm, setAtm] = useState("ea-a");
  const [o2c, setO2c] = useState(34);
  const [kpac, setKpac] = useState(56.5);
  const [gravity, setGravity] = useState<Gravity>("lunar");
  const [flow, setFlow] = useState("");
  const profile = ATMOSPHERES.find((a) => a.id === atm)!;
  const oxygen = profile.id === "custom" ? o2c : profile.o2 ?? undefined;
  const kpa = profile.id === "custom" ? kpac : profile.kpa ?? undefined;
  const rows = useMemo(() => gradeMaterials(parseList(text), { oxygen, pressureKpa: kpa, gravity, flow: flow === "" ? undefined : Number(flow) }, records, findings), [text, oxygen, kpa, gravity, flow, records, findings]);
  const csv = toCsv(rows);
  const download = () => {
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "microfire-material-evidence.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={css.page}>
      <section className={css.card} aria-labelledby="in">
        <h2 id="in" className="display text-xl">Your materials and cabin</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className={css.field}>Materials, one per line (up to 50)
            <textarea className={css.input} rows={8} value={text} onChange={(e) => setText(e.target.value)} /></label>
          <div className="grid gap-3 content-start">
            <label className={css.field}>Atmosphere
              <select className={css.input} value={atm} onChange={(e) => setAtm(e.target.value)}>{ATMOSPHERES.map((a) => <option key={a.id} value={a.id}>{a.name}{a.id !== "custom" ? ` (${a.short})` : ""}</option>)}</select></label>
            {atm === "custom" && <div className="grid grid-cols-2 gap-3">
              <label className={css.field}>Oxygen %<input className={css.input} type="number" step="0.1" value={o2c} onChange={(e) => setO2c(+e.target.value)} /></label>
              <label className={css.field}>Pressure kPa<input className={css.input} type="number" step="0.1" value={kpac} onChange={(e) => setKpac(+e.target.value)} /></label></div>}
            <label className={css.field}>Gravity
              <select className={css.input} value={gravity} onChange={(e) => setGravity(e.target.value as Gravity)}><option value="microgravity">Microgravity (ISS)</option><option value="lunar">Lunar</option><option value="martian">Martian</option></select></label>
            <label className={css.field}>Airflow, cm/s (optional)<input className={css.input} type="number" min="0" step="0.5" value={flow} onChange={(e) => setFlow(e.target.value)} /></label>
          </div>
        </div>
      </section>

      <section className={css.card} aria-labelledby="out">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="out" className="display text-xl">Evidence grade per material</h2>
          <div className="flex gap-2"><button className={css.btn} onClick={download}>Download CSV</button><button className={css.btn} onClick={() => navigator.clipboard?.writeText(csv)}>Copy CSV</button></div>
        </div>
        <p className="text-sm text-muted mt-2 max-w-[78ch]">The grade says how much NASA test evidence in this atlas fits the cabin. It is not a flammability rating. “No evidence” means untested here, not safe.</p>
        <div className={`${css.scroll} mt-3`}>
          <table className={css.tbl}>
            <thead><tr><th>Entered</th><th>Grade</th><th>Tests of this material</th><th>Closest test and how it differs</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.input}-${i}`}>
                  <td><b>{r.input}</b>{r.canonical && r.canonical !== r.input && <div className="text-xs text-muted">matched to {r.canonical}</div>}</td>
                  <td className={css[`grade-${r.grade}` as "grade-direct"]}><b>{MARK[r.grade]}{r.label}</b><div className="text-xs text-muted">{r.note}</div></td>
                  <td className={css.mono}>{r.tests ? `${r.tests}: ${r.outcomes.sustained} sustained, ${r.outcomes.extinguished + r.outcomes.not_ignited} out or not ignited, ${r.outcomes.unknown} not stated` : "none"}</td>
                  <td>{r.closest ? <><a className="text-signal underline" href={r.closest.href}>{r.closest.label}</a><div className="text-xs text-muted">{r.closest.differs.join("; ")}</div></> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
