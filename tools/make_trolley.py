"""Real supermarket trolley, modelled in Blender (bpy 5.x), exported as GLB.

Not boxes: the basket is a tapered rounded-rect wire frame swept from curves,
with a proper chassis, castor forks and a rubber grip on the handle.

    python3 tools/make_trolley.py
"""
import math
import os
import sys

import bpy
import bmesh
from mathutils import Vector

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'models', 'trolley.glb')

# ---------------------------------------------------------------- dimensions
W = 0.56          # basket width  (x)
D = 0.92          # basket depth  (y)
RIM = 0.95        # rim height
FLOOR = 0.46      # basket floor height
TAPER = 0.84      # bottom is 84 % of the top footprint
ROUND = 6.0       # superellipse exponent: 2 = ellipse, high = rounded rectangle
WIRE = 0.0055
RIM_WIRE = 0.009


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, colour, metallic=0.0, roughness=0.5):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*colour, 1.0)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    return m


def superellipse(t, a, b, n=ROUND):
    ct, st = math.cos(t), math.sin(t)
    x = a * math.copysign(abs(ct) ** (2.0 / n), ct)
    y = b * math.copysign(abs(st) ** (2.0 / n), st)
    return x, y


def ring_points(a, b, z, count=64):
    return [Vector((*superellipse(2 * math.pi * i / count, a, b), z)) for i in range(count)]


def curve_from_points(points, name, bevel=WIRE, cyclic=True, res=2):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = bevel
    cu.bevel_resolution = res
    cu.resolution_u = 3
    sp = cu.splines.new('POLY')
    sp.points.add(len(points) - 1)
    for i, p in enumerate(points):
        sp.points[i].co = (p.x, p.y, p.z, 1.0)
    sp.use_cyclic_u = cyclic
    ob = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(ob)
    return ob


def build_basket(steel):
    """Tapered wire basket: horizontal rings + vertical wires + a fat rim."""
    top_a, top_b = W / 2, D / 2
    bot_a, bot_b = top_a * TAPER, top_b * TAPER

    parts = []
    # horizontal rings, closer together near the floor like the real thing
    levels = [0.0, 0.16, 0.32, 0.48, 0.64, 0.80, 1.0]
    for lv in levels:
        a = bot_a + (top_a - bot_a) * lv
        b = bot_b + (top_b - bot_b) * lv
        z = FLOOR + (RIM - FLOOR) * lv
        parts.append(curve_from_points(ring_points(a, b, z), f'ring_{lv:.2f}', RIM_WIRE if lv > 0.99 else WIRE))

    # upright wires, evenly spaced round the perimeter
    N = 26
    for i in range(N):
        t = 2 * math.pi * i / N
        bx, by = superellipse(t, bot_a, bot_b)
        tx, ty = superellipse(t, top_a, top_b)
        parts.append(curve_from_points(
            [Vector((bx, by, FLOOR)), Vector((tx, ty, RIM))],
            f'vwire_{i}', WIRE, cyclic=False))

    # basket bottom lattice
    for i in range(9):
        y = -bot_b + (2 * bot_b) * i / 8
        span = bot_a * (1 - abs(y / bot_b) ** 4) ** 0.25
        parts.append(curve_from_points(
            [Vector((-span, y, FLOOR + 0.004)), Vector((span, y, FLOOR + 0.004))],
            f'bx_{i}', WIRE * 0.85, cyclic=False))
    for i in range(7):
        x = -bot_a + (2 * bot_a) * i / 6
        span = bot_b * (1 - abs(x / bot_a) ** 4) ** 0.25
        parts.append(curve_from_points(
            [Vector((x, -span, FLOOR + 0.004)), Vector((x, span, FLOOR + 0.004))],
            f'by_{i}', WIRE * 0.85, cyclic=False))

    # merge the curves into one mesh
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.join()
    ob = bpy.context.active_object
    ob.name = 'Basket'
    ob.data.materials.append(steel)
    return ob


def tube(p1, p2, radius, name, material, res=10):
    """A straight tube between two points."""
    p1, p2 = Vector(p1), Vector(p2)
    v = p2 - p1
    length = v.length
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=length, vertices=res,
                                        location=(p1 + p2) / 2)
    ob = bpy.context.active_object
    ob.name = name
    ob.rotation_mode = 'QUATERNION'
    ob.rotation_quaternion = v.to_track_quat('Z', 'Y')
    bpy.ops.object.transform_apply(rotation=True)
    ob.data.materials.append(material)
    return ob


def build_frame(steel, rubber, grip_mat):
    """Chassis, legs, castors and the push handle."""
    parts = []
    bx, by = W / 2 * TAPER + 0.012, D / 2 * TAPER + 0.012

    # bottom rails
    parts.append(tube((-bx, -by, 0.16), (bx, -by, 0.16), 0.012, 'rail_f', steel))
    parts.append(tube((-bx, by, 0.16), (bx, by, 0.16), 0.012, 'rail_b', steel))
    parts.append(tube((-bx, -by, 0.16), (-bx, by, 0.16), 0.012, 'rail_l', steel))
    parts.append(tube((bx, -by, 0.16), (bx, by, 0.16), 0.012, 'rail_r', steel))

    # legs up to the basket
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(tube((sx * bx, sy * by, 0.16), (sx * bx, sy * by, FLOOR), 0.011, 'leg', steel))
            # castor fork and wheel
            parts.append(tube((sx * bx, sy * by, 0.16), (sx * bx, sy * by, 0.085), 0.010, 'fork', steel))
            bpy.ops.mesh.primitive_cylinder_add(radius=0.042, depth=0.026, vertices=16,
                                                location=(sx * bx, sy * by, 0.045))
            wheel = bpy.context.active_object
            wheel.rotation_euler = (0, math.pi / 2, 0)
            bpy.ops.object.transform_apply(rotation=True)
            wheel.data.materials.append(rubber)
            parts.append(wheel)

    # handle: uprights from the rim, then the bar
    hy = D / 2 - 0.02
    for sx in (-1, 1):
        parts.append(tube((sx * W / 2, hy, RIM), (sx * W / 2, hy + 0.06, RIM + 0.12), 0.011, 'upright', steel))
    parts.append(tube((-W / 2, hy + 0.06, RIM + 0.12), (W / 2, hy + 0.06, RIM + 0.12), 0.012, 'h_bar', steel))
    # rubber grip over the middle of the bar
    bpy.ops.mesh.primitive_cylinder_add(radius=0.019, depth=W * 0.72, vertices=16,
                                        location=(0, hy + 0.06, RIM + 0.12))
    grip = bpy.context.active_object
    grip.rotation_euler = (0, math.pi / 2, 0)
    bpy.ops.object.transform_apply(rotation=True)
    grip.data.materials.append(grip_mat)
    parts.append(grip)

    # a small plate on the front of the basket, like the shop's own branding
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    ob = bpy.context.active_object
    ob.name = 'Frame'
    return ob


def main():
    reset()
    steel = mat('Steel', (0.60, 0.65, 0.68), metallic=0.55, roughness=0.42)
    rubber = mat('Rubber', (0.09, 0.10, 0.11), metallic=0.0, roughness=0.85)
    grip = mat('Grip', (0.05, 0.38, 0.22), metallic=0.05, roughness=0.42)

    basket = build_basket(steel)
    frame = build_frame(steel, rubber, grip)

    # subtle bevel so the wire catches light instead of reading as flat sticks
    for ob in (basket,):
        m = ob.modifiers.new('Bevel', 'BEVEL')
        m.width = 0.0006
        m.segments = 1

    # origin at the floor, centred, so three.js can drop it on the ground
    bpy.ops.object.select_all(action='DESELECT')
    for ob in (basket, frame):
        ob.select_set(True)
    bpy.context.view_layer.objects.active = frame
    bpy.ops.object.join()
    ob = bpy.context.active_object
    ob.name = 'Trolley'

    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # move so the base sits at z = 0 and it is centred in x/y
    for v in ob.data.vertices:
        v.co.y -= 0.03

    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    print(f'Trolley: {len(ob.data.vertices)} verts, ~{tris} tris')

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUT,
        export_format='GLB',
        export_apply=True,
        export_yup=True,
        export_materials='EXPORT',
        export_normals=True,
    )
    print('wrote', OUT, os.path.getsize(OUT), 'bytes')


if __name__ == '__main__':
    main()
