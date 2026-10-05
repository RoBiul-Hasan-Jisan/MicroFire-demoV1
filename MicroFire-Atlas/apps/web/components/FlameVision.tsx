"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FLAG_TEXT, MEDIA_CONTEXT, type Analysis, type FrameMetrics, type MediaItem } from "@/lib/media";
import { motion } from "@/lib/motion";
import { useExplorer } from "@/components/guide/EmberGuide";

type Mode = "raw" | "vision" | "motion" | "measure";
type Highlight = "area" | "extent" | "centroid" | null;

const pct = (x: number) => `${(x * 100).toFixed(2)} %`;

/** Nearest analysed frame to video time t (frames are sampled at a fixed rate). */
export function frameAt(frames: FrameMetrics[], t: number) {
  if (!frames.length) return undefined;
  let lo = 0, hi = frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].t < t) lo = mid + 1;
    else hi = mid;
  }
  return lo > 0 && Math.abs(frames[lo - 1].t - t) < Math.abs(frames[lo].t - t) ? frames[lo - 1] : frames[lo];
}

export function FlameVision({ item, initialMode = "vision", compact = false, onInspect }: { item: MediaItem; initialMode?: Mode; compact?: boolean; onInspect?: () => void }) {
  const { discover, mode: audience } = useExplorer();
  const ctx = MEDIA_CONTEXT[item.slug];
  const video = useRef<HTMLVideoElement>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [t, setT] = useState(item.kind === "video" ? 3 : 0);
  const [playing, setPlaying] = useState(false);
  const [hl, setHl] = useState<Highlight>(null);
  const isVideo = item.kind === "video";
  const base = `/media/${item.slug}`;

  useEffect(() => {
    let alive = true;
    fetch(`${base}/analysis.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((a: Analysis) => alive && setAnalysis(a))
      .catch(() => alive && setError("The precomputed measurements could not be loaded. The NASA footage still plays."));
    return () => {
      alive = false;
    };
  }, [base]);

  // follow the video smoothly while it plays
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      if (video.current) setT(video.current.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const seek = useCallback((s: number) => {
    const v = video.current;
    if (v) v.currentTime = s;
    setT(s);
  }, []);

  const f = analysis ? frameAt(analysis.frames, t) : undefined;
  const mo = useMemo(() => (analysis && item.kind === "video" ? motion(analysis.frames, analysis.frame_size) : null), [analysis, item.kind]);
  const fi = analysis && f ? analysis.frames.indexOf(f) : -1;
  const m = mo && fi >= 0 ? mo.frames[fi] : null;
  const W0 = analysis?.frame_size[0] ?? 1;
  const dur = item.duration_s ?? 0;
  const step = analysis?.sample_fps ? 1 / analysis.sample_fps : 0.2;
  const showOverlay = mode !== "raw" && f;

  return (
    <div className={`grid gap-6 ${compact ? "" : "xl:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]"}`}>
      <div className="min-w-0">
        <p className="text-sm text-muted mb-3">{audience === "pro" ? "Classical OpenCV segmentation; no trained fire-prediction model." : "The computer traces bright and blue flame pixels frame by frame."} Not yet validated against hand-annotated real frames.</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div data-guide="fv-modes" role="tablist" aria-label="View mode" className="inline-flex rounded-full border border-rule-strong p-1 bg-panel">
            {(
              [
                ["raw", "Raw footage"],
                ["vision", audience === "pro" ? "Computer vision measurement" : "Flame Vision"],
                ...(isVideo ? ([["motion", "Motion"]] as [Mode, string][]) : []),
                ["measure", "Measurements"],
              ] as [Mode, string][]
            ).map(([m, label]) => (
              <button
                key={m}
                data-mode={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => { setMode(m); if (m !== "raw" && f) discover("aivision"); }}
                className={`px-4 py-1.5 rounded-full text-sm ${mode === m ? "bg-signal text-void font-semibold" : "text-muted hover:text-ink"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-faint">NASA footage. Overlays are this site&apos;s computed measurements.</p>
        </div>

        <div data-guide="fv-video" className="mt-3 relative rounded-xl overflow-hidden border border-rule-strong bg-black fv-frame">
          {isVideo ? (
            <video
              ref={video}
              src={`${base}/video.mp4`}
              poster={`${base}/poster.jpg`}
              muted
              playsInline
              preload="metadata"
              className="block w-full h-auto"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              onLoadedMetadata={(e) => (e.currentTarget.currentTime = t)}
              onSeeked={(e) => !playing && setT(e.currentTarget.currentTime)}
              aria-label={`NASA video: ${item.title}`}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- static NASA still, sized by the overlay frame
            <img src={`${base}/image.jpg`} alt={`NASA photograph: ${item.title}`} className="block w-full h-auto" />
          )}
          {showOverlay && analysis && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
              <rect
                x={analysis.roi[0]}
                y={analysis.roi[1]}
                width={analysis.roi[2] - analysis.roi[0]}
                height={analysis.roi[3] - analysis.roi[1]}
                fill="none"
                stroke="#56d4e4"
                strokeOpacity=".35"
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
              />
              {f.outlines.map((o, i) => (
                <polygon
                  key={i}
                  points={o.map((p) => p.join(",")).join(" ")}
                  fill={hl === "area" ? "rgba(240,160,68,0.35)" : "rgba(240,160,68,0.08)"}
                  stroke="#ffcf7a"
                  strokeWidth={hl === "area" ? 2.5 : 1.5}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {f.bbox && (
                <rect
                  x={f.bbox[0]}
                  y={f.bbox[1]}
                  width={f.bbox[2] - f.bbox[0]}
                  height={f.bbox[3] - f.bbox[1]}
                  fill="none"
                  stroke="#56d4e4"
                  strokeWidth={hl === "extent" ? 2.5 : 1.2}
                  strokeDasharray={hl === "extent" ? undefined : "6 4"}
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {mode === "motion" && analysis && (
                <g>
                  <polyline
                    points={analysis.frames.filter((x) => x.t <= t && x.centroid && !x.flags.includes("weak_or_no_flame")).map((x) => x.centroid!.join(",")).join(" ")}
                    fill="none" stroke="#c7b8ff" strokeWidth="2" strokeOpacity=".85" vectorEffect="non-scaling-stroke"
                  />
                  {m?.leadPx != null && (
                    <line x1={m.leadPx / W0} x2={m.leadPx / W0} y1={analysis.roi[1]} y2={analysis.roi[3]} stroke="#ff8a5a" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
                  )}
                </g>
              )}
              {f.centroid && (
                <g stroke="#ffffff" strokeWidth={hl === "centroid" ? 2.5 : 1.5} vectorEffect="non-scaling-stroke">
                  <line x1={f.centroid[0] - 0.02} x2={f.centroid[0] + 0.02} y1={f.centroid[1]} y2={f.centroid[1]} vectorEffect="non-scaling-stroke" />
                  <line x1={f.centroid[0]} x2={f.centroid[0]} y1={f.centroid[1] - 0.03} y2={f.centroid[1] + 0.03} vectorEffect="non-scaling-stroke" />
                </g>
              )}
            </svg>
          )}
          {showOverlay && (
            <span className="absolute left-3 top-3 text-[11px] px-2 py-1 rounded bg-black/70 text-signal num">
              {isVideo ? `t = ${f!.t.toFixed(1)} s (video time)` : "single photograph"} · {analysis?.version}
            </span>
          )}
          {mode === "motion" && mo && (
            <span className="absolute right-3 top-3 text-[11px] px-2 py-1 rounded bg-black/70 text-[#c7b8ff]">
              {mo.direction === "none" ? "No consistent horizontal travel" : `Travels ${mo.direction}ward`} · {Math.round(mo.reliableShare * 100)}% of frames flag-free
            </span>
          )}
        </div>

        {isVideo && (
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => (video.current?.paused ? video.current.play() : video.current?.pause())}
              className="game-btn !px-4"
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? "Pause" : "Play"}
            </button>
            <button onClick={() => seek(Math.max(0, t - step))} className="game-btn" aria-label="Back one analysed frame">‹</button>
            <button onClick={() => seek(Math.min(dur, t + step))} className="game-btn" aria-label="Forward one analysed frame">›</button>
            <input
              type="range"
              min={0}
              max={dur}
              step={0.05}
              value={t}
              onChange={(e) => seek(Number(e.target.value))}
              className="flex-1 accent-[var(--signal)]"
              aria-label="Scrub through the video"
            />
            <span className="text-xs text-muted num w-20 text-right">
              {t.toFixed(1)} / {dur.toFixed(0)} s
            </span>
          </div>
        )}

        {compact && f && <div className="exp-metrics" aria-label="Inspect a measurement">
          {([['area', 'Flame area', `${f.area_px.toLocaleString()} pixels`], ['extent', 'Width × height', `${f.width_px ?? '—'} × ${f.height_px ?? '—'} px`], ['centroid', 'Flame center', 'Locate it']] as const).map(([key, label, value]) => <button key={key} aria-pressed={hl === key} onClick={() => { setMode('measure'); setHl(key); discover('aivision'); onInspect?.(); }}><span>{label}</span><strong>{value}</strong></button>)}
          <p>Pixels are picture units, not centimetres. Outline: computer vision, not a prediction.</p>
        </div>}
        {error && <p className="mt-3 text-sm text-flame">{error}</p>}
        {!analysis && !error && <p className="mt-3 text-sm text-muted animate-pulse">Loading measurements…</p>}

        {mode === "motion" && analysis && mo && !compact && (
          <div className="mt-6">
            <p className="text-sm text-muted max-w-[72ch]">
              Purple: the path of the flame centre so far. Orange: the leading edge in the direction of travel. Image-domain measurement; no physical
              spatial calibration available, and speeds are per second of video time.
            </p>
            <div data-guide="fv-motion" className="mt-4 grid gap-6 md:grid-cols-2">
              <Chart title="Flame centre, horizontal position (px)" frames={analysis.frames}
                series={[{ key: "cx", label: "Centre x", color: "#c7b8ff", get: (x) => (x.centroid && !x.flags.includes("weak_or_no_flame") ? x.centroid[0] * W0 : null) }]}
                format={(v) => `${v.toFixed(0)} px`} t={t} onSeek={seek} />
              <Chart title="Flame area change (px² per second of video)" frames={analysis.frames}
                series={[{ key: "ar", label: "Area change rate", color: "#ffcf7a", get: (x) => mo.frames[analysis.frames.indexOf(x)]?.areaRate ?? null }]}
                format={(v) => `${v.toFixed(0)} px²/s`} t={t} onSeek={seek} />
              {mo.direction !== "none" && (
                <Chart title={`Leading-edge advance, ${mo.direction}ward (px per second of video)`} frames={analysis.frames}
                  series={[{ key: "ls", label: "Edge advance", color: "#ff8a5a", get: (x) => mo.frames[analysis.frames.indexOf(x)]?.leadSpeed ?? null }]}
                  format={(v) => `${v.toFixed(1)} px/s`} t={t} onSeek={seek} />
              )}
              <Chart title="Mean brightness inside the flame (0 to 255)" frames={analysis.frames}
                series={[{ key: "br", label: "Brightness", color: "#56d4e4", get: (x) => x.mean_brightness ?? null }]}
                format={(v) => `${v.toFixed(0)}`} t={t} onSeek={seek} />
            </div>
            <p className="mt-3 text-xs text-faint">
              {Math.round(mo.reliableShare * 100)}% of analysed frames carry no quality flag. Overexposed frames still locate the flame, but their
              brightness saturates, so the brightness trace is a proxy at best.
            </p>
          </div>
        )}

        {mode === "measure" && analysis && isVideo && !compact && (
          <div data-guide="fv-charts" className="mt-6 grid gap-6 md:grid-cols-2">
            <Chart
              title="Flame area, share of the analysed region"
              frames={analysis.frames}
              series={[
                { key: "total", label: "All flame", color: "#ffcf7a", get: (x) => x.area_frac },
                { key: "blue", label: "Dim blue flame", color: "#5b8cff", get: (x) => x.blue_px / ((analysis.roi[2] - analysis.roi[0]) * (analysis.roi[3] - analysis.roi[1]) * analysis.frame_size[0] * analysis.frame_size[1]) },
              ]}
              format={(v) => `${(v * 100).toFixed(1)}%`}
              t={t}
              onSeek={seek}
            />
            <Chart
              title="Horizontal extent: left and right flame edges"
              frames={analysis.frames}
              series={[
                { key: "left", label: "Left edge", color: "#56d4e4", get: (x) => x.bbox?.[0] ?? null },
                { key: "right", label: "Right edge", color: "#f0a044", get: (x) => x.bbox?.[2] ?? null },
              ]}
              format={(v) => `${(v * 100).toFixed(0)}% of width`}
              t={t}
              onSeek={seek}
            />
          </div>
        )}
      </div>

      {!compact && (
        <aside className="space-y-6">
          <section data-guide="fv-metrics" className="bg-panel border border-rule rounded-xl p-5" aria-labelledby="fv-now">
            <h2 id="fv-now" className="font-semibold">
              {isVideo ? "This frame" : "This photograph"}
            </h2>
            {f ? (
              <dl className="mt-3 text-sm divide-y divide-rule">
                <Metric k="area" label="Flame area" hl={hl} setHl={setHl} value={`${f.area_px.toLocaleString()} px (${pct(f.area_frac)} of region)`} />
                <Metric k="area" label="Luminous / dim blue" hl={hl} setHl={setHl} value={`${f.luminous_px.toLocaleString()} / ${f.blue_px.toLocaleString()} px`} />
                <Metric k="extent" label="Width × height" hl={hl} setHl={setHl} value={f.width_px ? `${f.width_px} × ${f.height_px} px` : "no flame"} />
                <Metric k="extent" label="Aspect ratio (w/h)" hl={hl} setHl={setHl} value={f.width_px && f.height_px ? (f.width_px / f.height_px).toFixed(2) : "—"} />
                <Metric k="centroid" label="Centroid (x, y)" hl={hl} setHl={setHl} value={f.centroid ? `${f.centroid[0].toFixed(2)}, ${f.centroid[1].toFixed(2)} of frame` : "—"} />
                <Metric k={null} label="Separate regions" hl={hl} setHl={setHl} value={String(f.regions)} />
                <Metric k={null} label="Mean brightness" hl={hl} setHl={setHl} value={f.mean_brightness != null ? `${f.mean_brightness} / 255` : "—"} />
                {m && <Metric k={null} label="Leading edge" hl={hl} setHl={setHl} value={m.leadPx != null ? `${m.leadPx.toFixed(0)} px` : mo?.direction === "none" ? "no consistent travel" : "—"} />}
                {m && <Metric k={null} label="Edge advance" hl={hl} setHl={setHl} value={m.leadSpeed != null ? `${m.leadSpeed.toFixed(1)} px/s` : "—"} />}
                {m && <Metric k={null} label="Area change" hl={hl} setHl={setHl} value={m.areaRate != null ? `${m.areaRate.toFixed(0)} px²/s` : "—"} />}
                <Metric k={null} label="Frame quality" hl={hl} setHl={setHl} value={f.flags.length ? "flagged (see below)" : "no quality flag"} />
              </dl>
            ) : (
              <p className="mt-2 text-sm text-muted">Waiting for measurements.</p>
            )}
            <p className="mt-3 text-xs text-faint">Hover or focus a metric to highlight what it measures on the image.</p>
            {f && f.flags.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-flame">
                {f.flags.map((x) => (
                  <li key={x}>Caution: {FLAG_TEXT[x] ?? x}</li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-muted">
              Units are pixels of the analysed {analysis?.frame_size?.join(" × ")} rendition. NASA publishes no spatial calibration for this
              footage, so no length is converted to centimetres.
            </p>
          </section>

          <section className="bg-panel border border-rule rounded-xl p-5 text-sm" aria-labelledby="fv-src">
            <h2 id="fv-src" className="font-semibold">Evidence</h2>
            <p className="mt-2">{ctx?.experiment}</p>
            <p className="mt-2 text-muted">{ctx?.knownConditions}</p>
            <p className="mt-2 text-flame">{ctx?.unknown}</p>
            <blockquote className="mt-3 text-muted border-l-2 border-rule-strong pl-3">“{item.description.slice(0, 420)}{item.description.length > 420 ? "…" : ""}”</blockquote>
            <p className="mt-3">
              <a href={item.page_url} target="_blank" rel="noreferrer" className="link">
                NASA Image and Video Library: {item.nasa_id}
              </a>
              <span className="block text-xs text-faint mt-1">
                {item.center}, {item.date_created}. {item.licence}
              </span>
            </p>
          </section>

          {analysis && (
            <details className="bg-panel border border-rule rounded-xl p-5 text-sm">
              <summary className="font-semibold cursor-pointer">How this was measured</summary>
              <ul className="mt-3 space-y-1.5 text-muted">
                <li>Pipeline {analysis.version}, OpenCV {analysis.opencv}, run {analysis.generated}.</li>
                <li>Region of interest: {analysis.roi_note}</li>
                {analysis.blue_note && <li>{analysis.blue_note}</li>}
                <li>Luminous flame: bright, warm pixels. Dim blue flame: blue-dominant pixels. Then morphological cleanup and removal of regions under 12 px.</li>
                <li>{isVideo ? `Sampled at ${analysis.sample_fps} frames per second of video time.` : "Single image."}</li>
                <li className="break-all">Input SHA-256: {analysis.input_sha256}</li>
              </ul>
            </details>
          )}
        </aside>
      )}
    </div>
  );
}

function Metric({ k, label, value, hl, setHl }: { k: Highlight; label: string; value: string; hl: Highlight; setHl: (h: Highlight) => void }) {
  return (
    <div
      tabIndex={k ? 0 : -1}
      onMouseEnter={() => k && setHl(k)}
      onMouseLeave={() => setHl(null)}
      onFocus={() => k && setHl(k)}
      onBlur={() => setHl(null)}
      className={`flex justify-between gap-4 py-2 px-1 rounded ${k && hl === k ? "bg-panel-2" : ""}`}
    >
      <dt className="text-muted">{label}</dt>
      <dd className="num text-right">{value}</dd>
    </div>
  );
}

type Series = { key: string; label: string; color: string; get: (f: FrameMetrics) => number | null };

/** Small SVG line chart; clicking it seeks the video to that time. */
function Chart({ title, frames, series, format, t, onSeek }: { title: string; frames: FrameMetrics[]; series: Series[]; format: (v: number) => string; t: number; onSeek: (s: number) => void }) {
  const W = 520, H = 180, P = { l: 8, r: 8, t: 10, b: 22 };
  const tMax = frames[frames.length - 1]?.t || 1;
  const vals = series.flatMap((s) => frames.map((f) => s.get(f)).filter((v): v is number => v != null));
  const vMax = Math.max(1e-6, ...vals);
  const vMin = Math.min(0, ...vals); // rates can be negative: show retreats instead of clipping them
  const x = (tt: number) => P.l + (tt / tMax) * (W - P.l - P.r);
  const y = (v: number) => P.t + (1 - (v - vMin) / (vMax - vMin)) * (H - P.t - P.b);
  const paths = useMemo(
    () =>
      series.map((s) => {
        let d = "", pen = false;
        for (const f of frames) {
          const v = s.get(f);
          if (v == null) {
            pen = false;
            continue;
          }
          d += `${pen ? "L" : "M"}${x(f.t).toFixed(1)},${y(v).toFixed(1)}`;
          pen = true;
        }
        return d;
      }),
    [frames, series], // eslint-disable-line react-hooks/exhaustive-deps -- x/y derive from these
  );
  return (
    <figure className="m-0 bg-panel border border-rule rounded-xl p-4">
      <figcaption className="text-sm font-medium">{title}</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2 w-full h-auto cursor-crosshair"
        role="img"
        aria-label={`${title}. Click to jump the video to that time. Peak ${format(vMax)}.`}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          onSeek(Math.max(0, Math.min(tMax, ((px - P.l) / (W - P.l - P.r)) * tMax)));
        }}
      >
        <line x1={P.l} x2={W - P.r} y1={y(0)} y2={y(0)} stroke="var(--rule-strong)" />
        {paths.map((d, i) => (
          <path key={series[i].key} d={d} fill="none" stroke={series[i].color} strokeWidth="1.6" />
        ))}
        <line x1={x(t)} x2={x(t)} y1={P.t} y2={H - P.b} stroke="#ffffff" strokeOpacity=".7" strokeDasharray="3 3" />
        <text x={P.l} y={H - 6} fontSize="11" fill="var(--faint)">0 s</text>
        <text x={W - P.r} y={H - 6} fontSize="11" fill="var(--faint)" textAnchor="end">{tMax.toFixed(0)} s (video time)</text>
        <text x={W - P.r} y={P.t + 10} fontSize="11" fill="var(--faint)" textAnchor="end">peak {format(vMax)}</text>
      </svg>
      <ul className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <svg width="14" height="4" aria-hidden="true"><rect width="14" height="4" fill={s.color} /></svg>
            {s.label}
          </li>
        ))}
      </ul>
    </figure>
  );
}
