"""python3 -m unittest tests.test_insight_pipelines"""
import json
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipelines"))
import loc_curve  # noqa: E402
import pressure_check  # noqa: E402
import visibility_measured  # noqa: E402

load = lambda p: json.loads((ROOT / p).read_text())


class Loc(unittest.TestCase):
    def test_solution_is_where_the_model_gives_one_half(self):
        m = load("apps/web/data/model.json")
        B = m["bootstrap"][0]
        o = loc_curve.o2_at_half(B, 10, 0.0)
        import numpy as np
        x = np.array([o, np.log(10), 0.0])
        z = (((x - np.array(B["mu"])) / np.array(B["sd"])) * np.array(B["w"])).sum() + B["b"]
        self.assertAlmostEqual(float(z), 0.0, places=6)

    def test_no_positive_oxygen_effect_means_no_crossing(self):
        B = {"mu": [20, 1, 0], "sd": [2, 1, 1], "w": [-0.5, 1, 0], "b": 0}
        self.assertIsNone(loc_curve.o2_at_half(B, 5, 0.0))


class Pressure(unittest.TestCase):
    def test_report_uses_only_rows_with_stated_pressure(self):
        r = load("data/processed/pressure_report.json")
        self.assertLess(r["n_with_pressure"], r["n_usable_total"])
        self.assertIn(r["verdict"], ("cannot_tell", "pressure_helps"))


class Visibility(unittest.TestCase):
    def test_summary_shares_are_fractions(self):
        for slug in ("saffire-v-ribs", "bass-cassidy-2013"):
            s = visibility_measured.summarize(slug)
            for k in ("share_frames_with_flame", "luminous_share_of_flame_px", "blue_share_of_flame_px"):
                if s[k] is not None:
                    self.assertTrue(0 <= s[k] <= 1)

    def test_manifest_never_holds_an_uncited_airflow(self):
        for i in load("data/curated/visibility_manifest.json")["items"]:
            if i["flow_cm_s"] is not None:
                self.assertTrue(i["citation"], i["slug"])


if __name__ == "__main__":
    unittest.main()
