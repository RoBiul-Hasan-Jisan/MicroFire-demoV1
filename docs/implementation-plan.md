# MicroFire Atlas: Experience Edition implementation plan

Milestone 0 audit against `MicroFire-Atlas-Claude-Code-Master-Prompt (1).md` (Experience Edition). Written 2026-10-01.

## 1. Current state

| Area | Status | Notes |
|---|---|---|
| Data | **Working, real** | 56 test records hand-transcribed from NASA/TM-20210011385 Tables 7.1, A.1, A.2; per-test PDF page; units normalised by tested Python; 33 NASA quotes verified verbatim at build time. |
| Atlas | Working | Filters, oxygen × airflow plot, table. No URL state yet. |
| Test pages (`/experiments/[id]`) | Working | Every value labelled recorded / series / derived / not stated, with page links. |
| Compare | Working | 5 controlled presets with observed / interpretation / gaps. **No media** (none existed). |
| Mission Lab | Working | Transparent relevance + separate confidence checklist, out-of-domain notice. **No named evidence categories** yet. |
| Evidence gaps | Working | O₂ × airflow grid, observed / sparse / outside. |
| Ask | Working, AI off in prod | Deterministic retrieval → Claude with structured output → claim-level citation check; evidence-only fallback. No `ANTHROPIC_API_KEY` on Vercel yet. |
| Mission Freefall game (`/story`) | Working | 8-chapter game with Ember. See §4 conflict note. |
| Home | Working | Ember hero + scroll-driven 3D story. |
| 3D | Working | Plain three.js, lazy-loaded, disposed, reduced-motion aware, WebGL fallback text. Flames labelled as illustrations. |
| **Real NASA media** | **Missing** | No footage, so no Flame Vision and no CV. This is the largest gap against the prompt. |
| **CV pipeline** | **Missing** | |
| Evidence drawer (global) | Partial | Only inside the game. |
| Demo mode (`?demo=1`) | Missing | |
| Docs set (§38) | Partial | README + methodology page; most `docs/*.md` missing. |
| Security | Working | Strict nonce CSP, HawkScan clean except one triaged false positive. |

## 2. What in the Experience Edition is a real upgrade

Ranked by judge impact; each is something the current site does not do.

1. **Flame Vision on real NASA footage** (§9, §16, §26). NASA's image library has public Saffire-V (2021) and Saffire-VI (2024) flame-spread videos of PMMA burning inside Cygnus, plus BASS/BASS-II flame stills from the ISS. A reproducible OpenCV pipeline can segment the flame per frame and report pixel-domain area, extent, centroid and leading-edge position with an overlay. That makes the "AI/CV contribution" visible, which nothing on the site does now.
2. **Analyze page** with RAW / AI VISION / MEASUREMENTS modes, a scrubbable timeline, chart ↔ video sync and metric hover highlighting.
3. **Story = evidence journey** (§6–14): ignition concept → gravity shift → real experiment → Flame Vision → change one condition (matched experiment, never interpolated) → compare → Moon scenario → ask → evidence boundary.
4. **Evidence categories** in Mission Lab (Strong direct / Related / Partial / Evidence gap) with documented thresholds.
5. **Global Evidence drawer** (§19) with source, caveats and processing provenance; bottom sheet on mobile.
6. **`?demo=1` judge path** (§36 M11) that only preselects real curated evidence.
7. **Docs** (§38): product vision, data provenance, scientific methodology, limitations, demo script, architecture, validation.

Not upgrades (already met or skipped deliberately): typed data contracts and local/offline data (already static JSON); FastAPI backend (no live processing needed, so precomputed analysis stays static); predictive ML (not justified by 56 heterogeneous rows, per §27).

## 3. Scientific constraints for the new media

- Saffire videos carry NASA's description but **no per-frame oxygen, pressure or flow**. The UI must say which conditions are unknown for the footage.
- No spatial calibration is published with the videos, so every CV metric is **pixel-domain only** and labelled that way.
- The Saffire-VI file name says "20x"; NASA's text does not define it. Time is shown as video time, with that caveat.
- BASS-II stills are single photos without a test ID. They can be used as illustrations of the hardware and flames, not linked to a specific table row.

## 4. Conflict to flag

§41 says not to copy the reference product's "rocket-builder concept". Mission Freefall's "build the wind tunnel" chapter uses NASA's own hardware and assembly rule, so it is not a rocket builder, but the mechanic (assemble parts, then test) is similar. Keep it as an optional **Play** mode, and make the evidence journey the default story as the prompt requires. Decide with the user if it should go.

## 5. Milestones (this pass)

| # | Deliverable | Acceptance |
|---|---|---|
| M2 | Media manifest + downloaded, re-encoded NASA videos/stills with provenance | Every media file has NASA ID, URL, licence note, hash |
| M4 | CV pipeline (`pipelines/flame_vision.py`, OpenCV) + precomputed `frame_metrics.json`, overlays, processing version | Deterministic; documented thresholds; quality flags; tested on synthetic frames |
| M4 | `/analyze/[mediaId]` Flame Vision UI | RAW / AI VISION / MEASUREMENTS; scrub; chart click seeks; hover highlights |
| M3 | Evidence-journey story on home | Real NASA footage within 20 s |
| M6 | Evidence categories in Mission Lab | Thresholds documented and tested |
| M1 | Global evidence drawer | Keyboard, focus return, bottom sheet on mobile |
| M11 | `?demo=1` | Only preselects |
| Docs | §38 set | Written for judges and reviewers |

Then hand off to Codex with the adversarial review prompt.

## 6. Audience update (user direction, 2026-10-01)

The site's primary audience is children aged 8-13; mentors and judges must still find the full science.
Two layers, never two versions of the facts:

- **Explorer** (default): Ember floats on every page with a short, page-aware tour that points at real
  elements, kid-friendly fun facts (each a rewording of a verified NASA quote, with the quote and page
  shown underneath; numbers are tested against the quote), Explorer stars for pages explored, friendlier
  type (Fredoka headings, Lexend body) and larger tap targets.
- **Scientist**: the same tour in technical language. All data, citations, methods and caveats stay on the
  pages in both modes.

This sits in tension with the Experience Edition's "premium scientific system" styling; the user's audience
direction takes precedence, and the evidence rules are unchanged.
