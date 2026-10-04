import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
const times = process.argv.slice(2).map(Number);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const errs = []; p.on("pageerror", (e) => errs.push(String(e))); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
await p.goto("file://" + new URL("./build/film.html", import.meta.url).pathname, { waitUntil: "load" });
await p.evaluate(() => document.fonts.ready);
for (const t of times) { await p.evaluate((t) => window.renderAt(t), t); await p.screenshot({ path: fileURLToPath(new URL(`./build/prev-${t}.png`, import.meta.url)) }); }
console.log(JSON.stringify(errs));
await b.close();
