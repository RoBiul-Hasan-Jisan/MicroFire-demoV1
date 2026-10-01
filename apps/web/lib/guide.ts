/**
 * Ember's floating guide: what Ember says on each page, for 8-13 year-olds (Explorer) and for
 * mentors (Scientist). Each step can point at an element marked data-guide="<target>".
 * Fun facts are kid-friendly rewordings of verified NASA quotes (finding ids are tested).
 */
import type { Mood } from "@/components/game/Ember";

export type GuideStep = { target?: string; kid: string; pro: string; mood?: Mood };
export type GuidePage = { match: (path: string) => boolean; id: string; name: string; steps: GuideStep[] };

export const PAGES: GuidePage[] = [
  {
    id: "home",
    name: "Home",
    match: (p) => p === "/",
    steps: [
      { target: "hero", kid: "Hi, I'm Ember! On Earth, flames like me stand tall because hot air rises. In space nothing rises, so we change shape!", pro: "MicroFire Atlas: 56 BASS/BASS-II tests transcribed from NASA/TM-20210011385, with page-level citations and verified quotes." },
      { target: "scroll-story", kid: "Scroll down slowly and watch me change from Earth to space. Every result you see really happened on the space station.", pro: "Scroll story: each beat drives the 3D illustration with a recorded outcome (B16 quench, B20 burned, B19 blowoff)." },
      { target: "play", kid: "Want to build a real NASA experiment and light it yourself? Press Play Mission Freefall!", pro: "Mission Freefall: guided game built on the same records and verified quotes." },
    ],
  },
  {
    id: "atlas",
    name: "Atlas",
    match: (p) => p === "/atlas",
    steps: [
      { target: "plot", kid: "Each dot is one real fire test astronauts did on the space station. Orange dots kept burning. Blue dots went out.", pro: "Oxygen vs airflow (log) for all tests; colour encodes NASA's recorded outcome, coded from crew notes." },
      { target: "filters", kid: "Slide the Oxygen control and watch which dots disappear. Less oxygen, fewer tests!", pro: "Filters: material, flow direction, outcome group, minimum O₂, quality flags." },
      { target: "table", kid: "Click any test name to read what the astronauts really wrote down.", pro: "Each row links to a test page with per-field provenance (recorded / series / derived)." },
    ],
  },
  {
    id: "analyze",
    name: "Flame Vision",
    match: (p) => p.startsWith("/analyze"),
    steps: [
      { target: "fv-video", kid: "This is a real NASA video of fire in space! Press Play and watch it spread.", pro: "NASA Image and Video Library footage (Saffire / BASS), local web copy with provenance." },
      { target: "fv-modes", kid: "Press AI vision. The computer draws a line around the flame by itself, in every frame!", pro: "Classical OpenCV segmentation: luminous and dim-blue masks inside a documented ROI." },
      { target: "fv-metrics", kid: "Point at a number and I'll light up what it measures on the picture.", pro: "Per-frame pixel-domain metrics; no spatial calibration exists, so nothing is converted to cm." },
      { target: "fv-charts", kid: "These lines show how big the flame was over time. Click a line to jump the video there!", pro: "Area and edge time series; click to seek." },
    ],
  },
  {
    id: "compare",
    name: "Compare",
    match: (p) => p === "/compare",
    steps: [
      { target: "presets", kid: "Pick a comparison. The same material, with only one thing changed: that's a fair test, like at school!", pro: "Curated presets hold conditions constant where the tables allow." },
      { target: "matrix", kid: "The blue words show what is different between the tests.", pro: "Condition matrix: differing values highlighted." },
      { target: "observed", kid: "'Observed' is what NASA saw. 'Interpretation' is our best guess. Real scientists always keep those apart!", pro: "Observed, interpretation and data gaps are separated." },
    ],
  },
  {
    id: "mission",
    name: "Mission Lab",
    match: (p) => p === "/mission",
    steps: [
      { target: "contexts", kid: "Pretend you are designing a space base. Pick where your crew will live.", pro: "Mission contexts set O₂, airflow, pressure and gravity." },
      { target: "sliders", kid: "Move the sliders. I'll find the NASA tests that are most like your cabin.", pro: "Mission Relevance: weighted similarity; missing values count against a test." },
      { target: "notice", kid: "If you go somewhere NASA never tested, I'll tell you honestly: we don't know yet!", pro: "Out-of-domain notice when a value is outside every tested range." },
    ],
  },
  {
    id: "gaps",
    name: "Evidence gaps",
    match: (p) => p === "/gaps",
    steps: [
      { target: "grid", kid: "Each box counts tests. Empty boxes mean nobody has tested there yet. That's a job for future scientists, maybe you!", pro: "O₂ × airflow bins: observed (3+), sparse (1-2), outside evidence (0)." },
      { target: "grid", kid: "The orange rows have more oxygen than the air on Earth. Moon bases might use air like that, and no test here went there.", pro: "No test above 21 % O₂; NASA's recommended exploration atmosphere is 34 % O₂ at 56.5 kPa." },
    ],
  },
  {
    id: "ask",
    name: "Ask",
    match: (p) => p === "/ask",
    steps: [
      { target: "ask-box", kid: "Ask me anything about these fire tests! I only answer with real NASA evidence, and I show where it came from.", pro: "Deterministic retrieval, then a citation-checked model answer; evidence-only fallback without a key." },
      { target: "evidence", kid: "This list is the evidence I'm allowed to use. If something isn't in here, I won't make it up.", pro: "Only items in this package can be cited; unknown citations are removed and unsupported numbers flagged." },
    ],
  },
  {
    id: "experiment",
    name: "Test page",
    match: (p) => p.startsWith("/experiments/"),
    steps: [
      { target: "notes", kid: "This is one real test. Read what the crew and ground team wrote, word for word.", pro: "Verbatim observations column from NASA's table." },
      { target: "conditions", kid: "Each number says where it came from: from this test, from NASA's whole set, or worked out by us.", pro: "Per-field basis: recorded, series, derived, not stated." },
      { target: "confidence", kid: "This checklist shows how sure we can be about this test. More ticks, more sure.", pro: "Evidence Confidence: equal-weight checklist, a project heuristic." },
    ],
  },
  {
    id: "methodology",
    name: "How it works",
    match: (p) => p === "/methodology",
    steps: [{ kid: "This page is for grown-up scientists. It shows every rule we used. Scientists call that showing your work!", pro: "Formulas, weights, scales, outcome codes and limitations rendered from the code." }],
  },
  {
    id: "sources",
    name: "Sources",
    match: (p) => p === "/sources",
    steps: [{ kid: "These are the real NASA reports everything on this website comes from.", pro: "NTRS records with copyright determination and SHA-256 hashes." }],
  },
];

export const guideFor = (path: string) => PAGES.find((p) => p.match(path));

/** Kid-friendly fun facts; each rewords a verified finding (see guide.test.ts). */
export const FUN_FACTS: { finding: string; text: string }[] = [
  { finding: "dim-blue-low-flow", text: "With almost no breeze, space flames turn dim blue and very steady, and they can keep burning for a long time." },
  { finding: "tiny-flame-undetected", text: "Scientists worry that a tiny space flame could hide unnoticed, then flare up if the air suddenly moves." },
  { finding: "low-flow-sensitivity", text: "Space flames are super sensitive to tiny breezes: between 0 and 5 centimetres per second, everything changes." },
  { finding: "bass-duct-size", text: "The wind tunnel astronauts used was only 7.6 cm wide and 17 cm long. You could hold it in your hands!" },
  { finding: "low-g-burns-lower-o2", text: "Some materials burned with less oxygen in low gravity than they needed on Earth." },
  { finding: "luci-first-lunar", text: "NASA spun a rocket to make pretend Moon gravity and ran the first fire tests there that lasted longer than 25 seconds!" },
  { finding: "luci-fm2", text: "NASA plans to burn materials on the real Moon in an experiment called FM2." },
  { finding: "saffire-vs-bass", text: "Big Saffire fires in a big tunnel spread slower than small BASS fires in a small tunnel. The space around a fire matters!" },
  { finding: "hw-igniter", text: "Astronauts lit each sample with a glowing coil of wire, pulled into place by hand." },
];
