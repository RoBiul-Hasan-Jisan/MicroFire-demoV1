import type { Metadata } from "next";
import modelJson from "@/data/model.json";
import type { Model } from "@/lib/model";
import { PredictClient } from "@/components/predict/PredictClient";

export const metadata: Metadata = { title: "Outcome Model" };

export default function PredictPage() {
  const m = modelJson as unknown as Model & { report: Report };
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <p className="text-signal text-sm">Outcome model</p>
      <h1 className="display text-4xl mt-2">In ISS microgravity, would the flame keep burning?</h1>
      <p className="mt-3 text-muted max-w-[78ch]">
        A small model trained on {m.report.n_rows} labelled NASA microgravity tests. Pick oxygen, airflow speed and direction; the model
        estimates the chance the flame is sustained, with an interval, and shows the real tests closest to your choice. It describes how flames behaved in these ISS tests; it is not a fire-risk or safety rating and does not apply to Moon or Mars gravity (the Gravity bridge page tests one clearly labelled hypothesis for that). Below the calculator are the cross-validated scores, the material ranking and the limits of the data.
      </p>
      <PredictClient model={m} report={m.report} />
    </div>
  );
}

export type Report = {
  n_rows: number; n_sustained: number; n_not_sustained: number; n_series: number; cv: string;
  models: Record<string, { accuracy: number; balanced_accuracy: number; brier: number; log_loss: number }>;
  ranking: { material: string; n_tests: number; sustained: number; sustained_rate: number; rate_ci95: [number, number] | [null, null]; lowest_o2_sustained: number | null; highest_o2_not_sustained: number | null }[];
  caveats: string[];
  coefficients_standardised: Record<string, number>;
  spread_rate: { n_measured: number; note: string; runs: { id: string; material: string; o2_pct: number | null; flow_cm_s: number | null; direction: string | null; spread_rate_mm_s: number }[] };
};
