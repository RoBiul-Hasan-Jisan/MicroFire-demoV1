"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* Game-style space backdrop.
   - Layers drift with the pointer (parallax): far stars < planets < clouds < platforms.
   - interactive: an astronaut you can move. Hop between rocks with ← → (or A / D), tap a rock,
     jump with Space / ↑ / tap the astronaut, and collect the stars. */

const SPARKLES: [number, number, number, number][] = [
  [180, 150, 14, 0], [420, 90, 10, 1.2], [760, 60, 12, 0.6], [1010, 130, 9, 2], [1180, 300, 12, 0.3],
  [90, 430, 10, 1.6], [560, 250, 8, 0.9], [1330, 520, 11, 2.2], [300, 600, 8, 1.1], [980, 560, 9, 0.4],
];
const DOTS: [number, number, number][] = [
  [60, 80, 2], [240, 40, 2], [340, 300, 3], [640, 140, 2], [900, 40, 2], [1100, 70, 3], [1280, 150, 2],
  [1450, 260, 2], [1520, 60, 3], [200, 330, 2], [480, 480, 2], [820, 330, 3], [1250, 420, 2], [1500, 480, 2],
  [120, 560, 3], [700, 520, 2], [1060, 440, 2], [1400, 380, 3],
];

/* where the astronaut stands on each rock, in the 1600x900 scene */
const STAND: [number, number][] = [[230, 712], [835, 702], [1400, 724]];
const STAR_POS: Record<string, [number, number]> = {
  "up-0": [230, 590], "up-1": [835, 580], "up-2": [1400, 600],
  "mid-0": [532, 520], "mid-1": [1117, 525],
};
const ALL_STARS = Object.keys(STAR_POS);

type Mood = "idle" | "happy" | "sleep" | "dizzy" | "shock";
/** pos / dur are class keys (see game-ui.css): the project CSP forbids inline style attributes. */
type Ufo = { pos: string; beam: boolean; star: string | null; dur: "0" | "07" | "14" | "18" };
const rankFor = (n: number) => (n < 5 ? "Space Rookie" : n < 15 ? "Star Nibbler" : n < 30 ? "Galaxy Goblin" : "Cosmic Legend");

const sparklePath = (s: number) =>
  `M0 ${-s} L${s * 0.28} ${-s * 0.28} L${s} 0 L${s * 0.28} ${s * 0.28} L0 ${s} L${-s * 0.28} ${s * 0.28} L${-s} 0 L${-s * 0.28} ${-s * 0.28} Z`;

export function SpaceBg({ interactive = false, onSfx }: { interactive?: boolean; onSfx?: (k: "whoosh" | "right" | "fanfare" | "snap") => void }) {
  const root = useRef<HTMLDivElement>(null);

  /* ---------- pointer parallax (smoothed, skipped for reduced motion) ---------- */
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = { x: 0, y: 0 };
    const c = { x: 0, y: 0 };
    let raf = 0;
    const move = (e: PointerEvent) => {
      t.x = (e.clientX / window.innerWidth - 0.5) * 2;
      t.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    const tick = () => {
      c.x += (t.x - c.x) * 0.06;
      c.y += (t.y - c.y) * 0.06;
      root.current?.style.setProperty("--px", c.x.toFixed(3));
      root.current?.style.setProperty("--py", c.y.toFixed(3));
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", move, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => { window.removeEventListener("pointermove", move); cancelAnimationFrame(raf); };
  }, []);

  /* ---------- camera: on tall / narrow screens, show a window of the scene that follows the astronaut ---------- */
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let cam = -1;
    const tick = () => {
      const el = root.current;
      if (el && el.clientWidth && el.clientHeight) {
        const visW = Math.min(1600, 900 * (el.clientWidth / el.clientHeight));
        const max = 1600 - visW;
        const want = interactive ? STAND[idxRef.current][0] - visW / 2 : max / 2;
        const t = Math.max(0, Math.min(max, want));
        cam = cam < 0 || reduce ? t : cam + (t - cam) * 0.08;
        const vb = `${cam.toFixed(1)} 0 ${visW.toFixed(1)} 900`;
        el.querySelectorAll("svg.gx-bg-svg").forEach((svg) => svg.setAttribute("viewBox", vb));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [interactive]);

  /* ---------- astronaut ---------- */
  const [idx, setIdx] = useState(0);
  const [look, setLook] = useState<1 | -1>(1);
  const [motion, setMotion] = useState<{ kind: "hop" | "jump" | "flip" | "wobble"; n: number } | null>(null);
  const [moving, setMoving] = useState(false);
  const [mood, setMoodState] = useState<Mood>("idle");
  const [say, setSay] = useState<{ text: string; n: number } | null>(null);
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number }[]>([]);
  const [got, setGot] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [ufo, setUfo] = useState<Ufo | null>(null);
  const [stolen, setStolen] = useState<string | null>(null);
  const idxRef = useRef(0);
  const gotRef = useRef<string[]>([]);
  const stolenRef = useRef<string | null>(null);
  const moodRef = useRef<Mood>("idle");
  const pokes = useRef(0);
  const flips = useRef<number[]>([]);
  const lastInput = useRef(Date.now());
  const idleFlags = useRef({ hic: false, quirk: false });
  const ufoBusy = useRef(false);
  const ufoTimers = useRef<number[]>([]);
  const nextRaid = useRef<(() => void) | null>(null);
  const timers = useRef<{ move?: number; mood?: number; say?: number }>({});
  const sfx = useRef(onSfx);
  sfx.current = onSfx;

  const talk = useCallback((lines: string[], ms = 1600) => {
    const text = lines[Math.floor(Math.random() * lines.length)];
    setSay((c) => ({ text, n: (c?.n ?? 0) + 1 }));
    window.clearTimeout(timers.current.say);
    timers.current.say = window.setTimeout(() => setSay(null), ms);
  }, []);
  const setMood = useCallback((m: Mood, ms?: number) => {
    moodRef.current = m;
    setMoodState(m);
    window.clearTimeout(timers.current.mood);
    if (ms) timers.current.mood = window.setTimeout(() => { moodRef.current = "idle"; setMoodState("idle"); }, ms);
  }, []);
  const boost = useCallback(() => {
    setMoving(true);
    window.clearTimeout(timers.current.move);
    timers.current.move = window.setTimeout(() => setMoving(false), 650);
  }, []);
  const pop = useCallback((x: number, y: number) => {
    const id = Date.now() + Math.random();
    setBursts((b) => [...b, { id, x, y }]);
    window.setTimeout(() => setBursts((b) => b.filter((q) => q.id !== id)), 900);
  }, []);
  const later = useCallback((fn: () => void, ms: number) => { ufoTimers.current.push(window.setTimeout(fn, ms)); }, []);
  const touch = useCallback(() => {
    lastInput.current = Date.now();
    idleFlags.current = { hic: false, quirk: false };
    if (moodRef.current === "sleep") { setMood("shock", 900); talk(["WAH! I'm up! I'm up!", "Five more minutes…"]); }
  }, [setMood, talk]);

  useEffect(() => () => {
    const t = timers.current;
    window.clearTimeout(t.move); window.clearTimeout(t.mood); window.clearTimeout(t.say);
    ufoTimers.current.forEach((id) => window.clearTimeout(id));
  }, []);

  const collect = useCallback((keys: string[]) => {
    const fresh = keys.filter((k) => !gotRef.current.includes(k) && k !== stolenRef.current);
    if (!fresh.length) return;
    const next = [...gotRef.current, ...fresh];
    gotRef.current = next;
    setGot(next);
    setTotal((n) => n + fresh.length);
    fresh.forEach((k) => pop(STAR_POS[k][0], STAR_POS[k][1]));
    setMood("happy", 1400);
    if (next.length >= ALL_STARS.length) {
      talk(["STAR PARTY! 🎉", "I'm RICH! (in stars)"], 2000);
      sfx.current?.("fanfare");
      STAND.forEach(([x, y]) => pop(x, y - 120));
      window.setTimeout(() => { gotRef.current = []; setGot([]); }, 1800);
    } else {
      talk(["Yay! ⭐", "Got it!", "Sparkly!", "Mine! Hehe", "Om nom nom ⭐"]);
      sfx.current?.("right");
    }
  }, [pop, setMood, talk]);

  const hopTo = useCallback((j: number) => {
    touch();
    const from = idxRef.current;
    if (j === from || j < 0 || j > 2) { if (j < 0 || j > 2) talk(["Nothing there but space!", "That's the edge!"]); return; }
    setLook(j > from ? 1 : -1);
    const mids: string[] = [];
    for (let m = Math.min(from, j); m < Math.max(from, j); m++) mids.push(`mid-${m}`);
    idxRef.current = j;
    setIdx(j);
    setMotion((m) => ({ kind: "hop", n: (m?.n ?? 0) + 1 }));
    boost();
    sfx.current?.("whoosh");
    if (mids.length) window.setTimeout(() => collect(mids), 300);
    else talk(["Wheee!", "Boing!", "Zoom!"]);
  }, [boost, collect, talk, touch]);

  const jump = useCallback((kind: "jump" | "flip" = "jump") => {
    touch();
    setMotion((m) => ({ kind, n: (m?.n ?? 0) + 1 }));
    boost();
    if (kind === "flip") {
      sfx.current?.("snap");
      const now = Date.now();
      flips.current = [...flips.current.filter((t) => now - t < 6000), now];
      if (flips.current.length >= 3) {
        flips.current = [];
        window.setTimeout(() => {
          setMotion((m) => ({ kind: "wobble", n: (m?.n ?? 0) + 1 }));
          setMood("dizzy", 2800);
          talk(["Whoa… the room is spinning 🌀", "I see two of you…"], 2400);
        }, 750);
      } else talk(["Wheee! 🌀", "Flip!", "Ta-da!", "Nailed it!"]);
    }
    collect([`up-${idxRef.current}`]);
  }, [boost, collect, setMood, talk, touch]);

  const poke = useCallback(() => {
    pokes.current += 1;
    const had = gotRef.current.includes(`up-${idxRef.current}`);
    if (pokes.current % 3 === 0) jump("flip");
    else {
      jump("jump");
      if (had) talk(["Hehe, that tickles!", "Boop!", "Hi hi!", "Stop it, I'm ticklish!"]);
    }
  }, [jump, talk]);

  /* shoo the UFO and rescue the star */
  const scare = useCallback(() => {
    if (!ufoBusy.current) return;
    touch();
    ufoTimers.current.forEach((id) => window.clearTimeout(id));
    ufoTimers.current = [];
    const s = stolenRef.current;
    if (s) { stolenRef.current = null; setStolen(null); pop(STAR_POS[s][0], STAR_POS[s][1]); }
    setUfo((u) => (u ? { ...u, beam: false, star: null, dur: "07", pos: "flee" } : u));
    setMood("happy", 1500);
    talk(["Haha! Take that, alien!", "Shoo! Shoo!", "Nobody steals MY stars!"], 1900);
    sfx.current?.("right");
    later(() => { setUfo(null); ufoBusy.current = false; nextRaid.current?.(); }, 1200);
  }, [later, pop, setMood, talk, touch]);

  /* a cheeky UFO sometimes tries to steal a star: tap it to shoo it away */
  useEffect(() => {
    if (!interactive) return;
    let id = 0;
    const schedule = () => { id = window.setTimeout(raid, 11000 + Math.random() * 9000); };
    const raid = () => {
      const free = ALL_STARS.filter((k) => !gotRef.current.includes(k));
      if (!free.length || ufoBusy.current || document.hidden) { schedule(); return; }
      const star = free[Math.floor(Math.random() * free.length)];
      const [tx, ty] = STAR_POS[star];
      const sIdx = ALL_STARS.indexOf(star);
      ufoBusy.current = true;
      setUfo({ pos: "in", beam: false, star: null, dur: "0" });
      later(() => setUfo({ pos: `s${sIdx}`, beam: false, star: null, dur: "14" }), 60);
      later(() => setUfo((u) => (u ? { ...u, beam: true } : u)), 1600);
      later(() => {
        if (gotRef.current.includes(star)) { talk(["Too slow, alien! 😎"]); setUfo((u) => (u ? { ...u, beam: false } : u)); return; }
        stolenRef.current = star;
        setStolen(star);
        setUfo((u) => (u ? { ...u, star } : u));
        setMood("shock", 1700);
        talk(["HEY! That's MY star! 😱", "Alien! Give it back!"], 2000);
      }, 2500);
      later(() => setUfo((u) => (u ? { ...u, beam: false, pos: "out", dur: "18" } : u)), 3400);
      later(() => { setUfo(null); ufoBusy.current = false; }, 5300);
      later(() => {
        if (stolenRef.current === star) {
          stolenRef.current = null;
          setStolen(null);
          pop(tx, ty);
          setMood("happy", 1400);
          talk(["It came back! Aliens 0, Me 1", "Eww, it smells like cheese"], 2000);
        }
        nextRaid.current?.();
      }, 9500);
    };
    nextRaid.current = schedule;
    schedule();
    return () => { window.clearTimeout(id); nextRaid.current = null; ufoTimers.current.forEach((t) => window.clearTimeout(t)); ufoTimers.current = []; ufoBusy.current = false; };
  }, [interactive, later, pop, setMood, talk]);

  /* idle antics: hiccups, daydreams, then a nap */
  useEffect(() => {
    if (!interactive) return;
    const id = window.setInterval(() => {
      if (document.hidden || moodRef.current === "sleep" || ufoBusy.current) return;
      const idle = (Date.now() - lastInput.current) / 1000;
      const f = idleFlags.current;
      if (idle >= 4 && !f.hic) {
        f.hic = true;
        setMotion((m) => ({ kind: "jump", n: (m?.n ?? 0) + 1 }));
        talk(["*hic!*", "*hic!* Oops!"]);
      } else if (idle >= 7 && !f.quirk) {
        f.quirk = true;
        setLook((l) => (l === 1 ? -1 : 1));
        talk(["Is this thing on?", "I wonder if space has Wi-Fi…", "Do aliens like pizza? 🍕", "*whistles*"], 2200);
      } else if (idle >= 11) {
        setMood("sleep");
        setSay(null);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [interactive, setMood, talk]);

  useEffect(() => {
    if (!interactive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      const k = e.key.toLowerCase();
      if (k === "arrowright" || k === "d") hopTo(idxRef.current + 1);
      else if (k === "arrowleft" || k === "a") hopTo(idxRef.current - 1);
      else if (k === "f" && !typing) jump("flip");
      else if ((k === " " || k === "arrowup" || k === "w") && !typing && tag !== "BUTTON") { e.preventDefault(); jump("jump"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [interactive, hopTo, jump]);

  return (
    <div ref={root} className="gx-bg" aria-hidden={interactive ? undefined : true}>
      <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" className="gx-bg-svg" aria-hidden="true">
        <defs>
          <radialGradient id="gxGalaxy" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#7aa2ff" stopOpacity=".95" />
            <stop offset="1" stopColor="#4a3ccf" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="gxRing" x1="0" x2="1">
            <stop offset="0" stopColor="#e2b27d" /><stop offset="1" stopColor="#8a5a3c" />
          </linearGradient>
          <radialGradient id="gxPlanet" cx="35%" cy="30%" r="75%">
            <stop offset="0" stopColor="#f0c996" /><stop offset=".6" stopColor="#c58a5a" /><stop offset="1" stopColor="#7a4a35" />
          </radialGradient>
          <linearGradient id="gxTail" x1="1" x2="0">
            <stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="gxMoon" cx="35%" cy="30%" r="80%">
            <stop offset="0" stopColor="#5b4cc4" /><stop offset="1" stopColor="#2a1f6b" />
          </radialGradient>
        </defs>

        {/* far layer */}
        <g className="gx-p1">
          <g className="gx-comet" transform="translate(120 70) rotate(24)"><path d="M0 0 L-150 0" stroke="url(#gxTail)" strokeWidth="5" strokeLinecap="round" /><path d={sparklePath(11)} fill="#fff" /></g>
          <g className="gx-comet gx-comet-b" transform="translate(760 20) rotate(24)"><path d="M0 0 L-120 0" stroke="url(#gxTail)" strokeWidth="4" strokeLinecap="round" /><path d={sparklePath(9)} fill="#ffe08a" /></g>
          {DOTS.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#a89cf0" opacity=".55" />)}
          {SPARKLES.map(([x, y, s], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              <path d={sparklePath(s)} fill="#8f86d8" className={`gx-twinkle gx-dl-${i % 5}`} />
            </g>
          ))}
        </g>

        {/* mid layer: galaxy + planets */}
        <g className="gx-p2">
          <g className="gx-spin">
            <circle cx="800" cy="360" r="210" fill="url(#gxGalaxy)" opacity=".5" />
            <path d="M800 360 m-40 0 a40 40 0 0 1 80 0 a90 90 0 0 1 -150 55 a150 150 0 0 1 -35 -215 a220 220 0 0 1 300 -50" fill="none" stroke="#4a3ccf" strokeWidth="46" strokeLinecap="round" opacity=".75" />
            <path d="M800 360 m40 0 a40 40 0 0 1 -80 0 a90 90 0 0 1 150 -55 a150 150 0 0 1 35 215 a220 220 0 0 1 -300 50" fill="none" stroke="#5a48e0" strokeWidth="38" strokeLinecap="round" opacity=".55" />
            <ellipse cx="800" cy="360" rx="56" ry="40" fill="#6f8cff" />
            <ellipse cx="788" cy="350" rx="22" ry="15" fill="#9db4ff" />
          </g>
          <g className="gx-float" transform="translate(1330 150)">
            <ellipse cx="0" cy="8" rx="170" ry="34" fill="none" stroke="url(#gxRing)" strokeWidth="14" opacity=".9" transform="rotate(-14)" />
            <circle r="82" fill="url(#gxPlanet)" />
            <path d="M-78 -18 q78 -20 156 6 M-80 14 q80 -16 160 4 M-70 44 q70 -10 140 0" fill="none" stroke="#fff" strokeOpacity=".25" strokeWidth="7" />
          </g>
          <g className="gx-float gx-float-b" transform="translate(150 250)">
            <circle r="64" fill="url(#gxMoon)" />
            <circle cx="-18" cy="-14" r="14" fill="#1f1760" opacity=".6" />
            <circle cx="20" cy="18" r="9" fill="#1f1760" opacity=".6" />
            <circle cx="24" cy="-26" r="6" fill="#1f1760" opacity=".6" />
          </g>
          <circle cx="440" cy="330" r="36" fill="url(#gxMoon)" className="gx-float" />
          <g className="gx-float gx-float-b" transform="translate(1120 330) rotate(-25)">
            <circle r="16" fill="#4a3ccf" />
            <path d="M-70 -38 L-14 -6 M-62 -48 L-6 -14 M-56 -58 L2 -20 M30 14 L86 46 M24 24 L80 56 M18 34 L74 66" stroke="#7c70d8" strokeWidth="4" />
          </g>
        </g>

        {/* near layer: clouds */}
        <g className="gx-p3">
          <g fill="#2e1d78" opacity=".85">
            {[-40, 110, 270, 430, 600, 760, 920, 1080, 1250, 1410, 1570].map((x, i) => (
              <circle key={i} cx={x} cy={800 + ((i * 37) % 5) * 8} r={110 + ((i * 53) % 4) * 14} />
            ))}
          </g>
          <g fill="#3a2689" opacity=".6">
            {[20, 220, 480, 680, 860, 1140, 1360, 1580].map((x, i) => (
              <circle key={i} cx={x} cy={880} r={90 + ((i * 29) % 3) * 16} />
            ))}
          </g>
        </g>
      </svg>

      {interactive && (
        <>
          {/* stage: platforms, stars and the astronaut, above the page text, mostly click-through */}
          <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" className="gx-bg-svg gx-stage" aria-label="Space rocks. Use the arrow keys to hop between them and Space to jump.">
            <defs>
              <radialGradient id="gxIris" cx="50%" cy="35%" r="75%">
                <stop offset="0" stopColor="#8fe8ff" /><stop offset=".55" stopColor="#4a74ff" /><stop offset="1" stopColor="#3a1fa8" />
              </radialGradient>
              <linearGradient id="gxBeam" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#d8fff0" stopOpacity=".7" /><stop offset="1" stopColor="#d8fff0" stopOpacity=".05" />
              </linearGradient>
              <clipPath id="gxHead"><circle cx="0" cy="-86" r="30" /></clipPath>
            </defs>
            <g className="gx-p4">
              {/* blue rock */}
              <g className="gx-rock" role="button" tabIndex={0} aria-label="Hop to the blue rock" onClick={() => hopTo(0)} onKeyDown={(e) => e.key === "Enter" && hopTo(0)} transform="translate(120 700)">
                <path d="M10 20 L90 0 L190 12 L215 52 L170 90 L190 130 L120 120 L60 150 L40 100 L0 62 Z" fill="#5b7bf0" />
                <path d="M30 40 L80 20 L120 40 L90 70 Z M120 90 L160 70 L175 100 L140 110 Z" fill="#8fb0ff" opacity=".7" />
              </g>
              {/* crystal rock */}
              <g className="gx-rock" role="button" tabIndex={0} aria-label="Hop to the crystal rock" onClick={() => hopTo(1)} onKeyDown={(e) => e.key === "Enter" && hopTo(1)} transform="translate(740 690)">
                <path d="M0 40 L50 0 L150 6 L190 36 L170 60 L20 64 Z" fill="#8d8aa8" />
                <path d="M30 60 L70 150 L92 60 Z" fill="#c64fd6" /><path d="M80 60 L112 170 L140 60 Z" fill="#e070f0" />
                <path d="M130 60 L158 130 L176 60 Z" fill="#a83bc0" /><path d="M4 56 L26 120 L48 56 Z" fill="#d45fe4" />
              </g>
              {/* purple rock */}
              <g className="gx-rock" role="button" tabIndex={0} aria-label="Hop to the purple rock" onClick={() => hopTo(2)} onKeyDown={(e) => e.key === "Enter" && hopTo(2)} transform="translate(1300 710)">
                <path d="M20 30 L120 0 L200 20 L190 70 L140 110 L150 140 L80 120 L30 90 L0 60 Z" fill="#8a52e0" />
                <path d="M40 40 L100 22 L130 44 L80 66 Z" fill="#b48bff" opacity=".7" />
              </g>

              {/* stars */}
              {ALL_STARS.map((k) => !got.includes(k) && k !== stolen && (
                <g key={k} transform={`translate(${STAR_POS[k][0]} ${STAR_POS[k][1]})`}>
                  <path d={sparklePath(20)} className="gx-star-svg" />
                </g>
              ))}

              {/* sparkle bursts */}
              {bursts.map((bu) => (
                <g key={bu.id} transform={`translate(${bu.x} ${bu.y})`}>
                  {Array.from({ length: 8 }, (_, i) => {
                    return <path key={i} d={sparklePath(i % 2 ? 7 : 10)} className={`gx-burst gx-burst-${i}`} fill={i % 2 ? "#fff" : "#ffc83d"} />;
                  })}
                </g>
              ))}

              {/* Sparky, the flame buddy, trots after the astronaut */}
              <g className={`gx-pet-pos gx-pet-${idx}${look > 0 ? "r" : "l"}`}>
                <g key={motion ? `p${motion.kind}${motion.n}` : "pidle"} className={motion && motion.kind !== "wobble" ? "gx-hop gx-late" : "gx-idle"}>
                  <Sparky mood={mood} scared={!!ufo} />
                </g>
              </g>

              {/* astronaut: outer glides to the rock, inner plays the hop / jump / flip */}
              <g className={`gx-hero-pos gx-at-${idx}`}>
                <g key={motion ? `${motion.kind}${motion.n}` : "idle"} className={motion ? `gx-${motion.kind}` : "gx-idle"}>
                  <g onClick={poke} className="gx-hero" role="button" tabIndex={0} aria-label="Poke the astronaut" onKeyDown={(e) => e.key === "Enter" && poke()}>
                    <Astro mood={mood} moving={moving} look={look} />
                  </g>
                </g>
                <g key={motion ? `b${motion.kind}${motion.n}` : "bidle"} className={motion && motion.kind !== "wobble" ? `gx-b-${motion.kind}` : ""}>
                  {say && (
                    <g key={say.n} className="gx-say" transform="translate(0 -268)">
                      <rect x={-(say.text.length * 6.6 + 18)} y="-34" width={say.text.length * 13.2 + 36} height="46" rx="23" fill="#fff" />
                      <path d="M-9 10 L0 26 L9 10 Z" fill="#fff" />
                      <text x="0" y="-2" textAnchor="middle" fontSize="24" fontWeight="700" fill="#2a1a63" className="gx-say-text">{say.text}</text>
                    </g>
                  )}
                </g>
              </g>

              {/* sparkle bursts */}
              {bursts.map((bu) => (
                <g key={bu.id} transform={`translate(${bu.x} ${bu.y})`}>
                  {Array.from({ length: 8 }, (_, i) => {
                    return <path key={i} d={sparklePath(i % 2 ? 7 : 10)} className={`gx-burst gx-burst-${i}`} fill={["#ffc83d", "#fff", "#ff7ac0", "#3fd0ff"][i % 4]} />;
                  })}
                </g>
              ))}

              {/* cheeky UFO */}
              {ufo && (
                <g className={`gx-ufo-pos gx-ufo-${ufo.pos} gx-ufo-d${ufo.dur}`}>
                  {ufo.beam && <path d="M-26 12 L-74 124 L74 124 L26 12 Z" fill="url(#gxBeam)" />}
                  {ufo.star && <path d={sparklePath(20)} transform="translate(0 58)" className="gx-star-svg" />}
                  <g className="gx-ufo" role="button" tabIndex={0} aria-label="Shoo the alien UFO" onClick={scare} onKeyDown={(e) => e.key === "Enter" && scare()}>
                    <ellipse cx="0" cy="2" rx="64" ry="17" fill="#7d86d4" />
                    <ellipse cx="0" cy="-3" rx="48" ry="9" fill="#aab2f2" />
                    <path d="M-30 -6 A30 30 0 0 1 30 -6 Z" fill="#8fe8ff" opacity=".85" />
                    <circle cx="0" cy="-15" r="11" fill="#6be08a" />
                    <ellipse cx="-4" cy="-16" rx="2.4" ry="3.6" fill="#10301c" /><ellipse cx="4" cy="-16" rx="2.4" ry="3.6" fill="#10301c" />
                    <path d="M-3 -9 q3 3 6 0" fill="none" stroke="#10301c" strokeWidth="1.6" strokeLinecap="round" />
                    {[-40, 0, 40].map((x, i) => <circle key={x} cx={x} cy={i === 1 ? 10 : 6} r="4" fill="#ffc83d" className={`gx-light gx-dl-${i}`} />)}
                  </g>
                </g>
              )}
            </g>
          </svg>

          <div className="gx-plate gx-stage-hud">
            <span className="gx-star-dot" aria-hidden="true" />
            <span aria-live="polite">{total} stars · {rankFor(total)}</span>
          </div>
          <p className="gx-stage-hint">← → hop · Space jump · F flip · poke him! · catch the UFO</p>
        </>
      )}
    </div>
  );
}

/* Chibi anime astronaut. Feet at (0,0), about 140 units tall. */
function Eye({ x, mood, look }: { x: number; mood: Mood; look: number }) {
  const ink = "#2a1a63";
  if (mood === "happy")
    return <path d={`M${x - 8} -78 q8 -13 16 0`} fill="none" stroke={ink} strokeWidth="3.6" strokeLinecap="round" />;
  if (mood === "sleep")
    return <path d={`M${x - 8} -80 q8 8 16 0`} fill="none" stroke={ink} strokeWidth="3.2" strokeLinecap="round" />;
  if (mood === "dizzy")
    return (
      <g>
        <circle cx={x} cy="-80" r="9" fill="#fff" stroke={ink} strokeWidth="2" />
        <g className="gx-dizzy-eye">
          <circle cx={x} cy="-80" r="5" fill="none" stroke="#5a74d6" strokeWidth="2.4" strokeDasharray="14 6" />
          <circle cx={x} cy="-80" r="1.6" fill={ink} />
        </g>
      </g>
    );
  const shock = mood === "shock";
  return (
    <g>
      <ellipse cx={x} cy="-80" rx={shock ? 9.4 : 8.6} ry={shock ? 12.5 : 11} fill="#fff" />
      <g className={look > 0 ? "gx-look-r" : "gx-look-l"}>
        <ellipse cx={x} cy="-79" rx={shock ? 3.4 : 6.6} ry={shock ? 4.6 : 9.6} fill="url(#gxIris)" />
        <ellipse cx={x} cy="-79" rx={shock ? 1.6 : 3} ry={shock ? 2.4 : 5.2} fill="#1a1040" />
        {!shock && <circle cx={x - 2.6} cy="-84" r="2.9" fill="#fff" />}
        {!shock && <circle cx={x + 2.6} cy="-74" r="1.4" fill="#fff" />}
      </g>
      <path d={`M${x - 9.4} -88 q9.4 -6 18.8 0`} fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
    </g>
  );
}

function Astro({ mood, moving, look }: { mood: Mood; moving: boolean; look: number }) {
  const happy = mood === "happy";
  return (
    <g transform="scale(1.7)">
      {/* jet flames */}
      <g className={`gx-flame ${moving ? "gx-boost" : ""}`}>
        {[-23, 23].map((x) => (
          <g key={x}>
            <ellipse cx={x} cy="-18" rx="6.5" ry="12" fill="#ff9a3d" />
            <ellipse cx={x} cy="-19" rx="3.2" ry="7" fill="#fff3b0" />
          </g>
        ))}
      </g>
      {/* scarf tail */}
      <path className="gx-scarf" d="M-10 -52 q-24 2 -36 22 q11 -5 23 -3 q-7 8 -5 17 q14 -15 30 -21 z" fill="#3fd0ff" />
      {/* jetpack */}
      <rect x="-31" y="-64" width="14" height="34" rx="6" fill="#8f86d8" />
      <rect x="17" y="-64" width="14" height="34" rx="6" fill="#8f86d8" />
      {/* legs + boots */}
      <rect x="-13" y="-26" width="10" height="20" rx="5" fill="#e8ecff" />
      <rect x="3" y="-26" width="10" height="20" rx="5" fill="#e8ecff" />
      <ellipse cx="-9" cy="-4" rx="11" ry="6.5" fill="#ff6fb5" />
      <ellipse cx="9" cy="-4" rx="11" ry="6.5" fill="#ff6fb5" />
      {/* torso */}
      <rect x="-19" y="-56" width="38" height="36" rx="15" fill="#f4f6ff" />
      <rect x="-19" y="-36" width="38" height="6" fill="#8f86d8" />
      <path d={sparklePath(8)} transform="translate(0 -45)" fill="#ffc83d" />
      {/* arms */}
      <g>
        <rect x="-29" y="-54" width="10" height="23" rx="5" fill="#f4f6ff" />
        <circle cx="-24" cy="-30" r="5.5" fill="#ff6fb5" />
      </g>
      <g className={happy || mood === "shock" ? "gx-wave" : ""}>
        <rect x="19" y="-54" width="10" height="23" rx="5" fill="#f4f6ff" />
        <circle cx="24" cy="-30" r="5.5" fill="#ff6fb5" />
      </g>
      {/* neck ring + scarf knot */}
      <rect x="-15" y="-60" width="30" height="9" rx="4.5" fill="#cfd6f5" />
      <path d="M-17 -56 q17 9 34 0 l-3 9 q-14 6 -28 0 z" fill="#3fd0ff" />
      {/* head */}
      <circle cx="0" cy="-86" r="36" fill="#dfe6ff" />
      <circle cx="-38" cy="-84" r="8" fill="#ff6fb5" /><circle cx="-38" cy="-84" r="3" fill="#fff" opacity=".85" />
      <circle cx="38" cy="-84" r="8" fill="#ff6fb5" /><circle cx="38" cy="-84" r="3" fill="#fff" opacity=".85" />
      <rect x="-1.6" y="-132" width="3.2" height="16" rx="1.6" fill="#cfd6f5" />
      <circle className="gx-antenna" cx="0" cy="-135" r="6.5" fill="#ffc83d" />
      <circle cx="0" cy="-86" r="29" fill="#ffe3d1" />
      <g clipPath="url(#gxHead)">
        <path d="M-32 -86 C-34 -116 -10 -122 0 -120 C10 -122 34 -116 32 -86 L26 -96 L19 -84 L11 -98 L3 -86 L-5 -100 L-12 -86 L-20 -98 L-26 -84 Z" fill="#ff7ac0" />
        <path d="M-30 -84 q-4 14 2 24 q4 -10 4 -22 z M30 -84 q4 14 -2 24 q-4 -10 -4 -22 z" fill="#ff5aa8" />
      </g>
      <g className={mood === "idle" ? "gx-eyes" : ""}>
        <Eye x={-13} mood={mood} look={look} />
        <Eye x={13} mood={mood} look={look} />
      </g>
      <ellipse cx="-21" cy="-68" rx="6" ry="3.6" fill="#ff8fb8" opacity=".75" />
      <ellipse cx="21" cy="-68" rx="6" ry="3.6" fill="#ff8fb8" opacity=".75" />
      {happy ? (
        <g>
          <path d="M-8 -69 q8 14 16 0 z" fill="#8a1f4f" />
          <path d="M-4 -65 q4 4 8 0 q-4 -3 -8 0" fill="#ff8fb8" />
        </g>
      ) : mood === "shock" ? (
        <ellipse cx="0" cy="-66" rx="4.5" ry="6" fill="#8a1f4f" />
      ) : mood === "dizzy" ? (
        <path d="M-9 -67 q3 -4 6 0 t6 0 t6 0" fill="none" stroke="#b03a6a" strokeWidth="2.6" strokeLinecap="round" />
      ) : mood === "sleep" ? (
        <ellipse cx="0" cy="-66" rx="3" ry="3.6" fill="#b03a6a" className="gx-snore" />
      ) : (
        <path d="M-5 -68 q5 5 10 0" fill="none" stroke="#b03a6a" strokeWidth="2.6" strokeLinecap="round" />
      )}
      <circle cx="0" cy="-86" r="33" fill="none" stroke="#cfd6f5" strokeWidth="6" />
      <path d="M-24 -108 q9 -11 25 -12" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".7" />
      <circle cx="-27" cy="-100" r="2.6" fill="#fff" opacity=".8" />
      {mood === "dizzy" && (
        <g className="gx-orbit">
          {[0, 120, 240].map((deg) => (
            <path key={deg} d={sparklePath(7)} fill="#ffc83d" transform={`translate(${Math.cos((deg * Math.PI) / 180) * 50} ${-86 + Math.sin((deg * Math.PI) / 180) * 50})`} />
          ))}
        </g>
      )}
      {mood === "sleep" && (
        <g fontFamily="system-ui, sans-serif" fontWeight="800" fill="#fff">
          <text className="gx-zzz" x="30" y="-120" fontSize="20">Z</text>
          <text className="gx-zzz gx-zzz-b" x="44" y="-138" fontSize="15">z</text>
          <text className="gx-zzz gx-zzz-c" x="54" y="-152" fontSize="11">z</text>
        </g>
      )}
    </g>
  );
}

/* Sparky: a tiny flame buddy who copies every move, a beat late. */
function Sparky({ mood, scared }: { mood: Mood; scared: boolean }) {
  const asleep = mood === "sleep";
  return (
    <g transform="scale(1.3)" className={scared ? "gx-shake" : "gx-wiggle"}>
      <path d="M0 -50 C10 -36 22 -28 22 -14 A22 14 0 0 1 -22 -14 C-22 -28 -10 -36 0 -50 Z" fill="#ff9a3d" />
      <path d="M0 -34 C6 -26 12 -22 12 -14 A12 8 0 0 1 -12 -14 C-12 -22 -6 -26 0 -34 Z" fill="#ffd27a" />
      {asleep ? (
        <path d="M-9 -16 q3 3 6 0 M3 -16 q3 3 6 0" fill="none" stroke="#2a1a63" strokeWidth="2" strokeLinecap="round" />
      ) : (
        <g>
          <ellipse cx="-6" cy="-16" rx={scared ? 3.6 : 2.6} ry={scared ? 4.6 : 3.6} fill="#2a1a63" />
          <ellipse cx="6" cy="-16" rx={scared ? 3.6 : 2.6} ry={scared ? 4.6 : 3.6} fill="#2a1a63" />
          <circle cx="-5" cy="-17.5" r="1.1" fill="#fff" /><circle cx="7" cy="-17.5" r="1.1" fill="#fff" />
        </g>
      )}
      {scared ? <ellipse cx="0" cy="-8" rx="2.6" ry="3.4" fill="#8a1f4f" /> : <path d="M-4 -9 q4 4 8 0" fill="none" stroke="#8a3a1f" strokeWidth="1.8" strokeLinecap="round" />}
      <ellipse cx="-12" cy="-10" rx="3.4" ry="2" fill="#ff7a5a" opacity=".7" /><ellipse cx="12" cy="-10" rx="3.4" ry="2" fill="#ff7a5a" opacity=".7" />
    </g>
  );
}
