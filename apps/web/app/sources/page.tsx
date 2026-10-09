import type { Metadata } from "next";
import { SourcesLibrary, type Doc } from "@/components/SourcesLibrary";
import { findings, sources } from "@/lib/data";

export const metadata: Metadata = { title: "Sources" };

const DOWNLOADS: [string, string, string][] = [
  ["bass2-tests.csv", "BASS-II test records (CSV)", "Material, oxygen, pressure, airflow, outcome, NASA notes."],
  ["saffire-runs.csv", "Saffire runs (CSV)", "Conditions and measured results."],
  ["luci-runs.csv", "LUCI runs (CSV)", "Lunar-gravity burns with NASA sentence and page."],
  ["findings.json", "Findings (JSON)", "Quoted NASA findings, verified against PDF text."],
  ["source-manifest.json", "Source manifest (JSON)", "NTRS records, PDF links and SHA-256 hashes."],
  ["flame-frame-metrics.csv", "Flame frame metrics (CSV)", "Per-frame flame measurements, in pixels."],
  ["evidence-graph.json", "Evidence graph (JSON)", "Families, sources, records, findings, typed links."],
];

export default function SourcesPage() {
  const docs: Doc[] = sources.map((s) => ({ source_id: s.source_id, title: s.title, authors: s.authors, published: s.published, document_type: s.document_type, url: s.url, pdf_url: s.pdf_url, sha256: s.sha256, used_for: s.used_for, copyright: s.copyright, abstract: null, n: findings.filter((f) => f.source_id === s.source_id).length }));
  return <SourcesLibrary docs={docs} downloads={DOWNLOADS} />;
}
