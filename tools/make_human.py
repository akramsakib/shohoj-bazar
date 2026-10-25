"""Author a rigged, animated shopper in Blender and export it as GLB.

The people in the shop were assembled from capsules in three.js: no skeleton, no
joints, an arm that swung about a fixed pivot. This script builds a real
character — mesh, skeleton, smooth skin weights, a walk cycle and an idle — and
exports it so the browser can play actual animation.

Run:  python3 tools/make_human.py
Out:  models/human.glb          (~1 mesh, 1 armature, 2 actions)
"""
import math
import os

import bpy
from mathutils import Vector

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'models', 'human.glb')

# ---------------------------------------------------------------- proportions
HEIGHT = 1.72
HIP_Z = 0.95
KNEE_Z = 0.50
ANKLE_Z = 0.085
SHOULDER_Z = 1.395
ELBOW_Z = 1.145
WRIST_Z = 0.895
NECK_Z = 1.445
HEAD_C = 1.565


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, rgb, rough=0.8, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    return m


def add_sphere(loc, radius, name, material, scale=(1, 1, 1), seg=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=radius, location=loc)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    ob.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return ob


def add_taper(p1, p2, r1, r2, name, material, scale_y=1.0, seg=16):
    """A tapered limb segment from p1 to p2, oriented along the segment."""
    p1, p2 = Vector(p1), Vector(p2)
    v = p2 - p1
    depth = v.length
    bpy.ops.mesh.primitive_cone_add(
        vertices=seg, radius1=r1, radius2=r2, depth=depth,
        location=(p1 + p2) / 2,
    )
    ob = bpy.context.active_object
    ob.name = name
    if scale_y != 1.0:
        ob.scale.y = scale_y
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    # cones point along +Z; rotate so +Z runs along the segment
    ob.rotation_mode = 'QUATERNION'
    ob.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(v.normalized())
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    ob.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return ob


def add_box(loc, size, name, material, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    ob.data.materials.append(material)
    return ob


# ------------------------------------------------------------------ the person
def build_body(scarf=False):
    skin = mat('Skin', (0.62, 0.40, 0.27), rough=0.62)
    shirt = mat('Shirt', (0.16, 0.34, 0.44), rough=0.85)
    trouser = mat('Trousers', (0.13, 0.15, 0.18), rough=0.9)
    shoe = mat('Shoes', (0.06, 0.07, 0.08), rough=0.45)
    hair = mat('Hair', (0.05, 0.04, 0.04), rough=0.7)
    scarf_m = mat('Scarf', (0.72, 0.32, 0.36), rough=0.94)
    brow_m = mat('Brow', (0.12, 0.09, 0.07), rough=0.8)
    lip_m = mat('Lips', (0.46, 0.24, 0.20), rough=0.5)

    parts = []

    # ---- torso: pelvis, waist, rib cage, shoulders (tapered, not a capsule) ----
    parts.append(add_taper((0, 0, 0.86), (0, 0, 1.00), 0.145, 0.135, 'pelvis', trouser, scale_y=0.78))
    parts.append(add_taper((0, 0, 0.99), (0, 0, 1.20), 0.128, 0.158, 'waist', shirt, scale_y=0.72))
    parts.append(add_taper((0, 0, 1.19), (0, 0, 1.36), 0.158, 0.175, 'ribs', shirt, scale_y=0.70))
    parts.append(add_sphere((0, 0, 1.372), 0.172, 'chest', shirt, scale=(1.0, 0.66, 0.62)))
    for sx in (-1, 1):
        parts.append(add_sphere((sx * 0.155, 0, 1.372), 0.075, f'deltoid{sx}', shirt, scale=(1, 0.9, 0.9)))

    # ---- neck + head ----
    parts.append(add_taper((0, 0, 1.36), (0, 0, 1.46), 0.052, 0.048, 'neck', skin))
    parts.append(add_sphere((0, -0.004, HEAD_C), 0.098, 'head', skin, scale=(0.92, 1.0, 1.14)))
    parts.append(add_sphere((0, -0.022, 1.508), 0.076, 'jaw', skin, scale=(0.80, 0.96, 0.88)))
    # lips: a small dark-red ellipse reads as a mouth at any distance
    parts.append(add_sphere((0, -0.090, 1.512), 0.024, 'lips', lip_m, scale=(1.35, 0.30, 0.5)))
    # nose + ears give the head a front and a back
    parts.append(add_sphere((0, -0.098, 1.552), 0.021, 'nose', skin, scale=(0.8, 1.0, 0.9)))
    for sx in (-1, 1):
        parts.append(add_sphere((sx * 0.088, -0.004, 1.556), 0.024, f'ear{sx}', skin, scale=(0.5, 1, 1.2)))

    # eyes: dark iris + a bright catchlight, which is what makes a face read
    iris = mat('Iris', (0.03, 0.02, 0.02), rough=0.25)

    # eyes sit ON the face surface: the skull surface is at y = -0.102, so an
    # eye centred any deeper was simply swallowed by the head
    for sx in (-1, 1):
        parts.append(add_sphere((sx * 0.036, -0.093, 1.575), 0.0125, f'eye{sx}', iris, seg=12, rings=8))
        # eyelid ridge + brow give the face structure instead of two dots
        parts.append(add_sphere((sx * 0.036, -0.090, 1.594), 0.017, f'brow{sx}', brow_m, scale=(1.0, 0.30, 0.22)))
        parts.append(add_sphere((sx * 0.036, -0.090, 1.560), 0.016, f'lid{sx}', skin, scale=(1.1, 0.4, 0.4)))

    # ---- hair: a swept cap, not a helmet ----
    # A scarf uses the same sculpt as the hair (so it clears the face exactly the
    # same way), just inflated a little and in cloth.
    h_mat = scarf_m if scarf else hair
    h_scale = (1.06, 1.05, 1.06) if scarf else (0.95, 1.0, 1.0)
    h = add_sphere((0, 0.006, 1.578), 0.108 if scarf else 0.106, 'hair', h_mat, scale=h_scale, seg=20, rings=14)
    # The face is at -Y. Pull every vertex in the face region back behind the
    # hairline: hair that wrapped the whole skull turned the head into a dark blob.
    face_z = 0.086 if scarf else 0.052      # a scarf frames more of the face
    face_y = -0.012 if scarf else -0.030    # and must not wrap across it
    for v in h.data.vertices:
        co = v.co
        if co.y < face_y and co.z < face_z:
            v.co.y = face_y
        # sideburns stay in front of the ears, not over the cheeks
        if abs(co.x) > 0.070 and co.z < 0.010:
            v.co.z = 0.010
    h.data.update()
    parts.append(h)
    parts.append(add_box((0, 0.052, 1.512), (0.150, 0.082, 0.120), 'hair_back', h_mat))
    # a nape/side mass so the head is not a bald sphere from behind
    for sx in (-1, 1):
        parts.append(add_sphere((sx * 0.072, 0.020, 1.545), 0.048, f'hair_side{sx}', h_mat, scale=(0.55, 1.0, 1.05)))
    if scarf:
        # and the drape that falls over the shoulders and back
        parts.append(add_taper((0, 0.030, 1.428), (0, 0.055, 1.286), 0.104, 0.162, 'scarf_drape', scarf_m, scale_y=0.72))
        for sx in (-1, 1):
            parts.append(add_sphere((sx * 0.100, 0.014, 1.428), 0.058, f'scarf_shoulder{sx}', scarf_m, scale=(0.8, 1.0, 1.0)))

    # ---- arms ----
    for sx, side in ((-1, 'L'), (1, 'R')):
        sh = (sx * 0.175, 0, SHOULDER_Z)
        el = (sx * 0.205, -0.012, ELBOW_Z)
        wr = (sx * 0.216, -0.026, WRIST_Z)
        parts.append(add_taper(sh, el, 0.058, 0.046, f'upperarm{side}', shirt))
        parts.append(add_sphere(el, 0.047, f'elbow{side}', shirt))
        parts.append(add_taper(el, wr, 0.047, 0.035, f'forearm{side}', skin if False else shirt))
        # hand: palm + a thumb so it is not a nub
        parts.append(add_sphere((wr[0], wr[1] - 0.012, wr[2] - 0.055), 0.045, f'hand{side}', skin,
                                scale=(0.82, 0.62, 1.15)))
        parts.append(add_sphere((wr[0] + sx * 0.032, wr[1] - 0.020, wr[2] - 0.042), 0.017, f'thumb{side}', skin))

    # ---- legs ----
    for sx, side in ((-1, 'L'), (1, 'R')):
        hip = (sx * 0.088, 0, HIP_Z - 0.02)
        kn = (sx * 0.092, 0, KNEE_Z)
        an = (sx * 0.094, 0.002, ANKLE_Z)
        parts.append(add_taper(hip, kn, 0.088, 0.062, f'thigh{side}', trouser))
        parts.append(add_sphere(kn, 0.062, f'knee{side}', trouser))
        parts.append(add_taper(kn, an, 0.062, 0.043, f'shin{side}', trouser))
        # shoe: heel block + tapered toe, angled like a real shoe
        parts.append(add_box((an[0], -0.035, 0.038), (0.092, 0.205, 0.068), f'shoe{side}', shoe))
        parts.append(add_sphere((an[0], -0.128, 0.034), 0.044, f'toe{side}', shoe, scale=(0.95, 1.0, 0.62)))

    # ---- join everything into one skinned mesh ----
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    body = bpy.context.active_object
    body.name = 'HumanMesh'
    return body


# ------------------------------------------------------------------- skeleton
BONES = [
    # name,      head,                      tail,                       parent
    ('hips',     (0, 0, HIP_Z),             (0, 0, 1.05),               None),
    ('spine',    (0, 0, 1.02),              (0, 0, 1.20),               'hips'),
    ('chest',    (0, 0, 1.20),              (0, 0, 1.37),               'spine'),
    ('neck',     (0, 0, 1.37),              (0, 0, 1.46),               'chest'),
    ('head',     (0, 0, 1.46),              (0, 0, 1.70),               'neck'),
    ('upperarm.L', (-0.175, 0, SHOULDER_Z), (-0.205, -0.012, ELBOW_Z),  'chest'),
    ('forearm.L', (-0.205, -0.012, ELBOW_Z), (-0.216, -0.026, WRIST_Z), 'upperarm.L'),
    ('hand.L',   (-0.216, -0.026, WRIST_Z), (-0.216, -0.04, 0.80),      'forearm.L'),
    ('upperarm.R', (0.175, 0, SHOULDER_Z),  (0.205, -0.012, ELBOW_Z),   'chest'),
    ('forearm.R', (0.205, -0.012, ELBOW_Z), (0.216, -0.026, WRIST_Z),   'upperarm.R'),
    ('hand.R',   (0.216, -0.026, WRIST_Z),  (0.216, -0.04, 0.80),       'forearm.R'),
    ('thigh.L',  (-0.088, 0, HIP_Z - 0.02), (-0.092, 0, KNEE_Z),        'hips'),
    ('shin.L',   (-0.092, 0, KNEE_Z),       (-0.094, 0.002, ANKLE_Z),   'thigh.L'),
    ('foot.L',   (-0.094, 0.002, ANKLE_Z),  (-0.094, -0.18, 0.03),      'shin.L'),
    ('thigh.R',  (0.088, 0, HIP_Z - 0.02),  (0.092, 0, KNEE_Z),         'hips'),
    ('shin.R',   (0.092, 0, KNEE_Z),        (0.094, 0.002, ANKLE_Z),    'thigh.R'),
    ('foot.R',   (0.094, 0.002, ANKLE_Z),   (0.094, -0.18, 0.03),       'shin.R'),
]


def build_armature():
    bpy.ops.object.armature_add(location=(0, 0, 0))
    rig = bpy.context.active_object
    rig.name = 'HumanRig'
    rig.data.name = 'HumanSkeleton'
    bpy.ops.object.mode_set(mode='EDIT')
    eb = rig.data.edit_bones
    for b in list(eb):
        eb.remove(b)
    made = {}
    for name, head, tail, parent in BONES:
        b = eb.new(name)
        b.head = Vector(head)
        b.tail = Vector(tail)
        b.use_deform = True
        if parent:
            b.parent = made[parent]
            b.use_connect = False
        made[name] = b
    bpy.ops.object.mode_set(mode='OBJECT')
    return rig


def segment_distance(p, a, b):
    ab = b - a
    t = 0.0 if ab.length_squared == 0 else max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return (p - (a + ab * t)).length


def skin(body, rig):
    """Weight every vertex to the two nearest bones, with a smooth falloff.

    Bone-heat weighting is unreliable on a body made of overlapping primitives,
    so we solve it directly: distance to the bone segment, inverse-square blend,
    top two bones only. Limbs deform cleanly and joints do not tear.
    """
    segs = [(n, Vector(h), Vector(t)) for n, h, t, _ in BONES]
    groups = {}
    for name, _, _ in [(n, h, t) for n, h, t, _ in BONES]:
        groups[name] = body.vertex_groups.new(name=name)

    for v in body.data.vertices:
        p = v.co
        d = []
        for name, a, b in segs:
            d.append((segment_distance(p, a, b), name))
        d.sort()
        best = d[:2]
        weights = []
        for dist, name in best:
            weights.append((1.0 / (dist ** 4 + 1e-6), name))
        total = sum(w for w, _ in weights)
        for w, name in weights:
            groups[name].add([v.index], w / total, 'REPLACE')

    mod = body.modifiers.new('Armature', 'ARMATURE')
    mod.object = rig
    body.parent = rig


# ---------------------------------------------------------------- animation
def key(bone_name, frame, rot=None, loc=None):
    rig = bpy.data.objects['HumanRig']
    pb = rig.pose.bones[bone_name]
    pb.rotation_mode = 'XYZ'
    if rot is not None:
        pb.rotation_euler = [math.radians(a) for a in rot]
        pb.keyframe_insert('rotation_euler', frame=frame)
    if loc is not None:
        pb.location = loc
        pb.keyframe_insert('location', frame=frame)


def new_action(name):
    rig = bpy.data.objects['HumanRig']
    if rig.animation_data is None:
        rig.animation_data_create()
    action = bpy.data.actions.new(name)
    rig.animation_data.action = action
    return action


def clear_pose():
    rig = bpy.data.objects['HumanRig']
    for pb in rig.pose.bones:
        pb.rotation_mode = 'XYZ'
        pb.rotation_euler = (0, 0, 0)
        pb.location = (0, 0, 0)


def walk_action():
    """A 24-frame walk at 24 fps: contact, passing, contact, passing."""
    action = new_action('Walk')
    clear_pose()
    rig = bpy.data.objects['HumanRig']
    rig.animation_data.action = action

    # frames: 1 contact (L fwd), 7 passing, 13 contact (R fwd), 19 passing, 25 = 1
    for f, swing in ((1, 1), (13, -1), (25, 1)):
        key('thigh.L', f, rot=(28 * swing, 0, 0))
        key('thigh.R', f, rot=(-28 * swing, 0, 0))
        key('shin.L', f, rot=(-6 - 12 * (1 if swing > 0 else 0), 0, 0))
        key('shin.R', f, rot=(-6 - 12 * (1 if swing < 0 else 0), 0, 0))
        key('foot.L', f, rot=(10 * swing, 0, 0))
        key('foot.R', f, rot=(-10 * swing, 0, 0))
        key('upperarm.L', f, rot=(-22 * swing, 0, 4))
        key('upperarm.R', f, rot=(22 * swing, 0, -4))
        key('forearm.L', f, rot=(-14 - 8 * swing, 0, 0))
        key('forearm.R', f, rot=(-14 + 8 * swing, 0, 0))
        key('hips', f, rot=(2, 0, -3 * swing), loc=(0, 0, -0.012 if swing > 0 else -0.012))
        key('spine', f, rot=(1.5, 0, 2 * swing))
        key('chest', f, rot=(0, -4 * swing, 0))     # counter-rotation: real arms drive the torso
        key('head', f, rot=(0, 2 * swing, 0))
    for f, swing in ((7, 0), (19, 0)):
        key('thigh.L', f, rot=(0, 0, 0))
        key('thigh.R', f, rot=(0, 0, 0))
        key('shin.L', f, rot=(-38 if f == 19 else -8, 0, 0))
        key('shin.R', f, rot=(-38 if f == 7 else -8, 0, 0))
        key('foot.L', f, rot=(6, 0, 0))
        key('foot.R', f, rot=(6, 0, 0))
        key('upperarm.L', f, rot=(0, 0, 4))
        key('upperarm.R', f, rot=(0, 0, -4))
        key('forearm.L', f, rot=(-18, 0, 0))
        key('forearm.R', f, rot=(-18, 0, 0))
        key('hips', f, rot=(2, 0, 0), loc=(0, 0, 0.008))
        key('spine', f, rot=(1.5, 0, 0))
    return action


def idle_action():
    """Breathing, a slow weight shift, and a small head turn."""
    action = new_action('Idle')
    clear_pose()
    rig = bpy.data.objects['HumanRig']
    rig.animation_data.action = action
    for f in (1, 60, 121):
        phase = 0 if f == 1 else (1 if f == 60 else 2)
        sway = {0: 1, 1: -1, 2: 1}[phase]
        key('hips', f, rot=(0, 0, sway * 1.2), loc=(0, 0, 0.004 if sway > 0 else -0.004))
        key('spine', f, rot=(0.8, 0, -sway * 1.0))
        key('chest', f, rot=(-0.6, 0, sway * 0.8))
        key('head', f, rot=(0, sway * 4, 0))
        key('upperarm.L', f, rot=(0, 0, 3))
        key('upperarm.R', f, rot=(0, 0, -3))
        key('forearm.L', f, rot=(-8, 0, 0))
        key('forearm.R', f, rot=(-8, 0, 0))
    return action


def main(scarf=False, out=None):
    reset()
    body = build_body(scarf=scarf)
    rig = build_armature()
    skin(body, rig)

    bpy.context.scene.render.fps = 24
    walk = walk_action()
    idle = idle_action()

    # every action gets its own NLA strip so the exporter writes both clips
    rig.animation_data.action = None
    for action in (walk, idle):
        track = rig.animation_data.nla_tracks.new()
        track.name = action.name
        strip = track.strips.new(action.name, 1, action)
        strip.name = action.name
        track.mute = False

    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    body.select_set(True)
    bpy.context.view_layer.objects.active = rig

    out = out or OUT
    os.makedirs(os.path.dirname(out), exist_ok=True)
    kwargs = dict(
        filepath=out, export_format='GLB', export_yup=True,
        use_selection=True, export_apply=False,
        export_animations=True, export_animation_mode='NLA_TRACKS',
        export_frame_range=False, export_bake_animation=True,
        export_optimize_animation_size=True,
    )
    try:
        bpy.ops.export_scene.gltf(**kwargs)
    except TypeError as e:
        print('falling back on export args:', e)
        bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_yup=True, use_selection=True)

    tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
    print(f'Human: {len(body.data.vertices)} verts, ~{tris} tris, '
          f'{len(rig.data.bones)} bones, actions: {[a.name for a in bpy.data.actions]}')
    print('wrote', out, os.path.getsize(out), 'bytes')


if __name__ == '__main__':
    import sys
    want_scarf = '--scarf' in sys.argv
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'models',
                       'human_scarf.glb' if want_scarf else 'human.glb')
    main(scarf=want_scarf, out=out)
