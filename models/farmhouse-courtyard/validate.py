from pathlib import Path
import json
import struct

import numpy as np

path = Path(__file__).resolve().parent / "farmhouse-courtyard.glb"
raw = path.read_bytes()
magic, version, total = struct.unpack_from("<4sII", raw, 0)
assert magic == b"glTF" and version == 2 and total == len(raw)
json_length, json_type = struct.unpack_from("<II", raw, 12)
assert json_type == 0x4E4F534A
document = json.loads(raw[20:20+json_length])
bin_header = 20+json_length
bin_length, bin_type = struct.unpack_from("<II", raw, bin_header)
assert bin_type == 0x004E4942
binary = raw[bin_header+8:bin_header+8+bin_length]
assert len(binary) == bin_length
assert document["asset"]["version"] == "2.0"
assert len(document["buffers"]) == 1
assert document["buffers"][0]["byteLength"] <= len(binary)
assert "uri" not in document["buffers"][0]
assert not document.get("images")

component_sizes = {5120:1,5121:1,5122:2,5123:2,5125:4,5126:4}
component_counts = {"SCALAR":1,"VEC2":2,"VEC3":3,"VEC4":4,"MAT4":16}
for view in document["bufferViews"]:
    assert view.get("byteOffset",0)+view["byteLength"] <= len(binary)


def accessor(index):
    item = document["accessors"][index]
    view = document["bufferViews"][item["bufferView"]]
    dtype = {5123:"<u2",5125:"<u4",5126:"<f4"}[item["componentType"]]
    columns = component_counts[item["type"]]
    required = item["count"]*columns*component_sizes[item["componentType"]]
    assert item.get("byteOffset",0)+required <= view["byteLength"]
    offset = view.get("byteOffset",0)+item.get("byteOffset",0)
    return np.frombuffer(binary,dtype=dtype,count=item["count"]*columns,offset=offset).reshape(item["count"],columns)


for accessor_index,item in enumerate(document["accessors"]):
    values = accessor(accessor_index)
    assert np.isfinite(values).all()
    if item["type"] == "VEC3" and item["componentType"] == 5126 and "min" not in item:
        lengths = np.linalg.norm(values.astype(float),axis=1)
        assert np.allclose(lengths,1,atol=1e-5)

unique_indices = set()
local_triangles = 0
for mesh in document["meshes"]:
    for primitive in mesh["primitives"]:
        position = document["accessors"][primitive["attributes"]["POSITION"]]
        normal = document["accessors"][primitive["attributes"]["NORMAL"]]
        assert position["count"] == normal["count"]
        index_accessor = primitive["indices"]
        indices = accessor(index_accessor).reshape(-1)
        assert indices.max() < position["count"]
        assert len(indices)%3 == 0
        unique_indices.add(index_accessor)
        local_triangles += len(indices)//3
        material = document["materials"][primitive["material"]]
        factors = material["pbrMetallicRoughness"]["baseColorFactor"]
        assert len(factors) == 4 and all(0 <= value <= 1 for value in factors)

for node in document["nodes"]:
    assert "mesh" in node
    assert len(node.get("translation",[0,0,0])) == 3
    assert len(node.get("scale",[1,1,1])) == 3
    assert all(value > 0 for value in node.get("scale",[1,1,1]))
    if "rotation" in node:
        assert np.isclose(np.linalg.norm(node["rotation"]),1,atol=1e-6)

instance_triangles = sum(
    document["accessors"][document["meshes"][node["mesh"]]["primitives"][0]["indices"]]["count"]//3
    for node in document["nodes"]
)
summary = {
    "valid": True,
    "bytes": len(raw),
    "nodes": len(document["nodes"]),
    "sharedMeshes": len(document["meshes"]),
    "materials": len(document["materials"]),
    "uniqueGeometryTriangles": local_triangles,
    "instancedTriangles": instance_triangles,
    "externalResources": 0,
}
print(json.dumps(summary,ensure_ascii=False,indent=2))
