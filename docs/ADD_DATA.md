# Adding more NASA data (the fastest way to improve the model)

The model is limited by ~49 labelled rows, so every new cited test helps.

1. Find a test table in NASA PSI (psi.nasa.gov) or an NTRS report with oxygen, airflow speed, flow direction and a stated outcome.
2. Add one row per test to `data/curated/extra_runs.csv` (header is already there):
   `id, source, series, material, thickness_mm, o2_pct, pressure_kpa, flow_cm_s, flow_direction, outcome_group, outcome_raw, spread_rate_mm_s, citation`
   - `outcome_group`: `sustained`, `extinguished`, `not_ignited` or `unknown`.
   - `series`: the flight or campaign name. Cross-validation hides a whole series at a time, so keep it truthful.
   - `citation` is required (report, table, page). A row without one is rejected.
   - Leave a cell empty if the source does not state it. Never estimate.
   - Do not label a test `extinguished` if the crew ended it by switching the flow off.
3. Rebuild and retrain:
   ```
   python3 pipelines/build_model_table.py && python3 pipelines/train_models.py
   python3 -m unittest tests.test_model
   ```
4. Check `data/processed/model_report.json`: scores should still beat the baseline. If they do not, report that honestly.
5. Once 10 or more rows have a measured spread rate with varied conditions, a spread-rate regression becomes worth trying.

## Adding partial-gravity results (tests the gravity bridge)
Add rows to `data/curated/partial_gravity_validation.csv` (columns: id, citation, gravity [lunar|martian], o2_pct, forced_flow_cm_s, flow_direction, material, outcome_group). Every row needs a citation. Then run `python3 pipelines/retrain.py`: the bridge is re-weighted, the next-test plan updates, and `/gravity-bridge` reports how many real results agree. `retrain.py` also writes the changelog entry.
