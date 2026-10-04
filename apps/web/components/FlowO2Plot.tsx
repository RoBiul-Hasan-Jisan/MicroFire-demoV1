import { OUTCOME_STYLE } from "@/lib/data";
import type { Experiment } from "@/lib/types";

/**
 * Oxygen (vol %) against airflow (cm/s, log scale) for every NASA test.
 * Server-rendered SVG: each point is a link with an accessible name; no client JS.
 *
 * - A line means the flow was changed during the test; the marker sits where it ended.
 * - A short tail means the flow was then pushed lower (quench) or higher (blowoff) to a
 *   fan setting that NASA's table does not convert to cm/s, so we don't place it.
 */
type Props = {
  data: Experiment[];
  highlight?: string[];
  scenario?: { oxygen?: number; flow?: number };
  height?: number;
  label: string;
};

const W = 760;
const PAD = { l: 52, r: 18, t: 18, b: 44 };
const X_MIN = 1;
const X_MAX = 60;
const Y_MIN = 13.5;
const Y_MAX = 21.5;
const X_TICKS = [1, 2, 5, 10, 20, 50];
const Y_TICKS = [14, 16, 18, 20];

export function FlowO2Plot({ data, highlight = [], scenario, height = 420, label }: Props) {
  const H = height;
  const x = (v: number) => Math.round((PAD.l + ((Math.log(v) - Math.log(X_MIN)) / (Math.log(X_MAX) - Math.log(X_MIN))) * (W - PAD.l - PAD.r)) * 1000) / 1000;
  const y = (v: number) => Math.round((PAD.t + (1 - (v - Y_MIN) / (Y_MAX - Y_MIN)) * (H - PAD.t - PAD.b)) * 1000) / 1000;
  const hi = new Set(highlight);
  const plotted = data.filter((e) => e.flow_initial_cm_s != null && e.oxygen_vol_pct != null);
  // Draw highlighted points last so they sit on top.
  plotted.sort((a, b) => Number(hi.has(a.id)) - Number(hi.has(b.id)));
  // One label per position: coincident highlighted tests share a label ("B8, B13, B15").
  const labels = new Map<string, { x: number; y: number; ids: string[] }>();
  for (const e of plotted) {
    if (!hi.has(e.id)) continue;
    const lx = x(e.flow_final_cm_s ?? e.flow_initial_cm_s!);
    const ly = y(e.oxygen_vol_pct!);
    const key = `${lx.toFixed(1)},${ly.toFixed(1)}`;
    const l = labels.get(key) ?? { x: lx, y: ly, ids: [] };
    l.ids.push(e.test_id);
    labels.set(key, l);
  }

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="group" aria-label={label}>
        {Y_TICKS.map((t) => (
          <g key={`y${t}`}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--rule)" />
            <text x={PAD.l - 10} y={y(t) + 4} textAnchor="end" className="num" fontSize="12" fill="var(--faint)">
              {t}%
            </text>
          </g>
        ))}
        {X_TICKS.map((t) => (
          <g key={`x${t}`}>
            <line x1={x(t)} x2={x(t)} y1={PAD.t} y2={H - PAD.b} stroke="var(--rule)" />
            <text x={x(t)} y={H - PAD.b + 18} textAnchor="middle" className="num" fontSize="12" fill="var(--faint)">
              {t}
            </text>
          </g>
        ))}
        <text x={(PAD.l + W - PAD.r) / 2} y={H - 6} textAnchor="middle" fontSize="12" fill="var(--muted)">
          Airflow over the sample, cm/s (log scale)
        </text>
        <text transform={`translate(14 ${(PAD.t + H - PAD.b) / 2}) rotate(-90)`} textAnchor="middle" fontSize="12" fill="var(--muted)">
          Oxygen, % by volume
        </text>

        {scenario?.oxygen != null && (
          <line x1={PAD.l} x2={W - PAD.r} y1={y(scenario.oxygen)} y2={y(scenario.oxygen)} stroke="var(--signal)" strokeDasharray="4 4" />
        )}
        {scenario?.flow != null && (
          <line x1={x(scenario.flow)} x2={x(scenario.flow)} y1={PAD.t} y2={H - PAD.b} stroke="var(--signal)" strokeDasharray="4 4" />
        )}

        {plotted.map((e) => {
          const s = OUTCOME_STYLE[e.outcome];
          const start = e.flow_initial_cm_s!;
          const end = e.flow_final_cm_s ?? start;
          const cx = x(end);
          const cy = y(e.oxygen_vol_pct!);
          const isHi = hi.has(e.id);
          const dim = hi.size > 0 && !isHi;
          const tail =
            e.flow_final_cm_s == null && e.flow_varied
              ? e.outcome === "quenched_low_flow"
                ? -16
                : e.outcome === "blowoff"
                  ? 16
                  : 0
              : 0;
          const r = isHi ? 7 : 4.5;
          const name = `${e.investigation} test ${e.test_id}: ${e.material}, ${e.oxygen_vol_pct}% oxygen, ${
            start === end ? `${start} cm/s` : `${start} to ${end} cm/s`
          }. ${e.outcome_label}.`;
          return (
            <a key={e.id} href={`/experiments/${e.id}`} aria-label={name}>
              <g opacity={dim ? 0.28 : 1}>
              <title>{name}</title>
              {start !== end && <line x1={x(start)} x2={cx} y1={cy} y2={cy} stroke={s.color} strokeOpacity=".45" strokeWidth="1.5" />}
              {tail !== 0 && (
                <line x1={cx} x2={cx + tail} y1={cy} y2={cy} stroke={s.color} strokeWidth="1.5" strokeDasharray="2 3" />
              )}
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={s.hollow ? "var(--void)" : s.color}
                stroke={s.color}
                strokeWidth={s.hollow ? 1.6 : 0}
              />
              {/* invisible larger hit area */}
              <circle cx={cx} cy={cy} r={10} fill="transparent" />
              </g>
            </a>
          );
        })}
        {[...labels.values()].map((l, i) => (
          <text key={i} x={l.x + 10} y={i % 2 ? l.y + 18 : l.y - 9} fontSize="12" fontWeight="600" fill="var(--ink)" aria-hidden="true">
            {l.ids.join(", ")}
          </text>
        ))}
      </svg>
    </figure>
  );
}
