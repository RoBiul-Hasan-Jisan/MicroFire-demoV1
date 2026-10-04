import mediaJson from "@/data/media.json";

export type MediaItem = {
  slug: string;
  nasa_id: string;
  kind: "video" | "image";
  title: string;
  description: string;
  center: string;
  date_created: string;
  page_url: string;
  file_url: string;
  sha256: string;
  width: number;
  height: number;
  fps: number | null;
  duration_s: number | null;
  licence: string;
};

export type FrameMetrics = {
  t: number;
  area_px: number;
  luminous_px: number;
  blue_px: number;
  area_frac: number;
  regions: number;
  bbox?: [number, number, number, number];
  centroid?: [number, number];
  width_px?: number;
  height_px?: number;
  mean_brightness?: number;
  saturated_frac?: number;
  flags: string[];
  outlines: [number, number][][];
};

export type Analysis = {
  slug: string;
  version: string;
  opencv: string;
  generated: string;
  input_sha256: string;
  frame_size: [number, number];
  sample_fps: number | null;
  roi: [number, number, number, number];
  roi_note: string;
  blue_note: string | null;
  thresholds: Record<string, unknown>;
  units: string;
  frames: FrameMetrics[];
};

export const media = mediaJson as unknown as MediaItem[];
export const getMedia = (slug: string) => media.find((m) => m.slug === slug);

/** Plain-language context we can state for each item, beyond NASA's own description. */
export const MEDIA_CONTEXT: Record<string, { label: string; experiment: string; knownConditions: string; unknown: string }> = {
  "saffire-v-ribs": {
    label: "Saffire-V: PMMA with thin ribs",
    experiment: "Saffire-V, inside an uncrewed Cygnus cargo spacecraft",
    knownConditions: "Material: PMMA (Plexiglas) with manufactured ribs, per NASA's description.",
    unknown: "Oxygen, pressure and airflow for this footage are not given in the source.",
  },
  "saffire-vi-pmma": {
    label: "Saffire-VI: one-sided PMMA burn",
    experiment: "Saffire-VI, inside Northrop Grumman's Cygnus at the end of NG-19",
    knownConditions: "Material: PMMA, burning on one side (from NASA's file name).",
    unknown: "Oxygen, pressure and airflow are not given. The file name says “20x”, which NASA's text does not explain, so times are shown as video time.",
  },
  "bass-cassidy-2013": {
    label: "BASS flame, ISS 2013",
    experiment: "BASS, Microgravity Science Glovebox, ISS",
    knownConditions: "A close-up from a 2013 BASS run photographed by the crew.",
    unknown: "The photo is not tied to a specific test row, so its sample and conditions are unknown.",
  },
  "bass2-reduced-o2-gmt213": {
    label: "BASS-II flame, reduced oxygen, ISS 2014",
    experiment: "BASS-II, Microgravity Science Glovebox, ISS",
    knownConditions: "NASA: taken during a BASS-II flame test session with reduced O₂ partial pressure, GMT 213 (1 August 2014).",
    unknown: "Several tests ran that day, so the photo is not linked to one table row.",
  },
};

export const FLAG_TEXT: Record<string, string> = {
  weak_or_no_flame: "Little or no flame in view: shape measurements are not meaningful here.",
  overexposed: "The flame core saturates the camera: brightness is a lower bound. Area and extent are still valid.",
  many_regions: "Several separate flamelets: the box and centroid describe the group, not one flame.",
};
