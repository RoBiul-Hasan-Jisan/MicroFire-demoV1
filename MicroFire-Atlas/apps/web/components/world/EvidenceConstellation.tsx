"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useExplorer } from "@/components/guide/EmberGuide";
import { DISCOVERIES } from "@/lib/guide";

const Y = (y: number) => 3 + y * 0.64; // discovery box (0-100) into the 100 x 70 map

/**
 * The evidence constellation: one star per discovery, in journey order, laid out as a flame. Lit stars are
 * things the child actually did; every star opens a real route or NASA record. The core glows brighter as the
 * trail fills in. The list below is the same map for keyboards, screen readers and small screens.
 */
export function EvidenceConstellation({ compact = false, list = true }: { compact?: boolean; list?: boolean }) {
  const { found } = useExplorer();
  const router = useRouter();
  const lit = new Set(found);
  const last = found[found.length - 1];
  const n = DISCOVERIES.length;
  const glow = found.length / n;
  return (
    <div>
      <svg viewBox="0 0 100 70" className="const-map" role="img" aria-label={`Evidence map shaped like a flame: ${found.length} of ${n} discoveries found`}>
        <defs>
          <radialGradient id="const-core" cx="0.5" cy="0.62" r="0.5">
            <stop offset="0" stopColor="#ffd27a" />
            <stop offset="0.5" stopColor="#f0a044" stopOpacity=".5" />
            <stop offset="1" stopColor="#f0a044" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="50" cy={Y(62)} rx="20" ry="22" fill="url(#const-core)" opacity={0.08 + glow * 0.6} />
        {DISCOVERIES.map((d, i) => {
          const a = DISCOVERIES[(i + n - 1) % n];
          const on = lit.has(a.id) && lit.has(d.id);
          return <line key={d.id} x1={a.x} y1={Y(a.y)} x2={d.x} y2={Y(d.y)} className={on ? "const-line-on" : "const-line"} />;
        })}
        {DISCOVERIES.map((d) => {
          const on = lit.has(d.id);
          return (
            <a
              key={d.id}
              href={d.href}
              className={`const-node ${on ? "const-node-on" : ""} ${d.id === last ? "const-node-last" : ""} const-${d.kind}`}
              onClick={(e) => {
                e.preventDefault();
                router.push(d.href);
              }}
            >
              <title>{`${d.label}${on ? " (found)" : " (not found yet)"}`}</title>
              <circle cx={d.x} cy={Y(d.y)} r={on ? 3 : 2.3} className="const-halo" />
              <circle cx={d.x} cy={Y(d.y)} r={on ? 1.3 : 1} className="const-core" />
              {d.kind === "gap" && <text x={d.x} y={Y(d.y) + 0.9} textAnchor="middle" className="const-q">?</text>}
              {!compact && (
                <text x={d.x} y={Y(d.y) + (d.y > 60 ? 6 : -4.2)} textAnchor={d.x > 60 ? "end" : d.x < 40 ? "start" : "middle"} className="const-label">
                  {d.label}
                </text>
              )}
            </a>
          );
        })}
      </svg>
      {list && (
        <ol className="mt-4 grid gap-x-6 gap-y-1.5 sm:grid-cols-2 text-[15px]">
          {DISCOVERIES.map((d) => (
            <li key={d.id} className="flex items-baseline gap-2">
              <span aria-hidden="true" className={lit.has(d.id) ? "text-flame" : "text-faint"}>{lit.has(d.id) ? "★" : "☆"}</span>
              <Link href={d.href} className={lit.has(d.id) ? "link" : "text-muted hover:text-ink"}>
                {d.label}
              </Link>
              <span className="sr-only">{lit.has(d.id) ? "found" : "not found yet"}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
