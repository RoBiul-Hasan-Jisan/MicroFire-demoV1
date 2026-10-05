import { readFileSync } from "node:fs";
import path from "node:path";
import { candidates, devOnly, DIR } from "../../store";

// Serves the original candidate frame only. The pipeline prediction is never shown to the annotator.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!devOnly()) return new Response("Not found", { status: 404 });
  const { id } = await params;
  const c = candidates().find((x) => x.id === id);
  if (!c) return new Response("Not found", { status: 404 });
  try {
    return new Response(readFileSync(path.join(DIR, c.frame)), { headers: { "content-type": "image/png", "cache-control": "no-store" } });
  } catch {
    return new Response("Frame missing: run evaluation/flame-vision/select_candidates.py", { status: 404 });
  }
}
