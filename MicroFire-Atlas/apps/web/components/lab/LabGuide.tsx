"use client";

import { useEffect, useState } from "react";
import { Ember, type Form, type Mood } from "@/components/game/Ember";

export type GuideTip = { text: string; mood: Mood };

/**
 * Ember as the lab's contextual assistant. The words come from the lab's own state and from verified NASA findings:
 * it points out what just changed and what to try next, and never makes a prediction.
 */
export function LabGuide({ tip, next, form, onNext }: { tip: GuideTip; next: { label: string; done: boolean } | null; form: Form; onNext: () => void }) {
  const [open, setOpen] = useState(true);
  const [pulse, setPulse] = useState(0);

  // A new tip re-opens the bubble briefly so a change is noticed; the user can still fold it away.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reopen the bubble when the tip changes
    setPulse((n) => n + 1);
    setOpen(true);
    const t = window.setTimeout(() => setOpen(false), 9000);
    return () => window.clearTimeout(t);
  }, [tip.text]);

  return (
    <div className="lab-guide">
      {open && (
        <div key={pulse} className="lab-guide-panel" role="status" aria-live="polite">
          <p className="lab-kicker">Ember · lab assistant</p>
          <p className="mt-1 text-[15px] leading-snug">{tip.text}</p>
          {next && !next.done && (
            <button className="lab-btn lab-btn-small mt-3" onClick={onNext}>
              Next: {next.label}
            </button>
          )}
        </div>
      )}
      <button className="lab-guide-ember" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? "Hide Ember's tips" : "Show Ember's tips"}>
        <Ember form={form} mood={tip.mood} size={78} label={false} />
      </button>
    </div>
  );
}
