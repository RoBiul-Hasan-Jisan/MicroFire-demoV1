import type { Gravity } from "./relevance";
import type { MissionQuestion } from "./ontology";
import { FRONTIER } from "./frontier.ts";

export type MissionScenario = {
  id: string; title: string; question: string; scenario: MissionQuestion;
  category: "orbital" | "lunar" | "martian" | "exploration-atmosphere" | "ventilation" | "detection" | "material" | "scale";
  origin: "mission-preset" | "research-frontier" | "challenge-demo" | "curated-research-question";
  rationale: string; sourceContext: string[];
};

export type MissionForm = {
  oxygen: number;
  flow: number;
  pressureKpa: number;
  gravity: Gravity;
  material: string;
  flowDirection: string;
};

export const CONTEXTS: { id: string; label: string; detail: string; form: MissionForm }[] = [
  {
    id: "iss",
    label: "ISS cabin, fans running",
    detail: "Normal air, near 1 atm, a moderate ventilation flow.",
    form: { oxygen: 21, flow: 10, pressureKpa: 101.3, gravity: "microgravity", material: "any", flowDirection: "any" },
  },
  {
    id: "still-air",
    label: "ISS cabin, ventilation lost",
    detail: "Normal air with almost no airflow, the regime where NASA saw dim, long-lived flames.",
    form: { oxygen: 21, flow: 1, pressureKpa: 101.3, gravity: "microgravity", material: "any", flowDirection: "any" },
  },
  {
    id: "low-o2",
    label: "Reduced-oxygen corner",
    detail: "Oxygen lowered to about 17 % with gentle flow, where many tests quenched.",
    form: { oxygen: 17, flow: 3, pressureKpa: 101.3, gravity: "microgravity", material: "any", flowDirection: "any" },
  },
  {
    id: "exploration",
    label: "Exploration atmosphere A, in orbit",
    detail: "56.5 kPa with 34 % oxygen: a NASA-studied and previously recommended exploration-atmosphere configuration.",
    form: { oxygen: 34, flow: 10, pressureKpa: 56.5, gravity: "microgravity", material: "any", flowDirection: "any" },
  },
  {
    id: "moon-base",
    label: "Lunar habitat, atmosphere A",
    detail: "PMMA in 34 % oxygen at 56.5 kPa, at lunar gravity: the hardest question in this atlas.",
    form: { oxygen: 34, flow: 20, pressureKpa: 56.5, gravity: "lunar", material: "PMMA", flowDirection: "any" },
  },
  {
    id: "mars-fabric",
    label: "Mars habitat, atmosphere A",
    detail: "Cotton-fiberglass fabric in 34 % oxygen at 56.5 kPa, at Martian gravity.",
    form: { oxygen: 34, flow: 10, pressureKpa: 56.5, gravity: "martian", material: "SIBAL fabric", flowDirection: "any" },
  },
  {
    id: "moon-base-alt",
    label: "Lunar habitat, alternate atmosphere",
    detail: "PMMA in 28.5 % oxygen at 66.2 kPa, the alternate exploration atmosphere NASA evaluated later, at lunar gravity.",
    form: { oxygen: 28.5, flow: 20, pressureKpa: 66.2, gravity: "lunar", material: "PMMA", flowDirection: "any" },
  },
  {
    id: "lunar",
    label: "Lunar habitat, normal air",
    detail: "Same air as the ISS, but at lunar gravity, where buoyancy returns.",
    form: { oxygen: 21, flow: 10, pressureKpa: 101.3, gravity: "lunar", material: "any", flowDirection: "any" },
  },
];

const CATEGORIES: Record<string, MissionScenario["category"]> = {iss:"orbital","still-air":"ventilation","low-o2":"material",exploration:"exploration-atmosphere","moon-base":"lunar","mars-fabric":"martian","moon-base-alt":"lunar",lunar:"lunar"};
/** Finite existing questions. Challenge A/alternate reuse the mission preset; they do not inflate breadth. */
export const MISSION_SCENARIOS: MissionScenario[] = [
  ...CONTEXTS.map(c => ({id:`mission-${c.id}`,title:c.label,question:`What combustion evidence covers ${c.label.toLowerCase()}?`,
    scenario:{oxygen:c.form.oxygen,pressureKpa:c.form.pressureKpa,flow:c.form.flow,gravity:c.form.gravity,...(c.form.material === "any" ? {} : {material:c.form.material})},
    category:CATEGORIES[c.id],origin:"mission-preset" as const,rationale:c.detail,
    sourceContext:c.id.includes("alt") ? ["ea-alt","ea-6"] : ["moon-base","mars-fabric","exploration"].includes(c.id) ? ["exploration-atmosphere"] : ["bass2-summary","luci"]})),
  // The Moon-base frontier and Challenge A already ask the same PMMA question at the same conditions.
  ...FRONTIER.filter(f=>f.id!=="moon-base").map(f=>({id:`frontier-${f.id}`,title:f.title,question:f.kid,scenario:f.q,
    category:(f.q.gravity==="martian"?"martian":f.q.gravity==="lunar"?"lunar":"ventilation") as MissionScenario["category"],
    origin:"research-frontier" as const,rationale:"Existing Research Frontier question; unspecified airflow/material stays unknown, not copied from a preset.",sourceContext:["bass2-summary","luci","partial-g"]})),
];
