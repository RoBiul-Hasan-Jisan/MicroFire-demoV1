import Link from "next/link";

export type Station = { href: string; label: string; title: string; detail: string; icon: string };
export type NavGroup = { id: string; label: string; blurb: string; items: Station[] };

/** The site map in five groups. Navigation and the home page's map both read this list. */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "explore", label: "Explore", blurb: "Start here: the story-led adventure",
    items: [
      { href: "/lab", label: "Flame Lab", title: "Interactive flame lab", detail: "Set gravity, oxygen and airflow, then see what NASA tested and where the evidence stops.", icon: "fire" },
      { href: "/expedition", label: "Follow the Spark", title: "Follow the Spark", detail: "The main adventure: watch real NASA flames, find clues and take them to the Moon.", icon: "orbit" },
      { href: "/learn", label: "Why flames change", title: "Why flames change", detail: "Switch gravity off, then scroll through three near-matched tests with different airflow and 16.4–16.5 % oxygen.", icon: "fire" },
      { href: "/story", label: "Build the experiment", title: "Build the experiment", detail: "Mission Freefall: assemble NASA's wind tunnel in 3D and light a real test.", icon: "rocket" },
    ],
  },
  {
    id: "evidence", label: "Evidence", blurb: "Every NASA test, traced to its page",
    items: [
      { href: "/atlas", label: "Atlas", title: "Test observatory", detail: "Every test record in three experiment families, with filters and a detective table.", icon: "orbit" },
      { href: "/saffire", label: "Saffire", title: "Fires inside a spacecraft", detail: "Twenty large fires NASA set on purpose inside empty cargo ships.", icon: "fire" },
      { href: "/compare", label: "Compare", title: "Comparison bench", detail: "What stayed the same, what changed, and what that lets us say.", icon: "compare" },
    ],
  },
  {
    id: "analyze", label: "Analyze", blurb: "Instruments for real NASA data",
    items: [
      { href: "/analyze", label: "Flame Vision", title: "Observation station", detail: "Computer vision on real NASA footage, frame by frame, in pixels.", icon: "eye" },
      { href: "/ask", label: "Ask PIX", title: "Ask the evidence", detail: "Bring a question. Every answer leads back to its NASA source.", icon: "chat" },
      { href: "/dossier", label: "Scenario Dossier", title: "One scenario, five answers", detail: "What NASA's tests say, what changes, where evidence is missing, which test helps, and a shareable link.", icon: "map" },
      { href: "/what-if", label: "What-if Lab", title: "Counterfactual explorer", detail: "Change one condition and see how the evidence, the estimate and its uncertainty respond, or where they stop.", icon: "compare" },
      { href: "/model-lab", label: "AI Model Lab", title: "Evidence-bounded ML", detail: "A validated model on NASA tests that refuses to predict outside its evidence.", icon: "sliders" },
    ],
  },
  {
    id: "mission", label: "Mission", blurb: "From evidence to future missions",
    items: [
      { href: "/mission", label: "Mission Evidence", title: "Mission desk", detail: "The Evidence Ladder: what NASA evidence fits your cabin, and how well.", icon: "sliders" },
      { href: "/gaps", label: "Research Frontier", title: "The frontier", detail: "Where the evidence runs out, and which test would push it further.", icon: "map" },
    ],
  },
  {
    id: "about", label: "About", blurb: "How MicroFire Atlas knows what it says",
    items: [
      { href: "/challenge", label: "Challenge Mode", title: "Challenge Mode", detail: "One mission question, answered stage by stage: find, compare, summarize, rank, interpret, verify, and where the evidence stops.", icon: "map" },
      { href: "/tour", label: "Judge Mode", title: "For judges and mentors", detail: "Three one-click demonstrations and a guided 90-second tour.", icon: "orbit" },
      { href: "/methodology", label: "Method", title: "How it works", detail: "Every rule, score and tolerance, so you can check it.", icon: "map" },
      { href: "/sources", label: "Sources", title: "The station library", detail: "Every NASA document, with its NTRS record and file hash.", icon: "book" },
    ],
  },
];

/** Destinations shown on the home page map: everything except About. */
export const STATIONS: Station[] = NAV_GROUPS.filter((g) => g.id !== "about").flatMap((g) => g.items);

const PATHS: Record<string, string> = {
  rocket: "M14 4c3-2 6-2 6-2s0 3-2 6l-7 7-4-4 7-7ZM7 11H3l4-5h5M11 15v4l5-4v-5M5 16l-2 5 5-2M14 7l3 3",
  orbit: "M9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0ZM3 17C0 12 15 1 20 5s-9 16-15 15M17 3l1 3 3 1",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z",
  compare: "M4 5h6v14H4zM14 5h6v14h-6M7 9v6M17 9v6",
  sliders: "M5 3v9m0 4v5M12 3v3m0 4v11M19 3v12m0 4v2M2 12h6v4H2zM9 6h6v4H9zM16 15h6v4h-6z",
  map: "m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6ZM9 3v15M15 6v15",
  chat: "M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-9l-5 3v-3H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM8 9h8M8 13h5",
  fire: "M12 3c3 4 6 6.5 6 10.5a6 6 0 0 1-12 0C6 10 9 9 9 6c1.5 1 2.5 2.5 3 4 .5-2.5 0-5 0-7ZM12 21a2.5 2.5 0 0 1-2.5-2.5c0-1.6 1.4-2.4 2.5-4 1.1 1.6 2.5 2.4 2.5 4A2.5 2.5 0 0 1 12 21Z",
  book: "M4 4h6a3 3 0 0 1 2 1 3 3 0 0 1 2-1h6v15h-6a2 2 0 0 0-2 2 2 2 0 0 0-2-2H4V4ZM12 5v16",
};

export function StationIcon({ name }: { name: string }) {
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={PATHS[name] ?? PATHS.orbit} /></svg>;
}

export function StationMap() {
  return <section className="station-map mx-auto max-w-7xl px-4 sm:px-6 py-16" aria-labelledby="stations-title">
    <div className="station-map-heading"><div><p className="text-signal text-sm">Your next discovery</p><h2 id="stations-title" className="display text-3xl sm:text-4xl mt-2">Where will you go?</h2></div><p className="text-muted max-w-md">Play a mission, explore a real test, or bring your own question. Every room has something to investigate.</p></div>
    <div className="station-destinations">{STATIONS.map((s) => <Link href={s.href} key={s.href} className="station-destination"><span className="station-icon"><StationIcon name={s.icon} /></span><h3 className="display text-xl">{s.title}</h3><p>{s.detail}</p><span className="station-enter">Enter <span aria-hidden="true">↗</span></span></Link>)}</div>
  </section>;
}
