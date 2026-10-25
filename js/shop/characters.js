/* Characters — the rigged humans authored in Blender (tools/make_human.py).

   Before this module the people were JSON of capsules: a thigh that rotated
   about a fixed point, no knee, no spine, no weight shift. They read as
   mannequins because they were mannequins.

   Now: one skinned mesh, a 17-bone skeleton, two hand-keyed clips (Walk, Idle).
   One GLB is shared by everyone in the shop — each person clones it, and only
   the material colours differ, so six shoppers cost one geometry upload.
*/

import * as THREE from '../../vendor/three.module.js';
import { GLTFLoader } from '../../vendor/jsm/loaders/GLTFLoader.js';
import { clone as skeletonClone } from '../../vendor/jsm/utils/SkeletonUtils.js';

const MODELS = { plain: 'models/human.glb', scarf: 'models/human_scarf.glb' };

const cache = {};          // variant -> { scene, animations }
const loading = {};

export function preloadHuman(variant = 'plain') {
  if (cache[variant]) return Promise.resolve(cache[variant]);
  if (loading[variant]) return loading[variant];
  loading[variant] = new Promise((resolve) => {
    new GLTFLoader().load(
      MODELS[variant] || MODELS.plain,
      (gltf) => {
        gltf.scene.traverse((o) => {
          if (!o.isMesh) return;
          o.castShadow = true;
          o.receiveShadow = true;
          o.frustumCulled = false;      // skinned bounds are wrong when animating
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => {
            m.envMapIntensity = 0.75;
            if (m.name === 'Skin') { m.roughness = 0.58; m.metalness = 0; }
            if (m.name === 'Shirt') { m.roughness = 0.82; }
            if (m.name === 'Trousers') { m.roughness = 0.9; }
            if (m.name === 'Shoes') { m.roughness = 0.4; m.metalness = 0.08; }
            if (m.name === 'Hair') { m.roughness = 0.55; }
          });
          o.castShadow = true;
        });
        const asset = { scene: gltf.scene, animations: gltf.animations || [] };
        cache[variant] = asset;
        resolve(asset);
      },
      undefined,
      (err) => {
        console.warn('[characters] human model failed to load', variant, err);
        resolve(null);
      }
    );
  });
  return loading[variant];
}

const SKIN = ['#d8a37a', '#c68d63', '#b57a4e', '#a26a42', '#e0b48e'];
const HAIR = ['#141110', '#1f1917', '#2a1f18', '#0f0d0c'];

/**
 * One shopper. Returns a group with the same API the shop already used:
 *   group.userData.animate(t, moving)   t in seconds, moving 0..1
 */
export function makeCharacter(opts = {}) {
  const {
    shirt = '#2f6f8f',
    trousers = '#2b3038',
    skin = SKIN[0],
    hair = HAIR[0],
    shoes = '#22262b',
    apron = null,
    height = 1.72,
    seed = 0,
    scarf = null,          // hijab / dupatta colour
    tunic = null,          // truthy → long kameez; a colour string sets its colour
  } = opts;

  const group = new THREE.Group();
  group.userData.pending = true;

  let mixer = null;
  let walkAction = null;
  let idleAction = null;
  let ready = false;
  let lastT = null;
  let currentMoving = 0;

  const paint = (root) => {
    root.traverse((o) => {
      if (!o.isMesh) return;
      const source = Array.isArray(o.material) ? o.material : [o.material];
      const painted = source.map((m) => {
        const c = m.clone();
        switch (m.name) {
          case 'Skin': c.color.set(skin); break;
          case 'Shirt': c.color.set(shirt); break;
          case 'Trousers': c.color.set(trousers); break;
          case 'Hair': c.color.set(hair); break;
          case 'Shoes': c.color.set(shoes); break;
          case 'Scarf': if (scarf) c.color.set(scarf); break;
          default: break;
        }
        return c;
      });
      o.material = Array.isArray(o.material) ? painted : painted[0];
    });
  };

  preloadHuman(scarf ? 'scarf' : 'plain').then((asset) => {
    if (!asset) return;
    const model = skeletonClone(asset.scene);
    paint(model);
    model.scale.setScalar(height / 1.72);
    group.add(model);
    group.userData.pending = false;
    group.userData.model = model;

    // a staff apron hangs off the chest bone, so it moves with the body
    if (apron) {
      const chest = model.getObjectByName('chest');
      const apronMat = new THREE.MeshStandardMaterial({ color: apron, roughness: 0.9 });
      const bib = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.40, 0.035), apronMat);
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.05), apronMat);
      bib.castShadow = true;
      skirt.castShadow = true;
      if (chest) {
        // chest bone runs along its own Y; place the apron in front of the torso
        bib.position.set(0, 0.16, -0.12);
        bib.rotation.x = Math.PI / 2;
        skirt.position.set(0, -0.06, -0.10);
        skirt.rotation.x = Math.PI / 2;
        chest.add(bib, skirt);
      } else {
        bib.position.set(0, 1.2, 0.13);
        skirt.position.set(0, 0.98, 0.12);
        group.add(bib, skirt);
      }
    }

    // a kameez: a long skirt over the hips, so not everyone wears a tucked shirt
    if (tunic) {
      const hipsBone = model.getObjectByName('hips');
      // open-ended cylinder: without DoubleSide you see straight through the
      // garment from behind and it reads as a fin
      const tm = new THREE.MeshStandardMaterial({
        color: typeof tunic === 'string' ? tunic : shirt, roughness: 0.88, side: THREE.DoubleSide,
      });
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.152, 0.178, 0.42, 18, 1, true), tm);
      skirt.position.set(0, -0.175, 0);
      skirt.castShadow = true;
      if (hipsBone) hipsBone.add(skirt); else model.add(skirt);
    }

    if (asset.animations.length) {
      mixer = new THREE.AnimationMixer(model);
      asset.animations.forEach((clip) => {
        const action = mixer.clipAction(clip);
        const name = clip.name.toLowerCase();
        if (name.includes('walk')) {
          walkAction = action;
          action.play();
          action.setEffectiveWeight(0);
        } else if (name.includes('idle')) {
          idleAction = action;
          action.play();
          action.setEffectiveWeight(1);
        }
      });
      // offset each person in the cycle so they do not march in lockstep
      if (walkAction) walkAction.time = (seed * 0.37) % 1.0;
      if (idleAction) idleAction.time = (seed * 0.53) % 2.0;
      mixer.update(0);
    }
    ready = true;
    group.userData.ready = true;
  });

  group.userData.animate = (t, moving = 0) => {
    if (!ready) return;
    const dt = lastT === null ? 1 / 60 : Math.min(0.1, Math.max(0.001, t - lastT));
    lastT = t;
    currentMoving = currentMoving + (moving - currentMoving) * Math.min(1, dt * 6);

    if (walkAction && idleAction) {
      walkAction.setEffectiveWeight(currentMoving);
      idleAction.setEffectiveWeight(1 - currentMoving);
      // a walking person's stride should match how fast they are actually going
      walkAction.setEffectiveTimeScale(0.75 + currentMoving * 0.55);
      idleAction.setEffectiveTimeScale(1);
    } else if (walkAction) {
      walkAction.setEffectiveWeight(1);
    }
    if (mixer) mixer.update(dt);
  };

  group.userData.height = height;
  return group;
}
