import importlib.util
import unittest
from pathlib import Path


spec = importlib.util.spec_from_file_location('inspect_seating_dxf', Path(__file__).resolve().parents[1] / 'inspect-seating-dxf.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class CadFeatureTests(unittest.TestCase):
    def test_width_bounds_and_deduplication(self):
        lines = [((0, 0), (400, 0)), ((400, 0), (0, 0)),
                 ((0, 500), (400, 500)), ((0, 0), (401.1, 0)),
                 ((0, 0), (400, 2)), ((float('nan'), 0), (400, 0))]
        self.assertEqual(module.candidates(lines, bounds_mm=[-10, -10, 500, 100]), [(200.0, 0.0)])
        self.assertEqual(module.candidates(lines), [(200.0, 500.0), (200.0, 0.0)])


if __name__ == '__main__':
    unittest.main()
