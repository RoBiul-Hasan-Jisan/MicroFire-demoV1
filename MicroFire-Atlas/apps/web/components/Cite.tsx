import { KIND_LABEL } from "@/lib/ontology";
import { getSource, pdfLink } from "@/lib/data";
import type { Finding } from "@/lib/types";

const SHORT: Record<string, string> = {
  "bass2-summary": "BASS-II Summary Report",
  "bass2-results": "BASS-II results",
  "pmma-rods-concurrent": "PMMA rods in concurrent flow",
  "sibal-concurrent": "SIBAL fabric in concurrent flow",
  "bass-thickness": "BASS thickness and preheating",
  confinement: "Effects of confinement",
  "partial-g": "Microgravity vs Martian gravity",
  luci: "Lunar Combustion Investigation",
  "exploration-atmosphere": "Exploration atmosphere pilot study",
  "ea-alt": "Exploration Atmosphere Tests 3 and 4",
  "ea-6": "Exploration Atmosphere Test 6",
  "fm2-plan": "FM² mission plan",
  "fm2-atmospheres": "FM² atmospheres and samples",
  "saffire-1-3": "Saffire I-III results",
  "saffire-4-5": "Saffire IV and V results",
  "saffire-6": "Saffire VI results",
  flex: "FLEX droplet results",
  sofie: "SoFIE project",
  acme: "ACME on the ISS",
};

export const shortName = (sourceId: string) => SHORT[sourceId] ?? sourceId;

/** A citation that opens the NASA PDF at the cited page (or the NTRS record for abstracts). */
export function Cite({ sourceId, page, where, className = "" }: { sourceId: string; page?: number; where?: string; className?: string }) {
  const s = getSource(sourceId);
  if (!s) throw new Error(`Unknown source ${sourceId}`);
  const parts = [shortName(sourceId), where, page ? `PDF p. ${page}` : "abstract"].filter(Boolean).join(", ");
  return (
    <a
      href={pdfLink(sourceId, page)}
      target="_blank"
      rel="noreferrer"
      className={`link text-sm ${className}`}
      title={`${s.title} (NTRS ${s.ntrs_id})`}
    >
      {parts}
    </a>
  );
}

export function Quote({ f, className = "" }: { f: Finding; className?: string }) {
  return (
    <figure className={`m-0 ${className}`}>
      <blockquote className="text-[17px] leading-relaxed text-ink">“{f.quote}”</blockquote>
      <figcaption className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        <span>{KIND_LABEL[f.kind]}</span>
        <Cite sourceId={f.source_id} page={f.pdf_page} />
      </figcaption>
    </figure>
  );
}
