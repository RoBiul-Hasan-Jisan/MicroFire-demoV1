import type { Metadata } from "next";
import Link from "next/link";
import { AskPanel } from "@/components/AskPanel";
import { ObsHero } from "@/components/ObsHero";
import { VerifiedExample } from "@/components/VerifiedExample";
import ex from "@/components/ObsExtra.module.css";
import styles from "@/components/AtlasObservatory.module.css";
import { experiments, findings, luciRuns, saffireRuns, sources } from "@/lib/data";

export const metadata: Metadata = { title: "Ask" };

export default async function AskPage({ searchParams }: PageProps<"/ask">) {
  const q = (await searchParams).q;
  const initial = typeof q === "string" && q.length <= 400 ? q : undefined;
  return (
    <div className={`explorer-page ${ex.page}`}>
      <ObsHero kicker="Ask the evidence" title={<>Ask NASA&apos;s fire tests <em>anything</em></>}
        lead="Questions are answered only from the NASA tests and quotes in this atlas. Every claim is labelled observed, derived, interpretation or data gap, and its citations are checked before you see it."
        kpis={[[experiments.length + saffireRuns.length + luciRuns.length, "Test records", "BASS-II, Saffire, LUCI"], [findings.length, "Quoted findings", "with page numbers"], [sources.length, "NASA documents", "linked to NTRS"], ["100%", "Claims checked", "before display"]]} />
      <p className={ex.lead}><Link href="/methodology#ai" className={`${ex.cBlue}`}>How the AI is constrained →</Link></p>
      <section id="ask-tool" className={`${styles.panel} ${ex.sec} ${ex.sm80}`}><AskPanel initialQuestion={initial} /></section>
      <section className={`${styles.panel} ${ex.sec}`}><VerifiedExample /></section>
    </div>
  );
}
