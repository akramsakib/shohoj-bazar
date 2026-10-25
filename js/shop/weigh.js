/* The weigh & pack counter — the loose-grain end of the rice aisle.

   In a real Bangladeshi super shop this is the busiest few metres in the
   department: glass-fronted bins of loose rice, dal and atta, a digital scale, a
   scoop in every bin, paper bags, and an attendant who weighs what you point at.
   The aisle used to end in two bare cream boxes, which read as unfinished from ten
   metres away.

   Everything is measured in metres against the shop's own counter heights (the
   checkout counter top is 0.92), so it sits in the same world as the till.
*/

import * as THREE from '../../vendor/three.module.js';

/* A heap of grain: a dot pattern on a dome, tinted per bin. It is a texture trick,
   not geometry — 20k grains would be absurd for something seen through glass from
   a metre away. */
function grainTexture(hex, dot) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = hex;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    g.fillStyle = dot;
    g.globalAlpha = 0.25 + Math.random() * 0.5;
    g.beginPath();
    g.ellipse(x, y, 2.6, 1.3, Math.random() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  return t;
}

function labelTexture(line1, line2, bg, fg = '#ffffff') {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 256);
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '800 92px Inter, Arial, sans-serif';
  g.fillText(line1, 256, 96);
  g.font = '600 60px "Noto Sans Bengali", "Hind Siliguri", sans-serif';
  g.fillText(line2, 256, 182);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function buildWeighCounter(z, opts = {}) {
  const {
    accent = '#0d6138',
    bins = [
      { name: 'Miniket', bn: 'মিনিকেট', colour: '#efe6cf', dot: '#ffffff', price: '৳76/kg' },
      { name: 'Nazirshail', bn: 'নাজিরশাইল', colour: '#f2ead6', dot: '#fffdf4', price: '৳86/kg' },
      { name: 'Mung Dal', bn: 'মুগ ডাল', colour: '#d8b23c', dot: '#f0d67a', price: '৳142/kg' },
      { name: 'Atta', bn: 'আটা', colour: '#e6dcc4', dot: '#f6f0e2', price: '৳62/kg' },
    ],
  } = opts;

  const g = new THREE.Group();
  g.position.set(0, 0, z);
  g.name = 'weigh-counter';

  const steel = new THREE.MeshStandardMaterial({ color: '#c6ccd1', roughness: 0.34, metalness: 0.62, envMapIntensity: 1.3 });
  const clad = new THREE.MeshStandardMaterial({ color: '#e9e2d1', roughness: 0.72 });
  const band = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5, metalness: 0.06 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: '#dfeaf0', roughness: 0.06, metalness: 0, transparent: true,
    opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.6,
  });

  const W = 3.6;
  const TOP = 0.92;

  /* ---- counter body ---- */
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, TOP, 0.86), clad);
  body.position.y = TOP / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  // a steel kick plate, because every real counter is scuffed at the bottom
  const kick = new THREE.Mesh(new THREE.BoxGeometry(W + 0.01, 0.16, 0.02), steel);
  kick.position.set(0, 0.08, 0.435);
  g.add(kick);

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(W + 0.01, 0.13, 0.02), band);
  stripe.position.set(0, 0.30, 0.436);
  g.add(stripe);

  /* ---- stainless worktop ---- */
  const top = new THREE.Mesh(new THREE.BoxGeometry(W + 0.12, 0.05, 0.96), steel);
  top.position.set(0, TOP + 0.025, 0);
  top.castShadow = true;
  top.receiveShadow = true;
  g.add(top);

  /* ---- the grain bins, set back on a riser ---- */
  const riser = new THREE.Mesh(new THREE.BoxGeometry(W - 0.1, 0.30, 0.42), clad);
  riser.position.set(0, TOP + 0.20, -0.26);
  riser.castShadow = true;
  riser.receiveShadow = true;
  g.add(riser);

  const binGeo = new THREE.CylinderGeometry(0.235, 0.20, 0.46, 22, 1, true);
  const pileGeo = new THREE.SphereGeometry(0.205, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  bins.forEach((b, i) => {
    const x = -1.28 + i * 0.85;
    const yBase = TOP + 0.35;

    const pile = new THREE.Mesh(pileGeo, new THREE.MeshStandardMaterial({
      map: grainTexture(b.colour, b.dot), roughness: 0.92, metalness: 0, envMapIntensity: 0.7,
    }));
    pile.scale.set(1, 0.62, 1);
    pile.position.set(x, yBase + 0.04, -0.26);
    pile.castShadow = true;
    g.add(pile);

    const jar = new THREE.Mesh(binGeo, glass);
    jar.position.set(x, yBase + 0.23, -0.26);
    jar.renderOrder = 4;
    g.add(jar);

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.012, 8, 26), steel);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(x, yBase + 0.46, -0.26);
    g.add(collar);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.011, 8, 26), steel);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, yBase + 0.005, -0.26);
    g.add(ring);

    // a scoop leaning in the grain
    const scoop = new THREE.Group();
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.048, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), steel);
    bowl.rotation.x = Math.PI;
    scoop.add(bowl);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.009, 0.20, 8), steel);
    handle.position.set(0, 0.10, 0.02);
    handle.rotation.x = -0.22;
    scoop.add(handle);
    scoop.position.set(x + 0.05, yBase + 0.145, -0.20);
    scoop.rotation.z = -0.35;
    scoop.rotation.y = i % 2 ? 0.7 : -0.5;
    g.add(scoop);

    const card = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.20),
      new THREE.MeshBasicMaterial({ map: labelTexture(b.name, b.bn, accent) })
    );
    card.position.set(x, TOP + 0.19, -0.045);
    g.add(card);

    const price = new THREE.Mesh(
      new THREE.PlaneGeometry(0.26, 0.09),
      new THREE.MeshBasicMaterial({ map: labelTexture(b.price, 'কেজি', '#f4efe2', '#1d3b2a') })
    );
    price.position.set(x, TOP + 0.055, -0.04);
    g.add(price);
  });

  /* ---- the scale: platform, column and a lit display ---- */
  const scale = new THREE.Group();
  const pan = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.035, 0.34), steel);
  pan.position.set(0, 0.018, 0);
  scale.add(pan);
  const column = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.24, 0.05), steel);
  column.position.set(0, 0.14, -0.13);
  scale.add(column);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.13, 0.06), new THREE.MeshStandardMaterial({ color: '#22282c', roughness: 0.6, metalness: 0.2 }));
  head.position.set(0, 0.27, -0.115);
  head.rotation.x = -0.28;
  scale.add(head);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.23, 0.075),
    new THREE.MeshBasicMaterial({ map: labelTexture('0.000 kg', '৳ 0.00', '#0d1f16', '#5cf2a0'), toneMapped: false })
  );
  screen.position.set(0, 0.272, -0.083);
  screen.rotation.x = -0.28;
  scale.add(screen);
  scale.position.set(0.95, TOP + 0.05, 0.16);
  g.add(scale);

  /* ---- paper bags, stacked and ready ---- */
  const paper = new THREE.MeshStandardMaterial({ color: '#d9c8a4', roughness: 0.9, side: THREE.DoubleSide });
  for (let i = 0; i < 5; i++) {
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.30, 0.02), paper);
    bag.position.set(-1.42 + i * 0.012, TOP + 0.20, 0.20 - i * 0.022);
    bag.rotation.z = 0.04 + i * 0.012;
    bag.rotation.y = -1.35;
    bag.castShadow = true;
    g.add(bag);
  }

  /* ---- the token dispenser at the end of the counter ---- */
  const token = new THREE.Group();
  const tbox = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.28, 0.16), new THREE.MeshStandardMaterial({ color: '#1f4a34', roughness: 0.55 }));
  tbox.position.y = 0.14;
  token.add(tbox);
  const tlabel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.18, 0.09),
    new THREE.MeshBasicMaterial({ map: labelTexture('টোকেন', 'Take a token', '#f4efe2', '#1f4a34') })
  );
  tlabel.position.set(0, 0.20, 0.081);
  token.add(tlabel);
  token.position.set(1.48, TOP + 0.05, 0.20);
  g.add(token);

  /* ---- overhead sign on two rods ---- */
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 0.40),
    new THREE.MeshBasicMaterial({ map: labelTexture('WEIGH & PACK', 'ওজন করে প্যাক করুন', accent), side: THREE.DoubleSide })
  );
  sign.position.set(0, 2.34, -0.30);
  g.add(sign);
  [-0.86, 0.86].forEach((x) => {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.62, 6), steel);
    rod.position.set(x, 2.74, -0.30);
    g.add(rod);
  });

  /* ---- the floor mat where you queue to be weighed ---- */
  const mat = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 1.1),
    new THREE.MeshStandardMaterial({ color: '#1f4a34', roughness: 0.95 })
  );
  mat.rotation.x = -Math.PI / 2;
  mat.position.set(0, 0.012, 1.15);
  mat.receiveShadow = true;
  g.add(mat);

  return g;
}
