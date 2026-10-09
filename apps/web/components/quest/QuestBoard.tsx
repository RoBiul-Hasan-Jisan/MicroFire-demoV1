"use client";

import { useEffect } from "react";
import { useExplorer } from "@/components/guide/EmberGuide";
import { CREW, discovery, QUESTS, type CrewId, type Quest } from "@/lib/guide";
import styles from "./QuestBoard.module.css";

const NONE: Quest[] = [];

/** Real actions for this page. Each one lights a star in the explorer's constellation. */
export function QuestBoard({ page, crew = "kofi" }: { page: keyof typeof QUESTS; crew?: CrewId }) {
  const { found, discover } = useExplorer();
  const quests = QUESTS[page] ?? NONE;
  const done = quests.filter((q) => found.includes(q.id)).length;
  const all = done === quests.length;
  const c = CREW[crew];

  // notice quest actions anywhere on the page: a matching click, or a matching element appearing
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target as Element | null;
      for (const q of quests) if (q.click && t?.closest?.(q.click)) discover(q.id);
    };
    const look = () => { for (const q of quests) if (q.visible && document.querySelector(q.visible)) discover(q.id); };
    document.addEventListener("click", onClick, true);
    look();
    const mo = new MutationObserver(look);
    if (quests.some((q) => q.visible)) mo.observe(document.body, { childList: true, subtree: true });
    return () => { document.removeEventListener("click", onClick, true); mo.disconnect(); };
  }, [quests, discover]);

  return (
    <aside className={styles.board} data-complete={all} aria-label="Page quests">
      {/* eslint-disable-next-line @next/next/no-img-element -- static art; next/image would add inline styles the CSP blocks */}
      <img src={all ? c.poses.cheering : c.poses.pointing} alt="" className={styles.crew} />
      <div className={styles.body}>
        <p className={styles.title}>
          {all ? `Quest complete! ${c.name} is impressed.` : `${c.name}'s quest for this page`}
          <span className={styles.count}>{done} of {quests.length} stars</span>
        </p>
        <ol className={styles.list} data-n={quests.length}>
          {quests.map((q) => {
            const got = found.includes(q.id);
            return (
              <li key={q.id} data-done={got}>
                <span className={styles.star} aria-hidden="true">{got ? "★" : "☆"}</span>
                <span>{got ? discovery(q.id)?.label : q.how}</span>
                <span className="sr-only">{got ? "done" : "to do"}</span>
              </li>
            );
          })}
        </ol>
        <span className={styles.bar} aria-hidden="true"><i data-pct={Math.round((done / Math.max(1, quests.length)) * 100)} /></span>
      </div>
    </aside>
  );
}
