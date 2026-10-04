# MicroFire Atlas

Data-first fire-safety insights from NASA microgravity combustion experiments (NASA Space Apps 2026, *Flame in Freefall*).

## What is in the project
- `data/curated`, `pipelines/build_dataset.py`: NASA test tables typed in with page-level provenance -> `data/processed/experiments.json`.
- `pipelines/build_model_table.py`: merges BASS, BASS-II and Saffire records into `data/processed/model_table.csv`.
- `pipelines/train_models.py`: trains and cross-validates the outcome model -> `data/processed/model_report.json`, `apps/web/data/model.json`.
- `apps/web`: Next.js site. `/predict` (outcome model), `/ask` (cited answers; includes the model estimate as item `M:outcome-model`), `/atlas`, `/saffire`, `/compare`, `/mission`, `/gaps`, `/methodology`. Story, lab and game pages sit under the "Extras" nav group.

## Strict evidence check, fire response and MCP
`/will-it-burn` (rules, no model) and `/fire-response` use the FlameScope evidence core in `apps/web/strict`. See `docs/FLAMESCOPE_PARITY.md`. Run its tests with `cd apps/web/strict && node --test`.

## Outcome model
Question: given oxygen, airflow speed and direction, does the flame keep burning in microgravity?
- 49 labelled tests in 8 series; leave-one-series-out cross-validation; compared with a no-skill baseline.
- Shipped model: regularised logistic regression on oxygen, log airflow and flow direction, with a 200-fit bootstrap interval.
- Limits: ISS microgravity only, 5 materials, ~49 rows; BASS-II outcomes partly reflect how the crew stepped the flow down; not valid for Moon or Mars gravity. Spread rate has only 4 measured values, so it is not modelled.

## Planning and hypothesis tools
- `/next-tests`: next-experiment recommender. `pipelines/next_experiments.py` scores 418 candidate tests by how much each would shrink uncertainty about five Moon/Mars cabins (value of information over 1,000 ensemble members) and picks a greedy batch of 4.
- `/gravity-bridge`: an explicitly UNVALIDATED hypothesis for reading ISS results at lunar and Martian gravity (`pipelines/gravity_bridge.py`, `apps/web/lib/gravity-bridge.ts`). Real partial-gravity results go in `data/curated/partial_gravity_validation.csv`; with none added it reports "unvalidated".
- `/unseen`: "burning but unseen" map. Combines NASA's low-airflow findings (dim blue, stable, possibly undetected) with the model and marks the airflow range with no data.
- `/materials`: paste a materials list and a cabin, get an evidence grade per material (direct / analogous / no evidence), CSV export.
- `/limiting-oxygen`: the model's 50 % oxygen line at each airflow with its uncertainty band, drawn over the real tests (`pipelines/loc_curve.py`), plus a pressure check on the rows that state pressure (`pipelines/pressure_check.py`; verdict today: cannot tell).
- `/brief`: cabin brief generator. Cited one-page brief for a cabin and materials list (evidence, model or bridge, visibility, next tests), downloadable as Markdown. Deterministic; no language model. (`/mission/brief` is the older single-question printable record.)
- Sensitivity of the next-test plan to our own assumptions: `pipelines/sensitivity.py`, shown on `/next-tests`.
- Measured visibility from NASA media: `pipelines/visibility_measured.py`; it reports honestly that no curve exists yet because the media records state no airflow.
- `/changelog`: `python3 pipelines/retrain.py` rebuilds everything after you add cited rows and appends a changelog entry (including when scores get worse). `.github/workflows/retrain.yml` runs it on push.

## More data and the write-up
- `docs/ADD_DATA.md`: how to add cited rows via `data/curated/extra_runs.csv` and retrain.
- `docs/SUBMISSION.md`: the Space Apps write-up (problem, method, results, limits).

## Reproduce
```
pip install -r pipelines/requirements.txt
python3 pipelines/build_model_table.py && python3 pipelines/train_models.py && python3 pipelines/retrain.py   # rebuilds table, model, pressure check, limiting-oxygen curve, next-test plan, sensitivity, visibility, changelog
python3 -m unittest tests.test_model tests.test_next_experiments tests.test_insight_pipelines
cd apps/web && npm install && npm test && npm run typecheck && npm run dev
```
(`tests/test_build_dataset.py` needs the raw NASA PDFs from `pipelines/fetch_sources.py`.)

Smoke test after a build: `npx next start -p 3111` then `node apps/web/scripts/smoke.mjs`. Playwright specs in `apps/web/e2e` have not been run yet.

## What is left for a person to do
Everything that needs real NASA data or a real browser is listed, with exact steps, in `docs/TODO_REAL_DATA.md` (partial-gravity results, BASS pressures, low-airflow media, Ask integration, accessibility and deploy checks). Deployment and demo notes: `docs/DEPLOY.md`, `docs/DEMO_SCRIPT.md`.
