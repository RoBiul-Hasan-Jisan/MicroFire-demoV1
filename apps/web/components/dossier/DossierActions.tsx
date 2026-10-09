"use client";

import { useState } from "react";
import styles from "./Dossier.module.css";

export function DossierActions({ markdown, url }: { markdown: string; url: string }) {
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");
  const copy = async () => {
    try { await navigator.clipboard.writeText(new URL(url, window.location.origin).toString()); setCopied("ok"); } catch { setCopied("fail"); }
    setTimeout(() => setCopied("idle"), 2500);
  };
  const download = () => {
    const href = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }));
    const a = document.createElement("a");
    a.href = href; a.download = "microfire-scenario-dossier.md"; a.click();
    URL.revokeObjectURL(href);
  };
  return (
    <div className={`${styles.actions} brief-actions`} role="group" aria-label="Share this dossier">
      <button type="button" onClick={copy}>{copied === "ok" ? "Link copied" : copied === "fail" ? "Copy failed: copy the address bar" : "Copy link to this dossier"}</button>
      <button type="button" onClick={download}>Download Markdown</button>
      <button type="button" onClick={() => window.print()}>Print / save as PDF</button>
    </div>
  );
}
