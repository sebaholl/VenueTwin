"""A public seating plan must not silently become measured seat views."""
import csv
import json
from pathlib import Path
import pytest
from venuetwin_planner.intake import audit
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
