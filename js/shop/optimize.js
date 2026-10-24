/* Static-scene optimisation: baked vertex lighting + draw-call merging.

   Why this exists
   ---------------
   The aisle was built mesh-by-mesh for clarity (a plinth here, a fascia there,
   a price rail per level). That is lovely to author and terrible to draw: the
   scene ended up at ~2,200 draw calls and 26 real-time point lights, which in a
   forward renderer means every single fragment loops over 26 lights. Frame cost
   was spent almost entirely on state changes and light maths, not pixels.

   What we do instead, once, at load:
     1. Collect every static mesh (nothing pickable, nothing animated).
     2. Bake the point lights into a per-vertex light field. A supermarket aisle
        is a static lighting problem — the lamps never move — so it should be
        solved once, not sixty times a second.
     3. Weld the geometry into one buffer per material, so a whole shelving run
        becomes a handful of draw calls.
     4. Delete the point lights. Keep only the sun (for shadows) and the
        hemisphere/environment fill.

   The result is the same aisle, lit more softly, at a fraction of the cost.
*/

import * as THREE from '../../vendor/three.module.js';
import { mergeGeometries } from '../../vendor/jsm/utils/BufferGeometryUtils.js';

function matKey(m) {
  return [
    m.type,
    m.color ? m.color.getHexString() : '-',
    m.map ? m.map.uuid : '-',
    m.emissive ? m.emissive.getHexString() : '-',
    m.emissiveIntensity ?? '-',
    m.roughness ?? '-',
    m.metalness ?? '-',
    m.opacity,
    m.side,
    m.transparent,
  ].join('|');
}

/* Sum the contribution of every static point light at one point in space. */
function makeSampler(lights, ambient, wrap) {
  const n = lights.length;
  const px = new Float32Array(n), py = new Float32Array(n), pz = new Float32Array(n);
  const ir = new Float32Array(n), ig = new Float32Array(n), ib = new Float32Array(n);
  const cut = new Float32Array(n);
  lights.forEach((l, i) => {
    px[i] = l.pos.x; py[i] = l.pos.y; pz[i] = l.pos.z;
    ir[i] = l.color.r * l.intensity; ig[i] = l.color.g * l.intensity; ib[i] = l.color.b * l.intensity;
    cut[i] = l.cutoff || 14;
  });
  const base = new THREE.Color(ambient);

  return function sample(x, y, z, nx, ny, nz, out) {
    let r = base.r, g = base.g, b = base.b;
    for (let i = 0; i < n; i++) {
      const dx = px[i] - x, dy = py[i] - y, dz = pz[i] - z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > cut[i] * cut[i]) continue;
      const d = Math.sqrt(d2) || 0.001;
      // N·L, softened so a flat shelf face does not go pitch black between lamps
      const ndl = Math.max(0, (nx * dx + ny * dy + nz * dz) / d);
      const lambert = ndl * (1 - wrap) + wrap;
      // physical inverse-square, with a floor so nothing blows up at the lamp
      const atten = 1 / Math.max(d2, 0.85);
      // smooth window so the bake does not end in a hard ring at the cutoff
      const w = Math.min(1, (cut[i] - d) / (cut[i] * 0.35));
      const k = lambert * atten * Math.max(0, w);
      r += ir[i] * k; g += ig[i] * k; b += ib[i] * k;
    }
    out[0] = r; out[1] = g; out[2] = b;
  };
}

function bakeGeometry(geo, sample, scale) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const count = pos.count;
  const col = new Float32Array(count * 3);
  const s = [0, 0, 0];
  for (let i = 0; i < count; i++) {
    sample(
      pos.getX(i), pos.getY(i), pos.getZ(i),
      nor ? nor.getX(i) : 0, nor ? nor.getY(i) : 1, nor ? nor.getZ(i) : 0,
      s
    );
    col[i * 3] = s[0] * scale;
    col[i * 3 + 1] = s[1] * scale;
    col[i * 3 + 2] = s[2] * scale;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

/**
 * @param {THREE.Object3D} root        subtree to flatten (the aisle group)
 * @param {object} opts
 *   exclude   Set of objects that must stay individual (pickable packs, rigs)
 *   baked     Set of objects whose material should receive the vertex light
 *   ambient   ambient floor colour for the bake
 *   scale     gentle global multiplier on baked light
 *   keepLights number of point lights to leave alive for moving objects
 * @returns {{callsBefore, meshesBefore, meshesAfter, lightsRemoved, vertexBakeMs}}
 */
export function bakeAndMerge(root, opts = {}) {
  const t0 = performance.now();
  const exclude = opts.exclude || new Set();
  const ambient = opts.ambient ?? 0x2a2620;
  const scale = opts.scale ?? 1.0;
  const wrap = opts.wrap ?? 0.35;

  const isExcluded = (o) => {
    let p = o;
    while (p && p !== root) {
      if (exclude.has(p)) return true;
      p = p.parent;
    }
    return exclude.has(root);
  };

  // ---- 1. gather the lamps we are about to retire -------------------------
  const lamps = [];
  const dead = [];
  root.traverse((o) => {
    if (!o.isPointLight) return;
    dead.push(o);
    lamps.push({ pos: o.position.clone(), color: o.color.clone(), intensity: o.intensity, cutoff: o.distance || 14 });
  });
  const sample = makeSampler(lamps, ambient, wrap);

  // ---- 2. collect mergeable meshes ---------------------------------------
  root.updateMatrixWorld(true);
  const buckets = new Map();     // materialKey -> { material, geoms[], baked }
  const materials = new Map();   // materialKey -> material
  const removals = [];
  let meshesBefore = 0;
  let vertices = 0;

  const meshList = [];
  root.traverse((o) => { if (o.isMesh && o.visible && !o.isInstancedMesh) meshList.push(o); });
  meshesBefore = meshList.length;

  meshList.forEach((o) => {
    if (isExcluded(o)) return;
    if (!o.material || Array.isArray(o.material)) return;       // multi-material groups stay put
    if (o.material.transparent) return;                         // keep sorting intact
    if (!o.geometry || !o.geometry.attributes.position) return;

    const geo = o.geometry.clone();
    geo.applyMatrix4(o.matrixWorld);                            // bake the transform in
    // normals after a non-uniform parent transform are fixed by applyMatrix4

    const key = matKey(o.material);
    let mat = materials.get(key);
    if (!mat) {
      // one material per distinct look
      mat = o.material.clone ? o.material.clone() : new THREE.MeshStandardMaterial();
      mat.vertexColors = true;
      materials.set(key, mat);
    }
    const bakeable = !o.material.isMeshBasicMaterial;
    if (bakeable) bakeGeometry(geo, sample, scale);
    else if (!geo.attributes.color) {
      const n = geo.attributes.position.count;
      const white = new Float32Array(n * 3).fill(1);
      geo.setAttribute('color', new THREE.BufferAttribute(white, 3));
    }

    // strip attributes that would block a merge (mismatched sets)
    ['uv1', 'uv2', 'tangent', 'skinIndex', 'skinWeight'].forEach((a) => {
      if (geo.attributes[a]) geo.deleteAttribute(a);
    });

    if (!buckets.has(key)) buckets.set(key, { material: mat, geoms: [], cast: false, recv: false });
    const b = buckets.get(key);
    b.geoms.push(geo);
    b.cast = b.cast || o.castShadow;
    b.recv = b.recv || o.receiveShadow;
    vertices += geo.attributes.position.count;
    removals.push(o);
  });

  // ---- 3. weld and swap in ------------------------------------------------
  const group = new THREE.Group();
  group.name = 'baked-static';
  const box = new THREE.Box3();

  buckets.forEach((b) => {
    let geo = null;
    try {
      geo = b.geoms.length === 1 ? b.geoms[0] : mergeGeometries(b.geoms, false);
    } catch (e) {
      geo = null;
    }
    if (!geo) {
      // not mergeable (e.g. mixed index/non-index) — fall back to individuals
      b.geoms.forEach((g) => {
        const m = new THREE.Mesh(g, b.material);
        m.castShadow = b.cast; m.receiveShadow = b.recv;
        group.add(m);
      });
      return;
    }
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    geo.computeBoundingBox();
    const mesh = new THREE.Mesh(geo, b.material);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.recv;
    group.add(mesh);
    box.union(geo.boundingBox);
  });

  removals.forEach((o) => { if (o.parent) o.parent.remove(o); });
  dead.forEach((l) => { if (l.parent) l.parent.remove(l); });
  root.add(group);

  // strip unused vertex attributes that only inflate memory
  return {
    callsBefore: meshesBefore,
    meshesBefore,
    meshesAfter: group.children.length,
    materials: materials.size,
    vertices,
    lightsRemoved: dead.length,
    vertexBakeMs: Math.round(performance.now() - t0),
  };
}
