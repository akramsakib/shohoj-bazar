"""A supermarket carrier bag, modelled rather than typed.

A poly bag is a lofted profile with a gusset fold, a gathered neck and two handle
loops, so it is built here as a skin over a real profile curve and then gently
crinkled with noise — the way a prop artist would start.

    python3 tools/make_bag.py
"""
import math
import bpy
from mathutils import Vector, noise

OUT = 'models/bag.glb'
SEG = 28
RINGS = 16


def plastic():
    m = bpy.data.materials.new('BagPlastic')
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (0.93, 0.93, 0.90, 1.0)
    b.inputs['Roughness'].default_value = 0.24
    b.inputs['Alpha'].default_value = 0.86
    if 'Coat Weight' in b.inputs:
        b.inputs['Coat Weight'].default_value = 0.6
        b.inputs['Coat Roughness'].default_value = 0.12
    m.blend_method = 'BLEND'
    m.use_backface_culling = False
    return m


def profile(t):
    if t < 0.18:
        k = t / 0.18
        return 0.135 + 0.012 * k, 0.075 + 0.008 * k
    if t < 0.78:
        k = (t - 0.18) / 0.60
        return 0.147 - 0.022 * k, 0.083 - 0.010 * k
    k = (t - 0.78) / 0.22
    return 0.125 - 0.075 * k, 0.073 - 0.043 * k


def build_sheet(name, mat, crinkle=0.004):
    verts = []
    for r in range(RINGS + 1):
        t = r / RINGS
        z = 0.012 + t * 0.40
        hw, hd = profile(t)
        for s in range(SEG):
            a = 2 * math.pi * s / SEG
            ca, sa = math.cos(a), math.sin(a)
            x = hw * math.copysign(abs(ca) ** (2 / 2.6), ca)
            y = hd * math.copysign(abs(sa) ** (2 / 2.6), sa)
            y *= 1.0 - 0.55 * (abs(ca) ** 6)
            n = noise.noise(Vector((x * 26, y * 26, z * 22)))
            verts.append(Vector((x + n * crinkle, y + n * crinkle, z)))
    faces = []
    for r in range(RINGS):
        for s in range(SEG):
            a = r * SEG + s
            b = r * SEG + (s + 1) % SEG
            faces.append((a, b, b + SEG, a + SEG))
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.update()
    for poly in me.polygons:
        poly.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    ob.data.materials.append(mat)
    bpy.context.collection.objects.link(ob)
    return ob


def handle(name, mat, side):
    verts, faces = [], []
    up = 0.375
    for i in range(13):
        t = i / 12
        a = math.pi * t
        x = side * (0.056 + 0.004 * math.sin(t * 6))
        y = math.cos(a) * 0.036
        z = up + math.sin(a) * 0.052
        verts.append(Vector((x - 0.012, y, z)))
        verts.append(Vector((x + 0.012, y, z)))
    for i in range(12):
        a0 = i * 2
        faces.append((a0, a0 + 1, a0 + 3, a0 + 2))
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.update()
    for poly in me.polygons:
        poly.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    ob.data.materials.append(mat)
    bpy.context.collection.objects.link(ob)
    return ob


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mat = plastic()
    objs = [build_sheet('BagFront', mat, 0.0045), build_sheet('BagBack', mat, 0.0045)]
    for i, o in enumerate(objs):
        o.rotation_euler.z = math.pi * i
    objs.append(handle('BagHandleL', mat, -1))
    objs.append(handle('BagHandleR', mat, 1))
    for o in objs:
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
    bpy.ops.object.join()
    bpy.context.view_layer.objects.active.name = 'ShoppingBag'
    bpy.ops.object.shade_smooth()
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_yup=True,
                              use_selection=True, export_apply=True)
    import os
    print('bag.glb', round(os.path.getsize(OUT) / 1024), 'KB')


if __name__ == '__main__':
    main()
