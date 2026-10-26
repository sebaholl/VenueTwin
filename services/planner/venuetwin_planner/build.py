"""Explicit local draft builds. No API routes, cloud calls or automatic publication."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from uuid import uuid4
from .contract import VenueDocument, missing_inputs

ROOT = Path(__file__).resolve().parents[3]
WORKER = ROOT / 'scripts/blender/build_production.py'
VERIFY = ROOT / 'scripts/verify-production.mjs'
NOTICE = 'DRAFT ONLY: unverified geometry, illustrative materials; not certified seat views.'


def encoded(value):
    return (json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False) + '\n').encode()


def digest(data):
    return hashlib.sha256(data).hexdigest()


def prepare(value, allow_unverified=False):
    venue = VenueDocument.model_validate(value)
    requirements = [item.model_dump() for item in missing_inputs(venue)]
    if requirements and not allow_unverified:
        raise ValueError('Missing verified inputs; draft builds require --allow-unverified: ' + ', '.join(r['path'] for r in requirements))
    # Draft permission never supplies missing geometry or camera measurements.
    if not venue.structures or not venue.seats or venue.stage_target_m is None:
        raise ValueError('Explicit structures, seats and stage target are required even for drafts')
    target = venue.stage_target_m
    for seat in venue.seats:
        if seat.eye_position_m is None:
            raise ValueError(f'Seat {seat.id} has no explicit eye position')
        if sum((a-b)**2 for a, b in zip(seat.eye_position_m, target)) < 1e-8:
            raise ValueError(f'Seat {seat.id} eye position coincides with stage target')
        if (seat.eye_position_m[0]-target[0])**2 + (seat.eye_position_m[2]-target[2])**2 < 1e-8:
            raise ValueError(f'Seat {seat.id} has an unsupported vertical camera direction')
    if any(min(s.size_m) < .001 for s in venue.structures):
        raise ValueError('This builder supports box dimensions of at least 0.001 m')
    packet = {
        'format': 'venuetwin-build-packet', 'version': 1, 'notice': NOTICE,
        'materials': [{'id': m.id, 'base_color_linear': m.base_color_linear,
                       'roughness': m.roughness, 'metallic': m.metallic}
                      for m in sorted(venue.materials, key=lambda m: m.id)],
        'boxes': [{'id': s.id, 'position': s.position_m, 'size': s.size_m, 'rotation': s.yaw_rad,
                   'material_id': s.material_id}
                  for s in sorted(venue.structures, key=lambda s: s.id) if s.mesh is None],
        'meshes': [{'id': s.id, 'position': s.position_m, 'size': s.size_m, 'rotation': s.yaw_rad,
                    'vertices': s.mesh.vertices_m, 'triangles': s.mesh.triangles,
                    'material_id': s.material_id}
                   for s in sorted(venue.structures, key=lambda s: s.id) if s.mesh is not None],
        'seats': [{'id': s.id, 'position': s.position_m, 'rotation': s.yaw_rad,
                   'eye': s.eye_position_m, 'target': target,
                   'vertical_fov_deg': s.vertical_fov_deg if s.vertical_fov_deg is not None else 65.0}
                  for s in sorted(venue.seats, key=lambda s: s.id)],
    }
    return venue, packet, requirements


def build(source: Path, output: Path, *, blender=None, container_image=None, allow_unverified=False):
    if bool(blender) == bool(container_image):
        raise ValueError('Choose exactly one local Blender executable or existing container image')
    with source.open('rb') as stream:
        raw = stream.read(2 * 1024 * 1024 + 1)
    if len(raw) > 2 * 1024 * 1024:
        raise ValueError('Input exceeds 2 MiB')
    venue, packet, requirements = prepare(json.loads(raw), allow_unverified)
    output = output.resolve()
    # Exclusive reservation: never overwrite an existing directory or follow its symlink.
    output.mkdir(parents=False, exist_ok=False)
    try:
        with tempfile.TemporaryDirectory(prefix='.building-', dir=output) as temporary:
            job = Path(temporary)
            (job / 'input.json').write_bytes(encoded(venue.model_dump()))
            (job / 'packet.json').write_bytes(encoded(packet))
            env = {k: os.environ[k] for k in ('PATH', 'SystemRoot', 'TEMP', 'TMP', 'TMPDIR') if k in os.environ}
            env['HOME'] = tempfile.gettempdir()
            container_name = 'venuetwin-draft-' + uuid4().hex
            if container_image:
                # Reject remote Docker contexts before contacting a daemon.
                endpoint = os.environ.get('DOCKER_HOST')
                if not endpoint:
                    endpoint = subprocess.run(['docker', 'context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'], check=True, capture_output=True, text=True, timeout=15).stdout.strip()
                if not endpoint.startswith(('unix://', 'npipe://')):
                    raise ValueError('Only a local Docker socket is allowed; remote builders are disabled')
                # Never pull or start a hosted builder. All work runs on local Docker.
                subprocess.run(['docker', 'image', 'inspect', container_image], check=True, capture_output=True, timeout=15)
                command = ['docker', 'run', '--name', container_name, '--rm', '--pull=never', '--network', 'none', '--read-only',
                           '--tmpfs', '/tmp:size=512m,mode=1777', '--cap-drop', 'ALL',
                           '--security-opt', 'no-new-privileges', '--memory', '2g', '--cpus', '2', '--pids-limit', '128',
                           '--user', f'{os.getuid()}:{os.getgid()}',
                           '-v', f'{WORKER.parent}:/worker:ro', '-v', f'{job}:/job', container_image,
                           'blender', '--background', '--factory-startup', '--disable-autoexec',
                           '--python-exit-code', '1', '--python', '/worker/build_production.py', '--', '/job']
            else:
                command = [blender, '--background', '--factory-startup', '--disable-autoexec',
                           '--python-exit-code', '1', '--python', str(WORKER), '--', str(job)]
            runner_env = env if not container_image else {k: os.environ[k] for k in ('PATH', 'HOME', 'DOCKER_HOST', 'DOCKER_CONTEXT') if k in os.environ}
            try:
                subprocess.run(command, check=True, env=runner_env, timeout=180, stdout=subprocess.DEVNULL)
            finally:
                if container_image:
                    subprocess.run(['docker', 'rm', '-f', container_name], env=runner_env, timeout=15, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            # Actual Three.js glTF import proves coordinate and camera round-trip before manifest.
            subprocess.run(['node', str(VERIFY), str(job)], check=True, env=env, timeout=60)
            files = ['input.json', 'packet.json', 'venue.glb', 'builder.json', 'verification.json']
            manifest = {
                'format': 'venuetwin-build', 'version': 1, 'builder_version': '1.0.0',
                'venue_id': venue.venue_id, 'revision': venue.revision, 'notice': NOTICE,
                'requires_human_review': True, 'verified_venue': False,
                'allow_unverified': allow_unverified, 'requirements': requirements,
                'source_file_sha256': digest(raw),
                'compiler_sha256': digest(Path(__file__).read_bytes()),
                'contract_sha256': digest((Path(__file__).parent / 'contract.py').read_bytes()),
                'worker_sha256': digest(WORKER.read_bytes()), 'verifier_sha256': digest(VERIFY.read_bytes()),
                'files': {name: {'sha256': digest((job / name).read_bytes()), 'bytes': (job / name).stat().st_size} for name in files},
            }
            for name in files:
                (job / name).replace(output / name)
            (output / 'manifest.json').write_bytes(encoded(manifest))
        return manifest
    except BaseException:
        shutil.rmtree(output)
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    runner = parser.add_mutually_exclusive_group(required=True)
    runner.add_argument('--blender')
    runner.add_argument('--container-image', help='Already-installed local Docker image containing Blender; never pulled')
    parser.add_argument('--allow-unverified', action='store_true', help='Explicitly build unverified draft geometry without claiming survey accuracy')
    args = parser.parse_args()
    result = build(**vars(args))
    print(json.dumps({'output': str(args.output), 'notice': result['notice'], 'requirements': len(result['requirements'])}))


if __name__ == '__main__':
    main()
