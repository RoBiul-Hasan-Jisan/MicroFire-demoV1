# MicroFire Atlas

Data-first fire-safety insights from NASA microgravity combustion experiments (NASA Space Apps 2026, *Flame in Freefall*).

## What is in the project
- `data/curated`, `pipelines/build_dataset.py`: NASA test tables typed in with page-level provenance -> `data/processed/experiments.json`.
- `pipelines/build_model_table.py`: merges BASS, BASS-II and Saffire records into `data/processed/model_table.csv`.
- `pipelines/train_models.py`: trains and cross-validates the outcome model -> `data/processed/model_report.json`, `apps/web/data/model.json`.
- `apps/web`: Next.js site. `/predict` (outcome model), `/ask` (cited answers; includes the model estimate as item `M:outcome-model`), `/atlas`, `/saffire`, `/compare`, `/mission`, `/gaps`, `/methodology`. Story, lab and game pages sit under the "Extras" nav group.

## Outcome model
Question: given oxygen, airflow speed and direction, does the flame keep burning in microgravity?
- 49 labelled tests in 11 series; leave-one-series-out cross-validation; compared with a no-skill baseline.
- Shipped model: regularised logistic regression on oxygen, log airflow and flow direction, with a 200-fit bootstrap interval.
- Limits: ISS microgravity only, 5 materials, ~49 rows; BASS-II outcomes partly reflect how the crew stepped the flow down; not valid for Moon or Mars gravity. Spread rate has only 4 measured values, so it is not modelled.

## Reproduce
```
pip install -r pipelines/requirements.txt
python3 pipelines/build_model_table.py && python3 pipelines/train_models.py
python3 -m unittest tests.test_model
cd apps/web && npm install && npm test && npm run typecheck && npm run dev
```
(`tests/test_build_dataset.py` needs the raw NASA PDFs from `pipelines/fetch_sources.py`.)
