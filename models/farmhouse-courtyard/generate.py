from __future__ import annotations

import json
import math
import struct
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
GLB_PATH = ROOT / "farmhouse-courtyard.glb"
PREVIEW_PATH = ROOT / "preview.png"


def srgb_channel(value: float) -> float:
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


def color(hex_value: str) -> tuple[float, float, float]:
    value = hex_value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) / 255 for i in (0, 2, 4))


PALETTE = {
    "grass": "#8FA36A", "earth": "#B89D76", "courtyard": "#CDBB98",
    "soil": "#725239", "plaster": "#E7DCC2", "plasterShade": "#D4C6A9",
    "stone": "#96978C", "stoneLight": "#B9B6A7", "stoneDark": "#6F756F",
    "wood": "#795238", "woodDark": "#4D382B", "woodLight": "#A77950",
    "roof": "#A95540", "roofAlt": "#C17355", "roofDark": "#6E5048",
    "glass": "#86A9AE", "leaf": "#587B45", "leafLight": "#7C9953",
    "leafDark": "#3F643B", "orange": "#D98B3E", "red": "#B74737",
    "gold": "#C5A353", "water": "#4F7072", "hay": "#D0B169",
    "white": "#EEE8DA", "black": "#303635", "blue": "#718C98",
}


class Geometry:
    def __init__(self, positions, normals, indices):
        self.positions = positions
        self.normals = normals
        self.indices = indices


def flat_geometry(faces) -> Geometry:
    positions, normals, indices = [], [], []
    for face in faces:
        a, b, c = (np.array(face[i], dtype=float) for i in range(3))
        normal = np.cross(b - a, c - a)
        normal /= np.linalg.norm(normal)
        start = len(positions)
        positions.extend(face)
        normals.extend([normal.tolist()] * len(face))
        for i in range(1, len(face) - 1):
            indices.extend([start, start + i, start + i + 1])
    return Geometry(positions, normals, indices)


def box() -> Geometry:
    faces = [
        [(-.5,-.5,.5),(.5,-.5,.5),(.5,.5,.5),(-.5,.5,.5)],
        [(.5,-.5,-.5),(-.5,-.5,-.5),(-.5,.5,-.5),(.5,.5,-.5)],
        [(.5,-.5,.5),(.5,-.5,-.5),(.5,.5,-.5),(.5,.5,.5)],
        [(-.5,-.5,-.5),(-.5,-.5,.5),(-.5,.5,.5),(-.5,.5,-.5)],
        [(-.5,.5,.5),(.5,.5,.5),(.5,.5,-.5),(-.5,.5,-.5)],
        [(-.5,-.5,-.5),(.5,-.5,-.5),(.5,-.5,.5),(-.5,-.5,.5)],
    ]
    return flat_geometry(faces)


def roof() -> Geometry:
    lb, lf = (-.5,-.5,-.5), (-.5,-.5,.5)
    rb, rf = (.5,-.5,-.5), (.5,-.5,.5)
    rb_peak, rf_peak = (0,.5,-.5), (0,.5,.5)
    return flat_geometry([
        [lb, lf, rf_peak, rb_peak], [rf, rb, rb_peak, rf_peak],
        [lb, rb, rf, lf], [lf, rf, rf_peak], [rb, lb, rb_peak],
    ])


def cylinder(segments=16) -> Geometry:
    positions, normals, indices = [], [], []
    for i in range(segments):
        angle = math.tau * i / segments
        x, z = .5 * math.cos(angle), .5 * math.sin(angle)
        normal = [math.cos(angle), 0, math.sin(angle)]
        positions.extend([[x,-.5,z],[x,.5,z]])
        normals.extend([normal, normal])
    for i in range(segments):
        j = (i + 1) % segments
        b0, t0, b1, t1 = 2*i, 2*i+1, 2*j, 2*j+1
        indices.extend([b0,t1,b1, b0,t0,t1])
    for top in (False, True):
        y, ny = (.5, 1) if top else (-.5, -1)
        center = len(positions)
        positions.append([0,y,0]); normals.append([0,ny,0])
        ring = []
        for i in range(segments):
            angle = math.tau * i / segments
            ring.append(len(positions))
            positions.append([.5*math.cos(angle),y,.5*math.sin(angle)])
            normals.append([0,ny,0])
        for i in range(segments):
            j = (i + 1) % segments
            if top:
                indices.extend([center, ring[j], ring[i]])
            else:
                indices.extend([center, ring[i], ring[j]])
    return Geometry(positions, normals, indices)


def cone(segments=12) -> Geometry:
    positions, normals, indices = [], [], []
    faces = []
    for i in range(segments):
        a, b = math.tau*i/segments, math.tau*(i+1)/segments
        p0 = [.5*math.cos(a),-.5,.5*math.sin(a)]
        p1 = [.5*math.cos(b),-.5,.5*math.sin(b)]
        faces.append([p0,[0,.5,0],p1])
    cone_part = flat_geometry(faces)
    positions.extend(cone_part.positions); normals.extend(cone_part.normals); indices.extend(cone_part.indices)
    center = len(positions)
    positions.append([0,-.5,0]); normals.append([0,-1,0])
    ring = []
    for i in range(segments):
        a = math.tau*i/segments
        ring.append(len(positions))
        positions.append([.5*math.cos(a),-.5,.5*math.sin(a)])
        normals.append([0,-1,0])
    for i in range(segments):
        indices.extend([center,ring[i],ring[(i+1)%segments]])
    return Geometry(positions, normals, indices)


def sphere(longitudes=12, latitudes=8) -> Geometry:
    positions = [[0,.5,0]]
    for j in range(1, latitudes):
        phi = math.pi*j/latitudes
        for i in range(longitudes):
            theta = math.tau*i/longitudes
            positions.append([.5*math.sin(phi)*math.cos(theta), .5*math.cos(phi), .5*math.sin(phi)*math.sin(theta)])
    bottom = len(positions)
    positions.append([0,-.5,0])
    normals = [[p[0]*2,p[1]*2,p[2]*2] for p in positions]
    triangles = []
    for i in range(longitudes):
        triangles.append([0,1+i,1+(i+1)%longitudes])
    for j in range(latitudes-2):
        row, next_row = 1+j*longitudes, 1+(j+1)*longitudes
        for i in range(longitudes):
            k = (i+1)%longitudes
            triangles.extend([[row+i,next_row+i,next_row+k],[row+i,next_row+k,row+k]])
    last = 1+(latitudes-2)*longitudes
    for i in range(longitudes):
        triangles.append([last+i,bottom,last+(i+1)%longitudes])
    indices = []
    for tri in triangles:
        a,b,c = (np.array(positions[tri[k]]) for k in range(3))
        if np.dot(np.cross(b-a,c-a), (a+b+c)/3) < 0:
            tri[1],tri[2] = tri[2],tri[1]
        indices.extend(tri)
    return Geometry(positions, normals, indices)


def q_axis(axis, degrees):
    angle = math.radians(degrees) / 2
    s = math.sin(angle)
    if axis == "x": return np.array([s,0,0,math.cos(angle)])
    if axis == "y": return np.array([0,s,0,math.cos(angle)])
    return np.array([0,0,s,math.cos(angle)])


def q_mul(a, b):
    x1,y1,z1,w1 = a; x2,y2,z2,w2 = b
    return np.array([
        w1*x2+x1*w2+y1*z2-z1*y2,
        w1*y2-x1*z2+y1*w2+z1*x2,
        w1*z2+x1*y2-y1*x2+z1*w2,
        w1*w2-x1*x2-y1*y2-z1*z2,
    ])


def quat(rx=0, ry=0, rz=0):
    return q_mul(q_mul(q_axis("y",ry),q_axis("x",rx)),q_axis("z",rz))


def quat_matrix(q):
    x,y,z,w = q
    return np.array([
        [1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],
        [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],
        [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)],
    ])


class Model:
    def __init__(self):
        self.shapes = {"box":box(),"roof":roof(),"cylinder":cylinder(),"cone":cone(),"sphere":sphere()}
        self.materials = []
        self.material_ids = {}
        self.nodes = []
        self.binary = bytearray()
        self.views = []
        self.accessors = []
        self.geometry_ids = {}
        self.meshes = []
        self.mesh_ids = {}
        for name, hex_value in PALETTE.items():
            rgb = color(hex_value)
            self.material_ids[name] = len(self.materials)
            self.materials.append({
                "name": name,
                "pbrMetallicRoughness": {
                    "baseColorFactor": [*[srgb_channel(c) for c in rgb],1],
                    "metallicFactor": 0,
                    "roughnessFactor": .88 if name not in ("glass","water") else .32,
                },
            })

    def add_data(self, data, target):
        while len(self.binary) % 4: self.binary.append(0)
        offset = len(self.binary)
        self.binary.extend(data)
        view = {"buffer":0,"byteOffset":offset,"byteLength":len(data),"target":target}
        self.views.append(view)
        return len(self.views)-1

    def geometry(self, shape):
        if shape in self.geometry_ids: return self.geometry_ids[shape]
        geo = self.shapes[shape]
        positions = np.asarray(geo.positions,dtype="<f4")
        normals = np.asarray(geo.normals,dtype="<f4")
        indices = np.asarray(geo.indices,dtype="<u2")
        p = self.add_data(positions.tobytes(),34962)
        n = self.add_data(normals.tobytes(),34962)
        i = self.add_data(indices.tobytes(),34963)
        base = len(self.accessors)
        self.accessors.extend([
            {"bufferView":p,"componentType":5126,"count":len(positions),"type":"VEC3","min":positions.min(axis=0).tolist(),"max":positions.max(axis=0).tolist()},
            {"bufferView":n,"componentType":5126,"count":len(normals),"type":"VEC3"},
            {"bufferView":i,"componentType":5123,"count":len(indices),"type":"SCALAR"},
        ])
        self.geometry_ids[shape] = (base,base+1,base+2)
        return self.geometry_ids[shape]

    def place(self, shape, material, name, pos, scale, rotation=(0,0,0)):
        key = (shape,material)
        if key not in self.mesh_ids:
            p,n,i = self.geometry(shape)
            self.mesh_ids[key] = len(self.meshes)
            self.meshes.append({"name":f"{shape}-{material}","primitives":[{"attributes":{"POSITION":p,"NORMAL":n},"indices":i,"material":self.material_ids[material]}]})
        q = quat(*rotation)
        node = {"name":name,"mesh":self.mesh_ids[key],"translation":list(map(float,pos)),"scale":list(map(float,scale))}
        if any(rotation): node["rotation"] = q.tolist()
        self.nodes.append(node)

    def save(self):
        for view in self.views:
            if len(self.binary) < view["byteOffset"]+view["byteLength"]:
                raise RuntimeError("Invalid buffer view")
        document = {
            "asset":{"version":"2.0","generator":"DeepSeek Harness procedural farm courtyard","copyright":"Created for the user with DeepSeek Harness"},
            "scene":0,
            "scenes":[{"name":"农家小院 · Farm courtyard","nodes":list(range(len(self.nodes)))}],
            "nodes":self.nodes,"meshes":self.meshes,"materials":self.materials,
            "bufferViews":self.views,"accessors":self.accessors,"buffers":[{"byteLength":len(self.binary)}],
            "extras":{"title":"农家小院","style":"Warm low-poly rural courtyard","units":"meters"},
        }
        raw_json = json.dumps(document,ensure_ascii=False,separators=(",",":")).encode("utf-8")
        raw_json += b" "*((-len(raw_json))%4)
        raw_bin = bytes(self.binary)+b"\0"*((-len(self.binary))%4)
        total = 12+8+len(raw_json)+8+len(raw_bin)
        with GLB_PATH.open("wb") as handle:
            handle.write(struct.pack("<4sII",b"glTF",2,total))
            handle.write(struct.pack("<II",len(raw_json),0x4E4F534A)); handle.write(raw_json)
            handle.write(struct.pack("<II",len(raw_bin),0x004E4942)); handle.write(raw_bin)
        return document


m = Model()

def put(shape, material, name, pos, scale, rotation=(0,0,0)):
    m.place(shape,material,name,pos,scale,rotation)


def roof_assembly(name, center, width, depth, height, material="roof", rib_material="roofAlt", ribs=True):
    x,y,z = center
    put("roof",material,name+" roof",center,[depth,height,width],(0,90,0))
    put("cylinder",rib_material,name+" ridge",[x,y+height/2+.05,z],[.18,width+.12,.18],(0,0,-90))
    base = y-height/2
    for side in (-1,1):
        put("box","woodDark",name+" eave",[x,base-.02,z+side*depth/2],[width,.13,.13])
    if ribs:
        count = max(5,int(width/.46))
        slope = math.hypot(depth/2,height)
        angle = math.degrees(math.atan2(height,depth/2))
        for i in range(count+1):
            xx = x-width/2+.18+(width-.36)*i/count
            for side in (-1,1):
                put("box",rib_material,name+" tile rib",[xx,base+height/2+.035,z+side*depth/4],[.055,.045,slope],(side*angle,0,0))


# Earth plinth, lawn and packed-earth courtyard.
put("box","earth","Earth display base",[0,-.34,.8],[18,.6,14])
put("box","grass","Grass border",[0,-.015,.8],[17.8,.12,13.8])
put("box","courtyard","Courtyard surface",[0,.055,.65],[15.7,.08,10.65])

# Main farmhouse.
put("box","stone","Main house foundation",[0,.23,-3.55],[7.45,.46,4.05])
put("box","plaster","Main house walls",[0,1.78,-3.55],[7,2.75,3.8])
put("box","woodDark","Main facade sill",[0,.55,-1.625],[7.05,.13,.13])
roof_assembly("Main house",[0,3.75,-3.55],8.05,4.65,1.6)

# Front door and framing.
put("box","woodDark","Front door shadow",[0,1.43,-1.635],[1.36,2.28,.09])
put("box","wood","Front door",[0,1.42,-1.575],[1.12,2.12,.09])
for x in (-.66,.66): put("box","woodDark","Door jamb",[x,1.46,-1.52],[.12,2.4,.14])
put("box","woodDark","Door lintel",[0,2.65,-1.52],[1.45,.14,.14])
for y in (.8,1.45,2.1): put("box","woodLight","Door plank brace",[0,y,-1.515],[1.05,.07,.06])
put("sphere","gold","Door handle",[.35,1.4,-1.43],[.11,.11,.11])
put("box","stoneLight","Doorstep lower",[0,.13,-.92],[1.95,.24,.95])
put("box","stone","Doorstep upper",[0,.29,-1.25],[1.55,.18,.62])

# Windows with wooden frames and muted blue glass.
for x in (-2.25,2.25):
    put("box","woodDark","Window outer frame",[x,1.85,-1.625],[1.5,1.35,.12])
    put("box","glass","Window glass",[x,1.85,-1.55],[1.22,1.08,.06])
    for dx in (-.67,.67): put("box","wood","Window vertical trim",[x+dx,1.85,-1.48],[.1,1.3,.1])
    for yy in (1.23,2.47): put("box","wood","Window horizontal trim",[x,yy,-1.48],[1.42,.1,.1])
    put("box","woodLight","Window mullion",[x,1.85,-1.43],[.07,1.12,.07])
    put("box","woodLight","Window crossbar",[x,1.85,-1.43],[1.22,.07,.07])
    put("box","stoneLight","Window ledge",[x,1.15,-1.43],[1.65,.12,.28])

# Side shed and stacked firewood.
put("box","stone","Shed foundation",[-5.75,.17,-3.25],[3.05,.34,3.35])
put("box","plasterShade","Side shed",[-5.75,1.25,-3.25],[2.8,2.25,3.1])
roof_assembly("Side shed",[-5.75,2.78,-3.25],3.35,3.65,1.02,"roofDark","stone",False)
put("box","woodDark","Shed door",[-5.75,1.12,-1.665],[1.2,1.85,.09])
put("box","wood","Shed door inset",[-5.75,1.12,-1.61],[.98,1.65,.05])
for i in range(10):
    row, col = divmod(i,5)
    put("cylinder","woodLight","Stacked firewood",[-7.0+col*.25,.32+row*.25,-1.1],[.22,.85,.22],(90,0,0))
put("box","woodDark","Firewood rack",[-6.5,.15,-1.1],[1.65,.12,.75])

# Courtyard walls and caps.
for x in (-7.85,7.85):
    put("box","plasterShade","Side courtyard wall",[x,.72,.45],[.28,1.38,10.3])
    put("box","roofDark","Side wall coping",[x,1.45,.45],[.4,.14,10.42])
for x in (-4.78,4.78):
    put("box","plasterShade","Front courtyard wall",[x,.72,5.62],[6.15,1.38,.28])
    put("box","roofDark","Front wall coping",[x,1.45,5.62],[6.25,.14,.4])
for x in (-1.67,1.67):
    put("box","stone","Gate pier",[x,1.18,5.6],[.48,2.35,.52])
    put("box","stoneLight","Gate pier cap",[x,2.37,5.6],[.6,.16,.64])

# Partly opened wooden gate leaves.
for side in (-1,1):
    angle = -side*12
    x,z = side*.76,5.55-side*.08
    put("box","wood","Gate leaf",[x,1.12,z],[1.42,1.88,.13],(0,angle,0))
    for y in (.52,1.12,1.72): put("box","woodLight","Gate brace",[x,y,z-.075],[1.34,.09,.07],(0,angle,0))
    put("sphere","gold","Gate handle",[side*.18,1.18,5.39],[.1,.1,.1])
roof_assembly("Entrance gate",[0,2.82,5.6],4.25,1.45,.68,"roof","roofAlt",True)

# Lanterns at the gate.
for x in (-1.66,1.66):
    put("cylinder","gold","Lantern top",[x,2.12,5.19],[.28,.09,.28])
    put("sphere","red","Red lantern",[x,1.85,5.19],[.46,.58,.46])
    put("cylinder","gold","Lantern tassel",[x,1.48,5.19],[.055,.24,.055])

# Stone path through the courtyard and outside the gate.
path = [(0,6.95),(.15,6.15),(-.12,5.0),(.18,4.0),(-.15,3.0),(.16,2.0),(-.12,1.0),(.12,0.0),(0,-.85)]
for i,(x,z) in enumerate(path):
    put("cylinder","stoneLight" if i%2 else "stone","Stepping stone",[x,.12,z],[1.12,.12,.78],(0,(-12 if i%2 else 9),0))

# Circular stone well, timber windlass and tiled canopy.
well_x,well_z = -3.45,.75
put("cylinder","water","Well water",[well_x,.48,well_z],[1.25,.08,1.25])
for i in range(12):
    angle = math.tau*i/12
    x,z = well_x+.72*math.cos(angle),well_z+.72*math.sin(angle)
    put("box","stone" if i%2 else "stoneLight","Well ring stone",[x,.43,z],[.4,.7,.3],(0,-math.degrees(angle)-90,0))
for x in (well_x-.92,well_x+.92): put("box","wood","Well upright",[x,1.45,well_z],[.16,2.2,.16])
put("box","woodDark","Well crossbeam",[well_x,2.48,well_z],[2.15,.16,.18])
put("cylinder","woodLight","Well windlass",[well_x,1.88,well_z],[.24,1.85,.24],(0,0,-90))
put("cylinder","woodDark","Well rope",[well_x,1.35,well_z],[.035,.95,.035])
roof_assembly("Well canopy",[well_x,2.85,well_z],2.55,1.65,.66,"roofDark","stone",False)
put("cylinder","wood","Bucket",[well_x+1.15,.3,well_z+.55],[.46,.55,.46])
put("cylinder","water","Bucket dark interior",[well_x+1.15,.585,well_z+.55],[.36,.025,.36])

# Fruit tree with a low-poly canopy and oranges.
tree_x,tree_z = -5.45,2.55
put("cylinder","woodDark","Fruit tree trunk",[tree_x,1.3,tree_z],[.48,2.6,.48])
for dx,dz,rx,rz in ((-.45,0,0,-48),(.4,.15,0,48),(0,-.4,48,0)):
    put("cylinder","wood","Tree branch",[tree_x+dx*.45,2.25,tree_z+dz*.45],[.2,1.25,.2],(rx,0,rz))
canopies = [(-.65,0,3.2,2.15,"leaf"),(.65,.1,3.3,2.0,"leafLight"),(0,-.55,3.65,2.15,"leaf"),(0,.45,3.8,2.05,"leafDark"),(-.25,.1,4.25,1.7,"leafLight")]
for dx,dz,y,size,mat in canopies: put("sphere",mat,"Fruit tree canopy",[tree_x+dx,y,tree_z+dz],[size,size*.85,size])
for dx,dy,dz in ((-1,3.4,.3),(.9,3.5,.4),(.2,4.4,.65),(-.4,3.1,1.1),(.7,4.0,-.4),(-.8,4.1,-.2),(.2,3.5,-1.0)):
    put("sphere","orange","Orange",[tree_x+dx,dy,tree_z+dz],[.2,.2,.2])

# Two ordered vegetable plots with timber borders.
for plot_index,z in enumerate((.35,2.75)):
    x = 4.7
    put("box","soil","Vegetable bed",[x,.14,z],[3.65,.2,1.65])
    for xx in (x-1.88,x+1.88): put("box","wood","Bed side border",[xx,.23,z],[.12,.28,1.85])
    for zz in (z-.88,z+.88): put("box","woodLight","Bed end border",[x,.23,zz],[3.85,.28,.12])
    for row in (-1,1):
        for col in range(4):
            xx = x-1.25+col*.84
            zz = z+row*.36
            mat = "leafLight" if (col+row+plot_index)%2 else "leaf"
            put("sphere",mat,"Cabbage heart",[xx,.4,zz],[.46,.38,.46])
            put("sphere","leafDark","Cabbage outer leaf",[xx-.12,.32,zz+.08],[.42,.24,.42])

# A small scarecrow beside the vegetables.
put("cylinder","wood","Scarecrow stake",[6.85,.95,1.55],[.09,1.9,.09])
put("cylinder","woodLight","Scarecrow arms",[6.85,1.4,1.55],[.08,1.35,.08],(0,0,-90))
put("sphere","hay","Scarecrow head",[6.85,1.9,1.55],[.38,.42,.38])
put("cone","hay","Scarecrow hat",[6.85,2.2,1.55],[.65,.35,.65])
put("box","blue","Scarecrow coat",[6.85,1.32,1.55],[.55,.68,.2])

# Clay jars, bench and barrels near the house.
for x,z,size in ((-2.2,-1.2,.65),(-2.75,-1.35,.48),(2.95,-1.25,.55)):
    put("cylinder","roof","Clay storage jar",[x,size*.52,z],[size,size,size])
    put("cylinder","woodDark","Jar mouth",[x,size+.025,z],[size*.55,.05,size*.55])
put("box","woodLight","Garden bench seat",[-5.3,.65,-.05],[1.9,.14,.55])
for x in (-6.0,-4.6): put("box","woodDark","Bench leg",[x,.34,-.05],[.14,.62,.42])
for z in (-.4,-1.0):
    put("cylinder","wood","Oak barrel",[-7.0,.48,z],[.72,.9,.72])
    for y in (.18,.78): put("cylinder","woodDark","Barrel hoop",[-7.0,y,z],[.75,.07,.75])

# Hay bales and a tiny pair of chickens add rural life without clutter.
for x,z,angle in ((5.9,-4.9,8),(6.7,-4.65,-12)):
    put("cylinder","hay","Hay bale",[x,.48,z],[.9,.8,.9],(90,angle,0))
for x,z,angle in ((1.55,2.25,-20),(2.05,3.15,35)):
    put("sphere","white","Chicken body",[x,.34,z],[.46,.36,.58],(0,angle,0))
    put("sphere","white","Chicken head",[x,.58,z-.22],[.25,.25,.25])
    put("cone","orange","Chicken beak",[x,.57,z-.39],[.14,.2,.14],(90,0,0))
    put("sphere","red","Chicken comb",[x,.73,z-.2],[.1,.13,.1])

# Low timber fence at the right edge of the garden.
for z in (-.7,.7,2.1,3.5): put("box","wood","Garden fence post",[7.15,.58,z],[.12,1.1,.12])
for z in (-.0,2.8):
    for y in (.42,.85): put("box","woodLight","Garden fence rail",[7.15,y,z],[.1,.1,1.45])

model_document = m.save()


# Software-rendered inspection preview. This is only a preview; the GLB remains the deliverable.
def render_preview(document):
    triangles = []
    material_colors = [color(PALETTE[mat["name"]]) for mat in document["materials"]]
    for node in document["nodes"]:
        mesh = document["meshes"][node["mesh"]]
        primitive = mesh["primitives"][0]
        shape = next(key for key,value in m.mesh_ids.items() if value == node["mesh"])
        geo = m.shapes[shape[0]]
        transform = np.eye(4)
        rotation = quat_matrix(np.array(node.get("rotation",[0,0,0,1])))
        transform[:3,:3] = rotation @ np.diag(node.get("scale",[1,1,1]))
        transform[:3,3] = node.get("translation",[0,0,0])
        points = np.asarray(geo.positions)
        homogeneous = np.column_stack([points,np.ones(len(points))])
        world = (transform @ homogeneous.T).T[:,:3]
        rgb = material_colors[primitive["material"]]
        for tri in np.asarray(geo.indices).reshape(-1,3):
            p = world[tri]
            normal = np.cross(p[1]-p[0],p[2]-p[0])
            length = np.linalg.norm(normal)
            if length < 1e-8: continue
            triangles.append((p,normal/length,rgb))

    camera = np.array([16.,14.,20.]); camera /= np.linalg.norm(camera)
    right = np.cross(np.array([0.,1.,0.]),camera); right /= np.linalg.norm(right)
    up = np.cross(camera,right)
    light = np.array([-.45,.85,.5]); light /= np.linalg.norm(light)
    all_points = np.vstack([entry[0] for entry in triangles])
    px = all_points @ right; py = all_points @ up
    width,height,supersample = 1400,1000,2
    w,h = width*supersample,height*supersample
    margin = 75*supersample
    scale = min((w-2*margin)/np.ptp(px),(h-2*margin)/np.ptp(py))
    center_x,center_y = (px.min()+px.max())/2,(py.min()+py.max())/2

    image = Image.new("RGB",(w,h))
    draw = ImageDraw.Draw(image)
    top,bottom = np.array([244,241,232]),np.array([218,229,218])
    for yy in range(h):
        rgb = tuple(np.round(top+(bottom-top)*yy/(h-1)).astype(int))
        draw.line([(0,yy),(w,yy)],fill=rgb)
    triangles.sort(key=lambda entry: float(np.mean(entry[0] @ camera)))
    for points,normal,rgb in triangles:
        projected_x = (points@right-center_x)*scale+w/2
        projected_y = h/2-(points@up-center_y)*scale
        polygon = list(zip(projected_x.tolist(),projected_y.tolist()))
        depth_shade = .58+.42*max(0,float(normal@light))
        # A small ambient floor keeps shaded timber and roof detail readable.
        shaded = tuple(int(min(255,max(0,c*255*depth_shade+10))) for c in rgb)
        draw.polygon(polygon,fill=shaded)
    image = image.resize((width,height),Image.Resampling.LANCZOS)
    image.save(PREVIEW_PATH,optimize=True)


render_preview(model_document)
print(json.dumps({
    "glb":str(GLB_PATH),"preview":str(PREVIEW_PATH),"nodes":len(m.nodes),
    "meshes":len(m.meshes),"materials":len(m.materials),"bytes":GLB_PATH.stat().st_size,
},ensure_ascii=False,indent=2))
