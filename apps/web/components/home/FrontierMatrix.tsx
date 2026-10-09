"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import s from "./Home.module.css";

export type MiniRecord = { id: string; label: string; href: string; material: string; family: string; gravity: "microgravity" | "lunar" | "martian"; o2: number | null; kpa: number | null; outcome: string };
type Row = { id: MiniRecord["gravity"]; label: string; note: string };
type Cell = { row: Row; band: number; records: MiniRecord[]; status: "known" | "partial" | "unknown" };

const ROWS: Row[] = [
  { id: "microgravity", label: "Orbit", note: "microgravity" },
  { id: "lunar", label: "Moon", note: "lunar g · simulated only" },
  { id: "martian", label: "Mars", note: "Martian g" },
];
const BANDS: [number, number, string][] = [[0, 17, "< 17"], [17, 19, "17–19"], [19, 21.5, "19–21.5"], [21.5, 26, "21.5–26"], [26, 31, "26–31"], [31, 100, "≥ 31"]];
/** Mission atmospheres NASA has studied, placed where they would sit. Pins are questions, not results. */
const PINS = [
  { key: "A", label: "Exploration atmosphere A · 34 % O₂ · 56.5 kPa", row: "lunar", o2: 34, kpa: 56.5 },
  { key: "B", label: "Alternate atmosphere · 28.5 % O₂ · 66.2 kPa", row: "lunar", o2: 28.5, kpa: 66.2 },
  { key: "ISS", label: "ISS cabin · 21 % O₂ · 101.3 kPa", row: "microgravity", o2: 21, kpa: 101.3 },
];
const band = (o2: number) => BANDS.findIndex(([lo, hi]) => o2 >= lo && o2 < hi);
const MARK = { known: "✓", partial: "△", unknown: "?" } as const;
const WORD = { known: "Known", partial: "Partially known", unknown: "Unknown: data gap" } as const;

const STATUS = [
  { id: "verified", label: "Verified", body: (n: { records: number; quotes: number }) => `A NASA test record or a NASA quotation, checked against the source PDF when the site is built. ${n.records} records and ${n.quotes} quotes; one wrong number fails the build.` },
  { id: "supported", label: "Supported", body: () => "Analogous evidence: a real NASA test that differs from your condition in named ways (for example Saffire VI at 54 kPa and 29–31 % O₂, in orbit rather than on the Moon). Shown with every difference marked." },
  { id: "limited", label: "Limited", body: () => "Mechanism-only or conditional evidence: droplet and gas flames (FLEX, ACME), two simulated lunar-gravity burns (LUCI), and FM², which is planned with no results yet. Never treated as a material outcome." },
  { id: "na", label: "Not available", body: () => "No NASA record covers the condition. MicroFire abstains: it shows the closest evidence, names the experiment that would close the gap, and the AI Model Lab blocks any prediction." },
] as const;

export function FrontierMatrix({ records, quotes }: { records: MiniRecord[]; quotes: number }) {
  const materials = useMemo(() => [...new Set(records.map((r) => r.material))].sort(), [records]);
  const [material, setMaterial] = useState("all");
  const [reduced, setReduced] = useState(false);
  const [sel, setSel] = useState<[MiniRecord["gravity"], number]>(["lunar", 5]);
  const [open, setOpen] = useState<string>("na");

  const cells = useMemo(() => {
    const pool = records.filter((r) => r.o2 != null && (material === "all" || r.material === material) && (!reduced || (r.kpa != null && r.kpa < 90)));
    return ROWS.map((row) => BANDS.map((_, b): Cell => {
      const rs = pool.filter((r) => r.gravity === row.id && band(r.o2!) === b);
      return { row, band: b, records: rs, status: rs.length === 0 ? "unknown" : rs.length >= 3 && row.id === "microgravity" ? "known" : "partial" };
    }));
  }, [records, material, reduced]);
  const total = cells.flat();
  const counts = { known: total.filter((c) => c.status === "known").length, partial: total.filter((c) => c.status === "partial").length, unknown: total.filter((c) => c.status === "unknown").length };
  const cur = cells[ROWS.findIndex((r) => r.id === sel[0])][sel[1]];
  const pinsHere = PINS.filter((p) => p.row === sel[0] && band(p.o2) === sel[1]);

  return (
    <section className={s.frontier} aria-labelledby="frontier-title">
      <div className={s.frontierHead}>
        <div>
          <p className={s.kickerWarm}>Research Frontier</p>
          <h2 id="frontier-title" className={s.h2}>Where NASA&apos;s evidence stops</h2>
          <p className={s.sub}>MicroFire Atlas refuses to fabricate conclusions when evidence stops. Every cell is counted from the real records: gravity against oxygen.</p>
        </div>
        <p className={s.tally} aria-label={`${counts.known} known, ${counts.partial} partially known, ${counts.unknown} unknown regions`}>
          <span data-s="known">{MARK.known} {counts.known} known</span><span data-s="partial">{MARK.partial} {counts.partial} partial</span><span data-s="unknown">{MARK.unknown} {counts.unknown} unknown</span>
        </p>
      </div>

      <div className={s.frontierBody}>
        <div className={s.matrixWrap}>
          <div className={s.filters}>
            <div role="group" aria-label="Material">
              <button type="button" aria-pressed={material === "all"} onClick={() => setMaterial("all")}>All materials</button>
              {materials.map((m) => <button type="button" key={m} aria-pressed={material === m} onClick={() => setMaterial(m)}>{m}</button>)}
            </div>
            <button type="button" className={s.pressure} aria-pressed={reduced} onClick={() => setReduced(!reduced)}>Reduced pressure only (&lt; 90 kPa)</button>
          </div>
          <table className={s.matrix}>
            <caption className="sr-only">NASA test records by gravity and oxygen. Select a cell for its records or its gap.</caption>
            <thead><tr><th scope="col"><span className="sr-only">Gravity</span>O₂ %</th>{BANDS.map(([, , l]) => <th scope="col" key={l}>{l}</th>)}</tr></thead>
            <tbody>
              {cells.map((row) => (
                <tr key={row[0].row.id}>
                  <th scope="row"><b>{row[0].row.label}</b><small>{row[0].row.note}</small></th>
                  {row.map((c) => {
                    const pins = PINS.filter((p) => p.row === c.row.id && band(p.o2) === c.band);
                    const on = sel[0] === c.row.id && sel[1] === c.band;
                    return (
                      <td key={c.band}>
                        <button type="button" className={s.cell} data-s={c.status} aria-pressed={on} onClick={() => setSel([c.row.id, c.band])}
                          aria-label={`${c.row.label}, ${BANDS[c.band][2]} % oxygen: ${WORD[c.status]}, ${c.records.length} records${pins.length ? `, mission pin ${pins.map((p) => p.key).join(", ")}` : ""}`}>
                          <span className={s.cellMark} aria-hidden="true">{MARK[c.status]}</span>
                          <span className={`${s.cellN} num`} aria-hidden="true">{c.records.length || ""}</span>
                          {pins.map((p) => <i key={p.key} className={s.pin} aria-hidden="true">{p.key}</i>)}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className={s.small}>Pins: {PINS.map((p) => `${p.key} = ${p.label}`).join("; ")}. Earth gravity is not a row: this atlas holds no 1-g tests, and NASA screens materials on Earth with a separate standard.</p>
        </div>

        <div className={s.cellDetail} aria-live="polite">
          <p className={s.cellTitle} data-s={cur.status}><span aria-hidden="true">{MARK[cur.status]}</span> {cur.row.label} · {BANDS[cur.band][2]} % O₂ <small>{WORD[cur.status]}</small></p>
          {pinsHere.map((p) => <p key={p.key} className={s.pinNote}><i className={s.pin}>{p.key}</i> {p.label}</p>)}
          {cur.records.length ? (
            <>
              <p className={s.small}>{cur.records.length} NASA record{cur.records.length === 1 ? "" : "s"}{cur.row.id === "lunar" ? ", all simulated lunar gravity on a spinning rocket" : ""}.</p>
              <ul className={s.recs}>{cur.records.slice(0, 4).map((r) => <li key={r.id}><Link className="link" href={r.href}>{r.label}</Link><small>{r.material} · {r.o2} % O₂{r.kpa != null ? ` · ${r.kpa} kPa` : ""} · {r.outcome}</small></li>)}</ul>
              {cur.records.length > 4 && <Link className="link text-sm" href="/atlas">and {cur.records.length - 4} more in the Atlas</Link>}
            </>
          ) : (
            <>
              <p>No NASA test in this atlas burned here. MicroFire shows the closest evidence, names the experiment that would fill this cell, and gives no outcome.</p>
              <Link className={s.edgeCta} href="/gaps#research-planning">What experiment would close this gap?</Link>
            </>
          )}
        </div>

        <div className={s.integrity}>
          <h3 className={s.h3}>Evidence status</h3>
          <ul className={s.statusList}>
            {STATUS.map((x) => (
              <li key={x.id} data-s={x.id}>
                <button type="button" aria-expanded={open === x.id} aria-controls={`status-${x.id}`} onClick={() => setOpen(open === x.id ? "" : x.id)}>
                  <span className={s.statusDot} aria-hidden="true" />{x.label}
                </button>
                <p id={`status-${x.id}`} hidden={open !== x.id}>{x.body({ records: records.length, quotes })}</p>
              </li>
            ))}
          </ul>
          <details className={s.limits}>
            <summary>Limitations we state up front</summary>
            <ul>
              <li>A curated atlas of {records.length} records, not the complete NASA combustion archive.</li>
              <li>Similarity, ranking and coverage scores are MicroFire heuristics, never NASA ratings.</li>
              <li>No safe or unsafe ratings, risk scores or fire probabilities anywhere.</li>
              <li>Flame Vision reports pixels; NASA publishes no calibration for the footage.</li>
            </ul>
            <Link className="link text-sm" href="/methodology#limits">All limitations</Link>
          </details>
        </div>
      </div>
    </section>
  );
}
