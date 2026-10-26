"""Render a named Lantern seat from the same eye, target and FOV as Three.js.

blender -b lantern-showcase.blend --python scripts/blender/render_showcase_seat.py -- \
  venue.json stalls-r06-s09 /path/to/seat.png
"""
import bpy
import json
import math
import sys
from pathlib import Path
from mathutils import Vector


def main():
    args = sys.argv[sys.argv.index('--') + 1:]
    if len(args) != 3:
        raise ValueError('Expected manifest path, seat ID and output PNG path')
    manifest = json.loads(Path(args[0]).read_text())
    if manifest.get('venue_id') != 'lantern-opera-house' or manifest.get('quality') != 'demonstration':
        raise ValueError('Expected the original Lantern demonstration manifest')
    matches = [seat for seat in manifest['seats'] if seat['id'] == args[1]]
    if len(matches) != 1:
        raise ValueError('Unknown or duplicated seat ID')
    seat = matches[0]
    eye = Vector((seat['eye'][0], -seat['eye'][2], seat['eye'][1]))
    target = Vector((manifest['target'][0], -manifest['target'][2], manifest['target'][1]))
    camera = bpy.context.scene.camera
    if not camera:
        raise ValueError('Editable scene has no camera')
    camera.location = eye
    camera.rotation_euler = (target - eye).to_track_quat('-Z', 'Y').to_euler()
    camera.data.type = 'PERSP'
    camera.data.sensor_fit = 'VERTICAL'
    camera.data.angle_y = math.radians(seat['vertical_fov_deg'])
    scene = bpy.context.scene
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = str(Path(args[2]).resolve())
    bpy.ops.render.render(write_still=True)
    print('Rendered named seat:', seat['id'], 'eye:', tuple(eye), 'vertical FOV:', seat['vertical_fov_deg'])


if __name__ == '__main__':
    main()
