"use client";

import { useCallback, useRef, useState } from "react";

export type Sfx = "tick" | "right" | "wrong" | "whoosh" | "snap" | "ignite" | "fanfare";

/** Tiny Web Audio synthesizer: no audio files, off by default. */
export function useSound() {
  const ctx = useRef<AudioContext | null>(null);
  const [on, setOn] = useState(false);
  const play = useCallback(
    (kind: Sfx) => {
      if (!on) return;
      ctx.current ??= new AudioContext();
      const a = ctx.current, t = a.currentTime;
      const tone = (hz: number, at: number, dur = 0.25, type: OscillatorType = "sine", vol = 0.12) => {
        const o = a.createOscillator(), g = a.createGain();
        o.type = type;
        o.frequency.setValueAtTime(hz, t + at);
        g.gain.setValueAtTime(0, t + at);
        g.gain.linearRampToValueAtTime(vol, t + at + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
        o.connect(g).connect(a.destination);
        o.start(t + at);
        o.stop(t + at + dur + 0.05);
      };
      const noise = (dur: number, from: number, to: number, vol = 0.18) => {
        const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
        const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
        f.type = "bandpass";
        f.frequency.setValueAtTime(from, t);
        f.frequency.exponentialRampToValueAtTime(to, t + dur);
        g.gain.setValueAtTime(vol, t);
        src.buffer = buf;
        src.connect(f).connect(g).connect(a.destination);
        src.start(t);
      };
      if (kind === "tick") tone(880, 0, 0.12);
      if (kind === "right") [660, 990].forEach((hz, i) => tone(hz, i * 0.09));
      if (kind === "wrong") [300, 220].forEach((hz, i) => tone(hz, i * 0.09, 0.25, "triangle"));
      if (kind === "whoosh") noise(0.6, 400, 1800);
      if (kind === "snap") { tone(180, 0, 0.08, "square", 0.08); tone(520, 0.05, 0.12); }
      if (kind === "ignite") { noise(1.2, 200, 3000, 0.25); tone(110, 0, 0.9, "sawtooth", 0.05); }
      if (kind === "fanfare") [523, 659, 784, 1047].forEach((hz, i) => tone(hz, i * 0.11, 0.35, "triangle", 0.1));
    },
    [on],
  );
  return { on, setOn, play };
}
