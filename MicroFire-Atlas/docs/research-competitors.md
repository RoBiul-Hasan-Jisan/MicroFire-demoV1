# Competitor research: Exovisionaries 2025 and 2026

Studied 2 Oct 2026 from the public repositories (`asifhasan973/ExoVisionaries`, `asifhasan973/exovisionaries2026`),
their planning PDF, their Mission Forge prompt and nine screenshots of a full playthrough. Ideas only: no code, art,
characters or copy is reused.

## 1. What they built

| | 2025 "Solar Storms to Auroras" (Global Finalist, top 45) | 2026 "Zero To Beyond" (current) |
|---|---|---|
| Stack | React 19 + Vite + Tailwind + React Three Fiber, Lottie, Groq AI, NASA DONKI + NOAA live APIs | React 19 + Vite, plain three.js, Zustand, Web Audio |
| Opening | Full-screen looping background video + astronaut PNG + loading overlay with % | Cover with two crew portraits, "Build it. Launch it.", one button |
| Story | Mascot "Stelly", 4 story pages with NASA imagery, dialogue box | Mira / Kai / Leo guide each scene in a modal "cinematic" with typewriter text |
| Core loop | Data dashboards made kid-friendly (Space Mood K-index), 3D aurora lab | Build rocket (2D + 3D) → static fire → seal 2 cabin leaks → crew + days → 7 green checks → pad checks → countdown → flight with 2 paused staging decisions → Earth orbit |
| Games | Quiz with lifelines, StormSafe (find shelter), Space Defense | Assembly rounds, system tests, staging decisions |
| AI | Groq Q&A (offline: "API quota expired") | none |
| Real data | Live NASA/NOAA feeds | Apollo-inspired authored values, labelled estimates |
| Ending | Finale + completion certificate | Earth-orbit "milestone complete", Moon "coming soon" |
| Devices | Desktop only (mobile gate) | Responsive |

## 2. How their art was made

- 2026 character art is AI-generated: the C2PA content credential in `public/story/sarah-jenkins.png` names
  **ChatGPT · gpt-image** (OpenAI Media Service, digitalSourceType *trainedAlgorithmicMedia*). Other PNGs carry
  stripped Adobe XMP, consistent with editing after generation.
- Characters ship as 512 × 768 WebP **mood sets** (`neutral`, `speaking`, `success`, `warning`), each with a cut-out
  (`-cut`) version for compositing.
- "Talking" = two frames (mouth closed / open) swapped while text types out at 24 ms per letter, a timed blink,
  and browser `speechSynthesis` read-aloud (pitch differs per character). Cheap and effective.
- 2025 used a looping background video for the home hero and PNG cut-outs for the mascot.

## 3. How they plan (from the PDF and prompt)

1. A flowchart of the whole journey first (commander → destination → site → goal → constraints → design → crew →
   launch → trajectory → landing → exploration → events → decision → result).
2. Every step lists real NASA sources and real instrument names (VIPER, Perseverance instruments, Δv table).
3. Every choice is a **trade-off** with consequences later ("no drill → can't sample the ice").
4. The implementation prompt fixes an **exact stopping point**, a phase boundary, "coming soon" for everything
   else, quantitative-honesty rules, a data model, a work order and a single final check.
5. The pitch script frames the idea in one question: "Where would you go? What would you take?"

## 4. Their weaknesses, our openings

| Their gap | Our advantage to make obvious in 60 seconds |
|---|---|
| Science is authored game values ("estimates", "not a trajectory solver") | Every number is a real NASA record with a page link, verified at build time |
| No real media | Real NASA Saffire and BASS footage |
| No AI, or an AI that is offline | Computer vision that measures real NASA footage, plus a grounded Ask with a deterministic fallback that never goes offline |
| The ending is "reached orbit, next chapter coming soon" | A complete journey that ends at a real scientific frontier: the evidence gap |
| Choices change resources, not knowledge | Choices change which evidence the child holds, compares and carries to the debrief |
| Characters talk with 2-frame swaps | Our SVG Ember and PIX can animate their mouths, eyes and mood continuously; the illustrated crew adds 3D-film art |
| 2025 desktop-only | Fully responsive and keyboard/touch complete |

## 5. What we adopt (as ideas, rebuilt our way)

- Mood sets for characters and a read-aloud voice with captions (optional, off by default).
- A dock at the bottom of every scene: Back · Talk to guide · one primary action.
- Changing task types between scenes, and a decision that pauses a live sequence.
- A finale certificate the child can save.
- An exact phase boundary and an honest "coming soon".
- A planning flowchart with sources at every step.
