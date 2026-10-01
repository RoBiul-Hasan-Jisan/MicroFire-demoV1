import type { Metadata } from "next";
import { Suspense } from "react";
import { CompareView } from "@/components/CompareView";

export const metadata: Metadata = { title: "Compare" };

export default function ComparePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <h1 className="display text-3xl sm:text-4xl">Compare tests side by side</h1>
      <p className="mt-3 text-muted max-w-[70ch]">
        Each preset keeps as many conditions the same as NASA&apos;s tables allow, so the one that changes stands out.
        What was recorded, what we infer, and what is missing are kept apart.
      </p>
      <div className="mt-10">
        <Suspense fallback={<p className="text-muted">Loading comparison…</p>}>
          <CompareView />
        </Suspense>
      </div>
    </div>
  );
}
