// Renders thumbnail.html to thumbnail.jpg (1280x720, YouTube's recommended size) and thumbnail@2x.jpg (2560x1440).
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
const b = await chromium.launch({ headless: true, channel: "chromium", args: ["--allow-file-access-from-files"] });
for (const [scale, out] of [[2, "thumbnail@2x.jpg"], [1, "thumbnail.jpg"]]) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: scale });
  await p.goto(pathToFileURL("thumbnail.html").href, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: out, type: "jpeg", quality: 92 });
  await p.close();
}
await b.close();
