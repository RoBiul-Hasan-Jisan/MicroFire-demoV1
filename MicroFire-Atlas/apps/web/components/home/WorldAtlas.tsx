"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { MiniRecord } from "./FrontierMatrix";
import s from "./WorldAtlas.module.css";

type World = MiniRecord["gravity"];
const WORLDS: { id: World; name: string; sub: string; note: string }[] = [
  { id: "microgravity", name: "Orbit", sub: "Microgravity · ISS", note: "BASS-II and Saffire flew aboard the ISS and its cargo ships. These are real microgravity burns." },
  { id: "lunar", name: "Moon", sub: "Simulated lunar gravity", note: "LUCI simulated lunar gravity on a spinning rocket. These are not Moon-surface tests." },
  { id: "martian", name: "Mars", sub: "Martian gravity", note: "No Martian-gravity fire tests exist in this collection. The evidence stops here." },
];
const O2_BANDS: { id: string; label: string; test: (o2: number) => boolean }[] = [
  { id: "any", label: "Any oxygen", test: () => true },
  { id: "low", label: "Below 19 %", test: (o2) => o2 < 19 },
  { id: "air", label: "19–22 % (Earth-like)", test: (o2) => o2 >= 19 && o2 < 22 },
  { id: "high", label: "22 % and above", test: (o2) => o2 >= 22 },
];
const MAX_DOTS = 30;
const PAGE = 8;

/** One question, one answer: pick a world, see how many real NASA tests exist there, filter them, open the source. Counts come from the records, never typed in. */
export function WorldAtlas({ records }: { records: MiniRecord[] }) {
  const [world, setWorld] = useState<World>("microgravity");
  const [material, setMaterial] = useState("all");
  const [o2, setO2] = useState("any");
  const [all, setAll] = useState(false);

  const materials = useMemo(() => [...new Set(records.map((r) => r.material))].sort(), [records]);
  const totals = useMemo(() => Object.fromEntries(WORLDS.map((w) => [w.id, records.filter((r) => r.gravity === w.id).length])) as Record<World, number>, [records]);
  const band = O2_BANDS.find((b) => b.id === o2) ?? O2_BANDS[0];
  const rows = useMemo(
    () => records.filter((r) => r.gravity === world && (material === "all" || r.material === material) && (band.id === "any" || (r.o2 != null && band.test(r.o2)))),
    [records, world, material, band],
  );
  const active = WORLDS.find((w) => w.id === world)!;
  const shown = all ? rows : rows.slice(0, PAGE);
  const pick = (id: World) => { setWorld(id); setAll(false); };

  return (
    <section className={s.atlas} aria-labelledby="atlas-title" data-guide="paths">
      <div className={s.head}>
        <h2 id="atlas-title" className={s.title}>Choose a world. See where the evidence holds.</h2>
        <p className={s.sub}>Each dot is one real NASA fire test. Empty circles are tests that do not exist.</p>
      </div>

      <div className={s.worlds} role="group" aria-label="World">
        {WORLDS.map((w) => {
          const total = totals[w.id];
          const dots = Math.min(total, MAX_DOTS);
          const lit = world === w.id && total ? Math.round((rows.length * dots) / total) : dots;
          const empties = total === 0 ? 8 : 0;
          return (
            <button key={w.id} type="button" className={s.world} aria-pressed={world === w.id} onClick={() => pick(w.id)}>
              <span className={s.worldName}>{w.name}</span>
              <span className={s.worldSub}>{w.sub}</span>
              <span className={s.count}><b>{total}</b> {total === 1 ? "test" : "tests"}</span>
              <span className={s.dots} aria-hidden="true">
                {Array.from({ length: dots }, (_, i) => <i key={i} className={i < lit ? s.dotOn : s.dotOff} />)}
                {total > MAX_DOTS && <em>+{total - MAX_DOTS}</em>}
                {Array.from({ length: empties }, (_, i) => <i key={`e${i}`} className={s.dotNone} />)}
              </span>
            </button>
          );
        })}
      </div>

      <p className={s.note} aria-live="polite">{active.note}</p>

      {totals[world] === 0 ? (
        <div className={s.empty}>
          <p>Nothing to filter: NASA has not tested fire at this gravity in this collection.</p>
          <Link href="/gaps" className={s.link}>See which test would close the gap →</Link>
        </div>
      ) : (
        <>
          <div className={s.filters}>
            <label>Material
              <select value={material} onChange={(e) => { setMaterial(e.target.value); setAll(false); }}>
                <option value="all">All materials</option>
                {materials.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <label>Oxygen
              <select value={o2} onChange={(e) => { setO2(e.target.value); setAll(false); }}>
                {O2_BANDS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
              </select>
            </label>
            <p className={s.matches} aria-live="polite">{rows.length} of {totals[world]} match</p>
          </div>

          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead><tr><th scope="col">Test</th><th scope="col">Material</th><th scope="col">O₂</th><th scope="col">Pressure</th><th scope="col">Outcome</th></tr></thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    <th scope="row"><Link href={r.href} className={s.link}>{r.label}</Link></th>
                    <td>{r.material}</td>
                    <td>{r.o2 != null ? `${r.o2} %` : "n/r"}</td>
                    <td>{r.kpa != null ? `${r.kpa} kPa` : "n/r"}</td>
                    <td>{r.outcome}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={5} className={s.none}>No test matches these filters. That is also a finding.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className={s.foot}>
            {rows.length > PAGE && <button type="button" className={s.more} onClick={() => setAll(!all)}>{all ? "Show fewer" : `Show all ${rows.length}`}</button>}
            <Link href="/atlas" className={s.link}>Open the full Atlas, with comparison →</Link>
          </div>
        </>
      )}
    </section>
  );
}
