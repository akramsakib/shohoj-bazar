/* Procedural product assets: canvas-drawn packaging artwork + real-footprint meshes.
   Section 4 replaces these textures with real pack photography; the shapes and
   real-world dimensions stay exactly the same, so the shop does not change shape. */

import * as THREE from '../../vendor/three.module.js';

const textureCache = new Map();
const geoCache = new Map();

/* ---------------------------------------------------------------- helpers */
function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function parseKg(weight) {
  const m = /([\d.]+)\s*(kg|g|l|ml|pcs|pack)/i.exec(weight || '');
  if (!m) return 0.5;
  const n = parseFloat(m[1]);
  const u = m[2].toLowerCase();
  if (u === 'g') return n / 1000;
  if (u === 'ml') return n / 1000;
  if (u === 'l') return n;
  return 0.3;
}

/* Real-world footprint per package shape, derived from the pack weight. */
function footprint(product) {
  if (product.bulkDims) return product.bulkDims;   // floor sacks use real 25 kg proportions
  const kg = parseKg(product.weight);
  switch (product.shape) {
    case 'sack':   return { w: 0.26 + Math.min(kg, 10) * 0.012, h: 0.30 + Math.min(kg, 10) * 0.010, d: 0.19, bulge: 0.075 };
    case 'pouch':  return { w: 0.19 + Math.min(kg, 2) * 0.02, h: 0.27, d: 0.10, bulge: 0.035 };
    case 'box':    return { w: 0.17, h: 0.23, d: 0.055, bulge: 0 };
    case 'bottle': return { r: 0.042, h: 0.29, d: 0.084, bulge: 0 };
    case 'jar':    return { r: 0.055, h: 0.12, d: 0.12, bulge: 0 };
    default:       return { w: 0.18, h: 0.26, d: 0.07, bulge: 0.02 };
  }
}

/* ------------------------------------------------------- label artwork */
function drawLabel(product, ctx, W, H) {
  const c = product.colour || '#eee';
  const a = product.accent || '#333';
  ctx.fillStyle = c;
  ctx.fillRect(0, 0, W, H);

  // soft vertical shading so the pack is not a flat rectangle
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, 'rgba(255,255,255,.35)');
  g.addColorStop(0.45, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(0,0,0,.13)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // top brand band
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, W, H * 0.19);
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  // shave the brand until it clears the weight on the right of the band
  const weightFont = `600 ${H * 0.072}px Inter, Arial, sans-serif`;
  ctx.font = weightFont;
  const weightW = ctx.measureText(product.weight || '').width;
  const brandRoom = W * 0.86 - weightW - W * 0.06;
  let brandSize = H * 0.105;
  let brand = String(product.brand || '').toUpperCase();
  ctx.font = `800 ${brandSize}px Inter, Arial, sans-serif`;
  while (ctx.measureText(brand).width > brandRoom && brandSize > H * 0.045) {
    brandSize -= 2;
    ctx.font = `800 ${brandSize}px Inter, Arial, sans-serif`;
  }
  ctx.fillText(brand, W * 0.07, H * 0.098);
  ctx.textAlign = 'right';
  ctx.font = weightFont;
  ctx.fillText(product.weight || '', W * 0.93, H * 0.098);

  // product name
  ctx.textAlign = 'left';
  ctx.fillStyle = a;
  ctx.font = `800 ${H * 0.115}px Inter, Arial, sans-serif`;
  const hasWindow = product.shape === 'sack' || product.shape === 'pouch';
  const nameCol = hasWindow ? W * 0.44 : W * 0.86;
  const upper = product.name.toUpperCase();
  let nameSize = H * 0.115;
  let nameLines = wrap(ctx, upper, nameCol);
  ctx.font = `800 ${nameSize}px Inter, Arial, sans-serif`;
  while (nameLines.length > 2 && nameSize > H * 0.06) {
    nameSize -= 2;
    ctx.font = `800 ${nameSize}px Inter, Arial, sans-serif`;
    nameLines = wrap(ctx, upper, nameCol);
  }
  nameLines.slice(0, 2).forEach((line, i) => {
    const sz = fitFont(ctx, line, nameCol, nameSize);
    ctx.font = `800 ${sz}px Inter, Arial, sans-serif`;
    ctx.fillText(line, W * 0.07, H * (0.325 + i * 0.135));
  });

  // bangla name
  ctx.fillStyle = 'rgba(20,30,20,.82)';
  ctx.font = `600 ${H * 0.088}px "Noto Sans Bengali", "Hind Siliguri", "Nirmala UI", sans-serif`;
  ctx.fillText(product.bn, W * 0.07, H * 0.685);

  // clear window with real grain showing through
  if (product.shape === 'sack' || product.shape === 'pouch') {
    drawGrainWindow(ctx, product, W * 0.585, H * 0.235, W * 0.345, H * 0.44);
  }

  // decorative rule
  ctx.strokeStyle = a;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = Math.max(1, H * 0.006);
  ctx.beginPath();
  ctx.moveTo(W * 0.07, H * 0.755);
  ctx.lineTo(W * 0.93, H * 0.755);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // claim line, always inside the pack edge
  const claim = product.claim || 'Premium quality · selected for you';
  ctx.fillStyle = 'rgba(20,30,20,.62)';
  fitFont(ctx, claim, W * 0.80, H * 0.052, 500);
  ctx.textAlign = 'left';
  ctx.fillText(claim, W * 0.07, H * 0.80);

  // fake barcode strip
  ctx.fillStyle = 'rgba(15,20,15,.85)';
  let x = W * 0.07;
  while (x < W * 0.40) {
    const bwd = 1 + Math.random() * 4;
    ctx.fillRect(x, H * 0.86, bwd, H * 0.075);
    x += bwd + 1 + Math.random() * 3;
  }
  ctx.fillStyle = 'rgba(20,30,20,.55)';
  fitFont(ctx, 'Weight ' + (product.weight || ''), W * 0.30, H * 0.036, 600);
  ctx.textAlign = 'left';
  ctx.fillText('Weight ' + (product.weight || ''), W * 0.07, H * 0.965);

  // Shohoj Bazar seller mark
  ctx.fillStyle = a;
  ctx.globalAlpha = 0.9;
  roundedRect(ctx, W * 0.56, H * 0.855, W * 0.37, H * 0.075, H * 0.02);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff';
  fitFont(ctx, 'SHOHOJ BAZAR', W * 0.32, H * 0.046, 700);
  ctx.textAlign = 'center';
  ctx.fillText('SHOHOJ BAZAR', W * 0.745, H * 0.893);
}

/* shrinks a font size until the string fits the given width */
function fitFont(ctx, text, maxWidth, size, weight = 800, family = 'Inter, Arial, sans-serif') {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && s > 6) {
    s -= 1;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  return s;
}

/* a heap of grain behind a clear pack window — what rice actually looks like */
function drawGrainWindow(ctx, product, x, y, w, h) {
  ctx.save();
  roundedRect(ctx, x, y, w, h, h * 0.10);
  ctx.clip();

  // the inside of a rice bag is in shadow — grains only read against a darker base
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, 'rgba(150,128,88,.42)');
  g.addColorStop(0.55, 'rgba(120,100,62,.50)');
  g.addColorStop(1, 'rgba(88,72,42,.58)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);

  const GRAIN = { rice: '#f0e7d3', dal: '#d9a441', flour: '#eae0c8' };
  const base = product.grain || GRAIN[product.section] || '#efe6d2';
  const grain = base;
  const dark = product.section === 'dal' ? '#8a5c14' : '#b5a37a';
  let seed = 7;
  for (let i = 0; i < 620; i++) {
    seed = (seed * 9301 + 49297) % 233280;
    const r = seed / 233280;
    const gx = x + ((r * 7.13) % 1) * w;
    const gy = y + ((r * 3.71) % 1) * h;
    const rot = r * Math.PI;
    const len = h * (0.030 + (r % 0.022));
    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.ellipse(0, 0, len, len * 0.36, 0, 0, Math.PI * 2);
    ctx.fillStyle = i % 4 === 0 ? dark : grain;
    ctx.globalAlpha = 0.85 + (r % 0.15);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // heap shading so the grains sit inside a bag, not on a flat card
  const shade = ctx.createRadialGradient(x + w * 0.5, y + h * 0.15, h * 0.05, x + w * 0.5, y + h * 0.6, w * 0.9);
  shade.addColorStop(0, 'rgba(255,255,255,.16)');
  shade.addColorStop(1, 'rgba(40,32,18,.35)');
  ctx.fillStyle = shade;
  ctx.fillRect(x, y, w, h);

  // glass highlight across the window
  const glass = ctx.createLinearGradient(x, y, x + w, y + h);
  glass.addColorStop(0, 'rgba(255,255,255,.20)');
  glass.addColorStop(0.42, 'rgba(255,255,255,.02)');
  glass.addColorStop(1, 'rgba(255,255,255,.10)');
  ctx.fillStyle = glass;
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = 'rgba(30,40,30,.28)';
  ctx.lineWidth = Math.max(1.5, w * 0.012);
  roundedRect(ctx, x + 1, y + 1, w - 2, h - 2, h * 0.10);
  ctx.stroke();
  ctx.restore();
}

function wrap(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export function labelTexture(product, variant = 'front') {
  const key = product.id + ':' + variant;
  if (textureCache.has(key)) return textureCache.get(key);

  const W = 384, H = 480;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  drawLabel(product, ctx, W, H);

  if (variant === 'back') {
    ctx.fillStyle = 'rgba(250,248,243,.94)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = product.accent;
    ctx.font = `800 ${H * 0.07}px Inter, Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('PRODUCT INFORMATION', W * 0.07, H * 0.10);
    ctx.fillStyle = 'rgba(20,30,20,.8)';
    ctx.font = `500 ${H * 0.045}px Inter, Arial, sans-serif`;
    const body = [
      product.blurb || '',
      '',
      'Net weight: ' + (product.weight || ''),
      'Storage: keep in a cool, dry place away from direct sunlight.',
      'Best before: see pack.',
      '',
      'Sold and fulfilled by Shohoj Bazar.',
      'Dhaka, Bangladesh · support@shohojbazar.com',
    ];
    body.forEach((line, i) => {
      wrap(ctx, line, W * 0.86).forEach((l, j) => {
        ctx.fillText(l, W * 0.07, H * (0.18 + i * 0.072 + j * 0.05));
      });
    });
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  textureCache.set(key, tex);
  return tex;
}

/* -------------------------------------------------------- mesh builders */
function pillowBox(w, h, d, bulge) {
  const key = `pb:${w}:${h}:${d}:${bulge}`;
  if (geoCache.has(key)) return geoCache.get(key);
  const geo = new THREE.BoxGeometry(w, h, d, 8, 10, 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = x / (w / 2), ny = y / (h / 2);
    const bulgeAmt = Math.cos(nx * Math.PI / 2) * Math.cos(ny * Math.PI / 2) * bulge;
    pos.setZ(i, z + Math.sign(z || 1) * bulgeAmt);
  }
  geo.computeVertexNormals();
  geoCache.set(key, geo);
  return geo;
}

function contactShadow(width) {
  const key = 'shadow:' + width.toFixed(2);
  if (geoCache.has(key)) return geoCache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(0,0,0,.42)');
  g.addColorStop(0.55, 'rgba(0,0,0,.16)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * 0.7), mat);
  mesh.userData.isContactShadow = true;
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.002;
  geoCache.set(key, mesh);
  return mesh;
}

function materialsFor(product, sideColour) {
  const front = new THREE.MeshStandardMaterial({ map: labelTexture(product, 'front'), roughness: 0.72, metalness: 0.02 });
  // the back panel is only generated the first time a pack is picked up
  const back = new THREE.MeshStandardMaterial({ color: new THREE.Color(product.colour), roughness: 0.75, metalness: 0.02 });
  back.userData.lazyBack = product;
  const side = new THREE.MeshStandardMaterial({ color: new THREE.Color(sideColour || product.colour), roughness: 0.8, metalness: 0.02 });
  // BoxGeometry material order: +x, -x, +y, -y, +z, -z
  return [side, side, side, side, front, back];
}

export function buildProduct(product, opts = {}) {
  const f = footprint(product);
  const group = new THREE.Group();
  group.userData.product = product;
  let mesh;

  if (product.shape === 'sack' || product.shape === 'pouch' || product.shape === 'box') {
    mesh = new THREE.Mesh(pillowBox(f.w, f.h, f.d, f.bulge), materialsFor(product));
    mesh.position.y = f.h / 2;
  } else if (product.shape === 'bottle') {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(f.r, f.r * 1.03, f.h * 0.72, 24, 1),
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(product.colour), roughness: 0.25, metalness: 0.05,
        clearcoat: 0.7, clearcoatRoughness: 0.25,
      })
    );
    body.position.y = f.h * 0.36;
    const shoulder = new THREE.Mesh(
      new THREE.CylinderGeometry(f.r * 0.55, f.r, f.h * 0.12, 24, 1),
      body.material
    );
    shoulder.position.y = f.h * 0.78;
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(f.r * 0.42, f.r * 0.48, f.h * 0.07, 18, 1),
      body.material
    );
    neck.position.y = f.h * 0.875;
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(f.r * 0.46, f.r * 0.46, f.h * 0.075, 18, 1),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(product.accent), roughness: 0.5 })
    );
    cap.position.y = f.h * 0.945;

    const label = new THREE.Mesh(
      new THREE.CylinderGeometry(f.r * 1.012, f.r * 1.012, f.h * 0.34, 24, 1, true),
      new THREE.MeshStandardMaterial({ map: labelTexture(product, 'front'), roughness: 0.65 })
    );
    label.position.y = f.h * 0.34;

    g.add(body, shoulder, neck, cap, label);
    g.position.y = 0;
    mesh = g;
  } else { // jar
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(f.r, f.r, f.h * 0.8, 24, 1),
      new THREE.MeshPhysicalMaterial({ color: new THREE.Color(product.colour), roughness: 0.3, clearcoat: 0.6 })
    );
    body.position.y = f.h * 0.4;
    const lid = new THREE.Mesh(
      new THREE.CylinderGeometry(f.r * 1.04, f.r * 1.04, f.h * 0.2, 24, 1),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(product.accent), roughness: 0.45 })
    );
    lid.position.y = f.h * 0.9;
    const label = new THREE.Mesh(
      new THREE.CylinderGeometry(f.r * 1.01, f.r * 1.01, f.h * 0.45, 24, 1, true),
      new THREE.MeshStandardMaterial({ map: labelTexture(product, 'front'), roughness: 0.6 })
    );
    label.position.y = f.h * 0.42;
    g.add(body, lid, label);
    mesh = g;
  }

  mesh.castShadow = false;
  group.add(mesh);
  if (opts.shadow !== false) {
    const sh = contactShadow(Math.max(f.w || f.r * 2.4, 0.14) * 1.5);
    sh.userData.isContactShadow = true;
    group.add(sh);
  }

  group.userData.height = f.h;
  group.userData.width = f.w || f.r * 2;
  return group;
}

/* A tiny shelf-edge price tag, drawn to canvas so it stays crisp up close. */
const tagCache = new Map();
export function priceTagTexture(product) {
  if (tagCache.has(product.id)) return tagCache.get(product.id);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fffdf8';
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = product.accent;
  ctx.fillRect(0, 0, 256, 10);
  ctx.fillStyle = '#1b2a20';
  ctx.font = '700 30px Inter, Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(product.name.slice(0, 20), 14, 50);
  ctx.font = '600 20px Inter, Arial, sans-serif';
  ctx.fillStyle = 'rgba(27,42,32,.6)';
  ctx.fillText(product.unit, 14, 78);
  ctx.fillStyle = '#0d6138';
  ctx.font = '800 44px Inter, Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('৳' + product.price, 242, 108);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tagCache.set(product.id, tex);
  return tex;
}

const tagMaterialCache = new Map();
export function priceTag(product) {
  if (!tagMaterialCache.has(product.id)) {
    tagMaterialCache.set(product.id, new THREE.MeshBasicMaterial({ map: priceTagTexture(product) }));
  }
  return new THREE.Mesh(new THREE.PlaneGeometry(0.185, 0.0925), tagMaterialCache.get(product.id));
}


/* Generated on first pick-up: the pack's back panel. */
export function ensureBackTexture(mesh) {
  mesh.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m) => {
      if (!m.userData || !m.userData.lazyBack) return;
      const p = m.userData.lazyBack;
      m.map = labelTexture(p, 'back');
      m.color.set('#ffffff');
      m.needsUpdate = true;
      delete m.userData.lazyBack;
    });
  });
}

/* Small "OFFER / BEST SELLER" card clipped to the shelf edge. */
export function shelfTalker(product, text) {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f47b20';
  ctx.fillRect(0, 0, 320, 128);
  ctx.fillStyle = 'rgba(255,255,255,.22)';
  ctx.fillRect(0, 0, 320, 18);
  ctx.fillStyle = '#fff';
  ctx.font = '800 46px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 160, 58);
  ctx.font = '600 24px Inter, Arial, sans-serif';
  ctx.globalAlpha = 0.92;
  const nm = product.name.length > 20 ? product.name.slice(0, 19) + '…' : product.name;
  ctx.fillText(nm, 160, 100);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.2, 0.08),
    new THREE.MeshBasicMaterial({ map: tex })
  );
  return mesh;
}
