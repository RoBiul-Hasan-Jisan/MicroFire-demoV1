# MicroFire Atlas

**From NASA flame data to mission-relevant fire-safety evidence.**

Live: **https://microfire-atlas.vercel.app**. Built for the NASA Space Apps Challenge 2026, *Flame in Freefall*.

## What problem it solves

NASA has studied fire in microgravity for decades, but the results are spread across test tables, figures and reports. A crew-safety researcher or mission planner cannot quickly ask: *"For this material and this cabin atmosphere, what did NASA actually observe, and how sure can we be?"*

MicroFire Atlas puts NASA's microgravity fire tests on one map, test by test. It ranks them against a mission scenario and compares outcomes. It also shows where the evidence runs out.

## Why microgravity fire matters

On Earth, hot gas rises and draws fresh air into a flame. In orbit nothing rises, so a flame is fed only by the ventilation flow. NASA's BASS experiments found flames "especially sensitive to air flow speed in the range 0 to 5 cm/s". At the lowest speeds, flames became "dim blue and very stable" and could burn for a long time. Every quote on the site links to its NASA source.

## NASA data used

| Source (NTRS) | Used for |
|---|---|
| BASS-II Summary Report, NASA/TM-20210011385 | 56 test records transcribed from Tables 7.1, A.1, A.2 |
| BASS-II results (20160000593), BASS thickness study (20140011099) | Verified findings about low-flow flames |
| PMMA rods in concurrent flow (20150008961), SIBAL fabric (20150008962) | Quenching and blowoff findings |
| Effects of Confinement (20205004657) | Saffire vs BASS scale caveat |
| Microgravity vs Martian gravity (20130010991), LUCI (20250010653) | Partial-gravity evidence |
| Exploration atmosphere study (20220009546) | The 56.5 kPa / 34 % O₂ scenario |

Run `python3 pipelines/fetch_sources.py` to download every PDF from NTRS. Hashes are in `data/sources.json`. The raw PDFs are not committed.

## What we implemented

- **Atlas**: all 56 tests, filterable, plotted by oxygen and airflow, colored by outcome.
- **Test pages**: every value is labelled *recorded for this test*, *stated for the series*, *derived by us* or *not stated*, with a link to the PDF page.
- **Compare Lab**: five presets that hold conditions constant where NASA's tables allow. Each separates observed facts, our interpretation, and data gaps.
- **Mission Lab**: ranks tests against a cabin scenario (oxygen, airflow, pressure, gravity, material) with a transparent **Mission Relevance** score and a separate **Evidence Confidence** checklist. It flags scenarios outside the tested range.
- **Evidence gaps**: an oxygen × airflow map of observed, sparse and empty regions.
- **Ask**: citation-checked answers (see below).
- **Methodology** and **Sources** pages generated from the code and manifest.

## Where AI is used

Only on the Ask page. Deterministic search first builds an evidence package of tests and verbatim NASA quotes. Claude (Opus 5.5, structured output) answers only from that package. Every claim is typed as observed, derived, interpretation or data gap, and is checked:

- citations not in the package are removed;
- numbers must appear in the cited evidence.

Without `ANTHROPIC_API_KEY`, or on any error, the page shows the evidence only. Everything else works without AI.

## Scientific methods

- Unit conversion and outcome coding in `pipelines/build_dataset.py`, with tests.
- Every quoted finding is matched against the source PDF or abstract at build time. A misquote fails the build.
- Mission Relevance:

  ```
  relevance = Σ wᵢ·simᵢ / Σ wᵢ
  ```

  - `simᵢ = exp(−|Δ|/scale)`, with scales taken from the data.
  - Missing values count against a test, never for it.

  Weights and scales are shown on `/methodology`.

## Limitations

- 56 tests, three materials (PMMA, SIBAL fabric, Nomex), thin samples, all run in orbit near 1 atm.
- Many flows ended at fan settings with no recorded velocity.
- Outcome codes are our reading of short crew notes.
- No flame video analysis yet.
- Scores are project heuristics, **not NASA ratings or fire-risk predictions**.

## Run it

```bash
python3 pipelines/fetch_sources.py   # download NASA PDFs (needs pdftotext)
python3 pipelines/build_dataset.py   # build + verify data into apps/web/data
python3 -m unittest discover tests   # data tests

cd apps/web
npm install
npm test            # ranking, gaps, presets, citation-check tests
npm run typecheck
npm run dev         # http://localhost:3000
```

Optional: set `ANTHROPIC_API_KEY` to enable AI answers on `/ask`.

## Security

HawkScan (StackHawk) DAST runs against the site and `/api/ask` (`stackhawk.yml`, `openapi.yaml`). The site enforces:

- a strict nonce-based CSP with no `unsafe-inline`;
- anti-clickjacking and `nosniff` headers;
- a JSON-only, input-validated and rate-limited API.

## Demo film

`film/` builds a 240-second narrated film from the same data and code. See `film/README.md`.


## Attribution

All data comes from the NASA Technical Reports Server (ntrs.nasa.gov). NTRS copyright determinations are listed per source on `/sources`. Not affiliated with or endorsed by NASA.

MIT licensed.
