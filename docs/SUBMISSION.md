# MicroFire Atlas: NASA Space Apps 2026, *Flame in Freefall*

## Problem
NASA has decades of microgravity combustion results, but they sit in separate reports and tables. The challenge asks for an interactive, AI-powered dashboard that summarises, ranks and interprets them for fire safety on the Moon and Mars.

## What we built
1. **A traceable dataset.** 56 BASS and BASS-II tests and 20 Saffire runs, typed from NASA tables with original units, crew notes and page-level provenance. Every quoted finding is checked against the source PDF at build time.
2. **A trained outcome model** (`/predict`). Given oxygen, airflow speed and direction, it estimates the chance a microgravity flame is sustained, with a 90% bootstrap interval, a warning when inputs are outside the tested range, and the five closest real NASA tests.
3. **Ranking.** Observed sustain rate per material with Wilson 95% intervals, plus the Evidence Ladder that ranks which tests are direct, analogous or mechanistic for a mission's conditions.
4. **Cited AI answers** (`/ask`). A language model phrases answers only from an evidence package of NASA records, quotes and the model estimate. Every claim is checked: citations must exist, numbers and units must match, no causal or safety wording, no predictions from past tests.
5. **Interpretation.** Gap map and Research Frontier show where no NASA test covers a mission condition.

## Model and evaluation
- Data: 76 merged rows; 49 usable (17 sustained, 32 not) in 8 test series. Rows with no stated outcome and rows where the crew shut the flow off are excluded.
- Model: regularised logistic regression on oxygen, log airflow and flow direction.
- Evaluation: leave-one-series-out cross-validation (a whole flight or material group hidden), never a random row split.

| Model | Accuracy | Balanced accuracy | Brier |
|---|---|---|---|
| No-skill baseline | 0.65 | 0.50 | 0.251 |
| Oxygen only | 0.71 | 0.66 | 0.176 |
| Oxygen + flow + direction (shipped) | 0.78 | 0.75 | 0.181 |
| All features incl. material | 0.61 | 0.65 | 0.206 |
| **Honest: features chosen inside each fold** | 0.65 | 0.67 | 0.195 |

## Beyond search and chat
- **Next tests** turns the evidence gaps into a ranked plan: which 4 new tests would remove the most uncertainty about Moon and Mars cabins (about 35 % together), computed by value of information over a 1,000-member ensemble.
- **Gravity bridge** is a labelled hypothesis: buoyant flow scales with gravity, so lunar and Martian cabins get a weak natural airflow ISS tests lack. Its parameters are assumptions, shown and adjustable; it has no real partial-gravity validation yet and says so.
- **Burning but unseen** maps where a flame could persist dim and small, built from NASA's own low-airflow findings, and shows that the key regime (below 2 cm/s) has no labelled tests.
- **Materials check** grades a pasted materials list against a cabin using the Evidence Ladder.
- **Retrain + changelog** records every data addition and every score change, including worse ones.
- **Limiting-oxygen curve** answers the engineer's version of the question and shows the data behind the line; the pressure check honestly reports that the data cannot tell yet.
- **Sensitivity analysis** shows which parts of the next-test plan survive our own assumptions.
- **Cabin brief** composes all of the above into one cited, deterministic page.
We believe this combination is new, but we have not verified that nothing similar exists; see `docs/research-competitors.md`.

## Honest limits
- Only ~49 labelled rows, all ISS microgravity, 5 materials. Not valid for Moon or Mars gravity.
- BASS-II outcomes partly reflect how the crew stepped the flow down, so low flow is partly a protocol effect.
- The shipped feature set was chosen using the same cross-validation it is scored on, so scores are slightly optimistic; with this few rows, differences of a few points are noise.
- Only 4 runs report a spread rate, so spread rate is shown as measured, not modelled.
- The estimate is not a NASA safety rating.
- The honest (nested) score is only modestly above the no-skill baseline: accuracy 0.65 vs 0.65, Brier 0.195 vs 0.251. The model is a screening tool, not a forecaster.
- The next-test ranking inherits the model's uncertainty and an assumed extrapolation spread (kappa = 1.5); partial-gravity candidates rank high largely because no real partial-gravity result exists. It is not a NASA test plan.

## Next steps
Add cited rows from NASA PSI and NTRS (`docs/ADD_DATA.md`), then retrain; fit a spread-rate regression once enough runs report it; add partial-gravity data (e.g. the planned lunar experiment) when available.

## Reproduce
`pip install -r pipelines/requirements.txt`, then `python3 pipelines/build_model_table.py && python3 pipelines/train_models.py`; site in `apps/web` (`npm install && npm test && npm run dev`).
