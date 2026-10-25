"""A public seating plan must not silently become measured seat views."""
import csv
import json
from pathlib import Path
import pytest
from venuetwin_planner.intake import audit
from venuetwin_planner.compile_intake import compile_intake
from venuetwin_planner.build import prepare
from conftest import ROOT

SOURCE = ROOT / 'venue-data/national-theatre-prague'


def copied(tmp_path):
    for name in ('intake.json', 'seat-survey.csv'):
        (tmp_path / name).write_bytes((SOURCE / name).read_bytes())
    return tmp_path


def test_official_inventory_is_real_but_has_no_measured_seat_views():
    result = audit(SOURCE)
    assert result['official_sale_seat_ids'] == 263
    assert result['measured_seats'] == 0
    assert not result['ready_for_production_contract']
    assert 'stage_target_m' in result['missing']
    assert 'publication_rights_confirmed' in result['missing']
    with pytest.raises(ValueError, match='measured_seat_positions_and_eyes'):
        compile_intake(SOURCE)


def test_complete_synthetic_survey_compiles_without_guessing(tmp_path):
    root = copied(tmp_path)
    (root / 'survey.txt').write_text('synthetic test fixture')
    (root / 'photo.txt').write_text('synthetic visual reference')
    data = json.loads((root / 'intake.json').read_text())
    g = data['measurement_input']
    g.update(coordinate_origin_m=[0.0, 0.0, 0.0], coordinate_origin_description='Stage centre',
             measured_level_elevations_m={'stalls': {'name': 'Stalls', 'elevation_m': 0.0,
                                                      'source_id': 'survey', 'uncertainty_m': 0.01}},
             room_shell_boxes=[{'id': 'shell', 'position_m': [0.0, 2.0, 0.0],
                                'size_m': [20.0, 4.0, 30.0], 'yaw_rad': 0.0,
                                'source_id': 'survey', 'uncertainty_m': 0.01}],
             stage_target_m=[0.0, 1.0, -10.0], stage_target_source_id='survey',
             stage_target_uncertainty_m=0.01, scale_uncertainty_m=0.01,
             seat_inventory_uncertainty_m=0.01,
             occluder_assessment={'source_id': 'survey', 'uncertainty_m': 0.01},
             measurement_source_files=[{'id': 'survey', 'kind': 'survey', 'file': 'survey.txt',
                                        'description': 'Synthetic test survey'}],
             photo_records=[{'id': 'photo', 'file': 'photo.txt',
                             'description': 'Synthetic test visual reference'}],
             material_references=['photo'], lighting_references=['photo'])
    data['approval'] = {'venue_owner_reviewer': 'Test fixture only', 'review_date': '2026-01-01',
                        'geometry_approved': True, 'seat_views_approved': True,
                        'publication_rights_confirmed': True}
    (root / 'intake.json').write_text(json.dumps(data))
    with (root / 'seat-survey.csv').open(newline='') as stream:
        reader = csv.DictReader(stream); rows = list(reader); fields = reader.fieldnames
    for index, row in enumerate(rows):
        row.update(position_x_m=str((index % 21) - 10), position_y_m='0',
                   position_z_m=str(index // 21), eye_x_m=str((index % 21) - 10),
                   eye_y_m='1.2', eye_z_m=str(index // 21), yaw_rad='0',
                   source_id='survey', uncertainty_m='0.01', review_status='measured')
    with (root / 'seat-survey.csv').open('w', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=fields); writer.writeheader(); writer.writerows(rows)
    venue = compile_intake(root)
    assert len(venue.seats) == 263
    assert venue.seats[0].eye_position_m[1] == 1.2
    assert not prepare(venue.model_dump())[2]
    g['measurement_source_files'][0]['file'] = '../outside.txt'
    (root / 'intake.json').write_text(json.dumps(data))
    with pytest.raises(ValueError, match='Unsafe source path'):
        compile_intake(root)


def test_estimated_prague_study_cannot_enter_reviewed_pipeline():
    document = json.loads((SOURCE / 'unverified-production-draft.json').read_text())
    venue, _, requirements = prepare(document, allow_unverified=True)
    assert len(venue.seats) == 263
    assert len(requirements) > 1000
    assert all(seat.evidence.status != 'measured' for seat in venue.seats)
    with pytest.raises(ValueError, match='Missing verified inputs'):
        prepare(document)


def test_numbering_cannot_be_deleted_or_duplicated(tmp_path):
    root = copied(tmp_path)
    with (root / 'seat-survey.csv').open(newline='') as source:
        reader = csv.DictReader(source); rows = list(reader); fields = reader.fieldnames
    rows[0]['seat_id'] = rows[1]['seat_id']
    with (root / 'seat-survey.csv').open('w', newline='') as target:
        writer = csv.DictWriter(target, fieldnames=fields); writer.writeheader(); writer.writerows(rows)
    with pytest.raises(ValueError, match='incomplete, duplicated or renamed'): audit(root)


def test_unproven_measurement_status_is_rejected(tmp_path):
    root = copied(tmp_path)
    with (root / 'seat-survey.csv').open(newline='') as source:
        reader = csv.DictReader(source); rows = list(reader); fields = reader.fieldnames
    rows[0]['review_status'] = 'measured'
    with (root / 'seat-survey.csv').open('w', newline='') as target:
        writer = csv.DictWriter(target, fieldnames=fields); writer.writeheader(); writer.writerows(rows)
    with pytest.raises(ValueError, match='Measured seat lacks'): audit(root)


def test_untrusted_numbering_count_is_rejected(tmp_path):
    root = copied(tmp_path)
    data = json.loads((root / 'intake.json').read_text())
    data['confirmed_inventory']['row_counts'][0] = 22
    (root / 'intake.json').write_text(json.dumps(data))
    with pytest.raises(ValueError, match='official stalls plan'): audit(root)
