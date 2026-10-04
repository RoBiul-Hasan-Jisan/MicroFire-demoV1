"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useExplorer } from "@/components/guide/EmberGuide";

const HREF = "/story?start=1";

/**
 * The transition layer: a child-triggered, skippable ~1.6 s trip. One evidence spark flies into a
 * station window, which opens onto the experiment bay. Pause motion / reduced motion go straight there.
 */
export function StartMission({ label = "Start the mission", className = "story-cta" }: { label?: string; className?: string }) {
  const router = useRouter();
  const { gentle } = useExplorer();
  const [flying, setFlying] = useState(false);

  useEffect(() => {
    router.prefetch(HREF);
  }, [router]);
  useEffect(() => {
    if (!flying) return;
    const go = () => router.push(HREF);
    const t = setTimeout(go, 1600);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && go();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [flying, router]);

  return (
    <>
      <a
        href={HREF}
        data-guide="play"
        className={className}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey) return;
          e.preventDefault();
          if (gentle || matchMedia("(prefers-reduced-motion: reduce)").matches) router.push(HREF);
          else setFlying(true);
        }}
      >
        {label}
      </a>
      {flying && (
        <div className="trip" role="dialog" aria-label="Travelling to the experiment bay">
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative fly-in plate */}
          <img src="/art/sky.webp" alt="" className="trip-plate" aria-hidden="true" />
          <div className="trip-window" aria-hidden="true">
            <svg viewBox="0 0 200 120" className="trip-lab">
              {/* the destination, already visible: a glovebox with the wind tunnel inside */}
              <rect x="30" y="22" width="140" height="78" rx="10" fill="#0d1424" stroke="#56d4e4" strokeOpacity=".7" />
              <circle cx="70" cy="100" r="13" fill="#070b16" stroke="#2c3a58" />
              <circle cx="130" cy="100" r="13" fill="#070b16" stroke="#2c3a58" />
              <rect x="55" y="48" width="90" height="30" rx="3" fill="none" stroke="#56d4e4" />
              <ellipse cx="88" cy="63" rx="6" ry="4" fill="#5b8cff" />
              <ellipse cx="88" cy="63" rx="2.4" ry="1.8" fill="#d6e4ff" />
            </svg>
          </div>
          <span className="trip-spark" aria-hidden="true" />
          <p className="trip-caption">Into the space station&apos;s experiment bay…</p>
          <button className="trip-skip" onClick={() => router.push(HREF)} autoFocus>
            Skip
          </button>
        </div>
      )}
    </>
  );
}
