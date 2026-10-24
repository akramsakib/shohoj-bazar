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
  // Layout follows the real Bangladeshi pack: patterned bands top and bottom,
  // a brand cartouche, the product name in English and Bangla, and a clear
  // oval window with the grain itself showing through.
  const c = product.colour || '#f3ecdc';
  const a = product.accent || '#0d6138';
  ctx.fillStyle = c;
  ctx.fillRect(0, 0, W, H);

  // soft vertical shading so the pack is not a flat rectangle
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, 'rgba(255,255,255,.30)');
  g.addColorStop(0.5, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(0,0,0,.12)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const diamond = (x, y, r, col) => {
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
  };

  // patterned band helper — the colourful lattice every rice pack wears
  const band = (y0, y1, size) => {
    ctx.save();
    ctx.beginPath(); ctx.rect(0, y0, W, y1 - y0); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.fillRect(0, y0, W, y1 - y0);
    const step = size * 2;
    for (let row = 0; row * step + y0 < y1 + step; row++) {
      for (let col = -1; col * step < W + step; col++) {
        const x = col * step + (row % 2 ? size : 0);
        const y = y0 + row * step;
        const tint = ['rgba(255,255,255,.85)', a, 'rgba(120,180,150,.55)', 'rgba(214,164,196,.55)'][(row + col) % 4];
        diamond(x, y, size * 0.86, tint);
      }
    }
    ctx.restore();
  };

  // top and bottom lattice bands
  band(H * 0.015, H * 0.145, W * 0.075);
  band(H * 0.855, H * 0.985, W * 0.075);

  // solid colour edges so the pack does not bleed into the diamonds
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, W, H * 0.016);
  ctx.fillRect(0, H * 0.984, W, H * 0.016);

  // full-width colour header: the strongest read at shelf distance
  ctx.fillStyle = a;
  ctx.fillRect(0, H * 0.095, W, H * 0.27);
  const hg = ctx.createLinearGradient(0, H * 0.095, 0, H * 0.365);
  hg.addColorStop(0, 'rgba(255,255,255,.22)');
  hg.addColorStop(0.5, 'rgba(255,255,255,.02)');
  hg.addColorStop(1, 'rgba(0,0,0,.22)');
  ctx.fillStyle = hg;
  ctx.fillRect(0, H * 0.095, W, H * 0.27);

  // brand cartouche
  const bw = W * 0.62, bh = H * 0.115, bx = (W - bw) / 2, by = H * 0.175;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.22)';
  ctx.shadowBlur = H * 0.012;
  ctx.shadowOffsetY = H * 0.006;
  ctx.fillStyle = a;
  roundedRect(ctx, bx, by, bw, bh, bh * 0.28);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,.75)';
  ctx.lineWidth = Math.max(1.5, H * 0.006);
  roundedRect(ctx, bx + H * 0.008, by + H * 0.008, bw - H * 0.016, bh - H * 0.016, bh * 0.24);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const brandText = String(product.brand || '').toUpperCase();
  const bsz = fitFont(ctx, brandText, bw * 0.82, H * 0.078, 800);
  ctx.font = `800 ${bsz}px Inter, Arial, sans-serif`;
  ctx.fillText(brandText, W / 2, by + bh * 0.52);

  // product name, English then Bangla
  ctx.textBaseline = 'middle';
  ctx.fillStyle = a;
  const nameEn = product.name.toUpperCase();
  let nsz = fitFont(ctx, nameEn, W * 0.86, H * 0.082, 800);
  ctx.font = `800 ${nsz}px Inter, Arial, sans-serif`;
  ctx.fillText(nameEn, W / 2, H * 0.355);

  ctx.fillStyle = 'rgba(20,30,20,.86)';
  ctx.font = `600 ${H * 0.062}px "Noto Sans Bengali", "Hind Siliguri", "Nirmala UI", sans-serif`;
  ctx.fillText(product.bn, W / 2, H * 0.425);

  // colour footer band, mirroring the header
  ctx.fillStyle = a;
  ctx.fillRect(0, H * 0.845, W, H * 0.05);

  // the window: an oval cut-out with real grain behind glass
  if (product.shape === 'sack' || product.shape === 'pouch' || product.shape === 'box') {
    drawGrainWindow(ctx, product, W * 0.17, H * 0.465, W * 0.66, H * 0.30, true);
  }

  // weight badge
  const wt = (product.weight || '').toUpperCase();
  const ww = W * 0.34, wh = H * 0.072;
  ctx.fillStyle = 'rgba(255,255,255,.92)';
  roundedRect(ctx, (W - ww) / 2, H * 0.785, ww, wh, wh * 0.5);
  ctx.fill();
  ctx.strokeStyle = a;
  ctx.lineWidth = Math.max(1.2, H * 0.005);
  roundedRect(ctx, (W - ww) / 2, H * 0.785, ww, wh, wh * 0.5);
  ctx.stroke();
  ctx.fillStyle = a;
  const wsz = fitFont(ctx, wt, ww * 0.8, H * 0.050, 800);
  ctx.font = `800 ${wsz}px Inter, Arial, sans-serif`;
  ctx.fillText(wt, W / 2, H * 0.822);

  // fine print strip
  ctx.fillStyle = 'rgba(20,30,20,.55)';
  const claim = product.claim || 'Premium quality · selected for you';
  const csz = fitFont(ctx, claim, W * 0.84, H * 0.036, 600);
  ctx.font = `600 ${csz}px Inter, Arial, sans-serif`;
  ctx.fillText(claim, W / 2, H * 0.925);

  // barcode, bottom left corner of the face
  ctx.fillStyle = 'rgba(15,20,15,.8)';
  let x = W * 0.06;
  while (x < W * 0.22) {
    const bwd = 1 + Math.random() * 3;
    ctx.fillRect(x, H * 0.945, bwd, H * 0.028);
    x += bwd + 1 + Math.random() * 2;
  }
  fitFont(ctx, 'SHOHOJ BAZAR', W * 0.34, H * 0.034, 800);
  ctx.textAlign = 'right';
  ctx.fillStyle = a;
  ctx.font = `800 ${H * 0.034}px Inter, Arial, sans-serif`;
  ctx.fillText('SHOHOJ BAZAR', W * 0.94, H * 0.96);
  ctx.textAlign = 'center';
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
function drawGrainWindow(ctx, product, x, y, w, h, oval = false) {
  ctx.save();
  if (oval) {
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  } else {
    roundedRect(ctx, x, y, w, h, h * 0.10);
  }
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

  ctx.strokeStyle = 'rgba(255,255,255,.9)';
  ctx.lineWidth = Math.max(3, w * 0.022);
  if (oval) {
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2 - 2, h / 2 - 2, 0, 0, Math.PI * 2);
  } else {
    roundedRect(ctx, x + 1, y + 1, w - 2, h - 2, h * 0.10);
  }
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

/* soft radial falloff, used for ceiling light halos */
export function glowTexture() {
  if (textureCache.has('__glow')) return textureCache.get('__glow');
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,247,228,.95)');
  g.addColorStop(0.35, 'rgba(255,240,205,.42)');
  g.addColorStop(0.7, 'rgba(255,232,190,.10)');
  g.addColorStop(1, 'rgba(255,232,190,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set('__glow', tex);
  return tex;
}

/* subtle roughness breakup so glossy surfaces are not mirror-perfect */
export function noiseRoughness() {
  if (textureCache.has('__rough')) return textureCache.get('__rough');
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  let seed = 1337;
  for (let i = 0; i < S * S; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const v = 150 + ((seed >> 16) % 60);
    img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  textureCache.set('__rough', tex);
  return tex;
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
  // glossy laminated film: low-ish roughness + env map is what makes it read as plastic
  const front = new THREE.MeshStandardMaterial({
    map: labelTexture(product, 'front'),
    roughness: 0.44, metalness: 0.06, envMapIntensity: 1.35,
    roughnessMap: noiseRoughness(),
  });
  // the back panel is only generated the first time a pack is picked up
  const back = new THREE.MeshStandardMaterial({
    color: new THREE.Color(product.colour), roughness: 0.5, metalness: 0.05, envMapIntensity: 1.2,
  });
  back.userData.lazyBack = product;
  const side = new THREE.MeshStandardMaterial({
    color: new THREE.Color(sideColour || product.colour),
    roughness: 0.62, metalness: 0.03, envMapIntensity: 1.15,
  });
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
