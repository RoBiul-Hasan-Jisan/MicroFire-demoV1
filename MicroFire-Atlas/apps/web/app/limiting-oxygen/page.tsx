import type { Metadata } from "next";
import locJson from "@/data/loc_curve.json";
import pressureJson from "@/data/pressure_report.json";
import { LocView, type LocData, type PressureData } from "@/components/insight/LocCurve";

export const metadata: Metadata = { title: "Limiting oxygen curve" };

export default function LimitingOxygenPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12">
      <p className="text-signal text-sm">The same model, read the other way round</p>
      <h1 className="display text-4xl mt-2">How much oxygen does a flame need?</h1>
      <p className="mt-3 text-muted max-w-[78ch]">
        Instead of asking whether a flame burns at given conditions, this page asks the question fire-safety engineers ask: at each airflow, how much oxygen is needed? It is the model&apos;s own 50 % line with its uncertainty band, drawn over the real test points so you can see where the line is backed by tests and where it is not.
      </p>
      <LocView loc={locJson as unknown as LocData} pressure={pressureJson as unknown as PressureData} />
    </div>
  );
}
