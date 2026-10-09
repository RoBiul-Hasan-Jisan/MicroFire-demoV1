"use server";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { candidates, devOnly, DIR, manifest } from "./store";

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const DIRECTIONS = ["right", "left", "up", "down"];
const CLASSES = ["luminous", "blue", "union"];

export type SaveInput = {
  id: string; truthPngBase64: string; reviewer: string; approved: boolean; valid: boolean; overexposed: boolean;
  direction: string; flameClass: string; notes: string;
};

/** Writes one human-drawn truth mask and its manifest entry. Development only. */
export async function saveAnnotation(x: SaveInput): Promise<{ ok: boolean; message: string }> {
  if (!devOnly()) return { ok: false, message: "Annotation saving is available only in local development." };
  const c = candidates().find((k) => k.id === x.id);
  if (!c) return { ok: false, message: "Unknown candidate frame." };
  if (!x.approved || !x.reviewer.trim()) return { ok: false, message: "A named reviewer must approve the mask they drew." };
  if (!DIRECTIONS.includes(x.direction) || !CLASSES.includes(x.flameClass)) return { ok: false, message: "Choose a flame class and a leading-edge direction." };
  const truth = Buffer.from(x.truthPngBase64, "base64");
  if (truth.length > 5_000_000 || !truth.subarray(0, 8).equals(PNG)) return { ok: false, message: "The mask is not a PNG." };

  const out = path.join(DIR, "annotations");
  mkdirSync(out, { recursive: true });
  // the frame and prediction must be byte-identical to the selected candidates
  for (const [key, hash] of [["frame", c.frame_sha256], ["prediction", c.prediction_sha256]] as const) {
    if (sha(readFileSync(path.join(DIR, c[key]))) !== hash) return { ok: false, message: `Candidate ${key} changed since selection; re-run select_candidates.py.` };
    copyFileSync(path.join(DIR, c[key]), path.join(out, path.basename(c[key])));
  }
  const truthName = `${c.id}.truth.png`;
  writeFileSync(path.join(out, truthName), truth);

  const m = manifest();
  const entry = {
    id: c.id, source_url: c.source_url, timestamp_s: c.timestamp_s,
    approved_by_human: true, reviewer: x.reviewer.trim().slice(0, 80), approved_at: new Date().toISOString().slice(0, 10),
    valid: x.valid, overexposed: x.overexposed, flame_class: x.flameClass, leading_edge_direction: x.direction,
    frame: `annotations/${path.basename(c.frame)}`, frame_sha256: c.frame_sha256,
    truth: `annotations/${truthName}`, truth_sha256: sha(truth),
    prediction: `annotations/${path.basename(c.prediction)}`, prediction_sha256: c.prediction_sha256,
    pipeline_version: c.pipeline_version, pipeline_config: c.pipeline_config,
    selection_reason: c.selection_reason, notes: x.notes.slice(0, 500),
  };
  m.frames = [...m.frames.filter((f) => f.id !== c.id), entry];
  m.description = "Truth masks drawn and approved by a named human reviewer in the dev annotation tool, independently of the pipeline prediction. Not yet adjudicated by a second reviewer.";
  writeFileSync(path.join(DIR, "manifest.json"), JSON.stringify(m, null, 1) + "\n");
  return { ok: true, message: `Saved ${truthName}. Run evaluation/flame-vision/evaluate.py to score the batch.` };
}
