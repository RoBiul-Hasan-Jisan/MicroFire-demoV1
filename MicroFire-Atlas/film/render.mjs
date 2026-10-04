// Renders build/film.html frame by frame into build/video.mp4 (silent). Deterministic: frame i shows t = i / FPS.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const FPS = 25;
const out = fileURLToPath(new URL("./build/video.mp4", import.meta.url));
const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], { stdio: ["pipe", "inherit", "inherit"] });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto("file://" + fileURLToPath(new URL("./build/film.html", import.meta.url)), { waitUntil: "load" });
await p.evaluate(() => document.fonts.ready);
const N = Math.round(FPS * (await p.evaluate(() => window.DATA.total)));
for (let i = 0; i < N; i++) {
  await p.evaluate((t) => window.renderAt(t), i / FPS);
  const buf = await p.screenshot({ type: "jpeg", quality: 92 });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  if (i % 500 === 0) console.log(`frame ${i}/${N}`);
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
await b.close();
console.log("done", out);
