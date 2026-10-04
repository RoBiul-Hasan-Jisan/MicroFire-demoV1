import type { Metadata } from "next";
import { Suspense } from "react";
import { MissionLab } from "@/components/MissionLab";
import { RouteStage } from "@/components/world/RouteStage";

export const metadata: Metadata = { title: "Mission Lab" };

export default function MissionPage() {
  return (
    <div className="explorer-page mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <RouteStage kind="mission" />
      <p className="mt-6 text-sm text-muted max-w-[78ch]">
        Describe a cabin, and the atlas ranks every NASA test by how closely it matches. It shows the evidence and how
        well it fits — it matches tests, it does not give a probability. For a statistical estimate of how the ISS test flames behaved, see the Outcome Model; for what to test next, see Next tests.
      </p>
      <div id="mission-tool" className="scroll-mt-20 mt-8">
        <Suspense fallback={<p className="text-muted">Loading Mission Lab…</p>}>
          <MissionLab />
        </Suspense>
      </div>
    </div>
  );
}
