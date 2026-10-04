import { evidenceRecords, experiments, findings, saffireRuns, sources } from "@/lib/data";
import { buildGraph } from "@/lib/graph";
import { FRONTIER } from "@/lib/frontier";
import type { Analysis } from "@/lib/media";
import saffireVi from "@/public/media/saffire-vi-pmma/analysis.json";
import saffireV from "@/public/media/saffire-v-ribs/analysis.json";
import bass2Still from "@/public/media/bass2-reduced-o2-gmt213/analysis.json";
import bassStill from "@/public/media/bass-cassidy-2013/analysis.json";

/** Open data: every dataset behind the site, as files anyone can download and check. GET only, allow-listed names. */
const cell = (v: unknown) => {
  const s = v == null ? "" : Array.isArray(v) ? v.join("; ") : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (header: string[], rows: unknown[][]) => [header.join(","), ...rows.map((r) => r.map(cell).join(","))].join("\n") + "\n";

const FILES: Record<string, { type: string; body: () => string }> = {
  "bass2-tests.csv": {
    type: "text/csv",
    body: () => csv(
      ["id", "test_id", "investigation", "material", "thickness_mm", "width_mm", "flow_direction", "flow_initial_cm_s", "flow_final_cm_s", "flow_as_recorded", "oxygen_vol_pct", "pressure_kpa", "outcome", "outcome_label", "nasa_notes", "source_id", "pdf_page"],
      experiments.map((e) => [e.id, e.test_id, e.investigation, e.material, e.thickness_mm, e.width_mm, e.flow_direction, e.flow_initial_cm_s, e.flow_final_cm_s, e.flow_verbatim, e.oxygen_vol_pct, e.pressure_kpa ?? e.pressure_kpa_range?.join("-"), e.outcome, e.outcome_label, e.observations_verbatim, e.provenance.record.source_id, e.provenance.record.pdf_page]),
    ),
  },
  "saffire-runs.csv": {
    type: "text/csv",
    body: () => csv(
      ["id", "flight", "sample", "material", "material_verbatim", "thickness_mm", "width_cm", "length_cm", "flow_cm_s", "flow_direction", "pressure_kpa", "o2_pct", "o2_basis", "burn_duration_s", "spread_rate_mm_s", "heat_release_avg_w", "heat_release_peak_w", "outcome", "outcome_label", "conditions_source", "conditions_pdf_page", "results_source", "results_pdf_page"],
      saffireRuns.map((r) => [r.id, r.flight, r.sample, r.material, r.material_verbatim, r.thickness_mm, r.width_cm, r.length_cm, r.flow_cm_s, r.flow_direction, r.pressure_kpa, r.o2_pct, r.o2_basis, r.burn_duration_s, r.spread_rate_mm_s, r.heat_release_avg_w, r.heat_release_peak_w, r.outcome_group, r.outcome_label, r.provenance.conditions?.source_id, r.provenance.conditions?.pdf_page, r.provenance.results?.source_id, r.provenance.results?.pdf_page]),
    ),
  },
  "findings.json": { type: "application/json", body: () => JSON.stringify(findings, null, 1) },
  "source-manifest.json": { type: "application/json", body: () => JSON.stringify(sources, null, 1) },
  "flame-frame-metrics.csv": {
    type: "text/csv",
    body: () => csv(
      ["media", "t_video_s", "area_px", "luminous_px", "blue_px", "width_px", "height_px", "centroid_x_frac", "centroid_y_frac", "mean_brightness", "regions", "flags"],
      ([saffireVi, saffireV, bass2Still, bassStill] as unknown as Analysis[]).flatMap((a) =>
        a.frames.map((f) => [a.slug, f.t, f.area_px, f.luminous_px, f.blue_px, f.width_px, f.height_px, f.centroid?.[0], f.centroid?.[1], f.mean_brightness, f.regions, f.flags]),
      ),
    ),
  },
  "evidence-graph.json": { type: "application/json", body: () => JSON.stringify(buildGraph(evidenceRecords, findings, sources, FRONTIER), null, 1) },
};

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const file = Object.hasOwn(FILES, name) ? FILES[name] : undefined;
  if (!file) return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return new Response(file.body(), {
    headers: {
      "Content-Type": `${file.type}; charset=utf-8`,
      "Content-Disposition": `attachment; filename="microfire-atlas-${name}"`,
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
