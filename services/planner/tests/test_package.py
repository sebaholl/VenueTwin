import json
import subprocess
from datetime import date
from pathlib import Path
import pytest
from venuetwin_planner.build import encoded, digest
from venuetwin_planner.package import package


@pytest.fixture
def bundle(tmp_path, complete, monkeypatch):
    source = tmp_path / 'build'; source.mkdir()
    files = {'input.json': encoded(complete), 'venue.glb': b'mocked-model', 'packet.json': b'{}', 'builder.json': b'{}', 'verification.json': b'{}'}
    for name, data in files.items(): (source / name).write_bytes(data)
    manifest = {'format': 'venuetwin-build', 'version': 1, 'files': {k: {'sha256': digest(v)} for k, v in files.items()}}
    (source / 'manifest.json').write_bytes(encoded(manifest))
    review = tmp_path / 'review.json'
    review.write_bytes(encoded({'version': 1, 'input_sha256': digest(files['input.json']), 'model_sha256': digest(files['venue.glb']), 'reviewer': 'Test reviewer', 'reviewed_on': date.today().isoformat(), 'source_rights_confirmed': True, 'geometry_checked': True, 'seat_views_checked': True, 'public_release_approved': True}))
    def verify(command, **kwargs):
        assert command[0] == 'node'
        assert Path(command[-1]) != source
        assert (Path(command[-1]) / 'venue.glb').read_bytes() == files['venue.glb']
    monkeypatch.setattr(subprocess, 'run', verify)
    return source, review, tmp_path / 'public'


def test_reviewed_package_exports_only_public_pair(bundle):
    source, review, output = bundle
    before = {p.name: p.read_bytes() for p in source.iterdir()}
    result = package(source, output, review=review)
    assert result['quality'] == 'reviewed'
    assert sorted(p.name for p in output.iterdir()) == ['venue.glb', 'venue.json']
    assert not {'sources', 'coverage', 'evidence', 'reviewer'} & result.keys()
    assert all(set(s) == {'id', 'label', 'row', 'level_id', 'position', 'eye', 'yaw'} for s in result['seats'])
    assert before == {p.name: p.read_bytes() for p in source.iterdir()}


def test_demo_explicit_and_labelled(bundle):
    source, _, output = bundle
    with pytest.raises(ValueError, match='Choose exactly one'): package(source, output)
    assert package(source, output, demo=True)['quality'] == 'demonstration'


def test_unreviewed_real_study_is_labelled_and_separate_from_customer_approval(bundle):
    source, _, output = bundle
    result = package(source, output, study=True)
    assert result['quality'] == 'study'
    assert 'UNVERIFIED' in result['notice']
    assert result['model']['file'] == 'venue.glb'


@pytest.mark.parametrize('field,value', [('model_sha256', '0'*64), ('geometry_checked', False), ('reviewed_on', '2999-01-01'), ('reviewer', ' ')])
def test_invalid_review_prevents_output(bundle, field, value):
    source, review, output = bundle
    data = json.loads(review.read_bytes()); data[field] = value; review.write_bytes(encoded(data))
    with pytest.raises(ValueError): package(source, output, review=review)
    assert not output.exists()


def test_tampered_build_prevents_output(bundle):
    source, review, output = bundle
    (source / 'venue.glb').write_bytes(b'tampered')
    with pytest.raises(ValueError, match='integrity'): package(source, output, review=review)
    assert not output.exists()


def test_missing_evidence_recomputed_not_trusted(bundle):
    source, review, output = bundle
    data = json.loads((source / 'input.json').read_bytes())
    data['seats'][0]['evidence']['status'] = 'inferred'
    (source / 'input.json').write_bytes(encoded(data))
    manifest = json.loads((source / 'manifest.json').read_bytes())
    new_hash = digest(encoded(data)); manifest['files']['input.json']['sha256'] = new_hash
    (source / 'manifest.json').write_bytes(encoded(manifest))
    approval = json.loads(review.read_bytes()); approval['input_sha256'] = new_hash; review.write_bytes(encoded(approval))
    with pytest.raises(ValueError, match='missing evidence'): package(source, output, review=review)
    assert not output.exists()


def test_existing_output_not_overwritten(bundle):
    source, _, output = bundle; output.mkdir(); (output / 'keep').write_text('keep')
    with pytest.raises(FileExistsError): package(source, output, demo=True)
    assert (output / 'keep').read_text() == 'keep'


def test_verifier_failure_prevents_publication(bundle, monkeypatch):
    source, review, output = bundle
    def fail(*args, **kwargs): raise subprocess.CalledProcessError(1, 'node')
    monkeypatch.setattr(subprocess, 'run', fail)
    with pytest.raises(subprocess.CalledProcessError): package(source, output, review=review)
    assert not output.exists()
