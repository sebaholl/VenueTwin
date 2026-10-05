"""Run in Blender's Text Editor. Choose a VenueTwin Blender JSON export.

Creates a new collection and an adjacent, uniquely named GLB. Existing objects
and files are not deleted or overwritten. No network access or extra packages.
"""
import json
import math
from pathlib import Path
from uuid import uuid4


def to_blender(position):
    x, y, z = position
    return (x, -z, y)


def validate(data):
    if not isinstance(data, dict) or data.get('format') != 'venuetwin-blender' or data.get('version') != 1:
        raise ValueError('Choose Export > Blender scene JSON from VenueTwin.')
    if data.get('units') != 'metres' or data.get('axes') != 'three-y-up':
        raise ValueError('Unsupported coordinate system.')
    boxes, seats = data.get('boxes'), data.get('seats')
    if not isinstance(boxes, list) or not 1 <= len(boxes) <= 2000 or not isinstance(seats, list) or len(seats) > 2000:
        raise ValueError('Invalid or oversized scene.')
    for obj in boxes + seats:
        if not isinstance(obj, dict):
            raise ValueError('Invalid object.')
        position = obj.get('position')
        if not isinstance(position, list) or len(position) != 3 or not all(isinstance(v, (int, float)) and math.isfinite(v) and abs(v) <= 500 for v in position):
            raise ValueError('Invalid position.')
        angle = obj.get('rotation', 0)
        if not isinstance(angle, (int, float)) or not math.isfinite(angle) or abs(angle) > 100:
            raise ValueError('Invalid rotation.')
    for box in boxes:
        size = box.get('size')
        if not isinstance(size, list) or len(size) != 3 or not all(isinstance(v, (int, float)) and math.isfinite(v) and .001 <= v <= 500 for v in size):
            raise ValueError('Invalid dimensions.')
        color = box.get('color', '')
        if not isinstance(color, str) or len(color) != 7 or color[0] != '#' or any(c not in '0123456789abcdefABCDEF' for c in color[1:]):
            raise ValueError('Invalid material color.')
    return data


def build(filepath):
    import bpy
    path = Path(filepath)
    if path.stat().st_size > 5 * 1024 * 1024:
        raise ValueError('Blueprint exceeds 5 MB.')
    data = validate(json.loads(path.read_text(encoding='utf-8')))
    if bpy.context.mode != 'OBJECT':
        raise ValueError('Switch to Object Mode before running the script.')
    suffix = uuid4().hex[:10]
    collection = bpy.data.collections.new('VenueTwin architecture ' + suffix)
    bpy.context.scene.collection.children.link(collection)
    references = bpy.data.collections.new('VenueTwin seat references ' + suffix)
    bpy.context.scene.collection.children.link(references)
    old_selection = list(bpy.context.selected_objects)
    old_active = bpy.context.view_layer.objects.active
    created = []
    materials = {}
    try:
        for box in data['boxes']:
            bpy.ops.mesh.primitive_cube_add(size=1, location=to_blender(box['position']))
            obj = bpy.context.object
            obj.name = str(box.get('name', 'Structure'))[:100]
            obj.dimensions = (box['size'][0], box['size'][2], box['size'][1])
            obj.rotation_euler[2] = box['rotation']
            for parent in list(obj.users_collection):
                parent.objects.unlink(obj)
            collection.objects.link(obj)
            color = box['color']
            if color not in materials:
                mat = bpy.data.materials.new('VT ' + color)
                mat.use_nodes = True
                srgb = [int(color[i:i+2], 16) / 255 for i in (1, 3, 5)]
                rgba = tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in srgb) + (1,)
                mat.diffuse_color = rgba
                shader = mat.node_tree.nodes.get('Principled BSDF')
                shader.inputs['Base Color'].default_value = rgba
                shader.inputs['Roughness'].default_value = .7
                materials[color] = mat
            obj.data.materials.append(materials[color])
            created.append(obj)
        for seat in data['seats']:
            obj = bpy.data.objects.new(str(seat.get('label', 'Seat'))[:30], None)
            obj.empty_display_type = 'CUBE'
            obj.empty_display_size = .24
            obj.location = to_blender(seat['position'])
            obj.rotation_euler[2] = seat['rotation']
            references.objects.link(obj)
        bpy.ops.object.select_all(action='DESELECT')
        for obj in created:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = created[0]
        output = path.with_name(path.stem + '-' + suffix + '.glb')
        bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', use_selection=True,
                                  export_yup=True, export_animations=False, export_cameras=False,
                                  export_lights=False)
        print('VenueTwin GLB saved:', output)
        return output
    finally:
        bpy.ops.object.select_all(action='DESELECT')
        for obj in old_selection:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = old_active


def run_picker():
    import bpy
    from bpy_extras.io_utils import ImportHelper
    class VT_OT_build(bpy.types.Operator, ImportHelper):
        bl_idname = 'venuetwin.build_blueprint'
        bl_label = 'Build VenueTwin scene'
        filename_ext = '.json'
        filter_glob: bpy.props.StringProperty(default='*.json', options={'HIDDEN'})

        def execute(self, context):
            try:
                output = build(self.filepath)
                self.report({'INFO'}, 'GLB saved: ' + str(output))
                return {'FINISHED'}
            except Exception as error:
                self.report({'ERROR'}, str(error))
                return {'CANCELLED'}
    previous = getattr(bpy.types, 'VT_OT_build', None)
    if previous:
        bpy.utils.unregister_class(previous)
    bpy.utils.register_class(VT_OT_build)
    bpy.ops.venuetwin.build_blueprint('INVOKE_DEFAULT')


if __name__ == '__main__':
    run_picker()
