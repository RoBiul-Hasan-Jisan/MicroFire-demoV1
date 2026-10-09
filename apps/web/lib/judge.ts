/** Judge Mode: the guided 90-second tour (shared by /tour and the floating tour bar) and the three live demonstrations. */
export type TourStop = { href: string; title: string; look: string; seconds: number; criteria: string };

export const TOUR: TourStop[] = [
  { href: "/challenge", title: "One question, nine steps", look: "Watch the 01–09 rail as you scroll, then read the Mission Evidence Brief at the end.", seconds: 10, criteria: "Relevance · Impact" },
  { href: "/mission?context=moon-base", title: "The Evidence Ladder for a lunar habitat", look: "The empty Direct rung, then the experiment that would fill it.", seconds: 10, criteria: "Validity" },
  { href: "/gaps#gaps-tool", title: "Where the evidence stops, on a chart", look: "Every point is a real NASA test. The dashed box says: no direct evidence here.", seconds: 10, criteria: "Best use of data" },
  { href: "/model-lab", title: "Machine learning that abstains", look: "Try “Lunar habitat scenario”: prediction blocked, with the reasons and the nearest NASA tests.", seconds: 10, criteria: "AI · Validity" },
  { href: "/what-if", title: "Change one thing, watch the evidence respond", look: "Pick “Orbit scenario moved to the Moon”: the estimate disappears and the page says why. The map shows where NASA tests are thick, thin or absent.", seconds: 10, criteria: "Creativity · Validity" },
  { href: "/dossier?m=PMMA&g=lunar&o2=34&kpa=56.5&flow=20&x_g=microgravity&x_o2=21&x_kpa=101.3", title: "One scenario, five answers, one link", look: "Five numbered answers from a single scenario. Use Copy link, then Download Markdown: the report reopens exactly this scenario.", seconds: 10, criteria: "Impact · Presentation" },
  { href: "/ask#example-title", title: "How an AI answer is checked", look: "Open a claim: six checks, and the exact NASA records behind it.", seconds: 10, criteria: "AI · Transparency" },
  { href: "/analyze/saffire-vi-pmma", title: "Computer vision on a real NASA flame", look: "Switch Flame Vision on. Units are pixels: NASA publishes no calibration.", seconds: 10, criteria: "Best use of technology" },
  { href: "/lab", title: "Flame Lab: one dataset, two depths", look: "Run the Low-airflow BASS preset, then Lunar habitat. Switch Explorer and Scientist: same evidence, two voices.", seconds: 10, criteria: "Storytelling · Interactivity" },
];

export const TOUR_KEY = "microfire-judge-tour";

/** The three demonstrations. Their results are computed on /tour from the ladder and the model gate, never written here. */
export const DEMOS = [
  {
    id: "iss",
    capability: "Direct knowledge",
    title: "ISS cabin, low airflow",
    q: { material: "PMMA", oxygen: 16.5, gravity: "microgravity" as const, flow: 3 },
    model: { material: "PMMA", gravity: "microgravity" as const, o2: 16.5, kpa: 101.3, flow: 3 },
    href: "/compare?preset=pmma-flow-window",
    cta: "Compare the matched NASA tests",
  },
  {
    id: "moon",
    capability: "Analogical reasoning",
    title: "Lunar habitat, exploration atmosphere A",
    q: { material: "PMMA", oxygen: 34, pressureKpa: 56.5, gravity: "lunar" as const, flow: 20 },
    model: { material: "PMMA", gravity: "lunar" as const, o2: 34, kpa: 56.5, flow: 20 },
    href: "/challenge",
    cta: "Run Challenge Mode on this question",
  },
  {
    id: "mars",
    capability: "Scientific abstention",
    title: "Mars habitat, exploration atmosphere A",
    q: { material: "SIBAL fabric", oxygen: 34, pressureKpa: 56.5, gravity: "martian" as const, flow: 10 },
    model: { material: "SIBAL fabric", gravity: "martian" as const, o2: 34, kpa: 56.5, flow: 10 },
    href: "/mission?context=mars-fabric",
    cta: "See why MicroFire abstains",
  },
];
