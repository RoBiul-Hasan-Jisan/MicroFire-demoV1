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
  kind: "observed" | "interpretation";
  experiments?: string[] | string;
  experiments_basis?: string;
  pdf_page?: number;
};
