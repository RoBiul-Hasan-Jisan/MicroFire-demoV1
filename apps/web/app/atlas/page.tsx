import type { Metadata } from "next";
import { AtlasExplorer } from "@/components/AtlasExplorer";
import { Cite } from "@/components/Cite";
import { experiments } from "@/lib/data";

export const metadata: Metadata = { title: "Atlas" };

export default function AtlasPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <h1 className="display text-3xl sm:text-4xl">Every test, one row each</h1>
      <p className="mt-3 text-muted max-w-[70ch]">
        {experiments.length} burns aboard the International Space Station, transcribed from NASA&apos;s published test
        tables. Airflow is shown exactly as NASA recorded it: numbers are cm/s, “pot” values are fan settings. Sources:{" "}
        <Cite sourceId="bass2-summary" page={104} where="Table 7.1" />, <Cite sourceId="bass2-summary" page={111} where="Tables A.1–A.2" />.
      </p>
      <div className="mt-10">
        <AtlasExplorer data={experiments} />
      </div>
    </div>
  );
}
