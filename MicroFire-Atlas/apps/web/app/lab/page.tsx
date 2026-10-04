import type { Metadata } from "next";
import { Suspense } from "react";
import { FlameLab } from "@/components/lab/FlameLab";

export const metadata: Metadata = {
  title: "Microgravity Flame Lab",
  description: "Change gravity, oxygen, airflow and fuel, light a flame, and see what NASA's space-station fire tests recorded.",
};

export default function LabPage() {
  return (
    <Suspense fallback={<p className="mx-auto max-w-7xl px-4 py-12 text-muted">Loading the Flame Lab…</p>}>
      <FlameLab />
    </Suspense>
  );
}
