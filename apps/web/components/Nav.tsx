"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useExplorer } from "@/components/guide/EmberGuide";
import { NAV_GROUPS, StationIcon } from "@/components/StationMap";

/**
 * Five groups instead of nine equal links: Explore, Evidence, Analyze, Mission, About.
 * Desktop: disclosure menus (button + panel), closed by Escape, outside click or choosing a page.
 * Phone: one panel with the groups as sections. Every deep route stays one click away.
 */
export function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const { gentle, setGentle } = useExplorer();
  const active = (href: string) => path === href || path.startsWith(href + "/");

  useEffect(() => {
    if (!open && !mobile) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) { setOpen(null); setMobile(false); } };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open, mobile]);

  const done = () => { setOpen(null); setMobile(false); };
  const link = (s: (typeof NAV_GROUPS)[number]["items"][number]) => (
    <Link key={s.href} href={s.href} onClick={done} aria-current={active(s.href) ? "page" : undefined} className="nav-item">
      <span className="nav-item-icon"><StationIcon name={s.icon} /></span>
      <span><strong>{s.label}</strong><small>{s.detail}</small></span>
    </Link>
  );

  return (
    <nav ref={ref} aria-label="Main" className="station-nav" onKeyDown={(e) => { if (e.key === "Escape") done(); }}>
      <ul className="nav-groups">
        {NAV_GROUPS.map((g) => (
          <li key={g.id} className="nav-group">
            <button
              className="nav-group-btn"
              aria-expanded={open === g.id}
              aria-controls={`nav-${g.id}`}
              data-current={g.items.some((s) => active(s.href)) || undefined}
              onClick={() => setOpen(open === g.id ? null : g.id)}
            >
              {g.label}
              <svg aria-hidden="true" className="nav-caret" viewBox="0 0 12 12" width="10" height="10"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            {open === g.id && (
              <div id={`nav-${g.id}`} className="nav-panel">
                <p className="nav-panel-blurb">{g.blurb}</p>
                {g.items.map(link)}
              </div>
            )}
          </li>
        ))}
      </ul>
      <button onClick={() => setGentle(!gentle)} aria-pressed={gentle} title={gentle ? "Background motion paused" : "Pause background motion"} className="nav-motion">
        {gentle ? (
          <svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" className="nav-motion-icon nav-motion-play"><path d="M5 3.2v9.6L12.6 8z" fill="currentColor" /></svg>
        ) : (
          <svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" className="nav-motion-icon"><rect x="3.5" y="3" width="3" height="10" rx="1" fill="currentColor" /><rect x="9.5" y="3" width="3" height="10" rx="1" fill="currentColor" /></svg>
        )}
        <span className="sr-only">{gentle ? "Play motion" : "Pause motion"}</span>
      </button>
      <button className="station-menu-button" aria-expanded={mobile} aria-controls="mobile-nav" onClick={() => setMobile((m) => !m)}>
        {mobile ? "Close" : "Explore"} <span aria-hidden="true">{mobile ? "×" : "☰"}</span>
      </button>
      {mobile && (
        <div id="mobile-nav" className="station-nav-mobile nav-mobile">
          {NAV_GROUPS.map((g) => (
            <section key={g.id} aria-label={g.label}>
              <p className="nav-mobile-head">{g.label} <span>{g.blurb}</span></p>
              {g.items.map(link)}
            </section>
          ))}
        </div>
      )}
    </nav>
  );
}
