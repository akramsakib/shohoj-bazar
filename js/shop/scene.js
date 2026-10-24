/* The shop itself: street → entrance hall → aisle 1.
   One continuous WebGL scene. Camera "walks"; nothing reloads. */

import * as THREE from '../../vendor/three.module.js';
import { buildProduct, priceTag, shelfTalker, ensureBackTexture } from './assets.js';

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;

/* ------------------------------------------------------------------ floor */
function floorTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e9e2d4';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = `rgba(${150 + Math.random() * 60},${145 + Math.random() * 55},${130 + Math.random() * 50},.10)`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  ctx.strokeStyle = 'rgba(150,140,120,.42)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 512; i += 128) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 14);
  return t;
}

function signTexture(text, sub, bg = '#0a4a2c', fg = '#ffffff') {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 256);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, 'rgba(255,255,255,.16)');
  g.addColorStop(1, 'rgba(0,0,0,.18)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 256);
  ctx.fillStyle = fg;
  ctx.font = '800 96px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 512, sub ? 104 : 128);
  if (sub) {
    ctx.font = '600 44px "Noto Sans Bengali", "Hind Siliguri", sans-serif';
    ctx.globalAlpha = 0.9;
    ctx.fillText(sub, 512, 186);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class ShopScene {
  constructor(canvas, department) {
    this.canvas = canvas;
    this.prevTime = performance.now();
    this.mode = 'street';
    this.products = [];
    this.picked = null;
    this.aisleZ = -6.2;
    this.walkTarget = -6.2;
    this.tween = null;
    this.listeners = { pick: [], walk: [] };

    this.initRenderer();
    this.initScene();
    this.buildStreet();
    this.buildInterior();
    this.buildAisle(department);
    this.setCameraVantage('street', true);
    this.bindInput();
    this.animate();
  }

  on(evt, fn) { (this.listeners[evt] || []).push(fn); }
  emit(evt, data) { (this.listeners[evt] || []).forEach((f) => f(data)); }

  /* ------------------------------------------------------------ plumbing */
  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;

    this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.05, 90);
    this.camera.position.set(0, 1.65, 15);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.applyFov();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    this.applyFov();
  }

  applyFov() {
    const aspect = window.innerWidth / window.innerHeight;
    // Portrait phones need a wider vertical field or the aisle walls fall outside the frame.
    this.camera.fov = aspect < 1 ? 74 : aspect < 1.3 ? 66 : 58;
    this.camera.updateProjectionMatrix();
  }

  get portrait() { return window.innerWidth / window.innerHeight < 1.05; }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#171a17');
    this.scene.fog = new THREE.Fog('#efe9dc', 26, 78);

    this.scene.add(new THREE.HemisphereLight(0xfff6e6, 0x9c9280, 1.15));

    const key = new THREE.DirectionalLight(0xfff0d8, 0.85);
    key.position.set(4, 9, 4);
    this.scene.add(key);

    // a soft light that switches on when you lift a pack into your hand
    this.holdLight = new THREE.PointLight(0xfff4e2, 0, 2.6, 2);
    this.holdLight.position.set(0, 1.8, 0);
    this.scene.add(this.holdLight);

    // warm aisle lights, kept to three for the frame budget
    [-1.5, -6, -11, -16, -21].forEach((z, i) => {
      const p = new THREE.PointLight(0xffe2b8, i === 0 ? 26 : 19, 14, 2);
      p.position.set(0, 2.95, z);
      this.scene.add(p);
    });
  }

  /* -------------------------------------------------------------- street */
  buildStreet() {
    const g = new THREE.Group();
    g.name = 'street';

    const tarmac = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 34),
      new THREE.MeshStandardMaterial({ color: '#3a3d39', roughness: 0.96 })
    );
    tarmac.rotation.x = -Math.PI / 2;
    tarmac.position.set(0, 0, 22);
    g.add(tarmac);

    const pave = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 9),
      new THREE.MeshStandardMaterial({ color: '#7b776c', roughness: 0.9 })
    );
    pave.rotation.x = -Math.PI / 2;
    pave.position.set(0, 0.01, 9.5);
    g.add(pave);

    // ---- storefront wall built as panels, leaving a real opening ----
    const wallMat = new THREE.MeshStandardMaterial({ color: '#f6f1e4', roughness: 0.85 });
    const OPEN_W = 6.4;    // opening width
    const OPEN_H = 4.1;    // opening height
    const Z = 5.2;

    const sidePanel = (x, w) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 8, 0.45), wallMat);
      m.position.set(x, 4, Z);
      g.add(m);
    };
    sidePanel(-(OPEN_W / 2 + 4.5), 9);
    sidePanel(OPEN_W / 2 + 4.5, 9);

    const lintel = new THREE.Mesh(new THREE.BoxGeometry(OPEN_W + 0.2, 8 - OPEN_H, 0.45), wallMat);
    lintel.position.set(0, OPEN_H + (8 - OPEN_H) / 2, Z);
    g.add(lintel);

    // door / window frames
    const frameMat = new THREE.MeshStandardMaterial({ color: '#20261f', roughness: 0.45, metalness: 0.45 });
    [-OPEN_W / 2, OPEN_W / 2].forEach((x) => {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.16, OPEN_H, 0.16), frameMat);
      f.position.set(x, OPEN_H / 2, Z - 0.05);
      g.add(f);
    });
    [[-1.05, true], [1.05, true], [-3.1, false], [3.1, false]].forEach(([x, mullion]) => {
      const f = new THREE.Mesh(new THREE.BoxGeometry(mullion ? 0.08 : 0.13, OPEN_H, 0.13), frameMat);
      f.position.set(x, OPEN_H / 2, Z - 0.05);
      g.add(f);
    });
    const head = new THREE.Mesh(new THREE.BoxGeometry(OPEN_W, 0.14, 0.16), frameMat);
    head.position.set(0, OPEN_H, Z - 0.05);
    g.add(head);

    // glass panes either side of the doors
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: '#e6f4ec', transparent: true, opacity: 0.10, roughness: 0.06,
      metalness: 0, reflectivity: 0.5, side: THREE.DoubleSide,
    });
    [[-2.08, 1.9], [2.08, 1.9]].forEach(([x, w]) => {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, OPEN_H - 0.2), glassMat);
      pane.position.set(x, OPEN_H / 2, Z - 0.06);
      g.add(pane);
    });

    // sliding doors
    this.doorL = new THREE.Mesh(new THREE.PlaneGeometry(1.02, OPEN_H - 0.2), glassMat);
    this.doorR = new THREE.Mesh(new THREE.PlaneGeometry(1.02, OPEN_H - 0.2), glassMat);
    this.doorL.position.set(-0.53, OPEN_H / 2, Z - 0.12);
    this.doorR.position.set(0.53, OPEN_H / 2, Z - 0.12);
    g.add(this.doorL, this.doorR);
    [this.doorL, this.doorR].forEach((d) => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.06, 0.05), frameMat);
      bar.position.copy(d.position);
      bar.position.y = OPEN_H * 0.52;
      g.add(bar);
    });

    // ---- signboard above the opening ----
    const signCanvas = signTexture('SHOHOJ BAZAR', 'সহজ বাজার · virtual super shop');
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(5.9, 1.48),
      new THREE.MeshBasicMaterial({ map: signCanvas })
    );
    sign.position.set(0, OPEN_H + 1.15, Z + 0.28);
    g.add(sign);

    const signBox = new THREE.Mesh(
      new THREE.BoxGeometry(6.1, 1.62, 0.18),
      new THREE.MeshStandardMaterial({ color: '#08331f', roughness: 0.6 })
    );
    signBox.position.set(0, OPEN_H + 1.15, Z + 0.18);
    g.add(signBox);
    sign.position.z = Z + 0.29;
    sign.position.y = OPEN_H + 0.95;
    signBox.position.y = OPEN_H + 0.95;

    const signGlow = new THREE.PointLight(0xffe0a8, 14, 10, 2);
    signGlow.position.set(0, OPEN_H + 1.3, Z + 1.6);
    g.add(signGlow);

    // ---- striped awning ----
    const awningCanvas = document.createElement('canvas');
    awningCanvas.width = 256; awningCanvas.height = 64;
    const actx = awningCanvas.getContext('2d');
    for (let i = 0; i < 16; i++) {
      actx.fillStyle = i % 2 ? '#0d6138' : '#f7f2e7';
      actx.fillRect(i * 16, 0, 16, 64);
    }
    const awningTex = new THREE.CanvasTexture(awningCanvas);
    awningTex.colorSpace = THREE.SRGBColorSpace;
    const awning = new THREE.Mesh(
      new THREE.PlaneGeometry(OPEN_W + 0.3, 1.0),
      new THREE.MeshStandardMaterial({ map: awningTex, roughness: 0.85, side: THREE.DoubleSide })
    );
    awning.position.set(0, OPEN_H - 0.30, Z + 0.46);
    awning.rotation.x = -0.95;
    g.add(awning);

    // ---- warm light spilling onto the pavement ----
    const spillCanvas = document.createElement('canvas');
    spillCanvas.width = spillCanvas.height = 256;
    const sctx = spillCanvas.getContext('2d');
    const sg = sctx.createLinearGradient(0, 0, 0, 256);
    sg.addColorStop(0, 'rgba(255,214,150,.75)');
    sg.addColorStop(1, 'rgba(255,214,150,0)');
    sctx.fillStyle = sg;
    sctx.fillRect(0, 0, 256, 256);
    const spillTex = new THREE.CanvasTexture(spillCanvas);
    const spill = new THREE.Mesh(
      new THREE.PlaneGeometry(OPEN_W + 1.2, 7),
      new THREE.MeshBasicMaterial({ map: spillTex, transparent: true, opacity: 0.5, depthWrite: false })
    );
    spill.rotation.x = -Math.PI / 2;
    spill.position.set(0, 0.02, Z + 3.8);
    g.add(spill);

    // trolley bays + planters for scale
    const bayMat = new THREE.MeshStandardMaterial({ color: '#8d8878', roughness: 0.85 });
    [-5.4, 5.4].forEach((x) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.0, 0.8), bayMat);
      b.position.set(x, 0.5, Z + 1.9);
      g.add(b);
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.9),
        new THREE.MeshStandardMaterial({ color: '#c96f4a', roughness: 0.9 }));
      p.position.set(x + (x > 0 ? 2.6 : -2.6), 0.55, Z + 1.6);
      g.add(p);
      const plant = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 10),
        new THREE.MeshStandardMaterial({ color: '#3f7a45', roughness: 0.95 }));
      plant.position.set(x + (x > 0 ? 2.6 : -2.6), 1.4, Z + 1.6);
      plant.scale.y = 0.8;
      g.add(plant);
    });

    // a warm light inside the doorway so the shop reads as open and alive
    const insideGlow = new THREE.PointLight(0xffd9a0, 22, 14, 2);
    insideGlow.position.set(0, 2.4, Z - 2.5);
    g.add(insideGlow);

    this.scene.add(g);
    this.streetGroup = g;
  }

  /* ------------------------------------------------------------ interior */
  buildInterior() {
    const g = new THREE.Group();
    g.name = 'interior';

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(9.5, 46),
      new THREE.MeshPhysicalMaterial({
        map: floorTexture(), roughness: 0.34, metalness: 0.05,
        clearcoat: 0.35, clearcoatRoughness: 0.4, color: '#ffffff', envMapIntensity: 1.2,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -15);
    g.add(floor);

    // ceiling with light strips
    const ceil = new THREE.Mesh(
      new THREE.PlaneGeometry(9.5, 46),
      new THREE.MeshStandardMaterial({ color: '#f4efe2', roughness: 0.9, side: THREE.DoubleSide, emissive: '#2a2618', emissiveIntensity: 0.18 })
    );
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, 3.4, -15);
    g.add(ceil);

    for (let z = 2; z > -30; z -= 4) {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.05, 0.22),
        new THREE.MeshBasicMaterial({ color: '#fff3d8' })
      );
      strip.position.set(0, 3.32, z);
      g.add(strip);
    }

    // side walls
    const wallMat = new THREE.MeshStandardMaterial({ color: '#fbf7ec', roughness: 0.9, emissive: '#2b2719', emissiveIntensity: 0.15 });
    [-4.9, 4.9].forEach((x) => {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(46, 3.4), wallMat);
      w.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2;
      w.position.set(x, 1.7, -15);
      g.add(w);
    });

    const back = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 3.4), wallMat);
    back.position.set(0, 1.7, -33);
    g.add(back);

    // service desk near the entrance
    const deskMat = new THREE.MeshStandardMaterial({ color: '#2f5d45', roughness: 0.6 });
    const desk = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.05, 0.7), deskMat);
    desk.position.set(-2.6, 0.52, 0.6);
    g.add(desk);
    const deskTop = new THREE.Mesh(
      new THREE.BoxGeometry(2.75, 0.07, 0.85),
      new THREE.MeshStandardMaterial({ color: '#e8dfc9', roughness: 0.45 })
    );
    deskTop.position.set(-2.6, 1.08, 0.6);
    g.add(deskTop);

    const deskSign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.38),
      new THREE.MeshBasicMaterial({ map: signTexture('SERVICE DESK', 'সাহায্য কেন্দ্র', '#12432c') })
    );
    deskSign.position.set(-2.6, 1.55, 0.25);
    g.add(deskSign);

    // welcome arch sign
    const welcome = new THREE.Mesh(
      new THREE.PlaneGeometry(4.6, 0.9),
      new THREE.MeshBasicMaterial({ map: signTexture('WELCOME', 'স্বাগতম', '#0d6138') })
    );
    welcome.position.set(0, 2.95, -1.2);
    g.add(welcome);

    // free-standing gondolas in the entrance area
    [0, 1].forEach((i) => {
      const gx = i === 0 ? -2.0 : 2.0;
      const gz = -3.2 - i * 0.4;
      const unit = new THREE.Group();
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(1.35, 1.25, 0.62),
        new THREE.MeshStandardMaterial({ color: '#f6f1e4', roughness: 0.78 })
      );
      base.position.y = 0.62;
      unit.add(base);
      const top = new THREE.Mesh(
        new THREE.BoxGeometry(1.45, 0.06, 0.72),
        new THREE.MeshStandardMaterial({ color: '#e7dfcd', roughness: 0.65 })
      );
      top.position.y = 1.28;
      unit.add(top);
      unit.position.set(gx, 0, gz);
      g.add(unit);
    });

    this.scene.add(g);
    this.interiorGroup = g;
    this.gondolaAnchors = [new THREE.Vector3(-2.0, 1.33, -3.2), new THREE.Vector3(2.0, 1.33, -3.6)];
  }

  /* --------------------------------------------------------------- aisle */
  /* Builds a walkable aisle from a department config. Nothing below is
     rice-specific: bays, levels, facings, sections, bulk display and the
     end cap all come from the department object. */
  buildAisle(dept, quality) {
    const aisle = new THREE.Group();
    aisle.name = 'aisle:' + dept.id;
    this.dept = dept;
    this.products = [];

    const shelfMat = new THREE.MeshStandardMaterial({ color: '#fbf8f1', roughness: 0.75 });
    const boardMat = new THREE.MeshStandardMaterial({ color: '#e6e0d2', roughness: 0.7 });
    const backMat = new THREE.MeshStandardMaterial({ color: '#cfd8cf', roughness: 0.95 });

    const BAY_W = 6.2;
    const SHELF_X = 2.0;
    const LEVELS = dept.layout.levels;
    const LEVEL_H = 0.52;
    const BASE_Y = 0.18;
    const bays = dept.layout.bays;
    const totalLen = bays * BAY_W;
    const AISLE_START_Z = -9.5;
    const AISLE_END_Z = AISLE_START_Z - totalLen;

    this.aisleBounds = { start: AISLE_START_Z, end: AISLE_END_Z };

    for (const side of [-1, 1]) {
      for (let bay = 0; bay < bays; bay++) {
        const bayCentre = AISLE_START_Z - BAY_W / 2 - bay * BAY_W;
        const group = new THREE.Group();
        group.position.set(side * SHELF_X, 0, bayCentre);

        const back = new THREE.Mesh(new THREE.BoxGeometry(0.08, LEVELS * LEVEL_H + BASE_Y + 0.12, BAY_W), backMat);
        back.position.set(side * 0.3, (LEVELS * LEVEL_H + BASE_Y) / 2, 0);
        group.add(back);

        [-BAY_W / 2, BAY_W / 2].forEach((z) => {
          const up = new THREE.Mesh(new THREE.BoxGeometry(0.56, LEVELS * LEVEL_H + BASE_Y + 0.5, 0.07), shelfMat);
          up.position.set(0, (LEVELS * LEVEL_H + BASE_Y + 0.5) / 2, z);
          group.add(up);
        });

        for (let i = 0; i <= LEVELS; i++) {
          const y = BASE_Y + i * LEVEL_H;
          const board = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.045, BAY_W), boardMat);
          board.position.set(0, y, 0);
          group.add(board);
          const rail = new THREE.Mesh(
            new THREE.BoxGeometry(0.03, 0.075, BAY_W),
            new THREE.MeshStandardMaterial({ color: '#f6f2e6', roughness: 0.6 })
          );
          rail.position.set(-side * 0.34, y + 0.045, 0);
          group.add(rail);
        }

        /* department fascia + the section that owns this bay */
        const section = (dept.sections || []).find((sec) => (sec.bays || []).includes(bay));
        const fascia = new THREE.Mesh(
          new THREE.PlaneGeometry(BAY_W, 0.34),
          new THREE.MeshBasicMaterial({
            map: signTexture(
              (section ? section.name : dept.name).toUpperCase(),
              section ? section.nameBn : dept.nameBn,
              dept.accent || '#0d6138'
            ),
          })
        );
        fascia.position.set(-side * 0.31, LEVELS * LEVEL_H + BASE_Y + 0.22, 0);
        fascia.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        group.add(fascia);

        aisle.add(group);
        group.userData = { side, bay, section, BAY_W, LEVELS, LEVEL_H, BASE_Y };
        (this.bayGroups = this.bayGroups || []).push(group);
      }
    }

    /* ---- aisle walls + ceiling, so nothing floats in a void ---- */
    const wallMat = new THREE.MeshStandardMaterial({ color: '#e9e3d3', roughness: 0.95 });
    [-1, 1].forEach((side) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.5, totalLen + 1.2), wallMat);
      wall.position.set(side * 2.42, 1.75, AISLE_START_Z - totalLen / 2 + 0.3);
      aisle.add(wall);
    });
    const ceil = new THREE.Mesh(
      new THREE.BoxGeometry(4.9, 0.1, totalLen + 1.2),
      new THREE.MeshStandardMaterial({ color: '#f1ebdc', roughness: 0.92 })
    );
    ceil.position.set(0, 3.5, AISLE_START_Z - totalLen / 2 + 0.3);
    aisle.add(ceil);

    /* ---- stock the shelves ---- */
    const facings = this.portrait ? dept.layout.facings.mobile : dept.layout.facings.desktop;
    const bySection = {};
    dept.products.forEach((p) => { (bySection[p.section] = bySection[p.section] || []).push(p); });

    const talkerMap = {};
    (dept.talkers || []).forEach((t) => { talkerMap[t.productId] = t.text; });

    (this.bayGroups || []).forEach((group) => {
      const { side, bay, section, BAY_W: BW, LEVELS: LV, LEVEL_H: LH, BASE_Y: BY } = group.userData;
      const pool = (bySection[section ? section.id : dept.sections?.[0]?.id] || dept.products);
      const STEP = BW / facings;
      let n = 0;

      for (let level = 0; level < LV; level++) {
        for (let f = 0; f < facings; f++) {
          const product = pool[n % pool.length];
          n++;
          const z = -BW / 2 + STEP / 2 + f * STEP;

          const mesh = buildProduct(product, { shadow: level === 0 });
          mesh.position.set(side * SHELF_X + side * 0.02, BY + level * LH + 0.045,
            group.position.z + z);
          mesh.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
          aisle.add(mesh);
          this.products.push(mesh);
          mesh.userData.home = mesh.position.clone();
          mesh.userData.homeRot = mesh.rotation.clone();

          if (level <= 1) {
            const tag = priceTag(product);
            tag.position.set(side * SHELF_X - side * 0.30, BY + level * LH + 0.075, group.position.z + z);
            tag.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
            aisle.add(tag);
          }

          const talkerText = talkerMap[product.id];
          if (talkerText && level === 1 && f % 3 === 0) {
            const t = shelfTalker(product, talkerText);
            t.position.set(side * SHELF_X - side * 0.36, BY + level * LH + 0.19, group.position.z + z);
            t.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
            aisle.add(t);
          }
        }
      }
    });

    /* ---- bulk display at the aisle mouth ---- */
    this.bulkGroups = [];
    if (dept.layout.bulkDisplay === 'sacks' && (dept.bulk || []).length) {
      const pallet = new THREE.Mesh(
        new THREE.BoxGeometry(0.95, 0.1, 1.7),
        new THREE.MeshStandardMaterial({ color: '#7d5c34', roughness: 0.92 })
      );
      pallet.position.set(1.55, 0.05, AISLE_START_Z - 2.6);
      aisle.add(pallet);

      (dept.bulk || []).forEach((entry, i) => {
        const product = dept.products.find((p) => p.id === entry.productId);
        if (!product) return;
        // a real 25 kg sack on the floor: 45 cm wide, 72 cm tall, leaning on a pallet
        const sack = { ...product, shape: 'sack', bulkDims: { w: 0.42, h: 0.66, d: 0.20, bulge: 0.07 } };
        const stack = new THREE.Group();
        for (let c = 0; c < 2; c++) {
          const m = buildProduct(sack, { shadow: c === 0 });
          m.position.set(c === 0 ? -0.02 : 0.03, 0.10 + c * 0.64, c === 0 ? 0 : 0.02);
          // sacks face the customer walking in, not the shelf
          m.rotation.y = (c === 1 ? 0.10 : -0.06);
          m.rotation.z = c === 1 ? 0.02 : 0;
          stack.add(m);
          this.products.push(m);
          m.userData.home = m.position.clone();
          m.userData.homeRot = m.rotation.clone();
        }
        stack.position.set(1.52, 0, AISLE_START_Z - 3.6 - i * 0.62);
        aisle.add(stack);
        this.bulkGroups.push(stack);
      });
    }

    /* ---- end cap at the far end ---- */
    if (dept.layout.endcap === 'weigh-counter') {
      const counter = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(3.4, 0.95, 0.9),
        new THREE.MeshStandardMaterial({ color: '#e8dfc9', roughness: 0.7 })
      );
      body.position.y = 0.48;
      counter.add(body);
      const top = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, 0.07, 1.0),
        new THREE.MeshStandardMaterial({ color: '#2f5d45', roughness: 0.45 })
      );
      top.position.y = 0.98;
      counter.add(top);
      [-1.1, 0, 1.1].forEach((x, i) => {
        const bin = new THREE.Mesh(
          new THREE.CylinderGeometry(0.28, 0.24, 0.36, 18),
          new THREE.MeshStandardMaterial({ color: ['#d8c9a3', '#e3d2a8', '#cfc09b'][i], roughness: 0.85 })
        );
        bin.position.set(x, 1.2, 0);
        counter.add(bin);
      });
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(2.4, 0.4),
        new THREE.MeshBasicMaterial({ map: signTexture('WEIGH & PACK', 'ওজন করে প্যাক', dept.accent || '#0d6138') })
      );
      sign.position.set(0, 1.75, 0.1);
      counter.add(sign);
      counter.position.set(0, 0, AISLE_END_Z + 1.2);
      aisle.add(counter);
    }

    const endcap = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 1.6, 0.7),
      new THREE.MeshStandardMaterial({ color: '#f2ede0', roughness: 0.8 })
    );
    endcap.position.set(0, 0.8, AISLE_END_Z - 0.6);
    aisle.add(endcap);

    this.scene.add(aisle);
    this.aisleGroup = aisle;
    // the aisle runs toward -z, so walkMin is the far end and walkMax the mouth
    this.walkMin = AISLE_END_Z + 2.6;
    this.walkMax = AISLE_START_Z + 1.2;
    this.aisleZ = AISLE_START_Z;
    this.walkTarget = AISLE_START_Z;
  }

  /* Which section is the camera standing in? Drives the HUD label. */
  sectionAt(z) {
    if (!this.dept || !this.bayGroups) return null;
    const BAY_W = this.bayGroups[0].userData.BAY_W;
    const bay = Math.floor((this.aisleBounds.start - z) / BAY_W);
    const g = this.bayGroups.find((b) => b.userData.bay === Math.max(0, bay));
    return g ? g.userData.section : null;
  }

  /* -------------------------------------------------------------- camera */
  vantages() {
    return {
      street: { pos: new THREE.Vector3(0, 1.68, 15.4), look: new THREE.Vector3(0, 3.15, 5.2) },
      hall:   { pos: new THREE.Vector3(0, 1.6, 1.8),  look: new THREE.Vector3(0, 1.5, -9) },
      aisle:  { pos: new THREE.Vector3(0, 1.55, this.aisleZ), look: new THREE.Vector3(0, 1.3, this.aisleZ - 8) },

    };
  }

  setCameraVantage(name, instant = false) {
    const v = this.vantages()[name];
    if (name !== 'aisle' && this.mode === 'aisle') this.camera.position.x = 0;
    this.mode = name;
    this.lookTarget = v.look.clone();
    if (instant) {
      this.camera.position.copy(v.pos);
      this.camera.lookAt(v.look);
      this.tween = null;
      return;
    }
    this.tween = {
      from: this.camera.position.clone(),
      to: v.pos.clone(),
      lookFrom: this.lookTarget.clone(),
      lookTo: v.look.clone(),
      t: 0,
      dur: 1.5,
    };
  }

  enterShop() {
    // doors part, camera glides through into the hall
    this.setCameraVantage('hall');
    const start = performance.now();
    const step = () => {
      const t = Math.min((performance.now() - start) / 1200, 1);
      const e = ease(t);
      this.doorL.position.x = -0.43 - e * 0.82;
      this.doorR.position.x = 0.43 + e * 0.82;
      if (t < 1) requestAnimationFrame(step);
    };
    step();
    setTimeout(() => this.setCameraVantage('aisle'), 1500);
  }

  walkToAisle() { this.setCameraVantage('aisle'); }

  /* Walk the camera to the shelf slot a search result lives on. */
  focusProduct(productId) {
    const mesh = this.products.find((m) => m.userData.product.id === productId);
    if (!mesh) return false;
    this.aisleZ = THREE.MathUtils.clamp(mesh.position.z + 1.85, this.walkMin ?? -22.5, this.walkMax ?? -5.2);
    this.walkTarget = this.aisleZ;
    this.setCameraVantage('aisle');
    return true;
  }

  walk(delta) {
    if (this.mode !== 'aisle' || this.picked) return;
    // delta is "metres forward", and forward is toward -z
    this.walkTarget = THREE.MathUtils.clamp(this.walkTarget - delta, this.walkMin ?? -22.5, this.walkMax ?? -5.2);
  }

  /* ------------------------------------------------------------- picking */
  pick(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster = this.raycaster || new THREE.Raycaster();
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.products, true);
    for (const hit of hits) {
      let obj = hit.object;
      while (obj && !obj.userData.product) obj = obj.parent;
      if (obj && obj.userData.product) return obj;
    }
    return null;
  }

  /* Lift the pack out of the shelf and bring it in front of the camera. */
  inspect(productGroup) {
    // if you grab a pack mid-walk, finish the camera move first so the pack
    // is lifted in front of the aisle camera, not in front of a moving one
    if (this.tween) {
      this.camera.position.copy(this.tween.to);
      this.lookTarget.copy(this.tween.lookTo);
      this.tween = null;
    }
    this.picked = productGroup;
    ensureBackTexture(productGroup);
    productGroup.traverse((o) => { if (o.userData.isContactShadow) o.visible = false; });
    this.userRotated = false;
    this.scene.traverse((o) => {
      if (o.isPointLight) {
        if (o.userData.baseIntensity === undefined) o.userData.baseIntensity = o.intensity;
        o.userData.targetIntensity = o.userData.baseIntensity * 0.35;
      }
    });
    this.inspectFrom = {
      pos: productGroup.position.clone(),
      rot: productGroup.rotation.clone(),
    };
    productGroup.userData.inspectTarget = true;

    // place it in the hand immediately — a pack you just grabbed should not drift
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const up = this.camera.up.clone().normalize();
    const right = new THREE.Vector3().crossVectors(dir, up).normalize();
    const DIST = this.portrait ? 1.30 : 1.12;
    productGroup.position.copy(this.camera.position.clone()
      .add(dir.multiplyScalar(DIST))
      .addScaledVector(right, this.portrait ? 0 : -0.34)
      .addScaledVector(up, this.portrait ? 0.46 : 0.02));
    productGroup.rotation.set(0, 0, 0);

    const box = new THREE.Box3().setFromObject(productGroup);
    const h = Math.max(box.max.y - box.min.y, 0.10);
    const frameH = 2 * DIST * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    productGroup.userData.holdScale = THREE.MathUtils.clamp((frameH * (this.portrait ? 0.22 : 0.33)) / h, 0.5, 2.6);
    productGroup.scale.setScalar(productGroup.userData.holdScale);
  }

  release() {
    this.scene.traverse((o) => { if (o.isPointLight && o.userData.baseIntensity !== undefined) o.userData.targetIntensity = o.userData.baseIntensity; });
    if (!this.picked) return;
    const g = this.picked;
    g.position.copy(this.inspectFrom.pos);
    g.rotation.copy(this.inspectFrom.rot);
    g.userData.inspectTarget = false;
    g.userData.holdScale = undefined;
    g.traverse((o) => { if (o.userData.isContactShadow) o.visible = true; });
    this.picked = null;
  }

  rotatePicked(dx, dy) {
    if (!this.picked) return;
    this.userRotated = true;
    this.picked.rotation.y += dx * 0.012;
    this.picked.rotation.x = THREE.MathUtils.clamp(this.picked.rotation.x + dy * 0.008, -0.5, 0.5);
  }

  /* --------------------------------------------------------------- input */
  bindInput() {
    const canvas = this.canvas;
    let down = null;
    let lastY = 0;
    let dragging = false;

    canvas.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
      lastY = e.clientY;
      dragging = false;
      canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - down.x;
      const dy = e.clientY - down.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) dragging = true;

      if (this.picked && dragging) {
        this.rotatePicked(e.movementX || dx * 0.2, e.movementY || dy * 0.2);
        down.x = e.clientX; down.y = e.clientY;
        return;
      }
      if (this.mode === 'aisle' && dragging) {
        const step = (lastY - e.clientY) * 0.012;
        this.walk(step);
        lastY = e.clientY;
        this.emit('walk', this.walkTarget);
      }
    });

    canvas.addEventListener('pointerup', (e) => {
      if (!down) return;
      const dist = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const rapid = performance.now() - down.t < 420;
      if (!dragging && rapid) {
        const hit = this.pick(e.clientX, e.clientY);
        if (hit) this.emit('pick', hit.userData.product);
        else this.emit('pick', null);
      }
      down = null;
      dragging = false;
    });

    canvas.addEventListener('wheel', (e) => {
      if (this.picked) return;
      if (this.mode !== 'aisle') return;
      e.preventDefault();
      this.walk(e.deltaY * 0.0055);
      this.emit('walk', this.walkTarget);
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
      if (this.mode !== 'aisle' || this.picked) return;
      if (e.key === 'ArrowUp' || e.key === 'w') { this.walk(-0.35); this.emit('walk', this.walkTarget); }
      if (e.key === 'ArrowDown' || e.key === 's') { this.walk(0.35); this.emit('walk', this.walkTarget); }
    });
  }

  /* ---------------------------------------------------------------- loop */
  animate() {
    const tick = () => {
      requestAnimationFrame(tick);
      const now = performance.now();
      const dt = Math.min((now - this.prevTime) / 1000, 0.05);
      this.prevTime = now;

      // camera tween
      if (this.tween) {
        this.tween.t += dt / this.tween.dur;
        const t = Math.min(this.tween.t, 1);
        const e = ease(t);
        this.camera.position.lerpVectors(this.tween.from, this.tween.to, e);
        this.lookTarget.lerpVectors(this.tween.lookFrom, this.tween.lookTo, e);
        if (t >= 1) this.tween = null;
      }

      // walking
      if (this.mode === 'aisle' && !this.picked) {
        this.aisleZ = lerp(this.aisleZ, this.walkTarget, 1 - Math.pow(0.001, dt));
        const portrait = this.portrait;
        const targetX = portrait ? -1.15 : 0;
        this.camera.position.x = lerp(this.camera.position.x, targetX, 1 - Math.pow(0.01, dt));
        this.camera.position.z = this.aisleZ;
        this.camera.position.y = 1.52 + Math.sin(performance.now() * 0.0018) * 0.006;
        if (portrait) this.lookTarget.set(-1.85, 1.16, this.aisleZ - 5.4);
        else this.lookTarget.set(0, 1.28, this.aisleZ - 8);
      }

      // ease light intensities (dim while a product is in hand)
      this.scene.traverse((o) => {
        if (o.isPointLight && o.userData.targetIntensity !== undefined) {
          o.intensity = lerp(o.intensity, o.userData.targetIntensity, 1 - Math.pow(0.01, dt));
        }
      });

      // held product easing toward the camera
      if (this.picked) {
        const dir = new THREE.Vector3();
        this.camera.getWorldDirection(dir);
        const up = this.camera.up.clone().normalize();
        const right = new THREE.Vector3().crossVectors(dir, up).normalize();
        // on a desktop the info card sits on the right, so hold the pack left of centre
        const DIST = this.portrait ? 1.30 : 1.12;
        const target = this.camera.position.clone()
          .add(dir.multiplyScalar(DIST))
          .addScaledVector(right, this.portrait ? 0 : -0.34)
          .addScaledVector(up, this.portrait ? 0.46 : 0.02);
        this.holdLight.position.copy(target).add(new THREE.Vector3(0, 0.45, 0));
        this.holdLight.intensity = lerp(this.holdLight.intensity, 2.6, 1 - Math.pow(0.01, dt));
        this.picked.position.lerp(target, 1 - Math.pow(0.0015, dt));
        if (this.picked.userData.holdScale === undefined) {
          // size the pack so it fills the same slice of the screen whatever it weighs
          const box = new THREE.Box3().setFromObject(this.picked);
          const h = Math.max(box.max.y - box.min.y, 0.10);
          const frameH = 2 * DIST * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
          this.picked.userData.holdScale = THREE.MathUtils.clamp((frameH * (this.portrait ? 0.22 : 0.33)) / h, 0.5, 2.6);
        }
        const hs = this.picked.userData.holdScale;
        this.picked.scale.setScalar(lerp(this.picked.scale.x, hs, 1 - Math.pow(0.01, dt)));
        if (!this.userRotated) {
          this.picked.rotation.x = lerp(this.picked.rotation.x, 0, 1 - Math.pow(0.005, dt));
          let ry = this.picked.rotation.y % (Math.PI * 2);
          if (ry > Math.PI) ry -= Math.PI * 2;
          if (ry < -Math.PI) ry += Math.PI * 2;
          this.picked.rotation.y = lerp(ry, 0, 1 - Math.pow(0.005, dt));
        }
      } else {
        if (this.holdLight && this.holdLight.intensity > 0.01) {
          this.holdLight.intensity = lerp(this.holdLight.intensity, 0, 1 - Math.pow(0.01, dt));
        }
        this.products.forEach((p) => {
          if (p.scale.x !== 1) p.scale.setScalar(lerp(p.scale.x, 1, 1 - Math.pow(0.01, dt)));
        });
      }

      this.camera.lookAt(this.lookTarget);
      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }
}
