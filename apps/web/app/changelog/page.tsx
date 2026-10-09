import type { Metadata } from "next";
import { readFileSync } from "node:fs";
import path from "node:path";

export const metadata: Metadata = { title: "Model changelog" };

export default function ChangelogPage() {
  let text = "No retrain has been recorded yet.";
  try { text = readFileSync(path.join(process.cwd(), "data", "model_changelog.md"), "utf8"); } catch {}
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-12">
      <p className="text-signal text-sm">Transparency</p>
      <h1 className="display text-4xl mt-2">Model changelog</h1>
      <p className="mt-3 text-muted max-w-[78ch]">Every time cited rows are added and the model is retrained, an entry records what was added, how every score moved (including when it got worse) and whether the recommended next tests changed.</p>
      <pre className="mt-6 whitespace-pre-wrap text-sm" style={{ background: "var(--panel)", border: "1px solid var(--rule-strong)", borderRadius: 12, padding: 16, overflowX: "auto" }}>{text}</pre>
    </div>
  );
}
