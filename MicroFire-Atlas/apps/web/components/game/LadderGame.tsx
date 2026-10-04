"use client";

import { useMemo, useState } from "react";
import { evidenceRecords, findings } from "@/lib/data";
import { differences, type MissionQuestion, type Rung } from "@/lib/ontology";
import styles from "./LadderGame.module.css";

export const MOON_Q: MissionQuestion = { material: "PMMA", oxygen: 34, pressureKpa: 56.5, gravity: "lunar" };

type Card = { id: string; title: string; tag: string; facts: string; answer: Rung; why: string };

const RUNGS: { id: Rung; label: string; kid: string }[] = [
  { id: "direct", label: "Direct", kid: "Exactly our question" },
  { id: "analogous", label: "Analogous", kid: "Close, but different" },
  { id: "mechanistic", label: "Mechanistic", kid: "Explains how fire works" },
  { id: "gap", label: "Gap", kid: "Nobody has tested it yet" },
];

const kidDiff = (d: { dim: string; text: string }) =>
  d.dim === "gravity" ? "space-station gravity, not Moon gravity" : d.dim === "pressure" ? `${d.text.replace(", not", " air pressure, not")}` : d.text.replace("O₂", "oxygen");

/**
 * Climb the Evidence Ladder: sort four real clues onto the rungs for the Moon-base question.
 * The right rung for each card comes from the ontology itself (ladder rules), not from hand-written answers.
 */
export function LadderGame({ onDone, onTry }: { onDone: (tries: number) => void; onTry: (right: boolean) => void }) {
  const cards = useMemo<Card[]>(() => {
    const rec = (id: string) => evidenceRecords.find((r) => r.id === id)!;
    const asCard = (id: string, tag: string): Card => {
      const r = rec(id);
      const d = differences(r, MOON_Q);
      return {
        id, tag, title: r.label,
        facts: `${r.material} · ${r.oxygen} % oxygen · ${r.pressureKpa?.[0]} kPa · burned in orbit`,
        answer: d.length === 0 ? "direct" : "analogous",
        why: d.length ? `Close, but different: ${d.map(kidDiff).join("; ")}.` : "It matches every condition!",
      };
    };
    const flex = findings.find((f) => f.id === "flex-loi-lower")!;
    return [
      asCard("bass2-B20", "Small flame, sea-level air"),
      { id: "flex", tag: "Tiny burning droplets", title: "FLEX droplet finding", facts: `“${flex.quote}”`, answer: "mechanistic", why: "Droplets are not a plastic panel. They teach how oxygen limits flames, not how PMMA burns." },
      { id: "missing", tag: "The test nobody has done", title: "PMMA at 34 % oxygen, 56.5 kPa, Moon gravity", facts: "No NASA record yet", answer: "gap", why: "That's the missing rung: a real question for future research." },
      asCard("saffire-vi-3", "Big fire, almost Moon air"),
    ];
  }, []);

  const [placed, setPlaced] = useState<Record<string, Rung>>({});
  const [picked, setPicked] = useState<string | null>(null);
  const [say, setSay] = useState<string>("Tap a clue card, then tap the rung where it belongs.");
  const [shake, setShake] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const left = cards.filter((c) => !placed[c.id]);
  const done = left.length === 0;

  const drop = (rung: Rung) => {
    const card = cards.find((c) => c.id === picked);
    if (!card) { setSay("First tap a clue card."); return; }
    const t = tries + 1;
    setTries(t);
    if (card.answer === rung) {
      const next = { ...placed, [card.id]: rung };
      setPlaced(next);
      setPicked(null);
      setSay(`Yes! ${card.why}`);
      onTry(true);
      if (cards.every((c) => next[c.id])) onDone(t);
    } else {
      setShake(card.id);
      setTimeout(() => setShake(null), 500);
      setSay(rung === "direct" ? "Not quite: a direct clue would match the Moon question exactly. Look at what is different." : `Hmm, think again. ${card.answer === "analogous" ? "Is it the same kind of fire, with a few things different?" : card.answer === "mechanistic" ? "Is this even a solid material?" : "Does anyone have this test?"}`);
      onTry(false);
    }
  };

  return (
    <div className={styles.game} data-level={Object.keys(placed).length}>
      <div className={styles.board}>
        <svg className={styles.rail} viewBox="0 0 60 400" aria-hidden="true">
          <line x1="12" y1="10" x2="12" y2="396" className={styles.side} />
          <line x1="48" y1="10" x2="48" y2="396" className={styles.side} />
          {[40, 140, 240, 340].map((y) => <line key={y} x1="12" y1={y} x2="48" y2={y} className={styles.step} />)}
          <circle cx="30" cy="0" r="11" className={styles.spark} />
        </svg>
        <ol className={styles.rungs}>
          {RUNGS.map((r) => (
            <li key={r.id}>
              <button className={styles.rung} data-rung={r.id} onClick={() => drop(r.id)} disabled={done} aria-label={`Place the selected clue on the ${r.label} rung: ${r.kid}`}>
                <span className={styles.rungName}>{r.label}</span>
                <span className={styles.rungKid}>{r.kid}</span>
                <span className={styles.slots}>
                  {cards.filter((c) => placed[c.id] === r.id).map((c) => <span key={c.id} className={styles.slot}>{c.tag}</span>)}
                  {r.id === "direct" && done && <span className={styles.empty}>Empty: no test matches the Moon question yet</span>}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <p className={styles.say} role="status">{done ? `You climbed the whole ladder in ${tries} tries! The top rung stays empty, and that empty rung is the research question.` : say}</p>
      {!done && (
        <ul className={styles.cards} aria-label="Clue cards to sort">
          {left.map((c) => (
            <li key={c.id}>
              <button className={styles.card} aria-pressed={picked === c.id} data-shake={shake === c.id || undefined} data-gap={c.id === "missing" || undefined} onClick={() => setPicked(picked === c.id ? null : c.id)}>
                <span className={styles.tag}>{c.tag}</span>
                <strong>{c.title}</strong>
                <small>{c.facts}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
