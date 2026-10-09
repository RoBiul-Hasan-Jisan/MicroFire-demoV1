import type { Metadata } from "next";
import { AtlasObservatory } from "@/components/AtlasObservatory";
import { Cite } from "@/components/Cite";
import { RouteStage } from "@/components/world/RouteStage";
import { experiments, luciRuns, saffireRuns } from "@/lib/data";

export const metadata: Metadata = { title: "Atlas" };

export default function AtlasPage() {
  return (
    <div className="explorer-page mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <RouteStage kind="atlas" />
      <p className="mt-6 text-sm text-muted max-w-[78ch]">
        {experiments.length + saffireRuns.length + luciRuns.length} NASA fire tests from three experiment families, transcribed from NASA&apos;s published
        test tables and kept in their own regimes. Values are shown as NASA recorded them. BASS-II sources:{" "}
        <Cite sourceId="bass2-summary" page={104} where="Table 7.1" />, <Cite sourceId="bass2-summary" page={111} where="Tables A.1–A.2" />.
      </p>
      <div id="atlas-tool" className="scroll-mt-20 mt-8">
        <AtlasObservatory data={experiments} saffire={saffireRuns} luci={luciRuns} />
      </div>
    </div>
  );
}
