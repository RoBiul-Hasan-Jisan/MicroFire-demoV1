# MICROFIRE ATLAS — Phase 2: The Evidence Expedition

Claude Code implementation prompt · NASA Space Apps 2026 · Flame in Freefall · 2 October 2026

This prompt continues the shipped Phase 1 (Mission Freefall, living sky, guide crew, evidence constellation;
see `docs/junior-explorer-audit.md`). It is the authoritative spec for Phase 2. Where it conflicts with the earlier
"Ultimate Child Experience" prompt, this file wins: it keeps that prompt's journey and child rules but binds them to
the real data, media and code this repository already has.

---

## 1. Assignment and exact stopping point

Build **The Evidence Expedition**, the second act of MicroFire Atlas. In Act I (Mission Freefall) the child builds
NASA's BASS-II wind tunnel and lights a sample. In Act II the child leaves the workbench and becomes an
**evidence explorer**: they pick a real NASA flame, switch on AI Vision, measure it, change one thing between two
real tests, spot the difference, help a Moon habitat find its closest evidence, discover a science gap, ask PIX a
question and finish with a personal evidence constellation and certificate.

**Finish exactly at "MICROFIRE EXPLORER — JOURNEY COMPLETE".** Do not build Mars, accounts, uploads, multiplayer,
leaderboards, arbitrary fire prediction, habitat safety certification or any new dataset. "Coming soon" items open
an accessible dialog with one honest sentence and return focus on close.

The result must prove, in the child's own words:

> I saw a real NASA flame. I used AI Vision to measure it. I changed one thing and saw what NASA recorded. I helped
> a Moon habitat find its closest evidence. I found something scientists still need to study. I followed the source.

## 2. The whole product on one page

```
HOME (living sky · gravity teaser · real NASA clue)
  │  Start the mission (fly-in)
  ▼
ACT I · MISSION FREEFALL  ─ build ─ check ─ ignite B20 ─ B16/B19/fabric ─ log ─ quiet flame ─ Moon map ─ debrief
  │  "Continue the expedition"
  ▼
ACT II · THE EVIDENCE EXPEDITION   ◀── this phase
  1 Follow the spark (scroll cinematic)          Concept visualization
  2 Pick a real NASA flame (media cards)         Real evidence starts here
  3 Flame Lab: Real video → AI Vision → Measure  Computed (pixels)
  4 Trace the flame (mini-game)                  Computed outline revealed
  5 Change one thing (supported changes only)    Matched records
  6 Spot the difference                          Recorded outcomes
  7 Help the Moon habitat (closest evidence)     Evidence proximity + coverage
  8 Science gap reveal                           Uncertainty = discovery
  9 Ask PIX                                      Retrieved, cited answer
 10 Evidence constellation + certificate         The child's own trail
  ▼
FREE EXPLORATION: Atlas · Flame Vision · Compare · Mission Lab · Gaps · Ask · Sources (Scientist depth)
```

Every node in Act II writes a discovery (`lib/guide.ts → DISCOVERIES`) so the constellation, Ember's panel and the
certificate stay one progress system.

## 3. Audience and voice

Children 8–14 first; parents, teachers and judges second. One question per scene, one dominant action, 1–3 short
sentences. Technical depth lives in **Science Notes** (the existing Notebook drawer / Scientist mode), never deleted.
Never show WRONG / FAILED. Use "Try another clue", "Almost: look at the width", "Let's compare".

Rewards mark learning actions only. No streaks, rankings, login or identity collection. The certificate asks for an
optional nickname that stays in the browser.

## 4. Cast (one speaking guide per scene)

| Character | Job | Art |
|---|---|---|
| **Ember** | Host and main voice; reacts to flame changes | Existing SVG, moods; add mouth animation while speaking |
| **PIX** | The AI companion. Only speaks about AI Vision, matching and Ask. Says "Here's what I found in these experiments", never "I know the answer" | New original SVG: white rounded shell, dark faceplate, cyan eyes, small side fins; moods idle / scanning / happy / unsure; mouth/eye animation while speaking |
| **Tala** | Navigator: where to go next (route goals) | Generated 3D-film art |
| **Kofi** | Engineer: how to play a control | Generated 3D-film art |
| **Dr. Mei** | Scientist: what the evidence says | Generated 3D-film art |

Mapping from the Ultimate prompt: NOVA → Tala, DR. EMBER → Dr. Mei (the flame is already called Ember), PIX → PIX.
Only one character speaks at a time. Dialogue uses a shared `Dialogue` component: typewriter (instant under reduced
motion), "show full line", optional read-aloud via `speechSynthesis` (off until the child turns sound on), captions
always on screen.

## 5. Visual identity

Keep the shipped tokens (void, panel, signal cyan, flame orange, quench blue) and add PIX violet `#9B7CF6` for AI and
portals. Orange = combustion, cyan = measurement/AI, violet = discovery, blue = quench. Generated art and procedural
scenes carry an "Illustration" or "Concept visualization" label; real media carries a NASA source badge. Real and
illustrated must never be confusable in a still frame.

## 6. Scene-by-scene specification

### 6.1 Follow the spark (scroll cinematic)

Sticky full-screen stage, ~300vh of scroll, progress = clamp((scrollY − top) / (height − vh), 0, 1). If
`/cinematics/01-spark-chase.mp4` exists, scrub its `currentTime`; otherwise draw the procedural version on a 2D
canvas from the living-sky plate: a spark enters (12–28 %), circles the floating astronaut (28–45 %), grows into a
blue flame world (45–62 %), cyan rings assemble (62–80 %), a portal opens (80–100 %). HTML overlays: "A tiny spark is
hiding in space…" → "Something inside is changing." → CTA **Follow the spark**. Reverses on scroll up, pauses when
scrolling stops, still keyframe under reduced motion / Pause motion. No essential text inside media.

### 6.2 Pick a real NASA flame

Two to four cards from `data/media.json`: real thumbnail, short material label, gravity icon, one known condition,
"Good first flame" on Saffire-VI. Each card says what is known and **what is not known** for that footage
(`MEDIA_CONTEXT`). Transition: cyan scan sweeps the concept scene, it desaturates, crossfades to the real poster;
label flips **Concept visualization → Real experimental evidence**.

### 6.3 Flame Lab

The real media dominates. Three big modes: **Real video**, **AI Vision**, **Measure**.

- Real video: play/pause, large touch scrubber, NASA source badge.
- AI Vision: PIX "I'm tracing the flame so we can measure it!" then the outline from
  `public/media/<slug>/analysis.json` for the current frame (the shipped OpenCV pipeline). Child names: AI flame
  outline, Flame center, Measurement guides.
- Measure: at most four metrics (Height, Width, Area, Shape) in **px** with the tooltip "Pixels are picture units.
  This does not mean centimetres." Tapping a metric glows its guide (vertical line, horizontal line, mask pulse,
  aspect box). Flags (overexposed, weak flame) shown in child words.

### 6.4 Trace the flame (mini-game)

"Which outline matches the flame best?" Three candidates drawn over the same frame: the real computed outline and two
honest distractors produced by deterministic transforms of it (scaled 1.35× about the centroid; shifted by 25 % of the
box width). The child picks; reveal "Here's PIX's AI outline" with the real one highlighted. Feedback: "Nice
spotting!" or "Almost: look at the left edge." Reward: **AI Vision** discovery. Distractors are labelled as made-up
in Science Notes.

### 6.5 Change one thing

"What if we change just one thing?" Offer only changes the dataset supports, computed from `experiments.json`:

| Start | Change | Result label | Records |
|---|---|---|---|
| B20 (PMMA film, 16.5 % O₂, 5 cm/s, burned) | More airflow | **Matched experiment found** | B19 (16.4 %, 10 cm/s, blew off) |
| B20 | Less airflow | **Matched experiment found** | B16 (16.5 %, 3 cm/s start, quenched) |
| B20 | More oxygen (same film) | **Closest experiment found** (state what differs) | nearest PMMA-film record by oxygen with flow difference shown |
| B20 | Moon gravity or 34 % O₂ | **We don't have a matching experiment yet** → "That's a science gap." | none |

Never animate a predicted flame for an unsupported change.

### 6.6 Spot the difference

Two record cards side by side (stacked A/B toggle on phones) for the chosen pair, plus the 3D/2D apparatus showing
each recorded outcome. "What changed?" choices valid for that pair only (e.g. "The flame went out" / "It kept
burning" / "Almost the same"). Reveal the recorded outcomes, the condition that changed and the verbatim crew notes
with Table A.1 pages. Wording: "In these two tests, the faster-flow test was recorded as blowing off." Never
"faster flow caused…" unless a finding supports it (blowoff-kinetics is an interpretation; label it). Button **Show
the proof** opens the PDF page. Reward: **Difference detective**.

### 6.7 Help the Moon habitat

"A future Moon habitat needs fire-safety research. Which experiment gives us the closest clues?" Scenario chips with
2–3 options: oxygen (21 % / 34 %), pressure (101 kPa / 56.5 kPa), material (PMMA / fabric). Rank with the shipped
`lib/relevance.ts` (`rank`, coverage). Show three candidates; child picks the closest. Child labels map to the
documented thresholds in §8. Explanation rows: ✓ same material, ✓ similar oxygen, △ different pressure, ✗ not tested.
PIX: "Good clue! But the pressure is different." Never a safety score.

### 6.8 Science gap

Evidence nodes connect with cyan lines; one region stays empty; PIX scans it; a golden question-mark constellation
forms. "We found a science gap! Scientists still need more evidence here." Then cite the partial-gravity research that
does exist (LUCI) separately. Reward: **Science gap finder** (`edge`).

### 6.9 Ask PIX

Five suggested questions plus a short text box. Calls `/api/ask`; show `summary` (or the deterministic
evidence-only reason) in 2–3 short paragraphs, one **Source** button per answer, "Tell me more" expands claims with
their checks. Weak evidence: "I'm not sure from these experiments alone. Here's what we do know." The deterministic
fallback must be pleasant, not an error.

### 6.10 Evidence constellation and certificate

The child's discoveries light up and connect into a flame-shaped constellation (the shipped constellation, flame
layout variant). Text: **You followed the evidence.** You watched. You measured. You compared. You asked why.
**That's how scientists learn.** Badge **MicroFire Explorer**. A certificate (canvas → PNG download, no upload) lists
their actual discoveries, the tests they inspected and one open question. Buttons: Explore another flame · Replay
adventure · Open Science Notes. Then "Expedition log": the timeline of what they did, in order (idea from the
competitor's debrief timeline, filled with real actions, not invented percentages).

## 7. Science and AI guardrails (unchanged, enforced)

Every claim maps to a specific record or verified finding. Recorded / derived / interpreted / not stated stay
labelled. B16's quench is not "all slow flames go out". Oxygen % is not partial pressure. Atlas rows ≠ all lunar
research. Pixel metrics stay in px. Media is never claimed to show a BASS test it doesn't show. The 34 % / 56.5 kPa
habitat atmosphere is a proposal. AI answers cite retrieved evidence only; uncited answers are replaced by the
deterministic summary.

## 8. Evidence accounting (our equivalent of their budget model)

Child label from the shipped relevance score and coverage (documented in `/methodology`, tested):

| Label | Rule |
|---|---|
| Great match | score ≥ 0.75 and coverage ≥ 0.75 |
| Pretty close | score ≥ 0.5 |
| Some clues | score ≥ 0.25 |
| Science gap | otherwise, or any scenario variable outside all tested ranges |

Missing variables earn no match credit and stay in the denominator. Store thresholds in data, test them.

## 9. Art pipeline

Generate original art (FLUX.1-Krea or gpt-image; never the competitors' characters), keep a C2PA/credit note in
`docs/art-credits.md`, cut out locally (rembg ISNet), export WebP (characters ≤ 640 px tall, plates quality 82).
Character mood sets where possible. Cinematic clips (Gemini/Veo) follow
`docs/prompts/gemini/*.md`; the site works without them via procedural fallbacks.

## 10. Technical

Next.js 16 app router (read `node_modules/next/dist/docs` before new APIs), strict nonce CSP (no inline styles in
SSR; CSSOM or SVG attributes), React 19, plain three.js only where 3D helps. New route `/expedition`. State in one
versioned localStorage record `microfire-expedition-v1`; discoveries go through `useExplorer().discover`. No per-frame
React state in the scroll cinematic. Lazy-load media. Pause work when hidden. 2D fallbacks for every 3D view.

## 11. Accessibility and devices

Keyboard and touch complete, 44 px targets, visible focus, captions, no colour-only meaning, reduced motion and Pause
motion honoured, no horizontal overflow at 360/390/430 px, Science Notes as a bottom sheet on phones.

## 12. Verification policy

Implement fully first. Then one focused check: unit tests for new pure logic (change-one-thing table, match
labels, distractor transforms), lint, typecheck, production build with CSP, one scripted walkthrough of Act II on
desktop and 390 px, reduced motion, LLM-unavailable path, no-WebGL path. Fix blockers only. Gate every commit on tests
and the secret check; HawkScan after the commit; deploy.

## 13. Work order

1. Data + pure logic: change-one-thing pairs, match labels, distractors, expedition state (+ tests).
2. PIX + Dialogue component (mouth/eye animation, read-aloud, captions).
3. Scroll cinematic engine with video slot + procedural fallback.
4. Scenes 6.2–6.10.
5. Entry points: Mission Freefall debrief "Continue the expedition", Home, nav "Play".
6. Docs: Gemini prompt pack, art credits, demo script update. One final check, commit, scan, deploy.

## 14. Judge path (75–90 s)

0–10 s spark cinematic → 10–20 s pick Saffire-VI, concept→real flip → 20–35 s AI Vision + Width → 35–50 s change
airflow B20→B19 → 50–60 s spot the difference → 60–75 s Moon habitat closest match → 75–82 s science gap → 82–90 s
Ask PIX, open a Source, certificate.

## 15. Strict don'ts

Do not clone another team, fake data or citations, predict flames, imply NASA endorsement, autoplay long
cinematics, bake text into video, make fire frightening, add leaderboards, let AI answer without sources, ship dead
controls or let a generated visual pass as a computed result.
