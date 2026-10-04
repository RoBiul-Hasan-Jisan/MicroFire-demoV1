"""python3 -m unittest discover tests"""
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipelines"))
import build_model_table as t  # noqa: E402
import train_models as m  # noqa: E402


class ModelTable(unittest.TestCase):
    def test_experimenter_ended_and_unknown_rows_never_train(self):
        rows = list(t.bass_rows()) + list(t.saffire_rows())
        for r in rows:
            if r["outcome_group"] == "unknown" or r["outcome_raw"] in t.EXPERIMENTER_ENDED:
                self.assertEqual(r["usable_label"], 0, r["id"])

    def test_no_invented_values(self):
        for r in t.saffire_rows():
            if r["id"] == "saffire-vi-1":
                self.assertIsNone(r["o2_pct"])
                self.assertEqual(r["usable_label"], 0)


class Evaluation(unittest.TestCase):
    def test_cv_hides_whole_series(self):
        rows = m.load()
        groups = [r["series"] for r in rows]
        y, oof = m.cross_validate(rows, groups, m.FEATURES_SEL, m.thickness_median)
        self.assertEqual(len(y), len(oof))
        self.assertGreater(len(set(groups)), 5)

    def test_wilson_interval_contains_rate(self):
        lo, hi = m.wilson(8, 19)
        self.assertLess(lo, 8 / 19)
        self.assertGreater(hi, 8 / 19)


if __name__ == "__main__":
    unittest.main()
