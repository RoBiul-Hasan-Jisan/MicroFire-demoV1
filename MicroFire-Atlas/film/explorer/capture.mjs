/**
 * Renders the real site frame by frame on a virtual clock, so the film is perfectly smooth at any resolution.
 *
 * Real-time screen capture stutters whenever Chrome pauses. Here nothing runs in real time:
 * - Playwright's clock drives the page's timers, requestAnimationFrame and Date (three.js, React timers);
 * - every CSS animation and transition is paused and set to the virtual time each frame (Web Animations API);
 * - playing videos are seeked to the virtual time each frame;
 * - scrolling and the cursor are tweened by this script, and clicks happen between frames.
 * Each frame is screenshotted at 2x (3840x2160) and piped straight into ffmpeg: build/<scene>.mp4.
 * Scene timing comes from the narration (build/timed.json), so picture and voice line up exactly.
 *
 *   SITE=http://localhost:3417 node capture.mjs [sceneId|all] [maxFrames]
 * The overlay (captions, cursor, explainer, end card) is recording-only; bypassCSP is a recording-only setting.
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const SITE = process.env.SITE ?? "http://localhost:3417";
const FPS = +(process.env.FPS ?? 60);
const SCALE = +(process.env.SCALE ?? 2); // 2 -> 3840x2160
const W = 1920, H = 1080;
const timed = JSON.parse(readFileSync("build/timed.json", "utf8"));
const [only, maxFrames] = [process.argv[2], +(process.argv[3] ?? 0)];
const OVERLAY = readFileSync(new URL("./overlay.js", import.meta.url), "utf8");

/** Runs inside the page each frame: CSS animations and videos follow the virtual clock; `fade` blacks out. */
const DRIVE = `window.__drive = async (fade) => {
  const now = performance.now();
  for (const a of document.getAnimations()) {
    if (a.__born == null) { a.__born = now; a.pause(); }
    a.currentTime = now - a.__born;
  }
  const seeks = [];
  for (const v of document.querySelectorAll("video")) {
    if (v.paused || v.readyState < 1) { v.__vt0 = null; continue; }
    if (v.__vt0 == null) { v.__vt0 = now; v.__ct0 = v.currentTime; v.playbackRate = 0.0625; }
    const target = Math.min(v.__ct0 + (now - v.__vt0) / 1000, (v.duration || 1e9) - 0.05);
    if (Math.abs(v.currentTime - target) > 0.001) {
      seeks.push(new Promise((ok) => { v.addEventListener("seeked", ok, { once: true }); setTimeout(ok, 800); }));
      v.currentTime = target;
    }
  }
  const f = document.getElementById("vox-fade"); if (f) f.style.opacity = String(fade);
  await Promise.all(seeks);
  return [scrollX, scrollY];
};`;
const FADE = `addEventListener("DOMContentLoaded", () => { const d = document.createElement("div"); d.id = "vox-fade";
  d.setAttribute("style", "position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:2147483647"); document.body.append(d); });`;

const b = await chromium.launch({ headless: true, channel: "chromium", args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required", "--hide-scrollbars"] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE, bypassCSP: true });
await ctx.addInitScript(() => {
  try { // the state a child has after pressing "Got it" on each page's crew tip
    const k = "microfire-explorer-v2", s = JSON.parse(localStorage.getItem(k) || "{}");
    s.tips = ["home", "story", "atlas", "analyze", "compare", "mission", "gaps", "ask", "methodology", "sources", "experiment", "expedition"];
    s.seen = [...s.tips, "saffire", "tour"]; // PIX's "show you around" nudge already answered
    localStorage.setItem(k, JSON.stringify(s));
  } catch {}
});
await ctx.addInitScript(OVERLAY);
await ctx.addInitScript(DRIVE);
await ctx.addInitScript(FADE);
await ctx.clock.install({ time: new Date("2026-10-02T12:00:00Z") });
await ctx.clock.pauseAt(new Date("2026-10-02T12:00:01Z"));
const p = await ctx.newPage();
p.setDefaultTimeout(8000);
const cdp = await ctx.newCDPSession(p);
const errs = [];
p.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));

const ease = (k) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2);
const btn = (name) => p.getByRole("button", { name }).first();
const nextBtn = () => btn(/Next discovery|Explore next chapter|See my discoveries/);
/** Load a page and let it settle on the virtual clock (fonts, images, hydration, entrance animations). */
const go = async (path) => {
  await p.goto(SITE + path, { waitUntil: "load", timeout: 45000 });
  await p.evaluate(() => document.fonts.ready);
  for (let i = 0; i < 12; i++) { await ctx.clock.runFor(50); await p.evaluate(() => window.__drive?.(0)); }
};

// Ask PIX: the real /api/ask answer is held until the moment the film wants it to land
let askRelease = null;
await p.route("**/api/ask", async (route) => {
  const res = await route.fetch();
  const body = await res.body();
  await new Promise((ok) => { askRelease = ok; });
  await route.fulfill({ response: res, body });
});

async function render(sc, setup, build, pos = "left") {
  if (setup) await setup();
  const events = [], tweens = [];
  let cursor = { x: W * 0.62, y: H * 0.58 };
  const at = (t, fn) => events.push({ t: Math.max(0, t), fn });
  const scrollTween = (t, d, y0, dy) => tweens.push({ t0: t, t1: t + d, apply: (u) => p.evaluate((y) => scrollTo(0, y), y0 + dy * ease(u)) });
  const S = {
    L: sc.lines.map((l) => l.at), lines: sc.lines, dur: sc.dur, at, tweens,
    go: (t, path) => at(t, () => go(path)),
    /** Scroll by dy over d seconds from t. */
    glide: (t, d, dy) => at(t, async () => scrollTween(t, d, await p.evaluate(() => scrollY), dy)),
    /** Scroll just enough to show the element's bottom, never far enough to reveal the site footer. */
    glideTo: (t, d, sel) => at(t, async () => {
      const [y0, dy] = await p.locator(sel).first().evaluate((el) => {
        const foot = [...document.querySelectorAll("footer")].pop();
        const room = (foot ? foot.getBoundingClientRect().top : document.documentElement.scrollHeight - scrollY) - innerHeight;
        return [scrollY, Math.max(0, Math.min(el.getBoundingClientRect().bottom - innerHeight * 0.86, room))];
      }).catch(() => [0, 0]);
      if (dy > 4) scrollTween(t, d, y0, dy);
    }),
    /** Scroll so the element's top sits at `frac` of the screen height. */
    glideEl: (t, d, sel, frac = 0.12) => at(t, async () => {
      const [y0, dy] = await p.locator(sel).first().evaluate((el, f) => [scrollY, el.getBoundingClientRect().top - innerHeight * f], frac).catch(() => [0, 0]);
      if (Math.abs(dy) > 4) scrollTween(t, d, y0, dy);
    }),
    /** Glide the cursor to (x, y). */
    point: (t, d, x, y) => at(t, () => {
      const a = { ...cursor };
      cursor = { x, y };
      tweens.push({ t0: t, t1: t + d, apply: (u) => p.mouse.move(a.x + (x - a.x) * ease(u), a.y + (y - a.y) * ease(u)) });
    }),
    /** A visible tap at t: the cursor travels for 0.55 s, a ripple marks the touch, then the control is clicked. */
    tap: (t, loc, label) => {
      const t0 = Math.max(0, t - 0.55);
      at(t0, async () => {
        const box = await loc().first().boundingBox().catch(() => null);
        if (!box || box.y < 0 || box.y + box.height > H) return;
        const a = { ...cursor }, x = box.x + box.width / 2, y = box.y + box.height / 2;
        cursor = { x, y };
        tweens.push({ t0, t1: t, apply: (u) => p.mouse.move(a.x + (x - a.x) * ease(u), a.y + (y - a.y) * ease(u)) });
      });
      at(t, async () => {
        try {
          const el = loc().first();
          await el.waitFor({ state: "attached", timeout: 8000 });
          await p.evaluate(([x, y]) => window.__voxTap?.(x, y), [cursor.x, cursor.y]);
          await el.evaluate((n) => n.click());
        } catch (e) { errs.push(`${sc.id} ${label}: ${String(e).split("\n")[0]}`); }
      });
    },
  };
  build(S);
  // captions follow the narration and are re-applied after any navigation
  let cap = "";
  if (pos !== "none") for (const l of sc.lines) {
    if (!l.cap) continue;
    at(l.at + 0.15, async () => { cap = l.cap; await p.evaluate(([t, x]) => { window.__voxPos?.(x); window.__vox?.(t); }, [cap, pos]); });
    at(Math.min(l.at + l.dur + 0.3, sc.dur - 0.3), async () => { cap = ""; await p.evaluate(() => window.__vox?.("")); });
  }
  events.sort((a, b) => a.t - b.t);
  await p.evaluate((x) => { window.__vox?.(""); window.__voxPos?.(x); }, pos);

  const N = maxFrames || Math.round(sc.dur * FPS);
  const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
    "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", "-r", String(FPS), `build/${sc.id}.mp4`], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((ok, bad) => ff.on("close", (c) => (c ? bad(new Error("ffmpeg " + c)) : ok())));
  const fin = sc.id === timed[0].id ? 0.8 : 0.18, fout = sc.id === timed[timed.length - 1].id ? 1.6 : 0.18;
  const started = Date.now();
  let ei = 0, askAt = null;
  for (let n = 0; n < N; n++) {
    const t = n / FPS;
    while (ei < events.length && events[ei].t <= t + 1e-6) {
      const before = p.url();
      await events[ei++].fn();
      if (p.url() !== before && cap) await p.evaluate(([c, x]) => { window.__voxPos?.(x); window.__vox?.(c); }, [cap, pos]);
    }
    for (const tw of tweens) if (t >= tw.t0 && t <= tw.t1 + 1 / FPS) await tw.apply(Math.min(1, (t - tw.t0) / (tw.t1 - tw.t0)));
    if (askRelease) { askAt ??= t + 1.1; if (t >= askAt) { askRelease(); askRelease = null; askAt = null; } }
    const fade = Math.max(t < fin ? 1 - t / fin : 0, t > sc.dur - fout ? (t - (sc.dur - fout)) / fout : 0);
    // the clip is in document coordinates, so it must follow the scroll position or scrolled pages come out black
    const [sx, sy] = (await p.evaluate((f) => window.__drive?.(f), Math.min(1, fade))) ?? [0, 0];
    const { data } = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 92, optimizeForSpeed: true, clip: { x: sx, y: sy, width: W, height: H, scale: SCALE } });
    if (!ff.stdin.write(Buffer.from(data, "base64"))) await new Promise((ok) => ff.stdin.once("drain", ok));
    await ctx.clock.runFor(Math.round(((n + 1) * 1000) / FPS) - Math.round((n * 1000) / FPS));
    if (n % (FPS * 5) === 0) process.stdout.write(`  ${sc.id} ${t.toFixed(0)}s/${sc.dur.toFixed(0)}s (${((Date.now() - started) / 1000 / (n + 1)).toFixed(2)} s/frame)\n`);
  }
  ff.stdin.end();
  await done;
  console.log(`${sc.id.padEnd(10)} ${N} frames in ${((Date.now() - started) / 1000).toFixed(0)} s`);
}

const scenes = {
  hook: [() => go("/"), (S) => {
    const card = (st) => () => p.evaluate((x) => window.__voxCard?.(x), st);
    S.at(S.L[0], card("earth")); S.at(S.L[2], card("space")); S.at(S.L[4], card("flow")); S.at(S.dur - 1.3, card(""));
  }],
  problem: [() => go("/experiments/bass2-B20"), (S) => { S.glide(S.L[1], 3.0, 520); S.glide(S.L[3], 2.2, -520); }],
  freefall: [async () => { await go("/story"); await p.evaluate(() => localStorage.clear()); await go("/story"); }, (S) => {
    const sheetNext = () => p.locator(".game-sheet button.story-cta");
    const duct = () => p.locator(".game-part", { hasText: "Flow duct" });
    S.tap(0.6, () => btn("Start the mission"), "start");
    S.tap(S.L[1], sheetNext, "hello-next");
    S.tap(S.L[1] + 2.6, () => btn("Switch off gravity"), "gravity");
    S.tap(S.L[2], sheetNext, "gravity-next");
    S.tap(S.L[2] + 1.6, duct, "duct-preview");
    S.tap(S.L[2] + 2.3, duct, "duct-install");
    S.tap(S.L[2] + 3.4, () => btn("Quick build"), "quick");
  }, "right"],
  adventure: [async () => { await go("/expedition"); await p.evaluate(() => localStorage.removeItem("microfire-spark-journey-v1")); await go("/expedition"); }, (S) => {
    S.point(S.L[1] + 1.2, 1.2, 1500, 480);
    S.tap(S.L[2], () => btn(/follow the spark/i), "follow");
  }],
  vision: [null, (S) => {
    S.tap(0.5, () => p.locator("button", { hasText: "Investigate this flame" }), "film");
    S.tap(1.6, () => p.getByRole("button", { name: "Play", exact: true }), "play");
    S.tap(S.L[1], () => p.getByRole("tab", { name: "AI vision" }), "vision");
    S.tap(S.L[1] + 2.8, () => p.locator(".exp-metrics button"), "metric");
    S.tap(S.L[2], () => p.getByRole("tab", { name: "Measurements" }), "measure");
  }],
  trace: [null, (S) => {
    S.tap(0.5, nextBtn, "next");
    S.tap(S.L[1], () => btn("Outline A"), "A");
    S.tap(S.L[2], () => btn("Outline B"), "B");
  }],
  predict: [null, (S) => {
    S.tap(0.5, nextBtn, "next");
    S.tap(S.L[1] + 1.4, () => btn("Less airflow"), "less");
    S.glideTo(S.L[2] + 0.6, 1.4, '[class*="predict"]');
    S.tap(S.L[3] + 1.0, () => btn("It went out"), "predict");
    S.glideTo(S.L[4] + 1.2, 1.6, '[class*="record"] blockquote');
  }],
  // the Evidence Ladder game: four real clues, each tapped then placed on its rung as the line describes it
  moon: [null, (S) => {
    const card = (t) => () => p.locator('ul[aria-label="Clue cards to sort"] button', { hasText: t });
    const rung = (r) => () => p.locator(`button[aria-label^="Place the selected clue on the ${r} rung"]`);
    S.tap(0.5, nextBtn, "next");
    S.glideTo(S.L[2], 1.4, 'ul[aria-label="Clue cards to sort"]');
    S.tap(S.L[3] + 0.3, card("Small flame"), "c-b20");
    S.tap(S.L[3] + 1.9, rung("Analogous"), "r-b20");
    S.tap(S.L[4] + 0.3, card("Tiny burning"), "c-flex");
    S.tap(S.L[4] + 2.2, rung("Mechanistic"), "r-flex");
    S.tap(S.L[5] - 0.2, card("Big fire"), "c-saffire");
    S.tap(S.L[5] + 0.6, rung("Analogous"), "r-saffire");
    S.tap(S.L[5] + 1.5, card("nobody has done"), "c-gap");
    S.tap(S.L[5] + 2.3, rung("Gap"), "r-gap");
    S.tap(S.L[6] + 1.2, nextBtn, "next2");
    S.tap(S.L[6] + 2.6, () => btn("We need more evidence for these conditions."), "answer");
  }],
  finale: [null, (S) => {
    S.tap(0.5, nextBtn, "next");
    S.tap(1.7, () => btn("What changed between B16, B20 and B19?"), "ask");
    S.tap(S.L[1], nextBtn, "finale");
    S.glideTo(S.L[2], 1.6, '[class*="debrief"]');
    S.tap(S.L[2] + 2.0, () => p.getByLabel(/Nickname/), "nick");
    [..."Ada"].forEach((ch, i) => S.at(S.L[2] + 2.3 + i * 0.16, () => p.keyboard.type(ch)));
  }],
  saffire: [() => go("/saffire"), (S) => {
    S.point(S.L[1] + 1.0, 1.4, 760, 520);
    S.glideEl(S.L[2] + 0.2, 2.2, `li[id^="saffire-"]`, 0.22); // the run cards, each value with its NASA table and page
    S.glideEl(S.L[3] - 0.3, 2.0, 'section[aria-labelledby="atm"]', 0.1); // back to the atmosphere map
  }],
  ladder: [async () => { await go("/mission?context=moon-base"); await p.evaluate(() => { document.documentElement.style.zoom = "1.25"; const el = document.getElementById("ladder-title"); scrollTo(0, el.getBoundingClientRect().top + scrollY - 120); }); }, (S) => {
    S.glide(S.L[1] + 0.2, 3.2, 380);
    S.at(S.L[2] - 1.0, async () => { // bring the first analogous card to the upper third, then open its "Why?" path
      const [y0, dy] = await p.locator("details summary", { hasText: "Why is this evidence shown?" }).nth(0).evaluate((el) => [scrollY, el.getBoundingClientRect().top - innerHeight * 0.28]);
      const tw = { t0: S.L[2] - 1.0, t1: S.L[2] - 0.1, apply: (u) => p.evaluate((y) => scrollTo(0, y), y0 + dy * ease(u)) };
      S.tweens.push(tw);
    });
    S.tap(S.L[2] + 0.6, () => p.locator("details summary", { hasText: "Why is this evidence shown?" }), "why");
    S.glide(S.L[3] + 0.4, 2.2, 220);
  }],
  science: [async () => { await go("/compare?preset=fabric-three-sizes"); await p.evaluate(() => { const el = document.getElementById("compare-tool"); scrollTo(0, el.getBoundingClientRect().top + scrollY - 60); }); }, (S) => {
    S.glide(1.2, 1.8, 240);
    S.go(S.L[1] - 0.3, "/gaps");
    S.at(S.L[1] - 0.29, () => p.evaluate(() => { const el = document.getElementById("frontier"); scrollTo(0, el.getBoundingClientRect().top + scrollY - 110); }));
    S.glide(S.L[1] + 1.4, 2.6, 300);
    S.go(S.L[2] - 0.3, "/methodology");
    S.at(S.L[2] - 0.29, () => p.evaluate(() => {
      const el = [...document.querySelectorAll("p")].find((x) => x.textContent.includes("quoted findings are checked"));
      if (el) scrollTo(0, el.getBoundingClientRect().top + scrollY - innerHeight * 0.45);
    }));
    S.go(S.L[3] - 0.3, "/sources");
    S.at(S.L[3] - 0.29, () => p.evaluate(() => { const el = document.getElementById("downloads"); scrollTo(0, el.getBoundingClientRect().top + scrollY - 200); }));
    S.point(S.L[3] + 1.2, 1.2, 760, 470);
  }],
  // the finale: an animated end card over the home page, staged on the closing lines
  close: [() => go("/"), (S) => {
    const end = (st) => () => p.evaluate((x) => window.__voxEnd?.(x), st);
    const l1 = S.lines[1], parts = ["Real NASA data. ", "A real adventure. ", "And honest answers about what we still don't know."];
    const total = parts.join("").length;
    let acc = 0;
    S.at(0.1, end(1));                       // space fades in, the spark flies and bursts into the flame constellation
    S.at(S.L[0], end(2));                    // "MicroFire Atlas" rises letter by letter
    parts.forEach((x, i) => { S.at(l1.at + (l1.dur * acc) / total, end(3 + i)); acc += x.length; }); // the three promises
    S.at(S.L[2], end(6));                    // crew, PIX and the link
  }, "none"],
};

for (const sc of timed) {
  if (only && only !== "all" && sc.id !== only) continue;
  const [setup, build, pos] = scenes[sc.id];
  await render(sc, setup, build, pos);
}
console.log(errs.length ? "ISSUES:\n" + errs.join("\n") : "no issues");
await b.close();
