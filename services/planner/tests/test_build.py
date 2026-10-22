from copy import deepcopy
import json
from pathlib import Path
import subprocess
import pytest
from pydantic import ValidationError
from venuetwin_planner.build import build, prepare, encoded, digest
from conftest import ROOT


@pytest.fixture
def fictional():
    return json.loads((ROOT / 'contracts/fixtures/fictional-venue.json').read_text())


def test_fictional_fixture_keeps_provenance_and_explicit_draft_gate(fictional):
    source = (ROOT / 'contracts/fixtures/fictional-venue-source.txt').read_bytes()
    assert fictional['sources'][0]['sha256'] == digest(source)
    with pytest.raises(ValueError, match='allow-unverified'):
        prepare(fictional)
    venue, packet, requirements = prepare(fictional, True)
    assert requirements
    assert all(seat.evidence.status == 'inferred' for seat in venue.seats)
    assert 'DRAFT ONLY' in packet['notice']


def test_mapping_preserves_coordinates_ids_and_input(fictional):
    original = deepcopy(fictional)
    _, packet, _ = prepare(fictional, True)
    for seat in fictional['seats']:
        result = next(s for s in packet['seats'] if s['id'] == seat['id'])
        assert result['position'] == seat['position_m']
        assert result['eye'] == seat['eye_position_m']
        assert result['rotation'] == seat['yaw_rad']
        assert result['target'] == fictional['stage_target_m']
    assert fictional == original
    fictional['seats'].reverse()
    fictional['structures'].reverse()
    assert encoded(prepare(fictional, True)[1]) == encoded(packet)


@pytest.mark.parametrize('case', ['eye', 'target', 'structures', 'seats', 'coincident', 'tiny', 'invalid', 'vertical'])
def test_draft_flag_never_invents_or_repairs_geometry(fictional, case):
    if case == 'eye': fictional['seats'][0]['eye_position_m'] = None
    if case == 'target': fictional['stage_target_m'] = None
    if case == 'structures': fictional['structures'] = []
    if case == 'seats': fictional['seats'] = []
    if case == 'coincident': fictional['seats'][0]['eye_position_m'] = fictional['stage_target_m']
    if case == 'tiny': fictional['structures'][0]['size_m'][0] = .0001
    if case == 'vertical': fictional['seats'][0]['eye_position_m'] = [0, 10, -3]
    if case == 'invalid': fictional['seats'][0]['position_m'][0] = True
    with pytest.raises((ValueError, ValidationError)):
        prepare(fictional, True)


def test_existing_destination_is_untouched(tmp_path, fictional, monkeypatch):
    source = tmp_path / 'source.json'; source.write_bytes(encoded(fictional))
    output = tmp_path / 'existing'; output.mkdir()
    marker = output / 'keep'; marker.write_text('user data')
    monkeypatch.setattr(subprocess, 'run', lambda *a, **k: pytest.fail('must not launch'))
    with pytest.raises(FileExistsError):
        build(source, output, blender='blender', allow_unverified=True)
    assert marker.read_text() == 'user data'


def test_blocked_build_never_launches_or_creates_output(tmp_path, fictional, monkeypatch):
    source = tmp_path / 'source.json'; source.write_bytes(encoded(fictional))
    output = tmp_path / 'output'
    monkeypatch.setattr(subprocess, 'run', lambda *a, **k: pytest.fail('must not launch'))
    with pytest.raises(ValueError, match='Missing verified'):
        build(source, output, blender='blender')
    assert not output.exists()


@pytest.mark.parametrize('failure', [subprocess.CalledProcessError(1, 'blender'), subprocess.TimeoutExpired('blender', 180)])
def test_failed_build_cleans_partial_files_and_filters_secrets(tmp_path, fictional, monkeypatch, failure):
    source = tmp_path / 'source.json'; source.write_bytes(encoded(fictional))
    output = tmp_path / 'output'
    monkeypatch.setenv('OPENAI_API_KEY', 'must-not-inherit')
    def run(command, **kwargs):
        assert 'OPENAI_API_KEY' not in kwargs['env']
        assert '--disable-autoexec' in command
        raise failure
    monkeypatch.setattr(subprocess, 'run', run)
    with pytest.raises(type(failure)):
        build(source, output, blender='blender', allow_unverified=True)
    assert not output.exists()


def test_manifest_only_after_verification_and_binds_every_artifact(tmp_path, fictional, monkeypatch):
    source = tmp_path / 'source.json'; source.write_bytes(encoded(fictional))
    output = tmp_path / 'output'
    def run(command, **kwargs):
        job = Path(command[-1])
        assert not (output / 'manifest.json').exists()
        if command[0] == 'blender':
            (job / 'venue.glb').write_bytes(b'mocked-export')
            (job / 'builder.json').write_text('{"blender_version":"mock"}')
        else:
            assert command[0] == 'node'
            (job / 'verification.json').write_text('{"mock_verification":true}')
    monkeypatch.setattr(subprocess, 'run', run)
    manifest = build(source, output, blender='blender', allow_unverified=True)
    assert manifest['verified_venue'] is False
    assert manifest['requires_human_review'] is True
    assert manifest['requirements']
    for name, metadata in manifest['files'].items():
        assert metadata['sha256'] == digest((output / name).read_bytes())
    assert json.loads((output / 'manifest.json').read_text()) == manifest


def test_verification_failure_never_creates_manifest(tmp_path, fictional, monkeypatch):
    source = tmp_path / 'source.json'; source.write_bytes(encoded(fictional))
    output = tmp_path / 'output'
    def run(command, **kwargs):
        if command[0] == 'node': raise subprocess.CalledProcessError(1, command)
    monkeypatch.setattr(subprocess, 'run', run)
    with pytest.raises(subprocess.CalledProcessError):
        build(source, output, blender='blender', allow_unverified=True)
    assert not output.exists()


def test_container_timeout_removes_named_container(tmp_path, fictional, monkeypatch):
    monkeypatch.setenv('DOCKER_HOST', 'unix:///local-test.sock')
    source = tmp_path / 'source.json'; source.write_bytes(encoded(fictional))
    output = tmp_path / 'output'
    calls = []
    def run(command, **kwargs):
        calls.append(command)
        if command[:2] == ['docker', 'run']:
            assert '--pull=never' in command
            assert command[command.index('--network') + 1] == 'none'
            raise subprocess.TimeoutExpired(command, 180)
    monkeypatch.setattr(subprocess, 'run', run)
    with pytest.raises(subprocess.TimeoutExpired):
        build(source, output, container_image='existing-image', allow_unverified=True)
    name = calls[1][calls[1].index('--name') + 1]
    assert calls[-1] == ['docker', 'rm', '-f', name]
    assert not output.exists()


def test_verified_input_does_not_require_draft_override(complete):
    _, packet, requirements = prepare(complete)
    assert requirements == []
    # Even complete source declarations are not independent venue certification.
    assert 'DRAFT ONLY' in packet['notice']


def test_source_budget_precedes_launch(tmp_path, monkeypatch):
    source = tmp_path / 'large.json'; source.write_bytes(b' ' * (2 * 1024 * 1024 + 1))
    monkeypatch.setattr(subprocess, 'run', lambda *a, **k: pytest.fail('must not launch'))
    with pytest.raises(ValueError, match='2 MiB'):
        build(source, tmp_path / 'output', blender='blender')


def test_remote_docker_never_contacted(tmp_path, fictional, monkeypatch):
    source = tmp_path / 'source.json'; source.write_bytes(encoded(fictional))
    output = tmp_path / 'output'
    monkeypatch.setenv('DOCKER_HOST', 'ssh://remote-builder')
    monkeypatch.setattr(subprocess, 'run', lambda *a, **k: pytest.fail('must not contact remote daemon'))
    with pytest.raises(ValueError, match='local Docker socket'):
        build(source, output, container_image='remote-image', allow_unverified=True)
    assert not output.exists()
