/** Kid Explorer data: air-challenge lines, field-check quiz, mission patches. Pure, so it can be tested. */
import type { WorldId } from "./lab-model.ts";

export type BuddyMood = "happy" | "wheee" | "curious" | "dreamy" | "low" | "giggle";
export const MOOD_OF: Record<WorldId, BuddyMood> = { earth: "happy", moon: "wheee", mars: "curious", micro: "dreamy" };

export const BUDDY_SAYS: Record<WorldId, string> = {
  earth: "Earth, 1 g: hot air rises and pulls fresh air in from below. The flame stands tall and keeps feeding itself.",
  moon: "Moon, 0.17 g: hot air rises only a little, so the flame is shorter and wider than on Earth.",
  mars: "Mars, 0.38 g: in between. The flame is not as tall as on Earth, not as round as in orbit.",
  micro: "Orbit, almost 0 g: hot air does not rise, so fresh air does not arrive by itself. You have to blow it in.",
};
export const BUDDY_LOW = "The air around the flame is nearly used up. Blow more air in, or it goes out.";

export type Q = { id: string; q: string; options: string[]; answer: number; why: string };
export const QUIZ: Q[] = [
  { id: "q1", q: "Why is a candle flame on Earth shaped like a teardrop?", options: ["Hot air rises and stretches it upward", "The flame is shy", "The candle is leaning"], answer: 0, why: "Hot air is lighter, so it floats up and pulls the flame tall." },
  { id: "q2", q: "What shape is a flame on the space station?", options: ["A tall teardrop", "A round little ball", "A square"], answer: 1, why: "With almost no gravity, hot air does not float up, so the flame stays round." },
  { id: "q3", q: "Why does a space flame need airflow?", options: ["Fresh air brings oxygen to it", "To make it louder", "To make it hot"], answer: 0, why: "Nothing lifts hot air in orbit, so fresh air does not arrive by itself." },
  { id: "q4", q: "What colour were the dim flames in NASA's orbit tests?", options: ["Bright red", "Dim blue", "Green"], answer: 1, why: "Space flames burn cooler and look dim blue." },
  { id: "q5", q: "Why does NASA burn small samples on the space station?", options: ["To learn how to keep astronauts safe", "To toast marshmallows", "To make light"], answer: 0, why: "Scientists study fire so spacecraft can be safer. Never play with real fire at home!" },
];

export type KidSave = { worlds: WorldId[]; bestStreak: number; quizBest: number; quizDone: boolean };
export const KID_FRESH: KidSave = { worlds: [], bestStreak: 0, quizBest: 0, quizDone: false };

export const STICKERS = [
  { id: "hopper", name: "Four Worlds", how: "Visit Earth, Moon, Mars and Orbit" },
  { id: "air", name: "Air Keeper", how: "Keep the flame alive in orbit for 20 seconds" },
  { id: "quiz", name: "Field Check", how: "Finish the field check" },
  { id: "star", name: "Perfect Score", how: "Answer every question right" },
  { id: "super", name: "Flame Scientist", how: "Earn the other four patches" },
] as const;

export function stickersOf(s: KidSave): string[] {
  const got: string[] = [];
  if (s.worlds.length >= 4) got.push("hopper");
  if (s.bestStreak >= 20) got.push("air");
  if (s.quizDone) got.push("quiz");
  if (s.quizBest >= QUIZ.length) got.push("star");
  if (got.length >= 4) got.push("super");
  return got;
}
