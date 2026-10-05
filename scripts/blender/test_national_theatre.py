import copy
import math
import unittest
from build_national_theatre import validate, make_geometry


def blueprint():
    return {'format':'venuetwin-blender','version':1,'axes':'three-y-up','units':'metres',
            'detail':{'profile':'nd-photo-study-v1','stageWidth':11.5,'stage':{},
                      'rows':[{'row':0,'floor':3.7,'arcRadius':10.6,'arcDegrees':155,'offsetY':-1.8,'levelId':'first'}]},
            'seats':[{'label':'A1','position':[0,3.95,8.8],'rotation':0}]}


class DetailTests(unittest.TestCase):
    def test_geometry_is_finite_and_indices_valid(self):
        geometry, _ = make_geometry(blueprint())
        for vertices, faces in geometry.parts.values():
            self.assertTrue(all(math.isfinite(n) for p in vertices for n in p))
            self.assertTrue(all(0 <= index < len(vertices) for face in faces for index in face))

    def test_does_not_mutate_source_or_seat_positions(self):
        data=blueprint(); before=copy.deepcopy(data)
        geometry, _ = make_geometry(data)
        self.assertEqual(data,before)
        self.assertIn(('Seats','velvet'),geometry.parts)
        self.assertIn(('Ceiling','gold'),geometry.parts)
        self.assertIn(('Side boxes','carpet'),geometry.parts)

    def test_requires_detailed_export(self):
        data=blueprint(); del data['detail']
        with self.assertRaisesRegex(ValueError,'detailed theatre JSON'): validate(data)

    def test_rejects_changed_centres_instead_of_misalignment(self):
        data=blueprint(); r=copy.deepcopy(data['detail']['rows'][0]); r['offsetY']=1
        data['detail']['rows'].append(r)
        with self.assertRaisesRegex(ValueError,'share a centre'): validate(data)

    def test_rejects_rotated_stage(self):
        data=blueprint(); data['detail']['stage']['rotation']=30
        with self.assertRaisesRegex(ValueError,'original position'): validate(data)

    def test_rejects_nonfinite_geometry(self):
        for value in [float('nan'),float('inf'),-10,10000]:
            data=blueprint(); data['detail']['rows'][0]['arcRadius']=value
            with self.assertRaises(ValueError): validate(data)


if __name__=='__main__': unittest.main()
