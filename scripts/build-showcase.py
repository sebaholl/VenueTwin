"""Build an original, offline architectural showcase for the managed viewer.

The same blueprint and geometry function can be opened by the Blender detail
builder. This GLB path needs no Blender installation and never downloads assets.
All dimensions and seats below are authored fiction, not a surveyed venue.
"""
import hashlib
import json
import math
import struct
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'blender'))
from build_national_theatre import MATERIALS, make_geometry

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'venue-data' / 'lantern-opera-house' / 'public-demo'
BLUEPRINT = ROOT / 'venue-data' / 'lantern-opera-house' / 'blender-blueprint.json'
MATERIAL_DIR = BLUEPRINT.parent / 'materials'
TEXTURED = {'plaster': 'painted_plaster_wall', 'velvet': 'velour_velvet', 'carpet': 'velour_velvet', 'wood': 'dark_wood'}
TILE_METRES = {'plaster': 2.0, 'velvet': .75, 'carpet': 1.5, 'wood': 1.5}
STAGE_TARGET = (0, 2.8, -5.5)


def unit(v):
    size = math.sqrt(sum(x*x for x in v))
    return tuple(x/size for x in v) if size > 1e-12 else (0.0, 1.0, 0.0)


def cross(a, b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])


def camera_rotation(eye, target):
    # glTF cameras face local -Z with local +Y as up.
    back = unit(tuple(eye[i]-target[i] for i in range(3)))
    right = unit(cross((0, 1, 0), back))
    up = cross(back, right)
    m = ((right[0], up[0], back[0]), (right[1], up[1], back[1]), (right[2], up[2], back[2]))
    trace = m[0][0]+m[1][1]+m[2][2]
    if trace > 0:
        scale = 2*math.sqrt(trace+1)
        return [(m[2][1]-m[1][2])/scale, (m[0][2]-m[2][0])/scale, (m[1][0]-m[0][1])/scale, scale/4]
    i = max(range(3), key=lambda n:m[n][n]); j=(i+1)%3; k=(i+2)%3
    scale = 2*math.sqrt(1+m[i][i]-m[j][j]-m[k][k])
    q = [0.0]*4; q[i]=scale/4; q[j]=(m[j][i]+m[i][j])/scale; q[k]=(m[k][i]+m[i][k])/scale
    q[3]=(m[k][j]-m[j][k])/scale
    return q


def authored_blueprint():
    rows = []
    seats = []
    public = []
    levels = [('stalls', 'Stalls'), ('circle', 'Grand circle'), ('gallery', 'Gallery')]
    for row in range(9):
        floor = round(.22 + row*.12,4)
        z = .8 + row*.78
        rows.append({'row':row, 'floor':floor})
        for number in range(17):
            x = (number-8)*.62
            p = [round(x,4), round(floor+.08,4), round(z-.014*x*x,4)]
            add_seat(seats,public,'stalls',row,number,p,[-.14*x,1.0,0.0])
    for index,(level,start,floor,radius,span) in enumerate([
        ('circle',9,3.75,10.4,130), ('gallery',11,6.45,12.1,142)
    ]):
        for offset in range(2):
            row = start+offset; height=round(floor+offset*.17,4); r=round(radius+offset*.72,4)
            rows.append({'row':row,'floor':height,'arcRadius':r,'arcDegrees':span,'offsetY':-1.4,'levelId':level,'parapetHeight':.83})
            count = 17+offset*2
            for number in range(count):
                angle = math.radians((number-(count-1)/2)*span/(count+6))
                x = math.sin(angle)*r
                z = -1.4+math.cos(angle)*r
                p = [round(x,4),round(height+.08,4),round(z,4)]
                add_seat(seats,public,level,row,number,p,[0,1,0])
    blueprint = {'format':'venuetwin-blender','version':1,'axes':'three-y-up','units':'metres',
                 'detail':{'profile':'original-showcase-v1','dedication':'LANTERN OPERA HOUSE','stageWidth':11.2,'stage':{},'rows':rows},
                 'seats':seats}
    return blueprint, public, levels


def add_seat(blueprint_seats, public, level, row, number, p, unused):
    del unused
    sid=f'{level}-r{row+1:02d}-s{number+1:02d}'
    target=STAGE_TARGET
    yaw=round(math.atan2(target[0]-p[0],p[2]-target[2]),8)
    eye=[p[0],round(p[1]+.9,4),p[2]]
    blueprint_seats.append({'label':sid,'row':row,'position':p,'rotation':yaw})
    public.append({'id':sid,'label':str(number+1),'row':str(row+1),'level_id':level,'position':p,'eye':eye,'yaw':yaw,'vertical_fov_deg':65})


def glb_for(geometry, seats):
    doc={'asset':{'version':'2.0','generator':'VenueTwin original showcase builder'},'scene':0,'scenes':[{'nodes':[]}],
         'nodes':[],'meshes':[],'materials':[],'accessors':[],'bufferViews':[],'buffers':[],'cameras':[],
         'images':[],'textures':[],'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}]}
    binary=bytearray()
    def float_accessor(points,kind):
        points=[[round(float(value),5) for value in point] for point in points]
        offset=len(binary)
        for p in points: binary.extend(struct.pack('<'+'f'*len(p),*p))
        view=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(binary)-offset,'target':34962})
        accessor=len(doc['accessors']);doc['accessors'].append({'bufferView':view,'componentType':5126,'count':len(points),'type':kind,
            'min':[min(p[i] for p in points) for i in range(len(points[0]))],
            'max':[max(p[i] for p in points) for i in range(len(points[0]))]})
        return accessor
    def image_texture(asset, suffix):
        filename=f'{asset}_{suffix}_1k.jpg'
        image=(MATERIAL_DIR/filename).read_bytes()
        binary.extend(b'\0'*(-len(binary)%4))
        view=len(doc['bufferViews'])
        doc['bufferViews'].append({'buffer':0,'byteOffset':len(binary),'byteLength':len(image)})
        binary.extend(image)
        source=len(doc['images']);doc['images'].append({'name':filename,'bufferView':view,'mimeType':'image/jpeg'})
        index=len(doc['textures']);doc['textures'].append({'source':source,'sampler':0})
        return index
    textures={asset:{suffix:image_texture(asset,suffix) for suffix in ('diff','nor_gl')} for asset in sorted(set(TEXTURED.values()))}
    materials={}
    for name,(hex_color,rough,metal) in MATERIALS.items():
        rgb=[int(hex_color[i:i+2],16)/255 for i in (1,3,5)]
        linear=[round(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4,8) for v in rgb]
        materials[name]=len(doc['materials'])
        asset=TEXTURED.get(name)
        doc['materials'].append({'name':name,'doubleSided':True,'pbrMetallicRoughness':{
            'baseColorFactor':([1,1,1,1] if asset else linear+[1]),
            **({'baseColorTexture':{'index':textures[asset]['diff']}} if asset else {}),
            'metallicFactor':metal,'roughnessFactor':rough},
            **({'normalTexture':{'index':textures[asset]['nor_gl'],'scale':.45}} if asset else {}),
            **({'emissiveFactor':linear} if name=='lamp' else {})})
    for (group,mat),(vertices,faces) in geometry.parts.items():
        if group=='Seats': continue # Interactive instanced chairs are drawn in the viewer.
        positions=[]; normals=[]; uvs=[]
        for face in faces:
            for i in range(1,len(face)-1):
                triangle=[vertices[j] for j in (face[0],face[i],face[i+1])]
                normal=unit(cross(tuple(triangle[1][j]-triangle[0][j] for j in range(3)),
                                  tuple(triangle[2][j]-triangle[0][j] for j in range(3)))) if triangle[0]!=triangle[1] and triangle[0]!=triangle[2] else (0,1,0)
                positions.extend(triangle);normals.extend([normal]*3)
                axis=max(range(3),key=lambda j:round(abs(normal[j]),6))
                for point in triangle:
                    u,v=((point[0],point[2]) if axis==1 else (point[0],point[1]) if axis==2 else (point[2],point[1]))
                    tile=TILE_METRES.get(mat,1)
                    uvs.append((u/tile,v/tile))
        if not positions: continue
        p=float_accessor(positions,'VEC3');n=float_accessor(normals,'VEC3');uv=float_accessor(uvs,'VEC2')
        mesh=len(doc['meshes']);doc['meshes'].append({'name':group+' '+mat,'primitives':[{'attributes':{'POSITION':p,'NORMAL':n,'TEXCOORD_0':uv},'material':materials[mat]}]})
        node=len(doc['nodes']);doc['nodes'].append({'name':group+' '+mat,'mesh':mesh,
            'extras':{'venueTwinShell':group in ('Shell','Ceiling')}})
        doc['scenes'][0]['nodes'].append(node)
    for seat in seats:
        node=len(doc['nodes']);doc['nodes'].append({'name':'Seat '+seat['id'],'translation':seat['position'],
            'extras':{'venueTwinSeatId':seat['id']}});doc['scenes'][0]['nodes'].append(node)
        camera=len(doc['cameras']);doc['cameras'].append({'type':'perspective','perspective':{'yfov':math.radians(65),'znear':.05,'zfar':2000}})
        node=len(doc['nodes']);doc['nodes'].append({'name':'Camera '+seat['id'],'camera':camera,'translation':seat['eye'],
            'rotation':[round(value,8) for value in camera_rotation(seat['eye'],STAGE_TARGET)],
            'extras':{'venueTwinCameraSeatId':seat['id']}})
        doc['scenes'][0]['nodes'].append(node)
    doc['buffers']=[{'byteLength':len(binary)}]
    raw=json.dumps(doc,separators=(',',':'),ensure_ascii=False).encode()
    raw+=b' ' * (-len(raw)%4);binary.extend(b'\0'*(-len(binary)%4))
    chunks=struct.pack('<I4s',len(raw),b'JSON')+raw+struct.pack('<I4s',len(binary),b'BIN\0')+binary
    return struct.pack('<4sII',b'glTF',2,12+len(chunks))+chunks


def main():
    blueprint,seats,levels=authored_blueprint()
    geometry,_=make_geometry(blueprint)
    model=glb_for(geometry,seats)
    if len(model)>25*1024*1024: raise ValueError('Showcase exceeds the viewer model limit.')
    digest=hashlib.sha256(model).hexdigest()
    manifest={'format':'venuetwin-customer','version':2,'venue_id':'lantern-opera-house','revision':1,
      'name':'Lantern Opera House · original showcase','quality':'demonstration',
      'notice':'FICTIONAL SHOWCASE. This venue, its measurements, seats and sightlines are original demonstration data. It is not a replica of an existing building or a certified view.',
      'model':{'file':'venue.glb','sha256':digest},'levels':[{'id':a,'name':b} for a,b in levels],
      'seats':seats,'target':list(STAGE_TARGET)}
    OUTPUT.mkdir(parents=True,exist_ok=True);BLUEPRINT.parent.mkdir(parents=True,exist_ok=True)
    BLUEPRINT.write_text(json.dumps(blueprint,separators=(',',':'))+'\n')
    (OUTPUT/'venue.glb').write_bytes(model)
    (OUTPUT/'venue.json').write_text(json.dumps(manifest,separators=(',',':'))+'\n')
    print(f'Built original showcase: {len(seats)} seats, {len(geometry.parts)-2} architecture batches, {len(model)} GLB bytes.')


if __name__=='__main__': main()
