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
  const kg = parseKg(product.weight);
  switch (product.shape) {
    case 'sack':   return { w: 0.30, h: 0.40 + Math.min(kg, 10) * 0.006, d: 0.13, bulge: 0.045 };
    case 'pouch':  return { w: 0.19 + Math.min(kg, 2) * 0.02, h: 0.27, d: 0.075, bulge: 0.022 };
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
  ctx.font = `800 ${H * 0.105}px Inter, Arial, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(String(product.brand || '').toUpperCase(), W * 0.07, H * 0.098);
  ctx.textAlign = 'right';
  ctx.font = `600 ${H * 0.072}px Inter, Arial, sans-serif`;
  ctx.fillText(product.weight || '', W * 0.93, H * 0.098);

  // product name
  ctx.textAlign = 'left';
  ctx.fillStyle = a;
  ctx.font = `800 ${H * 0.115}px Inter, Arial, sans-serif`;
  const nameLines = wrap(ctx, product.name.toUpperCase(), W * 0.86);
  nameLines.slice(0, 3).forEach((line, i) => {
    ctx.fillText(line, W * 0.07, H * (0.32 + i * 0.125));
  });

  // bangla name
  ctx.fillStyle = 'rgba(20,30,20,.82)';
  ctx.font = `600 ${H * 0.088}px "Noto Sans Bengali", "Hind Siliguri", "Nirmala UI", sans-serif`;
  ctx.fillText(product.bn, W * 0.07, H * 0.66);

  // decorative rule
  ctx.strokeStyle = a;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = Math.max(1, H * 0.006);
  ctx.beginPath();
  ctx.moveTo(W * 0.07, H * 0.73);
  ctx.lineTo(W * 0.93, H * 0.73);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // claim line
  ctx.fillStyle = 'rgba(20,30,20,.6)';
  ctx.font = `500 ${H * 0.055}px Inter, Arial, sans-serif`;
  ctx.fillText('Premium quality · selected for you', W * 0.07, H * 0.79);

  // fake barcode strip
  ctx.fillStyle = 'rgba(15,20,15,.85)';
  let x = W * 0.07;
  while (x < W * 0.42) {
    const bwd = 1 + Math.random() * 4;
    ctx.fillRect(x, H * 0.85, bwd, H * 0.10);
    x += bwd + 1 + Math.random() * 3;
  }

  // Shohoj Bazar seller mark
  ctx.fillStyle = a;
  ctx.globalAlpha = 0.9;
  roundedRect(ctx, W * 0.58, H * 0.845, W * 0.35, H * 0.085, H * 0.02);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff';
  ctx.font = `700 ${H * 0.05}px Inter, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('SHOHOJ BAZAR', W * 0.755, H * 0.887);
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

  const W = 512, H = 640;
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
  const back = new THREE.MeshStandardMaterial({ map: labelTexture(product, 'back'), roughness: 0.72, metalness: 0.02 });
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
