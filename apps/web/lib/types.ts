export type OutcomeGroup = "extinguished" | "not_ignited" | "sustained" | "unknown";

export type Citation = {
  source_id: string;
  table?: string;
  section?: string;
  pdf_page: number;
  pdf_pages?: number[];
  page_label?: string;
  quote?: string;
  note?: string;
  original?: string;
};

export type Experiment = {
  id: string;
  test_id: string;
  as_run_test?: number;
  investigation: string;
  principal_investigator?: string;
  date?: string;
  family: string;
  material: string;
  material_category: string;
  material_verbatim: string;
  geometry: string;
  thickness_mm: number | null;
  width_mm: number | null;
  length_mm: number | null;
  gravity_regime: string;
  flow_direction: string;
  flow_initial_cm_s: number | null;
  flow_final_cm_s: number | null;
  flow_varied: boolean;
  flow_verbatim: string;
  oxygen_vol_pct: number | null;
  oxygen_final_vol_pct?: number | null;
  pressure_kpa: number | null;
  pressure_kpa_range?: [number, number] | null;
  co2_vol_pct: [number | null, number | null] | null;
  co_ppm: [number | null, number | null] | null;
  observations_verbatim: string | null;
  outcome: string;
  outcome_label: string;
  outcome_group: OutcomeGroup;
  quality_flags: string[];
  provenance: {
    record: Citation;
    observed: string[];
    series: Record<string, Citation>;
    derived: Record<string, string>;
    notes: Record<string, string>;
  };
};

export type Source = {
  source_id: string;
  ntrs_id: string;
  title: string;
  authors: string[];
  organization: string;
  document_type: string | null;
  published: string | null;
  url: string;
  pdf_url: string | null;
  copyright: string | null;
  sha256: string | null;
  retrieved: string;
  used_for: string;
  abstract: string | null;
};

export type Finding = {
  id: string;
  source_id: string;
  in: "pdf" | "abstract";
  quote: string;
  topics: string[];
  kind: "observed" | "interpretation" | "context";
  experiments?: string[] | string;
  experiments_basis?: string;
  pdf_page?: number;
};

/** A Saffire run: a large-scale fire in an uncrewed Cygnus vehicle. Its own schema, never merged into BASS-II rows. */
export type SaffireRun = {
  id: string;
  family: "saffire";
  flight: string;
  sample: string;
  material: string;
  material_verbatim: string;
  geometry: string;
  thickness_mm: number | null;
  width_cm: number | null;
  length_cm: number | null;
  flow_cm_s: number | null;
  flow_direction: string | null;
  pressure_kpa: number | null;
  o2_pct: number | null;
  o2_basis: string | null;
  burn_duration_s: number | null;
  burn_length_verbatim: string | null;
  spread_rate_mm_s: number | null;
  heat_release_avg_w: number | null;
  heat_release_peak_w: number | null;
  one_g: { burn_length: string; spread: string } | null;
  outcome_group: OutcomeGroup;
  outcome_label: string;
  gravity_regime: string;
  provenance: { conditions: Citation | null; results: Citation | null; outcome: Citation | null; thickness: Citation | null };
  notes: string[];
};

/** LUCI: burns in simulated lunar gravity on a spinning rocket. Every value carries its exact NASA text and page. */
export type LuciRun = {
  id: string;
  sample: string;
  material: string;
  material_verbatim: string;
  size_verbatim: string;
  direction: string;
  o2_start_pct: number;
  o2_end_pct: number;
  pressure_kpa: number;
  pressure_basis: string;
  spread_base_mm_s: number | null;
  spread_tip_mm_s: number | null;
  gravity: "lunar";
  gravity_note: string;
  outcome_group: OutcomeGroup;
  outcome_label: string;
  provenance: Record<string, { source_id: string; pdf_page: number; quote: string } | null>;
};
