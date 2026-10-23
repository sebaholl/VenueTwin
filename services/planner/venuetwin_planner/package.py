"""Prepare a minimal public viewer pair from a verified local build; never upload."""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
from .build import ROOT, VERIFY, encoded, digest
from .contract import VenueDocument, StrictModel, missing_inputs
from pydantic import Field
from typing import Literal


class Review(StrictModel):
    version: Literal[1]
    input_sha256: str = Field(pattern=r'^[a-f0-9]{64}$')
    model_sha256: str = Field(pattern=r'^[a-f0-9]{64}$')
    reviewer: str = Field(min_length=1, max_length=200, pattern=r'\S')
    reviewed_on: str = Field(pattern=r'^\d{4}-\d{2}-\d{2}$')
    source_rights_confirmed: Literal[True]
    geometry_checked: Literal[True]
    seat_views_checked: Literal[True]
    public_release_approved: Literal[True]


def public_manifest(venue, model_hash, mode):
    quality = {'demo': 'demonstration', 'study': 'study', 'review': 'reviewed'}[mode]
    notices = {
        'demo': 'Fictional demonstration. Not a real venue.',
        'study': 'PUBLIC-SOURCE STUDY ONLY. Seat positions, eye heights, room dimensions and sightlines are estimated and UNVERIFIED. Do not use for ticket or accessibility decisions.',
        'review': 'Operator-reviewed model. Views are approximate; people and event equipment may affect your view.',
    }
    return {
        'format': 'venuetwin-customer', 'version': 1, 'venue_id': venue.venue_id,
        'revision': venue.revision, 'name': venue.name,
        'quality': quality,
        'notice': notices[mode],
        'model': {'file': 'venue.glb', 'sha256': model_hash},
        'levels': [{'id': x.id, 'name': x.name} for x in venue.levels],
        'seats': [{'id': s.id, 'label': s.label, 'row': s.row_label, 'level_id': s.level_id,
                   'position': s.position_m, 'eye': s.eye_position_m, 'yaw': s.yaw_rad} for s in venue.seats],
        'target': venue.stage_target_m,
    }


def package(build_dir: Path, output: Path, *, demo=False, study=False, review: Path | None = None):
    if sum((bool(demo), bool(study), bool(review))) != 1:
        raise ValueError('Choose exactly one of --demo, --study or a completed --review file')
    manifest = json.loads((build_dir / 'manifest.json').read_bytes())
    required = {'input.json', 'packet.json', 'venue.glb', 'builder.json', 'verification.json'}
    if manifest.get('format') != 'venuetwin-build' or manifest.get('version') != 1 or set(manifest.get('files', {})) != required:
        raise ValueError('Unsupported or incomplete build manifest')
    for name in required:
        path = build_dir / name
        if path.is_symlink() or path.stat().st_size > (25 * 1024 * 1024 if name == 'venue.glb' else 2 * 1024 * 1024):
            raise ValueError('Invalid build file')
        if digest(path.read_bytes()) != manifest['files'][name]['sha256']:
            raise ValueError(f'Build integrity check failed: {name}')
    venue = VenueDocument.model_validate_json((build_dir / 'input.json').read_bytes())
    model_hash = manifest['files']['venue.glb']['sha256']
    if review:
        from datetime import date
        approval = Review.model_validate_json(review.read_bytes())
        if date.fromisoformat(approval.reviewed_on) > date.today():
            raise ValueError('Review date cannot be in the future')
        if approval.input_sha256 != manifest['files']['input.json']['sha256'] or approval.model_sha256 != model_hash:
            raise ValueError('Review does not approve this exact input/model pair')
        if missing_inputs(venue):
            raise ValueError('Resolve missing evidence before a customer release; use --demo for fictional data')
    # Re-check geometry with the current verifier, rather than trusting an old report.
    with tempfile.TemporaryDirectory(prefix='vt-public-check-') as temporary:
        for name in ('input.json', 'venue.glb'):
            shutil.copyfile(build_dir / name, Path(temporary) / name)
        subprocess.run(['node', str(VERIFY), temporary], check=True, timeout=60, cwd=ROOT)
    data = public_manifest(venue, model_hash, 'review' if review else 'study' if study else 'demo')
    output.mkdir(parents=False, exist_ok=False)
    try:
        shutil.copyfile(build_dir / 'venue.glb', output / 'venue.glb')
        (output / 'venue.json').write_bytes(encoded(data))
    except BaseException:
        shutil.rmtree(output)
        raise
    return data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('build_dir', type=Path)
    parser.add_argument('output', type=Path)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--demo', action='store_true')
    group.add_argument('--study', action='store_true', help='Publish a clearly unverified local study; never a customer release')
    group.add_argument('--review', type=Path)
    args = parser.parse_args()
    result = package(**vars(args))
    print(json.dumps({'output': str(args.output), 'quality': result['quality'], 'files': ['venue.json', 'venue.glb']}))


if __name__ == '__main__':
    main()
