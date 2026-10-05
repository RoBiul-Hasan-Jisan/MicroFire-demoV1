"use client";

import { useRef } from "react";

export type TabItem<T extends string> = { id: T; label: string; sub?: string };

/** WAI-ARIA tabs: arrow keys, Home and End move between tabs; the panel is labelled by the active tab. */
export function Tabs<T extends string>({ id, items, value, onChange, label, className }: { id: string; items: TabItem<T>[]; value: T; onChange: (v: T) => void; label: string; className?: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (i: number) => { const n = (i + items.length) % items.length; onChange(items[n].id); refs.current[n]?.focus(); };
  return (
    <div role="tablist" aria-label={label} className={className}>
      {items.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => { refs.current[i] = el; }}
          type="button"
          role="tab"
          id={`${id}-tab-${t.id}`}
          aria-selected={value === t.id}
          aria-controls={`${id}-panel`}
          tabIndex={value === t.id ? 0 : -1}
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); move(i + 1); }
            else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); move(i - 1); }
            else if (e.key === "Home") { e.preventDefault(); move(0); }
            else if (e.key === "End") { e.preventDefault(); move(items.length - 1); }
          }}
          data-tab={t.id}
        >
          <b>{t.label}</b>
          {t.sub && <small>{t.sub}</small>}
        </button>
      ))}
    </div>
  );
}
