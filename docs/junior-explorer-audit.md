# Junior Explorer audit and first slice

Audit of the live site (commit fc2f000, deployed 1 Oct 2026) against
`MicroFire-Atlas-Junior-Explorer-Claude-Master-Prompt.md`. Written 2 Oct 2026.

## Route-by-route gaps

| Route | What works | Where a 10-year-old gets lost |
|---|---|---|
| Home | Ember hero, scroll story with live 3D, plot, verified quotes | Headline is an adult claim; primary action says "Play Mission Freefall"; no astronaut world; no hands-on teaser; first real NASA clue is two screens down |
| `/story` title | Ember, chapter list, sound toggle | Plain dark page with a blurred orb; nothing says "space adventure" before reading |
| `/story` 01 gravity | Switch flips Ember and the 3D flame | One button in a text panel; flame is small in a wide canvas |
| `/story` 02 build | Tap/drag install, dependency rules, ghost box, snap animation, Quick build | Parts are abstract boxes with no labels in the world; no setup check after assembly; "built" screen is a Continue page |
| `/story` 03 lab | B20 target bands, hold-to-ignite, B20 note with page | No ignition sequence (flame just appears), no replay/skip, hold is the only input |
| `/story` 04 predict | Three real tests with notes and page cites | All three are the same mechanic (pick A/B/C); "Not quite." on a wrong guess; reveal happens without the child doing anything |
| `/story` 05 log | Six verbatim crew notes, cloud highlight | A dense list; choosing a note has no lasting consequence |
| `/story` 06 quiet | Gust button, NASA quote | Nothing to search for; the dim flame is not hidden, so there is no discovery |
| `/story` 07 moon | 34 % / 56.5 kPa scenario, LUCI note | Multiple-choice quiz, labelled "Careful." when wrong; no map |
| `/story` 08 debrief | Badges, links | Shows "Not earned this time" and "Calls matched 1/3" — ranks the child by right answers; remembers nothing they did |
| `/story` fallback | Panel still works without WebGL | Fallback is one sentence of text over an empty canvas |
| `/story` motion | Gentle motion stops auto-rotate | Setting is local to the game; no recenter; no mobile sheet collapse |
| Ember guide | Page tours, fun facts with quotes, Explorer/Scientist | **Stars are awarded for visiting pages** (prompt: reward learning actions only) |
| `/atlas`, `/compare`, `/mission`, `/gaps`, `/ask`, `/analyze` | Real data, citations, coverage, grounded Ask, CV on NASA video | Each opens on an adult dashboard; no child task line, no astronaut world, no route back to the mission |

## First slice: the smallest complete child journey

Home (astronaut world, gravity teaser, real B19 clue, **Start the mission**) →
`/story` title (astronaut world) → gravity → build (labelled parts) →
**readiness check with two illustrative mix-ups to fix** → B20 **ignition sequence**
with replay/skip and source → B16/B19/fabric with **three different gestures**
(slow the fan, spin it up, line up records) → **pin a crew-log clue** (changes camera,
notebook and debrief) → **find the hidden dim flame** with an observation filter, then gust →
**place a marker on the Moon map** and see the evidence edge → **debrief postcard** built from
the child's own actions, with a 3-shot recap.

Cross-cutting in this slice:

- One progress system: Explorer stars now come from discoveries (learning actions), not page views.
- Gentle Motion is site-wide (ExplorerProvider), and stops astronaut drift too.
- A designed 2D apparatus with the same controls when WebGL is missing or chosen.
- Recenter view; collapsible task sheet on phones; chapters revisitable once reached.

Later slices: route task lines and astronaut scenes on Atlas/Compare/Analyze/Mission/Gaps/Ask;
mission map that links discoveries to records; Codex review fixes.

## Beat notes (cue → input → reaction → result → still state)

| Beat | Cue | Input | Immediate reaction | Finite result | Still state |
|---|---|---|---|---|---|
| Gravity | Ember asks | Switch | Flame and Ember change shape | Orbit flame round and blue | Labelled "illustration" |
| Build | Glowing slot | Tap twice / drag | Part drops and settles, label appears | Part stays installed | Full rig with labels |
| Check | Two red checks | Fix buttons | Sample slides in; fan and airflow reverse | Two green checks | Ready rig |
| Ignition | Gauges in band | Fire button | Coil glows 1.2 s, flash, flame grows | B20 note + page | Burning sample |
| B16 | Guess | Drag fan down | Airflow slows live | Flame quenches (recorded) | Dark sample, B16 card |
| B19 | Guess | Tap fan up ×3 | Fan speeds up | Flame lifts off (recorded) | B19 card |
| Fabric | Guess | Place 6 records | Dots appear on chart | Trend line | Chart + quote |
| Log | Board | Pin a clue | Camera highlights that test | Notebook card | Pinned card |
| Quiet | Dark duct | Filter on | Dim flame becomes findable | "Found" ring | Dim flame |
| Moon | Map | Place marker | Marker snaps to 34 % / 56.5 kPa | Tested region glows; marker becomes "unknown" | Map edge |
| Debrief | Postcard | Play recap / skip | 3 camera shots | Postcard | Postcard |

## Slice 1 shipped (2 Oct 2026)

**What the child now does:** flips gravity on Home (Ember changes), reads a real B19 log line, presses
Start the mission (skippable fly-in), then plays eight chapters with different jobs:
build (tap-preview-install or drag, labelled parts in 3D) → readiness check (fix a loose sample and a
reversed fan, labelled as a made-up puzzle) → B20 dials + igniter with heat-up, flash, replay and skip →
B16 hold-to-turn dial (only the logged endpoints, 3 cm/s and dial 0.4, each cited) → B19 two-position
lever (5 cm/s = B20, 10 cm/s = B19, both cited) → fabric line-up of all six recorded SIBAL quench rows
→ pin one crew-log clue (camera, notebook and recap follow it) → find the hidden dim flame with a
filter, then gust → mark Moon-base air on an O₂ × pressure map → personal debrief (their wind tunnel,
their fixes, their guesses vs NASA's records, their pinned clue, evidence map, 3-shot recap).

**Exact evidence exposed:** B20/B16/B19 verbatim notes with Table A.1 pages (111/112); hardware quotes
per part; radiative-regime and blowoff-kinetics findings; sibal-quench-speeds; tiny-flame-undetected;
exploration-atmosphere (proposal, not a result); luci-first-lunar (partial-gravity research exists).

**Site-wide:** discoveries (learning actions only) replace page-visit stars; evidence constellation on
Home and in the debrief, each star opening a real route or record; guide crew (Tala, Kofi, Dr. Mei)
gives every page a "What am I looking for?" goal, one speaker at a time with Ember; Pause motion in
the header (persists; also stills Ember, crew and sky); living sky (illustrated plate, canvas
starfield, floating astronaut) on Home and the story title; 2D apparatus fallback with the same tasks.

**Checks:** 31 unit tests (new ones tie B16/B19/B20 endpoints, all fabric quench rows and Moon air to
the data); lint and typecheck clean; production build with zero CSP violations; scripted full
playthroughs on desktop 1440, phone 390 and with WebGL disabled (refresh recovery and a wrong guess
included, no errors); no horizontal overflow on 11 routes at 360/390/430; Pause and reduced motion
verified; reduced motion skips the trip.

**Art:** original characters and the sky plate generated with FLUX.1-Krea-dev (public HF Space),
cut out locally with rembg; all labelled as illustration.

**Deferred / limits:** pose variants and lab/Moon/constellation plates (HF free GPU quota ran out;
retry scheduled 3 Oct); per-route task scenes for Atlas, Compare, Flame Vision, Mission, Gaps, Ask
(crew goal lines only so far); keyboard drag alternative is tap-select (drag is mouse only); sound
not re-tuned; headless GPU too slow to film the transition, so it is checked functionally.
