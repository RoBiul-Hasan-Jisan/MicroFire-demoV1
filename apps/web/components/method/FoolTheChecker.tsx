"use client";

import { useMemo, useState } from "react";
import { useExplorer } from "@/components/guide/EmberGuide";
import { buildEvidence, checkAnswer, type ClaimType } from "@/lib/ask-core";
import { experiments, findings, saffireRuns } from "@/lib/data";
import styles from "./Method.module.css";

const Q = "What happened in test B19?";
const CLAIMS: { text: string; type: ClaimType; cites: string[] }[] = [
  { text: "B19 ran at 16.4 % oxygen.", type: "OBSERVED", cites: ["E:bass2-B19"] },
  { text: "B19 ran at 18 % oxygen.", type: "OBSERVED", cites: ["E:bass2-B19"] },
  { text: "B19 shows that PMMA blows off on the Moon.", type: "OBSERVED", cites: ["E:bass2-B19"] },
  { text: "B19 ran at 16.4 cm/s.", type: "OBSERVED", cites: ["E:bass2-B19"] },
  { text: "Low oxygen caused the blowoff in B19.", type: "INTERPRETATION", cites: ["E:bass2-B19"] },
  { text: "PMMA will blow off at 10 cm/s in a lunar habitat.", type: "INTERPRETATION", cites: ["E:bass2-B19"] },
  { text: "B19 was not tested at lunar gravity.", type: "OBSERVED", cites: ["E:bass2-B19"] },
  { text: "B19 used a 0.1 mm PMMA film.", type: "OBSERVED", cites: ["E:bass2-B19"] },
];

/** A game: guess whether the real claim checker (the code Ask uses) accepts each sentence, then see why. */
export function FoolTheChecker() {
  const { discover } = useExplorer();
  const verdicts = useMemo(() => {
    const { items } = buildEvidence(Q, experiments, findings, saffireRuns);
    return checkAnswer({ summary: "", claims: CLAIMS }, items, Q);
  }, []);
  const [guess, setGuess] = useState<Record<number, boolean>>({});
  const answered = Object.keys(guess).length;
  const right = Object.entries(guess).filter(([i, g]) => g === verdicts[Number(i)].verified).length;
  const play = (i: number, g: boolean) => { setGuess((x) => ({ ...x, [i]: g })); if (answered + 1 >= 3) discover("checker"); };
  return (
    <div className={styles.play}>
      <p className={styles.playQ}>An AI answered <strong>“{Q}”</strong> Will MicroFire&apos;s claim checker let each sentence through? Every verdict below is computed live by the same code.</p>
      <ul className={styles.claims}>
        {CLAIMS.map((c, i) => {
          const v = verdicts[i];
          const g = guess[i];
          return (
            <li key={i} data-state={g == null ? "open" : g === v.verified ? "right" : "wrong"}>
              <p className={styles.claimText}>“{c.text}” <small>{c.type.toLowerCase()}</small></p>
              {g == null ? (
                <div className={styles.claimBtns}>
                  <button onClick={() => play(i, true)}>It passes</button>
                  <button onClick={() => play(i, false)}>It gets flagged</button>
                </div>
              ) : (
                <p className={styles.verdict}>
                  <em><b>{v.verified ? "Passed" : "Flagged"}</b>{g === v.verified ? " · you were right" : " · not quite"}</em>
                  {!v.verified && <span>{v.issues.join(" ")}</span>}
                  {v.verified && <span>Every number appears in NASA&apos;s record for B19, with the same unit.</span>}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <p className={styles.playNote} aria-live="polite">{answered ? `${right} of ${answered} guessed right.` : "Make a guess on any sentence."}</p>
    </div>
  );
}
