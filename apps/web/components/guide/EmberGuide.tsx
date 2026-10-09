"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Ember, type Mood } from "@/components/game/Ember";
import { Cite } from "@/components/Cite";
import { findings } from "@/lib/data";
import { CREW, DISCOVERIES, discovery, FUN_FACTS, GOALS, guideFor } from "@/lib/guide";

/* ---------- Explorer / Scientist mode, shared across the site ---------- */

type Mode = "kid" | "pro";
type Ctx = {
  mode: Mode;
  setMode: (m: Mode) => void;
  /** Site-wide Gentle Motion (shown as "Pause motion"): stills the backdrop and shortens transitions. */
  gentle: boolean;
  setGentle: (on: boolean) => void;
  /** Discoveries found so far: learning actions, never page visits. */
  found: string[];
  discover: (id: string) => void;
};
const ExplorerCtx = createContext<Ctx>({ mode: "kid", setMode: () => {}, gentle: false, setGentle: () => {}, found: [], discover: () => {} });
export const useExplorer = () => useContext(ExplorerCtx);

const KEY = "microfire-explorer-v2";
type Saved = { mode: Mode; found: string[]; open: boolean; seen: string[]; gentle: boolean; tips: string[] };
const DEFAULT: Saved = { mode: "kid", found: [], open: false, seen: [], gentle: false, tips: [] };

function load(): Saved {
  try {
    return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return DEFAULT;
  }
}

/**
 * Ember floats on every page: a short, page-aware tour that points at real elements
 * (data-guide="..."), kid-friendly fun facts from verified NASA quotes, explorer stars,
 * and the Explorer / Scientist switch.
 */
export function ExplorerProvider({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [s, setS] = useState<Saved>(DEFAULT);
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(0);
  const [fact, setFact] = useState<number | null>(null);
  const [nudge, setNudge] = useState(false);
  const [pop, setPop] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const page = guideFor(path);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from storage
    setS(load());
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {}
  }, [s, ready]);

  // new page: restart the tour, and wave hello if it's the first visit (visits earn nothing)
  useEffect(() => {
    if (!ready || !page) return;
    /* eslint-disable react-hooks/set-state-in-effect -- reacting to navigation */
    setStep(0);
    setFact(null);
    if (!s.seen.includes(page.id)) {
      setNudge(true);
      const t = setTimeout(() => setNudge(false), 6000);
      return () => clearTimeout(t);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [path, ready]); // eslint-disable-line react-hooks/exhaustive-deps -- only on navigation

  const current = page?.steps[Math.min(step, (page?.steps.length ?? 1) - 1)];

  // point at the element the step talks about
  useEffect(() => {
    if (!s.open || !current?.target) return;
    const el = document.querySelector<HTMLElement>(`[data-guide="${current.target}"]`);
    if (!el) return;
    el.classList.add("guide-glow");
    el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    return () => el.classList.remove("guide-glow");
  }, [s.open, current, path]);

  const setOpen = useCallback(
    (open: boolean) => {
      setS((x) => ({ ...x, open, seen: page && open && !x.seen.includes(page.id) ? [...x.seen, page.id] : x.seen }));
      setNudge(false);
      if (open) setTimeout(() => panelRef.current?.focus(), 30);
      else buttonRef.current?.focus();
    },
    [page],
  );

  useEffect(() => {
    if (!s.open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s.open, setOpen]);

  const discover = useCallback((id: string) => {
    setS((x) => {
      if (x.found.includes(id) || !discovery(id)) return x;
      setPop(id);
      return { ...x, found: [...x.found, id] };
    });
  }, []);
  useEffect(() => {
    if (!pop) return;
    const t = setTimeout(() => setPop(null), 4200);
    return () => clearTimeout(t);
  }, [pop]);

  // opening any NASA report link is a discovery, wherever it happens
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (a && /nasa\.gov/.test(a.href)) discover("source");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [discover]);

  useEffect(() => {
    if (s.gentle) document.documentElement.dataset.motion = "gentle";
    else delete document.documentElement.dataset.motion;
  }, [s.gentle]);

  const ctx = useMemo(
    () => ({
      mode: s.mode,
      setMode: (mode: Mode) => setS((x) => ({ ...x, mode })),
      gentle: s.gentle,
      setGentle: (gentle: boolean) => setS((x) => ({ ...x, gentle })),
      found: s.found,
      discover,
    }),
    [s.mode, s.gentle, s.found, discover],
  );
  const hidden = path.startsWith("/story") || path.startsWith("/expedition"); // adventures have a scene guide
  const kid = s.mode === "kid";
  const mood: Mood = current?.mood ?? (fact != null ? "surprised" : kid ? "happy" : "curious");
  const factItem = fact != null ? FUN_FACTS[fact % FUN_FACTS.length] : null;
  const factQuote = factItem ? findings.find((f) => f.id === factItem.finding) : null;
  const goal = page ? GOALS[page.id] : undefined;
  const crew = goal ? CREW[goal.crew] : undefined;
  const hasSceneGuide = ["atlas", "analyze", "compare", "mission", "gaps", "ask"].includes(page?.id ?? "");
  const tipOpen = !!page && !s.tips.includes(page.id);
  const setTip = (open: boolean) =>
    page && setS((x) => ({ ...x, tips: open ? x.tips.filter((t) => t !== page.id) : [...new Set([...x.tips, page.id])] }));
  const total = DISCOVERIES.length;
  const nextUp = DISCOVERIES.find((d) => !s.found.includes(d.id));

  // A tip greets the explorer, then tucks itself away once they start scrolling (Tala's avatar reopens it).
  const pageId = page?.id;
  useEffect(() => {
    if (!tipOpen || !pageId) return;
    const onScroll = () => {
      if (scrollY > innerHeight * 0.6) setS((x) => ({ ...x, tips: [...new Set([...x.tips, pageId])] }));
    };
    addEventListener("scroll", onScroll, { passive: true });
    return () => removeEventListener("scroll", onScroll);
  }, [tipOpen, pageId]);

  return (
    <ExplorerCtx.Provider value={ctx}>
      {children}
      {!hidden && !hasSceneGuide && ready && goal && crew && (
        <div className={`crew-tip ${tipOpen ? "crew-tip-open" : ""}`}>
          {tipOpen ? (
            <div className="crew-card" role="note" aria-label={`${crew.name}'s tip`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- illustrated character */}
              <img src={crew.img} alt="" className="crew-img" />
              <div className="crew-bubble">
                <p className="text-[11px] font-semibold text-signal">{crew.name} · What am I looking for?</p>
                <p className="mt-1 text-[15px] leading-snug">{kid ? goal.kid : goal.pro}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                  {goal.next && <Link href={goal.next.href} className="link">{goal.next.label}</Link>}
                  <button className="text-muted hover:text-ink" onClick={() => setTip(false)}>Got it</button>
                </div>
              </div>
            </div>
          ) : (
            <button className="crew-mini" onClick={() => setTip(true)} aria-label={`Ask ${crew.name}: what am I looking for?`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- illustrated character */}
              <img src={crew.img} alt="" />
              <span>What do I do here?</span>
            </button>
          )}
        </div>
      )}
      {!hidden && ready && (
        <div className="guide-root" data-open={s.open}>
          {s.open && page && current && (
            <div ref={panelRef} tabIndex={-1} role="dialog" aria-label={`Ember's guide to ${page.name}`} className="guide-panel">
              <div className="flex items-center justify-between gap-2">
                <div className="guide-switch" role="group" aria-label="Explanation level">
                  <button aria-pressed={kid} onClick={() => ctx.setMode("kid")}>Explorer</button>
                  <button aria-pressed={!kid} onClick={() => ctx.setMode("pro")}>Scientist</button>
                </div>
                <button onClick={() => setOpen(false)} className="guide-x" aria-label="Close Ember's guide">✕</button>
              </div>

              {factItem ? (
                <div className="mt-3">
                  <p className="guide-kicker">Fun fact from NASA</p>
                  <p className="guide-text">{factItem.text}</p>
                  {factQuote && (
                    <p className="mt-2 text-xs text-muted">
                      NASA&apos;s words: “{factQuote.quote}” <Cite sourceId={factQuote.source_id} page={factQuote.pdf_page} />
                    </p>
                  )}
                </div>
              ) : (
                <div className="mt-3">
                  <p className="guide-kicker">
                    {page.name}: step {Math.min(step, page.steps.length - 1) + 1} of {page.steps.length}
                  </p>
                  <p className="guide-text">{kid ? current.kid : current.pro}</p>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {factItem ? (
                  <button className="guide-btn" onClick={() => setFact(null)}>Back to the tour</button>
                ) : (
                  <>
                    <button className="guide-btn-ghost" disabled={step === 0} onClick={() => setStep((n) => n - 1)}>Back</button>
                    {step < page.steps.length - 1 ? (
                      <button className="guide-btn" onClick={() => setStep((n) => n + 1)}>Next</button>
                    ) : (
                      <button className="guide-btn" onClick={() => setOpen(false)}>Got it!</button>
                    )}
                  </>
                )}
                <button className="guide-btn-ghost" onClick={() => setFact((f) => (f == null ? Math.floor(Math.random() * FUN_FACTS.length) : f + 1))}>
                  {factItem ? "Another fact" : "Fun fact"}
                </button>
              </div>

              <div className="mt-4 pt-3 border-t border-rule">
                <p className="text-xs text-muted">
                  Discoveries <b className="text-flame num">{s.found.length}</b> of {total}
                </p>
                <ol className="mt-1.5 flex flex-wrap gap-1" aria-label="Discoveries">
                  {DISCOVERIES.map((d) => (
                    <li key={d.id} title={d.label} className={`guide-star ${s.found.includes(d.id) ? "guide-star-on" : ""}`}>
                      <span aria-hidden="true">★</span>
                      <span className="sr-only">{d.label}{s.found.includes(d.id) ? ", found" : ", not found yet"}</span>
                    </li>
                  ))}
                </ol>
                {nextUp ? (
                  <p className="mt-2 text-xs text-faint">
                    Next discovery: <Link className="link" href={nextUp.href}>{nextUp.label.toLowerCase()}</Link>
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-flame">You found every discovery. You think like a fire scientist!</p>
                )}
                <label className="mt-3 flex items-center justify-between gap-2 text-xs text-muted">
                  Pause background motion
                  <input type="checkbox" checked={s.gentle} onChange={(e) => ctx.setGentle(e.target.checked)} className="accent-[var(--signal)]" />
                </label>
              </div>
            </div>
          )}

          {pop && !s.open && (
            <p className="guide-pop" role="status">
              <span aria-hidden="true">★ </span>New discovery: {discovery(pop)?.label}
            </p>
          )}

          {!s.open && nudge && page && !tipOpen && (
            <button className="guide-nudge" onClick={() => setOpen(true)}>
              {kid ? "Psst! Want me to show you around?" : `Guide to ${page.name}`}
            </button>
          )}

          <button
            ref={buttonRef}
            onClick={() => setOpen(!s.open)}
            aria-expanded={s.open}
            aria-label={s.open ? "Close Ember's guide" : "Open Ember, your flame guide"}
            className="guide-ember"
          >
            <Ember form={path === "/" && !s.open ? "earth" : "orbit"} mood={mood} size={74} label={false} />
            <span className="guide-badge num" aria-hidden="true">{s.found.length}</span>
          </button>
        </div>
      )}
    </ExplorerCtx.Provider>
  );
}
