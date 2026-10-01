"use client";

import { useId } from "react";

export type Mood = "happy" | "curious" | "worried" | "proud" | "surprised";
export type Form = "earth" | "orbit";

const MOUTH: Record<Mood, string> = {
  happy: "M-9 10 Q0 18 9 10",
  proud: "M-12 8 Q0 22 12 8 Z",
  curious: "M-4 12 Q0 9 4 12",
  worried: "M-9 14 Q-4 9 0 13 Q4 17 9 12",
  surprised: "M-5 12 A5 6 0 1 0 5 12 A5 6 0 1 0 -5 12",
};

/**
 * Ember, the MicroFire Atlas guide: a flame who changes shape with gravity,
 * a tall amber teardrop on Earth and a small round blue sphere in orbit.
 * Pure SVG; all motion lives in globals.css (.ember-*), so the strict CSP holds.
 */
export function Ember({ form = "earth", mood = "happy", size = 140, label = true }: { form?: Form; mood?: Mood; size?: number; label?: boolean }) {
  const id = useId().replace(/:/g, "");
  const earth = form === "earth";
  return (
    <svg
      width={size}
      height={size * 1.15}
      viewBox="-70 -110 140 160"
      className={`ember ember-${form}`}
      role={label ? "img" : undefined}
      aria-label={label ? `Ember the flame, ${earth ? "tall and amber like a flame on Earth" : "round and blue like a flame in orbit"}, looking ${mood}` : undefined}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <radialGradient id={`${id}-e`} cx="50%" cy="70%" r="65%">
          <stop offset="0%" stopColor="#fff4cf" />
          <stop offset="45%" stopColor="#ffc35a" />
          <stop offset="100%" stopColor="#e5702a" />
        </radialGradient>
        <radialGradient id={`${id}-o`} cx="45%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#e3ecff" />
          <stop offset="50%" stopColor="#8fb0ff" />
          <stop offset="100%" stopColor="#3e63c8" />
        </radialGradient>
        <radialGradient id={`${id}-g`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={earth ? "#f0a044" : "#5b8cff"} stopOpacity=".55" />
          <stop offset="100%" stopColor={earth ? "#f0a044" : "#5b8cff"} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="0" cy={earth ? -15 : 0} rx="68" ry="78" fill={`url(#${id}-g)`} className="ember-glow" />
      <g className="ember-body">
        <path
          className={`ember-shape ${earth ? "ember-on" : "ember-off"}`}
          d="M0 -100 C 26 -62, 54 -30, 48 12 A 48 46 0 0 1 -48 12 C -54 -30, -26 -62, 0 -100 Z"
          fill={`url(#${id}-e)`}
        />
        <path className="ember-tip" d="M-2 -100 C 8 -86, 14 -78, 10 -64" fill="none" stroke="#fff1c4" strokeWidth="3" strokeLinecap="round" opacity={earth ? 0.7 : 0} />
        <circle className={`ember-shape ${earth ? "ember-off" : "ember-on"}`} cx="0" cy="0" r="46" fill={`url(#${id}-o)`} />
        <g className="ember-face" transform={`translate(0 ${earth ? 2 : -4})`}>
          <g className="ember-eyes">
            <ellipse cx="-15" cy="-6" rx="7" ry={mood === "surprised" ? 10 : 9} fill="#fff" />
            <ellipse cx="15" cy="-6" rx="7" ry={mood === "surprised" ? 10 : 9} fill="#fff" />
            <circle cx={mood === "curious" ? -13 : -15} cy={mood === "worried" ? -3 : -5} r="4" fill="#1b1430" />
            <circle cx={mood === "curious" ? 17 : 15} cy={mood === "worried" ? -3 : -5} r="4" fill="#1b1430" />
            <circle cx="-13.5" cy="-8" r="1.4" fill="#fff" />
            <circle cx="16.5" cy="-8" r="1.4" fill="#fff" />
          </g>
          {mood === "worried" && <path d="M-22 -19 L-9 -15 M22 -19 L9 -15" stroke="#1b1430" strokeWidth="2.5" strokeLinecap="round" />}
          <path d={MOUTH[mood]} fill={mood === "proud" || mood === "surprised" ? "#1b1430" : "none"} stroke="#1b1430" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <ellipse cx="-27" cy="8" rx="6" ry="3.5" fill={earth ? "#e5702a" : "#6f8fe6"} opacity=".55" />
          <ellipse cx="27" cy="8" rx="6" ry="3.5" fill={earth ? "#e5702a" : "#6f8fe6"} opacity=".55" />
        </g>
      </g>
      {[0, 1, 2, 3, 4].map((k) => (
        <circle key={k} className={`ember-spark ember-spark-${k}`} cx={(k - 2) * 16} cy={earth ? -40 : 0} r={k % 2 ? 2.2 : 3} fill={earth ? "#ffd27a" : "#a9c1ff"} />
      ))}
    </svg>
  );
}

/** Ember with a speech bubble. */
export function EmberSays({ children, form, mood, size = 96 }: { children: React.ReactNode; form?: Form; mood?: Mood; size?: number }) {
  return (
    <div className="flex items-end gap-3">
      <div className="shrink-0">
        <Ember form={form} mood={mood} size={size} />
      </div>
      <div className="ember-bubble" role="note">
        <p className="text-[11px] font-semibold text-signal">Ember, your flame guide</p>
        <div className="mt-1 text-[15px] leading-snug">{children}</div>
      </div>
    </div>
  );
}
