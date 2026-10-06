"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import ex from "./ObsExtra.module.css";
import styles from "./AtlasObservatory.module.css";
import type { Row } from "@/lib/obsRows";

type S = "verified" | "analogous" | "gap";
export function WillItBurnLab({ rows }: { rows: Row[] }) {
  const mats = [...new Set(rows.map((r) => r.material))].sort();
  const [mat, setMat] = useState(mats.includes("PMMA") ? "PMMA" : mats[0]);
  const [gr, setGr] = useState<"micro" | "lunar" | "earth">("micro");
  const [o2, setO2] = useState(21), [kpa, setKpa] = useState(101), [flow, setFlow] = useState(10);
  const { near, status } = useMemo(() => {
    const pool = rows.filter((r) => (gr === "micro" ? r.fam !== "luci" : gr === "lunar" ? r.fam === "luci" : false) && r.o2 != null);
    const sc = pool.map((r) => {
      const dO = Math.abs(o2 - r.o2!), dF = r.flow == null ? 0 : Math.abs(flow - r.flow), dP = r.kpa == null ? 0 : Math.abs(kpa - r.kpa);
      return { r, d: dO / 5 + dF / 10 + dP / 20 + (r.material === mat ? 0 : 2), close: dO <= 2 && dF <= 5 && dP <= 10, same: r.material === mat };
    }).sort((a, b) => a.d - b.d);
    const status: S = sc.some((x) => x.close && x.same) ? "verified" : sc.some((x) => x.close || (x.same && x.d < 2)) ? "analogous" : "gap";
    return { near: sc.slice(0, 4), status };
  }, [rows, mat, gr, o2, kpa, flow]);
  const top = near[0]?.r;
  const h = status === "gap" || !top ? 0 : top.group === "sustained" ? 190 : top.group === "extinguished" ? 70 : top.group === "not_ignited" ? 0 : 130;
  const f = (l: string, v: number, set: (n: number) => void, min: number, max: number, u: string) => <div className={ex.field}><label><span>{l}</span><b>{v} {u}</b></label><input type="range" min={min} max={max} value={v} onChange={(e) => set(+e.target.value)} /></div>;
  return (
    <div className={ex.page}>
      <h1 className={ex.title}>Will it burn? <em>Orbital ignition</em></h1>
      <p className={ex.lead}>Set up a fire. Atlas shows what NASA&apos;s nearest tests actually recorded, or says plainly that nobody tested it. This is a lookup of real records, not a prediction or safety rating.</p>
      <div className={ex.three}>
        <section className={styles.panel}>
          <h2>Experiment setup</h2>
          <div className={ex.field}><label>Material</label><select value={mat} onChange={(e) => setMat(e.target.value)}>{mats.map((m) => <option key={m}>{m}</option>)}</select></div>
          <div className={ex.field}><label>Gravity</label><select value={gr} onChange={(e) => setGr(e.target.value as typeof gr)}><option value="micro">Microgravity (ISS / Cygnus)</option><option value="lunar">Lunar gravity (LUCI)</option><option value="earth">Earth gravity (1 g)</option></select></div>
          {f("O₂ concentration", o2, setO2, 15, 45, "%")}{f("Pressure", kpa, setKpa, 20, 105, "kPa")}{f("Airflow", flow, setFlow, 0, 50, "cm/s")}
        </section>
        <section className={styles.panel}>
          <h2>Combustion chamber</h2>
          <div className={ex.stage}><div className={`${ex.flame} ${ex["fh" + h]}`} /><div className={ex.pedestal} /></div>
          <p className={styles.sub}>{h ? "Flame size reflects the nearest NASA test’s recorded outcome." : "No flame: nearest outcome is no ignition, or no evidence."}</p>
        </section>
        <aside className={styles.panel}>
          <h2>NASA evidence status</h2>
          <div className={ex.status}>{(["verified", "analogous", "gap"] as S[]).map((s) => <div key={s} className={status === s ? `${ex.act} ${ex["act-" + s]}` : ""}>{s === "gap" ? "Data gap" : s[0].toUpperCase() + s.slice(1)}</div>)}</div>
          <p className={styles.sub}>{status === "verified" ? "A same-material test within ±2% O₂, ±5 cm/s and ±10 kPa exists." : status === "analogous" ? "Close conditions or same material exist, but not both together." : gr === "earth" ? "This atlas holds no 1 g tests." : "No close NASA test in the atlas."}</p>
          <h4 className={`${ex.cSoft}`}>Nearest NASA tests</h4>
          <ul className={ex.list}>{near.map(({ r }) => <li key={r.id}><Link href={r.href}>{r.code}</Link> · {r.material}<br />O₂ {r.o2}%{r.flow != null && ` · ${r.flow} cm/s`}{r.kpa != null && ` · ${Math.round(r.kpa)} kPa`}<br /><small>{r.label}</small></li>)}</ul>
        </aside>
      </div>
    </div>
  );
}
