/* Real props, not code.

   Every carton, crate and light fitting in the shop used to be a box I typed the
   dimensions of. These are scanned CC0 assets from Poly Haven, copied in by
   tools/import_props.py. Real silhouettes, real wear, real normal maps.

   Props are loaded once and instanced by clone, so sixty cartons on the overstock
   shelf cost one geometry upload.
*/

import * as THREE from '../../vendor/three.module.js';
import { GLTFLoader } from '../../vendor/jsm/loaders/GLTFLoader.js';

/* Poly Haven ships an open glTF + .bin + JPG set; three reads that natively, so
   the files are served as published (textures in a `textures/` folder next to the
   .gltf, which is where the .gltf points). */
const FILES = {
  carton: 'models/cardboard_box_01/cardboard_box_01.gltf',
  crate: 'models/plastic_crate_01/plastic_crate_01.gltf',
  batten: 'models/mounted_fluorescent_lights/mounted_fluorescent_lights.gltf',
  cart: 'models/industrial_storage_cart/industrial_storage_cart.gltf',
  bag: 'models/cement_bag/cement_bag.gltf',
};

const cache = {};

export function preloadProps() {
  const loader = new GLTFLoader();
  return Promise.all(Object.entries(FILES).map(([key, url]) => new Promise((resolve) => {
    loader.load(url, (gltf) => {
      const root = gltf.scene;
      root.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = true;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          if (!m) return;
          m.envMapIntensity = 0.95;
          // the fittings carry a real emissive map: let the tubes burn
          if (m.emissive && (m.emissiveMap || m.emissive.getHex() !== 0)) m.emissiveIntensity = 2.4;
        });
      });
      const box = new THREE.Box3().setFromObject(root);
      cache[key] = {
        root,
        size: box.getSize(new THREE.Vector3()),
        center: box.getCenter(new THREE.Vector3()),
      };
      resolve();
    }, undefined, (err) => {
      console.warn('[props] failed', key, err);
      resolve();
    });
  })));
}

export function hasProp(key) {
  return !!cache[key];
}

/** A clone of a real prop, scaled so its widest horizontal span is `width` metres. */
export function makeProp(key, { width, y = 0, rotationY = 0, castShadow = true } = {}) {
  const entry = cache[key];
  if (!entry) return new THREE.Group();
  const holder = new THREE.Group();
  const mesh = entry.root.clone(true);
  const s = width / Math.max(entry.size.x, entry.size.z);
  mesh.scale.setScalar(s);
  mesh.position.y = -entry.center.y * s + (entry.size.y * s) / 2;
  mesh.position.x = -entry.center.x * s;
  mesh.position.z = -entry.center.z * s;
  mesh.traverse((o) => {
    if (o.isMesh) o.castShadow = castShadow;
    o.userData.prop = key;
  });
  holder.add(mesh);
  holder.userData.prop = key;
  holder.position.y = y;
  holder.rotation.y = rotationY;
  return holder;
}

export function propSize(key) {
  return cache[key] ? cache[key].size.clone() : new THREE.Vector3(1, 1, 1);
}
