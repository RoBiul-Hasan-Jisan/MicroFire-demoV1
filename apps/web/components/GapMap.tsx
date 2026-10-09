"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { OutcomeTag } from "@/components/Outcome";
import { experiments, GROUP_LABEL } from "@/lib/data";
import { FLOW_BINS, gapGrid, nearestObserved, O2_BINS, OBSERVED_MIN, type Zone } from "@/lib/gaps";
import type { OutcomeGroup } from "@/lib/types";

const ZONE: Record<Zone, { label: string; cls: string }> = {
  observed: { label: `Observed region (${OBSERVED_MIN}+ tests)`, cls: "bg-quench/35 border-quench/60" },
  sparse: { label: "Sparse region (1–2 tests)", cls: "bg-quench/12 border-quench/35" },
  outside: { label: "Outside available evidence", cls: "bg-transparent border-rule border-dashed" },
};

const binLabel = ([a, b]: [number, number], unit: string) => (a === 0 ? `under ${b}${unit}` : `${a}–${b}${unit}`);

export function GapMap() {
  const materials = [...new Set(experiments.map((e) => e.material))];
  const [material, setMaterial] = useState("all");
  const data = material === "all" ? experiments : experiments.filter((e) => e.material === material);
  const grid = useMemo(() => gapGrid(data), [data]);
  const [sel, setSel] = useState<[number, number]>([5, 2]);
  const cell = grid[sel[0]][sel[1]];
  const near = cell.zone === "outside" ? nearestObserved(grid, sel[0], sel[1]) : null;
  const rows = [...grid.keys()].reverse(); // high oxygen at the top

  return (
    <div className="frontier-workspace grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <div>
        <label className="inline-flex items-center gap-3 text-sm">
          <span className="text-muted">Material</span>
          <select value={material} onChange={(e) => setMaterial(e.target.value)} className="bg-panel border border-rule rounded-sm px-2 py-1.5">
            <option value="all">All materials</option>
            {materials.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>

        <div data-guide="grid" className="frontier-grid instrument-panel mt-5 overflow-x-auto">
          <table className="border-separate border-spacing-1 num">
            <caption className="sr-only">Number of NASA tests in each oxygen and airflow range. Select a cell for details.</caption>
            <thead>
              <tr>
                <th scope="col" className="text-xs text-muted font-normal text-left pr-2">
                  O₂ \ airflow
                </th>
                {FLOW_BINS.map((f) => (
                  <th key={f.join()} scope="col" className="text-xs text-muted font-normal w-24">
                    {binLabel(f, " cm/s")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i}>
                  <th scope="row" className={`text-xs font-normal text-right pr-2 ${O2_BINS[i][0] >= 22 ? "text-flame" : "text-muted"}`}>
                    {binLabel(O2_BINS[i], " %")}
                  </th>
                  {grid[i].map((c, j) => {
                    const active = sel[0] === i && sel[1] === j;
                    return (
                      <td key={j} className="p-0">
                        <button
                          data-quest="gap-cell"
                          onClick={() => setSel([i, j])}
                          aria-pressed={active}
                          aria-label={`${binLabel(c.o2, " % oxygen")}, ${binLabel(c.flow, " cm/s")}: ${c.tests.length} tests, ${ZONE[c.zone].label}`}
                          className={`w-24 h-11 border rounded-sm text-sm ${ZONE[c.zone].cls} ${active ? "outline-2 outline-signal outline-offset-1" : ""}`}
                        >
                          {c.tests.length || ""}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          {(Object.keys(ZONE) as Zone[]).map((z) => (
            <li key={z} className="flex items-center gap-2">
              <span className={`inline-block w-4 h-3 border rounded-sm ${ZONE[z].cls}`} aria-hidden="true" />
              {ZONE[z].label}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-faint max-w-[70ch]">
          A test whose airflow was ramped counts in every airflow range it passed through. Orange oxygen rows are above
          normal air, including the 34 % exploration atmosphere: no test in this atlas reached them.
        </p>
      </div>

      <section aria-live="polite" className="evidence-drawer p-6 self-start">
        <p className="text-signal text-sm mb-3">Your selected region</p>
        <h2 className="font-semibold">
          {binLabel(cell.o2, " % oxygen")}, airflow {binLabel(cell.flow, " cm/s")}
        </h2>
        <p className="mt-1 text-sm text-muted">{ZONE[cell.zone].label}</p>
        {cell.tests.length > 0 ? (
          <>
            <p className="mt-4 text-[15px]">
              {(Object.keys(cell.outcomes) as OutcomeGroup[]).map((g) => `${cell.outcomes[g]} ${GROUP_LABEL[g].toLowerCase()}`).join(", ")}.
            </p>
            <ul className="mt-4 divide-y divide-rule border-y border-rule text-sm">
              {cell.tests.map((e) => (
                <li key={e.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/experiments/${e.id}`} className="link">
                    {e.test_id}
                  </Link>
                  <span className="text-muted">
                    {e.material}, {e.oxygen_vol_pct}%
                  </span>
                  <OutcomeTag outcome={e.outcome} label={e.outcome_label} />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="mt-4 space-y-3 text-[15px]">
            <p>No test in this atlas falls here, so the site makes no claim about how a fire behaves in this range.</p>
            {near && (
              <p className="text-muted">
                Research idea: the nearest well-covered range is {binLabel(O2_BINS[near.i], " % oxygen")} at{" "}
                {binLabel(FLOW_BINS[near.j], " cm/s")}. A test in this cell, with the same material and geometry as those, would
                extend the evidence by {near.d} step{near.d === 1 ? "" : "s"} from what is already known.
              </p>
            )}
            <p className="text-xs text-faint">
              This is a pointer for researchers exploring the data, not guidance on NASA test planning.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
