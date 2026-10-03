/**
 * Microgravity Flame Lab: pure logic.
 *
 * Nothing here predicts fire. Every outcome shown in the lab is a count of what NASA recorded in the
 * nearest tests, found with the existing Mission Relevance ranking (lib/relevance.ts, unchanged).
 * The flame *drawing* is an illustration: its shape follows gravity, its size follows oxygen and its lean
 * follows airflow. Gravity worlds other than microgravity have no tests in the atlas, and say so.
 */
import { outsideEvidence, rank, type Gravity, type Ranked, type Scenario } from "./relevance.ts";
import type { Experiment, OutcomeGroup } from "./types";

/* ---------- controls ---------- */

export type WorldId = "earth" | "moon" | "mars" | "micro";
export type World = {
  id: WorldId;
  label: string;
  g: number;
  gLabel: string;
  gravity?: Gravity; // the Scenario gravity term; Earth has none (no atlas test is at 1 g)
  shape: string;
  background: string;
};

export const WORLDS: World[] = [
  {
    id: "earth",
    label: "Earth",
    g: 1,
    gLabel: "1 g",
    shape: "Tall, yellow teardrop",
    background:
      "On Earth, hot gas is lighter than the air around it and rises, pulling fresh air in from below. That stretches the flame into a tall teardrop.",
  },
  {
    id: "moon",
    label: "Moon",
    g: 0.17,
    gLabel: "0.17 g",
    gravity: "lunar",
    shape: "Shorter, wider teardrop",
    background: "With about a sixth of Earth's gravity, some buoyancy returns, so the flame sits between the Earth and orbit shapes.",
  },
  {
    id: "mars",
    label: "Mars",
    g: 0.38,
    gLabel: "0.38 g",
    gravity: "martian",
    shape: "Medium teardrop",
    background: "Mars gravity is about 38 % of Earth's. Buoyancy is weaker than on Earth but stronger than on the Moon.",
  },
  {
    id: "micro",
    label: "Orbit",
    g: 0,
    gLabel: "≈ 0 g",
    gravity: "microgravity",
    shape: "Round, dim blue sphere",
    background:
      "In orbit nothing makes hot gas rise. The flame stays round and dim, and the airflow decides how much oxygen reaches it.",
  },
];

export const worldOf = (id: WorldId) => WORLDS.find((w) => w.id === id)!;

export type Fuel = "PMMA" | "SIBAL fabric" | "Nomex";
export const FUELS: { id: Fuel; label: string; blurb: string }[] = [
  { id: "PMMA", label: "PMMA", blurb: "Clear plastic film" },
  { id: "SIBAL fabric", label: "SIBAL fabric", blurb: "Cotton–fiberglass cloth" },
  { id: "Nomex", label: "Nomex", blurb: "Flame-resistant fabric" },
];

export type LabState = { world: WorldId; oxygen: number; flow: number; pressureKpa: number; fuel: Fuel };

export const DEFAULT_STATE: LabState = { world: "micro", oxygen: 21, flow: 10, pressureKpa: 101.3, fuel: "SIBAL fabric" };

export const RANGES = { oxygen: [14, 36], flow: [0.5, 60] } as const;

export function toScenario(s: LabState): Scenario {
  return {
    oxygen: s.oxygen,
    flow: s.flow,
    pressureKpa: s.pressureKpa,
    gravity: worldOf(s.world).gravity,
    material: s.fuel,
  };
}

/** The span of oxygen and airflow that NASA actually tested, for the "tested range" markers on the sliders. */
export function testedRanges(exps: Experiment[]) {
  const span = (vals: (number | null | undefined)[]): [number, number] => {
    const v = vals.filter((x): x is number => x != null);
    return [Math.min(...v), Math.max(...v)];
  };
  return {
    oxygen: span(exps.map((e) => e.oxygen_vol_pct)),
    flow: span(exps.flatMap((e) => [e.flow_initial_cm_s, e.flow_final_cm_s])),
  };
}

/* ---------- evidence verdict ---------- */

export const STRONG = 0.6; // same threshold Mission Lab uses
/** The lab reads the closest tests only. Counting every test above the threshold would let the dataset's mix dominate. */
export const NEIGHBOURS = 8;
/** An outcome needs at least this many tests with a stated end state before the lab names a lead. */
const MIN_STATED = 3;
const LEAD_SHARE = 0.6;

export type VerdictKind = "sustained" | "extinguished" | "not_ignited" | "mixed" | "unstated" | "limited";
export type Tally = Record<OutcomeGroup, number>;
export type Verdict = {
  kind: VerdictKind;
  /** How many of the closest tests (relevance 60+) the verdict is read from, at most NEIGHBOURS. */
  used: number;
  /** How many of those have an end state NASA actually stated. */
  stated: number;
  tally: Tally;
  nearest?: Ranked;
  /** Why the verdict is "limited", when it is. */
  reason?: "gravity" | "outside" | "no-close-test";
};

const emptyTally = (): Tally => ({ sustained: 0, extinguished: 0, not_ignited: 0, unknown: 0 });

export function verdictFor(ranked: Ranked[], world: WorldId, outside = false): Verdict {
  const near = ranked.slice(0, NEIGHBOURS).filter((r) => r.score >= STRONG);
  const tally = near.reduce<Tally>((acc, r) => {
    acc[r.experiment.outcome_group] += 1;
    return acc;
  }, emptyTally());
  const stated = tally.sustained + tally.extinguished + tally.not_ignited;
  const base = { used: near.length, stated, tally, nearest: ranked[0] };

  // Only microgravity tests exist, so other worlds can show reference tests but never an outcome.
  if (world !== "micro") return { ...base, kind: "limited", reason: "gravity" };
  if (outside) return { ...base, kind: "limited", reason: "outside" };
  if (near.length === 0) return { ...base, kind: "limited", reason: "no-close-test" };
  if (stated < MIN_STATED) return { ...base, kind: "unstated" };

  const known: OutcomeGroup[] = ["sustained", "extinguished", "not_ignited"];
  const lead = known.reduce((a, k) => (tally[k] > tally[a] ? k : a), known[0]);
  return { ...base, kind: tally[lead] / stated >= LEAD_SHARE ? (lead as VerdictKind) : "mixed" };
}

export const VERDICT_LABEL: Record<VerdictKind, string> = {
  sustained: "NASA: mostly kept burning",
  extinguished: "NASA: mostly went out",
  not_ignited: "NASA: mostly did not ignite",
  mixed: "NASA: results split",
  unstated: "NASA: end states mostly unstated",
  limited: "No close NASA evidence",
};

export const OUTCOME_WORDS: Record<OutcomeGroup, string> = {
  sustained: "kept burning",
  extinguished: "went out",
  not_ignited: "did not ignite",
  unknown: "end state not stated",
};

export function tallyText(t: Tally) {
  const parts = (Object.keys(OUTCOME_WORDS) as OutcomeGroup[]).filter((k) => t[k] > 0).map((k) => `${t[k]} ${OUTCOME_WORDS[k]}`);
  return parts.length ? parts.join(", ") : "none";
}

/** Which tests to show: the strongest matches first, whatever their outcome. */
export const nearest = (ranked: Ranked[], n: number) => ranked.slice(0, n);

/* ---------- how the flame is drawn (illustration, not simulation) ---------- */

export function lookOf(s: LabState) {
  const w = worldOf(s.world);
  const o2 = Math.min(1, Math.max(0, (s.oxygen - RANGES.oxygen[0]) / (RANGES.oxygen[1] - RANGES.oxygen[0])));
  const size = 0.62 + o2 * 0.6; // 14 % → 0.62, 36 % → 1.22
  const lean = Math.min(1, s.flow / 40) * (1 - 0.5 * w.g);
  const bucket = s.flow <= 2 ? 1 : s.flow <= 8 ? 2 : s.flow <= 20 ? 3 : 4;
  return { g: w.g, size, lean, bucket };
}

/* ---------- insight: Observation → Explanation → Safety implication ---------- */

export type Insight = {
  observation: string;
  nearestLine: string | null;
  explanationIds: string[];
  background: string;
  implication: string;
  caution: string;
};

const nearestLine = (r?: Ranked) =>
  r
    ? `Closest test: ${r.experiment.test_id} (${r.experiment.material}, ${r.experiment.oxygen_vol_pct ?? "?"} % O₂, ${
        r.experiment.flow_initial_cm_s ?? "?"
      } cm/s), relevance ${Math.round(r.score * 100)}, NASA recorded “${r.experiment.outcome_label.toLowerCase()}”.`
    : null;

/** Finding ids (verified NASA quotes in data/findings.json) that bear on these conditions. Never generated. */
export function explanationIds(s: LabState): string[] {
  const ids: string[] = [];
  if (s.flow <= 1.5) ids.push("dim-blue-low-flow");
  else if (s.flow <= 5) ids.push("low-flow-sensitivity");
  if (s.oxygen < 19) ids.push(s.fuel === "PMMA" ? "pmma-rod-limits" : "sibal-quench-speeds");
  if (s.world === "moon" || s.world === "mars") ids.push("low-g-burns-lower-o2");
  if (s.pressureKpa < 95 || s.oxygen > 21.5) ids.push("exploration-atmosphere");
  if (s.flow >= 20) ids.push("blowoff-kinetics");
  if (ids.length === 0) ids.push("quench-mechanism");
  return [...new Set(ids)].slice(0, 2);
}

export function insightFor(s: LabState, v: Verdict): Insight {
  const w = worldOf(s.world);
  let observation: string;
  if (v.reason === "gravity")
    observation = `No test in the atlas ran at ${w.label} gravity. The tests below are microgravity runs at similar air and flow, shown for reference only.`;
  else if (v.reason === "outside")
    observation = "These settings are outside everything NASA tested, so the closest tests are shown for reference only and no outcome is counted.";
  else if (v.kind === "limited")
    observation = "No NASA test scores 60 or higher for these settings, so there is no close evidence to count.";
  else if (v.kind === "unstated")
    observation = `Of the ${v.used} closest NASA tests, only ${v.stated} state how the flame ended: ${tallyText(v.tally)}.`;
  else observation = `Among the ${v.used} closest NASA tests (relevance 60 or higher), NASA recorded: ${tallyText(v.tally)}.`;

  const implications: Record<VerdictKind, string> = {
    sustained: "Of the close tests with a stated outcome, most kept burning, so conditions like these should be treated as able to sustain a fire.",
    extinguished: "Of the close tests with a stated outcome, most went out, usually when airflow was cut or oxygen fell. A pattern in past tests, not a guarantee.",
    not_ignited: "Of the close tests with a stated outcome, most did not ignite. A failed ignition in a lab run does not prove a cabin fire is impossible.",
    mixed: "The close tests with a stated outcome split between results, so small changes in conditions may matter. Try nearby values.",
    unstated: "NASA's tables mostly do not state how the closest tests ended, so there is no reliable outcome count here. That gap is a finding in itself: open the tests to read what NASA noted.",
    limited: "There is not enough close evidence to say how a flame would behave here. Treat this as an open question.",
  };
  let implication = implications[v.kind];
  if (s.flow <= 1.5 && s.world === "micro") implication += " NASA also notes that a tiny flame in near-still air might go undetected for a long time.";

  return {
    observation,
    nearestLine: nearestLine(v.nearest),
    explanationIds: explanationIds(s),
    background: w.background,
    implication,
    caution: "A count of past NASA tests near your settings, not a forecast. Not operational fire-response guidance.",
  };
}

export function outsideNotes(exps: Experiment[], s: LabState) {
  const notes = outsideEvidence(exps, toScenario(s));
  if (s.world === "earth") notes.push("No test in this atlas was run at Earth gravity; every result is microgravity evidence.");
  return notes;
}

/** The whole pipeline in one call: rank, check the tested range, read the verdict. */
export function readEvidence(exps: Experiment[], s: LabState) {
  const ranked = rank(exps, toScenario(s));
  const outside = outsideNotes(exps, s);
  const rangeOutside = outsideEvidence(exps, toScenario(s)).length > 0;
  return { ranked, outside, verdict: verdictFor(ranked, s.world, rangeOutside) };
}

/* ---------- prediction ---------- */

export type Guess = "sustained" | "extinguished" | "not_ignited";
export const GUESSES: { id: Guess; label: string }[] = [
  { id: "sustained", label: "It keeps burning" },
  { id: "extinguished", label: "It goes out" },
  { id: "not_ignited", label: "It never ignites" },
];

export type Judgement = { result: "match" | "miss" | "split" | "nodata"; message: string };

export function judge(guess: Guess, v: Verdict): Judgement {
  if (v.kind === "limited" || v.kind === "unstated")
    return { result: "nodata", message: "NASA has no close test with a stated outcome here, so your guess cannot be checked. That is itself a finding: this corner is poorly covered." };
  if (v.kind === "mixed") return { result: "split", message: `The close tests split (${tallyText(v.tally)}), so any of your answers has some support.` };
  if (v.kind === guess) return { result: "match", message: `Matches the evidence: ${tallyText(v.tally)}.` };
  return { result: "miss", message: `Not what most close tests did: ${tallyText(v.tally)}.` };
}

/* ---------- safety scenarios ---------- */

export type SafetyAction = { id: string; label: string; detail: string; patch: Partial<LabState> };
export type SafetyScenario = { id: string; title: string; alert: string; goal: string; start: Partial<LabState>; actions: SafetyAction[] };

export const SAFETY: SafetyScenario[] = [
  {
    id: "fans",
    title: "Ventilation failure",
    alert: "A small flame on fabric. The cabin fans are running at a normal speed.",
    goal: "Try each airflow and compare what NASA's closest tests recorded. Where is the evidence thin?",
    start: { world: "micro", oxygen: 21, flow: 10, pressureKpa: 101.3, fuel: "SIBAL fabric" },
    actions: [
      { id: "keep", label: "Leave the fans running", detail: "About 10 cm/s", patch: { flow: 10 } },
      { id: "slow", label: "Fans slow down", detail: "About 3 cm/s", patch: { flow: 3 } },
      { id: "stall", label: "Fans stall", detail: "About 1 cm/s, below the slowest flow in the tests", patch: { flow: 1 } },
      { id: "high", label: "Fans on high", detail: "About 30 cm/s", patch: { flow: 30 } },
    ],
  },
  {
    id: "oxygen",
    title: "Oxygen drops",
    alert: "A flame on plastic film at a gentle airflow. The crew can change the cabin oxygen.",
    goal: "Try each oxygen level. Where does the evidence of flames going out get strongest?",
    start: { world: "micro", oxygen: 21, flow: 3, pressureKpa: 101.3, fuel: "PMMA" },
    actions: [
      { id: "hold", label: "Hold at 21 %", detail: "Normal cabin air", patch: { oxygen: 21 } },
      { id: "dilute", label: "Dilute to 17 %", detail: "Inside the tested range", patch: { oxygen: 17 } },
      { id: "low", label: "Dilute to 15 %", detail: "Near the low end of the tests", patch: { oxygen: 15 } },
      { id: "enrich", label: "Enrich to 30 %", detail: "Outside anything tested", patch: { oxygen: 30 } },
    ],
  },
  {
    id: "exploration",
    title: "Exploration cabin",
    alert: "A flame on fabric in NASA's proposed Moon and Mars cabin air: 56.5 kPa, 34 % oxygen.",
    goal: "Does returning to ISS-style air change what NASA's evidence says?",
    start: { world: "micro", oxygen: 34, flow: 10, pressureKpa: 56.5, fuel: "SIBAL fabric" },
    actions: [
      { id: "stay", label: "Keep the exploration air", detail: "56.5 kPa, 34 % O₂", patch: { oxygen: 34, pressureKpa: 56.5 } },
      { id: "iss", label: "Return to ISS-style air", detail: "101.3 kPa, 21 % O₂", patch: { oxygen: 21, pressureKpa: 101.3 } },
    ],
  },
];

export function applyAction(sc: SafetyScenario, a: SafetyAction): LabState {
  return { ...DEFAULT_STATE, ...sc.start, ...a.patch };
}

export function evaluateAction(exps: Experiment[], sc: SafetyScenario, a: SafetyAction) {
  const before = readEvidence(exps, { ...DEFAULT_STATE, ...sc.start }).verdict;
  const state = applyAction(sc, a);
  const { verdict: after, outside } = readEvidence(exps, state);
  return { before, after, state, outside, wentOut: after.kind === "extinguished" };
}

/* ---------- mission progress & discoveries ---------- */

export type ViewId = "flame" | "heat" | "oxygen" | "airflow" | "safety";
export const VIEWS: { id: ViewId; label: string; hint: string }[] = [
  { id: "flame", label: "Flame", hint: "The flame itself" },
  { id: "heat", label: "Heat", hint: "Relative heat around the flame (illustrative)" },
  { id: "oxygen", label: "Oxygen", hint: "Oxygen around the flame (illustrative)" },
  { id: "airflow", label: "Airflow", hint: "How the fan's air moves past the flame" },
  { id: "safety", label: "Safety", hint: "What the nearest NASA tests recorded" },
];

export type StepId = "brief" | "explore" | "experiment" | "compare" | "analyze" | "safety" | "discover";
export const STEPS: { id: StepId; label: string; anchor: string }[] = [
  { id: "brief", label: "Brief", anchor: "lab-top" },
  { id: "explore", label: "Explore", anchor: "lab-chamber" },
  { id: "experiment", label: "Experiment", anchor: "lab-chamber" },
  { id: "compare", label: "Compare", anchor: "lab-compare" },
  { id: "analyze", label: "Analyze", anchor: "lab-evidence" },
  { id: "safety", label: "Safety", anchor: "lab-safety" },
  { id: "discover", label: "Discover", anchor: "lab-discover" },
];

export type LabSave = {
  brief: boolean;
  touched: string[]; // controls the user has changed
  ignitions: number;
  worlds: WorldId[];
  views: ViewId[];
  opened: string[]; // experiment ids whose detail was opened
  predictions: number;
  matches: number;
  safetyDone: string[];
  wentOut: boolean;
  pushedLimits: boolean;
};

export const FRESH_SAVE: LabSave = {
  brief: false,
  touched: [],
  ignitions: 0,
  worlds: ["micro"],
  views: ["flame"],
  opened: [],
  predictions: 0,
  matches: 0,
  safetyDone: [],
  wentOut: false,
  pushedLimits: false,
};

export function progressOf(s: LabSave): Record<StepId, boolean> {
  const p = {
    brief: s.brief,
    explore: s.touched.length >= 3,
    experiment: s.ignitions >= 1,
    compare: s.worlds.length >= 3,
    analyze: s.views.length >= 3 || s.opened.length >= 1,
    safety: s.safetyDone.length >= 1,
  };
  return { ...p, discover: Object.values(p).every(Boolean) };
}

export type BadgeId = "ignition" | "worlds" | "lenses" | "quench" | "reader" | "sharp" | "limits" | "complete";
export const BADGES: { id: BadgeId; name: string; icon: string; how: string }[] = [
  { id: "ignition", name: "First Ignition", icon: "🔥", how: "Press Ignite Experiment." },
  { id: "worlds", name: "World Hopper", icon: "🪐", how: "Try all four gravity settings." },
  { id: "lenses", name: "Lens Master", icon: "🔭", how: "Switch through all five views." },
  { id: "quench", name: "Quench Finder", icon: "❄️", how: "See a flame go out, backed by NASA's tests." },
  { id: "reader", name: "Evidence Reader", icon: "📄", how: "Open a NASA test's details." },
  { id: "sharp", name: "Sharp Eye", icon: "🎯", how: "Make a prediction that matches the evidence." },
  { id: "limits", name: "Boundary Pusher", icon: "🚀", how: "Set conditions outside anything NASA tested." },
  { id: "complete", name: "Mission Complete", icon: "🏅", how: "Finish all seven mission steps." },
];

export function badgesOf(s: LabSave): BadgeId[] {
  const p = progressOf(s);
  const out: BadgeId[] = [];
  if (s.ignitions >= 1) out.push("ignition");
  if (s.worlds.length >= 4) out.push("worlds");
  if (s.views.length >= 5) out.push("lenses");
  if (s.wentOut) out.push("quench");
  if (s.opened.length >= 1) out.push("reader");
  if (s.matches >= 1) out.push("sharp");
  if (s.pushedLimits) out.push("limits");
  if (p.discover) out.push("complete");
  return out;
}

export const add = <T,>(list: T[], v: T) => (list.includes(v) ? list : [...list, v]);
