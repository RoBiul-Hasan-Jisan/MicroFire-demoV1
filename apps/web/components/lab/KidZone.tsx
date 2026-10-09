"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlameShape, useSmooth } from "@/components/lab/FlameChamber";
import { useSound } from "@/components/game/sound";
import { WORLDS, type WorldId } from "@/lib/lab-model";
import { BUDDY_LOW, BUDDY_SAYS, KID_FRESH, QUIZ, STICKERS, stickersOf, type KidSave } from "@/lib/kid-play";

/* Air-supply challenge, field check and mission patches. No inline styles (strict CSP):
   numbers go to SVG attributes, motion lives in kid.css. */

const KEY = "microfire-kid-v1";
const GROUND: Record<WorldId, string> = { earth: "#2c4a3a", moon: "#8b90a0", mars: "#8c4a2c", micro: "none" };
const RISE = [-44, -22, -6, 14, 32, -34];
const MOTES = [[-120, -70], [110, -100], [-140, -10], [140, -40], [-70, -150], [70, -170]];
const STARS = [[30, 30], [90, 70], [300, 40], [330, 110], [60, 160], [260, 150], [200, 22], [150, 100]];
const PATCH_ICON: Record<string, string> = {
  hopper: "M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18",
  air: "M3 9h11a3 3 0 10-3-3M3 15h15a3 3 0 11-3 3M3 12h8",
  quiz: "M5 4h14v16H5zM9 9h6M9 13h6M9 17h3",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  super: "M12 3c3 4 5 6 5 10a5 5 0 01-10 0c0-2 1-3 2-4 .5 2 1.5 2.5 2.5 2.5C11 9 11 6 12 3z",
};

export function KidZone({ world, onWorld }: { world: WorldId; onWorld: (w: WorldId) => void }) {
  const { on, setOn, play } = useSound();
  const [save, setSave] = useState<KidSave>(KID_FRESH);
  const [ready, setReady] = useState(false);
  const [air, setAir] = useState(100);
  const [streak, setStreak] = useState(0);
  const [puffKey, setPuffKey] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const airRef = useRef(100);
  const streakRef = useRef(0);
  const toastTimer = useRef<number | undefined>(undefined);
  const prevStickers = useRef<string[] | null>(null);
  const micro = world === "micro";

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from storage
      if (raw) setSave({ ...KID_FRESH, ...JSON.parse(raw) });
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify(save)); } catch {}
  }, [save, ready]);

  /* remember which worlds have been visited */
  useEffect(() => {
    if (!ready) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- record the visit
    setSave((s) => (s.worlds.includes(world) ? s : { ...s, worlds: [...s.worlds, world] }));
  }, [world, ready]);

  /* the air challenge: in orbit the air around the flame is used up, so you keep blowing; on a planet it arrives by itself */
  useEffect(() => {
    const drain = window.setInterval(() => {
      const next = micro ? Math.max(0, airRef.current - 1.2) : Math.min(100, airRef.current + 4);
      airRef.current = next;
      setAir(next);
    }, 100);
    const second = window.setInterval(() => {
      if (micro && airRef.current > 15) {
        const n = streakRef.current + 1;
        streakRef.current = n;
        setStreak(n);
        setSave((s) => (n > s.bestStreak ? { ...s, bestStreak: n } : s));
      } else {
        streakRef.current = 0;
        setStreak(0);
      }
    }, 1000);
    return () => { window.clearInterval(drain); window.clearInterval(second); };
  }, [micro]);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const puff = () => {
    airRef.current = Math.min(100, airRef.current + 30);
    setAir(airRef.current);
    setPuffKey((k) => k + 1);
    play("whoosh");
  };
  const finishQuiz = useCallback((score: number) => {
    setSave((s) => ({ ...s, quizDone: true, quizBest: Math.max(s.quizBest, score) }));
  }, []);

  const earned = useMemo(() => stickersOf(save), [save]);
  useEffect(() => {
    if (!ready) return;
    if (prevStickers.current == null) { prevStickers.current = earned; return; }
    const fresh = earned.filter((e) => !prevStickers.current!.includes(e));
    prevStickers.current = earned;
    if (fresh.length) {
      const s = STICKERS.find((x) => x.id === fresh[0])!;
      setMsg(`New patch: ${s.name}`);
      play("fanfare");
      window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setMsg(null), 3500);
    }
  }, [earned, ready, play]);

  const low = micro && air <= 15;
  const target = [world === "earth" ? 1 : world === "moon" ? 0.17 : world === "mars" ? 0.38 : 0, micro ? 0.4 + 0.6 * (air / 100) : 1, micro ? 210 : 262];
  const [g, k, y0] = useSmooth(target, 0.12);
  const says = low ? BUDDY_LOW : BUDDY_SAYS[world];
  const label = WORLDS.find((w) => w.id === world)!.label;

  return (
    <section id="lab-kids" className="lab-section kid-zone" aria-labelledby="kid-h">
      <h2 id="kid-h" className="display lab-h2">Air-supply challenge</h2>
      <p className="lab-sub max-w-[70ch]">
        On Earth, hot air rises and brings fresh air to a flame. In orbit it does not, so astronauts have to move air to the flame themselves. Take the flame to orbit and keep it alive. It is a drawing, and real fire is never a toy.
      </p>

      <div className="kid-grid">
        <div className="kid-stage">
          <svg viewBox="0 0 360 320" className="kid-svg" role="img" aria-label={`A flame in ${label} conditions. ${says}`}>
            <rect width="360" height="320" fill="#0a1224" />
            {STARS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 3 ? 1.4 : 2.2} fill="#d6e4ff" className={`kid-twinkle lab-d${i % 5}`} />)}
            {micro
              ? <rect x="26" y="26" width="308" height="268" rx="6" fill="none" stroke="#56d4e4" strokeOpacity=".35" strokeWidth="2" strokeDasharray="4 10" />
              : <><rect x="0" y="262" width="360" height="58" fill={GROUND[world]} /><ellipse cx="180" cy="266" rx="70" ry="5" fill="#000" opacity=".3" /></>}
            <g transform={`translate(180 ${y0.toFixed(1)})`}>
              {k > 0.3 && (g > 0.05
                ? RISE.map((x, i) => <circle key={i} cx={x * (0.6 + g * 0.6)} cy="-20" r={i % 3 ? 2.2 : 3} fill={i % 2 ? "#ffd27a" : "#f0a044"} className={`lab-rise ${g > 0.5 ? "lab-rise-f" : "lab-rise-s"} lab-d${i % 5}`} />)
                : MOTES.map(([x, y], i) => <circle key={i} cx={x * 0.8} cy={y * 0.8} r={i % 3 ? 2 : 3} fill="#a9c1ff" className={`lab-mote lab-d${i % 5}`} />))}
              <g className={`kid-pose kid-pose-${world}`}>
                <FlameShape look={{ g, size: 1, lean: 0, intensity: k, quench: false }} base={62} />
              </g>
            </g>
            {puffKey > 0 && (
              <g key={puffKey} className="kid-puff" aria-hidden="true">
                {[150, 190, 230].map((y) => <path key={y} d={`M10 ${y} q40 -16 80 0 t80 0`} fill="none" stroke="#56d4e4" strokeWidth="3" strokeLinecap="round" />)}
              </g>
            )}
          </svg>
          <p className="kid-bubble" aria-live="polite">{says}</p>
        </div>

        <div className="kid-side">
          <div>
            <p className="lab-label">Where is the flame?</p>
            <div className="kid-worlds" role="group" aria-label="Choose a world">
              {WORLDS.map((w) => (
                <button key={w.id} className={`kid-btn kid-btn-world ${world === w.id ? "kid-btn-on" : ""}`} aria-pressed={world === w.id} onClick={() => { onWorld(w.id); play("snap"); }}>
                  {w.label} <span className="kid-g">{w.gLabel}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="kid-air">
            <p className="lab-label">{micro ? "Air around the flame" : "Air around the flame (on a planet it arrives by itself)"}</p>
            <svg viewBox="0 0 200 22" className="kid-meter" aria-hidden="true">
              <rect width="200" height="14" rx="3" fill="#121b30" stroke="#2c3a58" />
              <rect width={Math.max(0, air * 2)} height="14" rx="3" fill={air > 40 ? "#56d4e4" : air > 15 ? "#f0a044" : "#ff6a6a"} />
              <path d="M30 0v18" stroke="#e6eaf2" strokeWidth="1.5" />
              <text x="30" y="21.5" fontSize="5.5" textAnchor="middle" fill="#a6b0c6">goes out</text>
            </svg>
            <button className="kid-btn kid-btn-puff" onClick={puff}>Blow air in</button>
            <p className="kid-streak">{micro ? `Alive for ${streak} s. Best: ${save.bestStreak} s. Reach 20 s for a patch.` : "Switch to Orbit to start the challenge."}</p>
          </div>

          <div className="kid-row">
            <button className="kid-btn kid-btn-ghost" aria-pressed={on} onClick={() => setOn(!on)}>{on ? "Sound on" : "Sound off"}</button>
          </div>
        </div>
      </div>

      <Quiz onDone={finishQuiz} play={play} />

      <div className="kid-stickers-wrap">
        <h3 className="lab-h">Mission patches</h3>
        <ul className="kid-stickers">
          {STICKERS.map((s) => {
            const got = earned.includes(s.id);
            return (
              <li key={s.id} className={`kid-sticker ${got ? "kid-sticker-on" : ""}`}>
                <svg viewBox="0 0 24 24" className="kid-patch" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray={got ? "0" : "2 2"} /><path d={PATCH_ICON[s.id]} transform="translate(4.8 4.8) scale(.6)" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <span className="kid-sticker-n">{s.name}</span>
                <span className="kid-sticker-h">{got ? "Earned" : s.how}</span>
              </li>
            );
          })}
        </ul>
        {msg && <p className="kid-toast" role="status">{msg}</p>}
      </div>
    </section>
  );
}

function Quiz({ onDone, play }: { onDone: (score: number) => void; play: (k: "right" | "wrong" | "fanfare" | "snap") => void }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const q = QUIZ[i];

  const pick = (n: number) => {
    if (picked != null) return;
    setPicked(n);
    if (n === q.answer) { setScore((s) => s + 1); play("right"); } else play("wrong");
  };
  const next = () => {
    if (i + 1 >= QUIZ.length) { setDone(true); onDone(score); play("fanfare"); return; }
    setI(i + 1);
    setPicked(null);
  };
  const again = () => { setI(0); setPicked(null); setScore(0); setDone(false); };

  return (
    <div className="kid-quiz">
      <h3 className="lab-h">Field check</h3>
      {done ? (
        <div role="status">
          <p className="kid-q">{score === QUIZ.length ? "Perfect score. You read the flame like a scientist." : `You got ${score} of ${QUIZ.length}. Read the explanations and try again.`}</p>
          <button className="kid-btn" onClick={again}>Try again</button>
        </div>
      ) : (
        <>
          <p className="kid-qn">Question {i + 1} of {QUIZ.length}</p>
          <p className="kid-q">{q.q}</p>
          <div className="kid-opts">
            {q.options.map((o, n) => (
              <button key={o} className={`kid-opt ${picked != null && n === q.answer ? "kid-opt-right" : ""} ${picked === n && n !== q.answer ? "kid-opt-wrong" : ""}`} onClick={() => pick(n)} disabled={picked != null}>{o}</button>
            ))}
          </div>
          {picked != null && (
            <div role="status" className="kid-why">
              <p><b>{picked === q.answer ? "Correct." : "Not quite."}</b> {q.why}</p>
              <button className="kid-btn mt-3" onClick={next}>{i + 1 >= QUIZ.length ? "See my score" : "Next question"}</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
