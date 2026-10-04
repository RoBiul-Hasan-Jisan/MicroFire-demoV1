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


class Saffire(unittest.TestCase):
    """The Saffire transcription is checked against NASA's table lines; a single wrong value must fail the build."""

    @classmethod
    def setUpClass(cls):
        import saffire
        cls.mod = saffire
        cls.sources = json.loads((ROOT / "data" / "sources.json").read_text())
        cls.runs = {r["id"]: r for r in saffire.build_saffire(cls.sources)}

    def test_runs_and_spot_values(self):
        self.assertEqual(len(self.runs), 20)
        self.assertEqual(self.runs["saffire-1-1"]["spread_rate_mm_s"], 1.8)  # Table I, PDF p. 29
        self.assertEqual((self.runs["saffire-vi-2"]["pressure_kpa"], self.runs["saffire-vi-2"]["o2_pct"]), (54.1, 31.0))  # Saffire VI Table 1
        self.assertEqual(self.runs["saffire-vi-1"]["outcome_group"], "not_ignited")
        self.assertIsNone(self.runs["saffire-vi-1"]["flow_cm_s"])  # not stated for the Nomex sample

    def _tampered(self, row_id, field, value):
        import csv, tempfile, shutil
        tmp = pathlib.Path(tempfile.mkdtemp())
        rows = list(csv.DictReader(open(ROOT / "data" / "curated" / "saffire_runs.csv", encoding="utf-8")))
        for r in rows:
            if r["id"] == row_id:
                r[field] = value
        with open(tmp / "saffire_runs.csv", "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=rows[0].keys())
            w.writeheader()
            w.writerows(rows)
        old = self.mod.CURATED
        self.mod.CURATED = tmp
        try:
            with self.assertRaises(ValueError):
                self.mod.build_saffire(self.sources)
        finally:
            self.mod.CURATED = old
            shutil.rmtree(tmp)

    def test_a_wrong_value_fails(self):
        self._tampered("saffire-1-1", "spread_rate_mm_s", "1.9")   # row table
        self._tampered("saffire-vi-2", "o2_pct", "34.0")           # column table
        self._tampered("saffire-v-2", "cond_col", "1")             # wrong column
        self._tampered("saffire-2-7", "quote", "The Nomex burned.")  # quote not in source
