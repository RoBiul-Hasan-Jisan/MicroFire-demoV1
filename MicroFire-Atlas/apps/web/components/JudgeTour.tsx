"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TOUR, TOUR_KEY } from "@/lib/judge";

const read = () => { try { const v = sessionStorage.getItem(TOUR_KEY); return v == null ? null : Number(v); } catch { return null; } };
const write = (v: number | null) => { try { if (v == null) sessionStorage.removeItem(TOUR_KEY); else sessionStorage.setItem(TOUR_KEY, String(v)); } catch { /* storage blocked: the tour still works for this page */ } };

export function StartTour() {
  const router = useRouter();
  return <button type="button" className="tour-go" onClick={() => { write(0); router.push(TOUR[0].href); }}>Start the 90-second judge tour</button>;
}

/** A slim guide that follows the judge from page to page. Every page stays fully usable underneath it. */
export function JudgeTourBar() {
  const path = usePathname();
  const router = useRouter();
  const [step, setStep] = useState<number | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is only readable after mount
  useEffect(() => setStep(read()), [path]);
  if (step == null || !TOUR[step]) return null;
  const s = TOUR[step];
  const go = (n: number) => { if (n >= TOUR.length) { write(null); setStep(null); router.push("/tour#done"); return; } write(n); setStep(n); router.push(TOUR[n].href); };
  return (
    <aside className="judge-bar" aria-label="Judge tour">
      <p className="judge-bar-step">Judge tour · {step + 1} / {TOUR.length} · about {s.seconds} s</p>
      <p className="judge-bar-title">{s.title}</p>
      <p className="judge-bar-look">{s.look}</p>
      <div className="judge-bar-actions">
        <button type="button" onClick={() => go(step - 1)} disabled={step === 0}>Back</button>
        <button type="button" className="judge-bar-next" onClick={() => go(step + 1)}>{step === TOUR.length - 1 ? "Finish" : "Next stop"}</button>
        <Link href="/tour" onClick={() => { write(null); setStep(null); }}>Exit tour</Link>
      </div>
    </aside>
  );
}
