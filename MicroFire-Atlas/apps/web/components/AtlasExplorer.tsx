"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AtmosphereMap } from "@/components/AtmosphereMap";
import { Cite } from "@/components/Cite";
import { FlowO2Plot } from "@/components/FlowO2Plot";
import { Legend, OutcomeTag } from "@/components/Outcome";
import { GROUP_LABEL } from "@/lib/data";
import { fromSaffire } from "@/lib/ontology";
import type { Citation, Experiment, LuciRun, OutcomeGroup, SaffireRun } from "@/lib/types";
import { AtlasDetective } from "@/components/AtlasDetective";
import { useExplorer } from "@/components/guide/EmberGuide";
import { QuestBoard } from "@/components/quest/QuestBoard";
import styles from "./AtlasExplorer.module.css";

type Family = "bass2" | "saffire" | "luci";

/** One test tile, whichever experiment it came from. Values stay as NASA recorded them. */
type Item = {
  id: string; code: string; family: Family; material: string; o2: number | null; flow: number | null; kpa: string | null;
  size: string; group: OutcomeGroup; outcome: string; outcomeLabel: string; note: string | null; href: string; cite: Citation | null; flagged: boolean;
};

const PLAIN: Record<string, string> = {
  PMMA: "clear acrylic plastic",
  "SIBAL fabric": "cotton and fiberglass cloth",
  Nomex: "fire-resistant fabric",
  Silicone: "rubbery silicone sheet",
  "Cotton jersey": "T-shirt cotton",
};
const GROUPS = Object.keys(GROUP_LABEL) as OutcomeGroup[];
const FAMILY_INFO: Record<Family, { name: string; kid: string; scale: string }> = {
  bass2: { name: "BASS and BASS-II", kid: "Small flames in a wind tunnel on the space station", scale: "1–2 cm samples, near sea-level pressure" },
  saffire: { name: "Saffire", kid: "Big fires set on purpose inside empty cargo ships", scale: "5 cm to 94 cm samples, some at low pressure" },
  luci: { name: "LUCI", kid: "Fires in Moon-like gravity, made by a spinning rocket", scale: "2 burns of about 2.5 minutes, in normal air" },
};

const fromExp = (e: Experiment): Item => ({
  id: e.id, code: e.test_id, family: "bass2", material: e.material, o2: e.oxygen_vol_pct, flow: e.flow_initial_cm_s,
  kpa: e.pressure_kpa != null ? String(e.pressure_kpa) : e.pressure_kpa_range ? `${e.pressure_kpa_range[0]}–${e.pressure_kpa_range[1]}` : null,
  size: [e.width_mm != null && `${e.width_mm / 10} cm wide`, e.thickness_mm != null && `${e.thickness_mm} mm thick`].filter(Boolean).join(", "),
  group: e.outcome_group, outcome: e.outcome, outcomeLabel: e.outcome_label, note: e.observations_verbatim, href: `/experiments/${e.id}`,
  cite: e.provenance.record, flagged: e.quality_flags.length > 0,
});
const fromRun = (r: SaffireRun): Item => ({
  id: r.id, code: r.sample, family: "saffire", material: r.material, o2: r.o2_pct, flow: r.flow_cm_s, kpa: r.pressure_kpa != null ? String(r.pressure_kpa) : null,
  size: [r.width_cm != null && `${r.width_cm} cm wide`, r.length_cm != null && `${r.length_cm} cm long`].filter(Boolean).join(", "),
  group: r.outcome_group, outcome: "", outcomeLabel: r.outcome_label, note: r.provenance.outcome?.quote ?? null, href: `/saffire#${r.id}`,
  cite: r.provenance.results ?? r.provenance.conditions ?? r.provenance.outcome, flagged: false,
});

const fromLuciRun = (r: LuciRun): Item => ({
  id: r.id, code: r.sample, family: "luci", material: r.material, o2: r.o2_start_pct, flow: null, kpa: "≈101",
  size: r.size_verbatim, group: r.outcome_group, outcome: "", outcomeLabel: r.outcome_label,
  note: r.provenance.outcome?.quote ?? null, href: `/atlas#${r.id}`, cite: r.provenance.outcome ? { source_id: "luci", pdf_page: r.provenance.outcome.pdf_page } : null, flagged: false,
});

export function AtlasExplorer({ data, saffire, luci }: { data: Experiment[]; saffire: SaffireRun[]; luci: LuciRun[] }) {
  const [family, setFamily] = useState<Family>("bass2");
  const all = useMemo(() => (family === "bass2" ? data.map(fromExp) : family === "saffire" ? saffire.map(fromRun) : luci.map(fromLuciRun)), [family, data, saffire, luci]);
  const materials = [...new Set(all.map((i) => i.material))];
  const [material, setMaterial] = useState("all");
  const [groups, setGroups] = useState<Set<OutcomeGroup>>(new Set(GROUPS));
  const [hideFlagged, setHideFlagged] = useState(false);
  const [view, setView] = useState<"tiles" | "table">("tiles");
  const [picked, setPicked] = useState<string | null>(null);
  const { discover } = useExplorer();

  const items = all.filter((i) => (material === "all" || i.material === material) && groups.has(i.group) && (!hideFlagged || !i.flagged));
  items.sort((a, b) => (b.o2 ?? -1) - (a.o2 ?? -1) || a.code.localeCompare(b.code, "en", { numeric: true }));
  const sel = items.find((i) => i.id === picked) ?? items[0] ?? null;
  const exps = data.filter((e) => items.some((i) => i.id === e.id));

  // a link like /atlas#luci-sibal opens that family and record
  useEffect(() => {
    const open = () => {
      const id = location.hash.slice(1);
      const f: Family | null = luci.some((r) => r.id === id) ? "luci" : saffire.some((r) => r.id === id) ? "saffire" : null;
      if (f) { setFamily(f); setPicked(id); }
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, [luci, saffire]);
  const switchFamily = (f: Family) => { if (f !== "bass2") discover("family"); setFamily(f); setMaterial("all"); setGroups(new Set(GROUPS)); setPicked(null); };
  const toggle = (g: OutcomeGroup) => setGroups((s) => { const n = new Set(s); if (n.has(g)) n.delete(g); else n.add(g); return n.size ? n : new Set(GROUPS); });
  const reset = () => { setMaterial("all"); setGroups(new Set(GROUPS)); setHideFlagged(false); };

  return (
    <div className={styles.atlas}>
      <QuestBoard page="atlas" crew="mei" />
      <div className={styles.families} role="tablist" aria-label="Experiment family">
        {(["bass2", "saffire", "luci"] as Family[]).map((f) => (
          <button key={f} role="tab" aria-selected={family === f} className={styles.family} data-family={f} onClick={() => switchFamily(f)}>
            <span className={styles.famCount}>{f === "bass2" ? data.length : f === "saffire" ? saffire.length : luci.length}</span>
            <span><strong>{FAMILY_INFO[f].name}</strong><small>{FAMILY_INFO[f].kid}</small><em>{FAMILY_INFO[f].scale}</em></span>
          </button>
        ))}
        <Link href="/sources" className={styles.family} data-family="other">
          <span className={styles.famCount}>+</span>
          <span><strong>Other experiments</strong><small>SoFIE, FM², FLEX and ACME, as verified quotes</small><em>Kept apart: different fuels or not flown yet</em></span>
        </Link>
      </div>

      <div className={styles.filters} data-guide="filters">
        <div className={styles.filterRow} role="group" aria-label="Material">
          <span className={styles.filterLabel}>What burned</span>
          <button className={styles.chip} aria-pressed={material === "all"} onClick={() => setMaterial("all")}>Everything <small>{all.length}</small></button>
          {materials.map((m) => (
            <button key={m} className={styles.chip} aria-pressed={material === m} onClick={() => setMaterial(m)}>
              {m}{PLAIN[m] && <i> · {PLAIN[m]}</i>} <small>{all.filter((i) => i.material === m).length}</small>
            </button>
          ))}
        </div>
        <div className={styles.filterRow} role="group" aria-label="What NASA recorded">
          <span className={styles.filterLabel}>What happened</span>
          {GROUPS.map((g) => {
            const n = all.filter((i) => i.group === g && (material === "all" || i.material === material)).length;
            return n ? (
              <button key={g} className={styles.chip} data-group={g} aria-pressed={groups.has(g)} onClick={() => toggle(g)}>
                <b aria-hidden="true" />{GROUP_LABEL[g]} <small>{n}</small>
              </button>
            ) : null;
          })}
          {family === "bass2" && (
            <label className={styles.flagged}>
              <input type="checkbox" checked={hideFlagged} onChange={(e) => setHideFlagged(e.target.checked)} /> Hide flagged readings
            </label>
          )}
          <button className={styles.reset} onClick={reset}>Reset</button>
        </div>
      </div>

      <div className={styles.mapPanel} data-guide="plot">
        <div className={styles.howTo} aria-label="How to read this map">
          {family === "luci" ? (
            <span><b>◐</b> Two burns, one fabric and one plastic rod, in Moon-like gravity</span>
          ) : family === "bass2" ? (
            <>
              <span><b>↑</b> Higher means more oxygen</span>
              <span><b>→</b> Further right means more airflow</span>
              <span><b>●</b> Each dot is one real test; tap it to open</span>
              <span><b>—</b> A line means the crew changed the airflow during the test</span>
            </>
          ) : (
            <>
              <span><b>↑</b> Higher means more oxygen</span>
              <span><b>→</b> Further right means higher cabin pressure</span>
              <span><b>◎</b> Rings are NASA&apos;s two exploration-atmosphere scenarios</span>
            </>
          )}
        </div>
        {family === "luci" ? (
          <p className={styles.luciNote}>
            <b>Why a spinning rocket?</b> Drop towers give only seconds of low gravity. LUCI spun a capsule on a New Shepard rocket so the
            samples felt about one sixth of Earth&apos;s gravity for minutes. The spin also adds a sideways Coriolis force, and the chamber&apos;s
            oxygen fell during each burn, so these are lunar-gravity evidence with caveats, not tests on the Moon itself.
          </p>
        ) : family === "bass2" ? (
          <>
            <FlowO2Plot data={exps} highlight={sel ? [sel.id] : []} height={360} label={`${exps.length} NASA tests, plotted by oxygen and airflow`} />
            <Legend className="mt-3 px-1" />
          </>
        ) : (
          <AtmosphereMap records={saffire.filter((r) => items.some((i) => i.id === r.id)).map(fromSaffire)} />
        )}
      </div>

      <div className={styles.resultsHead}>
        <div>
          <h2 className="display text-2xl">Pick a test</h2>
          <p className="text-sm text-muted" aria-live="polite">{items.length} of {all.length} shown, highest oxygen first. Tap one to read what NASA recorded.</p>
        </div>
        {family === "bass2" && (
          <div className="view-switch" role="group" aria-label="Test display">
            <button aria-pressed={view === "tiles"} onClick={() => setView("tiles")}>Tiles</button>
            <button aria-pressed={view === "table"} onClick={() => setView("table")}>Detective table</button>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="empty-discovery"><span aria-hidden="true">◎</span><h3 className="display text-2xl">No tests in this corner.</h3><p>Include more outcomes or another material.</p><button className="story-action" onClick={reset}>Show all tests</button></div>
      ) : view === "tiles" || family !== "bass2" ? (
        <div className={styles.split}>
          <ul className={styles.tiles} aria-label="Tests">
            {items.map((i) => (
              <li key={i.id}>
                <button className={styles.tile} data-group={i.group} aria-pressed={sel?.id === i.id} onClick={() => { setPicked(i.id); if (i.note) discover("crewnote"); }}>
                  <span className={styles.code}>{i.code}</span>
                  <span className={styles.vals}>{i.o2 ?? "?"}% · {i.flow == null ? "no fan flow stated" : `${i.flow} cm/s`}</span>
                  <b aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          {sel && (
            <article className={styles.preview} aria-live="polite" data-group={sel.group}>
              <p className={styles.pFam}>{FAMILY_INFO[sel.family].name}</p>
              <h3 className="display">{sel.family === "saffire" ? `Saffire sample ${sel.code}` : sel.family === "luci" ? `LUCI ${sel.code}` : `Test ${sel.code}`}</h3>
              <p className={styles.pMat}>{sel.material}{PLAIN[sel.material] ? ` (${PLAIN[sel.material]})` : ""}{sel.size ? ` · ${sel.size}` : ""}</p>
              <dl className={styles.gauges}>
                <div><dt>Oxygen</dt><dd>{sel.o2 ?? "—"}<small>%</small></dd></div>
                <div><dt>Airflow</dt><dd>{sel.flow ?? "—"}<small>cm/s</small></dd></div>
                <div><dt>Pressure</dt><dd>{sel.kpa ?? "—"}<small>kPa</small></dd></div>
              </dl>
              <p className={styles.pOutcome}>{sel.outcome ? <OutcomeTag outcome={sel.outcome} label={sel.outcomeLabel} /> : sel.outcomeLabel}</p>
              {sel.note && <blockquote className={styles.note}>“{sel.note}”<span>{sel.family === "bass2" ? "the crew's note, word for word" : "NASA's words"}</span></blockquote>}
              {sel.cite && <p className={styles.src}>Source: <Cite sourceId={sel.cite.source_id} page={sel.cite.pdf_page} where={sel.cite.table} /></p>}
              <Link href={sel.href} className={styles.open}>Open the full record</Link>
            </article>
          )}
        </div>
      ) : (
        <AtlasDetective rows={exps} />
      )}
    </div>
  );
}
