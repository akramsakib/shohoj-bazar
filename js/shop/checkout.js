/* ------------------------------------------------------------------------
   The checkout lane — belt, scanner, till, bagging shelf, cashier.
   The choreography is the same as a real till: the pack comes down the belt,
   the scanner reads it, it drops past the bagging shelf into a bag, and the
   total on the customer display climbs.
   ---------------------------------------------------------------------- */
import * as THREE from '../../vendor/three.module.js';
import { buildPerson } from './people.js';

function canvasPlane(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = Math.round(512 * (h / w));
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { mesh: null, ctx, tex, c, w, h, draw };
}

export function buildCheckoutLane(z, x = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.name = 'checkout';

  const steel = new THREE.MeshStandardMaterial({ color: '#c9ced2', roughness: 0.38, metalness: 0.55, envMapIntensity: 1.2 });
  const panel = new THREE.MeshStandardMaterial({ color: '#0d6138', roughness: 0.42, metalness: 0.08 });
  const dark = new THREE.MeshStandardMaterial({ color: '#23272b', roughness: 0.6, metalness: 0.3 });
  const beltMat = new THREE.MeshStandardMaterial({ color: '#1c2024', roughness: 0.75, metalness: 0.05 });

  /* ---- the counter body the belt sits in ---- */
  const H = 0.88, LEN = 3.4, DEPTH = 0.95;
  const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(LEN, H, DEPTH), steel);
  bodyMesh.position.set(0, H / 2, 0);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  g.add(bodyMesh);

  // the green band every supermarket till wears
  const band = new THREE.Mesh(new THREE.BoxGeometry(LEN + 0.02, 0.16, DEPTH + 0.02), panel);
  band.position.set(0, 0.18, 0);
  g.add(band);

  // belt surface
  const belt = new THREE.Mesh(new THREE.BoxGeometry(LEN - 0.5, 0.02, DEPTH - 0.22), beltMat);
  belt.position.set(-0.1, H + 0.012, 0.02);
  belt.receiveShadow = true;
  g.add(belt);

  // belt ribs, so the surface reads as moving rubber
  const ribMat = new THREE.MeshStandardMaterial({ color: '#2b3035', roughness: 0.8 });
  const ribs = [];
  for (let i = 0; i < 26; i++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.006, DEPTH - 0.24), ribMat);
    rib.position.set(-1.44 + i * 0.11, H + 0.024, 0.02);
    g.add(rib);
    ribs.push(rib);
  }

  // side rails
  [-1, 1].forEach((sz) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(LEN - 0.5, 0.07, 0.05), steel);
    rail.position.set(-0.1, H + 0.03, sz * (DEPTH / 2 - 0.14));
    g.add(rail);
  });

  /* ---- scanner: a glass window with a red line that goes green on a read ---- */
  const scanBody = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.30), dark);
  scanBody.position.set(0.9, H + 0.07, 0.02);
  g.add(scanBody);
  const scanGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(0.26, 0.18),
    new THREE.MeshBasicMaterial({ color: '#3a1414' })
  );
  scanGlass.rotation.x = -Math.PI / 2;
  scanGlass.position.set(0.9, H + 0.135, 0.02);
  g.add(scanGlass);
  const scanLine = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.02),
    new THREE.MeshBasicMaterial({ color: '#ff2d2d' })
  );
  scanLine.rotation.x = -Math.PI / 2;
  scanLine.position.set(0.9, H + 0.137, 0.02);
  g.add(scanLine);
  const scanGlow = new THREE.PointLight(0xff4444, 0.7, 1.1, 2);
  scanGlow.position.set(0.9, H + 0.22, 0.02);
  g.add(scanGlow);

  /* ---- till + customer display ---- */
  const till = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.28), dark);
  till.position.set(1.35, H + 0.15, -0.18);
  g.add(till);

  const screenTex = canvasPlane(1.6, 1.0);
  const screenMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.46, 0.30),
    new THREE.MeshBasicMaterial({ map: screenTex.tex })
  );
  screenMesh.position.set(1.35, H + 0.43, -0.16);
  screenMesh.rotation.y = -0.34;
  g.add(screenMesh);

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.30, 8), steel);
  pole.position.set(1.35, H + 0.28, -0.18);
  g.add(pole);

  // card / QR terminal facing the shopper
  const pos = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.20), dark);
  pos.position.set(1.05, H + 0.06, 0.30);
  g.add(pos);
  const posScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.11, 0.06),
    new THREE.MeshBasicMaterial({ color: '#0e3b26' })
  );
  posScreen.rotation.x = -Math.PI / 2.6;
  posScreen.position.set(1.05, H + 0.11, 0.29);
  g.add(posScreen);

  /* ---- bagging shelf + bags ---- */
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.06, DEPTH - 0.1), steel);
  shelf.position.set(1.95, 0.72, 0);
  g.add(shelf);
  [-0.35, 0.35].forEach((sz) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.72, 0.05), steel);
    leg.position.set(1.95, 0.36, sz);
    g.add(leg);
  });

  const bags = new THREE.Group();
  for (let i = 0; i < 2; i++) {
    const bag = new THREE.Mesh(
      new THREE.BoxGeometry(0.30, 0.36, 0.22),
      new THREE.MeshStandardMaterial({ color: '#e8e4d8', roughness: 0.95, transparent: true, opacity: 0.92 })
    );
    bag.position.set(1.85 + i * 0.34, 0.93, 0.02);
    bags.add(bag);
  }
  g.add(bags);

  /* ---- the cashier, at the till side ---- */
  const cashier = buildPerson({ shirt: '#f2efe6', trousers: '#22262b', apron: '#0d6138', height: 1.66, build: 'slim' });
  cashier.position.set(0.55, 0, -0.95);
  cashier.rotation.y = 0;   // facing the customer across the belt
  g.add(cashier);

  /* ---- queue rail, so the lane reads as part of the shop ---- */
  const railMat = new THREE.MeshStandardMaterial({ color: '#9aa3a8', roughness: 0.35, metalness: 0.6 });
  for (let i = 0; i < 2; i++) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.95, 10), railMat);
    post.position.set(-1.55 + i * 0.02, 0.475, 0.95 + i * 1.4);
    g.add(post);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.03, 16), railMat);
    base.position.set(-1.55, 0.015, 0.95 + i * 1.4);
    g.add(base);
  }
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 1.4), panel);
  strap.position.set(-1.55, 0.86, 1.65);
  g.add(strap);

  /* ---- customer display drawing ---- */
  const state = { lines: [] };
  const drawScreen = () => {
    const { ctx, c } = screenTex;
    ctx.fillStyle = '#0a2f1d';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#eaf6ee';
    ctx.font = '700 34px Inter, Arial, sans-serif';
    ctx.fillText('SHOHOJ BAZAR', 26, 46);
    ctx.fillStyle = '#8fd8ae';
    ctx.font = '600 24px Inter, Arial, sans-serif';
    ctx.fillText('Lane 1 · Sadia', 26, 80);

    let y = 128;
    const shown = state.lines.slice(-6);
    shown.forEach((l) => {
      ctx.fillStyle = '#d8e8de';
      ctx.font = '500 24px Inter, Arial, sans-serif';
      const nm = l.name.length > 22 ? l.name.slice(0, 21) + '…' : l.name;
      ctx.fillText(nm, 26, y);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('৳' + l.price, 400, y);
      y += 34;
    });
    if (state.lines.length > 6) {
      ctx.fillStyle = '#7fb595';
      ctx.font = '500 20px Inter, Arial, sans-serif';
      ctx.fillText('+ ' + (state.lines.length - 6) + ' more', 26, y);
      y += 30;
    }
    const total = state.lines.reduce((s, l) => s + l.price, 0);
    ctx.strokeStyle = '#2f6b4a';
    ctx.beginPath();
    ctx.moveTo(26, c.height - 78);
    ctx.lineTo(c.width - 26, c.height - 78);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 40px Inter, Arial, sans-serif';
    ctx.fillText('TOTAL', 26, c.height - 30);
    ctx.fillText('৳' + total, 330, c.height - 30);
    screenTex.tex.needsUpdate = true;
  };
  drawScreen();

  /* ---- the choreography ---- */
  const beltItems = [];
  let scanFlash = 0;

  const api = {
    group: g,
    cashier,
    /** put a pack on the belt at the far end and let it ride to the scanner */
    load(pack, meta) {
      const startX = -1.45;
      pack.position.set(startX, H + 0.03, 0.02);
      pack.rotation.y = Math.PI / 2;
      g.add(pack);
      beltItems.push({ mesh: pack, phase: 'belt', x: startX, meta, t: 0 });
    },
    /** advance the belt; returns the item that just got scanned this frame (if any) */
    update(dt, onScanned) {
      let scanned = null;
      beltItems.forEach((it) => {
        if (it.phase === 'belt') {
          it.x += dt * 1.15;
          it.mesh.position.x = it.x;
          if (it.x >= 0.9) {
            it.x = 0.9;
            it.phase = 'scan';
            it.t = 0;
            scanFlash = 1;
            scanned = it;
            state.lines.push({ name: it.meta.name, price: it.meta.price });
            drawScreen();
            if (onScanned) onScanned(it.meta);
          }
        } else if (it.phase === 'scan') {
          it.t += dt;
          if (it.t > 0.35) {
            it.phase = 'bag';
            it.t = 0;
          }
        } else if (it.phase === 'bag') {
          it.t += dt;
          const k = Math.min(1, it.t / 0.7);
          it.mesh.position.x = 0.9 + k * 0.95;
          it.mesh.position.y = H + 0.03 + Math.sin(k * Math.PI) * 0.12;
          if (k >= 1) {
            it.phase = 'done';
            it.mesh.visible = false;
          }
        }
      });
      for (let i = beltItems.length - 1; i >= 0; i--) {
        if (beltItems[i].phase === 'done') beltItems.splice(i, 1);
      }

      // belt ribs creep forward
      const shift = (performance.now() * 0.00035) % 0.11;
      ribs.forEach((r, i) => { r.position.x = -1.44 + i * 0.11 + shift; });

      // scanner lamp: red idle, green while reading
      scanFlash = Math.max(0, scanFlash - dt * 2.2);
      const green = scanFlash > 0.35;
      scanLine.material.color.set(green ? '#35ff7a' : '#ff2d2d');
      scanGlass.material.color.set(green ? '#123a22' : '#3a1414');
      scanGlow.color.set(green ? '#35ff7a' : '#ff4444');
      scanGlow.intensity = 0.7 + scanFlash * 1.8;
      return scanned;
    },
    reset() {
      beltItems.forEach((it) => g.remove(it.mesh));
      beltItems.length = 0;
      state.lines = [];
      drawScreen();
    },
    screen: { setLines: (lines) => { state.lines = lines.slice(); drawScreen(); } },
  };
  return api;
}
