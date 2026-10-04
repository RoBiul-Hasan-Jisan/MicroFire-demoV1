import type { SceneState } from "@/components/three/FlameScene";
import { FlowO2Plot } from "@/components/FlowO2Plot";
import { experiments } from "@/lib/data";

/**
 * The 2D play surface: the same BASS-II apparatus and flame states as the 3D scene, drawn in SVG.
 * Used when WebGL is unavailable or the child picks 2D. Illustration, not a simulation.
 */
export function Apparatus2D({ s, className = "" }: { s: SceneState; className?: string }) {
  if (s.view === "cloud")
    return (
      <div className={`app2d app2d-cloud ${className}`}>
        <FlowO2Plot data={experiments} highlight={s.highlight ?? []} height={360} label="Every NASA test in the atlas by oxygen and airflow" />
        {s.voidRegion && <p className="app2d-void">{s.voidRegion.label}: above the top of this chart</p>}
      </div>
    );

  if (s.view === "bench") {
    const earth = s.gravity === "earth";
    return (
      <div className={`app2d ${className}`}>
        <svg viewBox="0 0 400 260" role="img" aria-label={earth ? "Drawing: a tall teardrop flame on Earth" : "Drawing: a small round blue flame in orbit"}>
          <rect x="120" y="200" width="160" height="12" rx="6" fill="#121b30" />
          <rect x="196" y="150" width="8" height="52" rx="3" fill="#c9d1e3" />
          {earth ? (
            <g className="app2d-flicker">
              <path d="M200 40 C 235 95 240 125 222 150 C 212 162 188 162 178 150 C 160 125 165 95 200 40Z" fill="#f0a044" />
              <path d="M200 90 C 215 115 216 132 207 146 C 203 151 197 151 193 146 C 184 132 185 115 200 90Z" fill="#fff1c4" />
            </g>
          ) : (
            <g>
              <circle cx="200" cy="148" r="30" fill="#5b8cff" opacity=".55" />
              <circle cx="200" cy="148" r="16" fill="#bfd2ff" opacity=".8" />
            </g>
          )}
          <text x="200" y="245" textAnchor="middle" className="app2d-cap">{earth ? "On Earth (illustration)" : "In orbit (illustration)"}</text>
        </svg>
      </div>
    );
  }

  const on = new Set(s.parts ?? ["duct", "fan", "straightener", "holder", "igniter", "still", "video", "radiometer", "nozzle", "exit"]);
  const has = (id: string) => on.has(id);
  const ghost = (id: string) => s.ghost === id && !has(id);
  const flowCls = s.flow <= 0.2 ? "" : s.flow <= 2 ? "app2d-flow-slow" : s.flow <= 6 ? "app2d-flow-mid" : "app2d-flow-fast";
  const rev = s.fanReversed;
  const loose = s.sampleLoose;
  const heat = s.igniter ?? 0;
  const hidden = s.seek === "hidden";
  const fabric = s.material === "fabric";
  // leading edge of the flame on the sample
  const fx = 170;
  const tag = (x: number, y: number, t: string, id: string) => (s.labels && has(id) ? <text x={x} y={y} textAnchor="middle" className="app2d-tag">{t}</text> : null);

  return (
    <div className={`app2d ${className}`}>
      <svg viewBox="0 0 520 300" role="img" aria-label={describe(s)}>
        {/* glovebox */}
        <rect x="6" y="10" width="508" height="282" rx="16" fill="#0b1222" stroke="#1e2940" />
        <circle cx="150" cy="276" r="26" fill="#070b16" stroke="#2c3a58" strokeWidth="5" />
        <circle cx="370" cy="276" r="26" fill="#070b16" stroke="#2c3a58" strokeWidth="5" />

        {/* duct */}
        {(has("duct") || ghost("duct")) && (
          <g className={ghost("duct") ? "app2d-ghost" : "app2d-snap"}>
            <rect x="80" y="80" width="360" height="140" rx="6" fill="rgba(91,140,255,.06)" stroke="#56d4e4" strokeWidth="2" />
            <rect x="200" y="84" width="120" height="10" rx="3" fill="#56d4e4" opacity=".25" />
          </g>
        )}
        {tag(260, 72, "Flow duct", "duct")}

        {/* airflow */}
        {has("duct") && flowCls && (
          <g className={`app2d-air ${flowCls} ${rev ? "app2d-air-rev" : ""}`} stroke="#56d4e4" strokeOpacity=".6" strokeWidth="2" strokeLinecap="round">
            {[105, 135, 165, 195].map((y) => (
              <line key={y} x1="92" y1={y} x2="430" y2={y} strokeDasharray="10 26" />
            ))}
          </g>
        )}
        {has("duct") && flowCls && (
          <text x={rev ? 112 : 408} y="236" textAnchor="middle" className="app2d-arrow">{rev ? "◀ air" : "air ▶"}</text>
        )}

        {/* fan */}
        {(has("fan") || ghost("fan")) && (
          <g className={ghost("fan") ? "app2d-ghost" : "app2d-snap"} transform="translate(56 150)">
            <circle r="34" fill="#121b30" stroke="#3a4766" strokeWidth="4" />
            <g className={`app2d-fan ${flowCls} ${rev ? "app2d-fan-rev" : ""}`}>
              {[0, 72, 144, 216, 288].map((a) => (
                <path key={a} d="M0 0 C 8 -10 6 -24 0 -28 C -6 -24 -6 -10 0 0Z" fill="#8fa0bd" transform={`rotate(${a})`} />
              ))}
            </g>
            <circle r="5" fill="#c9d1e3" />
          </g>
        )}
        {tag(56, 102, "Fan", "fan")}

        {/* straightener */}
        {(has("straightener") || ghost("straightener")) && (
          <g className={ghost("straightener") ? "app2d-ghost" : "app2d-snap"} stroke="#3a4766" strokeWidth="2">
            {[0, 1, 2, 3, 4, 5].map((i) => <line key={i} x1={96 + i * 4} y1="86" x2={96 + i * 4} y2="214" />)}
          </g>
        )}
        {tag(108, 232, "Straightener", "straightener")}

        {/* nozzle */}
        {(has("nozzle") || ghost("nozzle")) && (
          <g className={ghost("nozzle") ? "app2d-ghost" : "app2d-snap"}>
            <rect x="120" y="204" width="60" height="8" rx="4" fill="#8fb0ff" />
          </g>
        )}
        {tag(150, 200, "Nitrogen nozzle", "nozzle")}

        {/* sample holder + sample */}
        {(has("holder") || ghost("holder")) && (
          <g className={ghost("holder") ? "app2d-ghost" : "app2d-snap"}>
            <rect x="150" y="166" width="230" height="6" rx="2" fill="#3a4766" />
            <rect x="150" y="160" width="8" height="18" fill="#3a4766" />
            <rect x="372" y="160" width="8" height="18" fill="#3a4766" />
          </g>
        )}
        {has("holder") && (
          <g className={loose ? "app2d-loose" : "app2d-seated"}>
            <rect x="160" y="160" width="210" height="6" rx="2" fill={fabric ? "#b9a98c" : "#c9d1e3"} />
          </g>
        )}
        {tag(265, 190, "Sample holder", "holder")}

        {/* igniter */}
        {(has("igniter") || ghost("igniter")) && (
          <g className={ghost("igniter") ? "app2d-ghost" : "app2d-snap"}>
            <path d="M166 150 q4 -6 8 0 q4 6 8 0 q4 -6 8 0" fill="none" stroke={heat > 0.05 ? "#ff7a2a" : "#6b5a4a"} strokeWidth="3" />
            {heat > 0.05 && <circle cx="178" cy="150" r={8 + heat * 14} fill="#ff7a2a" opacity={0.15 + heat * 0.35} />}
          </g>
        )}
        {tag(178, 138, "Igniter coil", "igniter")}

        {/* cameras and radiometer */}
        {(has("still") || ghost("still")) && (
          <g className={ghost("still") ? "app2d-ghost" : "app2d-snap"}>
            <rect x="236" y="34" width="48" height="30" rx="5" fill="#1c2438" stroke="#3a4766" />
            <rect x="252" y="62" width="16" height="16" rx="3" fill="#0b0f1a" stroke="#3a4766" />
          </g>
        )}
        {tag(260, 28, "Still camera", "still")}
        {(has("video") || ghost("video")) && (
          <g className={ghost("video") ? "app2d-ghost" : "app2d-snap"}>
            <rect x="300" y="232" width="46" height="26" rx="5" fill="#1c2438" stroke="#3a4766" />
            <circle cx="323" cy="226" r="7" fill="#0b0f1a" stroke="#3a4766" />
          </g>
        )}
        {tag(323, 272, "Video camera", "video")}
        {(has("radiometer") || ghost("radiometer")) && (
          <g className={ghost("radiometer") ? "app2d-ghost" : "app2d-snap"}>
            <rect x="404" y="88" width="26" height="12" rx="6" fill="#3a4766" />
          </g>
        )}
        {tag(417, 112, "Radiometer", "radiometer")}

        {/* exit plate */}
        {(has("exit") || ghost("exit")) && (
          <g className={ghost("exit") ? "app2d-ghost" : "app2d-snap"}>
            <rect x="436" y="80" width="8" height="140" fill="#b87333" />
            {[0, 1, 2, 3, 4, 5, 6].map((i) => <circle key={i} cx="440" cy={92 + i * 19} r="2" fill="#0b1222" />)}
          </g>
        )}
        {tag(470, 152, "Exit", "exit")}

        {/* flame */}
        {has("holder") && <Flame2D s={s} x={fx} hidden={hidden} />}
      </svg>
    </div>
  );
}

function Flame2D({ s, x, hidden }: { s: SceneState; x: number; hidden: boolean }) {
  const y = 160;
  switch (s.outcome) {
    case "burning":
      return (
        <g className="app2d-flame-in">
          <ellipse cx={x + 22} cy={y - 10} rx="34" ry="18" fill="#f0a044" opacity=".85" />
          <ellipse cx={x + 16} cy={y - 8} rx="18" ry="9" fill="#fff1c4" />
          <ellipse cx={x - 6} cy={y - 6} rx="8" ry="10" fill="#5b8cff" opacity=".8" />
          <text x={x + 24} y={y - 36} textAnchor="middle" className="app2d-tag">burning</text>
        </g>
      );
    case "dim":
      return (
        <g className={hidden ? "app2d-hidden" : "app2d-flame-in"}>
          <ellipse cx={x + 8} cy={y - 6} rx="14" ry="8" fill="#5b8cff" opacity=".6" />
          {s.seek === "found" && <circle cx={x + 8} cy={y - 6} r="26" fill="none" stroke="#56d4e4" strokeWidth="2.5" strokeDasharray="6 5" />}
          {!hidden && <text x={x + 8} y={y - 30} textAnchor="middle" className="app2d-tag">dim blue flame</text>}
        </g>
      );
    case "quench":
      return (
        <g className="app2d-quench">
          <ellipse cx={x + 8} cy={y - 5} rx="6" ry="4" fill="#5b8cff" opacity=".5" />
          <text x={x + 8} y={y - 22} textAnchor="middle" className="app2d-tag">went out (quenched)</text>
        </g>
      );
    case "blowoff":
      return (
        <g className="app2d-blowoff">
          <ellipse cx={x + 150} cy={y - 24} rx="22" ry="9" fill="#d6e4ff" opacity=".35" />
          <text x={x + 150} y={y - 42} textAnchor="middle" className="app2d-tag">blown off</text>
        </g>
      );
    default:
      return null;
  }
}

function describe(s: SceneState) {
  const parts = s.parts ? `${s.parts.length} of 10 parts installed` : "all parts installed";
  const flame = { burning: "flame burning", quench: "flame went out at low flow", blowoff: "flame blown off", dim: s.seek === "hidden" ? "a very faint flame somewhere" : "dim blue flame", none: "no flame" }[s.outcome];
  return `Drawing of NASA's BASS-II wind tunnel: ${parts}, airflow ${s.flow} cm/s${s.fanReversed ? " blowing the wrong way" : ""}, ${s.sampleLoose ? "sample loose, " : ""}${flame}.`;
}
