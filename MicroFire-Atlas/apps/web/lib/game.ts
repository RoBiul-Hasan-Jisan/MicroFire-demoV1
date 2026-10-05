/**
 * Mission Freefall: chapters, the BASS-II parts catalogue and badges.
 * Facts come from verified findings (see game.test.ts); the 3D layout is illustrative.
 */
import type { PartId } from "@/components/three/FlameScene";

export type Part = {
  id: PartId;
  name: string;
  role: string;
  finding: string; // verified NASA quote for the field note
  needs?: PartId;
  needsWhy?: string;
};

export const PARTS: Part[] = [
  { id: "duct", name: "Flow duct", role: "The 7.6 cm square wind tunnel everything else attaches to.", finding: "hw-duct" },
  { id: "fan", name: "Variable-speed fan", role: "Pushes air through the duct. Its speed sets the airflow.", finding: "hw-fan", needs: "duct", needsWhy: "The fan blows into the duct, so the duct goes in first." },
  { id: "straightener", name: "Honeycomb straightener", role: "Calms the swirl so the air reaches the sample evenly.", finding: "hw-straightener", needs: "duct", needsWhy: "The straightener sits inside the duct inlet." },
  { id: "nozzle", name: "Nitrogen nozzle", role: "Adds nitrogen to lower the oxygen level for each test.", finding: "hw-radiometer", needs: "duct", needsWhy: "The nozzle lives inside the test section." },
  { id: "holder", name: "Sample holder", role: "Holds the thin sample in the middle of the flow.", finding: "hw-samples", needs: "duct", needsWhy: "The sample holder mounts on the duct's top rail." },
  { id: "igniter", name: "Hot-wire igniter", role: "A glowing Kanthal coil the astronaut swings in to light the sample.", finding: "hw-igniter", needs: "holder", needsWhy: "NASA's sample holders carry a built-in igniter, so the holder goes in first." },
  { id: "still", name: "Still camera", role: "Looks down through the top window, about one photo per second.", finding: "hw-still-camera", needs: "duct", needsWhy: "The camera looks through the duct's top window." },
  { id: "video", name: "Video camera", role: "Films through the front window, with live readouts on screen.", finding: "hw-video", needs: "duct", needsWhy: "The video camera looks through the duct's front window." },
  { id: "radiometer", name: "Radiometer", role: "A heat sensor in the back corner that tracks how strongly the flame glows.", finding: "hw-radiometer", needs: "duct", needsWhy: "The radiometer sits in the duct's downstream corner." },
  { id: "exit", name: "Copper exit plate", role: "Cools the hot gases and catches soot on the way out.", finding: "hw-exit", needs: "duct", needsWhy: "The plate closes the end of the duct." },
];

/** Returns why a part can't be installed yet, or null. */
export function blockedBy(part: Part, installed: Set<string>): string | null {
  return part.needs && !installed.has(part.needs) ? part.needsWhy ?? `Install the ${part.needs} first.` : null;
}

export type ChapterId = "brief" | "build" | "lab" | "predict" | "log" | "quiet" | "moon" | "debrief";

export const CHAPTERS: { id: ChapterId; n: string; title: string }[] = [
  { id: "brief", n: "01", title: "Meet the flame" },
  { id: "build", n: "02", title: "Build the wind tunnel" },
  { id: "lab", n: "03", title: "Ignition lab" },
  { id: "predict", n: "04", title: "Make the call" },
  { id: "log", n: "05", title: "The crew logbook" },
  { id: "quiet", n: "06", title: "The quiet danger" },
  { id: "moon", n: "07", title: "Moon frontier" },
  { id: "debrief", n: "08", title: "Debrief" },
];

/** Ignition lab target: test B20's recorded starting conditions. */
export const LAB_TARGET = { testId: "bass2-B20", o2: 16.5, o2Tol: 0.3, flow: 5, flowTol: 0.5 };

export type Prediction = {
  id: string;
  testId?: string;
  title: string;
  setup: string;
  question: string;
  choices: { label: string; correct: boolean }[];
  reveal: string;
  finding?: string;
  scene: { o2: number; flow: number; material: "PMMA" | "fabric"; before: "burning"; after: "quench" | "blowoff" | "burning"; afterFlow: number };
};

export const PREDICTIONS: Prediction[] = [
  {
    id: "b16",
    testId: "bass2-B16",
    title: "Test B16",
    setup: "Same thin acrylic film, 16.5 % oxygen, burning in a gentle 3 cm/s breeze. The crew starts turning the fan down.",
    question: "What does the flame do as the airflow fades?",
    choices: [
      { label: "Burns hotter, with less wind to cool it", correct: false },
      { label: "Shrinks and goes out", correct: true },
      { label: "Nothing changes", correct: false },
    ],
    reveal: "After a long burn with the fan turned down, the flame quenched. NASA's report describes this low-flow regime: spread slows as the flow drops, until the flame goes out.",
    finding: "radiative-regime",
    scene: { o2: 16.5, flow: 3, material: "PMMA", before: "burning", after: "quench", afterFlow: 0.6 },
  },
  {
    id: "b19",
    testId: "bass2-B19",
    title: "Test B19",
    setup: "Same film, 16.4 % oxygen. This time the fan runs at 10 cm/s.",
    question: "More air means more oxygen. What happens?",
    choices: [
      { label: "It grows into a bigger fire", correct: false },
      { label: "It blows out", correct: true },
      { label: "It keeps burning steadily", correct: false },
    ],
    reveal: "At high flow, the gas sweeps past too fast for the flame's chemistry to keep up, and the flame blew off.",
    finding: "blowoff-kinetics",
    scene: { o2: 16.4, flow: 10, material: "PMMA", before: "burning", after: "blowoff", afterFlow: 14 },
  },
  {
    id: "fabric",
    title: "Fabric tests",
    setup: "Now cotton–fiberglass fabric. In four tests the crew turned the flow down until the flame went out, each at a different oxygen level.",
    question: "As the oxygen drops, does the flame need more or less airflow to stay alight?",
    choices: [
      { label: "Less airflow", correct: false },
      { label: "More airflow", correct: true },
      { label: "Oxygen makes no difference", correct: false },
    ],
    reveal: "The flame went out at a slightly higher flow as oxygen fell: 2.2 cm/s at 18.7 % but 2.8 cm/s at 16.9 %. NASA's researchers report the same trend.",
    finding: "sibal-quench-speeds",
    scene: { o2: 16.9, flow: 4, material: "fabric", before: "burning", after: "quench", afterFlow: 2.8 },
  },
];

export const MOON = {
  question: "Based on these 56 tests, how would a fire behave in that air?",
  choices: [
    { label: "It would spread faster", correct: false },
    { label: "It would spread slower", correct: false },
    { label: "These tests can't tell us", correct: true },
  ],
  reveal:
    "No test here went above 21 % oxygen or below 99 kPa. Guessing would be extrapolation. The honest answer is that direct evidence is limited, and this is where new experiments are needed.",
};

export type Badge = { id: string; name: string; earned: string };
export const BADGES: Badge[] = [
  { id: "builder", name: "Hardware builder", earned: "Assembled NASA's BASS-II wind tunnel" },
  { id: "igniter", name: "Ignition engineer", earned: "Matched test B20's conditions and lit the sample" },
  { id: "caller", name: "Evidence caller", earned: "Called every flame test the way NASA recorded it" },
  { id: "edge", name: "Edge finder", earned: "Recognised where the evidence stops" },
];

/** Fabric chapter: the six SIBAL fabric tests recorded as quenched (oxygen %, flow when it went out). Checked in game.test.ts. */
export const FABRIC_QUENCH = [
  { id: "sibal-GMT45-T4", test: "GMT45-T4", o2: 18.7, quench: 2.2 },
  { id: "sibal-GMT100-T13", test: "GMT100-T13", o2: 17.5, quench: 2.2 },
  { id: "sibal-GMT175-T18", test: "GMT175-T18", o2: 17.4, quench: 2.6 },
  { id: "sibal-GMT190-T20", test: "GMT190-T20", o2: 17.2, quench: 3 },
  { id: "sibal-GMT190-T22", test: "GMT190-T22", o2: 17.1, quench: 5 },
  { id: "sibal-GMT178-T14", test: "GMT178-T14", o2: 16.9, quench: 2.8 },
];

/** Crew-log evidence board: a kid headline for each real note (the note itself is shown verbatim). */
export const LOG_CLUES = [
  { id: "bass2-B1", headline: "Fan off: out in a flash" },
  { id: "bass2-B9", headline: "Steady, until the air slowed" },
  { id: "bass2-B16", headline: "A long burn, then it quenched" },
  { id: "bass2-B19", headline: "Blown out!" },
  { id: "bass2-F1", headline: "Lit, but it wouldn't spread" },
  { id: "sibal-GMT45-T4", headline: "Fabric: quenched" },
];

/** NASA-studied atmosphere A (finding exploration-atmosphere); not a final lunar habitat specification. */
export const MOON_AIR = { o2: 34, kpa: 56.5 };
