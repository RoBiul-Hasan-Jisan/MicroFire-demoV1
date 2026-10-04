/**
 * Kid Corner: plain-words explanations for the Flame Lab.
 * Pure logic. Every sentence restates something the lab already shows (gravity shapes the flame,
 * oxygen sets its size, airflow brings fresh air) or what NASA's closest tests recorded.
 * It never predicts what a flame will do.
 */
import type { LabState, VerdictKind } from "./lab-model.ts";

type In = Pick<LabState, "world" | "oxygen" | "flow">;

const WORLD_LINE: Record<LabState["world"], string> = {
  earth: "On Earth, hot air floats up like a balloon. It stretches the flame into a tall teardrop.",
  moon: "The Moon pulls gently, so hot air only rises a little. The flame is a shorter, wider teardrop.",
  mars: "Mars pulls a bit more than the Moon, so the flame is a medium teardrop.",
  micro: "In orbit nothing makes hot air float up, so the flame curls into a small round blue ball.",
};

export function kidWords(s: In, kind: VerdictKind): string[] {
  const out: string[] = [WORLD_LINE[s.world]];

  if (s.oxygen < 19) out.push("There is less oxygen than in your room, so the flame has less to eat and stays small.");
  else if (s.oxygen > 27) out.push("There is extra oxygen, like a bigger meal, so the flame grows bigger.");
  else out.push("The oxygen is close to normal air, like in your room.");

  if (s.flow <= 2) {
    out.push(
      s.world === "micro"
        ? "Hardly any wind. In orbit that means fresh air barely reaches the flame."
        : "Hardly any wind, so the flame stands almost straight.",
    );
  } else if (s.flow > 20) out.push("A strong breeze is blowing, so the flame leans over.");
  else out.push("A gentle breeze is bringing fresh air to the flame.");

  if (s.world === "micro") {
    if (kind === "sustained") out.push("In NASA's closest tests, flames like this mostly kept burning.");
    else if (kind === "extinguished") out.push("In NASA's closest tests, flames like this mostly went out.");
    else if (kind === "not_ignited") out.push("In NASA's closest tests, flames like this mostly did not light at all.");
    else if (kind === "mixed") out.push("In NASA's closest tests, some flames kept burning and some went out.");
    else out.push("NASA does not have a clear answer for settings like these yet. That is what scientists are still finding out!");
  } else {
    out.push("NASA's space-station tests were all done in orbit, so the lab only draws this flame; it does not count results here.");
  }
  return out;
}
