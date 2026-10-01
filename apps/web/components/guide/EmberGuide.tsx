"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Ember, type Mood } from "@/components/game/Ember";
import { Cite } from "@/components/Cite";
import { findings } from "@/lib/data";
import { FUN_FACTS, guideFor, PAGES } from "@/lib/guide";

/* ---------- Explorer / Scientist mode, shared across the site ---------- */

type Mode = "kid" | "pro";
const ExplorerCtx = createContext<{ mode: Mode; setMode: (m: Mode) => void }>({ mode: "kid", setMode: () => {} });
export const useExplorer = () => useContext(ExplorerCtx);

const KEY = "microfire-explorer-v1";
type Saved = { mode: Mode; stars: string[]; open: boolean; seen: string[] };
const DEFAULT: Saved = { mode: "kid", stars: [], open: false, seen: [] };

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

  // new page: earn a star, restart the tour, and wave hello if it's the first visit
  useEffect(() => {
    if (!ready || !page) return;
    /* eslint-disable react-hooks/set-state-in-effect -- reacting to navigation */
    setStep(0);
    setFact(null);
    setS((x) => (x.stars.includes(page.id) ? x : { ...x, stars: [...x.stars, page.id] }));
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

  const ctx = useMemo(() => ({ mode: s.mode, setMode: (mode: Mode) => setS((x) => ({ ...x, mode })) }), [s.mode]);
  const hidden = path.startsWith("/story"); // the game has Ember built in
  const kid = s.mode === "kid";
  const mood: Mood = current?.mood ?? (fact != null ? "surprised" : kid ? "happy" : "curious");
  const factItem = fact != null ? FUN_FACTS[fact % FUN_FACTS.length] : null;
  const factQuote = factItem ? findings.find((f) => f.id === factItem.finding) : null;
  const total = PAGES.length;

  return (
    <ExplorerCtx.Provider value={ctx}>
      {children}
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
                  Explorer stars <b className="text-flame num">{s.stars.length}</b> of {total}
                </p>
                <ol className="mt-1.5 flex flex-wrap gap-1" aria-label="Pages explored">
                  {PAGES.map((p) => (
                    <li key={p.id} title={p.name} className={`guide-star ${s.stars.includes(p.id) ? "guide-star-on" : ""}`}>
                      <span aria-hidden="true">★</span>
                      <span className="sr-only">{p.name}{s.stars.includes(p.id) ? " explored" : " not yet explored"}</span>
                    </li>
                  ))}
                </ol>
                {s.stars.length >= total ? (
                  <p className="mt-2 text-sm text-flame">You explored every page! You are a MicroFire scientist.</p>
                ) : (
                  <p className="mt-2 text-xs text-faint">
                    Next: <Link className="link" href={nextUnexplored(s.stars)}>{PAGES.find((p) => !s.stars.includes(p.id))?.name}</Link>, or{" "}
                    <Link className="link" href="/story">play the mission</Link>.
                  </p>
                )}
              </div>
            </div>
          )}

          {!s.open && nudge && page && (
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
            <span className="guide-badge num" aria-hidden="true">{s.stars.length}</span>
          </button>
        </div>
      )}
    </ExplorerCtx.Provider>
  );
}

const ROUTE: Record<string, string> = {
  home: "/",
  atlas: "/atlas",
  analyze: "/analyze/saffire-vi-pmma",
  compare: "/compare",
  mission: "/mission",
  gaps: "/gaps",
  ask: "/ask",
  experiment: "/experiments/bass2-B19",
  methodology: "/methodology",
  sources: "/sources",
};
const nextUnexplored = (stars: string[]) => ROUTE[PAGES.find((p) => !stars.includes(p.id))?.id ?? "home"];
