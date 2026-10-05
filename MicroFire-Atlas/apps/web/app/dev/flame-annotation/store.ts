/** Dev-only file access for the Flame Vision annotation tool. Never reachable in production. */
import { readFileSync } from "node:fs";
import path from "node:path";

export const DIR = path.resolve(process.cwd(), "../../evaluation/flame-vision");
export const devOnly = () => process.env.NODE_ENV === "development";

export type Candidate = {
  id: string; slug: string; source_url: string; timestamp_s: number; frame_size: [number, number]; selection_reason: string;
  frame: string; frame_sha256: string; prediction: string; prediction_sha256: string;
  pipeline_version: string; pipeline_config: unknown;
};
const read = (f: string) => { try { return JSON.parse(readFileSync(path.join(DIR, f), "utf8")); } catch { return null; } };
export const candidates = (): Candidate[] => read("candidates.json")?.frames ?? [];
export const manifest = (): { version: 1; description?: string; frames: { id: string }[] } => read("manifest.json") ?? { version: 1, frames: [] };
