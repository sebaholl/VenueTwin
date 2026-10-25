import copy
import unittest
from build_production import validate, to_blender


class ProductionPacketTests(unittest.TestCase):
    def setUp(self):
        self.packet = {'format': 'venuetwin-build-packet', 'version': 1,
                       'boxes': [{'id': 'box', 'position': [1, 2, 3], 'size': [2, 3, 4], 'rotation': .4}],
                       'seats': [{'id': 'seat', 'position': [1, .25, 3], 'rotation': .1,
                                  'eye': [1, 1.15, 3], 'target': [0, 2, -3], 'vertical_fov_deg': 52.0}]}

    def test_conversion_preserves_signed_axes(self):
        self.assertEqual(to_blender([1, 2, 3]), (1, -3, 2))
        self.assertEqual(to_blender([-1, -2, -3]), (-1, 3, -2))

    def test_valid_packet_unchanged(self):
        original = copy.deepcopy(self.packet)
        self.assertEqual(validate(self.packet), original)

    def test_custom_triangle_mesh_is_validated_before_blender(self):
        self.packet['meshes'] = [{'id': 'shell', 'position': [0, 0, 0], 'rotation': 0, 'size': [2, 2, 2],
                                  'vertices': [[-1, -1, -1], [1, -1, -1], [0, 1, -1], [0, 0, 1]],
                                  'triangles': [[0, 1, 2], [0, 3, 1], [1, 3, 2], [2, 3, 0]]}]
        self.assertEqual(validate(self.packet), self.packet)
        self.packet['meshes'][0]['triangles'][0] = [0, 0, 2]
        with self.assertRaises(ValueError): validate(self.packet)

    def test_bad_inputs_fail_before_blender_import(self):
        for case in ['version', 'boolean', 'nan', 'duplicate', 'empty', 'camera', 'size', 'fov']:
            with self.subTest(case=case):
                packet = copy.deepcopy(self.packet)
                if case == 'version': packet['version'] = True
                if case == 'boolean': packet['boxes'][0]['rotation'] = True
                if case == 'nan': packet['boxes'][0]['position'][0] = float('nan')
                if case == 'duplicate': packet['seats'] *= 2
                if case == 'empty': packet['boxes'] = []
                if case == 'camera': packet['seats'][0]['target'] = packet['seats'][0]['eye']
                if case == 'size': packet['boxes'][0]['size'][0] = 0
                if case == 'fov': packet['seats'][0]['vertical_fov_deg'] = 0
                with self.assertRaises(ValueError): validate(packet)


if __name__ == '__main__':
    unittest.main()
