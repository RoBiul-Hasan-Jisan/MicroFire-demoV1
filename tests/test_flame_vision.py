"""Synthetic checks for the Flame Vision segmentation. Run with the pipeline venv:
    .venv/bin/python -m unittest tests.test_flame_vision
"""
import pathlib
import sys
import unittest

try:
    import cv2  # noqa: F401
    import numpy as np
except ImportError:  # pragma: no cover - the plain-python test run skips this module
    raise unittest.SkipTest("OpenCV not installed; run with .venv/bin/python")

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "pipelines"))
import flame_vision as fv  # noqa: E402

CFG = fv.CONFIG["saffire-vi-pmma"]


def frame():
    return np.full((200, 400, 3), 12, np.uint8)  # near-black background (BGR)


class Segmentation(unittest.TestCase):
    def test_yellow_patch_is_luminous(self):
        img = frame()
        img[80:120, 50:150] = (40, 200, 240)  # BGR yellow-orange
        m = fv.measure(img, CFG, (0, 0, 400, 200))
        self.assertAlmostEqual(m["luminous_px"], 40 * 100, delta=60)
        self.assertEqual(m["blue_px"], 0)
        self.assertEqual(m["regions"], 1)

    def test_dim_blue_patch_is_blue_not_luminous(self):
        img = frame()
        img[60:100, 200:260] = (110, 60, 30)  # BGR dim blue
        m = fv.measure(img, CFG, (0, 0, 400, 200))
        self.assertGreater(m["blue_px"], 2000)
        self.assertEqual(m["luminous_px"], 0)

    def test_roi_excludes_inset(self):
        img = frame()
        img[80:120, 360:390] = (40, 200, 240)  # bright patch only inside the excluded inset
        W = 400
        m = fv.measure(img, CFG, fv.roi_pixels(CFG, W, 200))
        self.assertEqual(m["area_px"], 0)
        self.assertIn("weak_or_no_flame", m["flags"])

    def test_saturated_core_is_luminous(self):
        img = frame()
        img[80:120, 50:150] = (40, 200, 240)
        img[95:105, 90:110] = (255, 250, 250)  # overexposed core with a slight blue tint
        m = fv.measure(img, CFG, (0, 0, 400, 200))
        self.assertAlmostEqual(m["luminous_px"], 40 * 100, delta=60)  # no hole in the middle

    def test_specks_are_dropped(self):
        img = frame()
        img[10:12, 10:12] = (40, 200, 240)  # 4 px speck
        self.assertEqual(fv.measure(img, CFG, (0, 0, 400, 200))["area_px"], 0)

    def test_coordinates_are_normalised_to_full_frame(self):
        img = frame()
        img[100:140, 200:240] = (40, 200, 240)
        m = fv.measure(img, CFG, (0, 0, 400, 200))
        cx, cy = m["centroid"]
        self.assertAlmostEqual(cx, 220 / 400, delta=0.01)
        self.assertAlmostEqual(cy, 120 / 200, delta=0.01)


if __name__ == "__main__":
    unittest.main()
