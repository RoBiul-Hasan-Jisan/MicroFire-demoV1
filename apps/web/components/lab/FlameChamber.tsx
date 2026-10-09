"use client";

import { useEffect, useId, useRef, useState } from "react";
import { OUTCOME_STYLE } from "@/lib/data";
import { lookOf, worldOf, type LabState, type ViewId } from "@/lib/lab-model";
import type { Ranked } from "@/lib/relevance";

/* All motion lives in lab.css and every number reaches the DOM as an SVG attribute, so the strict CSP holds. */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Ease a set of numbers toward their targets; jumps straight there for reduced motion. */
export function useSmooth(target: number[], k = 0.12) {
  const [v, setV] = useState(target);
  const t = useRef(target);
  useEffect(() => { t.current = target; });
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const tick = () => {
      setV((cur) => {
        let done = true;
        const next = cur.map((c, i) => {
          const d = t.current[i] - c;
          if (reduce || Math.abs(d) < 0.003) return t.current[i];
          done = false;
          return c + d * k;
        });
        return done && next.every((n, i) => n === cur[i]) ? cur : next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [k]);
  return v;
}

/** Flame outline. t = 0 is a round sphere (orbit), t = 1 a tall teardrop (Earth). Origin is the base of the flame. */
export function flamePath(R: number, t: number, scale = 1) {
  const r = R * scale;
  const w = r * (1 - 0.22 * t);
  const topY = -r * (2 + 1.7 * t);
  const c1y = -r - r * (0.5523 + 0.7 * t);
  const c2x = w * (0.5523 * (1 - t) + 0.06 * t);
  const c2y = topY + r * 0.95 * t;
  const k = 0.5523;
  const f = (n: number) => n.toFixed(2);
  return (
    `M0 0 C${f(k * w)} 0 ${f(w)} ${f(-r + k * r)} ${f(w)} ${f(-r)} ` +
    `C${f(w)} ${f(c1y)} ${f(c2x)} ${f(c2y)} 0 ${f(topY)} ` +
    `C${f(-c2x)} ${f(c2y)} ${f(-w)} ${f(c1y)} ${f(-w)} ${f(-r)} ` +
    `C${f(-w)} ${f(-r + k * r)} ${f(-k * w)} 0 0 0 Z`
  );
}

/* ---------------------------------------------------------------------------------------------- */

export type FlameLook = { g: number; size: number; lean: number; intensity: number; quench: boolean };

export function FlameShape({ look, base = 72 }: { look: FlameLook; base?: number }) {
  const id = useId().replace(/:/g, "");
  const { g, size, lean, intensity, quench } = look;
  const t = clamp(g, 0, 1); // shape
  const warm = clamp(g * 4.5, 0, 1) * (quench ? 0.3 : 1); // colour: amber with any real gravity, dim blue in orbit
  const k = intensity;
  const R = base * size * (0.35 + 0.65 * k);
  const cls = g >= 0.5 ? "lab-flick-fast" : g > 0.05 ? "lab-flick-mid" : "lab-breathe";
  const skew = -lean * 22;
  return (
    <g className="lab-flame">
      <defs>
        <radialGradient id={`${id}a`} cx="50%" cy="72%" r="68%">
          <stop offset="0" stopColor="#fff6d6" />
          <stop offset=".42" stopColor="#ffc35a" />
          <stop offset="1" stopColor="#e5702a" />
        </radialGradient>
        <radialGradient id={`${id}b`} cx="46%" cy="42%" r="62%">
          <stop offset="0" stopColor="#f2f6ff" />
          <stop offset=".5" stopColor="#8fb0ff" />
          <stop offset="1" stopColor="#3e63c8" />
        </radialGradient>
        <radialGradient id={`${id}g`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#f0a044" stopOpacity=".55" />
          <stop offset="1" stopColor="#f0a044" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}gb`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#5b8cff" stopOpacity=".55" />
          <stop offset="1" stopColor="#5b8cff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="0" cy={-R * (1 + t * 0.7)} rx={R * 2.6} ry={R * (2.2 + t * 1.2)} fill={`url(#${id}gb)`} opacity={k * (1 - warm)} className="lab-glow" />
      <ellipse cx="0" cy={-R * (1 + t * 0.7)} rx={R * 2.6} ry={R * (2.2 + t * 1.2)} fill={`url(#${id}g)`} opacity={k * warm} className="lab-glow" />
      <g transform={`skewX(${skew.toFixed(1)})`} opacity={clamp(k * 1.4, 0, 1)}>
        <g className={cls}>
          <path d={flamePath(R, t)} fill={`url(#${id}b)`} opacity={1 - warm} />
          <path d={flamePath(R, t)} fill={`url(#${id}a)`} opacity={warm} />
          <path d={flamePath(R, t, 0.5)} fill="#fff" opacity={0.55 * k} />
        </g>
      </g>
    </g>
  );
}

/* ---------------------------------------------------------------------------------------------- */

const RISE = [-52, -30, -12, 8, 26, 46, -40, 16, -4, 36];
const MOTES = [
  [-120, -90], [110, -120], [-150, -30], [150, -50], [-70, -170], [60, -190], [-100, -140], [130, -160], [0, -210], [-30, 20],
];

type Props = {
  state: LabState;
  view: ViewId;
  lit: boolean;
  igniteKey: number;
  replay: "sustained" | "extinguished" | "not_ignited" | null;
  nearest: Ranked[];
  verdictLabel: string;
  onPick: (id: string) => void;
};

export function FlameChamber({ state, view, lit, igniteKey, replay, nearest, verdictLabel, onPick }: Props) {
  const look = lookOf(state);
  const world = worldOf(state.world);
  const out = replay === "extinguished" || replay === "not_ignited";
  const on = lit && !out ? 1 : 0;
  const [g, size, lean, k] = useSmooth([look.g, look.size, look.lean, on], 0.1);
  const flame: FlameLook = { g, size, lean, intensity: k, quench: replay === "extinguished" };
  const t = clamp(g, 0, 1);
  const R = 72 * size * (0.35 + 0.65 * k);
  const bucket = look.bucket;
  const o2 = state.oxygen;
  const dots = Math.round(8 + ((o2 - 14) / 22) * 34);

  const FX = 420;
  const FY = 372;

  return (
    <svg viewBox="0 0 800 520" className="lab-chamber" role="img" aria-label={`Flame chamber, ${view} view. ${world.label} gravity, ${state.oxygen} percent oxygen, ${state.flow} centimetres per second airflow, ${state.fuel}. ${lit ? "Flame lit." : "Flame not lit."}`}>
      <defs>
        <pattern id="labGrid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="#56d4e4" strokeOpacity=".08" />
        </pattern>
        <linearGradient id="labGlass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0d1830" />
          <stop offset="1" stopColor="#070b16" />
        </linearGradient>
        <linearGradient id="labPmma" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#9fe8f2" stopOpacity=".85" />
          <stop offset="1" stopColor="#4aa8c4" stopOpacity=".6" />
        </linearGradient>
        <pattern id="labWeave" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="#b9a67a" />
          <path d="M0 4H8M4 0V8" stroke="#6e5f3d" strokeWidth="1.4" />
        </pattern>
        <pattern id="labNomex" width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="#d9a83a" />
          <path d="M0 0L6 6M6 0L0 6" stroke="#8a6414" strokeWidth="1" />
        </pattern>
        <linearGradient id="labHeat" x1="0" x2="1">
          <stop offset="0" stopColor="#fff3c4" />
          <stop offset=".35" stopColor="#ffa238" />
          <stop offset=".7" stopColor="#c8412a" />
          <stop offset="1" stopColor="#3a1f5c" />
        </linearGradient>
        <radialGradient id="labHalo" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fff3c4" stopOpacity=".95" />
          <stop offset=".3" stopColor="#ffa238" stopOpacity=".6" />
          <stop offset=".65" stopColor="#c8412a" stopOpacity=".28" />
          <stop offset="1" stopColor="#3a1f5c" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="labDepleted" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#070b16" stopOpacity=".9" />
          <stop offset="1" stopColor="#070b16" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="labAmbient" cx="50%" cy="60%" r="50%">
          <stop offset="0" stopColor="#f0a044" stopOpacity=".28" />
          <stop offset="1" stopColor="#f0a044" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="labAmbientHot" cx="50%" cy="60%" r="50%">
          <stop offset="0" stopColor="#c8412a" stopOpacity=".4" />
          <stop offset="1" stopColor="#c8412a" stopOpacity="0" />
        </radialGradient>
        <clipPath id="labClip"><rect x="14" y="14" width="772" height="492" rx="26" /></clipPath>
      </defs>

      {/* chamber body */}
      <rect x="10" y="10" width="780" height="500" rx="30" fill="url(#labGlass)" />
      <g clipPath="url(#labClip)">
        <rect x="10" y="10" width="780" height="500" fill="url(#labGrid)" />
        <ellipse cx={FX} cy={FY - 90} rx="380" ry="270" fill={view === "heat" ? "url(#labAmbientHot)" : "url(#labAmbient)"} opacity={0.15 + 0.85 * k} className="lab-ambient" />

        {/* view layers sit under the flame */}
        {view === "heat" && (
          <g transform={`translate(${FX} ${FY})`} className="lab-view-in">
            {[1, 0.78, 0.58, 0.4].map((s, i) => (
              <ellipse key={i} cx="0" cy={-R * (1 + t * 0.8)} rx={R * (4.2 * s + 0.3)} ry={R * ((3.2 + t * 2.6) * s + 0.2)} fill="url(#labHalo)" opacity={(0.28 + i * 0.14) * (0.15 + 0.85 * k)} />
            ))}
            {[-60, -20, 20, 60].map((x, i) => (
              <path key={x} d={`M${x} ${-R * 3.6} q8 -16 0 -32 t0 -32`} fill="none" stroke="#ffd7a0" strokeOpacity={0.35 * k} strokeWidth="2" className={`lab-shimmer lab-d${i}`} />
            ))}
          </g>
        )}

        {view === "oxygen" && (
          <g className="lab-view-in">
            <ellipse cx={FX} cy={FY - 30} rx={90 + R * 1.2} ry={70 + R * 1.2} fill="url(#labDepleted)" opacity={0.2 + 0.8 * k} />
            <ellipse cx={FX} cy={FY - 30} rx={90 + R * 1.2} ry={70 + R * 1.2} fill="none" stroke="#56d4e4" strokeDasharray="6 8" strokeOpacity=".55" className="lab-dash" />
            {Array.from({ length: dots }, (_, i) => {
              const row = i % 6;
              const col = Math.floor(i / 6);
              const x = 70 + ((col * 97 + row * 41) % 640);
              const y = 120 + row * 52 + ((col * 17) % 30);
              return <g key={i} transform={`translate(${x} ${y})`}><g className={`lab-o2 lab-o2-${bucket} lab-d${i % 5}`}><circle r="5" fill="#56d4e4" opacity=".85" /><circle cx="8" r="5" fill="#56d4e4" opacity=".6" /></g></g>;
            })}
            <text x="30" y="60" className="lab-svgtext lab-cyan" fontSize="15">O₂ around the flame (illustration)</text>
          </g>
        )}

        {view === "airflow" && (
          <g className="lab-view-in">
            {[130, 190, 250, 310, 370, 430].map((y, i) => (
              <path key={y} d={`M60 ${y} C 260 ${y} 330 ${y + (y < FY ? -1 : 1) * (28 - i * 2) * (0.4 + t)} ${FX} ${y + (y < FY ? -1 : 1) * 20} S 600 ${y} 740 ${y}`} fill="none" stroke="#56d4e4" strokeOpacity={0.5} strokeWidth="2.4" strokeDasharray="14 12" className={`lab-stream lab-stream-${bucket}`} />
            ))}
            <g transform="translate(66 300)">
              <circle r="38" fill="#0d1830" stroke="#56d4e4" strokeOpacity=".5" />
              <g className={`lab-fan lab-fan-${bucket}`}>
                {[0, 90, 180, 270].map((a) => <path key={a} d="M0 0 C 14 -6 24 -20 12 -30 C 6 -20 -2 -12 0 0Z" fill="#56d4e4" opacity=".75" transform={`rotate(${a})`} />)}
              </g>
              <circle r="5" fill="#070b16" />
            </g>
            <text x="30" y="60" className="lab-svgtext lab-cyan" fontSize="15">{`Fan airflow ${state.flow} cm/s (illustration)`}</text>
          </g>
        )}

        {/* sample strip and holder */}
        <g>
          <rect x="150" y={FY + 8} width="520" height="14" rx="3" fill={state.fuel === "PMMA" ? "url(#labPmma)" : state.fuel === "Nomex" ? "url(#labNomex)" : "url(#labWeave)"} />
          <rect x="150" y={FY + 8} width={FX - 150} height="14" rx="3" fill="#120b0b" opacity={0.15 + 0.7 * k} className="lab-char" />
          <rect x="132" y={FY - 4} width="20" height="40" rx="5" fill="#2c3a58" />
          <rect x="668" y={FY - 4} width="20" height="40" rx="5" fill="#2c3a58" />
          <rect x="120" y={FY + 38} width="580" height="6" rx="3" fill="#1e2940" />
        </g>

        {/* particles */}
        {k > 0.1 && (
          <g transform={`translate(${FX} ${FY})`} opacity={clamp(k, 0, 1)}>
            {g > 0.05
              ? RISE.map((x, i) => <circle key={i} cx={x * (0.6 + t * 0.6)} cy="-20" r={i % 3 ? 2.2 : 3} fill={i % 2 ? "#ffd27a" : "#ff9a3d"} className={`lab-rise ${g > 0.5 ? "lab-rise-f" : "lab-rise-s"} lab-d${i % 5}`} />)
              : MOTES.map(([x, y], i) => <circle key={i} cx={x * 0.8} cy={y * 0.8} r={i % 3 ? 2 : 3} fill="#a9c1ff" className={`lab-mote lab-d${i % 5}`} />)}
          </g>
        )}

        {/* the flame */}
        <g transform={`translate(${FX} ${FY})`}>
          <g key={igniteKey} className={replay === "sustained" ? "lab-steady" : lit ? "lab-ignite" : undefined}>
            <FlameShape look={flame} />
          </g>
          {replay === "extinguished" && <circle r="26" cy="-10" fill="none" stroke="#5b8cff" strokeWidth="2" className="lab-ring" />}
          {!lit && !replay && (
            <g className="lab-igniter">
              <path d="M-9 -3 L0 -22 L9 -3" fill="none" stroke="#f0a044" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <circle r="5" cy="-24" fill="#ffd27a" className="lab-pulse" />
            </g>
          )}
        </g>

        {/* safety lens: the nearest NASA tests as a ring of pods around the flame */}
        {view === "safety" && (
          <g className="lab-view-in">
            <ellipse cx={FX} cy={FY - 120} rx="300" ry="170" fill="none" stroke="#56d4e4" strokeOpacity=".22" strokeDasharray="3 9" />
            {nearest.slice(0, 8).map((r, i) => {
              const a = (-200 + (i * 220) / 7) * (Math.PI / 180);
              const x = FX + Math.cos(a) * 300;
              const y = FY - 120 + Math.sin(a) * 170;
              const st = OUTCOME_STYLE[r.experiment.outcome];
              return (
                <g key={r.experiment.id} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} className="lab-pod" role="button" tabIndex={0} aria-label={`${r.experiment.test_id}: ${r.experiment.outcome_label}. Open details`} onClick={() => onPick(r.experiment.id)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onPick(r.experiment.id))}>
                  <path d={`M0 0 L${(FX - x) * 0.12} ${(FY - 120 - y) * 0.12}`} stroke="#56d4e4" strokeOpacity=".25" />
                  <circle r="21" fill="#0d1830" stroke={st.color} strokeWidth="2.5" />
                  <circle r="9" fill={st.hollow ? "none" : st.color} stroke={st.color} strokeWidth="2.5" />
                  <text y="40" textAnchor="middle" className="lab-svgtext" fontSize="12" fill="#c9d1e3">{r.experiment.test_id}</text>
                </g>
              );
            })}
            <text x="30" y="60" className="lab-svgtext lab-cyan" fontSize="15">{verdictLabel}</text>
          </g>
        )}

        {/* heat scale */}
        {view === "heat" && (
          <g transform="translate(560 470)" className="lab-view-in">
            <rect width="190" height="8" rx="4" fill="url(#labHeat)" />
            <text y="-7" className="lab-svgtext" fontSize="11" fill="#8f9ab1">hotter</text>
            <text x="190" y="-7" textAnchor="end" className="lab-svgtext" fontSize="11" fill="#8f9ab1">cooler</text>
          </g>
        )}
      </g>

      {/* HUD frame */}
      <g fill="none" stroke="#56d4e4" strokeOpacity=".7" strokeWidth="3" strokeLinecap="round">
        <path d="M28 70V40a12 12 0 0 1 12-12h30" /><path d="M772 70V40a12 12 0 0 0-12-12h-30" />
        <path d="M28 450v30a12 12 0 0 0 12 12h30" /><path d="M772 450v30a12 12 0 0 1-12 12h-30" />
      </g>
      <rect x="10" y="10" width="780" height="500" rx="30" fill="none" stroke="#2c3a58" strokeWidth="2" />
    </svg>
  );
}
