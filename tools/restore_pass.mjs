/* Restore the asset pass across scene.js.

   Idempotent: every edit checks whether it is already present, so this can be
   run any number of times. Written because the workspace rolled back twice and
   took an afternoon of hand edits with it — the point is that one command puts
   them all back.
*/
import fs from 'node:fs';

const P = new URL('../js/shop/scene.js', import.meta.url).pathname;
let s = fs.readFileSync(P, 'utf8');
let applied = 0, skipped = 0;

const sub = (marker, oldStr, newStr) => {
  if (s.includes(marker)) { skipped++; return; }
  if (!s.includes(oldStr)) { console.log('MISS:', oldStr.split('\n')[0].slice(0, 90)); return; }
  s = s.replace(oldStr, newStr);
  applied++;
};

/* ---------------- imports ---------------- */
sub("import { makeProp", "import { buildLighting } from './lighting.js';",
`import { buildLighting } from './lighting.js';
import { HDRLoader } from '../../vendor/jsm/loaders/HDRLoader.js';
import { makeProp, hasProp } from './props.js';
import { stockBay } from './stocking.js';
import { buildWeighCounter } from './weigh.js';`);

/* ---------------- department available at build time ---------------- */
sub("this.dept = department;", `    this.initRenderer();
    this.initScene();
    this.buildStreet();
    this.buildInterior();`,
`    this.department = department;
    this.dept = department;      // the entrance displays are dressed with real stock
    this.initRenderer();
    this.initScene();
    this.buildStreet();
    this.buildInterior();`);

/* ---------------- haze for aerial perspective ---------------- */
sub("FogExp2('#e2d7c2'", "this.scene.background = new THREE.Color('#171a17');",
`this.scene.background = new THREE.Color('#171a17');
    // a whisper of haze: distant shelving softens, near shelving stays crisp.
    // Without it every surface in a 35 m run is equally sharp.
    this.scene.fog = new THREE.FogExp2('#e2d7c2', 0.013);`);

/* ---------------- captured HDR probe ---------------- */
sub("HDRLoader().load(", `    new THREE.TextureLoader().load('hdri/gear_store_1024.jpg', (hdr) => {
      hdr.mapping = THREE.EquirectangularReflectionMapping;
      hdr.colorSpace = THREE.SRGBColorSpace;
      this.scene.environment = pmrem.fromEquirectangular(hdr).texture;
      this.scene.environmentIntensity = 0.9;   // LDR probe needs a lift
      hdr.dispose();
      pmrem.dispose();
    }, undefined, () => { pmrem.dispose(); });`,
`    /* Real captured environment: a 1k HDR probe of an industrial interior
       (Poly Haven, CC0). Real lamps at real intensities, real bounce, so metal has
       something to reflect and packaging has something to pick up. */
    new HDRLoader().load('hdri/warehouse_1k.hdr', (hdr) => {
      hdr.mapping = THREE.EquirectangularReflectionMapping;
      this.scene.environment = pmrem.fromEquirectangular(hdr).texture;
      this.scene.environmentIntensity = 1.15;
      this.hdrLoaded = true;
      hdr.dispose();
      pmrem.dispose();
    }, undefined, () => {
      new THREE.TextureLoader().load('hdri/gear_store_1024.jpg', (jpg) => {
        jpg.mapping = THREE.EquirectangularReflectionMapping;
        jpg.colorSpace = THREE.SRGBColorSpace;
        this.scene.environment = pmrem.fromEquirectangular(jpg).texture;
        this.scene.environmentIntensity = 0.9;
        jpg.dispose();
        pmrem.dispose();
      }, undefined, () => pmrem.dispose());
    });`);

/* ---------------- scanned ceiling fittings ---------------- */
sub("makeProp('batten'", `      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.10, 1.9), housingMat);
      housing.position.set(0, 3.30, z);
      aisle.add(housing);`,
`      if (hasProp('batten')) {
        // a scanned double-tube batten: real reflector geometry and end caps
        const batten = makeProp('batten', { width: 1.9, rotationY: Math.PI / 2, castShadow: false });
        batten.position.set(0, 3.12, z);
        aisle.add(batten);
      } else {
        const housing = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.10, 1.9), housingMat);
        housing.position.set(0, 3.30, z);
        aisle.add(housing);
      }`);

/* ---------------- scanned overstock cartons ---------------- */
{
  const start = s.indexOf('    /* ---- overstock cartons on the gondola tops ---- */');
  const end = s.indexOf('      // a low header board capping the gondola, like the colour-coded run ends');
  if (start !== -1 && end !== -1) {
    s = s.slice(0, start) + `    /* ---- overstock on the gondola tops: scanned cartons, not boxes I typed ---- */
    const gondolaTop = BASE_Y + LEVELS * LEVEL_H + 0.06;
    (this.bayGroups || []).forEach((group) => {
      const { side, bay } = group.userData;
      const bayCentre = AISLE_START_Z - BAY_W / 2 - bay * BAY_W;
      const count = 3 + Math.round(Math.abs(Math.sin(bay * 3.7 + side)) * 3);
      for (let i = 0; i < count; i++) {
        const w = 0.36 + ((i * 37) % 5) * 0.035;
        const col = i % 2;
        const carton = makeProp('carton', {
          width: w,
          rotationY: Math.sin(bay * 5 + i * 1.7) * 0.12 + (side > 0 ? 0 : Math.PI),
        });
        carton.position.set(
          side * (SHELF_X - 0.34 - col * 0.16),
          gondolaTop + (i > 3 ? 0.26 : 0),
          bayCentre + (i - count / 2) * 0.56 + Math.sin(i * 2.1) * 0.05
        );
        aisle.add(carton);
      }
` + s.slice(end);
    applied++;
  } else if (!s.includes("makeProp('carton'")) {
    console.log('MISS: overstock block');
  } else { skipped++; }
}

/* ---------------- stocking: planogram replaces the spaced-out loop ---------------- */
{
  const hasPlanogram = s.includes('stockBay({');
  if (!hasPlanogram) {
    const start = s.indexOf('    /* ---- stock the shelves ---- */');
    const end = s.indexOf('    /* ---- bulk display at the aisle mouth ---- */');
    if (start !== -1 && end !== -1) {
      s = s.slice(0, start) + `    /* ---- stock the shelves (planogram, see js/shop/stocking.js) ---- */
    const bySection = {};
    dept.products.forEach((p) => { (bySection[p.section] = bySection[p.section] || []).push(p); });

    const talkerMap = {};
    (dept.talkers || []).forEach((t) => { talkerMap[t.productId] = t.text; });

    (this.bayGroups || []).forEach((group) => {
      const { side, bay, section, BAY_W: BW, LEVELS: LV, LEVEL_H: LH, BASE_Y: BY } = group.userData;
      const pool = bySection[section ? section.id : dept.sections?.[0]?.id] || dept.products;

      const plan = stockBay({
        products: pool,
        bayWidth: BW,
        levels: LV,
        levelH: LH,
        baseY: BY,
        seed: bay * 17 + (side > 0 ? 5 : 1) + 1,
        footprint: packFootprint,
        maxDepth: this.tier === 'low' ? 1 : 2,
        endGap: 0.12,
        startGap: 0.08,
      });

      const labelled = new Map();
      plan.forEach((slot) => {
        const { product, level, row, z, y, size } = slot;
        // local +x is into the shelf; the aisle is at -side * x
        const localX = -side * (0.255 - size.d / 2 - slot.back) + side * slot.shoved;
        slots.push({
          product,
          position: new THREE.Vector3(group.position.x + localX, y, group.position.z + z),
          rotation: new THREE.Euler(
            0,
            (side < 0 ? Math.PI / 2 : -Math.PI / 2) + slot.lean,
            slot.shoved * 1.4
          ),
          size,
          shadow: level === 0 && row === 0,
        });

        if (row === 0 && level <= 2) {
          const key = \`\${product.id}:\${level}:\${Math.round(z * 4)}\`;
          if (!labelled.has(key)) {
            labelled.set(key, true);
            const tag = priceTag(product);
            tag.position.set(group.position.x - side * 0.285, y - size.h / 2 + 0.021, group.position.z + z);
            tag.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
            aisle.add(tag);
          }
        }

        const talkerText = talkerMap[product.id];
        if (talkerText && level === 1 && row === 0 && !talkerMap[\`_used\${product.id}\`]) {
          talkerMap[\`_used\${product.id}\`] = true;
          const t = shelfTalker(product, talkerText);
          t.position.set(side * (SHELF_X - 0.34), BY + level * LH + 0.20, group.position.z + z);
          t.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
          aisle.add(t);
        }
      });
    });

` + s.slice(end);
      applied++;
    } else {
      console.log('MISS: shelf stocking block');
    }
  } else { skipped++; }
}

/* ---------------- weigh & pack counter replaces the bare endcap ---------------- */
sub('buildWeighCounter(AISLE_END_Z', `    if (dept.layout.endcap === 'weigh-counter') {
      const counter = new THREE.Group();`,
`    if (dept.layout.endcap === 'weigh-counter') {
      this.weighCounter = buildWeighCounter(AISLE_END_Z + 1.35, { accent: dept.accent || '#0d6138' });
      aisle.add(this.weighCounter);
    }
    if (false) {
      const counter = new THREE.Group();`);

/* drop the placeholder endcap box that hid the counter */
sub('endcap.position.set(0, 0.8, AISLE_END_Z + 0.55)', `    const endcap = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 1.6, 0.7),
      new THREE.MeshStandardMaterial({ color: '#f2ede0', roughness: 0.8 })
    );
    // the end-of-aisle display used to sit 0.6 m PAST the aisle end — i.e. in the
    // middle of the checkout hall, right where the shopper stands to pay
    endcap.position.set(0, 0.8, AISLE_END_Z + 0.55);
    aisle.add(endcap);`, '    // (the placeholder endcap box is gone: the weigh counter stands here now)');

/* ---------------- shoppers inside the run, in run coordinates ---------------- */
{
  const start = s.indexOf('    const cast = [');
  const end = s.indexOf('    // one of ours on the floor, standing at the weigh counter with an apron on');
  if (start !== -1 && end !== -1 && !s.includes('const runLo = AISLE_END_Z')) {
    s = s.slice(0, start) + `    // Everyone is placed and clamped INSIDE the run. The old table had three
    // shoppers starting past the end of the shelving, which stranded them in the
    // checkout hall leaning mid-stride.
    const runLo = AISLE_END_Z + 2.4;
    const runHi = AISLE_START_Z - 2.0;
    const cast = [
      { x: -1.42, z: -13.2, speed: 0.46, dir: -1, opts: { variant: 'casual_female', shirt: '#3d6b78', trousers: '#2b3038', height: 1.62 } },
      { x: 1.26, z: -17.6, speed: 0.62, dir: 1, opts: { variant: 'casual_male', shirt: '#d9d3c4', trousers: '#3a3f46', height: 1.71 } },
      { x: -1.40, z: -21.4, speed: 0.42, dir: 1, opts: { variant: 'kimono', height: 1.66 } },
      { x: 1.24, z: -25.2, speed: 0.55, dir: -1, opts: { variant: 'casual_male', shirt: '#8a5a2b', trousers: '#2b3038', height: 1.75 } },
      { x: -1.46, z: -26.4, speed: 0.50, dir: 1, opts: { variant: 'scarf', tunic: '#6f5a78', trousers: '#33383f', scarf: '#d8c390', height: 1.58 } },
    ];
    cast.forEach((c) => {
      const person = buildPerson(c.opts);
      const z0 = Math.min(runHi, Math.max(runLo, c.z));
      person.position.set(c.x, 0, z0);
      person.rotation.y = c.dir > 0 ? 0 : Math.PI;
      aisle.add(person);
      this.people.push({
        group: person, x: c.x, z: z0, speed: c.speed, dir: c.dir, person,
        lo: Math.max(runLo, z0 - 3.2),
        hi: Math.min(runHi, z0 + 3.2),
      });
    });
` + s.slice(end);
    applied++;
  } else { skipped++; }
}

/* the weigh attendant stands BEHIND his counter */
sub("staffer.position.set(-1.05, 0, AISLE_END_Z - 0.05);",
`    const staffer = buildPerson({ shirt: '#f4f1e8', trousers: '#22262b', apron: '#0d6138', height: 1.64, build: 'slim' });
    staffer.position.set(-0.55, 0, AISLE_END_Z + 2.1);
    staffer.rotation.y = Math.PI * 0.94;`,
`    // the attendant belongs BEHIND his own counter, facing the shopper — he used
    // to stand in front of it, in the customer's way
    const staffer = buildPerson({ shirt: '#f4f1e8', trousers: '#22262b', apron: '#0d6138', height: 1.64 });
    staffer.position.set(-1.05, 0, AISLE_END_Z - 0.05);
    staffer.rotation.y = Math.PI;`);

sub("x: -1.05, z: AISLE_END_Z - 0.05, speed: 0, dir: 1",
  "this.people.push({ group: staffer, x: -0.55, z: AISLE_END_Z + 2.1, speed: 0, dir: 1, person: staffer });",
  "this.people.push({ group: staffer, x: -1.05, z: AISLE_END_Z - 0.05, speed: 0, dir: 1, person: staffer });");

/* ---------------- brighter checkout hall ---------------- */
sub("#f7f4ec", "new THREE.MeshStandardMaterial({ color: '#f1ebdc', roughness: 0.92 })",
  "new THREE.MeshStandardMaterial({ color: '#f7f4ec', roughness: 0.9 })");
sub("#f2f4f0", "new THREE.MeshStandardMaterial({ color: '#d3dbd2', roughness: 0.95 })",
  "new THREE.MeshStandardMaterial({ color: '#f2f4f0', roughness: 0.95 })");
sub("#f1f2ec", "new THREE.MeshStandardMaterial({ color: '#e4ddcb', roughness: 0.95 })",
  "new THREE.MeshStandardMaterial({ color: '#f1f2ec', roughness: 0.95 })");

/* hall lamps: scanned fittings + halos */
sub("hallHalo", `    for (let i = 0; i < 2; i++) {
      const housing = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.09, 0.30), new THREE.MeshStandardMaterial({ color: '#d9dbd4', roughness: 0.5, metalness: 0.4 }));
      housing.position.set(0, 3.24, CZ - 1.5 - i * 2.4);
      aisle.add(housing);
      const tube = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.20), new THREE.MeshBasicMaterial({ color: '#fffdf4' }));
      tube.rotation.x = Math.PI / 2;
      tube.position.set(0, 3.19, CZ - 1.5 - i * 2.4);
      aisle.add(tube);
    }`,
`    const hallHalo = new THREE.MeshBasicMaterial({
      map: glowTexture(), transparent: true, opacity: 0.45, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false,
    });
    for (let i = 0; i < 3; i++) {
      const hz = CZ + 0.8 - i * 2.6;
      if (hasProp('batten')) {
        const batten = makeProp('batten', { width: 2.3, rotationY: Math.PI / 2, castShadow: false });
        batten.position.set(0, 3.20, hz);
        aisle.add(batten);
      }
      const tube = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.22), new THREE.MeshBasicMaterial({ color: '#fffdf4', toneMapped: false }));
      tube.rotation.x = Math.PI / 2;
      tube.position.set(0, 3.13, hz);
      aisle.add(tube);
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.8), hallHalo);
      halo.rotation.x = Math.PI / 2;
      halo.position.set(0, 3.10, hz);
      halo.renderOrder = 2;
      aisle.add(halo);
    }`);

/* ---------------- queue + back-of-house props beside the lane ---------------- */
sub("queuePeople", `    this.checkout = buildCheckoutLane(CZ, 0);
    aisle.add(this.checkout.group);`,
`    this.checkout = buildCheckoutLane(CZ, 0);
    aisle.add(this.checkout.group);

    /* ---- the queue ---- Two shoppers stood on the rail side of the lane, feet
       pinned, facing the till, so nobody hovers behind the counter. */
    this.queuePeople = [
      { x: -1.18, z: CZ + 3.05, opts: { variant: 'casual_male', shirt: '#7a4b32', trousers: '#2b3038', height: 1.63 } },
      { x: -1.04, z: CZ + 4.15, opts: { variant: 'casual_female', shirt: '#4a5f74', trousers: '#33383f', height: 1.70 } },
    ].map((q, i) => {
      const person = buildPerson(q.opts);
      person.position.set(q.x, 0, q.z);
      person.rotation.y = Math.PI * 0.94;
      aisle.add(person);
      return { person, x: q.x, z: q.z, phase: i * 2.3 };
    });

    /* ---- back-of-house props: a stock cage and a couple of 25 kg sacks ---- */
    if (hasProp('cart')) {
      const cart = makeProp('cart', { width: 1.15, rotationY: -Math.PI / 2 });
      cart.position.set(2.42, 0, CZ - 3.9);
      aisle.add(cart);
    }
    if (hasProp('bag')) {
      [[-2.42, CZ - 3.55, 0.15, 0], [-2.30, CZ - 4.05, -0.4, 0.15]].forEach(([bx, bz, ry, by]) => {
        const sack = makeProp('bag', { width: 0.62, rotationY: ry });
        sack.position.set(bx, by, bz);
        aisle.add(sack);
      });
    }`);

sub("this.queuePeople.forEach", "      // the cashier stands at the till: idle breathing, occasional glance",
`      if (this.queuePeople) {
        this.queuePeople.forEach((q) => {
          if (q.person.userData.animate) q.person.userData.animate(now * 0.5 + q.phase, 0);
        });
      }
      // the cashier stands at the till: idle breathing, occasional glance`);

/* ---------------- entrance displays dressed with real stock ---------------- */
sub("dressOnly", `      unit.position.set(gx, 0, gz);
      g.add(unit);
    });`,
`      // a bare cream box reads as a placeholder, so the display is dressed with
      // this department's own packs, on the deck and on a shelf lip above it
      [[1.31, 0.08], [1.74, -0.02]].forEach(([yy, zz], row) => {
        for (let k = 0; k < 4; k++) {
          const pick = this.department.products[(row * 9 + k * 5 + i * 3) % this.department.products.length];
          const pack = buildProduct(pick, { shadow: true });
          pack.scale.setScalar(0.62);
          pack.position.set(gx - 0.45 + k * 0.30, yy, gz + zz);
          pack.rotation.y = Math.PI + (row - 0.5) * 0.06;
          pack.userData.dressOnly = true;
          unit.add(pack);
        }
      });
      const lip = new THREE.Mesh(
        new THREE.BoxGeometry(1.36, 0.035, 0.5),
        new THREE.MeshStandardMaterial({ color: '#e7dfcd', roughness: 0.7 })
      );
      lip.position.set(gx, 1.70, gz - 0.02);
      unit.add(lip);
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(1.1, 0.5),
        new THREE.MeshStandardMaterial({ map: signTexture('OFFER', 'অফার · আজকের দাম', '#c1121f'), roughness: 0.8 })
      );
      face.position.set(gx, 0.72, gz + 0.32);
      unit.add(face);
      unit.position.set(gx, 0, gz);
      g.add(unit);
    });`);

/* ---------------- trolley: chrome, pushed further ahead ---------------- */
sub("Math.max(m.metalness, 0.82)", `        if (m.metalness !== undefined) { m.metalness = Math.min(m.metalness, 0.62); }
        if (m.roughness !== undefined) { m.roughness = Math.max(m.roughness, 0.34); }
        m.envMapIntensity = 0.55;`,
`        // with a captured HDR probe in the scene the wire can finally read as
        // chrome instead of white spray paint
        if (m.metalness !== undefined) m.metalness = Math.min(Math.max(m.metalness, 0.82), 0.95);
        if (m.roughness !== undefined) m.roughness = Math.min(Math.max(m.roughness, 0.20), 0.34);
        m.envMapIntensity = 1.35;`);

sub("this.portrait ? 1.55 : 2.02", "const target = cam.position.clone().addScaledVector(body, this.portrait ? 1.45 : 1.72);",
  "const target = cam.position.clone().addScaledVector(body, this.portrait ? 1.55 : 2.02);");
sub("this.camera.position.y = 1.62 + bob;", "this.camera.position.y = 1.52 + bob;",
  "this.camera.position.y = 1.62 + bob;");

/* ---------------- camera vantages ---------------- */
sub("-0.62, 1.60, (this.checkoutZ || -30) + 2.15",
  "checkout: { pos: new THREE.Vector3(0.40, 1.66, (this.checkoutZ || -30) + 3.6), look: new THREE.Vector3(0.55, 1.02, (this.checkoutZ || -30) + 0.1) },",
  "checkout: { pos: new THREE.Vector3(-0.62, 1.60, (this.checkoutZ || -30) + 2.15), look: new THREE.Vector3(1.05, 1.05, (this.checkoutZ || -30) - 0.05) },");

/* ---------------- the walk must reach the end of the aisle ---------------- */
sub("this.walkMin = AISLE_END_Z + 1.15;",
`    this.walkMin = AISLE_END_Z + 2.6;
    this.walkMax = AISLE_START_Z + 1.2;`,
`    // You have to be able to stand IN FRONT of the weigh counter and of the last
    // bay of shelving. The old clamp stopped the shopper 2.6 m short of the end,
    // leaving the last 5 m of shelf and the whole loose-grain counter unreachable.
    this.walkMin = AISLE_END_Z + 1.15;
    this.walkMax = AISLE_START_Z + 1.2;`);

/* ---------------- collision follows the counter to its new position ---------------- */
sub("x: 1.86, y: 0.5, z: 0.5", "P.addBox({ x: 2.1, y: 0.8, z: 0.35 }, { x: 0, y: 0.8, z: AISLE_END_Z + 0.55 });",
  "P.addBox({ x: 1.86, y: 0.5, z: 0.5 }, { x: 0, y: 0.5, z: AISLE_END_Z + 1.35 });");

/* ---------------- grade: a touch more contrast now the room is lit ---------------- */
sub("uContrast: { value: 0.22 }", "uContrast: { value: 0.16 },", "uContrast: { value: 0.22 },");
sub("uVignette: { value: 0.22 }", "uVignette: { value: 0.16 },", "uVignette: { value: 0.22 },");

fs.writeFileSync(P, s);
console.log(`scene.js: ${applied} applied, ${skipped} already present`);
