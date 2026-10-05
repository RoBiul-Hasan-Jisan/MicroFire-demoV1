# What is new in this version

The project started as a story/game-style site with a verified NASA dataset, an evidence ladder and a cited Ask page. It had no trained model. This version adds the data-and-AI part the challenge asks for.

## 0. Latest additions
- **Scenario Dossier** (`/dossier`): one scenario, five numbered answers, a shareable link, Markdown download and print. Linked from Challenge Mode and the judge tour (now nine stops of 10 s).
- **What-if Lab** (`/what-if`): counterfactual evidence explorer with an evidence-weighted envelope, one-condition-at-a-time comparison and a coverage map. Blocks the number outside tested conditions. See the FLARE-X tracker in `README.md`.
- **Next tests** (`/next-tests`): ranks new experiments by expected uncertainty removed about Moon and Mars cabins.
- **Gravity bridge** (`/gravity-bridge`): one transparent, adjustable, unvalidated way to read ISS results at 0.17 g and 0.38 g, with a scorecard against NASA statements already in the atlas.
- **Burning but unseen** (`/unseen`): where a flame could persist small and dim, and where the data stop (no labelled test below 2 cm/s).
- **Materials check** (`/materials`): evidence grade per material for a whole list.
- **Limiting-oxygen curve** (`/limiting-oxygen`) with a pressure check that says "cannot tell" because pressure is stated for only 20 of 49 tests.
- **Sensitivity** of the next-test plan to the buoyant-flow, exponent and extrapolation assumptions: the kind of test is robust, the exact order is not.
- **Cabin brief** (`/brief`): deterministic cited brief with Markdown download.
- **Measured visibility pipeline**: finds that Saffire videos saturate (most frames overexposed) and BASS stills are blue-dominant, and that no curve is possible until media with cited airflow are added.
- **Retrain + changelog** (`pipelines/retrain.py`, `/changelog`).
- **Honest score**: a nested cross-validation row (feature choice made inside each fold). Brier 0.195 vs 0.251 baseline, accuracy 0.653; the earlier 0.776 accuracy was optimistic.
- **Consistency fixes**: series count is 8 (docs said 11); /mission and /predict now describe their roles consistently.

## 1. Trained outcome model
Question: given oxygen, airflow speed and flow direction, does a microgravity flame keep burning?

- Merged table of BASS, BASS-II and Saffire tests: 76 rows, 49 usable (17 sustained, 32 not), in 8 test series.
- Excluded on purpose: rows with no stated outcome, and rows where the crew shut the flow off themselves.
- Model: regularised logistic regression, 90% bootstrap interval from 200 refits.
- Evaluation: leave-one-series-out cross-validation (a whole flight or material group is hidden), compared with a no-skill baseline.

| Model | Accuracy | Balanced accuracy |
|---|---|---|
| No-skill baseline | 0.65 | 0.50 |
| Oxygen only | 0.71 | 0.66 |
| Oxygen + flow + direction (shipped) | 0.78 | 0.75 |
| All features incl. material | 0.61 | 0.65 |

Material and thickness did not help, so the shipped model leaves them out.

## 2. New page: `/predict`
Calculator (oxygen, airflow, direction), estimate with interval, out-of-range warning, five closest real NASA tests, cross-validation table, material ranking with 95% Wilson intervals, measured spread rates, and a list of limits.

## 3. Model connected to Ask
When a question gives both oxygen and airflow, the estimate joins the evidence package as `M:outcome-model`, after all NASA evidence. It is labelled as not a NASA result, skipped for Moon/Mars questions, and checked by the same claim checker (wrong numbers are flagged).

## 4. Navigation and home page
- New nav order: Model & Analysis, Evidence, Mission, About, Extras. Story, lab and game pages moved to Extras.
- Home page: the Explorer card is replaced by an Outcome Model card with the live cross-validation score.

## 5. Methodology
New "Outcome model" section (data, exclusions, score table, limits). The old "no prediction" limitation now describes the model honestly.

## 6. Easy way to add data
`data/curated/extra_runs.csv` accepts new cited rows (a row without a citation is rejected). See `docs/ADD_DATA.md`.

## 7. Documents
`README.md` (was empty), `docs/SUBMISSION.md` (Space Apps write-up), `docs/ADD_DATA.md`, and this file.

## Files added
- `pipelines/build_model_table.py`, `pipelines/train_models.py` (+ `scikit-learn` in `requirements.txt`)
- `data/processed/model_table.csv`, `data/processed/model_report.json`, `data/curated/extra_runs.csv`
- `apps/web/data/model.json`
- `apps/web/lib/model.ts`, `apps/web/lib/model.test.ts`
- `apps/web/app/predict/page.tsx`, `apps/web/components/predict/PredictClient.tsx`
- `tests/test_model.py`
- `docs/ADD_DATA.md`, `docs/SUBMISSION.md`, `docs/WHATS_NEW.md`

## Files changed
- `apps/web/lib/ask-core.ts`, `apps/web/app/api/ask/route.ts`, `apps/web/components/AskPanel.tsx`, `apps/web/lib/ask-core.test.ts`
- `apps/web/components/StationMap.tsx` (nav), `apps/web/components/HomePaths.tsx`, `apps/web/components/HomePaths.module.css`, `apps/web/lib/guide.ts`
- `apps/web/app/methodology/page.tsx`
- `README.md`

## Honest limits
- About 49 labelled rows, all ISS microgravity, 5 materials. Not valid for Moon or Mars gravity.
- BASS-II outcomes partly reflect how the crew stepped the flow down.
- Feature choice and scoring used the same cross-validation, so scores are slightly optimistic; a few points between models is noise.
- Only 4 runs report a spread rate, so it is shown, not modelled.
- Checked here: 90 TypeScript tests and 7 Python model tests pass. `next build` and the full typecheck were not run (no network); run `npm install && npm run typecheck && npm run dev` in `apps/web`.
