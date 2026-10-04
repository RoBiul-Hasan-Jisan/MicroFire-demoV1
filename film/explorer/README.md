# MicroFire Atlas explorer film (4:07, 4K, 60 fps)

A Vox-style walkthrough of the real site: a child plays Mission Freefall and the Follow the Spark adventure, climbs the Evidence Ladder to the Moon, then the film shows the evidence intelligence underneath for mentors and judges: Saffire's spacecraft fires, the ladder's "Why is this shown?" path, cross-experiment warnings, the Research Frontier and open data.

- **Footage** is the live site, rendered frame by frame on a virtual clock (`capture.mjs`), so it is perfectly smooth at 3840×2160 and 60 fps. Real-time screen capture stutters whenever Chrome pauses, so nothing here runs in real time:
  - Playwright's clock drives the page's timers and requestAnimationFrame;
  - every CSS animation is set to the frame's time through the Web Animations API;
  - videos are seeked frame by frame;
  - scrolling and the cursor are tweened.

  Each click is timed to the line that describes it.
- **Overlay**: the finger cursor, tap ripples, key-phrase captions, the opening Earth-vs-orbit explainer and the animated end card are a recording-only overlay (`overlay.js`). The explainer is labelled as an illustration. In the end card, a spark flies in and draws a flame constellation, then the title, the three promises, the crew, PIX and the link appear in turn.
- **Voice**: Microsoft neural TTS, female voice Ava (`en-US-AvaMultilingualNeural`). Each sentence is voiced separately and joined with natural pauses (`narrate.py`). The film shows an "AI voiceover" tag.
- **Music**: a soft generated drone chord bed that ducks under the voice. There are no third-party tracks.
- **Facts** are checked against `apps/web/data`: 76 test records (56 BASS-II tests, 20 Saffire runs) and 54 findings verified word for word at build time. In the B20 → B16 example, the airflow is turned down, B16 quenched, and the record is on PDF p. 111. In the Moon chapter, each clue's rung comes from the ladder rules, and the direct rung stays empty because no record matches 34 % O₂ at 56.5 kPa in lunar gravity.

```bash
# site running on :3417 (cd apps/web && npm run build && npx next start -p 3417)
EDGE_TTS=/path/to/edge-tts python3 narrate.py   # build/<scene>.wav + build/timed.json
node capture.mjs all                             # build/<scene>.mp4, 4K60 (about 30 min on an M3 Pro)
python3 assemble.py                              # MicroFire-Atlas-explorer-film.mp4
```
