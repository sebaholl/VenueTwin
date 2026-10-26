import hashlib
import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from venuetwin_planner.build import prepare
from venuetwin_planner.textures import load_textures, validate_png


ROOT = Path(__file__).resolve().parents[3]
FIXTURE = ROOT / 'contracts/fixtures/fictional-texture-venue.json'
ASSETS = ROOT / 'contracts/fixtures/textures'


def document():
    return json.loads(FIXTURE.read_text())


def test_texture_fixture_is_source_linked_and_local():
    venue, packet, _ = prepare(document(), True)
    result = load_textures(venue, ASSETS)
    assert len(result) == 1
    sha, data = next(iter(result.items()))
    assert hashlib.sha256(data).hexdigest() == sha
    assert packet['materials'][0]['texture_sha256'] == sha
    assert len(packet['meshes'][0]['triangle_uv']) == len(packet['meshes'][0]['triangles'])


def test_texture_requires_asset_and_matching_source(tmp_path):
    venue, _, _ = prepare(document(), True)
    with pytest.raises(ValueError, match='require --assets'):
        load_textures(venue, None)
    with pytest.raises(ValueError, match='Missing local texture'):
        load_textures(venue, tmp_path)
    changed = document()
    changed['sources'][-1]['sha256'] = '0' * 64
    changed_venue, _, _ = prepare(changed, True)
    (tmp_path / ('0' * 64 + '.png')).write_bytes(next(iter(load_textures(venue, ASSETS).values())))
    with pytest.raises(ValueError, match='hash differs'):
        load_textures(changed_venue, tmp_path)


def test_texture_contract_rejects_missing_uv_and_wrong_source_kind():
    changed = document()
    changed['structures'][0]['mesh'].pop('triangle_uv')
    with pytest.raises(ValidationError, match='requires measured mesh triangle UVs'):
        prepare(changed, True)
    changed = document()
    changed['sources'][-1]['kind'] = 'drawing'
    with pytest.raises(ValidationError, match='requires its own photo source'):
        prepare(changed, True)
    changed = document()
    changed['version'] = '1.2.0'
    with pytest.raises(ValidationError, match='require production contract 1.3.0'):
        prepare(changed, True)


def test_png_validation_rejects_corruption():
    image = next(iter(ASSETS.glob('*.png'))).read_bytes()
    validate_png(image)
    bad = bytearray(image)
    bad[-8] ^= 1
    with pytest.raises(ValueError, match='CRC'):
        validate_png(bytes(bad))
