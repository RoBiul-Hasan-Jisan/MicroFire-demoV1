/** Draws the explorer certificate on a canvas over the original constellation plate and downloads it as PNG. */
const load = (src: string) =>
  new Promise<HTMLImageElement | null>((ok) => {
    const im = new Image();
    im.onload = () => ok(im);
    im.onerror = () => ok(null);
    im.src = src;
  });

export async function saveCertificate({ nick, rank, clues, log }: { nick: string; rank: string; clues: string[]; log: string[] }) {
  const [plate, pix] = await Promise.all([load("/art/worlds/constellation.webp"), load("/art/pix.webp")]);
  const c = document.createElement("canvas");
  c.width = 1600;
  c.height = 1000;
  const x = c.getContext("2d")!;
  x.fillStyle = "#061020";
  x.fillRect(0, 0, 1600, 1000);
  if (plate) {
    const k = Math.max(1600 / plate.width, 1000 / plate.height); // cover
    x.drawImage(plate, (1600 - plate.width * k) / 2, (1000 - plate.height * k) / 2, plate.width * k, plate.height * k);
  }
  const shade = x.createLinearGradient(0, 0, 1600, 0);
  shade.addColorStop(0, "rgba(3,10,24,.94)");
  shade.addColorStop(0.62, "rgba(3,10,24,.8)");
  shade.addColorStop(1, "rgba(3,10,24,.3)");
  x.fillStyle = shade;
  x.fillRect(0, 0, 1600, 1000);
  x.strokeStyle = "#ffcc79";
  x.lineWidth = 4;
  x.strokeRect(36, 36, 1528, 928);
  if (pix) x.drawImage(pix, 1220, 90, 280, (280 * pix.height) / pix.width);
  x.fillStyle = "#95deed";
  x.font = "600 30px system-ui, sans-serif";
  x.fillText("MicroFire Atlas · Follow the Spark", 100, 130);
  x.fillStyle = "#fff4df";
  x.font = "800 92px system-ui, sans-serif";
  x.fillText(rank, 100, 245);
  x.fillStyle = "#ffcc79";
  x.font = "500 42px system-ui, sans-serif";
  x.fillText(nick.trim() ? `Awarded to ${nick.trim().slice(0, 30)}` : "Awarded to a curious explorer", 100, 320);
  x.fillStyle = "#d3e1ee";
  x.font = "600 30px system-ui, sans-serif";
  x.fillText(clues.length ? `Clues: ${clues.join(" · ")}` : "Clues: still exploring", 100, 400, 1400);
  x.font = "400 27px system-ui, sans-serif";
  log.slice(-9).forEach((l, i) => x.fillText(`✦ ${l}`, 100, 470 + i * 46, 1400));
  x.fillStyle = "#819cb6";
  x.font = "400 22px system-ui, sans-serif";
  x.fillText("Every clue came from public NASA reports and media. Illustrations are art. Not affiliated with or endorsed by NASA.", 100, 920);
  x.fillText(new Date().toLocaleDateString(), 1340, 920);
  c.toBlob((blob) => {
    if (!blob) return;
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "microfire-explorer-certificate.png" });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}
