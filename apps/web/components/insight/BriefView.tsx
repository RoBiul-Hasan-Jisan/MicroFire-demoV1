"use client";

import { useMemo, useState } from "react";
import { ATMOSPHERES } from "@/lib/atmospheres";
import { buildBrief, type BriefData } from "@/lib/brief";
import type { Gravity } from "@/lib/gravity-bridge";
import css from "./Insight.module.css";

export function BriefView({ data }: { data: BriefData }) {
  const [gravity, setGravity] = useState<Gravity>("lunar");
  const [atmId, setAtmId] = useState("ea-a");
  const [o2, setO2] = useState(34);
  const [kpa, setKpa] = useState(56.5);
  const [flow, setFlow] = useState("0");
  const [direction, setDirection] = useState<"concurrent" | "opposed">("concurrent");
  const [materials, setMaterials] = useState("PMMA\nNomex\nSIBAL fabric\nSilicone");
  const atmosphere = ATMOSPHERES.find((a) => a.id === atmId)!;
  const custom = atmId === "custom";
  const brief = useMemo(
    () => buildBrief({ gravity, atmosphere, oxygen: custom ? o2 : undefined, pressureKpa: custom ? kpa : undefined, flow: flow === "" ? undefined : Number(flow), direction, materials }, data),
    [gravity, atmosphere, custom, o2, kpa, flow, direction, materials, data],
  );
  const download = () => {
    const url = URL.createObjectURL(new Blob([brief.markdown], { type: "text/markdown" }));
    const a = document.createElement("a");
    a.href = url; a.download = "microfire-mission-brief.md"; a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className={css.page}>
      <section className={css.card} aria-labelledby="inputs">
        <h2 id="inputs" className="display text-xl">Describe the cabin</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className={css.field}>Gravity
            <select className={css.input} value={gravity} onChange={(e) => setGravity(e.target.value as Gravity)}><option value="microgravity">Microgravity (ISS)</option><option value="lunar">Lunar</option><option value="martian">Martian</option></select></label>
          <label className={css.field}>Atmosphere
            <select className={css.input} value={atmId} onChange={(e) => setAtmId(e.target.value)}>{ATMOSPHERES.map((a) => <option key={a.id} value={a.id}>{a.name}{a.id !== "custom" ? ` (${a.short})` : ""}</option>)}</select></label>
          {custom && <><label className={css.field}>Oxygen %<input className={css.input} type="number" step="0.1" value={o2} onChange={(e) => setO2(+e.target.value)} /></label>
            <label className={css.field}>Pressure kPa<input className={css.input} type="number" step="0.1" value={kpa} onChange={(e) => setKpa(+e.target.value)} /></label></>}
          <label className={css.field}>Forced airflow, cm/s (0 = none)<input className={css.input} type="number" min="0" step="0.5" value={flow} onChange={(e) => setFlow(e.target.value)} /></label>
          <label className={css.field}>Flow direction
            <select className={css.input} value={direction} onChange={(e) => setDirection(e.target.value as "concurrent" | "opposed")}><option value="concurrent">Concurrent</option><option value="opposed">Opposed</option></select></label>
        </div>
        <label className={`${css.field} mt-4`}>Materials, one per line<textarea className={css.input} rows={5} value={materials} onChange={(e) => setMaterials(e.target.value)} /></label>
      </section>

      <article className={css.card} aria-labelledby="brief-h">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="brief-h" className="display text-2xl">{brief.title}</h2>
          <div className="flex gap-2"><button className={css.btn} onClick={download}>Download Markdown</button><button className={css.btn} onClick={() => window.print()}>Print / save as PDF</button></div>
        </div>
        {brief.sections.map((s) => (
          <section key={s.heading} className="mt-5">
            <h3 className="font-semibold text-signal">{s.heading}</h3>
            <ul className="mt-2 grid gap-2 text-sm list-disc pl-5">{s.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
          </section>
        ))}
        <p className="text-xs text-muted mt-6">Deterministic: every line comes from a rule applied to the atlas data. No language model wrote it.</p>
      </article>
    </div>
  );
}
