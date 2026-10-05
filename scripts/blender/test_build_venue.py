import unittest
from build_venue import to_blender, validate


class BlueprintTests(unittest.TestCase):
    def blueprint(self):
        return {'format': 'venuetwin-blender', 'version': 1, 'units': 'metres', 'axes': 'three-y-up',
                'boxes': [{'position': [1, 2, 3], 'size': [2, 3, 4], 'rotation': .5, 'color': '#abcdef'}], 'seats': []}

    def test_coordinates(self):
        self.assertEqual(to_blender([1, 2, 3]), (1, -3, 2))

    def test_valid(self):
        self.assertEqual(validate(self.blueprint())['version'], 1)

    def test_invalid_dimensions(self):
        data = self.blueprint(); data['boxes'][0]['size'][0] = -1
        with self.assertRaises(ValueError): validate(data)

    def test_nonfinite(self):
        data = self.blueprint(); data['boxes'][0]['position'][0] = float('nan')
        with self.assertRaises(ValueError): validate(data)

    def test_normal_project_rejected(self):
        with self.assertRaises(ValueError): validate({'config': {}})

    def test_segmented_balconies_allowed(self):
        data = self.blueprint(); data['boxes'] = data['boxes'] * 1000
        self.assertEqual(len(validate(data)['boxes']), 1000)

    def test_oversized_architecture_rejected(self):
        data = self.blueprint(); data['boxes'] = data['boxes'] * 2001
        with self.assertRaises(ValueError): validate(data)


if __name__ == '__main__':
    unittest.main()
