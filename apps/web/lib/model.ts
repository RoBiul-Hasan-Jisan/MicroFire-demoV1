/**
 * Outcome model runtime. The model itself is trained offline (pipelines/train_models.py) and shipped
 * as plain numbers in data/model.json, so every prediction here can be reproduced by hand.
 */
export type ModelPoint = { id: string; material: string; o2: number; flow: number; direction: string | null; sustained: number; series: string };
export type Boot = { mu: number[]; sd: number[]; w: number[]; b: number };
export type Model = {
  features: string[]; mu: number[]; sd: number[]; w: number[]; b: number; bootstrap: Boot[];
  ranges: { o2_pct: [number, number]; flow_cm_s: [number, number] };
  points: ModelPoint[];
  report?: { n_rows: number; models: Record<string, { balanced_accuracy: number }> };
};
export type Conditions = { o2: number; flow: number; direction: "concurrent" | "opposed" };
export type Prediction = {
  p: number; lo: number; hi: number;
  inRange: { o2: boolean; flow: boolean; direction: boolean };
  nearest: (ModelPoint & { distance: number })[];
};

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

export function featureVector(features: string[], c: Conditions): number[] {
  const f: Record<string, number> = { o2_pct: c.o2, log_flow: Math.log(c.flow), opposed: c.direction === "opposed" ? 1 : 0 };
  return features.map((k) => f[k]);
}

function score(x: number[], mu: number[], sd: number[], w: number[], b: number) {
  return sigmoid(x.reduce((s, v, i) => s + ((v - mu[i]) / sd[i]) * w[i], b));
}

export function predictOutcome(m: Model, c: Conditions): Prediction {
  const x = featureVector(m.features, c);
  const p = score(x, m.mu, m.sd, m.w, m.b);
  const ps = m.bootstrap.map((B) => score(x, B.mu, B.sd, B.w, B.b)).sort((a, b) => a - b);
  const q = (f: number) => ps[Math.min(ps.length - 1, Math.max(0, Math.round(f * (ps.length - 1))))];
  const [o0, o1] = m.ranges.o2_pct, [f0, f1] = m.ranges.flow_cm_s;
  const o2Span = o1 - o0, flowSpan = Math.log(f1) - Math.log(f0);
  const nearest = m.points
    .map((pt) => ({
      ...pt,
      distance: Math.hypot((pt.o2 - c.o2) / o2Span, (Math.log(pt.flow) - Math.log(c.flow)) / flowSpan) + (pt.direction && pt.direction !== c.direction ? 0.1 : 0),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5);
  return {
    p, lo: q(0.05), hi: q(0.95),
    inRange: { o2: c.o2 >= o0 && c.o2 <= o1, flow: c.flow >= f0 && c.flow <= f1, direction: m.points.some((pt) => pt.direction === c.direction) },
    nearest,
  };
}
