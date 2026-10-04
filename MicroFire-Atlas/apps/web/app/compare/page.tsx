import type { Metadata } from "next";
import { QuestBoard } from "@/components/quest/QuestBoard";
import { Suspense } from "react";
import { CompareView } from "@/components/CompareView";
import { RouteStage } from "@/components/world/RouteStage";

export const metadata: Metadata = { title: "Compare" };

export default function ComparePage() {
  return (
    <div className="explorer-page mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <RouteStage kind="compare" />
      <div className="mt-6"><QuestBoard page="compare" crew="kofi" /></div>
      <p className="mt-6 text-sm text-muted max-w-[78ch]">
        Each preset keeps as many conditions the same as NASA&apos;s tables allow, so the one that changes stands out.
        What was recorded, what we infer, and what is missing are kept apart.
      </p>
      <div id="compare-tool" className="scroll-mt-20 mt-8">
        <Suspense fallback={<p className="text-muted">Loading comparison…</p>}>
          <CompareView />
        </Suspense>
      </div>
    </div>
  );
}
