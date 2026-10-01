import { LEGEND, OUTCOME_STYLE, type OutcomeStyle } from "@/lib/data";

export function OutcomeMark({ style, size = 10 }: { style: OutcomeStyle; size?: number }) {
  const r = size / 2 - 1;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill={style.hollow ? "none" : style.color}
        stroke={style.color}
        strokeWidth={style.hollow ? 1.6 : 0}
      />
    </svg>
  );
}

export function OutcomeTag({ outcome, label }: { outcome: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <OutcomeMark style={OUTCOME_STYLE[outcome]} />
      <span>{label}</span>
    </span>
  );
}

export function Legend({ className = "" }: { className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted ${className}`} aria-label="Outcome key">
      {LEGEND.map((s) => (
        <li key={s.legend} className="flex items-center gap-2">
          <OutcomeMark style={s} />
          {s.legend}
        </li>
      ))}
    </ul>
  );
}
