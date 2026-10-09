import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { motion } from "./motion.ts";

const load = (slug: string) => JSON.parse(readFileSync(new URL(`../public/media/${slug}/analysis.json`, import.meta.url), "utf8"));

test("a synthetic flame moving right at 10 px/s is measured as such", () => {
  const frames = Array.from({ length: 20 }, (_, i) => ({
    t: i * 0.2, area_px: 100 + i * 10, luminous_px: 0, blue_px: 0, area_frac: 0, regions: 1, flags: [], outlines: [],
    bbox: [0.1 + i * 0.002, 0.4, 0.2 + i * 0.002, 0.6] as [number, number, number, number], centroid: [0.15 + i * 0.002, 0.5] as [number, number],
  }));
  const m = motion(frames, [1000, 500]);
  assert.equal(m.direction, "right");
  assert.ok(Math.abs(m.medianSpeed! - 10) < 1e-6); // 0.002 of 1000 px per 0.2 s
  assert.ok(Math.abs(m.frames[10].areaRate! - 50) < 1e-6); // 10 px² per 0.2 s
  assert.equal(m.reliableShare, 1);
});

test("real NASA analyses produce bounded, flagged-aware motion in pixels", () => {
  for (const slug of ["saffire-vi-pmma", "saffire-v-ribs"]) {
    const a = load(slug);
    const m = motion(a.frames, a.frame_size);
    assert.equal(m.frames.length, a.frames.length);
    assert.ok(m.reliableShare >= 0 && m.reliableShare <= 1);
    for (const f of m.frames) if (f.leadPx != null) assert.ok(f.leadPx >= 0 && f.leadPx <= a.frame_size[0]);
  }
});
