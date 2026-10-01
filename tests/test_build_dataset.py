"""python3 -m unittest discover tests"""
import json
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipelines"))
import build_dataset as b  # noqa: E402


class Units(unittest.TestCase):
    def test_conversions(self):
        self.assertEqual(b.cm_to_mm(2.2), 22.0)
        self.assertEqual(b.um_to_mm(100), 0.1)
        self.assertEqual(b.atm_to_kpa(1), 101.325)
        self.assertIsNone(b.cm_to_mm(None))


class Dataset(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.records = {r["id"]: r for r in b.build()}
        cls.sources = {s["source_id"] for s in json.loads((ROOT / "data" / "sources.json").read_text())}

    def test_counts(self):
        self.assertEqual(len(self.records), 31 + 25)

    def test_values_match_nasa_tables(self):
        # Spot checks typed straight from the PDF, independent of the CSVs.
        r = self.records["sibal-GMT45-T4"]
        self.assertEqual((r["width_mm"], r["flow_initial_cm_s"], r["flow_final_cm_s"], r["oxygen_vol_pct"]), (22.0, 10, 2.2, 18.7))
        self.assertEqual(r["outcome"], "quenched_low_flow")
        r = self.records["bass2-B19"]
        self.assertEqual((r["thickness_mm"], r["width_mm"], r["oxygen_vol_pct"], r["outcome"]), (0.1, 20.0, 16.4, "blowoff"))
        self.assertEqual(self.records["bass2-B15"]["outcome"], "sustained_no_blowoff")

    def test_table_a1_rows_cite_their_own_page(self):
        # Table A.1 spans PDF pages 111-112; checked by eye against the PDF.
        pages = {r["test_id"]: r["provenance"]["record"]["pdf_page"] for r in self.records.values() if r["id"].startswith("bass2-B")}
        self.assertEqual(pages["B16"], 111)
        self.assertEqual(pages["B19"], 112)
        self.assertEqual(pages["B20"], 112)

    def test_every_record_cites_a_known_source(self):
        for r in self.records.values():
            self.assertIn(r["provenance"]["record"]["source_id"], self.sources, r["id"])

    def test_outcomes_are_known_codes(self):
        for r in self.records.values():
            self.assertIn(r["outcome"], b.OUTCOMES)

    def test_no_invented_pressure_for_bass2_tables(self):
        # Table A pressure is only a series range; it must never appear as a per-test value.
        for r in self.records.values():
            if r["id"].startswith("bass2-"):
                self.assertIsNone(r["pressure_kpa"], r["id"])

    def test_suspect_o2_flagged(self):
        for tid in ("sibal-GMT45-T1", "sibal-GMT45-T2", "bass2-B3", "bass2-B5"):
            self.assertIn("o2_reading_suspect", self.records[tid]["quality_flags"])

    def test_misquote_is_rejected(self):
        sources = [{"source_id": "s", "ntrs_id": "x", "abstract": "Flames were dim and blue."}]
        orig = b.CURATED
        tmp = ROOT / "data" / "processed" / "_test_curated"
        tmp.mkdir(parents=True, exist_ok=True)
        try:
            (tmp / "findings.json").write_text(json.dumps([{"id": "f", "source_id": "s", "in": "abstract", "quote": "Flames were bright."}]))
            b.CURATED = tmp
            with self.assertRaises(ValueError):
                b.build_findings(sources, set())
        finally:
            b.CURATED = orig
            (tmp / "findings.json").unlink()
            tmp.rmdir()

    def test_quench_requires_falling_flow(self):
        row = {"test_id": "X", "investigation": "BASS-II", "sample_width_cm": "2.2", "flow_start_cm_s": "3",
               "flow_end_cm_s": "5", "o2_vol_pct": "18", "o2_reading_suspect": "false", "comment_verbatim": "Quenched"}
        with self.assertRaises(ValueError):
            b.sibal_record(row)


if __name__ == "__main__":
    unittest.main()
