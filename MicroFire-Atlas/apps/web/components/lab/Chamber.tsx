import { GRAVITY_G, type LabConfig, type Visual } from "@/lib/flame-lab";
import type { OutcomeGroup } from "@/lib/types";
import styles from "./FlameLab.module.css";

export type Phase = "idle" | "config" | "atmosphere" | "airflow" | "ignition" | "analyzing" | "result";
export type Shown = { visual: Visual; group: OutcomeGroup | "mixed" | null; blowoff: boolean } | null;

const MATERIAL_FILL: Record<string, string> = { PMMA: "url(#lab-pmma)", "SIBAL fabric": "url(#lab-weave)", Nomex: "url(#lab-nomex)", Silicone: "url(#lab-silicone)", "Cotton jersey": "url(#lab-knit)" };
const flowLevel = (f: number) => (f <= 0 ? "still" : f < 3 ? "low" : f < 8 ? "med" : "high");

/**
 * The combustion chamber. Geometry is a stylised BASS-style flow duct. The flame is drawn from qualitative physics
 * (buoyancy ∝ g, forced flow along the duct), never from measured numbers; the state label says which kind of picture it is.
 */
export function Chamber({ cfg, phase, shown, compact = false }: { cfg: LabConfig; phase: Phase; shown: Shown; compact?: boolean }) {
  const g = GRAVITY_G[cfg.gravity];
  const up = g * 12, along = cfg.flow; // illustrative: buoyant "velocity" vs forced flow, both in cm/s-like units
  const speed = Math.hypot(up, along);
  const angle = speed < 0.4 ? 0 : (Math.atan2(along, up) * 180) / Math.PI; // 0° = straight up, 90° = straight downstream
  const len = speed < 0.4 ? 34 : Math.min(175, 64 + speed * 8);
  const wid = speed < 0.4 ? 38 : Math.max(24, 46 - along * 0.9);
  // illustrative colour only: more oxygen and stronger flow look brighter and yellower; slow, lean flames look dim and blue
  const yellow = Math.max(0, Math.min(1, ((cfg.o2 - 13) / 12) * Math.min(1, speed / 8 + g)));
  const lit = phase === "result" && shown && shown.visual !== "unknown" && shown.group !== "not_ignited";
  const unknown = phase === "result" && shown?.visual === "unknown";
  const fade = lit && shown!.visual === "nasa" && shown!.group === "extinguished";
  const igniting = phase === "ignition" || (phase === "result" && shown?.group === "not_ignited");
  const drift = cfg.gravity !== "orbit" && up > along ? "up" : cfg.flow > 0 ? "right" : "float";
  // flame: a teardrop with its base at the origin, pointing up; rotated toward the flow and scaled by length
  const flame = `M0 0 C ${-wid / 2} -4, ${-wid / 2} ${-len * 0.45}, 0 ${-len} C ${wid / 2} ${-len * 0.45}, ${wid / 2} -4, 0 0 Z`;
  const core = `M0 -2 C ${-wid / 4} -6, ${-wid / 4} ${-len * 0.35}, 0 ${-len * 0.62} C ${wid / 4} ${-len * 0.35}, ${wid / 4} -6, 0 -2 Z`;

  return (
    <svg viewBox="0 0 800 460" className={styles.chamber} data-env={cfg.gravity} data-flow={flowLevel(cfg.flow)} data-unknown={unknown || undefined} data-compact={compact || undefined}
      role="img" aria-label={`Illustrated combustion chamber: ${cfg.material} sample, ${cfg.o2} % oxygen, ${cfg.flow} cm/s airflow, ${cfg.gravity}. ${unknown ? "Insufficient experimental evidence: no flame is drawn." : lit ? "Flame shown." : "Sample not lit."}`}>
      <defs>
        <linearGradient id="lab-metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5b6a86" /><stop offset=".45" stopColor="#c9d3e3" /><stop offset=".55" stopColor="#8592ab" /><stop offset="1" stopColor="#3a465e" /></linearGradient>
        <linearGradient id="lab-glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9fc7ff" stopOpacity=".10" /><stop offset=".5" stopColor="#9fc7ff" stopOpacity=".03" /><stop offset="1" stopColor="#9fc7ff" stopOpacity=".09" /></linearGradient>
        <radialGradient id="lab-outer" cx=".5" cy=".85" r=".8"><stop offset="0" stopColor="#7fb4ff" stopOpacity=".95" /><stop offset=".6" stopColor="#3f7cff" stopOpacity=".55" /><stop offset="1" stopColor="#3f7cff" stopOpacity="0" /></radialGradient>
        <radialGradient id="lab-core" cx=".5" cy=".8" r=".75"><stop offset="0" stopColor="#fff4d6" /><stop offset=".45" stopColor="#ffc35a" /><stop offset="1" stopColor="#ff7a2a" stopOpacity="0" /></radialGradient>
        <radialGradient id="lab-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#ffb347" stopOpacity=".35" /><stop offset="1" stopColor="#ffb347" stopOpacity="0" /></radialGradient>
        <pattern id="lab-hex" width="12" height="10.4" patternUnits="userSpaceOnUse"><path d="M3 0h6l3 5.2-3 5.2H3L0 5.2z" fill="none" stroke="#8fa3c4" strokeOpacity=".55" strokeWidth=".8" /></pattern>
        <pattern id="lab-screen" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.3" fill="#c98d5a" fillOpacity=".7" /></pattern>
        <pattern id="lab-weave" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#b9a27e" /><path d="M0 1.5h6M0 4.5h6" stroke="#8c7655" strokeWidth="1" /><path d="M1.5 0v6M4.5 0v6" stroke="#d8c6a4" strokeWidth=".7" /></pattern>
        <pattern id="lab-nomex" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#d4b13c" /><path d="M0 3h6M3 0v6" stroke="#a88b25" strokeWidth=".9" /></pattern>
        <pattern id="lab-knit" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="#e9e3d6" /><path d="M0 0l2.5 5L5 0" fill="none" stroke="#c9c0ad" strokeWidth=".8" /></pattern>
        <linearGradient id="lab-pmma" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e7f6ff" stopOpacity=".85" /><stop offset="1" stopColor="#9cc9de" stopOpacity=".55" /></linearGradient>
        <linearGradient id="lab-silicone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d9b8b4" /><stop offset="1" stopColor="#a98681" /></linearGradient>
        <filter id="lab-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" /></filter>
      </defs>

      {/* environment seen through the glass: subtle, it changes with the gravity setting */}
      <g className={styles.env}>
        <rect width="800" height="460" className={styles.envSky} />
        <g className={styles.envOrbit}>{Array.from({ length: 34 }, (_, i) => <circle key={i} cx={(i * 197) % 800} cy={(i * 113) % 460} r={i % 5 === 0 ? 1.4 : 0.8} />)}</g>
        <path className={styles.envGround} d="M0 400 Q 400 352 800 400 V 460 H 0 Z" />
      </g>

      {/* duct */}
      <rect x="86" y="124" width="628" height="212" rx="18" fill="url(#lab-glass)" stroke="#9fb3d6" strokeOpacity=".35" />
      <rect x="70" y="108" width="660" height="16" rx="6" fill="url(#lab-metal)" />
      <rect x="70" y="336" width="660" height="16" rx="6" fill="url(#lab-metal)" />
      {[96, 220, 400, 580, 704].map((x) => <g key={x}><circle cx={x} cy="116" r="2.6" fill="#273149" /><circle cx={x} cy="344" r="2.6" fill="#273149" /></g>)}
      <rect x="92" y="130" width="38" height="200" rx="6" fill="url(#lab-hex)" stroke="#8fa3c4" strokeOpacity=".4" />
      <rect x="670" y="130" width="38" height="200" rx="6" fill="url(#lab-screen)" stroke="#c98d5a" strokeOpacity=".45" />
      <text x="111" y="96" className={styles.svgLabel} textAnchor="middle">inlet · flow straightener</text>
      <text x="689" y="96" className={styles.svgLabel} textAnchor="middle">exit screen</text>

      {/* forced-flow streamlines: speed follows airflow; none in still air */}
      <g className={styles.streams} aria-hidden="true">
        {[150, 172, 194, 266, 288, 310].map((y, i) => <path key={y} d={`M134 ${y} C 300 ${y + (y < 230 ? -6 : 6)}, 520 ${y + (y < 230 ? -6 : 6)}, 666 ${y}`} data-i={i % 3} />)}
      </g>

      {/* sample on its holder, parallel to the flow */}
      <rect x="282" y="221" width="16" height="18" rx="3" fill="url(#lab-metal)" />
      <rect x="522" y="221" width="16" height="18" rx="3" fill="url(#lab-metal)" />
      <rect x="296" y="226" width="228" height="8" rx="1.5" fill={MATERIAL_FILL[cfg.material] ?? "#888"} className={styles.sample} />
      <path d="M298 216 q4 -6 8 0 q4 6 8 0 q4 -6 8 0" className={styles.igniter} data-on={igniting || undefined} />

      {/* drifting particles: upward with buoyancy, downstream with forced flow, floating in still microgravity */}
      <g className={styles.particles} data-drift={drift} data-on={lit || undefined} aria-hidden="true">
        {Array.from({ length: 9 }, (_, i) => <circle key={i} cx={410 + ((i * 37) % 60) - 30} cy={214 - ((i * 23) % 24)} r={1.6} data-i={i % 3} />)}
      </g>

      {/* the flame */}
      {lit && (
        <g transform={`translate(${phase === "result" && shown?.blowoff ? 452 : 410} 224) rotate(${angle})`} className={styles.flame} data-fade={fade || undefined} data-blowoff={(fade && shown?.blowoff) || undefined} data-steady={cfg.gravity === "orbit" || undefined}>
          <ellipse cx="0" cy={-len / 2} rx={wid * 1.4} ry={len * 0.9} fill="url(#lab-glow)" />
          <path d={flame} fill="url(#lab-outer)" filter="url(#lab-blur)" opacity=".85" />
          <path d={flame} fill="url(#lab-outer)" />
          <path d={core} fill="url(#lab-core)" opacity={0.15 + yellow * 0.85} />
        </g>
      )}
      {unknown && (
        <g className={styles.ghost}>
          <path d="M410 224 C 392 218, 392 170, 410 140 C 428 170, 428 218, 410 224 Z" />
          <text x="410" y="196" textAnchor="middle" className={styles.q}>?</text>
        </g>
      )}

      {/* measurement overlays */}
      <g className={styles.vectors} aria-hidden="true">
        <line x1="760" y1="150" x2="760" y2={150 + Math.max(6, g * 70)} />
        <path d={`M754 ${150 + Math.max(6, g * 70) - 8} l6 10 l6 -10`} />
        <text x="760" y="140" textAnchor="middle" className={styles.svgLabel}>g {g === 0 ? "≈ 0" : g}</text>
        {cfg.flow > 0 && <><line x1="150" y1="372" x2={150 + Math.min(220, 30 + cfg.flow * 10)} y2="372" /><path d={`M${150 + Math.min(220, 30 + cfg.flow * 10) - 8} 366 l10 6 l-10 6`} /><text x="150" y="392" className={styles.svgLabel}>forced flow {cfg.flow} cm/s</text></>}
        {cfg.flow === 0 && <text x="150" y="392" className={styles.svgLabel}>still air: no forced flow</text>}
      </g>
    </svg>
  );
}
