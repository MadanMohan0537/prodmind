import tempfile, unittest
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parents[1] / "src"))
from data import label_maps, read_jsonl, validate_row

class DataTests(unittest.TestCase):
    def test_valid_row(self): self.assertEqual(validate_row({"text":"Good","label":"positive","language":"en"}), [])
    def test_invalid_label(self): self.assertTrue(validate_row({"text":"Good","label":"happy","language":"en"}))
    def test_label_maps_are_reversible(self):
        label_to_id, id_to_label = label_maps()
        self.assertEqual(id_to_label[label_to_id["negative"]], "negative")
    def test_jsonl_reader(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "data.jsonl"
            path.write_text('{"text":"Good","label":"positive","language":"en"}\n', encoding="utf-8")
            self.assertEqual(len(read_jsonl(path)), 1)

if __name__ == "__main__": unittest.main()
