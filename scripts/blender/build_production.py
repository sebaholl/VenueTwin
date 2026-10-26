"""Internal worker for validated local build packets. No external resources or code."""
import json
import math
import sys
from pathlib import Path


def vector(value, positive=False):
    return (isinstance(value, list) and len(value) == 3
            and all(type(v) in (int, float) and math.isfinite(v)
                    and (.001 <= v <= 500 if positive else abs(v) <= 500) for v in value))


def validate(packet):
    if not isinstance(packet, dict) or packet.get('format') != 'venuetwin-build-packet' or type(packet.get('version')) is not int or packet['version'] != 1:
        raise ValueError('Unsupported build packet')
    meshes = packet.get('meshes', [])
    materials = packet.get('materials', [])
    if not isinstance(materials, list) or len(materials) > 100:
        raise ValueError('Invalid material count')
    material_ids = set()
    for item in materials:
        if not isinstance(item, dict) or not isinstance(item.get('id'), str) or not 1 <= len(item['id']) <= 100 or item['id'] in material_ids:
            raise ValueError('Invalid material ID')
        material_ids.add(item['id'])
        color = item.get('base_color_linear')
        if not isinstance(color, list) or len(color) != 3 or any(type(value) not in (int, float) or not math.isfinite(value) or not 0 <= value <= 1 for value in color):
            raise ValueError('Invalid material color')
        if any(type(item.get(key)) not in (int, float) or not math.isfinite(item[key]) or not 0 <= item[key] <= 1 for key in ('roughness', 'metallic')):
            raise ValueError('Invalid material surface')
    if not isinstance(meshes, list) or len(meshes) > 2000 or not 1 <= len(packet.get('boxes', [])) + len(meshes) <= 2000:
        raise ValueError('Invalid mesh count')
    for group in ('boxes', 'seats', 'meshes'):
        items = meshes if group == 'meshes' else packet.get(group)
        if not isinstance(items, list) or (group == 'seats' and not 1 <= len(items) <= 2000) or len(items) > 2000:
            raise ValueError('Invalid object count')
        ids = set()
        for item in items:
            if not isinstance(item, dict) or not isinstance(item.get('id'), str) or not 1 <= len(item['id']) <= 100 or item['id'] in ids:
                raise ValueError('Invalid object ID')
            ids.add(item['id'])
            if not vector(item.get('position')) or type(item.get('rotation')) not in (float, int) or not math.isfinite(item['rotation']) or abs(item['rotation']) > math.tau:
                raise ValueError('Invalid transform')
            if group in ('boxes', 'meshes') and item.get('material_id') is not None and item['material_id'] not in material_ids:
                raise ValueError('Unknown structure material')
            if group in ('boxes', 'meshes') and not vector(item.get('size'), True):
                raise ValueError('Invalid box dimensions')
            if group == 'meshes':
                vertices, triangles = item.get('vertices'), item.get('triangles')
                if not isinstance(vertices, list) or not 4 <= len(vertices) <= 4096 or any(not vector(vertex) for vertex in vertices):
                    raise ValueError('Invalid mesh vertices')
                if len({tuple(vertex) for vertex in vertices}) != len(vertices):
                    raise ValueError('Duplicate mesh vertex')
                if not isinstance(triangles, list) or not 4 <= len(triangles) <= 8192:
                    raise ValueError('Invalid mesh triangles')
                for face in triangles:
                    if not isinstance(face, list) or len(face) != 3 or any(type(i) is not int or i < 0 or i >= len(vertices) for i in face) or len(set(face)) != 3:
                        raise ValueError('Invalid mesh triangle')
                    a, b, c = (vertices[i] for i in face)
                    u = [b[i] - a[i] for i in range(3)]
                    v = [c[i] - a[i] for i in range(3)]
                    cross = (u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0])
                    if sum(x*x for x in cross) < 1e-12:
                        raise ValueError('Degenerate mesh triangle')
                if len({tuple(sorted(face)) for face in triangles}) != len(triangles):
                    raise ValueError('Duplicate mesh triangle')
                for axis in range(3):
                    values = [vertex[axis] for vertex in vertices]
                    half = item['size'][axis] / 2
                    if abs(min(values) + half) > 1e-4 or abs(max(values) - half) > 1e-4:
                        raise ValueError('Mesh bounds do not match size')
            if group == 'seats':
                if not vector(item.get('eye')) or not vector(item.get('target')) or sum((a-b)**2 for a, b in zip(item['eye'], item['target'])) < 1e-8:
                    raise ValueError('Invalid seat camera')
                fov = item.get('vertical_fov_deg')
                if type(fov) not in (int, float) or not math.isfinite(fov) or not 10 <= fov <= 120:
                    raise ValueError('Invalid vertical camera FOV')
    if len({item['id'] for item in packet['boxes'] + meshes}) != len(packet['boxes']) + len(meshes):
        raise ValueError('Duplicate structure ID')
    return packet


def to_blender(position):
    x, y, z = position
    return (x, -z, y)


def build(directory):
    path = directory / 'packet.json'
    if path.stat().st_size > 2 * 1024 * 1024:
        raise ValueError('Packet exceeds 2 MiB')
    packet = validate(json.loads(path.read_text()))
    target = directory / 'venue.glb'
    if target.exists() or (directory / 'builder.json').exists():
        raise ValueError('Output already exists')
    import bpy
    from mathutils import Vector
    created = []
    def pbr(name, color, roughness, metallic):
        material = bpy.data.materials.new(name)
        material.use_nodes = True
        shader = material.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Base Color'].default_value = (*color, 1)
        shader.inputs['Roughness'].default_value = roughness
        shader.inputs['Metallic'].default_value = metallic
        return material
    neutral = pbr('Unverified neutral draft material', (.18, .24, .3), .8, 0)
    palette = {item['id']: pbr('VT_' + item['id'], item['base_color_linear'], item['roughness'], item['metallic'])
               for item in packet.get('materials', [])}
    for index, box in enumerate(packet['boxes']):
        bpy.ops.mesh.primitive_cube_add(size=1, location=to_blender(box['position']))
        obj = bpy.context.object
        obj.name = f'Structure_{index:04d}'
        obj.dimensions = (box['size'][0], box['size'][2], box['size'][1])
        obj.rotation_euler[2] = box['rotation']
        obj['venueTwinStructureId'] = box['id']
        obj['venueTwinStatus'] = 'draft-unverified'
        if box.get('material_id'):
            obj['venueTwinMaterialId'] = box['material_id']
        obj.data.materials.append(palette.get(box.get('material_id'), neutral))
        created.append(obj)
    for index, item in enumerate(packet.get('meshes', [])):
        mesh = bpy.data.meshes.new(f'MeasuredMesh_{index:04d}')
        mesh.from_pydata([to_blender(vertex) for vertex in item['vertices']], [], item['triangles'])
        mesh.update()
        obj = bpy.data.objects.new(f'StructureMesh_{index:04d}', mesh)
        obj.location = to_blender(item['position'])
        obj.rotation_euler[2] = item['rotation']
        obj['venueTwinStructureId'] = item['id']
        obj['venueTwinStatus'] = 'draft-unverified'
        if item.get('material_id'):
            obj['venueTwinMaterialId'] = item['material_id']
        mesh.materials.append(palette.get(item.get('material_id'), neutral))
        bpy.context.scene.collection.objects.link(obj)
        created.append(obj)
    for index, seat in enumerate(packet['seats']):
        anchor = bpy.data.objects.new(f'Seat_{index:04d}', None)
        anchor.location = to_blender(seat['position'])
        anchor.rotation_euler[2] = seat['rotation']
        anchor['venueTwinSeatId'] = seat['id']
        anchor['venueTwinStatus'] = 'draft-unverified'
        bpy.context.scene.collection.objects.link(anchor)
        created.append(anchor)
        camera_data = bpy.data.cameras.new(f'Eye_{index:04d}')
        camera_data.type = 'PERSP'
        # Supplied calibrated FOV when available; otherwise explicitly illustrative.
        camera_data.sensor_fit = 'VERTICAL'
        camera_data.sensor_height = 24
        camera_data.lens = 24 / (2 * math.tan(math.radians(seat['vertical_fov_deg']) / 2))
        camera_data.clip_start = .05
        camera_data.clip_end = 2000
        camera = bpy.data.objects.new(f'Camera_{index:04d}', camera_data)
        camera.location = to_blender(seat['eye'])
        direction = Vector(to_blender(seat['target'])) - camera.location
        camera.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
        camera['venueTwinCameraSeatId'] = seat['id']
        camera['venueTwinStatus'] = 'draft-unverified'
        bpy.context.scene.collection.objects.link(camera)
        created.append(camera)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in created:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = created[0]
    bpy.context.scene.render.resolution_x = 1600
    bpy.context.scene.render.resolution_y = 900
    bpy.ops.export_scene.gltf(filepath=str(target), export_format='GLB', use_selection=True,
                              export_yup=True, export_animations=False, export_cameras=True,
                              export_lights=False, export_extras=True)
    (directory / 'builder.json').write_text(json.dumps({'blender_version': bpy.app.version_string,
        'lens_policy': 'per-seat-explicit-or-illustrative-65deg-vertical', 'draft': True}, sort_keys=True) + '\n')


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:]
    if len(args) != 1:
        raise ValueError('Expected a private local job directory')
    build(Path(args[0]))
