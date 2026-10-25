"""Audit a real-venue measurement intake; never invent geometry or publish it."""
import argparse
import csv
import json
import math
from pathlib import Path

COUNTS = (21, 22, 21, 22, 21, 22, 19, 22, 21, 20, 19, 18, 15)
FIELDS = ('seat_id', 'level_id', 'row_label', 'seat_label', 'position_x_m',
          'position_y_m', 'position_z_m', 'eye_x_m', 'eye_y_m', 'eye_z_m',
          'yaw_rad', 'source_id', 'uncertainty_m', 'review_status')
METRIC = FIELDS[4:11]
EXPECTED = {(f'stalls-r{row:02d}-s{seat:02d}', 'stalls', str(row), str(seat))
            for row, count in enumerate(COUNTS, 1) for seat in range(1, count + 1)}


def audit(root: Path):
    data = json.loads((root / 'intake.json').read_text())
    if data.get('format') != 'venuetwin-venue-intake' or data.get('version') != 1:
        raise ValueError('Unsupported venue intake format')
    inventory = data.get('confirmed_inventory', {})
    if inventory.get('row_counts') != list(COUNTS) or inventory.get('sale_seat_count') != len(EXPECTED):
        raise ValueError('Intake inventory does not match the checked official stalls plan')
    with (root / 'seat-survey.csv').open(newline='') as source:
        reader = csv.DictReader(source)
        if tuple(reader.fieldnames or ()) != FIELDS:
            raise ValueError('Seat survey columns do not match the intake template')
        rows = list(reader)
    found = [(r['seat_id'], r['level_id'], r['row_label'], r['seat_label']) for r in rows]
    if len(found) != len(EXPECTED) or set(found) != EXPECTED:
        raise ValueError('Stalls seat inventory is incomplete, duplicated or renamed')
    source_ids = {s.get('id') for s in data.get('measurement_input', {}).get('measurement_source_files', [])}
    if None in source_ids: raise ValueError('Measurement sources need stable IDs')
    measured = 0
    for row in rows:
        for key in METRIC:
            if row[key]:
                number = float(row[key])
                if not math.isfinite(number) or abs(number) > (math.tau if key == 'yaw_rad' else 500):
                    raise ValueError(f'Invalid {key} for {row["seat_id"]}')
        if row['uncertainty_m'] and (not math.isfinite(float(row['uncertainty_m'])) or float(row['uncertainty_m']) <= 0):
            raise ValueError(f'Invalid uncertainty for {row["seat_id"]}')
        if row['review_status'] not in ('unmeasured', 'measured'):
            raise ValueError(f'Unknown review status for {row["seat_id"]}')
        if row['review_status'] == 'measured':
            if not all(row[k] for k in METRIC) or not row['uncertainty_m'] or row['source_id'] not in source_ids:
                raise ValueError(f'Measured seat lacks coordinates, uncertainty or registered source: {row["seat_id"]}')
            measured += 1
    geometry = data['measurement_input']
    approval = data['approval']
    missing = []
    if measured != len(EXPECTED): missing.append(f'measured_seat_positions_and_eyes: {measured}/{len(EXPECTED)}')
    for key in ('coordinate_origin_m', 'coordinate_origin_description', 'measured_level_elevations_m',
                'stage_target_m', 'stage_target_source_id',
                'occluder_assessment', 'measurement_source_files', 'photo_records',
                'material_references', 'lighting_references'):
        if not geometry.get(key): missing.append(key)
    if not geometry.get('room_shell_boxes') and not geometry.get('room_shell_meshes'):
        missing.append('room_shell_boxes_or_meshes')
    for key in ('venue_owner_reviewer', 'review_date', 'geometry_approved',
                'seat_views_approved', 'publication_rights_confirmed'):
        if not approval.get(key): missing.append(key)
    return {'venue_id': data['venue_id'], 'scope': data['auditorium_scope'],
            'official_sale_seat_ids': len(EXPECTED), 'measured_seats': measured,
            'ready_for_production_contract': not missing, 'missing': missing}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    args = parser.parse_args()
    report = audit(args.directory)
    print(json.dumps(report, indent=2))
    raise SystemExit(0 if report['ready_for_production_contract'] else 1)


if __name__ == '__main__':
    main()
