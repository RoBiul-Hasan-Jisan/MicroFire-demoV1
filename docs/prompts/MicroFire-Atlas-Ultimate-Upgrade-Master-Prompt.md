# MicroFire Atlas: Ultimate Scientific + AI + Product + UI/UX Upgrade (condensed)

This is a condensed record of the master prompt the team gave on 3 October 2026. The original arrived cut off partway through section 22. Every requirement below is binding.

## Vision

MicroFire Atlas is a traceable combustion-intelligence platform. It shows:

- what happened in NASA's microgravity-fire experiments;
- which experiments are scientifically comparable;
- what the evidence suggests for future spacecraft;
- where the evidence runs out.

For children, the same evidence becomes a cinematic evidence adventure. There is one truth layer with two presentation depths, Explorer and Scientist. The two audiences never get separate facts.

## Rules

- **Audit before editing.** Run the tests, typecheck, lint and build. Check the site in a browser at desktop, tablet and phone sizes, with reduced motion, and without WebGL. Look for console errors, hydration problems, CSP violations, overflow, dead buttons and unsupported claims.
- **Preserve everything that works.** That includes BASS-II provenance, verified quotes, Atlas, Compare, Mission Lab, Gaps, Ask and its validators, Flame Vision, Mission Freefall, Follow the Spark, PIX and the crew, the constellation, fallbacks, CSP, tests and film tooling.
- **Competitive position.** Others aggregate experiments; MicroFire Atlas explains which evidence is relevant, comparable, trustworthy and missing. Never maximise row count.

## Science

1. **Combustion Evidence Ontology.** Each record has a family, fuel phase, geometry, scale, gravity and atmosphere, plus outcome, measurement type, provenance level and compatibility. Unknown values stay unknown, with no convenient defaults.
2. **Dataset expansion, in priority order:**
   - Saffire, traceable records only;
   - SoFIE, as verified findings if no structured test rows exist;
   - FLEX and FLEX-2, labelled mechanistic;
   - ACME and BRE only where they add real fire-safety knowledge.
3. **Evidence Compatibility Engine.** It sorts evidence into DIRECT, ANALOGOUS, MECHANISTIC and GAP, and always says *why*. It never collapses everything into one score.
4. **Mission Evidence.** The page shows the scenario overview, coverage, then each rung, then the gaps and the source trail. Mission Relevance stays visually subordinate and is never called safety, risk or probability.
5. **Evidence graph.** A typed local graph with these nodes and links:
   - experiments and families;
   - materials and conditions;
   - outcomes and findings;
   - sources and media;
   - scenarios and gaps.

   It powers a "Why is this evidence shown?" path, displayed visually.

## AI

- **Pipeline:** question parser → structured conditions → deterministic retrieval, semantic finding retrieval and graph traversal → evidence package → LLM synthesis → validation → answer.
- **The LLM never finds its own sources.**
- **Claim types:** OBSERVED / DERIVED / INTERPRETATION / DATA_GAP, plus COMPARISON only if it adds clarity.
- **Validators:**
  - number, unit, range and citation checks;
  - a compatibility check: microgravity data must not be phrased as lunar;
  - a causal-language guard ("causes", "proves", "ensures", "guarantees", "makes safe");
  - a prediction-language guard.
- **Ask redesign:** show the question, then "Evidence found" (counts), then the synthesis. Claim cards show the claim type and citations. Clicking a citation shows the source, test, page or table, excerpt, the field it supports and its caveats.

## Analysis tools

- **Flame Vision 2.0.**
  - Measurements over time: area, width, height, centroid, leading edge, leading-edge velocity in px/s, area-change rate, brightness proxy, segmentation quality and temporal stability.
  - Units stay in pixels unless calibrated, with the note "Image-domain measurement; no physical spatial calibration available."
  - Modes: RAW / OUTLINE / MOTION / MEASUREMENTS.
  - A synced timeline: clicking a chart seeks the video, scrubbing updates the charts, and hovering a metric lights its guide.
  - An optional AI segmentation model is allowed only as a reliable comparison against classical CV.
- **Compare 2.0.** HELD CONSTANT, CHANGED, NASA RECORDED, WHAT CAN WE SAY, WHAT CAN'T WE SAY.
- **Cross-family mode.** It carries a comparability warning: related behaviour, not replicas.
- **Research Frontier, replacing Evidence Gaps.** For each region: what we know, what we don't, why the gap exists, which condition is missing, and what kind of experiment would reduce the uncertainty. It is framed as research planning, not instructions to NASA.

## Product

- **Navigation:**
  - EXPLORE: Follow the Spark, Mission Freefall.
  - EVIDENCE: Atlas, records, Compare.
  - ANALYZE: Flame Vision, Ask.
  - MISSION: Mission Evidence, Research Frontier.
  - ABOUT: Method, Sources, Downloads, Credits.

  Deep routes stay.
- **Canonical journey.** Follow the Spark is the main experience: real flame, observation, CV, evidence, comparison, mission question, uncertainty, gap. Mission Freefall becomes the optional "Build the experiment" lab.
- **Home narrative:**
  - 0–5 s: the cinematic world, with "Fire behaves differently when nothing rises." CTA: Follow the Spark; secondary: Explore NASA evidence.
  - 5–15 s: real, clearly labelled NASA video: "This isn't animation. NASA burned this material in space."
  - 15–30 s: Watch / Measure / Compare.
  - 30–50 s: B16/B20/B19.
  - 50–70 s: the Moon scenario and its gap.
  - 70–90 s: "Good science does not hide what it doesn't know."
- **Visual system.** "NASA research instrument meets premium animated science film": deep navy, restrained warm flame accents and cool scientific cyan. Never a generic SaaS, cyberpunk, AI template, admin panel or cartoon dashboard. (The original was cut off here.)
