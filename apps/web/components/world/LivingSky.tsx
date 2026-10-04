"use client";

import { useEffect, useRef } from "react";
import { useExplorer } from "@/components/guide/EmberGuide";

/**
 * Ambient layer for the big scenes: an illustrated sky plate (slow cinematic push), a canvas
 * starfield with depth and the odd shooting star, and the floating astronaut with slight pointer
 * parallax. Decorative: aria-hidden and pointer-transparent. Stops when offscreen, in a hidden tab,
 * under reduced motion or the site's Pause motion switch (a still frame stays).
 */
export function LivingSky({ variant = "home" }: { variant?: "home" | "story" | "calm" }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const floatRef = useRef<HTMLImageElement>(null);
  const { gentle } = useExplorer();

  useEffect(() => {
    const canvas = canvasRef.current!, root = rootRef.current!;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const still = gentle || matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(devicePixelRatio, 1.5);
    let w = 0, h = 0, raf = 0, visible = true, last = performance.now();
    const count = innerWidth < 700 ? 70 : 150;
    const stars = Array.from({ length: count }, () => ({ x: Math.random(), y: Math.random(), z: 0.2 + Math.random() * 0.8, p: Math.random() * 6.28 }));
    let shoot: { x: number; y: number; t: number } | null = null;
    let px = 0, py = 0; // pointer parallax, -1..1

    const size = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const draw = (t: number, dt: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        if (!still) s.x = (s.x - dt * 0.004 * s.z + 1) % 1; // slow drift: nearer stars move faster
        const tw = still ? 0.8 : 0.55 + 0.45 * Math.sin(t / 900 + s.p);
        const x = s.x * w + px * 14 * s.z, y = s.y * h + py * 10 * s.z;
        ctx.globalAlpha = tw * (0.35 + s.z * 0.65);
        ctx.fillStyle = s.z > 0.85 ? "#ffe2b0" : "#dfe8ff";
        ctx.beginPath();
        ctx.arc(x, y, s.z * 1.4, 0, 6.283);
        ctx.fill();
      }
      if (!still) {
        if (!shoot && Math.random() < dt * 0.06) shoot = { x: Math.random() * w * 0.7 + w * 0.3, y: Math.random() * h * 0.4, t: 0 };
        if (shoot) {
          shoot.t += dt;
          const k = shoot.t / 0.9, x = shoot.x - k * 260, y = shoot.y + k * 120;
          const g = ctx.createLinearGradient(x, y, x + 90, y - 42);
          g.addColorStop(0, "rgba(255,226,176,0.9)");
          g.addColorStop(1, "rgba(255,226,176,0)");
          ctx.globalAlpha = 1 - k;
          ctx.strokeStyle = g;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 90, y - 42);
          ctx.stroke();
          if (k >= 1) shoot = null;
        }
      }
      ctx.globalAlpha = 1;
      if (floatRef.current) floatRef.current.style.translate = `${px * -18}px ${py * -12}px`; // CSSOM, allowed by the CSP
    };
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden) return;
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      draw(t, dt);
    };
    size();
    draw(performance.now(), 0);
    const ro = new ResizeObserver(() => { size(); draw(performance.now(), 0); });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; last = performance.now(); });
    io.observe(root);
    const fine = matchMedia("(pointer: fine)").matches;
    const onMove = (e: PointerEvent) => { px = e.clientX / innerWidth - 0.5; py = e.clientY / innerHeight - 0.5; };
    if (!still) {
      raf = requestAnimationFrame(loop);
      if (fine) addEventListener("pointermove", onMove);
    }
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      removeEventListener("pointermove", onMove);
    };
  }, [gentle]);

  return (
    <div ref={rootRef} className={`sky sky-${variant}`} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative CSS-animated layer, no layout shift */}
      <img src="/art/sky.webp" alt="" className="sky-plate" decoding="async" />
      <canvas ref={canvasRef} className="sky-stars" />
      <div className="sky-scrim" />
      {variant !== "calm" && (
        <div className="sky-floater">
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative */}
          <img ref={floatRef} src="/art/floater.webp" alt="" className="sky-floater-img" decoding="async" />
        </div>
      )}
      <p className="sky-credit">Illustration</p>
    </div>
  );
}
