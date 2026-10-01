import experimentsJson from "@/data/experiments.json";
import sourcesJson from "@/data/sources.json";
import findingsJson from "@/data/findings.json";
import type { Experiment, Finding, OutcomeGroup, Source } from "./types";

export const experiments = experimentsJson as unknown as Experiment[];
export const sources = sourcesJson as unknown as Source[];
export const findings = findingsJson as unknown as Finding[];

const byId = new Map(experiments.map((e) => [e.id, e]));
const sourceById = new Map(sources.map((s) => [s.source_id, s]));

export const getExperiment = (id: string) => byId.get(id);
export const getSource = (id: string) => sourceById.get(id);

export const families = [...new Set(experiments.map((e) => e.family))];

/** Colour follows what the flames looked like: near-limit microgravity flames are dim blue. */
export type OutcomeStyle = { color: string; hollow: boolean; legend: string };

export const OUTCOME_STYLE: Record<string, OutcomeStyle> = {
  sustained_no_blowoff: { color: "var(--flame)", hollow: false, legend: "Kept burning" },
  burned_entire_sample: { color: "var(--flame)", hollow: false, legend: "Kept burning" },
  burned_outcome_not_stated: { color: "var(--flame)", hollow: true, legend: "Burned, end state not stated" },
  quenched_low_flow: { color: "var(--quench)", hollow: false, legend: "Went out at low or no flow" },
  extinguished_flow_off: { color: "var(--quench)", hollow: false, legend: "Went out at low or no flow" },
  no_sustained_flame: { color: "var(--quench)", hollow: true, legend: "Flashed, never sustained" },
  blowoff: { color: "var(--blowoff)", hollow: false, legend: "Blown out at high flow" },
  not_ignited: { color: "var(--inert)", hollow: false, legend: "Did not ignite" },
};

/** One legend row per distinct look, in reading order. */
export const LEGEND: OutcomeStyle[] = [
  OUTCOME_STYLE.sustained_no_blowoff,
  OUTCOME_STYLE.burned_outcome_not_stated,
  OUTCOME_STYLE.quenched_low_flow,
  OUTCOME_STYLE.no_sustained_flame,
  OUTCOME_STYLE.blowoff,
  OUTCOME_STYLE.not_ignited,
];

export const GROUP_LABEL: Record<OutcomeGroup, string> = {
  sustained: "Kept burning",
  extinguished: "Went out",
  not_ignited: "Did not ignite",
  unknown: "End state not stated",
};

export const FLAG_LABELS: Record<string, string> = {
  o2_reading_suspect: "NASA marks this oxygen reading as possibly inaccurate",
  reused_sample: "Reused, partly burned sample (report says these give less quantitative data)",
  one_sided_flame: "One-sided flame",
  no_still_images: "No still images were taken",
};

export function pdfLink(sourceId: string, page?: number) {
  const s = getSource(sourceId);
  if (!s) return "#";
  return page && s.pdf_url ? `${s.pdf_url}#page=${page}` : s.url;
}

export function findingsFor(e: Experiment) {
  return findings.filter((f) =>
    Array.isArray(f.experiments) ? f.experiments.includes(e.id) : f.experiments === `family:${e.family}`,
  );
}

export const fmt = (v: number | null | undefined, unit = "", digits?: number) =>
  v == null ? "not stated" : `${digits == null ? v : v.toFixed(digits)}${unit ? ` ${unit}` : ""}`;
