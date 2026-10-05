"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useExplorer } from "@/components/guide/EmberGuide";
import type { Analysis } from "@/lib/media";
import { Tabs } from "./Tabs";
import s from "./Home.module.css";

type Tab = "watch" | "measure" | "compare" | "explain";
const SLUG = "saffire-vi-pmma";
const PAGE = "https://images.nasa.gov/details/Saf-VI%20S8C3%2BC4%201-sided%20PMMA_unmapped_jpeg-20x%20no%20text";

export type FindingCard = { id: string; node: ReactNode; meta: string };

/**
 * The evidence instrument: watch NASA footage, measure it with classical computer vision, compare matched NASA tests,
 * and read NASA's own findings. One region; the tabs change what it shows.
 */
export function EvidenceExperience({ compareStage, compareCopy, explainStage, findings }: { compareStage: ReactNode; compareCopy: ReactNode; explainStage: ReactNode; findings: FindingCard[] }) {
  const [tab, setTab] = useState<Tab>("watch");
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [user, setUser] = useState<boolean | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [failed, setFailed] = useState(false);
  const [fi, setFi] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const touch = useRef<number | null>(null);
  const { gentle } = useExplorer();
  const onVideo = tab === "watch" || tab === "measure";

  // play only while visible and on a video tab; never under reduced motion or Pause motion unless the viewer asks
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const still = gentle || matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!onVideo) { v.pause(); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && (user ?? !still)) v.play().catch(() => {}); else v.pause(); }, { threshold: 0.35 });
    io.observe(v);
    return () => io.disconnect();
  }, [gentle, user, onVideo]);

  // the measurements are fetched only when someone opens Measure
  useEffect(() => {
    if (tab !== "measure" || analysis || failed) return;
    fetch(`/media/${SLUG}/analysis.json`).then((r) => (r.ok ? r.json() : Promise.reject())).then(setAnalysis).catch(() => setFailed(true));
  }, [tab, analysis, failed]);

  const frame = useMemo(() => {
    if (!analysis) return null;
    const step = 1 / (analysis.sample_fps ?? 5);
    return analysis.frames[Math.min(analysis.frames.length - 1, Math.max(0, Math.round(t / step)))];
  }, [analysis, t]);
  const spark = useMemo(() => {
    if (!analysis) return null;
    const max = Math.max(...analysis.frames.map((f) => f.area_px)) || 1, end = analysis.frames[analysis.frames.length - 1].t || 1;
    return { d: analysis.frames.map((f, i) => `${i ? "L" : "M"}${(f.t / end) * 300} ${60 - (f.area_px / max) * 56}`).join(" "), end };
  }, [analysis]);

  const toggle = () => { const v = video.current!; if (v.paused) { setUser(true); v.play().catch(() => {}); } else { setUser(false); v.pause(); } };
  const go = (n: number) => setFi((n + findings.length) % findings.length);

  return (
    <section className={s.evidence} aria-labelledby="evidence-title">
      <div className={s.evidenceHead}>
        <div>
          <h2 id="evidence-title" className={s.h2}>Experience the evidence</h2>
          <p className={s.sub}>Real NASA footage, computer-vision measurements, matched NASA tests and NASA&apos;s own findings, in one instrument.</p>
        </div>
        <Tabs id="evidence" label="Evidence instrument" value={tab} onChange={setTab} className={s.evTabs}
          items={[{ id: "watch", label: "Watch", sub: "NASA footage" }, { id: "measure", label: "Measure", sub: "Computer vision" }, { id: "compare", label: "Compare", sub: "Matched tests" }, { id: "explain", label: "Explain", sub: "NASA findings" }]} />
      </div>

      <div className={s.evBody}>
        <div className={s.stage} data-tab={tab}>
          <figure className={s.film} hidden={!onVideo}>
            <video ref={video} src={`/media/${SLUG}/video.mp4`} poster={`/media/${SLUG}/poster.jpg`} muted loop playsInline preload="none"
              onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={(e) => tab === "measure" && setT(e.currentTarget.currentTime)}
              aria-label="NASA video: a PMMA sample burning during Saffire VI" />
            {tab === "measure" && frame && analysis && (
              <svg className={s.overlay} viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
                <rect x={analysis.roi[0]} y={analysis.roi[1]} width={analysis.roi[2] - analysis.roi[0]} height={analysis.roi[3] - analysis.roi[1]} className={s.roi} />
                {frame.bbox && <rect x={frame.bbox[0]} y={frame.bbox[1]} width={frame.bbox[2] - frame.bbox[0]} height={frame.bbox[3] - frame.bbox[1]} className={s.bbox} />}
                {frame.outlines.map((o, i) => <polygon key={i} points={o.map(([x, y]) => `${x},${y}`).join(" ")} className={s.outline} />)}
              </svg>
            )}
            <span className={s.badge}>{tab === "measure" ? "Computed outline · pixels" : "Real NASA video"}</span>
            <button type="button" className={s.play} onClick={toggle} aria-label={playing ? "Pause the NASA video" : "Play the NASA video"}>{playing ? "❚❚" : "▶"}</button>
            <figcaption className={s.filmCap}>Saffire VI · NASA Image and Video Library · shown as NASA released it{tab === "measure" && frame ? ` · frame ${frame.t.toFixed(1)} s` : ""}</figcaption>
          </figure>
          {tab === "compare" && <div className={s.plot}>{compareStage}</div>}
          {tab === "explain" && <div className={s.pair}>{explainStage}</div>}
        </div>

        <div id="evidence-panel" role="tabpanel" aria-labelledby={`evidence-tab-${tab}`} className={s.console} key={tab}>
          {tab === "watch" && (
            <>
              <p className={s.consoleKicker}>NASA observation</p>
              <h3 className={s.consoleTitle}>This isn&apos;t animation. NASA burned this material in space.</h3>
              <p>Saffire VI, inside an uncrewed Cygnus cargo ship at the end of the NG-19 mission: a one-sided PMMA sample, filmed by NASA and shown at the speed NASA released it.</p>
              <dl className={s.facts}>
                <div><dt>Experiment</dt><dd>Saffire VI</dd></div>
                <div><dt>Material</dt><dd>PMMA, burning on one side</dd></div>
                <div><dt>Not stated</dt><dd>Oxygen, pressure and airflow for this clip</dd></div>
              </dl>
              <p className={s.consoleLinks}><a href={PAGE} target="_blank" rel="noreferrer" className="link">NASA Image and Video Library ↗</a> <button type="button" className={s.next} onClick={() => setTab("measure")}>Measure it →</button></p>
            </>
          )}
          {tab === "measure" && (
            <>
              <p className={s.consoleKicker}>Classical computer vision (OpenCV)</p>
              <h3 className={s.consoleTitle}>The flame, measured frame by frame</h3>
              {failed ? <p>The measurements could not be loaded. <Link className="link" href={`/analyze/${SLUG}`}>Open Flame Vision</Link>.</p> : !frame ? <p aria-busy="true">Loading NASA footage measurements…</p> : (
                <>
                  <dl className={s.readings} aria-live="off">
                    <div><dt>Video time</dt><dd className="num">{frame.t.toFixed(1)} s</dd></div>
                    <div><dt>Flame area</dt><dd className="num">{frame.area_px.toLocaleString("en-US")} px</dd></div>
                    <div><dt>Width × height</dt><dd className="num">{frame.width_px ?? "–"} × {frame.height_px ?? "–"} px</dd></div>
                    <div><dt>Dim blue share</dt><dd className="num">{frame.area_px ? Math.round((frame.blue_px / frame.area_px) * 100) : 0} %</dd></div>
                  </dl>
                  {spark && (
                    <svg viewBox="0 0 300 64" className={s.spark} role="img" aria-label="Flame area in pixels over the whole clip">
                      <path d={spark.d} className={s.sparkLine} />
                      <line x1={(frame.t / spark.end) * 300} x2={(frame.t / spark.end) * 300} y1="0" y2="64" className={s.sparkHead} />
                    </svg>
                  )}
                  <p className={s.small}>Units are pixels of NASA&apos;s {analysis!.frame_size.join(" × ")} release. NASA publishes no spatial calibration, so MicroFire reports no centimetres.</p>
                </>
              )}
              <p className={s.consoleLinks}><Link className="link" href={`/analyze/${SLUG}`}>Open Flame Vision</Link> <button type="button" className={s.next} onClick={() => setTab("compare")}>Compare tests →</button></p>
            </>
          )}
          {tab === "compare" && (
            <>
              <p className={s.consoleKicker}>Matched NASA tests · BASS-II</p>
              {compareCopy}
              <p className={s.consoleLinks}><Link className="link" href="/compare?preset=pmma-flow-window">Open the comparison</Link> <button type="button" className={s.next} onClick={() => setTab("explain")}>What NASA concluded →</button></p>
            </>
          )}
          {tab === "explain" && (
            <div onTouchStart={(e) => (touch.current = e.touches[0].clientX)} onTouchEnd={(e) => { if (touch.current == null) return; const dx = e.changedTouches[0].clientX - touch.current; if (Math.abs(dx) > 40) go(fi + (dx < 0 ? 1 : -1)); touch.current = null; }}>
              <p className={s.consoleKicker}>What NASA found · {fi + 1} of {findings.length}</p>
              <div className={s.finding} aria-live="polite" key={findings[fi].id}>
                <p className={s.findingMeta}>{findings[fi].meta}</p>
                {findings[fi].node}
              </div>
              <div className={s.rail2}>
                <button type="button" onClick={() => go(fi - 1)} aria-label="Previous finding">←</button>
                <span className={s.dots} aria-hidden="true">{findings.map((f, i) => <i key={f.id} data-on={i === fi || undefined} />)}</span>
                <button type="button" onClick={() => go(fi + 1)} aria-label="Next finding">→</button>
                <Link className="link" href="/sources">All sources</Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
