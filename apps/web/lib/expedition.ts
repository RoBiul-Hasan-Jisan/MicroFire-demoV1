/**
 * The Evidence Expedition: pure logic, no React. Every result here comes from experiments.json and the
 * shipped CV analysis; nothing is predicted. Tested in expedition.test.ts.
 */
import type { Experiment } from "@/lib/types";

export const JOURNEY_FILMS = ["saffire-v-ribs", "saffire-vi-pmma"];
export const JOURNEY_TASKS = ["watch", "trace", "compare", "moon", "gap", "ask"];
export const LOG_MAX = 30;
/** Explorer rank by clues found (0-6). A title for effort, not a score of knowledge. */
export const RANKS = ["Space cadet", "Flame observer", "Flame observer", "Evidence detective", "Evidence detective", "Moon investigator", "MicroFire scientist"];
/** Browser saves are untrusted and may belong to an older version. */
export function restoreJourney(raw: string | null) {
  const fresh = { step: 0, film: JOURNEY_FILMS[0], done: [] as string[], log: [] as string[], nick: "" };
  const str = (t: unknown, max: number): t is string => typeof t === "string" && t.length <= max;
  try {
    const x = JSON.parse(raw || "null");
    if (!x || typeof x !== "object" || Array.isArray(x)) return fresh;
    return {
      step: Number.isInteger(x.step) && x.step >= 0 && x.step < 9 ? x.step : 0,
      film: JOURNEY_FILMS.includes(x.film) ? x.film : fresh.film,
      done: Array.isArray(x.done) ? [...new Set<string>(x.done.filter((t: unknown) => typeof t === "string" && JOURNEY_TASKS.includes(t)))] : [],
      log: Array.isArray(x.log) ? x.log.filter((t: unknown) => str(t, 160)).slice(-LOG_MAX) : [],
      nick: str(x.nick, 30) ? x.nick : "",
    };
  } catch { return fresh; }
}

/* ---------- Change one thing: hop between real tests ---------- */

/** BASS-II thin PMMA films: same material, thickness, width, geometry and flow direction, so one condition can change at a time. */
export const isFilm = (e: Experiment) =>
  e.material === "PMMA" && e.thickness_mm === 0.1 && e.width_mm === 20 && e.flow_direction === "opposed";

/** Outcomes that can be compared: excluded are "crew switched the flow off" and "end state not stated". */
const COMPARABLE = (e: Experiment) => e.outcome !== "extinguished_flow_off" && e.outcome !== "burned_outcome_not_stated";

export type Change = "more-flow" | "less-flow" | "more-oxygen" | "less-oxygen" | "moon";
export const CHANGES: { id: Change; label: string; kid: string }[] = [
  { id: "more-flow", label: "More airflow", kid: "Turn the fan up" },
  { id: "less-flow", label: "Less airflow", kid: "Turn the fan down" },
  { id: "more-oxygen", label: "More oxygen", kid: "Add oxygen" },
  { id: "less-oxygen", label: "Less oxygen", kid: "Take oxygen away" },
  { id: "moon", label: "Moon gravity", kid: "Go to the Moon" },
];

/** Same-condition tolerances: oxygen is recorded to 0.1 %, so 0.5 points is "the same"; flow uses the first logged value. */
export const SAME = { oxygen: 0.5, flow: 0.5 };

export type Hop =
  | { kind: "matched"; to: Experiment; differs: [] }
  | { kind: "closest"; to: Experiment; differs: string[] }
  | { kind: "gap"; reason: string };

const flow = (e: Experiment) => e.flow_initial_cm_s ?? NaN;
const o2 = (e: Experiment) => e.oxygen_vol_pct ?? NaN;

export function hop(from: Experiment, change: Change, all: Experiment[]): Hop {
  if (change === "moon")
    return { kind: "gap", reason: "Every test in this atlas ran in orbit. No row here was burned in Moon gravity." };
  const pool = all.filter((e) => e.id !== from.id && isFilm(e) && COMPARABLE(e));
  const changeFlow = change === "more-flow" || change === "less-flow";
  const up = change === "more-flow" || change === "more-oxygen";
  const moved = (e: Experiment) => {
    const d = changeFlow ? flow(e) - flow(from) : o2(e) - o2(from);
    const min = changeFlow ? SAME.flow : SAME.oxygen;
    return up ? d > min : d < -min;
  };
  const cands = pool.filter(moved);
  if (!cands.length)
    return { kind: "gap", reason: `No thin-film test in this atlas has ${change.includes("flow") ? "airflow" : "oxygen"} ${up ? "above" : "below"} this one.` };
  // how far the *other* condition is from the starting test, in its own tolerance units
  const other = (e: Experiment) => (changeFlow ? Math.abs(o2(e) - o2(from)) / SAME.oxygen : Math.abs(flow(e) - flow(from)) / SAME.flow);
  const step = (e: Experiment) => Math.abs(changeFlow ? flow(e) - flow(from) : o2(e) - o2(from));
  const best = [...cands].sort((a, b) => other(a) - other(b) || step(a) - step(b) || a.id.localeCompare(b.id))[0];
  if (other(best) <= 1) return { kind: "matched", to: best, differs: [] };
  const differs = changeFlow
    ? [`oxygen is ${o2(best)} % instead of ${o2(from)} %`]
    : [`airflow started at ${flow(best)} cm/s instead of ${flow(from)} cm/s`];
  return { kind: "closest", to: best, differs };
}

/* ---------- Moon habitat: child labels for evidence proximity ---------- */

export type MatchLabel = "Great match" | "Pretty close" | "Some clues" | "Science gap";
/** Thresholds on the shipped relevance score and coverage (documented on /methodology). */
export const MATCH_RULES = { great: { score: 0.75, coverage: 0.75 }, close: 0.5, clues: 0.25 };

export function matchLabel(score: number, coverage: number, outside: boolean): MatchLabel {
  if (outside) return "Science gap";
  if (score >= MATCH_RULES.great.score && coverage >= MATCH_RULES.great.coverage) return "Great match";
  if (score >= MATCH_RULES.close) return "Pretty close";
  if (score >= MATCH_RULES.clues) return "Some clues";
  return "Science gap";
}

/* ---------- Trace the flame: one real outline, two honest distractors ---------- */

export type Pt = [number, number];
export type Outline = Pt[];

export function centroid(o: Outline): Pt {
  const n = o.length || 1;
  return [o.reduce((a, p) => a + p[0], 0) / n, o.reduce((a, p) => a + p[1], 0) / n];
}
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Deterministic made-up outlines: one scaled about the centroid, one shifted sideways. Labelled as made-up. */
export function distractors(o: Outline): { scaled: Outline; shifted: Outline } {
  const [cx, cy] = centroid(o);
  const xs = o.map((p) => p[0]);
  const w = Math.max(...xs) - Math.min(...xs);
  const dx = (cx < 0.5 ? 1 : -1) * Math.max(0.08, w * 0.25);
  return {
    scaled: o.map(([x, y]) => [clamp01(cx + (x - cx) * 1.35), clamp01(cy + (y - cy) * 1.35)]),
    shifted: o.map(([x, y]) => [clamp01(x + dx), y]),
  };
}

type Frame = { t: number; flags: string[]; regions: number; area_px: number; outlines: Outline[] };
/** The clearest frame for the game: no quality flags if possible, one region, the largest flame. */
export function traceFrame(frames: Frame[]): Frame | undefined {
  const ok = frames.filter((f) => f.outlines.length && f.outlines[0].length >= 6);
  const score = (f: Frame) => (f.flags.length ? 0 : 2) + (f.regions === 1 ? 1 : 0);
  return [...ok].sort((a, b) => score(b) - score(a) || b.area_px - a.area_px || a.t - b.t)[0];
}
