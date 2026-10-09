"use client";
/* eslint-disable @next/next/no-img-element -- next/image writes inline style attributes, which the strict CSP blocks */

import Link from "next/link";
import { useState } from "react";
import { Tabs } from "./Tabs";
import s from "./Home.module.css";

type Path = "challenge" | "explorer" | "analyst";
const STEPS = ["Find", "Compare", "Summarize", "Rank", "Interpret", "AI", "Uncertainty", "Next experiment", "Traceability"];
const X = (o2: number) => ((o2 - 14) / (36 - 14)) * 1000;

/** One region, three ways in. Choosing a path changes the panel in place; nothing new is appended below. */
export function MissionSelector({ oxygen }: { oxygen: { id: string; o2: number; family: string }[] }) {
  const [path, setPath] = useState<Path>("challenge");
  return (
    <section className={s.mission} data-guide="paths" aria-labelledby="mission-title">
      <div className={s.missionHead}>
        <h2 id="mission-title" className={s.h2}>Choose your mission</h2>
        <Tabs id="mission" label="Ways into the evidence" value={path} onChange={setPath} className={s.missionTabs}
          items={[{ id: "challenge", label: "Challenge Mode", sub: "90-second guided answer" }, { id: "explorer", label: "Explorer", sub: "Understand the science" }, { id: "analyst", label: "Mission Analyst", sub: "Investigate the evidence" }]} />
      </div>

      <div id="mission-panel" role="tabpanel" aria-labelledby={`mission-tab-${path}`} className={s.missionPanel} data-path={path} key={path}>
        {path === "challenge" && (
          <div className={s.challenge}>
            <div>
              <p className={s.promise}>One question. Nine steps. Every claim traceable.</p>
              <p className={s.body}>What does NASA actually know about PMMA fire in a future lunar habitat? Challenge Mode answers end to end on one page, then hands you a Mission Evidence Brief.</p>
              <div className={s.ctaRow}>
                <Link href="/challenge" className="story-cta">Enter Challenge Mode</Link>
                <Link href="/tour" className={s.ghostCta}>Judge Mode: 3 demos and a guided tour</Link>
              </div>
            </div>
            <ol className={s.nine} aria-label="The nine steps">
              {STEPS.map((x, i) => <li key={x}><span className="num">{String(i + 1).padStart(2, "0")}</span>{x}</li>)}
            </ol>
          </div>
        )}
        {path === "explorer" && (
          <div className={s.explorer}>
            <img src="/art/crew/tala-pointing.webp" alt="" className={s.tala} />
            <div>
              <p className={s.promise}>Learn why fire behaves differently in space.</p>
              <p className={s.body}>Adventures with a crew, real NASA footage, predictions and discoveries. The story never invents a result: every clue is a NASA record.</p>
              <ul className={s.tiles}>
                <li><Link href="/expedition"><b>Follow the Spark</b><small>The main adventure</small></Link></li>
                <li><Link href="/lab"><b>Flame Lab</b><small>Run your own experiment</small></Link></li>
                <li><Link href="/story"><b>Build the experiment</b><small>NASA&apos;s wind tunnel in 3D</small></Link></li>
                <li><Link href="/learn"><b>Why flames change</b><small>Gravity on, gravity off</small></Link></li>
              </ul>
            </div>
          </div>
        )}
        {path === "analyst" && (
          <div className={s.analyst}>
            <div>
              <p className={s.promise}>What does NASA actually know under your mission conditions?</p>
              <p className={s.body}>Set atmosphere, gravity, material and ventilation. Every NASA record is sorted into direct, analogous, mechanistic or missing evidence, with ranking robustness and a printable brief.</p>
              <ul className={s.tiles}>
                <li><Link href="/mission?context=moon-base"><b>Mission Evidence</b><small>The Evidence Ladder</small></Link></li>
                <li><Link href="/model-lab"><b>AI Model Lab</b><small>ML that abstains</small></Link></li>
                <li><Link href="/gaps"><b>Research Frontier</b><small>What to test next</small></Link></li>
                <li><Link href="/compare"><b>Compare tests</b><small>One change at a time</small></Link></li>
              </ul>
            </div>
            <figure className={s.strip}>
              <svg viewBox="0 0 1000 90" preserveAspectRatio="none" aria-hidden="true">
                <rect x="0" y="38" width="1000" height="10" rx="5" className={s.stripRail} />
                {oxygen.map((r) => <rect key={r.id} x={X(r.o2) - 1.5} y="28" width="3" height="30" rx="1.5" data-family={r.family} className={s.stripTick} />)}
                <rect x={X(32.5)} y="16" width={X(35.5) - X(32.5)} height="54" rx="4" className={s.stripWindow} />
                <line x1={X(34)} x2={X(34)} y1="10" y2="76" className={s.stripMarker} />
              </svg>
              <figcaption>Oxygen in every NASA record in this atlas (14–36 %). The dashed window is exploration atmosphere A, 34 %: no record sits there.</figcaption>
            </figure>
          </div>
        )}
      </div>
    </section>
  );
}
