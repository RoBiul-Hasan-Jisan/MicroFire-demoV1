"use client";

import { useMemo, useState } from "react";
import type { Model } from "@/lib/model";
import { unseenGrid, FLOW_STEPS, O2_STEPS, type Verdict } from "@/lib/unseen";
import { pct } from "@/lib/next-tests";
import css from "./Insight.module.css";

const BG: Record<Verdict, string> = {
  "hidden-burn-possible": "rgba(91,140,255,.18)",
  "may-burn-small": "rgba(240,160,68,.55)",
  "likely-goes-out": "rgba(74,85,112,.55)",
  ordinary: "rgba(255,255,255,.07)",
};
const MARK: Record<Verdict, string> = { "hidden-burn-possible": "?", "may-burn-small": "◐", "likely-goes-out": "✕", ordinary: "●" };

export function UnseenMapView({ model }: { model: Model }) {
  const [dir, setDir] = useState<"concurrent" | "opposed">("concurrent");
  const grid = useMemo(() => unseenGrid(model, dir), [model, dir]);
  const rows = [...grid.keys()].reverse();
  const [sel, setSel] = useState<{ r: number; c: number } | null>({ r: 0, c: 4 });
  const cell = sel ? grid[sel.r][sel.c] : null;

  return (
    <div className={css.page}>
      <section className={css.card} aria-labelledby="map">
        <h2 id="map" className="display text-xl">Airflow × oxygen</h2>
        <label className={`${css.field} mt-3`} style={{ maxWidth: 260 }}>Flow direction
          <select className={css.input} value={dir} onChange={(e) => setDir(e.target.value as "concurrent" | "opposed")}><option value="concurrent">Concurrent</option><option value="opposed">Opposed</option></select></label>
        <div className={`${css.scroll} mt-4`}>
          <table className={css.heat}>
            <caption className="sr-only">Model verdict by effective airflow and oxygen. Select a cell for details.</caption>
            <thead><tr><th scope="col">Airflow ↓ / O₂ % →</th>{O2_STEPS.map((o) => <th key={o} scope="col">{o}</th>)}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r}>
                  <th scope="row">{FLOW_STEPS[r]} cm/s</th>
                  {grid[r].map((c, ci) => (
                    <td key={ci} className={c.verdict === "hidden-burn-possible" ? css.hatch : undefined} style={{ background: c.verdict === "hidden-burn-possible" ? undefined : BG[c.verdict], outline: sel && sel.r === r && sel.c === ci ? "2px solid var(--signal)" : "none" }}>
                      <button onClick={() => setSel({ r, c: ci })} aria-label={`${c.o2} percent oxygen, ${c.flow} centimetres per second: ${c.text}`} style={{ all: "unset", cursor: "pointer", width: "100%", height: "100%", display: "grid", placeItems: "center" }}>
                        <span>{MARK[c.verdict]}{c.p !== undefined && <small style={{ marginLeft: 4 }}>{pct(c.p)}</small>}</span>
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={`${css.legend} mt-3`}>
          <span><i className={`${css.sw} ${css.hatch}`} />? No labelled test, model silent; NASA reports dim blue, stable flames</span>
          <span><i className={css.sw} style={{ background: BG["may-burn-small"] }} />◐ Model leans burning where flames are flow-sensitive</span>
          <span><i className={css.sw} style={{ background: BG["likely-goes-out"] }} />✕ Model leans going out</span>
          <span><i className={css.sw} style={{ background: BG.ordinary }} />● Model leans burning; no visibility concern cited</span>
        </div>
        <div className="mt-4 text-sm" aria-live="polite">
          {cell && <p><b>{cell.o2} % O₂, {cell.flow} cm/s.</b> {cell.text}{cell.p !== undefined && ` Estimate ${pct(cell.p)} (90 % interval ${pct(cell.lo ?? 0)}–${pct(cell.hi ?? 0)}).`}</p>}
        </div>
      </section>
    </div>
  );
}
