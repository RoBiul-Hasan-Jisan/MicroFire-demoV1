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
      { target: "paths", kid: "Pick your way in: the adventure with me and the crew, or the mission desk where scientists check the evidence.", pro: "Two entry points: Mission Analyst (Evidence Ladder, robustness, brief) and the Outcome Model (trained on NASA tests, cross-validated, with intervals). The story pages are under Extras." },
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

/**
 * Discoveries: the only thing that earns an Explorer star. Each is a learning action
 * (not a page visit) and each node in the evidence constellation opens a real place.
 * The list order is the journey (Act I: Mission Freefall, Act II: the Evidence Expedition);
 * stars are placed around a teardrop so the finished constellation is a flame.
 */
export type Discovery = { id: string; label: string; href: string; x: number; y: number; kind: "act" | "record" | "gap" | "source" };
const JOURNEY: Omit<Discovery, "x" | "y">[] = [
  { id: "gravity", label: "Saw a flame change without gravity", href: "/story", kind: "act" },
  { id: "built", label: "Built NASA's BASS-II wind tunnel", href: "/story", kind: "act" },
  { id: "fixed", label: "Fixed the setup before the test", href: "/story", kind: "act" },
  { id: "b20", label: "Lit a sample at test B20's real settings", href: "/experiments/bass2-B20", kind: "record" },
  { id: "b16", label: "Watched how test B16 ended", href: "/experiments/bass2-B16", kind: "record" },
  { id: "b19", label: "Watched how test B19 ended", href: "/experiments/bass2-B19", kind: "record" },
  { id: "fabric", label: "Lined up the fabric quench records", href: "/atlas", kind: "record" },
  { id: "clue", label: "Pinned a real crew-log clue", href: "/story", kind: "record" },
  { id: "quiet", label: "Found the hidden dim flame", href: "/story", kind: "act" },
  { id: "realflame", label: "Picked a real NASA flame video", href: "/expedition", kind: "record" },
  { id: "aivision", label: "Used AI Vision to measure a real flame", href: "/analyze", kind: "act" },
  { id: "hop", label: "Changed one thing between two real tests", href: "/expedition", kind: "record" },
  { id: "difference", label: "Spotted the difference NASA recorded", href: "/compare", kind: "record" },
  { id: "moonmatch", label: "Found the closest evidence for a Moon habitat", href: "/mission", kind: "act" },
  { id: "edge", label: "Found where the evidence stops", href: "/gaps", kind: "gap" },
  { id: "askpix", label: "Asked PIX a question with sources", href: "/ask", kind: "act" },
  { id: "source", label: "Opened a real NASA report page", href: "/sources", kind: "source" },
  { id: "family", label: "Explored a second experiment family", href: "/atlas", kind: "record" },
  { id: "crewnote", label: "Read a crew's note, word for word", href: "/atlas", kind: "record" },
  { id: "detective", label: "Solved a data-detective challenge", href: "/atlas", kind: "act" },
  { id: "profile", label: "Compared NASA's two exploration atmospheres", href: "/mission", kind: "act" },
  { id: "whypath", label: "Followed a clue's Why path to its NASA page", href: "/mission", kind: "record" },
  { id: "brief", label: "Opened a Mission Evidence Brief", href: "/mission", kind: "gap" },
  { id: "weights", label: "Moved a ranking weight and watched the order change", href: "/methodology", kind: "act" },
  { id: "checker", label: "Tried to fool the AI claim checker", href: "/methodology", kind: "act" },
  { id: "ownpair", label: "Built your own comparison", href: "/compare", kind: "act" },
  { id: "crossfamily", label: "Met a comparability warning between two experiments", href: "/compare", kind: "record" },
  { id: "frontier", label: "Opened a frontier question's Evidence Ladder", href: "/gaps", kind: "gap" },
  { id: "motion", label: "Tracked a flame's motion frame by frame", href: "/analyze", kind: "act" },
  { id: "citechip", label: "Opened the NASA evidence behind an AI claim", href: "/ask", kind: "source" },
  { id: "download", label: "Downloaded NASA data to check it yourself", href: "/sources", kind: "source" },
];

/**
 * Page quests: real actions per page, each one a discovery star. `click` (a CSS selector) or `visible`
 * (an element that appears) lets the quest board notice the action without wiring every component.
 */
export type Quest = { id: string; how: string; click?: string; visible?: string };
export const QUESTS: Record<string, Quest[]> = {
  compare: [
    { id: "difference", how: "Open one of NASA's mystery comparisons", click: ".comparison-presets a" },
    { id: "ownpair", how: "Add or remove a test to build your own comparison", click: '[data-quest="pick-record"], [aria-label^="Remove "]' },
    { id: "crossfamily", how: "Compare tests from two experiments and read the warning", visible: '[data-quest="cross-family"]' },
  ],
  gaps: [
    { id: "edge", how: "Tap a square on the evidence map", click: '[data-quest="gap-cell"]' },
    { id: "frontier", how: "Open a frontier question's Evidence Ladder", click: '[data-quest="frontier-link"]' },
    { id: "source", how: "Follow a NASA citation", click: 'a[href*="nasa.gov"]' },
  ],
  analyze: [
    { id: "aivision", how: "Switch on the computer's outline", click: '[data-mode="vision"], [data-mode="measure"]' },
    { id: "motion", how: "Open Motion mode on a video", click: '[data-mode="motion"]' },
    { id: "realflame", how: "Step through the film frame by frame", click: '[aria-label="Forward one analysed frame"], [aria-label="Back one analysed frame"]' },
  ],
  ask: [
    { id: "askpix", how: "Ask a question and see its NASA evidence" },
    { id: "citechip", how: "Open a citation chip on an answer", click: '[data-quest="cite-chip"]' },
  ],
  sources: [
    { id: "source", how: "Open a NASA report on its official site", click: 'a[href*="nasa.gov"]' },
    { id: "download", how: "Download a dataset", click: 'a[href^="/downloads/"]' },
  ],
  atlas: [
    { id: "family", how: "Switch to the Saffire spacecraft fires" },
    { id: "crewnote", how: "Tap a test tile to read what NASA recorded" },
    { id: "detective", how: "Open the Table and solve a detective challenge" },
  ],
  methodology: [
    { id: "weights", how: "Drag a ranking weight in the playground" },
    { id: "checker", how: "Play “Fool the checker” with three sentences" },
    { id: "source", how: "Open any NASA report link" },
  ],
  mission: [
    { id: "profile", how: "Pick the alternate exploration atmosphere" },
    { id: "whypath", how: "Open “Why is this evidence shown?” on a ladder card" },
    { id: "brief", how: "Export a Mission Evidence Brief" },
  ],
};
/** Teardrop: x = sin θ · sin(θ/2), y = cos θ, tip at the top; the journey starts at the bottom. */
export const DISCOVERIES: Discovery[] = JOURNEY.map((d, i) => {
  const t = Math.PI + (2 * Math.PI * (i + 0.5)) / JOURNEY.length; // half-step offset: one star sits on the tip
  return { ...d, x: +(50 + 40 * Math.sin(t) * Math.abs(Math.sin(t / 2))).toFixed(2), y: +(52 - 46 * Math.cos(t)).toFixed(2) };
});
export const discovery = (id: string) => DISCOVERIES.find((d) => d.id === id);

/**
 * The guide crew: original illustrated characters who each show children one kind of thing.
 * Ember hosts tours and fun facts; a crew member gives each page's one-line goal.
 */
export type CrewId = "tala" | "kofi" | "mei";
export type Pose = "pointing" | "cheering" | "thinking";
const poses = (id: string): Record<Pose, string> => ({ pointing: `/art/crew/${id}-pointing.webp`, cheering: `/art/crew/${id}-cheering.webp`, thinking: `/art/crew/${id}-thinking.webp` });
export const CREW: Record<CrewId, { name: string; job: string; img: string; poses: Record<Pose, string> }> = {
  tala: { name: "Tala", job: "Navigator: where to go next", img: "/art/tala.webp", poses: poses("tala") },
  kofi: { name: "Kofi", job: "Lab engineer: how to play", img: "/art/kofi.webp", poses: poses("kofi") },
  mei: { name: "Dr. Mei", job: "Scientist: how to read the evidence", img: "/art/mei.webp", poses: poses("mei") },
};

/** "What am I looking for?": one short goal per page, in Explorer and Scientist words. */
export const GOALS: Record<string, { crew: CrewId; kid: string; pro: string; next?: { label: string; href: string } }> = {
  learn: { crew: "kofi", kid: "Flip gravity off, then scroll slowly: three real tests show what changes when only the airflow changes.", pro: "Explainer: gravity illustration plus the B16/B20/B19 scroll story, each beat a recorded outcome.", next: { label: "Build the experiment", href: "/story" } },
  home: { crew: "tala", kid: "Press Follow the Spark to start the adventure, or scroll down: a real flame NASA filmed in space is waiting!", pro: "Cinematic opener, real NASA footage, the B16/B20/B19 map and where the evidence stops.", next: { label: "Follow the Spark", href: "/expedition" } },
  atlas: { crew: "mei", kid: "Every dot is a real fire test from the space station. Tap a dot, then read what the astronauts wrote.", pro: "All 56 records by O₂ and airflow; select a point for its full provenance.", next: { label: "Compare two tests", href: "/compare" } },
  analyze: { crew: "kofi", kid: "Play the real NASA video, then press AI vision to see the computer find the flame.", pro: "Classical CV on NASA footage; pixel units only.", next: { label: "Explore the tests", href: "/atlas" } },
  compare: { crew: "mei", kid: "Look at what stayed the same and what changed. Then read what NASA saw, and what we can't say yet.", pro: "Held constant, changed and recorded are computed from the records; can and can't say follow from them.", next: { label: "Explore the Research Frontier", href: "/gaps" } },
  mission: { crew: "kofi", kid: "Pick a place for a space crew to live. Then climb the Evidence Ladder: how close can real NASA tests get?", pro: "Evidence Ladder (direct, analogous, mechanistic, gap) above the Mission Relevance arithmetic; not a risk score.", next: { label: "See the Research Frontier", href: "/gaps" } },
  gaps: { crew: "tala", kid: "Empty squares are places no test has been. Finding them is a real discovery!", pro: "O₂ × airflow coverage; empty cells make no claim.", next: { label: "Ask a question", href: "/ask" } },
  ask: { crew: "mei", kid: "Ask a short question. Every answer shows the NASA evidence it came from, or says we don't know.", pro: "Deterministic retrieval, then a cited answer with claim checks.", next: { label: "Back to the mission", href: "/story" } },
  experiment: { crew: "mei", kid: "This is one real test. Each number says if NASA wrote it down (recorded) or we worked it out (derived).", pro: "Per-field provenance: recorded, series, derived, not stated.", next: { label: "Compare it", href: "/compare" } },
  methodology: { crew: "mei", kid: "This is how we checked every number. Scientists call it showing your work!", pro: "Formulas, weights and limits, rendered from code.", next: { label: "See the sources", href: "/sources" } },
  sources: { crew: "mei", kid: "These are the real NASA reports. Open one to see where a clue came from.", pro: "NTRS records with hashes.", next: { label: "Back to the mission", href: "/story" } },
};
