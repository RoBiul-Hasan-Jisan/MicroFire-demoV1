/** Kid Adventure: missions are checked against the lab's own state, so the page teaches by doing. Pure logic. */
import type { LabState } from "./lab-model.ts";
import type { CrewId } from "./guide.ts";

export type MissionCtx = { st: LabState; visited: string[] };
export type Mission = { id: string; crew: CrewId; title: string; ask: string; done: string; test: (c: MissionCtx) => boolean };

export const MISSIONS: Mission[] = [
  { id: "tall", crew: "kofi", title: "Make Buddy TALL", ask: "Take Buddy to Earth. What happens to the flame?", done: "Tall! Hot air floats up like a balloon and stretches Buddy.", test: ({ st }) => st.world === "earth" },
  { id: "round", crew: "tala", title: "Make Buddy ROUND", ask: "Fly Buddy to Orbit, the space station!", done: "Round and blue! In space, hot air does not float up.", test: ({ st }) => st.world === "micro" },
  { id: "feast", crew: "mei", title: "Give Buddy a feast", ask: "Turn the air meal up to Feast. Does Buddy grow?", done: "More oxygen is more food, so Buddy grows big!", test: ({ st }) => st.oxygen >= 28 },
  { id: "snack", crew: "mei", title: "Just a tiny snack", ask: "Now try Snack. What happens?", done: "Less oxygen means a small, shy flame.", test: ({ st }) => st.oxygen <= 17 },
  { id: "wind", crew: "kofi", title: "Wind storm!", ask: "On Earth, Moon or Mars, turn the wind to Storm.", done: "Whoosh! The wind pushed Buddy sideways.", test: ({ st }) => st.world !== "micro" && st.flow >= 25 },
  { id: "calm", crew: "tala", title: "Calm in space", ask: "In Orbit, set the wind to None. What did NASA see?", done: "With almost no wind, NASA saw very dim, steady blue flames.", test: ({ st }) => st.world === "micro" && st.flow <= 2 },
  { id: "tour", crew: "tala", title: "Visit all four worlds", ask: "Earth, Moon, Mars and Orbit: take Buddy to every one!", done: "World traveller! Gravity changes the shape every time.", test: ({ visited }) => ["earth", "moon", "mars", "micro"].every((w) => visited.includes(w)) },
];

export const missionsDone = (ctx: MissionCtx, saved: string[], acted = true) => MISSIONS.filter((m) => saved.includes(m.id) || (acted && m.test(ctx))).map((m) => m.id);
export const nextMission = (done: string[]) => MISSIONS.find((m) => !done.includes(m.id)) ?? null;
