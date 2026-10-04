import type { Metadata } from "next";
import Link from "next/link";
import { evidenceRecords, findings, saffireRuns, experiments, sources } from "@/lib/data";

export const metadata: Metadata = {
  title: "90-second tour",
  description: "The strongest parts of MicroFire Atlas in about ninety seconds, for judges and mentors.",
};

const MOON_Q = "What evidence exists for PMMA at 34% oxygen and 56.5 kPa on the Moon?";

/** Judge mode: seven stops, each one link away from the exact view that proves the point. */
export default function TourPage() {
  const STEPS = [
    {
      t: "15 s", title: "Real NASA data, traced to the table line", href: "/saffire",
      look: "The atmosphere map, then any run card's citations.",
      why: `${experiments.length} BASS-II tests and ${saffireRuns.length} Saffire runs from ${sources.length} NASA documents. Every value is checked against the exact NASA table line; the build fails on a single wrong number.`,
      criteria: "Validity · Best use of data",
    },
    {
      t: "15 s", title: "The Evidence Ladder for a Moon base", href: "/mission?context=moon-base",
      look: "The missing top rung, and 'the experiment that would add this rung'.",
      why: "Evidence is sorted as direct, analogous, mechanistic or gap, each with the reason. Droplets and gas flames are never treated as solid-material evidence. No risk or safety score anywhere.",
      criteria: "Relevance · Impact",
    },
    {
      t: "10 s", title: "Compare that says what it can't say", href: "/compare?preset=pmma-flow-window",
      look: "Held constant, changed, NASA recorded, then 'What we can't say'.",
      why: "Computed from the records: one variable changed is not proof it alone caused the outcome. Cross-family comparisons carry a warning.",
      criteria: "Validity · Creativity",
    },
    {
      t: "10 s", title: "Computer vision on a real NASA flame", href: "/analyze/saffire-vi-pmma",
      look: "Switch AI vision on, then Measurements.",
      why: "Classical OpenCV segmentation of NASA's own footage, reported in pixels with quality flags. No invented physical units.",
      criteria: "Best use of technology",
    },
    {
      t: "15 s", title: "Ask, with the evidence first", href: `/ask?q=${encodeURIComponent(MOON_Q)}`,
      look: "'Evidence found' appears before any AI text; open a claim's citation.",
      why: `Retrieval is deterministic. Claims are checked for citations, numbers, units, microgravity-as-lunar mix-ups, causal wording and predictions. ${findings.length} verified NASA findings.`,
      criteria: "AI · Validity",
    },
    {
      t: "10 s", title: "The Research Frontier", href: "/gaps",
      look: "Any open card: why the gap exists, and what test would help.",
      why: "Gaps become research questions, computed from every record. NASA's own next step (FM2, a lunar-surface burn test) is noted where it applies.",
      criteria: "Impact · Relevance",
    },
    {
      t: "15 s", title: "The same truth, for a ten-year-old", href: "/expedition",
      look: "Chapter 6: climb the Evidence Ladder for the Moon base.",
      why: "Children predict before NASA's record is revealed, sort real clues onto the ladder, and finish with a debrief of what they actually did. One evidence layer, two depths.",
      criteria: "Storytelling · Art and technology",
    },
  ];
  return (
    <div className="explorer-page mx-auto max-w-5xl px-4 sm:px-6 py-14">
      <p className="text-signal text-sm">For judges and mentors</p>
      <h1 className="display text-4xl sm:text-5xl mt-3">See MicroFire Atlas in 90 seconds.</h1>
      <p className="mt-4 text-lg text-muted max-w-[64ch]">
        Seven stops, each one click from the exact view that proves the point. {evidenceRecords.length} test records,{" "}
        {findings.length} verified findings, and an honest map of where NASA&apos;s evidence stops.
      </p>
      <ol className="tour-steps mt-10">
        {STEPS.map((s, i) => (
          <li key={s.title} className="tour-step">
            <span className="tour-n" aria-hidden="true">{i + 1}</span>
            <div>
              <p className="tour-meta">{s.t} · {s.criteria}</p>
              <h2 className="display text-xl sm:text-2xl">{s.title}</h2>
              <p className="mt-2 text-[15px]"><strong>Look at:</strong> {s.look}</p>
              <p className="mt-1 text-[15px] text-muted">{s.why}</p>
              <Link href={s.href} className="tour-go">Open this stop</Link>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-10 text-sm text-faint">
        Characters and scenery are illustrations. NASA footage, photographs, test records and quotations are the evidence. Not affiliated with
        or endorsed by NASA.
      </p>
    </div>
  );
}
