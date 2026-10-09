"""python3 -m unittest discover tests"""
import json
import pathlib
import sys
import tempfile
import unittest

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipelines"))
import gravity_bridge as gb  # noqa: E402
import next_experiments as ne  # noqa: E402
import retrain  # noqa: E402


class Bridge(unittest.TestCase):
    def setUp(self):
        self.model, self.spec = gb.load_model(), gb.load_spec()

    def test_microgravity_adds_no_buoyant_flow(self):
        ens = gb.Ensemble(self.model, self.spec, structural=False)
        eff = ens.effective_flow(np.array([10.0]), np.array([0.0]))
        self.assertTrue(np.allclose(eff, 10.0))

    def test_more_gravity_means_more_effective_flow(self):
        ens = gb.Ensemble(self.model, self.spec, structural=False)
        lunar = ens.effective_flow(np.array([0.0]), np.array([self.spec["gravity_ratio"]["lunar"]]))
        mars = ens.effective_flow(np.array([0.0]), np.array([self.spec["gravity_ratio"]["martian"]]))
        self.assertTrue((mars > lunar).all())

    def test_probabilities_are_probabilities(self):
        ens = gb.Ensemble(self.model, self.spec)
        p = ens.prob([21, 34], [0, 20], ["concurrent", "opposed"], ["lunar", "martian"])
        self.assertTrue(((p > 0) & (p < 1)).all())

    def test_no_validation_rows_means_unvalidated_not_passed(self):
        v = gb.validate(gb.Ensemble(self.model, self.spec), [])
        self.assertEqual(v["verdict"], "unvalidated")

    def test_validation_rows_must_cite_a_source(self):
        with tempfile.TemporaryDirectory() as d:
            f = pathlib.Path(d) / "v.csv"
            f.write_text("id,citation,gravity,o2_pct,forced_flow_cm_s,flow_direction,material,outcome_group\nx,,lunar,21,0,concurrent,PMMA,sustained\n")
            old = gb.VALIDATION
            gb.VALIDATION = f
            try:
                with self.assertRaises(ValueError):
                    gb.load_validation()
            finally:
                gb.VALIDATION = old

    def test_a_real_result_reweights_the_bridge(self):
        ens = gb.Ensemble(self.model, self.spec)
        before = ens.weights.copy()
        ens.reweight([21], [0], ["concurrent"], ["lunar"], [1])
        self.assertFalse(np.allclose(before, ens.weights))
        self.assertAlmostEqual(float(ens.weights.sum()), 1.0)


class Recommender(unittest.TestCase):
    def test_more_tests_never_remove_less_uncertainty(self):
        d = json.loads((ROOT / "data" / "processed" / "next_experiments.json").read_text())
        b = d["headline"]["batch"]
        for i in range(1, len(b)):
            self.assertGreaterEqual(b[i]["cumulative_uncertainty_removed"], b[i - 1]["cumulative_uncertainty_removed"])

    def test_a_test_that_cannot_change_any_member_removes_nothing(self):
        P = np.full((50, 1), 0.5)
        T = np.random.default_rng(0).uniform(size=(50, 2))
        w = np.ones(50) / 50
        prior = float(((w[:, None] * T ** 2).sum(0) - ((w[:, None] * T).sum(0)) ** 2).sum())
        self.assertAlmostEqual(ne.expected_remaining(P, T, w, [0]), prior, places=9)

    def test_a_perfectly_informative_test_removes_all_uncertainty(self):
        P = np.concatenate([np.full(25, 0.999999), np.full(25, 0.000001)])[:, None]
        T = P.copy()
        w = np.ones(50) / 50
        self.assertLess(ne.expected_remaining(P, T, w, [0]), 1e-4)

    def test_candidates_never_go_below_the_tested_airflow(self):
        for c in ne.candidates():
            self.assertTrue(c["forced"] == 0 or c["forced"] >= 2)
            self.assertLessEqual(c["o2"], 36)


class Changelog(unittest.TestCase):
    def test_worse_scores_are_reported_not_hidden(self):
        rep = lambda brier: {"n_rows": 49, "n_sustained": 17, "n_not_sustained": 32, "n_series": 8,
                             "models": {k: {"accuracy": 0.7, "balanced_accuracy": 0.7, "brier": brier, "log_loss": 0.5} for k in retrain.KEYS}}
        text = retrain.entry(rep(0.2), rep(0.3), {}, {}, None, None, "2026-01-01")
        self.assertIn("worse", text)
        self.assertIn("0.2 -> 0.3", text)


if __name__ == "__main__":
    unittest.main()
