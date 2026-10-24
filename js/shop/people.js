/* ------------------------------------------------------------------------
   People — shoppers and staff built from primitives, animated in place.
   A supermarket with nobody in it reads as a showroom, so these matter more
   than any amount of shader work. Everything is low-poly but proportioned
   like a real person: 1.72 m tall, hips at 0.88, shoulders at 1.38.
   ---------------------------------------------------------------------- */
import * as THREE from '../../vendor/three.module.js';

const SKIN = ['#c98f63', '#b87a4f', '#d9a173', '#a96f45'];

function capsule(r, len, mat) {
  const g = new THREE.CapsuleGeometry(r, len, 6, 12);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  return m;
}

function cloth(colour, rough = 0.88) {
  return new THREE.MeshStandardMaterial({ color: colour, roughness: rough, metalness: 0 });
}

/* One person. Returns a group facing +z, with userData.animate(t, moving). */
export function buildPerson(opts = {}) {
  const {
    shirt = '#2f6f8f',
    trousers = '#2b3038',
    scarf = null,          // hijab / dupatta colour, or null
    skin = SKIN[0],
    apron = null,          // staff apron colour
    height = 1.72,
    build = 'adult',       // 'adult' | 'slim'
    tunic = null,          // kameez colour, longer than a shirt
  } = opts;

  const g = new THREE.Group();
  const k = height / 1.72;
  g.scale.setScalar(k);

  const skinMat = cloth(skin, 0.72);
  const shirtMat = cloth(shirt);
  const trouserMat = cloth(trousers, 0.92);
  const shoeMat = cloth('#22262b', 0.6);
  const hairMat = cloth('#1a1a1c', 0.75);

  const wide = build === 'slim' ? 0.86 : 1;

  /* ---- legs: pivot at the hip so they can swing ---- */
  const legs = [];
  [-1, 1].forEach((sx) => {
    const hip = new THREE.Group();
    hip.position.set(sx * 0.085 * wide, 0.88, 0);
    const thigh = capsule(0.078, 0.34, trouserMat);
    thigh.position.y = -0.20;
    const shin = capsule(0.060, 0.36, trouserMat);
    shin.position.y = -0.60;
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.075, 0.24), shoeMat);
    shoe.position.set(0, -0.845, 0.035);
    shoe.castShadow = true;
    hip.add(thigh, shin, shoe);
    g.add(hip);
    legs.push(hip);
  });

  /* ---- torso ---- */
  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.28 * wide, 0.20, 0.18), trouserMat);
  hips.position.y = 0.96;
  hips.castShadow = true;
  g.add(hips);

  const torso = capsule(0.155 * wide, 0.30, shirtMat);
  torso.position.y = 1.20;
  torso.scale.set(0.98, 1, 0.74);
  g.add(torso);

  // long tunic (kameez / kurta) — covers the hips and reads far better than a bare box
  if (tunic) {
    const tMat = cloth(tunic, 0.9);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.175 * wide, 0.225 * wide, 0.62, 18, 1, true), tMat);
    body.position.y = 1.07;
    body.castShadow = true;
    const hem = new THREE.Mesh(new THREE.RingGeometry(0.21 * wide, 0.235 * wide, 18), tMat);
    hem.rotation.x = Math.PI / 2;
    hem.position.y = 0.76;
    g.add(body, hem);
    torso.visible = false;
  }

  // collar / neckline
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.105, 0.07, 12), shirtMat);
  collar.position.y = 1.42;
  g.add(collar);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.052, 0.08, 10), skinMat);
  neck.position.y = 1.465;
  g.add(neck);

  /* ---- head ---- */
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.098, 16, 14), skinMat);
  head.position.y = 1.565;
  head.scale.set(0.94, 1.1, 1.0);
  head.castShadow = true;
  g.add(head);

  // eyes: two dots, but they stop the head reading as a mannequin up close
  [-1, 1].forEach((sx) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0125, 8, 6), cloth('#2a2320', 0.5));
    eye.position.set(sx * 0.034, 1.575, 0.088);
    g.add(eye);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.007, 0.008), hairMat);
    brow.position.set(sx * 0.034, 1.598, 0.088);
    g.add(brow);
  });
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.03, 8), skinMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 1.556, 0.094);
  g.add(nose);

  // hair or a headscarf, whichever this person wears
  if (scarf) {
    const wrap = new THREE.Mesh(new THREE.SphereGeometry(0.108, 16, 14), cloth(scarf, 0.95));
    wrap.position.set(0, 1.567, -0.008);
    wrap.scale.set(1.0, 1.12, 1.06);
    g.add(wrap);
    const drape = new THREE.Mesh(new THREE.BoxGeometry(0.175, 0.26, 0.10), cloth(scarf, 0.95));
    drape.position.set(0, 1.44, -0.062);
    drape.castShadow = true;
    g.add(drape);
  } else {
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.101, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), hairMat);
    hair.position.set(0, 1.572, -0.006);
    hair.scale.set(0.96, 1.05, 1.0);
    g.add(hair);
  }

  /* ---- arms: pivot at the shoulder ---- */
  const arms = [];
  [-1, 1].forEach((sx) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(sx * 0.205 * wide, 1.345, 0);
    const upper = capsule(0.050, 0.24, shirtMat);
    upper.position.y = -0.16;
    const fore = capsule(0.044, 0.22, shirtMat);
    fore.position.y = -0.47;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), skinMat);
    hand.position.y = -0.60;
    hand.scale.set(0.9, 1.1, 0.7);
    shoulder.add(upper, fore, hand);
    g.add(shoulder);
    arms.push(shoulder);
  });

  /* ---- staff apron ---- */
  if (apron) {
    const bib = new THREE.Mesh(new THREE.BoxGeometry(0.26 * wide, 0.44, 0.03), cloth(apron, 0.9));
    bib.position.set(0, 1.16, 0.115);
    g.add(bib);
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.30 * wide, 0.34, 0.05), cloth(apron, 0.9));
    skirt.position.set(0, 0.95, 0.10);
    g.add(skirt);
  }

  g.userData.animate = (t, moving = 0) => {
    const s = Math.sin(t * 5.4);
    const s2 = Math.cos(t * 5.4);
    legs[0].rotation.x = s * 0.42 * moving;
    legs[1].rotation.x = -s * 0.42 * moving;
    arms[0].rotation.x = -s2 * 0.30 * moving;
    arms[1].rotation.x = s2 * 0.30 * moving;
    // a body that walks, not a body that slides
    g.position.y = Math.abs(Math.sin(t * 5.4)) * 0.022 * moving;
    torso.rotation.z = Math.sin(t * 2.7) * 0.014 * moving;
    head.rotation.y = Math.sin(t * 0.7) * 0.16 * (1 - moving * 0.6);
  };

  g.userData.height = height;
  return g;
}

/* A shopper who walks the run from end to end and turns around at the walls. */
export function buildWalker(opts) {
  const person = buildPerson(opts);
  const group = new THREE.Group();
  group.add(person);
  return group;
}
