import { ATMOSPHERES } from "@/lib/atmospheres";
import type { EvidenceRecord } from "@/lib/ontology";

const W = 640, H = 360, L = 56, R = 20, T = 20, B = 48;
const P0 = 50, P1 = 105, O0 = 14, O1 = 36;
const x = (kpa: number) => L + ((kpa - P0) / (P1 - P0)) * (W - L - R);
const y = (o2: number) => H - B - ((o2 - O0) / (O1 - O0)) * (H - T - B);

/**
 * Every test with both pressure and oxygen recorded, on one atmosphere map, with NASA's two studied
 * exploration atmosphere marked. Shows how close (and how far) the evidence gets to habitat air.
 * Server-rendered SVG: attributes only, so the strict CSP holds.
 */
export function AtmosphereMap({ records }: { records: EvidenceRecord[] }) {
  const pts = records.filter((r) => r.pressureKpa && r.oxygen != null);
  // both NASA exploration-atmosphere scenarios, from lib/atmospheres (each cited there)
  const rings = ATMOSPHERES.filter((a) => a.id === "ea-a" || a.id === "ea-alt").map((a) => ({ ...a, kpa: a.kpa!, o2: a.o2! }));
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`Oxygen against pressure for ${pts.length} NASA tests. Two NASA exploration-atmosphere scenarios are marked: 34 % oxygen at 56.5 kPa and 28.5 % at 66.2 kPa. The closest tests are Saffire VI near 55 kPa and 29 to 31 % oxygen.`}>
        <rect x={L} y={T} width={W - L - R} height={H - T - B} rx="10" fill="#0a1222" stroke="#1e2940" />
        {[60, 70, 80, 90, 100].map((k) => (
          <g key={k}>
            <line x1={x(k)} x2={x(k)} y1={T} y2={H - B} stroke="#1e2940" />
            <text x={x(k)} y={H - B + 18} textAnchor="middle" fill="#8f9ab1" fontSize="12">{k}</text>
          </g>
        ))}
        {[15, 20, 25, 30, 35].map((o) => (
          <g key={o}>
            <line x1={L} x2={W - R} y1={y(o)} y2={y(o)} stroke="#1e2940" />
            <text x={L - 10} y={y(o) + 4} textAnchor="end" fill="#8f9ab1" fontSize="12">{o}</text>
          </g>
        ))}
        <text x={(L + W - R) / 2} y={H - 8} textAnchor="middle" fill="#8f9ab1" fontSize="12">Pressure, kPa (sea level is about 101)</text>
        <text x={14} y={(T + H - B) / 2} textAnchor="middle" fill="#8f9ab1" fontSize="12" transform={`rotate(-90 14 ${(T + H - B) / 2})`}>Oxygen, %</text>

        {rings.map((a, i) => (
          <g key={a.id}>
            <circle cx={x(a.kpa)} cy={y(a.o2)} r="22" fill={i ? "#c7b8ff12" : "#ffcf6b14"} stroke={i ? "#c7b8ff" : "#ffcf6b"} strokeDasharray="4 5" />
            <circle cx={x(a.kpa)} cy={y(a.o2)} r="4" fill={i ? "#c7b8ff" : "#ffcf6b"} />
            <text x={x(a.kpa) + 30} y={y(a.o2) + (i ? 18 : -6)} fill={i ? "#ddd4ff" : "#ffe2ac"} fontSize="13" fontWeight="700">{i ? "Alternate atmosphere" : "Exploration atmosphere A"} ({a.o2} %, {a.kpa} kPa)</text>
          </g>
        ))}

        {pts.map((r) => {
          const p = (r.pressureKpa![0] + r.pressureKpa![1]) / 2;
          const saffire = r.family === "saffire", luci = r.family === "luci";
          return (
            <circle key={r.id} cx={x(p)} cy={y(r.oxygen!)} r={saffire || luci ? 7 : 4.5} fill={luci ? "#c7b8ff" : saffire ? "#ffcf6b" : "#56d4e4"} fillOpacity={saffire || luci ? 0.95 : 0.55} stroke="#070b16" strokeWidth="1.5">
              <title>{`${r.label}: ${r.oxygen} % O₂ at ${p} kPa`}</title>
            </circle>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
        <span><i className="inline-block w-3 h-3 rounded-full bg-[#ffcf6b] align-middle mr-2" />Saffire run</span>
        <span><i className="inline-block w-3 h-3 rounded-full bg-[#56d4e4] opacity-60 align-middle mr-2" />BASS-II test</span>
        <span><i className="inline-block w-3 h-3 rounded-full bg-[#c7b8ff] align-middle mr-2" />LUCI burn (simulated lunar gravity)</span>
        <span>Dashed rings: two NASA exploration-atmosphere scenarios (not tests, and not a universal Moon-base specification)</span>
      </figcaption>
    </figure>
  );
}
