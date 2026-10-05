"use client";

import { useEffect, useState } from "react";
import styles from "./Challenge.module.css";

/** The 01–09 progress rail. Marks the stage in view; plain anchor links, so it works without JavaScript too. */
export function StageRail({ stages }: { stages: string[] }) {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const els = stages.map((_, i) => document.getElementById(`stage-${i + 1}`)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        const seen = entries.filter((e) => e.isIntersecting).map((e) => Number(e.target.id.split("-")[1]) - 1);
        if (seen.length) setCurrent(Math.min(...seen));
      },
      { rootMargin: "-80px 0px -55% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [stages]);
  return (
    <nav className={styles.stageNav} aria-label="Challenge stages">
      <ol>
        {stages.map((s, i) => (
          <li key={s} data-done={i < current || undefined}>
            <a href={`#stage-${i + 1}`} aria-current={i === current ? "step" : undefined}>
              <b>{String(i + 1).padStart(2, "0")}</b>{s}
            </a>
          </li>
        ))}
        <li><a href="#brief" className={styles.briefLink}>Brief</a></li>
      </ol>
    </nav>
  );
}

export function BriefActions({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={styles.briefActions}>
      <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); } }}>
        {copied ? "Copied" : "Copy brief"}
      </button>
      <button type="button" onClick={() => window.print()}>Save as PDF or print</button>
      <span role="status" className="sr-only">{copied ? "Brief copied to the clipboard" : ""}</span>
    </div>
  );
}
