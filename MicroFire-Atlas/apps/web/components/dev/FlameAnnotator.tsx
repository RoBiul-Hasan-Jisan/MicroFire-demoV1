"use client";
import { useEffect, useRef, useState } from "react";
import { saveAnnotation } from "@/app/dev/flame-annotation/actions";
import styles from "./FlameAnnotator.module.css";

/**
 * Paints a binary mask at the frame's native resolution. The mask is a Uint8Array painted with integer
 * pixel maths, never canvas strokes, so the exported PNG holds exactly 0 and 255 (no antialiasing).
 */
export default function FlameAnnotator({ id, width: W, height: H, label, sourceUrl }: { id: string; width: number; height: number; label: string; sourceUrl: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const frame = useRef<ImageData | null>(null);
  const mask = useRef<Uint8Array<ArrayBuffer>>(new Uint8Array(W * H));
  const undo = useRef<Uint8Array<ArrayBuffer>[]>([]);
  const last = useRef<[number, number] | null>(null);
  const [radius, setRadius] = useState(6);
  const [erase, setErase] = useState(false);
  const [show, setShow] = useState(true);
  const [painted, setPainted] = useState(0);
  const [status, setStatus] = useState("");
  const [meta, setMeta] = useState({ reviewer: "", approved: false, valid: true, overexposed: false, direction: "", flameClass: "union", notes: "" });

  const draw = () => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx || !frame.current) return;
    const out = new ImageData(new Uint8ClampedArray(frame.current.data), W, H);
    if (show) for (let i = 0; i < W * H; i++) if (mask.current[i]) {
      const o = i * 4; out.data[o] = (out.data[o] + 0) >> 1; out.data[o + 1] = (out.data[o + 1] + 255) >> 1; out.data[o + 2] = (out.data[o + 2] + 255) >> 1;
    }
    ctx.putImageData(out, 0, 0);
  };

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const ctx = canvas.current?.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      frame.current = ctx.getImageData(0, 0, W, H);
      draw();
    };
    img.onerror = () => setStatus("Frame image missing. Run select_candidates.py.");
    img.src = `/dev/flame-annotation/frame/${id}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(draw, [show]);

  const at = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [Math.floor(((e.clientX - r.left) / r.width) * W), Math.floor(((e.clientY - r.top) / r.height) * H)];
  };
  const dab = (cx: number, cy: number) => {
    const v = erase ? 0 : 1;
    for (let y = Math.max(0, cy - radius); y <= Math.min(H - 1, cy + radius); y++)
      for (let x = Math.max(0, cx - radius); x <= Math.min(W - 1, cx + radius); x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= radius * radius) mask.current[y * W + x] = v;
  };
  const stroke = (p: [number, number]) => {
    const [x0, y0] = last.current ?? p;
    const steps = Math.max(1, Math.ceil(Math.hypot(p[0] - x0, p[1] - y0) / Math.max(1, radius / 2)));
    for (let s = 0; s <= steps; s++) dab(Math.round(x0 + ((p[0] - x0) * s) / steps), Math.round(y0 + ((p[1] - y0) * s) / steps));
    last.current = p;
    draw();
  };
  const finish = () => { last.current = null; setPainted(mask.current.reduce((n, v) => n + v, 0)); };

  const save = async () => {
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const img = new ImageData(W, H);
    for (let i = 0; i < W * H; i++) { const v = mask.current[i] ? 255 : 0; img.data.set([v, v, v, 255], i * 4); }
    c.getContext("2d")!.putImageData(img, 0, 0);
    const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/png"));
    if (!blob) return setStatus("Could not encode the mask.");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const r = await saveAnnotation({ id, truthPngBase64: btoa(bin), ...meta });
    setStatus(r.message);
  };

  return (
    <section className={styles.work} aria-label={`Annotate ${label}`}>
      <p className={styles.label}>{label} · <a href={sourceUrl}>NASA source</a> · {W}×{H} px</p>
      <canvas ref={canvas} width={W} height={H} className={styles.canvas}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); undo.current = [...undo.current.slice(-19), mask.current.slice()]; stroke(at(e)); }}
        onPointerMove={(e) => { if (e.buttons) stroke(at(e)); }}
        onPointerUp={finish} onPointerCancel={finish} />
      <div className={styles.tools}>
        <label>Brush {radius} px <input type="range" min={1} max={30} value={radius} onChange={(e) => setRadius(+e.target.value)} /></label>
        <button type="button" aria-pressed={!erase} onClick={() => setErase(false)}>Paint flame</button>
        <button type="button" aria-pressed={erase} onClick={() => setErase(true)}>Erase</button>
        <button type="button" onClick={() => { const u = undo.current.pop(); if (u) { mask.current = u; draw(); finish(); } }}>Undo</button>
        <button type="button" onClick={() => { undo.current.push(mask.current.slice()); mask.current = new Uint8Array(W * H); draw(); finish(); }}>Clear</button>
        <label><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show my mask</label>
        <span>{painted.toLocaleString()} px marked</span>
      </div>
      <form className={styles.form} onSubmit={(e) => { e.preventDefault(); save(); }}>
        <label>Reviewer name <input required value={meta.reviewer} onChange={(e) => setMeta({ ...meta, reviewer: e.target.value })} /></label>
        <label>Flame class
          <select value={meta.flameClass} onChange={(e) => setMeta({ ...meta, flameClass: e.target.value })}>
            <option value="union">luminous and blue (union)</option><option value="luminous">luminous only</option><option value="blue">blue only</option>
          </select>
        </label>
        <label>Leading-edge direction
          <select required value={meta.direction} onChange={(e) => setMeta({ ...meta, direction: e.target.value })}>
            <option value="">choose…</option><option value="right">right</option><option value="left">left</option><option value="up">up</option><option value="down">down</option>
          </select>
        </label>
        <label><input type="checkbox" checked={meta.valid} onChange={(e) => setMeta({ ...meta, valid: e.target.checked })} /> Frame is usable for validation</label>
        <label><input type="checkbox" checked={meta.overexposed} onChange={(e) => setMeta({ ...meta, overexposed: e.target.checked })} /> Flame region is overexposed (excluded from scoring)</label>
        <label className={styles.wide}>Notes <textarea value={meta.notes} onChange={(e) => setMeta({ ...meta, notes: e.target.value })} /></label>
        <label className={styles.wide}><input type="checkbox" required checked={meta.approved} onChange={(e) => setMeta({ ...meta, approved: e.target.checked })} /> I drew this mask myself from the frame and approve it as a human annotation.</label>
        <button type="submit" className={styles.save}>Save annotation</button>
        <p role="status" className={styles.wide}>{status}</p>
      </form>
    </section>
  );
}
