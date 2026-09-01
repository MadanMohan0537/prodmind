import unittest
from datetime import datetime, timezone
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))
from drift import detect_drift, kl_divergence
from weighted_ctfidf import weight


class AlgorithmsTest(unittest.TestCase):
    def test_identical_distribution_has_zero_drift(self):
        self.assertEqual(kl_divergence({"a": 1}, {"a": 1}), 0)

    def test_vocabulary_change_is_detected(self):
        self.assertEqual(detect_drift(["export report"], ["login crash"])["level"], "high")

    def test_current_reliable_record_has_full_weight(self):
        now = datetime(2026, 1, 1, tzinfo=timezone.utc)
        self.assertEqual(weight(now.isoformat(), 1, 30, now), 1)


if __name__ == "__main__":
    unittest.main()
