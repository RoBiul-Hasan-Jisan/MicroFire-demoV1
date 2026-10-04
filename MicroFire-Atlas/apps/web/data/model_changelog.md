# Model changelog

Every retrain appends an entry. Written by `pipelines/retrain.py`; do not edit by hand.

## 2026-10-04 (baseline)

- First recorded training: 49 labelled rows (17 sustained, 32 not) in 8 series.
- Cross-validated scores (leave-one-series-out); lower Brier and log-loss are better:

| model | accuracy | balanced acc. | Brier | log-loss |
|---|---|---|---|---|
| baseline_series_prior | 0.653 | 0.5 | 0.251 | 0.699 |
| logistic_oxygen_only | 0.714 | 0.657 | 0.176 | 0.525 |
| logistic_oxygen_flow_direction_SHIPPED | 0.776 | 0.745 | 0.181 | 0.55 |
| nested_selection_honest | 0.653 | 0.665 | 0.195 | 0.567 |

- Honest check: the nested score is better than the no-skill baseline on Brier (0.195 vs 0.251).
- Recommended next tests (value of information):
  1. microgravity, 36 % O2, 2 cm/s forced flow, concurrent
  2. lunar, 36 % O2, 0 cm/s forced flow, concurrent
  3. lunar, 32 % O2, 0 cm/s forced flow, concurrent
  4. lunar, 34 % O2, 0 cm/s forced flow, concurrent
