import type { Metadata } from "next";
import findingsJson from "@/data/findings.json";
import { evidenceRecords } from "@/lib/data";
import type { Finding } from "@/lib/types";
import { MaterialsBulkView } from "@/components/insight/MaterialsBulk";

export const metadata: Metadata = { title: "Material evidence check" };

export default function MaterialsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <p className="text-signal text-sm">For mission planners</p>
      <h1 className="display text-4xl mt-2">Check a whole materials list</h1>
      <p className="mt-3 text-muted max-w-[78ch]">
        Paste the materials planned for a cabin, pick the atmosphere and gravity, and get one evidence grade per material: direct, analogous, or no evidence, with the closest NASA test and exactly how it differs. Built on the same Evidence Ladder as the Mission desk.
      </p>
      <MaterialsBulkView records={evidenceRecords} findings={findingsJson as unknown as Finding[]} />
    </div>
  );
}
