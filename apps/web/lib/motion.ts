/**
 * Flame Vision 2.0: motion measured from the precomputed frames. Everything stays in pixels of the analysed
 * rendition and seconds of video time: NASA publishes no spatial calibration, and some films are sped up.
 * Direction comes from the overall drift of the flame centre; speeds are smoothed over ±2 samples.
 */
import type { FrameMetrics } from "./media";

export type Motion = {
  t: number;
  reliable: boolean; // no quality flag at all on this frame (overexposure included)
  leadPx: number | null; // leading-edge position, px from the left of the frame
  leadSpeed: number | null; // px per second of video time, positive = advancing
  areaRate: number | null; // flame area change, px² per second of video time
  centroidPx: [number, number] | null;
};

export type MotionSummary = { direction: "right" | "left" | "none"; frames: Motion[]; reliableShare: number; medianSpeed: number | null };

const SPAN = 2;

export function motion(frames: FrameMetrics[], frameSize: [number, number]): MotionSummary {
  const [W, H] = frameSize;
  // overexposure blurs brightness, not where the flame is; only frames with a weak or missing flame are left out
  const usable = (f: FrameMetrics) => !!f.centroid && !f.flags.includes("weak_or_no_flame");
  const good = frames.filter(usable);
  // least-squares slope of centroid x over time decides the direction of travel
  let direction: MotionSummary["direction"] = "none";
  if (good.length >= 5) {
    const mt = good.reduce((a, f) => a + f.t, 0) / good.length;
    const mx = good.reduce((a, f) => a + f.centroid![0], 0) / good.length;
    const num = good.reduce((a, f) => a + (f.t - mt) * (f.centroid![0] - mx), 0);
    const den = good.reduce((a, f) => a + (f.t - mt) ** 2, 0) || 1;
    const slopePxPerS = (num / den) * W;
    if (Math.abs(slopePxPerS) > 0.5) direction = slopePxPerS > 0 ? "right" : "left";
  }
  const lead = (f: FrameMetrics) => (f.bbox && direction !== "none" ? (direction === "right" ? f.bbox[2] : f.bbox[0]) * W : null);
  const out: Motion[] = frames.map((f, i) => {
    const a = frames[Math.max(0, i - SPAN)], b = frames[Math.min(frames.length - 1, i + SPAN)];
    const dt = b.t - a.t;
    const la = lead(a), lb = lead(b);
    const sign = direction === "left" ? -1 : 1;
    return {
      t: f.t,
      reliable: f.flags.length === 0,
      leadPx: lead(f),
      leadSpeed: dt > 0 && la != null && lb != null ? (sign * (lb - la)) / dt : null,
      areaRate: dt > 0 ? (b.area_px - a.area_px) / dt : null,
      centroidPx: f.centroid ? [f.centroid[0] * W, f.centroid[1] * H] : null,
    };
  });
  const speeds = out.filter((m, i) => usable(frames[i]) && m.leadSpeed != null).map((m) => m.leadSpeed!).sort((x, y) => x - y);
  return {
    direction,
    frames: out,
    reliableShare: frames.length ? out.filter((m) => m.reliable).length / frames.length : 0,
    medianSpeed: speeds.length ? speeds[Math.floor(speeds.length / 2)] : null,
  };
}
