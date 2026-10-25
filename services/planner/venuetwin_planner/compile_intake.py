"""Compile a reviewed Prague survey into the strict Blender production contract.

This is deliberately deterministic: no model call, geometry inference, or publication.
"""
import argparse
import csv
import hashlib
import json
from pathlib import Path

from .contract import VenueDocument, missing_inputs
from .intake import audit


def compile_intake(root: Path) -> VenueDocument:
    report = audit(root)
    if not report['ready_for_production_contract']:
        raise ValueError('Intake is incomplete: ' + ', '.join(report['missing']))
    data = json.loads((root / 'intake.json').read_text())
    geometry = data['measurement_input']
    required = ('stage_target_uncertainty_m', 'scale_uncertainty_m',
                'seat_inventory_uncertainty_m')
    missing = [key for key in required if geometry.get(key) is None]
    if missing:
        raise ValueError('Intake is incomplete: ' + ', '.join(missing))

    def source(entry, kind):
        if kind not in ('survey', 'drawing', 'photo'):
            raise ValueError(f'Unsupported evidence kind: {kind}')
        relative = Path(entry['file'])
        if relative.is_absolute() or '..' in relative.parts or relative == Path('.'):
            raise ValueError(f'Unsafe source path: {relative}')
        path = (root / relative).resolve()
        if not path.is_relative_to(root.resolve()) or not path.is_file():
            raise ValueError(f'Missing local source file: {relative}')
        return {'id': entry['id'], 'kind': kind,
                'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                'description': entry['description']}

    sources = [source(s, s['kind']) for s in geometry['measurement_source_files']]
    sources += [source(s, 'photo') for s in geometry['photo_records']]

    def evidence(source_id, uncertainty, status='measured'):
        return {'status': status, 'source_ids': [source_id], 'uncertainty_m': uncertainty}

    levels = [{'id': key, 'name': value['name'], 'elevation_m': value['elevation_m'],
               'evidence': evidence(value['source_id'], value['uncertainty_m'])}
              for key, value in sorted(geometry['measured_level_elevations_m'].items())]
    with (root / 'seat-survey.csv').open(newline='') as stream:
        rows = list(csv.DictReader(stream))
    calibrations = geometry.get('camera_calibrations', {})
    if set(calibrations) - {row['seat_id'] for row in rows}:
        raise ValueError('Camera calibration references an unknown seat')
    seats = [{'id': row['seat_id'], 'label': row['seat_label'], 'level_id': row['level_id'],
              'row_label': row['row_label'],
              'position_m': [float(row[f'position_{axis}_m']) for axis in 'xyz'],
              'eye_position_m': [float(row[f'eye_{axis}_m']) for axis in 'xyz'],
              'yaw_rad': float(row['yaw_rad']),
              'evidence': evidence(row['source_id'], float(row['uncertainty_m'])),
              'vertical_fov_deg': calibrations[row['seat_id']]['vertical_fov_deg'] if row['seat_id'] in calibrations else None,
              'camera_source_id': calibrations[row['seat_id']]['photo_source_id'] if row['seat_id'] in calibrations else None}
             for row in rows]
    structures = []
    for key, kind in (('room_shell_boxes', 'shell'), ('occluder_boxes', 'obstruction')):
        for box in geometry[key]:
            structures.append({'id': box['id'], 'kind': kind, 'position_m': box['position_m'],
                               'size_m': box['size_m'], 'yaw_rad': box['yaw_rad'],
                               'evidence': evidence(box['source_id'], box['uncertainty_m'])})
    survey = geometry['measurement_source_files'][0]['id']
    occluders = geometry['occluder_assessment']
    value = {'format': 'venuetwin-production', 'version': '1.0.0',
             'venue_id': data['venue_id'], 'revision': 1, 'name': data['venue_name'],
             'units': 'metres', 'axes': geometry['axes'],
             'origin': f"{geometry['coordinate_origin_description']} ({geometry['coordinate_origin_m']} m)",
             'sources': sources, 'levels': levels, 'seats': seats, 'structures': structures,
             'stage_target_m': geometry['stage_target_m'],
             'stage_target_evidence': evidence(geometry['stage_target_source_id'], geometry['stage_target_uncertainty_m']),
             'coverage': {'scale': evidence(survey, geometry['scale_uncertainty_m']),
                          'seat_inventory': evidence(survey, geometry['seat_inventory_uncertainty_m']),
                          'occluders': evidence(occluders['source_id'], occluders['uncertainty_m']),
                          'materials': evidence(geometry['material_references'][0], None, 'documented'),
                          'lighting': evidence(geometry['lighting_references'][0], None, 'documented')}}
    venue = VenueDocument.model_validate(value)
    missing = missing_inputs(venue)
    if missing:
        raise ValueError('Production contract is incomplete: ' + ', '.join(item.path for item in missing))
    return venue


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    venue = compile_intake(args.directory)
    args.output.open('x').write(venue.model_dump_json(indent=2) + '\n')
    print(f'Compiled {len(venue.seats)} measured seats to {args.output}; human review remains required.')


if __name__ == '__main__':
    main()
