"""Photo-informed National Theatre study. Run this entire file in Blender.

Choose Studio's 'Export detailed theatre JSON'. Creates a NEW scene, a uniquely
named .blend and embedded GLB beside the JSON. No downloads, dependencies or
changes to the existing scene. Geometry is estimated, ornament is interpreted;
paintings and official seat mapping are intentionally not fabricated.

Headless: blender -b --python build_national_theatre.py -- blueprint.json
Add --render to produce two review images. Blender 4.5+.
"""
import json
import math
import sys
import subprocess
import tempfile
from pathlib import Path
from uuid import uuid4

PI = math.pi
MATERIALS = {
    'plaster': ('#d8be91', .85, 0), 'gold': ('#b88b43', .32, .68),
    'gilt_light': ('#e0bd72', .38, .48), 'velvet': ('#761a2c', .92, 0),
    'carpet': ('#641829', 1, 0), 'wood': ('#241819', .42, 0),
    'ceiling': ('#aca992', .9, 0), 'panel': ('#455a58', .88, 0),
    'black': ('#14131a', .95, 0), 'lamp': ('#ffe8b5', .2, .1),
}


def finite(value, low, high):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and low <= value <= high


def validate(data):
    if not isinstance(data, dict) or data.get('format') != 'venuetwin-blender' or data.get('version') != 1 or data.get('axes') != 'three-y-up' or data.get('units') != 'metres':
        raise ValueError('Choose the detailed theatre JSON exported from Studio.')
    detail = data.get('detail', {})
    if not isinstance(detail, dict) or detail.get('profile') != 'nd-photo-study-v1':
        raise ValueError('Use Export detailed theatre JSON, not the basic export.')
    rows = detail.get('rows')
    if not isinstance(rows, list) or not 1 <= len(rows) <= 50:
        raise ValueError('Expected 1–50 rows.')
    arcs = [r for r in rows if isinstance(r, dict) and r.get('arcRadius') is not None]
    if not arcs:
        raise ValueError('The theatre study needs curved upper rows.')
    for r in rows:
        if not isinstance(r, dict) or not finite(r.get('floor'), 0, 30) or not isinstance(r.get('row'), int) or not 0 <= r['row'] < 50:
            raise ValueError('Invalid row height.')
    for r in arcs:
        if not finite(r['arcRadius'], 5, 30) or not finite(r.get('arcDegrees'), 60, 180):
            raise ValueError('Use arc radii 5–30 m and spans 60–180 degrees.')
        if not finite(r.get('rotation', 0), -.001, .001) or not finite(r.get('offsetX', 0), -.001, .001):
            raise ValueError('Detailed study requires centred, unrotated balcony rows.')
        if not finite(r.get('offsetY', 0), -10, 10):
            raise ValueError('Invalid balcony centre.')
    if max(r.get('offsetY', 0) for r in arcs) - min(r.get('offsetY', 0) for r in arcs) > .01:
        raise ValueError('Balcony arcs must share a centre for the detailed shell.')
    if not finite(detail.get('stageWidth'), 5, 25):
        raise ValueError('Invalid stage width.')
    stage = detail.get('stage', {})
    if not isinstance(stage, dict) or any(not finite(stage.get(k, 0), -.001, .001) for k in ('offsetX', 'offsetY', 'rotation')):
        raise ValueError('Keep the stage at its original position for the detailed study.')
    seats = data.get('seats')
    if not isinstance(seats, list) or not 1 <= len(seats) <= 2000:
        raise ValueError('Expected 1–2,000 seats.')
    for s in seats:
        if not isinstance(s, dict) or not isinstance(s.get('label'),str) or not isinstance(s.get('position'), list) or len(s['position']) != 3 or not all(finite(v, -60, 60) for v in s['position']) or not finite(s.get('rotation'), -10, 10):
            raise ValueError('Invalid seat transform.')
    return data


class Geometry:
    """Material-batched meshes; all calculations use VenueTwin's Y-up metres."""
    def __init__(self):
        self.parts = {}

    def mesh(self, group, material, vertices, faces):
        v, f = self.parts.setdefault((group, material), ([], []))
        offset = len(v)
        v.extend(vertices)
        f.extend(tuple(i + offset for i in face) for face in faces)

    def box(self, group, mat, centre, size, angle=0):
        x, y, z = centre
        w, h, d = (s / 2 for s in size)
        c, s = math.cos(angle), math.sin(angle)
        vertices = [(x+a*c+b*s, y+v, z-a*s+b*c) for a, v, b in
                    [(-w,-h,-d),(w,-h,-d),(w,h,-d),(-w,h,-d),(-w,-h,d),(w,-h,d),(w,h,d),(-w,h,d)]]
        self.mesh(group, mat, vertices, [(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)])

    def arc(self, group, mat, radius, depth, y, height, centre_z, start, end, segments=100):
        # Continuous watertight annular strip, not overlapping blocks.
        vertices = []
        for i in range(segments+1):
            a = start+(end-start)*i/segments
            for r, h in [(radius-depth/2,y-height/2),(radius+depth/2,y-height/2),
                         (radius+depth/2,y+height/2),(radius-depth/2,y+height/2)]:
                vertices.append((math.sin(a)*r,h,centre_z+math.cos(a)*r))
        faces = [(3,2,1,0)]
        for i in range(segments):
            k = i*4
            for j in range(4):
                n = (j+1)%4
                faces.append((k+j,k+n,k+4+n,k+4+j))
        k = segments*4
        faces.append((k,k+1,k+2,k+3))
        self.mesh(group, mat, vertices, faces)

    def tube(self, group, mat, points, radius=.025, sides=6):
        vertices = []
        for i, p in enumerate(points):
            a, b = points[max(0,i-1)], points[min(len(points)-1,i+1)]
            t = [b[j]-a[j] for j in range(3)]
            length = math.sqrt(sum(v*v for v in t)) or 1
            t = [v/length for v in t]
            ref = (0,1,0) if abs(t[1]) < .9 else (1,0,0)
            u = (t[1]*ref[2]-t[2]*ref[1],t[2]*ref[0]-t[0]*ref[2],t[0]*ref[1]-t[1]*ref[0])
            n = math.sqrt(sum(v*v for v in u)) or 1
            u = [v/n for v in u]
            v = (t[1]*u[2]-t[2]*u[1],t[2]*u[0]-t[0]*u[2],t[0]*u[1]-t[1]*u[0])
            for j in range(sides):
                angle = j*2*PI/sides
                vertices.append(tuple(p[k]+radius*(u[k]*math.cos(angle)+v[k]*math.sin(angle)) for k in range(3)))
        faces = [tuple(reversed(range(sides)))]
        for i in range(len(points)-1):
            for j in range(sides):
                k = i*sides+j; nxt = i*sides+(j+1)%sides
                faces.append((k,nxt,nxt+sides,k+sides))
        faces.append(tuple((len(points)-1)*sides+j for j in range(sides)))
        self.mesh(group, mat, vertices, faces)

    def ellipsoid(self, group, mat, centre, radii, segments=12, rings=8):
        vertices = []
        for i in range(rings+1):
            t = PI*i/rings
            for j in range(segments):
                a = 2*PI*j/segments
                vertices.append((centre[0]+radii[0]*math.sin(t)*math.cos(a),centre[1]+radii[1]*math.cos(t),centre[2]+radii[2]*math.sin(t)*math.sin(a)))
        faces = []
        for i in range(rings):
            for j in range(segments):
                a=i*segments+j; b=i*segments+(j+1)%segments
                faces.append((a,b,b+segments,a+segments))
        self.mesh(group, mat, vertices, faces)


def radial(radius, angle, y, centre_z):
    return (math.sin(angle)*radius, y, centre_z+math.cos(angle)*radius)


def make_geometry(data):
    data = validate(data)
    g = Geometry()
    detail = data['detail']; rows = detail['rows']
    arcs = [r for r in rows if r.get('arcRadius')]
    cz = arcs[0].get('offsetY', 0)
    outer = max(r['arcRadius'] for r in arcs)+1.15
    top = max(r['floor'] for r in arcs)+3.2
    levels = {}
    for r in arcs:
        levels.setdefault(r.get('levelId', str(r['floor'])), []).append(r)
        span = math.radians(r['arcDegrees'])/2
        g.arc('Decks','carpet',r['arcRadius'],.88,r['floor']-.13,.26,cz,-span,span)
    # Continuous stalls carpet with the original per-row heights.
    for r in rows:
        if r.get('arcRadius'):
            continue
        seats = [s for s in data['seats'] if s['label'].startswith(chr(65+r['row']))]
        if not seats:
            continue
        xs=[s['position'][0] for s in seats]; zs=[s['position'][2] for s in seats]
        g.box('Decks','carpet',((min(xs)+max(xs))/2,r['floor']-.12,(min(zs)+max(zs))/2),(max(xs)-min(xs)+1.5,.24,max(zs)-min(zs)+.84))
    # Rear shell with shallow panelling; hidden in the browser's cutaway overview.
    g.arc('Shell','velvet',outer,.22,top/2,top,cz,-PI/2-.15,PI/2+.15)
    for h in [.2,1.5,top-.7,top-.35]:
        g.arc('Shell','gold',outer-.14,.08,h,.09,cz,-PI/2-.15,PI/2+.15)
    for a in range(-90,91,12):
        angle=math.radians(a)
        g.box('Shell','plaster',radial(outer-.2,angle,top/2,cz),(.12,top,.12),angle)
    for tier, level_rows in enumerate(levels.values()):
        first=min(level_rows,key=lambda r:r['arcRadius'])
        r=first['arcRadius']-.52; y=first['floor']; span=math.radians(first['arcDegrees'])/2
        for j in range(17):
            a=-span+(j+.5)*2*span/17
            g.box('Shell','plaster',radial(outer-.19,a,y+1.7,cz),(1.28,2.3,.12),a)
            g.box('Shell','velvet',radial(outer-.27,a,y+1.7,cz),(1.04,2.04,.05),a)
            for h in [y+.6,y+2.8]:
                g.box('Shell','gold',radial(outer-.31,a,h,cz),(1.3,.08,.08),a)
        g.arc('Balcony fronts','plaster',r,.2,y+.37,.86,cz,-span,span)
        for dy, width, height, mat in [(-.08,.27,.1,'gold'),(.05,.24,.06,'gilt_light'),(.73,.28,.09,'gold'),(.84,.34,.1,'velvet')]:
            g.arc('Balcony mouldings',mat,r-.035,width,y+dy,height,cz,-span,span)
        # Interpreted gilded scrollwork: repeating leaves/rosettes and swags.
        bays=36
        for i in range(bays):
            a=-span+(i+.5)*2*span/bays
            centre=radial(r-.125,a,y+.38,cz)
            g.ellipsoid('Balcony ornament','gold',centre,(.09,.16,.06),8,6)
            for side in [-1,1]:
                points=[]
                for j in range(17):
                    t=j/16
                    ang=a+side*(.018+.026*t)
                    points.append(radial(r-.14,ang,y+.4+.18*math.sin(t*PI*1.6),cz))
                g.tube('Balcony ornament','gilt_light',points,.022)
                for leaf in range(3):
                    t=(leaf+1)/4
                    angle=a+side*(.018+.026*t)
                    p=radial(r-.16,angle,y+.4+.18*math.sin(t*PI*1.6),cz)
                    g.ellipsoid('Balcony ornament','gold',p,(.055,.08,.027),6,4)
            # A fine lower swag makes the frieze read continuously at seat distance.
            pts=[radial(r-.15,a+(t/20-.5)*2*span/bays,y+.27-.1*math.sin(t*PI/20),cz) for t in range(21)]
            g.tube('Balcony ornament','gold',pts,.018)
            if i%3 == 0:
                p=radial(r-.27,a,y-.18,cz)
                g.ellipsoid('Balcony lamps','gold',p,(.18,.05,.18))
                g.ellipsoid('Balcony lamps','lamp',(p[0],p[1]-.05,p[2]),(.095,.085,.095))
        # Side boxes beyond the ends of the interactive rows. No invented ticket IDs.
        box_top = min(y+2.55,top-.5)
        for side in [-1,1]:
            start=side*span; end=side*(PI/2+.13)
            if start>end: start,end=end,start
            inner=r+.15; depth=outer-inner
            g.arc('Side boxes','carpet',inner+depth/2,depth,y-.12,.24,cz,start,end,20)
            g.arc('Side boxes','plaster',inner,.2,y+.4,.9,cz,start,end,20)
            for dy in [0,.78]:
                g.arc('Side boxes','gold',inner-.03,.28,y+dy,.09,cz,start,end,20)
            for j in range(4):
                a=start+(end-start)*j/3
                # Radial partition behind a fluted front pilaster.
                g.box('Side boxes','velvet',radial(inner+depth/2,a,(y+box_top)/2,cz),(.13,box_top-y,depth),a)
                for dr,w in [(0,.19),(.07,.11)]:
                    g.box('Side box pilasters','gold',radial(inner-dr,a,(y+box_top)/2,cz),(w,box_top-y,.15),a)
                for h in [y+.9,box_top-.12]:
                    g.box('Side box pilasters','gilt_light',radial(inner-.06,a,h,cz),(.36,.15,.3),a)
            g.arc('Side boxes','gold',inner,.3,box_top,.16,cz,start,end,20)
        # Tall slender gallery columns at the outer ends, matching the visual reference.
        if tier>=2:
            for side in [-1,1]:
                a=side*(span-.06)
                for dr in [0,.14]:
                    g.tube('Gallery columns','gold',[radial(r+.04+dr,a,y+.85,cz),radial(r+.04+dr,a,y+2.7,cz)],.06,10)
    # Stage and architectural proscenium; painted curtain left as a blank panel.
    w=detail['stageWidth']; portal_h=min(11.2,top-3); z=-3.25
    # Close the front of the hall around the portal, including the upper wall.
    for side in [-1,1]:
        wing=outer-w/2
        g.box('Front wall','plaster',(side*(w/2+wing/2),top/2,z-.65),(wing,top,.3))
        for x in [w/2+1.3,outer-.5]:
            g.box('Front wall','gold',(side*x,top/2,z-.4),(.12,top,.12))
        for y in [1.1,3.4,6.6,9.8,13]:
            g.box('Front wall','gold',(side*(w/2+wing/2),y,z-.4),(wing,.08,.12))
    g.box('Front wall','plaster',(0,(portal_h+top)/2,z-.65),(w,top-portal_h,.3))
    g.box('Stage','wood',(0,-.01,-2.8),(w,.44,3.6))
    g.box('Curtain','velvet',(0,portal_h/2,z-.22),(w-.5,portal_h-.45,.12))
    for i in range(90):
        x=-(w-.55)/2+(w-.55)*i/89
        g.ellipsoid('Curtain folds','velvet',(x,portal_h/2,z-.12),(.065,(portal_h-.55)/2,.075),8,12)
    for side in [-1,1]:
        for offset,width,depth,mat in [(0,.52,.55,'plaster'),(.35,.11,.64,'gold'),(-.32,.12,.67,'gold'),(.55,.24,.35,'plaster')]:
            x=side*(w/2+offset)
            g.box('Proscenium',mat,(x,portal_h/2,z),(width,portal_h,depth))
        for dy in [.25,portal_h-.3]:
            g.box('Proscenium','gold',(side*w/2,dy,z),(.95,.3,.85))
        for j in range(28):
            g.ellipsoid('Portal relief','gilt_light',(side*w/2,.6+j*(portal_h-1.2)/27,z+.31),(.13,.13,.05),8,6)
        # Fluting and paired scrolls on the vertical portal frame.
        for dx in [-.17,0,.17]:
            g.tube('Portal relief','gold',[(side*w/2+dx,.5,z+.29),(side*w/2+dx,portal_h-.5,z+.29)],.02)
        for j in range(14):
            for direction in [-1,1]:
                pts=[]
                for k in range(18):
                    a=k*PI*1.7/17
                    pts.append((side*w/2+direction*.2*math.sin(a),.8+j*.7+.19*math.cos(a),z+.36))
                g.tube('Portal relief','gold',pts,.018)
    for dy,height,mat in [(0,.5,'plaster'),(.4,.14,'gold'),(.6,.65,'panel'),(1.04,.12,'gold')]:
        g.box('Proscenium',mat,(0,portal_h+dy,z),(w+1.8,height,.55))
    # Pediment with layered diagonal cornices.
    apex=portal_h+2.45
    for side in [-1,1]:
        g.tube('Pediment','gold',[(side*(w/2+.9),portal_h+1.15,z+.3),(0,apex,z+.3)],.11,8)
    g.box('Pediment','plaster',(0,portal_h+1.1,z),(w+2,.14,.7))
    # Rounded inner corners and a decorated red pelmet.
    for side in [-1,1]:
        pts=[(side*((w/2-1)+math.cos(t*PI/2/30)*.8),portal_h-1+math.sin(t*PI/2/30)*.8,z+.12) for t in range(31)]
        g.tube('Proscenium','gilt_light',pts,.09,10)
    for j in range(12):
        x=-w/2+.7+j*(w-1.4)/11
        pts=[(x+(t/20-.5)*.7,portal_h-.55-.18*math.sin(t*PI/20),z+.1) for t in range(21)]
        g.tube('Pelmet embroidery','gold',pts,.03)
    # Tympanum relief is a geometric floral interpretation, not copied sculpture.
    for j in range(9):
        x=(j-4)*.75
        g.ellipsoid('Pediment relief','gilt_light',(x,portal_h+1.35+.5*(1-abs(j-4)/4),z+.33),(.2,.22,.05),10,6)
    # Ceiling dome: muted framed fields stand in for unavailable mural artwork.
    centre_z=cz+6; rx=outer+.1; rz=outer*.72
    rings=18; seg=100; vertices=[]; faces=[]
    for i in range(rings+1):
        r=i/rings
        for j in range(seg):
            a=j*2*PI/seg
            vertices.append((rx*r*math.cos(a),top+2.4*(1-r*r),centre_z+rz*r*math.sin(a)))
    for i in range(rings):
        for j in range(seg):
            a=i*seg+j;b=i*seg+(j+1)%seg
            faces.append((a,b,b+seg,a+seg))
    g.mesh('Ceiling','ceiling',vertices,faces)
    for r in [.18,.28,.77,.88,.95,1]:
        pts=[(rx*r*math.cos(a),top+2.4*(1-r*r)-.04,centre_z+rz*r*math.sin(a)) for a in [j*2*PI/120 for j in range(121)]]
        g.tube('Ceiling','gold',pts,.07 if r>.7 else .1,8)
    for j in range(12):
        a=j*2*PI/12
        pts=[(rx*r*math.cos(a),top+2.4*(1-r*r)-.04,centre_z+rz*r*math.sin(a)) for r in [.3+i*.047 for i in range(11)]]
        g.tube('Ceiling','plaster',pts,.085,8)
        # Oval framed ceiling fields without invented figurative paintings.
        a=(j+.5)*2*PI/12; r=.57
        cx=rx*r*math.cos(a); zz=centre_z+rz*r*math.sin(a)
        pts=[]
        for k in range(65):
            t=k*2*PI/64
            x=cx+1.12*math.cos(t)*math.cos(a)-.72*math.sin(t)*math.sin(a)
            zz2=zz+1.12*math.cos(t)*math.sin(a)+.72*math.sin(t)*math.cos(a)
            h=top+2.4*(1-(x/rx)**2-((zz2-centre_z)/rz)**2)-.05
            pts.append((x,h,zz2))
        g.tube('Ceiling','gold',pts,.045,8)
    for j in range(72):
        a=j*2*PI/72
        g.ellipsoid('Ceiling','gold',(rx*.92*math.cos(a),top+.28,centre_z+rz*.92*math.sin(a)),(.09,.055,.09),8,4)
    # Multi-ring chandelier and crystal drops, deliberately simplified for web export.
    cy=top-.1
    g.tube('Chandelier','gold',[(0,top+2.2,centre_z),(0,cy-2,centre_z)],.07,12)
    for radius,dy,count in [(1.75,0,32),(1.25,-.7,24),(.75,-1.4,16)]:
        pts=[(radius*math.cos(a),cy+dy,centre_z+radius*math.sin(a)) for a in [j*2*PI/96 for j in range(97)]]
        g.tube('Chandelier','gold',pts,.055,8)
        for j in range(count):
            a=j*2*PI/count
            p=(radius*math.cos(a),cy+dy,centre_z+radius*math.sin(a))
            g.tube('Chandelier','gold',[(0,cy+.55,centre_z),p],.018,6)
            g.ellipsoid('Chandelier','lamp',(p[0],p[1]-.16,p[2]),(.055,.17,.055),8,6)
    # Detailed seats in .blend only; web uses the exact same exported transforms.
    for seat in data['seats']:
        x,y,z=seat['position']; a=seat['rotation']
        def point(dx,dy,dz):
            return (x+dx*math.cos(a)+dz*math.sin(a),y+dy,z-dx*math.sin(a)+dz*math.cos(a))
        for mat,centre,size in [('wood',point(0,.35,.16),(.5,.68,.1)),('velvet',point(0,.36,.095),(.43,.57,.105)),('velvet',point(0,.16,-.065),(.44,.13,.43))]:
            g.box('Seats',mat,centre,size,a)
        for side in [-1,1]:
            g.box('Seats','wood',point(side*.245,.24,-.025),(.055,.08,.5),a)
            g.box('Seats','wood',point(side*.18,-.045,0),(.045,.39,.06),a)
    return g, {'outer':outer,'top':top,'centre_z':centre_z,'portal_height':portal_h}


def build(filepath, render=False):
    import bpy
    import bmesh
    from mathutils import Vector
    path=Path(filepath).resolve()
    if path.stat().st_size>5*1024*1024:
        raise ValueError('Blueprint exceeds 5 MB.')
    data=json.loads(path.read_text(encoding='utf-8'))
    geometry,meta=make_geometry(data)
    if bpy.context.mode != 'OBJECT':
        raise ValueError('Switch to Object Mode before running.')
    suffix=uuid4().hex[:8]; stem=path.with_name(path.stem+'-detailed-'+suffix)
    scene=bpy.data.scenes.new('National Theatre photo study '+suffix)
    scene['provenance']='Photo-informed estimated geometry. Interpreted ornament; no mural reproductions or official seat mapping.'
    scene.unit_settings.system='METRIC'
    previous=bpy.context.window.scene
    bpy.context.window.scene=scene
    try:
        mats={}
        for name,(color,rough,metal) in MATERIALS.items():
            m=bpy.data.materials.new('ND '+name); m.use_nodes=True
            rgb=[int(color[i:i+2],16)/255 for i in (1,3,5)]
            rgba=tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb)+(1,)
            shader=m.node_tree.nodes.get('Principled BSDF')
            shader.inputs['Base Color'].default_value=rgba
            shader.inputs['Roughness'].default_value=rough
            shader.inputs['Metallic'].default_value=metal
            if name=='lamp':
                shader.inputs['Emission Color'].default_value=rgba
                shader.inputs['Emission Strength'].default_value=2.5
            m.diffuse_color=rgba; mats[name]=m
        root=bpy.data.objects.new('VT_ND_DETAIL_ROOT',None); scene.collection.objects.link(root)
        root['venueTwinDetail']='nd-photo-study-v1'
        root['estimated']=True
        export_objects=[root]
        for (group,mat),(vertices,faces) in geometry.parts.items():
            mesh=bpy.data.meshes.new(group+' '+mat)
            mesh.from_pydata([(x,-z,y) for x,y,z in vertices],[],faces)
            mesh.update()
            bm=bmesh.new(); bm.from_mesh(mesh)
            bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(mesh); bm.free()
            obj=bpy.data.objects.new(group+' '+mat,mesh); scene.collection.objects.link(obj)
            obj.data.materials.append(mats[mat]); obj.parent=root
            if group=='Seats':
                bevel=obj.modifiers.new('Soft upholstery edges','BEVEL'); bevel.width=.025; bevel.segments=3
            obj['venueTwinShell']=group in ('Shell','Ceiling')
            if group!='Seats': export_objects.append(obj)
        # Text is geometry in both Blender and GLB; no external fonts.
        curve=bpy.data.curves.new('Dedication','FONT'); curve.body='NÁROD SOBĚ'; curve.align_x='CENTER'; curve.size=.5; curve.extrude=.006
        text=bpy.data.objects.new('Proscenium dedication',curve); scene.collection.objects.link(text)
        text.location=(0,2.91,meta['portal_height']+.42); text.rotation_euler=(PI/2,0,0); text.data.materials.append(mats['gilt_light']); text.parent=root
        bpy.context.view_layer.objects.active=text; text.select_set(True); bpy.ops.object.convert(target='MESH'); export_objects.append(bpy.context.object)
        # Interior lighting and cameras are stored in the editable scene only.
        def aim(obj,target): obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
        def area(name,pos,target,power,size):
            light=bpy.data.lights.new(name,'AREA'); light.energy=power; light.shape='DISK'; light.size=size; light.color=(1,.83,.62)
            obj=bpy.data.objects.new(name,light); scene.collection.objects.link(obj); obj.location=pos; aim(obj,target)
        area('Warm house light',(0,-meta['centre_z'],meta['top']-2),(0,-5,0),4500,9)
        area('Stage fill',(0,1,7),(0,-10,5),2600,8)
        area('Rear fill',(0,-12,9),(0,0,4),1900,7)
        camera=bpy.data.objects.new('Audience review camera',bpy.data.cameras.new('Audience review camera')); scene.collection.objects.link(camera)
        camera.location=(0,-8.5,2.4); aim(camera,(0,3,6.8)); camera.data.lens=18; scene.camera=camera
        scene.world=bpy.data.worlds.new('Warm theatre world'); scene.world.use_nodes=True
        scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.1,.075,1)
        scene.world.node_tree.nodes['Background'].inputs[1].default_value=.3
        scene.render.engine='CYCLES'; scene.cycles.device='CPU'; scene.cycles.samples=24
        scene.cycles.use_denoising=True
        scene.render.resolution_x=1440; scene.render.resolution_y=1000; scene.render.resolution_percentage=100
        scene.view_settings.view_transform='AgX'
        bpy.ops.object.select_all(action='DESELECT')
        for obj in export_objects: obj.select_set(True)
        bpy.context.view_layer.objects.active=root
        glb=stem.with_suffix('.glb')
        bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False,export_animations=False)
        if glb.stat().st_size>25*1024*1024:
            raise ValueError('GLB exceeds the 25 MB viewer limit. Editable scene has not been saved.')
        # A libraries.write file alone opens with an empty scene in Blender.
        # Finalize in a separate factory-startup process so the deliverable opens
        # normally without copying unrelated objects from the user's session.
        with tempfile.TemporaryDirectory(prefix='venuetwin-detail-') as temp:
            library=Path(temp)/'scene.blend'
            bpy.data.libraries.write(str(library),{scene},fake_user=True,compress=True)
            finalize=Path(temp)/'finalize.py'
            finalize.write_text('''import bpy, sys
source, output = sys.argv[sys.argv.index('--')+1:]
defaults = list(bpy.data.scenes)
with bpy.data.libraries.load(source, link=False) as (available, loaded):
    loaded.scenes = available.scenes
scene = loaded.scenes[0]
bpy.context.window.scene = scene
for old in defaults:
    bpy.data.scenes.remove(old)
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            area.spaces.active.region_3d.view_perspective = 'CAMERA'
bpy.ops.wm.save_as_mainfile(filepath=output, compress=True)
''',encoding='utf-8')
            subprocess.run([bpy.app.binary_path,'--background','--factory-startup','--python-exit-code','1',
                            '--python',str(finalize),'--',str(library),str(stem.with_suffix('.blend'))],
                           check=True,timeout=120,capture_output=True,text=True)
        if render:
            scene.render.filepath=str(stem)+'-audience.png'; bpy.ops.render.render(write_still=True)
            camera.location=(0,2.8,3); aim(camera,(0,-7,8.3)); camera.data.lens=14
            scene.render.filepath=str(stem)+'-reverse.png'; bpy.ops.render.render(write_still=True)
        print('VenueTwin detailed scene:',stem.with_suffix('.blend'))
        print('VenueTwin detailed GLB:',glb)
        return glb
    finally:
        bpy.context.window.scene=previous


def run_picker():
    import bpy
    from bpy_extras.io_utils import ImportHelper
    class VT_OT_detailed_theatre(bpy.types.Operator,ImportHelper):
        bl_idname='venuetwin.detailed_theatre'
        bl_label='Build detailed National Theatre study'
        filename_ext='.json'
        filter_glob: bpy.props.StringProperty(default='*.json',options={'HIDDEN'})
        def execute(self,context):
            try:
                output=build(self.filepath)
                self.report({'INFO'},'Created .blend and GLB: '+str(output))
                return {'FINISHED'}
            except Exception as error:
                self.report({'ERROR'},str(error)); return {'CANCELLED'}
    previous=getattr(bpy.types,'VT_OT_detailed_theatre',None)
    if previous: bpy.utils.unregister_class(previous)
    bpy.utils.register_class(VT_OT_detailed_theatre)
    bpy.ops.venuetwin.detailed_theatre('INVOKE_DEFAULT')


if __name__=='__main__':
    args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    if args: build(args[0],render='--render' in args)
    else: run_picker()
