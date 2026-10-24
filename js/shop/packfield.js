/* Pack atlas + instanced pack field.

   The problem this solves
   -----------------------
   Every pack on every shelf was its own `Mesh` carrying a **six-material array**
   (side, side, side, side, front, back). Six materials = six draw calls per pack,
   roughly 1,500 draw calls per frame for one aisle, plus a separate 384x480 canvas
   texture per product. The GPU was idle; the CPU was melting submitting state
   changes, and none of the textures were mip-mapped/filtered as a group.

   What we do instead
   ------------------
   * Draw every product's front artwork once into a single atlas canvas.
   * One unit "pillow bag" geometry, flagged per-vertex whether the vertex is on
     the printed front face or a plain film face.
   * One `InstancedMesh`. Per instance we carry: the matrix (position, rotation,
     the pack's real dimensions), the atlas cell (uv offset + scale) and the film
     tint.
   * A small shader patch mixes atlas artwork (front) against film tint (sides),
     so one material covers every pack in the department.

   Result: ~246 packs in 1-3 draw calls, one texture, and picking still works
   because a raycast tells us which instance we hit.
*/

import * as THREE from '../../vendor/three.module.js';

const CELL_W = 256;
const CELL_H = 320;
const COLS = 8;
const ROWS = 6;

/**
 * Build the atlas. Returns { texture, cellFor(productId) }.
 * `drawLabel` is passed in so this module stays independent of artwork code.
 */
export function buildAtlas(products, drawLabel) {
  const W = COLS * CELL_W;
  const H = ROWS * CELL_H + 64;             // bottom strip holds the white texel
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const cells = new Map();
  const max = COLS * ROWS;
  products.forEach((product, i) => {
    if (i >= max) return;
    const cx = (i % COLS) * CELL_W;
    const cy = Math.floor(i / COLS) * CELL_H;
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx, cy, CELL_W, CELL_H);
    ctx.clip();
    ctx.translate(cx, cy);
    ctx.scale(CELL_W / 384, CELL_H / 480);   // artwork is authored at 384x480
    drawLabel(product, ctx, 384, 480);
    ctx.restore();
    // a 2 px inset stops neighbouring cells bleeding in at low mip levels
    cells.set(product.id, {
      u: (cx + 2) / W,
      v: 1 - (cy + CELL_H - 2) / H,
      su: (CELL_W - 4) / W,
      sv: (CELL_H - 4) / H,
    });
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;

  // the flat white texel every non-printed face samples, so vertex tint is exact
  const whiteUv = { u: 4 / W, v: 4 / H };

  return { texture, cells, whiteUv, size: [W, H] };
}

/* A unit pillow bag: 1 x 1 x 1 with the film behaviour baked in, so instances can
   carry the real dimensions in their matrix. Front face (+z) is flagged. */
function unitPackGeometry(bulge = 0.085) {
  const geo = new THREE.BoxGeometry(1, 1, 1, 6, 10, 2);
  const pos = geo.attributes.position;
  const smooth = (t) => t * t * (3 - 2 * t);
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = x / 0.5, ny = y / 0.5;
    const belly = Math.cos(nx * Math.PI / 2) * Math.cos(ny * Math.PI / 2) * bulge;
    z += Math.sign(z || 1) * belly;
    x += Math.sign(x || 1) * belly * 0.22;
    if (ny > 0.45) {                       // crimped top seal
      const t = smooth(Math.min(1, (ny - 0.45) / 0.55));
      x *= 1 - 0.20 * t;
      z *= 1 - 0.16 * t;
      y -= t * t * 0.012;
    }
    if (ny < -0.55) {                      // sagging base
      const t = smooth(Math.min(1, (-ny - 0.55) / 0.45));
      x *= 1 - 0.06 * t;
      z *= 1 - 0.04 * t;
    }
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();

  // Printed faces are +z AND -z: a real pack is printed front and back, and
  // printing only +z left every pack on one side of the aisle blank.
  // BoxGeometry groups run +x, -x, +y, -y, +z, -z, so front/back are 4 and 5.
  const front = new Float32Array(pos.count);
  const index = geo.index;
  [4, 5].forEach((gi) => {
    const g = geo.groups[gi];
    for (let i = g.start; i < g.start + g.count; i++) front[index.getX(i)] = 1;
  });
  // per-VERTEX, not per-instance: an InstancedBufferAttribute here reads
  // front[instanceIndex] and every pack inherits a neighbour's value
  geo.setAttribute('aFront', new THREE.BufferAttribute(front, 1));
  return geo;
}

/**
 * @param {Array} slots  [{ product, position:Vector3, rotation:Euler, size:{w,h,d}, shadow:bool }]
 * @param {object} atlas  from buildAtlas()
 * @returns handle with .mesh, .products, .indexOf(productId), .hide(i), .show(i)
 */
export function buildPackField(slots, atlas) {
  const geo = unitPackGeometry();
  const count = slots.length;

  const uvOff = new Float32Array(count * 2);
  const uvScale = new Float32Array(count * 2);
  const tint = new Float32Array(count * 3);
  const productOf = new Array(count);
  const slotOf = new Array(count);

  const material = new THREE.MeshStandardMaterial({
    map: atlas.texture,
    vertexColors: true,
    roughness: 0.46,
    metalness: 0.05,
    envMapIntensity: 1.15,
  });

  slots.forEach((slot, i) => {
    const cell = atlas.cells.get(slot.product.id) || {
      u: atlas.whiteUv.u, v: atlas.whiteUv.v, su: 1, sv: 1,
    };
    uvOff[i * 2] = cell.u; uvOff[i * 2 + 1] = cell.v;
    uvScale[i * 2] = cell.su; uvScale[i * 2 + 1] = cell.sv;
    const c = new THREE.Color(slot.product.colour || '#dddddd');
    if (slot.product.accent) c.lerp(new THREE.Color(slot.product.accent), 0.55);
    tint[i * 3] = c.r; tint[i * 3 + 1] = c.g; tint[i * 3 + 2] = c.b;
    productOf[i] = slot.product;
    slotOf[i] = slot;
  });

  geo.setAttribute('aUvOff', new THREE.InstancedBufferAttribute(uvOff, 2));
  geo.setAttribute('aUvScale', new THREE.InstancedBufferAttribute(uvScale, 2));
  geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(tint, 3));

  // ---- shader patch: atlas artwork on the printed face, film tint elsewhere ----
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec2 aUvOff;
        attribute vec2 aUvScale;
        attribute vec3 aTint;
        attribute float aFront;
        varying vec2 vPackUv;
        varying float vPackFront;
        varying vec3 vPackTint;`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>
        vPackUv = uv * aUvScale + aUvOff;
        vPackFront = aFront;
        vPackTint = aTint;`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 vPackUv;
        varying float vPackFront;
        varying vec3 vPackTint;`)
      .replace('#include <map_fragment>', `
        vec3 art = texture2D(map, vPackUv).rgb;
        vec3 film = vPackTint * (0.92 + 0.08 * vPackFront);
        vec3 packed = mix(film, art, vPackFront);
        diffuseColor.rgb *= packed;`);
  };
  material.customProgramCacheKey = () => 'packfield-v1';

  const mesh = new THREE.InstancedMesh(geo, material, count);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;              // one big batch spanning the aisle
  mesh.name = 'pack-field';
  // neutral per-vertex colour so three's vertexColors path is a no-op
  const cols = new Float32Array(geo.attributes.position.count * 3).fill(1);
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));

  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const scale = new THREE.Vector3();
  const shown = new Uint8Array(count).fill(1);

  function place(i) {
    const s = slotOf[i];
    euler.copy(s.rotation);
    quat.setFromEuler(euler);
    scale.set(s.size.w, s.size.h, s.size.d);
    matrix.compose(s.position, quat, scale);
    mesh.setMatrixAt(i, matrix);
    mesh.instanceMatrix.needsUpdate = true;
  }
  for (let i = 0; i < count; i++) place(i);

  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  function hide(i) {
    if (!shown[i]) return;
    mesh.setMatrixAt(i, ZERO);
    mesh.instanceMatrix.needsUpdate = true;
    shown[i] = 0;
  }
  function show(i) {
    if (shown[i]) return;
    place(i);
    shown[i] = 1;
  }

  return {
    mesh,
    products: productOf,
    slots: slotOf,
    count,
    indexOf: (productId) => productOf.findIndex((p) => p.id === productId),
    hide,
    show,
    showAll: () => { for (let i = 0; i < count; i++) show(i); },
  };
}
