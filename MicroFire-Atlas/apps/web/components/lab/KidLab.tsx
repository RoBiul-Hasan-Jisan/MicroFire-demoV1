"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FlameShape } from "@/components/lab/FlameChamber";
import { CREW } from "@/lib/guide";
import { kidWords } from "@/lib/kid-words";
import { MISSIONS, missionsDone, nextMission } from "@/lib/kid-missions";
import { WORLDS, lookOf, type Fuel, type LabState, type VerdictKind, type WorldId } from "@/lib/lab-model";

/* Kid Explorer: an experiment logbook. Real numbers, real NASA footage, discoveries written into a log.
   No inline styles (strict CSP): numbers reach the DOM as SVG attributes, motion lives in kid.css. */

const KEY = "microfire-kid-missions-v1";
const AIR = [{ id: "thin", label: "Thin", sub: "16 %", v: 16 }, { id: "normal", label: "Normal", sub: "21 %", v: 21 }, { id: "rich", label: "Rich", sub: "30 %", v: 30 }];
const WIND = [{ id: "still", label: "Still", sub: "1 cm/s", v: 1 }, { id: "breeze", label: "Breeze", sub: "8 cm/s", v: 8 }, { id: "storm", label: "Storm", sub: "30 cm/s", v: 30 }];
const FUEL: { id: Fuel; label: string; sub: string; color: string }[] = [
  { id: "PMMA", label: "Plastic", sub: "PMMA", color: "#9fd8e6" },
  { id: "SIBAL fabric", label: "Cloth", sub: "cotton-fiberglass", color: "#d8c28a" },
  { id: "Nomex", label: "Fire-proof", sub: "Nomex", color: "#e0a93a" },
];
const SKY: Record<WorldId, [string, string]> = { earth: ["#16324f", "#7fa6c4"], moon: ["#05070f", "#161a2c"], mars: ["#3a1d24", "#b9724f"], micro: ["#050813", "#0d1830"] };
const GROUND: Record<WorldId, string> = { earth: "#2c4a3a", moon: "#8b90a0", mars: "#8c4a2c", micro: "#1b2540" };
const LIFT: Record<WorldId, number> = { earth: 3, moon: 1, mars: 2, micro: 0 };
const WORLD_FILL: Record<WorldId, [string, string]> = { earth: ["#3b82c4", "#4f9d69"], moon: ["#b9bdc9", "#8b90a0"], mars: ["#c8643a", "#8c4a2c"], micro: ["#0d1830", "#56d4e4"] };
const nearest = <T extends { v: number }>(arr: T[], v: number) => arr.reduce((a, b) => (Math.abs(b.v - v) < Math.abs(a.v - v) ? b : a));

export function KidLab({ st, patch: rawPatch, visited, verdict, onScience }: { st: LabState; patch: (p: Partial<LabState>, control?: string) => void; visited: string[]; verdict: VerdictKind; onScience: () => void }) {
  const patch = (p: Partial<LabState>, control?: string) => { setActed(true); rawPatch(p, control); };
  const [saved, setSaved] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [stamp, setStamp] = useState(0);
  const [cheer, setCheer] = useState<string | null>(null);
  const [acted, setActed] = useState(false);
  const cheerTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from storage
      if (raw) setSaved(JSON.parse(raw));
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch {}
  }, [saved, ready]);

  // Nothing is judged until the child changes something, so the log never opens with a finished entry.
  const done = useMemo(() => missionsDone({ st, visited: [...visited, st.world] }, saved, acted), [st, visited, saved, acted]);
  useEffect(() => {
    if (!ready) return;
    const fresh = done.filter((d) => !saved.includes(d));
    if (!fresh.length) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- log a finished mission
    setSaved((s) => [...s, ...fresh]);
    setStamp((b) => b + 1);
    setCheer(MISSIONS.find((m) => m.id === fresh[0])!.done);
    window.clearTimeout(cheerTimer.current);
    cheerTimer.current = window.setTimeout(() => setCheer(null), 5000);
  }, [done, saved, ready]);
  useEffect(() => () => window.clearTimeout(cheerTimer.current), []);

  const next = nextMission(done);
  const cheerCrew = cheer ? MISSIONS.find((m) => m.done === cheer)!.crew : null;
  const guide = CREW[cheerCrew ?? next?.crew ?? "tala"];
  const portrait = cheerCrew ? guide.poses.cheering : next ? guide.poses.pointing : CREW.tala.poses.cheering;
  const look = lookOf(st);
  const world = WORLDS.find((w) => w.id === st.world)!;
  const [sky1, sky2] = SKY[st.world];
  const lines = kidWords(st, verdict);
  const all = done.length === MISSIONS.length;
  const airSel = nearest(AIR, st.oxygen).id;
  const windSel = nearest(WIND, st.flow).id;
  const fuel = FUEL.find((f) => f.id === st.fuel)!;
  const lift = LIFT[st.world];

  return (
    <section id="lab-kid-adventure" className="kl" aria-label="Flame experiment logbook">
      <div className="kl-brief">
        {/* eslint-disable-next-line @next/next/no-img-element -- original illustrated cutout */}
        <img key={guide.name + (cheer ? "c" : "p")} src={portrait} alt="" className="kl-crew-img" decoding="async" />
        <div className="kl-say" aria-live="polite">
          <p className="kl-who">{guide.name}, {guide.job.split(":")[0].toLowerCase()}</p>
          {all ? (
            <p className="kl-mt">All seven experiments are in your log. You are a flame scientist.</p>
          ) : cheer ? (
            <p key={stamp} className="kl-mt kl-logged">Logged. {cheer}</p>
          ) : (
            <>
              <p className="kl-mt">{next!.title}</p>
              <p className="kl-line">{next!.ask}</p>
            </>
          )}
        </div>
        <p className="kl-count" aria-label={`${done.length} of ${MISSIONS.length} experiments logged`}><b>{done.length}</b>/{MISSIONS.length} logged</p>
      </div>

      <div className="kl-main">
        <figure className="kl-chamber">
          <svg viewBox="0 0 480 360" className="kl-svg" role="img" aria-label={`A flame in ${world.label} conditions: ${lines[0]}`}>
            <defs>
              <linearGradient id="klSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={sky1} /><stop offset="1" stopColor={sky2} /></linearGradient>
              <linearGradient id="klShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#050813" stopOpacity=".55" /><stop offset="1" stopColor="#050813" stopOpacity=".1" /></linearGradient>
              <clipPath id="klClip"><rect width="480" height="360" rx="10" /></clipPath>
            </defs>
            <g clipPath="url(#klClip)">
              <rect width="480" height="360" fill="url(#klSky)" />
              {st.world === "micro" && <><image href="/art/worlds/lab.webp" x="-60" y="0" width="640" height="360" preserveAspectRatio="xMidYMid slice" opacity=".55" /><rect width="480" height="360" fill="url(#klShade)" /></>}
              {st.world === "moon" && <><circle cx="402" cy="72" r="22" fill="#3d78b8" /><circle cx="402" cy="72" r="22" fill="none" stroke="#9fc8f0" strokeOpacity=".5" /></>}
              {st.world === "mars" && <circle cx="96" cy="84" r="12" fill="#e8c9a0" opacity=".8" />}
              {st.world === "earth" && <circle cx="408" cy="70" r="26" fill="#f4e3a6" opacity=".85" />}
              {st.world !== "micro" && <path d={`M0 292 Q130 ${st.world === "earth" ? 276 : 282} 250 292 T480 290 V360 H0Z`} fill={GROUND[st.world]} />}
              {st.world === "micro" && <rect x="0" y="318" width="480" height="42" fill="#0a1020" opacity=".85" />}

              {st.flow >= 5 && [96, 148, 200, 252].map((y, i) => <path key={y} d={`M-20 ${y} q60 -12 120 0 t120 0 t120 0 t120 0`} fill="none" stroke="#d6e4ff" strokeOpacity=".55" strokeWidth={st.flow >= 20 ? 3.5 : 1.8} strokeLinecap="round" className={`kl-wind lab-d${i}`} />)}

              {Array.from({ length: lift }, (_, i) => (
                <path key={i} d={`M410 ${250 - i * 44} l12 -14 l12 14`} fill="none" stroke="#f0a044" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={`kl-lift lab-d${i}`} />
              ))}
              <text x="422" y={st.world === "micro" ? 262 : 292} textAnchor="middle" fontSize="12" fill="#d6dcec" className="kl-svg-t">{lift ? "hot air lifts" : "nothing lifts hot air"}</text>

              <g transform="translate(240 300)">
                <rect x="-74" y="0" width="148" height="12" rx="3" fill={fuel.color} />
                <g className={`kid-pose kid-pose-${st.world}`}>
                  <FlameShape look={{ g: look.g, size: look.size, lean: look.lean, intensity: 1, quench: false }} base={70} />
                </g>
              </g>
              <rect x="10" y="10" width="460" height="340" rx="8" fill="none" stroke="#56d4e4" strokeOpacity=".35" />
              {[[10, 10, 1, 1], [470, 10, -1, 1], [10, 350, 1, -1], [470, 350, -1, -1]].map(([x, y, a, b]) => <path key={`${x}${y}`} d={`M${x + a * 18} ${y} H${x} V${y + b * 18}`} fill="none" stroke="#56d4e4" strokeWidth="3" />)}
            </g>
          </svg>
          <figcaption className="kl-read">
            <span><i>Gravity</i><b>{world.gLabel}</b></span>
            <span><i>Oxygen</i><b>{st.oxygen} %</b></span>
            <span><i>Airflow</i><b>{st.flow} cm/s</b></span>
            <span><i>Burning</i><b>{fuel.label}</b></span>
          </figcaption>
        </figure>

        <div className="kl-panel">
          <Pick title="Where is the flame?" opts={WORLDS.map((w) => ({ id: w.id, label: w.label, sub: w.gLabel, icon: <WorldDot id={w.id} /> }))} sel={st.world} onPick={(id) => patch({ world: id as WorldId }, "gravity")} />
          <Pick title="How much oxygen is in the air?" opts={AIR.map((a, i) => ({ ...a, icon: <Bars n={i + 1} /> }))} sel={airSel} onPick={(id) => patch({ oxygen: AIR.find((a) => a.id === id)!.v }, "oxygen")} />
          <Pick title="How strong is the wind?" opts={WIND.map((a, i) => ({ ...a, icon: <Wave amp={i * 4} /> }))} sel={windSel} onPick={(id) => patch({ flow: WIND.find((a) => a.id === id)!.v }, "airflow")} />
          <Pick title="What is burning?" opts={FUEL.map((f) => ({ ...f, icon: <Swatch color={f.color} /> }))} sel={st.fuel} onPick={(id) => patch({ fuel: id as Fuel }, "fuel")} />
        </div>
      </div>

      <div className="kl-compare">
        <figure className="kl-real">
          {/* eslint-disable-next-line @next/next/no-img-element -- local NASA footage still */}
          <img src="/media/saffire-vi-pmma/poster.jpg" alt="A real flame filmed by NASA on a spacecraft" decoding="async" loading="lazy" />
          <figcaption>A real flame, filmed by NASA in space (Saffire-VI). The drawing above is only a sketch of the idea.</figcaption>
        </figure>
        <div className="kl-why">
          <h3 className="kl-h">Why does the flame look like this?</h3>
          <ul>{lines.map((l) => <li key={l}>{l}</li>)}</ul>
          <p className="kl-warn">Real fire is not a toy. Never try this at home: NASA experts do it in sealed, safe test chambers.</p>
        </div>
      </div>

      <div className="kl-logbook">
        <h3 className="kl-h">Your experiment log</h3>
        <ol className="kl-log">
          {MISSIONS.map((m, i) => {
            const on = done.includes(m.id);
            return (
              <li key={m.id} className={on ? "kl-log-on" : ""}>
                <span className="kl-patch" aria-hidden="true">{on ? <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg> : i + 1}</span>
                <span className="kl-log-t"><b>{m.title}</b><span>{on ? m.done : m.ask}</span></span>
              </li>
            );
          })}
        </ol>
      </div>
      <button className="kid-btn kid-btn-ghost kl-sci" onClick={onScience}>Ready for the real NASA data? Open Scientist mode</button>
    </section>
  );
}

function WorldDot({ id }: { id: WorldId }) {
  const [a, b] = WORLD_FILL[id];
  return (
    <svg viewBox="0 0 32 32" className="kl-ico"><circle cx="16" cy="16" r="12" fill={a} />{id !== "micro" && <path d="M6 20q6-5 10-1t10-3a12 12 0 01-20 4z" fill={b} opacity=".8" />}{id === "micro" && <ellipse cx="16" cy="16" rx="15" ry="5" fill="none" stroke={b} strokeWidth="1.8" transform="rotate(-20 16 16)" />}</svg>
  );
}
const Bars = ({ n }: { n: number }) => <svg viewBox="0 0 32 32" className="kl-ico">{[0, 1, 2].map((i) => <rect key={i} x={5 + i * 8} y={24 - (i + 1) * 6} width="6" height={(i + 1) * 6} rx="1.5" fill={i < n ? "#f0a044" : "#2c3a58"} />)}</svg>;
const Wave = ({ amp }: { amp: number }) => <svg viewBox="0 0 32 32" className="kl-ico"><path d={`M3 16 q6.5 -${amp} 13 0 t13 0`} fill="none" stroke="#d6e4ff" strokeWidth="2.6" strokeLinecap="round" /></svg>;
const Swatch = ({ color }: { color: string }) => <svg viewBox="0 0 32 32" className="kl-ico"><rect x="4" y="10" width="24" height="12" rx="2" fill={color} /></svg>;

function Pick({ title, opts, sel, onPick }: { title: string; opts: { id: string; label: string; sub: string; icon: ReactNode }[]; sel: string; onPick: (id: string) => void }) {
  return (
    <fieldset className="kl-pick">
      <legend className="kl-legend">{title}</legend>
      <div className="kl-opts" role="group" aria-label={title}>
        {opts.map((o) => (
          <button key={o.id} className={`kl-opt ${sel === o.id ? "kl-opt-on" : ""}`} aria-pressed={sel === o.id} onClick={() => onPick(o.id)}>
            {o.icon}
            <span className="kl-opt-l">{o.label}</span>
            <span className="kl-opt-s">{o.sub}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
