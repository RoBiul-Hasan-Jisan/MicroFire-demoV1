"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/story", label: "Story" },
  { href: "/atlas", label: "Atlas" },
  { href: "/compare", label: "Compare" },
  { href: "/mission", label: "Mission Lab" },
  { href: "/gaps", label: "Evidence gaps" },
  { href: "/ask", label: "Ask" },
  { href: "/methodology", label: "Method" },
];

export function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const items = LINKS.map((l) => {
    const active = path === l.href || path.startsWith(l.href + "/");
    return (
      <Link
        key={l.href}
        href={l.href}
        onClick={() => setOpen(false)}
        aria-current={active ? "page" : undefined}
        className={`px-3 py-2 text-sm rounded-sm transition-colors ${
          active ? "text-ink bg-panel-2" : "text-muted hover:text-ink"
        }`}
      >
        {l.label}
      </Link>
    );
  });
  return (
    <nav aria-label="Main">
      <div className="hidden md:flex items-center gap-1">{items}</div>
      <button
        className="md:hidden text-sm text-muted px-3 py-2 border border-rule rounded-sm"
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={() => setOpen((o) => !o)}
      >
        Menu
      </button>
      {open && (
        <div id="mobile-nav" className="md:hidden absolute left-0 right-0 top-14 z-40 bg-panel border-b border-rule flex flex-col p-2">
          {items}
        </div>
      )}
    </nav>
  );
}
