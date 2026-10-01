import type { Metadata } from "next";
import { Suspense } from "react";
import { MissionLab } from "@/components/MissionLab";

export const metadata: Metadata = { title: "Mission Lab" };

export default function MissionPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <h1 className="display text-3xl sm:text-4xl">Find the evidence closest to your mission</h1>
      <p className="mt-3 text-muted max-w-[70ch]">
        Describe a cabin, and the atlas ranks every NASA test by how closely it matches. It shows the evidence and how
        sure it is — it does not predict whether a fire will start or spread.
      </p>
      <div className="mt-10">
        <Suspense fallback={<p className="text-muted">Loading Mission Lab…</p>}>
          <MissionLab />
        </Suspense>
      </div>
    </div>
  );
}
