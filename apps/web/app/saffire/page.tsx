import type { Metadata } from "next";
import { SaffireMission } from "@/components/SaffireMission";
import { saffireRuns, sources } from "@/lib/data";
import { SOURCE_FAMILY } from "@/lib/ontology";

export const metadata: Metadata = { title: "Saffire: fire, after departure" };

export default function SaffirePage() {
  const src = sources.filter((s) => SOURCE_FAMILY[s.source_id] === "saffire").map((s) => ({ source_id: s.source_id, title: s.title, url: s.url, pdf_url: s.pdf_url }));
  return <SaffireMission runs={saffireRuns} sources={src} />;
}
