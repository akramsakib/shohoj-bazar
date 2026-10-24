/* The shop itself: street → entrance hall → aisle 1.
   One continuous WebGL scene. Camera "walks"; nothing reloads. */

import * as THREE from '../../vendor/three.module.js';
import { EffectComposer } from '../../vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../../vendor/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from '../../vendor/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from '../../vendor/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from '../../vendor/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from '../../vendor/jsm/postprocessing/OutputPass.js';
import { buildProduct, priceTag, shelfTalker, ensureBackTexture, glowTexture, pbrSet, drawLabel, footprint as packFootprint } from './assets.js';
import { buildPerson } from './people.js';
import { buildCheckoutLane } from './checkout.js';
import { mergeGeometries } from '../../vendor/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from '../../vendor/jsm/loaders/GLTFLoader.js';
import { bakeAndMerge } from './optimize.js';
import { buildAtlas, buildPackField } from './packfield.js';
import { ShopPhysics } from './physics.js';
import { initShopSound, setWalkSpeed, beep, announce } from './sound.js';

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
    // quality tier: phones get the cheap chain, desktops get AO + bloom
    // a phone is narrow in landscape; a 1280x800 laptop window is NOT a phone.
    // (this used Math.min(...) < 820, which quietly gave every 800px-tall desktop
    // the cheap chain — no AO — and that is why it looked flat and papery)
    const small = window.innerWidth < 900 || window.innerHeight < 520;
    const cores = navigator.hardwareConcurrency || 4;
    const forced = new URLSearchParams(location.search).get('q');
    this.tier = forced || (small || cores <= 2 ? 'low' : 'high');
    this.canvas = canvas;
    this.prevTime = performance.now();
    this.mode = 'street';
    this.products = [];
    this.picked = null;
    this.pickedIndex = -1;
    this.physics = new ShopPhysics();
    this.aisleZ = -6.2;
    this.walkTarget = -6.2;
    this.tween = null;
    this.listeners = { pick: [], walk: [] };
    const startAudio = () => {
      initShopSound();
      window.removeEventListener('pointerdown', startAudio);
      window.removeEventListener('keydown', startAudio);
    };
    window.addEventListener('pointerdown', startAudio);
    window.addEventListener('keydown', startAudio);
    // a shop announcement every so often, like the real thing
    setInterval(() => { if (Math.random() < 0.45) announce(); }, 42000);

    this.initRenderer();
    this.initScene();
    this.buildStreet();
    this.buildInterior();
    this.buildAisle(department);
    this.buildTrolley();
    this.yaw = 0;       // free look, horizontal
    this.pitch = 0;     // free look, vertical
    this.walkHold = 0;  // -1 backwards, +1 forwards, while a key is held
    this.moveInput = { f: 0, s: 0 };   // joystick: forward, sideways
    this.lateral = 0;                  // how far you have stepped across the aisle
    this.setCameraVantage('street', true);
    this.initPost();
    this.initAdaptive();
    this.bindInput();
    this.animate();
  }

  on(evt, fn) { (this.listeners[evt] || []).push(fn); }
  emit(evt, data) { (this.listeners[evt] || []).forEach((f) => f(data)); }

  /* ------------------------------------------------------------ plumbing */
  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping || THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    // soft shadows are what separate a render from a shop that looks photographed
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;   // refreshed only when the shopper moves

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
    this.scene.fog = new THREE.FogExp2('#e8dcc4', 0.014);

    this.scene.add(new THREE.HemisphereLight(0xfff2dd, 0x6f6a5c, 0.22));

    // key light with shadows; its shadow camera follows the shopper each frame
    const key = new THREE.DirectionalLight(0xfff2dd, 1.15);
    key.position.set(2.4, 7.5, -6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -6;
    key.shadow.camera.right = 6;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -6;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 24;
    key.shadow.bias = -0.0012;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 2.5;
    this.keyLight = key;
    this.scene.add(key);
    this.scene.add(key.target);

    // image-based lighting from a painted room: gives plastic packs a real sheen
    this.applyEnvironment();

    // a soft light that switches on when you lift a pack into your hand
    this.holdLight = new THREE.PointLight(0xfff4e2, 0, 2.6, 2);
    this.holdLight.position.set(0, 1.8, 0);
    this.scene.add(this.holdLight);

    // The aisle used to carry five more real-time point lights ON TOP of the
    // per-bay lamps that are now baked into the geometry. They lit nothing that
    // was not already baked, and every extra light costs a fragment loop.
    // Only what the bake cannot know about stays dynamic: the hand light above
    // and the checkout hall lamps.
  }

  /* --------------------------------------------------- post processing */
  initPost() {
    const size = new THREE.Vector2();
    this.renderer.getSize(size);

    const target = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType, samples: 4,
    });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.composer.setSize(window.innerWidth, window.innerHeight);

    this.composer.addPass(new RenderPass(this.scene, this.camera));

    if (this.tier !== 'low') {
      // ambient occlusion: the dark creases under shelves and behind packs
      const gtao = new GTAOPass(this.scene, this.camera, window.innerWidth, window.innerHeight);
      gtao.output = GTAOPass.OUTPUT.Default;
      gtao.blendIntensity = 0.95;
      // 8 samples + a smaller denoise kernel: half the AO cost, no visible
      // difference at this radius, and the denoiser hides the rest
      gtao.updateGtaoMaterial({ radius: 0.55, distanceExponent: 1.6, thickness: 1.2, scale: 1.0, samples: 8 });
      gtao.updatePdMaterial({ lumaPhi: 8, depthPhi: 2, normalPhi: 3, radius: 4, rings: 2, samples: 8 });
      this.gtao = gtao;
      this.composer.addPass(gtao);
    }

    // bloom on the ceiling panels and speculars — this is what makes it read as a camera
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      this.tier === 'high' ? 0.09 : 0.08,   // strength
      0.7,                                   // radius
      1.06                                   // threshold: only the lamp tubes glow
    );
    this.bloom = bloom;
    this.composer.addPass(bloom);

    this.composer.addPass(new OutputPass());

    // film grade: gentle lift/gamma, vignette, a touch of grain
    const GradeShader = {
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uVignette: { value: 0.16 },
        uGrain: { value: 0.018 },
        uLift: { value: new THREE.Vector3(0.0, 0.0, 0.0) },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform float uTime, uVignette, uGrain; uniform vec3 uLift;
        varying vec2 vUv;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main(){
          vec4 c = texture2D(tDiffuse, vUv);
          // warm highlight / cool shadow split, like a graded photograph
          vec3 col = c.rgb + uLift;
          col = mix(col, col * vec3(1.02, 1.004, 0.985), smoothstep(0.55, 1.0, dot(col, vec3(0.33))));
          col = mix(col, col * vec3(0.96, 0.985, 1.02), 1.0 - smoothstep(0.0, 0.45, dot(col, vec3(0.33))));
          // vignette
          float d = distance(vUv, vec2(0.5));
          col *= 1.0 - uVignette * smoothstep(0.28, 0.92, d);
          // fine grain so flat walls do not band
          float g = hash(vUv * vec2(1920.0, 1080.0) + uTime) - 0.5;
          col += g * uGrain;
          gl_FragColor = vec4(col, c.a);
        }`,
    };
    this.gradePass = new ShaderPass(GradeShader);
    this.composer.addPass(this.gradePass);

    window.addEventListener('resize', () => {
      this.composer.setSize(window.innerWidth, window.innerHeight);
      if (this.gtao) this.gtao.setSize(window.innerWidth, window.innerHeight);
    });
  }

  /* A painted shop interior used as an environment map. Cheap, and it is the
     single biggest reason PBR packaging stops looking like flat cardboard. */
  applyEnvironment() {
    const W = 1024, H = 512;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');

    // ceiling: bright warm panels
    const ceil = ctx.createLinearGradient(0, 0, 0, H * 0.42);
    ceil.addColorStop(0, '#fffaf0');
    ceil.addColorStop(0.55, '#fdf1da');
    ceil.addColorStop(1, '#e6dcc6');
    ctx.fillStyle = ceil;
    ctx.fillRect(0, 0, W, H * 0.42);

    // ceiling light strips
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = 'rgba(255,255,255,.95)';
      ctx.fillRect(W * (0.06 + i * 0.16), H * 0.06, W * 0.07, H * 0.05);
    }

    // horizon walls, warm cream
    const wall = ctx.createLinearGradient(0, H * 0.42, 0, H * 0.66);
    wall.addColorStop(0, '#f2ead7');
    wall.addColorStop(1, '#ded2b6');
    ctx.fillStyle = wall;
    ctx.fillRect(0, H * 0.42, W, H * 0.24);

    // floor: polished tile
    const flr = ctx.createLinearGradient(0, H * 0.66, 0, H);
    flr.addColorStop(0, '#d9d3c4');
    flr.addColorStop(0.4, '#cfc8b7');
    flr.addColorStop(1, '#b8b1a1');
    ctx.fillStyle = flr;
    ctx.fillRect(0, H * 0.66, W, H * 0.34);

    // a couple of green department fascia blocks so reflections carry the brand
    ctx.fillStyle = 'rgba(13,97,56,.55)';
    ctx.fillRect(W * 0.02, H * 0.36, W * 0.16, H * 0.07);
    ctx.fillRect(W * 0.62, H * 0.36, W * 0.16, H * 0.07);

    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    this.scene.environment = pmrem.fromEquirectangular(tex).texture;
    this.scene.environmentIntensity = 0.55;
    tex.dispose();

    // swap in a captured real-world probe once the 46 KB version downloads
    new THREE.TextureLoader().load('hdri/gear_store_1024.jpg', (hdr) => {
      hdr.mapping = THREE.EquirectangularReflectionMapping;
      hdr.colorSpace = THREE.SRGBColorSpace;
      this.scene.environment = pmrem.fromEquirectangular(hdr).texture;
      this.scene.environmentIntensity = 0.9;   // LDR probe needs a lift
      hdr.dispose();
      pmrem.dispose();
    }, undefined, () => { pmrem.dispose(); });
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
    const insideGlow = new THREE.PointLight(0xffd9a0, 8, 12, 2);
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
        ...pbrSet('terrazzo_tiles', [8.4, 40]),
        roughness: 0.74, metalness: 0.0,
        clearcoat: 0.42, clearcoatRoughness: 0.24, color: '#ffffff', envMapIntensity: 0.85,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -15);
    floor.receiveShadow = true;
    g.add(floor);

    // ceiling with light strips
    const ceil = new THREE.Mesh(
      new THREE.PlaneGeometry(9.5, 46),
      new THREE.MeshStandardMaterial({ color: '#efe9db', roughness: 0.9, side: THREE.DoubleSide })
    );
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, 3.4, -15);
    g.add(ceil);

    const panelMat = new THREE.MeshBasicMaterial({ color: '#fffdf5', toneMapped: false });
    const glowMat = new THREE.MeshBasicMaterial({
      map: glowTexture(), transparent: true, opacity: 0.5, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false,
    });
    for (let z = 2; z > -30; z -= 3.2) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.04, 0.24), panelMat);
      strip.position.set(0, 3.30, z);
      g.add(strip);

      const halo = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.5), glowMat);
      halo.rotation.x = Math.PI / 2;
      halo.position.set(0, 3.24, z);
      g.add(halo);
    }

    // side walls
    const wallMat = new THREE.MeshStandardMaterial({ color: '#f1ebdd', roughness: 0.9 });
    [-4.9, 4.9].forEach((x) => {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(46, 3.4), wallMat);
      w.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2;
      w.position.set(x, 1.7, -15);
      g.add(w);
    });

    // this used to sit at z = -33, i.e. 0.5 m behind the checkout counter: it sealed the
    // shop off and hid the whole checkout hall. Push it past the hall's back wall.
    const back = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 3.4), wallMat);
    back.position.set(0, 1.7, -39.4);
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
    const backMat = new THREE.MeshStandardMaterial({ color: '#aab3a8', roughness: 0.94 });

    const BAY_W = 6.2;
    const SHELF_X = 2.0;
    const LEVELS = dept.layout.levels;
    const LEVEL_H = 0.52;
    const BASE_Y = 0.18;
    const bays = dept.layout.bays;
    const totalLen = bays * BAY_W;
    const slots = [];      // every pack in the department, instanced after stocking
    const AISLE_START_Z = -9.5;
    const AISLE_END_Z = AISLE_START_Z - totalLen;

    this.aisleBounds = { start: AISLE_START_Z, end: AISLE_END_Z };

    for (const side of [-1, 1]) {
      for (let bay = 0; bay < bays; bay++) {
        const bayCentre = AISLE_START_Z - BAY_W / 2 - bay * BAY_W;
        const section = (dept.sections || []).find((sec) => (sec.bays || []).includes(bay));
        const group = new THREE.Group();
        group.position.set(side * SHELF_X, 0, bayCentre);

        const secColour = section ? (section.accent || dept.accent) : (dept.accent || '#0d6138');

        // solid brand-coloured back panel: the single strongest "this is a real shop" cue
        const back = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, LEVELS * LEVEL_H + BASE_Y + 0.12, BAY_W),
          new THREE.MeshStandardMaterial({ color: secColour, roughness: 0.55, metalness: 0.05, envMapIntensity: 1.1 })
        );
        back.position.set(side * 0.3, (LEVELS * LEVEL_H + BASE_Y) / 2, 0);
        back.receiveShadow = true;
        group.add(back);

        // a soft fill inside each shelf bay so packs never sit in a dead shadow
        const fill = new THREE.PointLight(0xfff4e0, 0.85, 2.0, 2);
        fill.position.set(side * (SHELF_X - 0.75), LEVELS * LEVEL_H * 0.55, bayCentre);
        this.scene.add(fill);

        // coloured plinth running along the floor, like a real gondola base
        const plinth = new THREE.Mesh(
          new THREE.BoxGeometry(0.62, BASE_Y + 0.10, BAY_W),
          new THREE.MeshStandardMaterial({ color: secColour, roughness: 0.5, metalness: 0.08 })
        );
        plinth.position.set(0, (BASE_Y + 0.10) / 2, 0);
        plinth.castShadow = true;
        plinth.receiveShadow = true;
        group.add(plinth);

        [-BAY_W / 2, BAY_W / 2].forEach((z) => {
          const up = new THREE.Mesh(
            new THREE.BoxGeometry(0.56, LEVELS * LEVEL_H + BASE_Y + 0.5, 0.07),
            new THREE.MeshStandardMaterial({ color: secColour, roughness: 0.5, metalness: 0.06, envMapIntensity: 1.1 })
          );
          up.position.set(0, (LEVELS * LEVEL_H + BASE_Y + 0.5) / 2, z);
          up.castShadow = true;
          up.receiveShadow = true;
          group.add(up);
        });

        for (let i = 0; i <= LEVELS; i++) {
          const y = BASE_Y + i * LEVEL_H;
          const board = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.045, BAY_W), boardMat);
          board.position.set(0, y, 0);
          board.castShadow = true;
          board.receiveShadow = true;
          group.add(board);
          const railColour = section ? (section.accent || dept.accent || '#0d6138') : '#0d6138';
          const rail = new THREE.Mesh(
            new THREE.BoxGeometry(0.03, 0.075, BAY_W),
            new THREE.MeshStandardMaterial({ color: railColour, roughness: 0.42, metalness: 0.1, envMapIntensity: 1.2 })
          );
          rail.position.set(-side * 0.34, y + 0.045, 0);
          rail.castShadow = false;
          group.add(rail);

          if (i > 0) {
            const led = new THREE.Mesh(
              new THREE.BoxGeometry(0.02, 0.012, BAY_W - 0.25),
              new THREE.MeshBasicMaterial({ color: '#fff6e2', toneMapped: false })
            );
            led.position.set(-side * 0.24, y - 0.028, 0);
            group.add(led);
          }
        }

        /* department fascia + the section that owns this bay */
        const fascia = new THREE.Mesh(
          new THREE.PlaneGeometry(BAY_W, 0.34),
          new THREE.MeshBasicMaterial({
            map: signTexture(
              (section ? section.name : dept.name).toUpperCase(),
              section ? section.nameBn : dept.nameBn,
              (section && section.accent) || dept.accent || '#0d6138'
            ),
          })
        );
        fascia.position.set(-side * 0.31, LEVELS * LEVEL_H + BASE_Y + 0.22, 0);
        fascia.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        group.add(fascia);

        if (section) {
          const tint = new THREE.Mesh(
            new THREE.PlaneGeometry(BAY_W - 0.1, LEVELS * LEVEL_H + BASE_Y - 0.1),
            new THREE.MeshStandardMaterial({
              color: section.accent || dept.accent || '#0d6138',
              roughness: 0.85, metalness: 0, transparent: true, opacity: 0.16,
            })
          );
          tint.position.set(-side * 0.26, (LEVELS * LEVEL_H + BASE_Y) / 2, 0);
          tint.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
          group.add(tint);
        }

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

    /* ---- ceiling services: real shops are never a blank plane ---- */
    const ductMat = new THREE.MeshStandardMaterial({ color: '#b9bdb6', roughness: 0.62, metalness: 0.45 });
    const pipeMat = new THREE.MeshStandardMaterial({ color: '#8f9490', roughness: 0.45, metalness: 0.7 });
    [-1.05, 1.05].forEach((x) => {
      const duct = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, totalLen + 1.0, 14), ductMat);
      duct.rotation.x = Math.PI / 2;
      duct.position.set(x, 3.22, AISLE_START_Z - totalLen / 2 + 0.3);
      aisle.add(duct);
    });
    // actual light sources down the run — the visible tubes above are just trim
    for (let i = 0; i * 3.4 < totalLen + 1; i++) {
      const lamp = new THREE.PointLight(0xfff0d2, 3.6, 12, 2);
      lamp.position.set(0, 3.05, AISLE_START_Z - 1.7 - i * 3.4);
      lamp.userData.baseIntensity = 3.6;
      aisle.add(lamp);
      if (i % 2 === 0) {
        const side1 = new THREE.PointLight(0xfff3da, 2.0, 4.4, 2);
        side1.position.set(0, 2.9, AISLE_START_Z - 2.6 - i * 3.4);
        side1.userData.baseIntensity = 2.0;
        aisle.add(side1);
      }
    }

    // sprinkler main + droppers
    const main = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, totalLen + 1.0, 10), pipeMat);
    main.rotation.x = Math.PI / 2;
    main.position.set(0, 3.30, AISLE_START_Z - totalLen / 2 + 0.3);
    aisle.add(main);
    // hanging linear fixtures: what actually lights a hypermarket aisle
    const tubeMat = new THREE.MeshBasicMaterial({ color: '#fffdf4' });
    const housingMat = new THREE.MeshStandardMaterial({ color: '#d9dbd4', roughness: 0.5, metalness: 0.4 });
    for (let i = 0; i * 2.6 < totalLen; i++) {
      const z = AISLE_START_Z - 1.3 - i * 2.6;
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.10, 1.9), housingMat);
      housing.position.set(0, 3.30, z);
      aisle.add(housing);
      const tube = new THREE.Mesh(new THREE.PlaneGeometry(0.20, 1.78), tubeMat);
      tube.rotation.x = Math.PI / 2;
      tube.position.set(0, 3.24, z);
      aisle.add(tube);
      [-1, 1].forEach((sx) => {
        const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 4), pipeMat);
        wire.position.set(sx * 0.12, 3.42, z);
        aisle.add(wire);
      });
      if (i % 2 === 0) {
        const spr = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.09, 8), pipeMat);
        spr.rotation.x = Math.PI;
        spr.position.set(0, 3.26, z + 1.3);
        aisle.add(spr);
      }
    }

    /* ---- overstock cartons on the gondola tops ---- */
    const cartonTex = (() => {
      const c = document.createElement('canvas');
      c.width = 256; c.height = 192;
      const g = c.getContext('2d');
      g.fillStyle = '#c39a63';
      g.fillRect(0, 0, 256, 192);
      g.fillStyle = 'rgba(255,255,255,.14)';
      for (let i = 0; i < 26; i++) g.fillRect(0, i * 8, 256, 1);
      g.fillStyle = '#7a5230';
      g.fillRect(0, 66, 256, 6);
      g.fillRect(0, 120, 256, 6);
      g.fillStyle = '#2b2118';
      g.fillRect(26, 84, 88, 26);
      g.fillStyle = '#f4ead8';
      g.fillRect(122, 84, 108, 18);
      g.fillStyle = '#2b2118';
      g.fillRect(20, 138, 210, 8);
      g.fillRect(20, 152, 150, 6);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      return t;
    })();
    const cartonMat = new THREE.MeshStandardMaterial({ map: cartonTex, roughness: 0.92, color: '#fff' });
    const cartonBlank = new THREE.MeshStandardMaterial({ color: '#b78f5c', roughness: 0.94 });
    const gondolaTop = BASE_Y + LEVELS * LEVEL_H + 0.06;
    (this.bayGroups || []).forEach((group) => {
      const { side, bay } = group.userData;
      const bayCentre = AISLE_START_Z - BAY_W / 2 - bay * BAY_W;
      const count = 3 + Math.round(Math.abs(Math.sin(bay * 3.7 + side)) * 3);
      for (let i = 0; i < count; i++) {
        const w = 0.34 + ((i * 37) % 5) * 0.04;
        const h = 0.26 + ((i * 53) % 4) * 0.05;
        const d = 0.30 + ((i * 29) % 4) * 0.045;
        const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), i % 3 === 0 ? cartonBlank : cartonMat);
        const col = i % 2;
        const stackH = i > 3 ? h * 0.94 : 0;
        box.position.set(
          side * (SHELF_X - 0.34 - col * 0.13),
          gondolaTop + h / 2 + stackH,
          bayCentre + (i - count / 2) * 0.58 + Math.sin(i * 2.1) * 0.05
        );
        box.rotation.y = Math.sin(bay * 5 + i * 1.7) * 0.09;
        box.castShadow = true;
        aisle.add(box);
      }
      // a low header board capping the gondola, like the colour-coded run ends
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.22, BAY_W - 0.2),
        new THREE.MeshStandardMaterial({ color: group.userData.section?.accent || dept.accent || '#0d6138', roughness: 0.55 })
      );
      cap.position.set(side * (SHELF_X - 0.02), BASE_Y + LEVELS * LEVEL_H + 0.13, bayCentre);
      aisle.add(cap);
    });

    /* ---- stock the shelves ---- */
    const facings = this.portrait ? dept.layout.facings.mobile : dept.layout.facings.desktop;
    const bySection = {};
    dept.products.forEach((p) => { (bySection[p.section] = bySection[p.section] || []).push(p); });
    // deterministic shuffle per bay+level so a shopper sees variety, not wallpaper
    const seeded = (n) => {
      let x = Math.sin(n * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    };

    const talkerMap = {};
    (dept.talkers || []).forEach((t) => { talkerMap[t.productId] = t.text; });

    (this.bayGroups || []).forEach((group) => {
      const { side, bay, section, BAY_W: BW, LEVELS: LV, LEVEL_H: LH, BASE_Y: BY } = group.userData;
      const pool = (bySection[section ? section.id : dept.sections?.[0]?.id] || dept.products);
      const STEP = BW / facings;
      let n = 0;

      for (let level = 0; level < LV; level++) {
        const order = pool
          .map((p, idx) => ({ p, k: seeded(bay * 31 + level * 7 + idx) }))
          .sort((a, b) => a.k - b.k)
          .map((o) => o.p);
        for (let f = 0; f < facings; f++) {
          const product = order[f % order.length];
          n++;
          const z = -BW / 2 + STEP / 2 + f * STEP;

          const jitter = (k) => (Math.sin((product.id.charCodeAt(1) || 1) * 12.9 + k * 78.2) * 43758.5453) % 1;
          const j1 = jitter(level * 10 + f), j2 = jitter(level * 10 + f + 0.5);
          const foot = packFootprint(product);
          slots.push({
            product,
            position: new THREE.Vector3(side * SHELF_X + side * 0.02, BY + level * LH + 0.045 + foot.h / 2,
              group.position.z + z),
            rotation: new THREE.Euler(0, (side < 0 ? Math.PI / 2 : -Math.PI / 2) + (j1 - 0.5) * 0.10, (j2 - 0.5) * 0.05),
            size: foot,
            shadow: level === 0,
          });

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
      const woodMat = new THREE.MeshStandardMaterial({
        ...pbrSet('brown_planks_05', [1, 1]), color: '#c9a06f', roughness: 1.0, metalness: 0,
      });
      const pallet = new THREE.Group();
      for (let i = 0; i < 7; i++) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.024, 0.17), woodMat);
        slat.position.set(0, 0.098, -0.66 + i * 0.22);
        slat.castShadow = true;
        pallet.add(slat);
      }
      [-0.34, 0, 0.34].forEach((x) => {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.075, 1.56), woodMat);
        beam.position.set(x, 0.045, 0);
        pallet.add(beam);
      });
      // saturated promo island, like the yellow block in every hypermarket
      const island = new THREE.Mesh(
        new THREE.BoxGeometry(1.25, 0.055, 2.0),
        new THREE.MeshStandardMaterial({ color: '#f2b705', roughness: 0.42, metalness: 0.05, envMapIntensity: 1.2 })
      );
      island.position.set(1.55, 0.026, AISLE_START_Z - 3.4);
      island.receiveShadow = true;
      aisle.add(island);

      const islandSign = new THREE.Mesh(
        new THREE.PlaneGeometry(1.15, 0.34),
        new THREE.MeshBasicMaterial({ map: signTexture('25 KG SACKS', '২৫ কেজি বস্তা', '#c1121f') })
      );
      islandSign.rotation.y = -Math.PI / 2;
      islandSign.position.set(0.90, 0.95, AISLE_START_Z - 3.4);
      aisle.add(islandSign);

      pallet.position.set(1.55, 0.055, AISLE_START_Z - 3.4);
      aisle.add(pallet);

      (dept.bulk || []).forEach((entry, i) => {
        const product = dept.products.find((p) => p.id === entry.productId);
        if (!product) return;
        // a real 25 kg sack on the floor: 45 cm wide, 72 cm tall, leaning on a pallet
        const sack = { ...product, shape: 'sack', bulkDims: { w: 0.42, h: 0.66, d: 0.20, bulge: 0.07 } };
        for (let c = 0; c < 2; c++) {
          slots.push({
            product,
            position: new THREE.Vector3(
              1.52 + (c === 0 ? -0.02 : 0.03),
              0.11 + 0.10 + c * 0.64 + 0.33,
              AISLE_START_Z - 3.05 - i * 0.58 + (c === 0 ? 0 : 0.02)
            ),
            rotation: new THREE.Euler(0, (c === 1 ? 0.10 : -0.06), (c === 1 ? 0.02 : 0)),
            size: { w: 0.42, h: 0.66, d: 0.20 },
            shadow: c === 0,
          });
        }
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

    // promo cards on the endcap face, at eye height, clear of the hanging signs
    ['SAVE UP TO 20%', 'FRESH DAILY'].forEach((t, i) => {
      const card = new THREE.Mesh(
        new THREE.PlaneGeometry(1.15, 0.42),
        new THREE.MeshBasicMaterial({
          map: signTexture(t, i ? 'প্রতিদিন তাজা' : 'সাশ্রয় করুন', i ? '#a2601a' : '#8a2f2a'),
        })
      );
      card.position.set((i ? 1 : -1) * 0.85, 1.28, AISLE_END_Z + 0.93);
      aisle.add(card);
    });

    const endcap = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 1.6, 0.7),
      new THREE.MeshStandardMaterial({ color: '#f2ede0', roughness: 0.8 })
    );
    // the end-of-aisle display used to sit 0.6 m PAST the aisle end — i.e. in the
    // middle of the checkout hall, right where the shopper stands to pay
    endcap.position.set(0, 0.8, AISLE_END_Z + 0.55);
    aisle.add(endcap);

    /* ---- upper-wall promo panels, like the posters every real aisle carries ---- */
    const promos = [
      ['TODAY ONLY', 'আজকের অফার', '#8a2f2a'],
      ['FREE DELIVERY', 'ফ্রি ডেলিভারি', '#0d6138'],
      ['FRESH STOCK', 'নতুন স্টক', '#a2601a'],
      ['WEIGH & PACK', 'ওজন করে প্যাক', '#1f5f8b'],
    ];
    for (let i = 0; i < Math.ceil(totalLen / BAY_W); i++) {
      const z = AISLE_START_Z - BAY_W / 2 - i * BAY_W;
      [-1, 1].forEach((side) => {
        const promo = promos[(i + (side > 0 ? 1 : 0)) % promos.length];
        const panel = new THREE.Mesh(
          new THREE.PlaneGeometry(2.6, 0.78),
          new THREE.MeshBasicMaterial({ map: signTexture(promo[0], promo[1], promo[2]) })
        );
        panel.position.set(side * 2.39, 2.62, z);
        panel.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        aisle.add(panel);
      });
    }

    /* ---- floor stickers, the way supermarkets mark their own aisles ---- */
    [AISLE_START_Z - 3.4, AISLE_START_Z - 11.5].forEach((z, i) => {
      const decal = new THREE.Mesh(
        new THREE.PlaneGeometry(1.2, 0.66),
        new THREE.MeshBasicMaterial({
          map: signTexture(i ? 'ARROWS AHEAD' : 'START HERE', i ? 'সামনে চলুন' : 'এখান থেকে শুরু',
            i ? '#1f5f8b' : '#0d6138'),
          transparent: true, opacity: 0.9, depthWrite: false,
        })
      );
      decal.rotation.set(-Math.PI / 2, 0, 0);
      decal.position.set(-0.62, 0.012, z);
      aisle.add(decal);
    });

    /* ---- numbered aisle pendants: big numerals, readable from the entrance ---- */
    const wireMat = new THREE.MeshStandardMaterial({ color: '#9aa39c', roughness: 0.5, metalness: 0.4 });
    (dept.sections || []).forEach((sec, i) => {
      const bays = sec.bays || [0];
      const lastBay = bays[bays.length - 1];
      const z = AISLE_START_Z - (lastBay + 1) * BAY_W + 0.5;
      if (z > AISLE_START_Z - 4.2) return;   // never hang one in your face at the mouth

      const num = String(i + 1).padStart(2, '0');
      const W = 1.75, H = 0.84;
      const c = document.createElement('canvas');
      c.width = 512; c.height = 244;
      const ctx = c.getContext('2d');
      const col = sec.accent || '#0d6138';
      ctx.fillStyle = col; ctx.fillRect(0, 0, 512, 244);
      ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(0, 0, 512, 44);
      ctx.fillStyle = '#fff';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.font = '900 118px Inter, Arial, sans-serif';
      ctx.fillText(num, 122, 118);
      ctx.textAlign = 'left';
      const label = sec.name.toUpperCase();
      let lsz = 46;
      ctx.font = `800 ${lsz}px Inter, Arial, sans-serif`;
      while (ctx.measureText(label).width > 250 && lsz > 22) {
        lsz -= 2;
        ctx.font = `800 ${lsz}px Inter, Arial, sans-serif`;
      }
      ctx.fillText(label, 232, 96);
      let bsz = 32;
      ctx.font = `600 ${bsz}px "Noto Sans Bengali","Hind Siliguri",sans-serif`;
      while (ctx.measureText(sec.nameBn).width > 250 && bsz > 18) {
        bsz -= 2;
        ctx.font = `600 ${bsz}px "Noto Sans Bengali","Hind Siliguri",sans-serif`;
      }
      ctx.fillStyle = 'rgba(255,255,255,.86)';
      ctx.fillText(sec.nameBn, 232, 148);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;

      const board = new THREE.Mesh(
        new THREE.BoxGeometry(W, H, 0.05),
        [
          new THREE.MeshBasicMaterial({ color: col }), new THREE.MeshBasicMaterial({ color: col }),
          new THREE.MeshBasicMaterial({ color: col }), new THREE.MeshBasicMaterial({ color: col }),
          new THREE.MeshBasicMaterial({ map: tex }), new THREE.MeshBasicMaterial({ map: tex }),
        ]
      );
      board.position.set(0, 2.66, z);
      aisle.add(board);
      [-0.66, 0.66].forEach((x) => {
        const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.52, 5), wireMat);
        wire.position.set(x, 3.34, z);
        aisle.add(wire);
      });
    });

    /* ---- people: a shop with nobody in it is a showroom, not a super shop ---- */
    this.people = [];
    const cast = [
      { x: -1.48, z: AISLE_START_Z - 8.5, speed: 0.46, dir: -1, opts: { shirt: '#3d6b78', tunic: '#3d6b78', trousers: '#2b3038', scarf: '#a63a44', height: 1.62, build: 'slim' } },
      { x: 1.52, z: AISLE_START_Z - 16.0, speed: 0.62, dir: 1, opts: { shirt: '#d9d3c4', trousers: '#3a3f46', height: 1.71 } },
      { x: -1.42, z: AISLE_START_Z - 27.0, speed: 0.42, dir: 1, opts: { shirt: '#5d7050', tunic: '#5d7050', trousers: '#22262b', height: 1.66, build: 'slim' } },
      { x: 1.46, z: AISLE_START_Z - 35.0, speed: 0.55, dir: -1, opts: { shirt: '#8a5a2b', trousers: '#2b3038', height: 1.75 } },
      { x: -1.50, z: AISLE_START_Z - 45.0, speed: 0.50, dir: 1, opts: { shirt: '#6f5a78', tunic: '#6f5a78', trousers: '#33383f', scarf: '#d8c390', height: 1.58, build: 'slim' } },
    ];
    cast.forEach((c) => {
      const person = buildPerson(c.opts);
      person.position.set(c.x, 0, c.z);
      person.rotation.y = c.dir > 0 ? 0 : Math.PI;
      aisle.add(person);
      this.people.push({
        group: person, x: c.x, z: c.z, speed: c.speed, dir: c.dir, person,
        // each shopper works their own stretch of the aisle instead of the whole run
        lo: Math.max(AISLE_END_Z + 2.0, c.z - 4.5),
        hi: Math.min(AISLE_START_Z - 1.5, c.z + 4.5),
      });
    });
    // one of ours on the floor, standing at the weigh counter with an apron on
    const staffer = buildPerson({ shirt: '#f4f1e8', trousers: '#22262b', apron: '#0d6138', height: 1.64, build: 'slim' });
    staffer.position.set(-0.55, 0, AISLE_END_Z + 2.1);
    staffer.rotation.y = Math.PI * 0.94;
    aisle.add(staffer);
    this.people.push({ group: staffer, x: -0.55, z: AISLE_END_Z + 2.1, speed: 0, dir: 1, person: staffer });

    /* ---- checkout hall at the end of the run ---- */
    const CZ = AISLE_END_Z - 4.4;
    this.checkoutZ = CZ;
    // the interior floor already covers the checkout hall — a second plane here
    // just z-fought and blew out at grazing angles
    const hallCeil = new THREE.Mesh(
      new THREE.BoxGeometry(5.0, 0.1, 9.6),
      new THREE.MeshStandardMaterial({ color: '#f1ebdc', roughness: 0.92 })
    );
    hallCeil.position.set(0, 3.5, CZ - 1.5);
    aisle.add(hallCeil);
    const hallWall = new THREE.Mesh(
      new THREE.BoxGeometry(5.06, 3.5, 0.12),
      new THREE.MeshStandardMaterial({ color: '#d3dbd2', roughness: 0.95 })
    );
    hallWall.position.set(0, 1.75, CZ - 5.6);
    aisle.add(hallWall);

    [-2.5, 2.5].forEach((hx) => {
      const sideWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 3.5, 9.6),
        new THREE.MeshStandardMaterial({ color: '#e4ddcb', roughness: 0.95 })
      );
      sideWall.position.set(hx, 1.75, CZ - 1.0);
      aisle.add(sideWall);
    });

    // the big "CHECKOUT" board you can read from halfway down the aisle
    const coSign = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 0.62),
      new THREE.MeshBasicMaterial({ map: signTexture('CHECKOUT', 'চেকআউট · পেমেন্ট', '#c1121f') })
    );
    coSign.position.set(0, 2.02, CZ - 5.52);
    aisle.add(coSign);
    const wallBand = new THREE.Mesh(
      new THREE.BoxGeometry(5.0, 0.34, 0.06),
      new THREE.MeshStandardMaterial({ color: '#0d6138', roughness: 0.6 })
    );
    wallBand.position.set(0, 0.42, CZ - 5.53);
    aisle.add(wallBand);
    const wallBand2 = new THREE.Mesh(
      new THREE.BoxGeometry(5.0, 0.10, 0.06),
      new THREE.MeshStandardMaterial({ color: '#c1121f', roughness: 0.6 })
    );
    wallBand2.position.set(0, 0.66, CZ - 5.53);
    aisle.add(wallBand2);

    /* ---- the wall you stare at while you pay: impulse shelves, posters, a clock ---- */
    const impulseMat = new THREE.MeshStandardMaterial({ color: '#e6dfcd', roughness: 0.8 });
    const impulseX = [-1.42, 1.42];
    impulseX.forEach((ix) => {
      const rack = new THREE.Mesh(new THREE.BoxGeometry(1.24, 1.5, 0.3), impulseMat);
      rack.position.set(ix, 0.75, CZ - 5.16);
      rack.castShadow = true;
      aisle.add(rack);
      // three rows of small packs, coloured so the wall is not a blank slab
      const hues = ['#c1121f', '#0d6138', '#a2601a', '#2f4f9e', '#8a2f2a', '#6b3f8f'];
      for (let row = 0; row < 3; row++) {
        for (let k = 0; k < 4; k++) {
          const pack = new THREE.Mesh(
            new THREE.BoxGeometry(0.24, 0.30, 0.14),
            new THREE.MeshStandardMaterial({ color: hues[(row * 4 + k + ix * 3) % hues.length | 0], roughness: 0.62 })
          );
          pack.position.set(ix - 0.45 + k * 0.30, 0.34 + row * 0.44, CZ - 4.99);
          aisle.add(pack);
        }
      }
      const shelfEdge = new THREE.Mesh(
        new THREE.BoxGeometry(1.24, 0.05, 0.32),
        new THREE.MeshStandardMaterial({ color: '#f2eee2', roughness: 0.5, metalness: 0.25 })
      );
      shelfEdge.position.set(ix, 1.53, CZ - 5.16);
      aisle.add(shelfEdge);
    });

    // lightbox poster over the wall
    const poster = new THREE.Mesh(
      new THREE.PlaneGeometry(2.1, 0.86),
      new THREE.MeshBasicMaterial({ map: signTexture('THANK YOU', 'ধন্যবাদ · আবার আসবেন', '#0d6138'), toneMapped: false })
    );
    poster.position.set(0, 2.86, CZ - 5.5);
    aisle.add(poster);
    // and a wall clock, because every one of these shops has the same one
    const clockFace = new THREE.Mesh(
      new THREE.CircleGeometry(0.24, 24),
      new THREE.MeshStandardMaterial({ color: '#f7f4ea', roughness: 0.7 })
    );
    clockFace.position.set(-2.02, 2.86, CZ - 5.5);
    aisle.add(clockFace);
    const clockHands = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.17, 0.01),
      new THREE.MeshStandardMaterial({ color: '#20262a', roughness: 0.6 })
    );
    clockHands.position.set(-2.02, 2.91, CZ - 5.49);
    clockHands.rotation.z = 0.4;
    aisle.add(clockHands);

    [-2.6, 2.6].forEach((lx) => {
      const lamp = new THREE.PointLight(0xfff0d2, 1.7, 10, 2);
      lamp.position.set(lx, 3.05, CZ - 0.6);
      lamp.userData.baseIntensity = 1.7;
      aisle.add(lamp);
    });
    for (let i = 0; i < 2; i++) {
      const housing = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.09, 0.30), new THREE.MeshStandardMaterial({ color: '#d9dbd4', roughness: 0.5, metalness: 0.4 }));
      housing.position.set(0, 3.24, CZ - 1.5 - i * 2.4);
      aisle.add(housing);
      const tube = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.20), new THREE.MeshBasicMaterial({ color: '#fffdf4' }));
      tube.rotation.x = Math.PI / 2;
      tube.position.set(0, 3.19, CZ - 1.5 - i * 2.4);
      aisle.add(tube);
    }

    /* ---- one instanced field for every pack in the department ---- */
    const atlas = buildAtlas(dept.products, drawLabel);
    this.packField = buildPackField(slots, atlas);
    this.packField.mesh.castShadow = true;
    aisle.add(this.packField.mesh);
    this.products = [this.packField.mesh];        // what the raycaster hits
    this.packAtlas = atlas;
    console.info('[packs]', slots.length, 'packs in one instanced field');

    /* ---- physical world: the things you cannot walk through ---- */
    const P = this.physics;
    const midZ = (AISLE_START_Z + AISLE_END_Z) / 2;
    const runLen = Math.abs(AISLE_START_Z - AISLE_END_Z);
    // the two shelving runs
    [-1, 1].forEach((side) => {
      P.addBox({ x: 0.42, y: 1.35, z: runLen / 2 },
        { x: side * (SHELF_X + 0.22), y: 1.35, z: midZ });
    });
    // checkout counter, bagging shelf and the hall walls
    P.addBox({ x: 1.7, y: 0.44, z: 0.475 }, { x: 0, y: 0.44, z: CZ });
    P.addBox({ x: 0.35, y: 0.44, z: 0.4 }, { x: 1.95, y: 0.44, z: CZ });
    P.addBox({ x: 2.55, y: 1.75, z: 0.1 }, { x: -2.55, y: 1.75, z: CZ - 1.0 });
    P.addBox({ x: 2.55, y: 1.75, z: 0.1 }, { x: 2.55, y: 1.75, z: CZ - 1.0 });
    P.addBox({ x: 2.55, y: 1.75, z: 0.1 }, { x: 0, y: 1.75, z: CZ - 5.55 });
    // weigh counter at the end of the run, and the promo island at the mouth
    P.addBox({ x: 2.1, y: 0.8, z: 0.35 }, { x: 0, y: 0.8, z: AISLE_END_Z + 0.55 });
    P.addBox({ x: 0.62, y: 0.06, z: 1.0 }, { x: 1.55, y: 0.06, z: AISLE_START_Z - 3.4 });

    this.checkout = buildCheckoutLane(CZ, 0);
    aisle.add(this.checkout.group);
    this.checkoutQueue = [];
    this.checkoutTimer = 0;

    this.scene.add(aisle);
    this.aisleGroup = aisle;

    /* One-time static pass: weld the shelving into batches and bake the lamps
       into the geometry. Everything pickable or animated is left alone. */
    const skip = new Set([this.checkout.group, ...this.products, ...this.people.map((p) => p.group)]);
    if (this.trolley) skip.add(this.trolley);
    try {
      this.bakeStats = bakeAndMerge(aisle, { exclude: skip, ambient: 0x241f18, scale: 1.0, wrap: 0.4 });
      console.info('[optimise]', JSON.stringify(this.bakeStats));
    } catch (e) {
      console.warn('[optimise] skipped', e);
    }
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

  /* ------------------------------------------------------------- trolley */
  buildTrolley() {
    const g = new THREE.Group();
    g.name = 'trolley';

    const steel = new THREE.MeshStandardMaterial({ color: '#c2cbd0', roughness: 0.42, metalness: 0.6, envMapIntensity: 1.15 });
    const wire = new THREE.MeshStandardMaterial({ color: '#b7c0c5', roughness: 0.45, metalness: 0.55, envMapIntensity: 1.1 });
    const rubber = new THREE.MeshStandardMaterial({ color: '#23272b', roughness: 0.85, metalness: 0.05 });
    const gripMat = new THREE.MeshStandardMaterial({ color: '#0d6138', roughness: 0.36, metalness: 0.05 });

    // real supermarket proportions: 0.52 m wide, 0.80 m deep, basket top at 0.95 m
    const W = 0.52, L = 0.80;
    const FLOOR = 0.42, RIM = 0.95;
    const H = RIM - FLOOR;
    const BAR = 0.0062;

    const bars = [];
    const pushBar = (w, h, d, x, y, z) => {
      const b = new THREE.BoxGeometry(w, h, d);
      b.translate(x, y, z);
      bars.push(b);
    };
    const latticeWall = (len, height, along, x, y, z) => {
      const n = Math.max(4, Math.round(len / 0.072));
      for (let i = 0; i <= n; i++) {
        const t = -len / 2 + (i * len) / n;
        if (along === 'x') pushBar(BAR, height, BAR, x + t, y + height / 2, z);
        else pushBar(BAR, height, BAR, x, y + height / 2, z + t);
      }
      for (let j = 0; j <= 3; j++) {
        const yy = y + (j * height) / 3;
        if (along === 'x') pushBar(len, BAR, BAR, x, yy, z);
        else pushBar(BAR, BAR, len, x, yy, z);
      }
    };

    /* ---- basket: open wire on all four sides ---- */
    latticeWall(W, H, 'x', 0, FLOOR, -L / 2);          // front
    latticeWall(W, H * 0.55, 'x', 0, FLOOR, L / 2);    // back, low so you can see in
    latticeWall(L, H, 'z', -W / 2, FLOOR, 0);
    latticeWall(L, H, 'z', W / 2, FLOOR, 0);
    for (let i = 0; i <= 11; i++) pushBar(W, BAR, BAR, 0, FLOOR + 0.004, -L / 2 + (i * L) / 11);
    for (let i = 0; i <= 7; i++) pushBar(BAR, BAR, L, -W / 2 + (i * W) / 7, FLOOR + 0.004, 0);

    /* ---- underframe and legs, so the basket is carried, not floating ---- */
    [-1, 1].forEach((sx) => {
      [-1, 1].forEach((sz) => {
        // castor bracket + wheel
        const fork = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.075, 0.026), steel);
        fork.position.set(sx * (W / 2 - 0.05), 0.105, sz * (L / 2 - 0.09));
        g.add(fork);
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.028, 14), rubber);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(sx * (W / 2 - 0.05), 0.048, sz * (L / 2 - 0.09));
        g.add(wheel);
      });
      // leg from the wheel up to the basket floor
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.022, FLOOR - 0.13, 0.022), steel);
      leg.position.set(sx * (W / 2 - 0.035), 0.13 + (FLOOR - 0.13) / 2, 0);
      g.add(leg);
      // lower chassis rail
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.022, L - 0.05), steel);
      rail.position.set(sx * (W / 2 - 0.035), 0.135, 0);
      g.add(rail);
      // upper rail the basket sits on
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.026, L - 0.02), steel);
      upper.position.set(sx * (W / 2 - 0.012), FLOOR, 0);
      g.add(upper);
    });
    [-1, 1].forEach((sz) => {
      const cross = new THREE.Mesh(new THREE.BoxGeometry(W - 0.05, 0.022, 0.022), steel);
      cross.position.set(0, 0.135, sz * (L / 2 - 0.09));
      g.add(cross);
      const upperCross = new THREE.Mesh(new THREE.BoxGeometry(W + 0.02, 0.026, 0.026), steel);
      upperCross.position.set(0, FLOOR, sz * (L / 2));
      g.add(upperCross);
    });

    /* ---- handle: two uprights and the grip you actually hold ---- */
    [-1, 1].forEach((sx) => {
      const up = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.12, 0.024), steel);
      up.position.set(sx * (W / 2), RIM + 0.05, L / 2 - 0.015);
      up.rotation.x = -0.20;
      g.add(up);
    });
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, W + 0.02, 12), steel);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, RIM + 0.105, L / 2 - 0.045);
    g.add(bar);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, W * 0.72, 14), gripMat);
    grip.rotation.z = Math.PI / 2;
    grip.position.set(0, RIM + 0.105, L / 2 - 0.045);
    g.add(grip);

    /* ---- the wire basket itself, one merged opaque mesh ---- */
    const basketGeo = mergeGeometries(bars, false);
    const basketMesh = new THREE.Mesh(basketGeo, wire);
    basketMesh.castShadow = false;
    basketMesh.receiveShadow = false;
    g.add(basketMesh);

    // items dropped into the basket live here
    this.basket = new THREE.Group();
    g.add(this.basket);

    // a soft contact shadow that travels with the trolley — without it the basket
    // floats, however good the wire is
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = shadowCanvas.height = 128;
    const sctx = shadowCanvas.getContext('2d');
    const grad = sctx.createRadialGradient(64, 64, 6, 64, 64, 62);
    grad.addColorStop(0, 'rgba(0,0,0,.55)');
    grad.addColorStop(0.5, 'rgba(0,0,0,.26)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 128, 128);
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    this.trolleyShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.05, 1.35),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.9 })
    );
    this.trolleyShadow.rotation.x = -Math.PI / 2;
    this.trolleyShadow.position.y = 0.004;
    this.trolleyShadow.renderOrder = 1;
    this.scene.add(this.trolleyShadow);

    this.trolleyBody = g;
    g.visible = false;
    this.trolley = g;
    this.scene.add(g);
    if (typeof window !== 'undefined') window.__THREE = THREE;
    this.loadTrolleyModel();
  }

  /* Swap the hand-built trolley for the one modelled in Blender. */
  loadTrolleyModel() {
    new GLTFLoader().load('models/trolley.glb', (gltf) => {
      const model = gltf.scene;
      model.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = false;
          o.receiveShadow = false;
          o.frustumCulled = false;
          if (o.material) o.material.envMapIntensity = 1.0;
        }
      });
      // keep the item anchor, drop everything that was built by hand
      const keep = this.basket;
      [...this.trolley.children].forEach((c) => {
        if (c !== keep) this.trolley.remove(c);
      });
      // the wire was reading as pale white spray against a bright hall
      model.traverse((o) => {
        if (!o.isMesh || !o.material) return;
        const m = o.material;
        if (m.metalness !== undefined) { m.metalness = Math.min(m.metalness, 0.62); }
        if (m.roughness !== undefined) { m.roughness = Math.max(m.roughness, 0.34); }
        m.envMapIntensity = 0.55;
        m.needsUpdate = true;
      });
      this.trolley.add(model);
      this.trolley.userData.modelled = true;
      // the trolley becomes a rigid body: compound basket, driven by a spring
      this.physics.attachTrolley(this.trolley, {
        halfW: 0.26, halfL: 0.43, floorY: 0.46, rimY: 0.95,
      });
    }, undefined, (err) => {
      console.warn('trolley model failed to load, keeping the built one', err);
    });
  }

  takeTrolley() {
    if (!this.trolley) return;
    this.trolley.visible = true;
    this.updateTrolley(1);
  }

  /* Put a pack in the basket. It is a rigid body now: it falls, hits the others,
     tumbles and settles wherever the physics leaves it. */
  putInTrolley(product) {
    if (!this.trolley) return;
    this.takeTrolley();
    const mesh = buildProduct({ ...product, shape: product.shape }, { shadow: false });
    const box = new THREE.Box3().setFromObject(mesh);
    const h = Math.max(box.max.y - box.min.y, 0.1);
    const s = THREE.MathUtils.clamp(0.34 / h, 0.30, 1.0);
    mesh.scale.setScalar(s);
    const size = {
      w: Math.max((box.max.x - box.min.x) * s, 0.06),
      h: Math.max(h * s, 0.06),
      d: Math.max((box.max.z - box.min.z) * s, 0.06),
    };
    // make sure the body is where the trolley actually is before we aim a drop
    if (this.physics.trolley) {
      const tb = this.physics.trolley.body;
      if (Math.hypot(tb.position.x - this.trolley.position.x, tb.position.z - this.trolley.position.z) > 1.2) {
        this.physics.teleportTrolley(this.trolley.position.x, this.trolley.position.z);
      }
    }
    // buildProduct sits its origin on the base; the body's origin is the centre
    mesh.geometry && mesh.geometry.center && 0;
    const drop = this.physics.basketDropPoint((Math.random() - 0.5) * 0.22);
    drop.y += 0.16 + Math.random() * 0.05;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.random() * Math.PI, 0));
    // the pack artwork sits on its base; a rigid body's origin is its centre, so
    // wrap it and shift it down half its height inside the holder
    const holder = new THREE.Group();
    mesh.position.y = -size.h / 2;
    holder.add(mesh);
    this.scene.add(holder);
    const entry = this.physics.addPack(holder, size, drop, q);
    entry.body.angularVelocity.set((Math.random() - 0.5) * 1.2, 0, (Math.random() - 0.5) * 1.2);
    // stay in WORLD space: physics writes world transforms, so parenting these to
    // the trolley group applied its transform twice and fired the packs down the aisle
    this.basketWorldSpace = true;
    this.basketPacks = this.basketPacks || [];
    this.basketPacks.push(entry);
    return entry;
  }

  updateTrolley(dt) {
    if (!this.trolley || !this.trolley.visible) return;
    const cam = this.camera;
    if (this.mode === 'checkout') {
      // parked beside the belt, clear of the counter — physics stops it there
      const parked = new THREE.Vector3(0.98, 0, (this.checkoutZ || -30) + 2.35);
      if (this.trolley.position.distanceTo(parked) > 1.0) {
        // move the trolley AND its contents; snapping the body alone used to
        // leave a full basket of shopping behind in the middle of the hall
        if (this.physics.trolley) this.physics.trolley.yaw = Math.PI * 0.5;
        this.physics.teleportTrolley(parked.x, parked.z);
        this.trolley.position.copy(parked);
      }
      this.physics.updateTrolley(parked, dt);
      this.physics.syncTrolley();
      this.trolley.rotation.y = Math.PI * 0.5;
      this.syncTrolleyShadow();
      return;
    }
    const fwd = new THREE.Vector3();
    cam.getWorldDirection(fwd);
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);
    fwd.normalize();
    if (this.trolleyHeading === undefined) this.trolleyHeading = Math.atan2(fwd.x, fwd.z);
    let want = Math.atan2(fwd.x, fwd.z);
    let d = want - this.trolleyHeading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.trolleyHeading += THREE.MathUtils.clamp(d, -1.6 * dt, 1.6 * dt);
    const body = new THREE.Vector3(Math.sin(this.trolleyHeading), 0, Math.cos(this.trolleyHeading));
    const target = cam.position.clone().addScaledVector(body, this.portrait ? 1.45 : 1.72);
    target.y = 0;
    this.physics.updateTrolley(target, dt);
    this.physics.syncTrolley();
    this.syncTrolleyShadow();
  }

  syncTrolleyShadow() {
    if (!this.trolleyShadow || !this.trolley) return;
    this.trolleyShadow.visible = this.trolley.visible;
    this.trolleyShadow.position.x = this.trolley.position.x;
    this.trolleyShadow.position.z = this.trolley.position.z;
    this.trolleyShadow.rotation.z = -this.trolley.rotation.y;
  }

  /* ------------------------------------------------------------ checkout */
  goToCheckout() {
    this.setCameraVantage('checkout');
    this.checkout && this.checkout.reset();
    this.checkoutQueue = [];
    this.checkoutRunning = false;
  }

  /** lines: [{product, qty}] — puts them on the belt one at a time */
  startCheckout(lines, onScanned, onDone, onAll) {
    if (!this.checkout) return;
    this.checkout.reset();
    const queue = [];
    lines.forEach((l) => {
      for (let i = 0; i < l.qty; i++) queue.push(l.product);
    });
    this.checkoutQueue = queue;
    this.checkoutOnScanned = onScanned;
    this.checkoutOnDone = onDone;
    this.checkoutOnAll = onAll;
    this.checkoutTimer = 0.5;
    this.checkoutRunning = true;
    this.checkoutEmptyAt = null;
  }

  updateCheckout(dt) {
    if (!this.checkout) return;
    const scanned = this.checkout.update(dt, (meta) => {
      beep('scan');
      if (this.checkoutOnScanned) this.checkoutOnScanned(meta);
    });

    if (!this.checkoutRunning) return;

    if (this.checkoutQueue.length) {
      this.checkoutTimer -= dt;
      if (this.checkoutTimer <= 0) {
        const product = this.checkoutQueue.shift();
        const pack = buildProduct(product, { shadow: false });
        const box = new THREE.Box3().setFromObject(pack);
        const size = new THREE.Vector3();
        box.getSize(size);
        const k = Math.min(0.34 / Math.max(size.x, size.y, size.z), 1.4);
        pack.scale.setScalar(k);
        this.checkout.load(pack, {
          name: product.name, price: Math.round(product.price), unit: product.unit,
        });
        this.checkoutTimer = 0.85;
        if (!this.checkoutQueue.length) this.checkoutEmptyAt = null;
      }
    } else if (scanned && this.checkoutEmptyAt === null) {
      // last pack just went through the scanner
      this.checkoutEmptyAt = 0.9;
    }

    if (this.checkoutEmptyAt !== null) {
      this.checkoutEmptyAt -= dt;
      if (this.checkoutEmptyAt <= 0) {
        this.checkoutRunning = false;
        this.checkoutEmptyAt = null;
        if (this.checkoutOnAll) this.checkoutOnAll();
      }
    }
  }

  /* -------------------------------------------------------------- camera */
  vantages() {
    return {
      street: { pos: new THREE.Vector3(0, 1.68, 15.4), look: new THREE.Vector3(0, 3.15, 5.2) },
      hall:   { pos: new THREE.Vector3(0, 1.6, 1.8),  look: new THREE.Vector3(0, 1.5, -9) },
      aisle:  { pos: new THREE.Vector3(0, 1.55, this.aisleZ), look: new THREE.Vector3(0, 1.3, this.aisleZ - 8) },
      checkout: { pos: new THREE.Vector3(0.40, 1.66, (this.checkoutZ || -30) + 3.6), look: new THREE.Vector3(0.55, 1.02, (this.checkoutZ || -30) + 0.1) },

    };
  }

  setCameraVantage(name, instant = false) {
    const v = this.vantages()[name];
    if (name !== 'aisle' && this.mode === 'aisle') this.camera.position.x = 0;
    this.mode = name;
    if (name === 'aisle') {
      // you are pushing a trolley the moment you step into the run
      this.takeTrolley();
      if (this.pitch > -0.02 && this.pitch < 0.02) this.pitch = -0.075;
    }
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
      start: performance.now(),
      t: 0,
      dur: 1.5,
    };
  }

  enterShop() {
    this.recentreLook();
    this.lateral = 0;
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
      if (hit.instanceId !== undefined && this.packField) {
        const product = this.packField.products[hit.instanceId];
        if (product) return this.heroFor(product, hit.instanceId);
      }
      let obj = hit.object;
      while (obj && !obj.userData.product) obj = obj.parent;
      if (obj && obj.userData.product) return obj;
    }
    return null;
  }

  /* A single, fully detailed pack for the one product you are holding.
     The shelf stock is instanced, so the hero is built on demand, placed in the
     slot it came from, and the instance in that slot is hidden — take a pack off
     the shelf and the shelf shows the gap, exactly like the real thing. */
  heroFor(product, index) {
    if (index === undefined && this.packField) index = this.packField.indexOf(product.id);
    if (this.picked) this.release();
    if (this.hero && this.hero.parent) this.hero.parent.remove(this.hero);
    const slot = (this.packField && index >= 0) ? this.packField.slots[index] : null;
    const hero = buildProduct(product, { shadow: false });
    hero.userData.product = product;
    hero.userData.instanceIndex = index;
    hero.position.copy(slot ? slot.position : new THREE.Vector3(0, 1, -12));
    hero.position.y -= (slot ? slot.size.h : 0.3) / 2;   // buildProduct sits on its base
    hero.rotation.copy(slot ? slot.rotation : new THREE.Euler());
    this.aisleGroup.add(hero);
    if (this.packField && slot) this.packField.hide(index);
    this.hero = hero;
    return hero;
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
    this.pickedIndex = productGroup.userData.instanceIndex;
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
    // put the pack back on the shelf: the instance reappears, the hero is dropped
    if (this.packField && this.pickedIndex >= 0) this.packField.show(this.pickedIndex);
    if (g.parent) g.parent.remove(g);
    if (this.hero === g) this.hero = null;
    this.pickedIndex = -1;
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
    let dragging = false;
    let px = 0, py = 0;

    canvas.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
      px = e.clientX; py = e.clientY;
      dragging = false;
      canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - down.x;
      const dy = e.clientY - down.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) dragging = true;

      // a pack in your hand: drag turns the pack
      if (this.picked && dragging) {
        this.rotatePicked(e.clientX - px, e.clientY - py);
        px = e.clientX; py = e.clientY;
        return;
      }
      // otherwise: drag looks around, exactly like turning your head
      if (dragging) {
        this.look((e.clientX - px) * 0.0038, (e.clientY - py) * 0.0030);
        px = e.clientX; py = e.clientY;
      }
    });

    canvas.addEventListener('pointerup', (e) => {
      if (!down) return;
      const dist = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const rapid = performance.now() - down.t < 420;
      if (!dragging && rapid) {
        const hit = this.pick(e.clientX, e.clientY);
        if (hit) { this.emit('pick', hit.userData.product); beep('pick'); }
        else this.emit('pick', null);
      }
      down = null;
      dragging = false;
    });

    canvas.addEventListener('wheel', (e) => {
      if (this.picked) return;
      if (this.mode !== 'aisle') return;
      e.preventDefault();
      this.walk(-e.deltaY * 0.0055);
      this.emit('walk', this.walkTarget);
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') this.look(-0.05, 0);
      else if (k === 'arrowright' || k === 'd') this.look(0.05, 0);
      else if (k === 'arrowup' || k === 'w') this.walkHold = 1;
      else if (k === 'arrowdown' || k === 's') this.walkHold = -1;
      else return;
      e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'w', 'arrowdown', 's'].includes(k)) this.walkHold = 0;
    });
  }

  /* Turn the head. Pitch is clamped like a real neck. */
  look(dYaw, dPitch) {
    this.yaw -= dYaw;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dPitch, -0.66, 0.56);
  }

  recentreLook() { this.yaw = 0; this.pitch = 0; }

  /* Joystick: f = forward/back (-1..1), s = sideways (-1..1). */
  setMove(f, s) { this.moveInput.f = f; this.moveInput.s = s; }

  /* Held walk from the keyboard. dir: 1 forward, -1 back. */
  startWalk(dir) { this.walkHold = dir; }
  stopWalk() { this.walkHold = 0; }

  /* Adaptive quality. A fixed quality preset is wrong on half the machines that
     open the shop: the same build runs on a 2019 laptop and a 2024 desktop. So we
     watch the real frame time and spend the budget where it can be afforded:
     AO first, then resolution, then bloom — and put them back when there is room. */
  initAdaptive() {
    this.perf = { frames: 0, time: 0, level: 0, cooldown: 0 };
    this.levels = [
      { label: 'ultra', pixelRatio: 1.5, ao: true, bloom: true },
      { label: 'high', pixelRatio: 1.25, ao: true, bloom: true },
      { label: 'medium', pixelRatio: 1.0, ao: false, bloom: true },
      { label: 'low', pixelRatio: 0.85, ao: false, bloom: false },
    ];
    this.applyLevel(1);
  }

  applyLevel(i) {
    const L = this.levels[Math.max(0, Math.min(this.levels.length - 1, i))];
    if (!L) return;
    this.perf.level = i;
    const dpr = Math.min(window.devicePixelRatio, L.pixelRatio);
    this.renderer.setPixelRatio(dpr);
    if (this.composer) this.composer.setPixelRatio(dpr);
    if (this.gtao) this.gtao.enabled = L.ao && this.tier !== 'low';
    if (this.bloom) this.bloom.enabled = L.bloom;
    this.qualityLabel = L.label;
  }

  watchPerformance(dt) {
    const p = this.perf;
    if (!p) return;
    p.frames++;
    p.time += dt;
    if (p.time < 1.4) return;
    const fps = p.frames / p.time;
    p.frames = 0;
    p.time = 0;
    p.cooldown = Math.max(0, p.cooldown - 1);
    if (p.cooldown > 0) return;
    const max = this.levels.length - 1;
    if (fps < 42 && p.level < max) {
      this.applyLevel(p.level + 1);
      p.cooldown = 2;
    } else if (fps > 75 && p.level > 0) {
      this.applyLevel(p.level - 1);
      p.cooldown = 3;
    }
  }

  /* ---------------------------------------------------------------- loop */
  animate() {
    const tick = () => {
      requestAnimationFrame(tick);
      const now = performance.now();
      const dt = Math.min((now - this.prevTime) / 1000, 0.05);
      this.prevTime = now;
      this.watchPerformance(dt);

      // camera tween
      if (this.tween) {
        // wall-clock, not frame count: a slow machine must not crawl there
        this.tween.t = (now - (this.tween.start || now)) / (this.tween.dur * 1000);
        const t = Math.min(Math.max(this.tween.t, 0), 1);
        const e = ease(t);
        this.camera.position.lerpVectors(this.tween.from, this.tween.to, e);
        this.lookTarget.lerpVectors(this.tween.lookFrom, this.tween.lookTo, e);
        if (t >= 1) this.tween = null;
      }

      // held walking (keyboard) + joystick (forward/back, step sideways)
      if (this.mode === 'aisle' && !this.picked) {
        const f = this.walkHold || this.moveInput.f;
        if (f) {
          this.walk(f * dt * 2.6);
          setWalkSpeed(2.6);
          this.emit('walk', this.walkTarget);
        }
        if (this.moveInput.s) {
          this.lateral = THREE.MathUtils.clamp(this.lateral + this.moveInput.s * dt * 1.7, -0.9, 0.9);
        }
      }

      // walking
      if (this.mode === 'aisle' && !this.picked) {
        this.aisleZ = lerp(this.aisleZ, this.walkTarget, 1 - Math.pow(0.001, dt));
        const portrait = this.portrait;
        const targetX = (portrait ? -1.15 : 0) + this.lateral;
        this.camera.position.x = lerp(this.camera.position.x, targetX, 1 - Math.pow(0.01, dt));
        this.camera.position.z = this.aisleZ;
        // breathing at rest, a gentle stride bob while walking — a head, not a dolly
        const walking = Math.abs(this.aisleZ - this.walkTarget) > 0.03 || this.moveInput.f;
        const t = performance.now();
        const bob = walking
          ? Math.sin(t * 0.0088) * 0.014 + Math.sin(t * 0.0176) * 0.004
          : Math.sin(t * 0.0018) * 0.006;
        this.camera.position.y = 1.52 + bob;
        if (portrait) this.lookTarget.set(-1.85, 0.92, this.aisleZ - 5.4);
        else this.lookTarget.set(0, 1.02, this.aisleZ - 8);
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
        this.holdLight.intensity = lerp(this.holdLight.intensity, 1.9, 1 - Math.pow(0.01, dt));
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
      }

      // shadow camera rides with the shopper, but only re-renders when it has moved
      if (this.keyLight) {
        const cam = this.camera.position;
        const last = this.shadowAnchor;
        if (!last || Math.abs(cam.z - last.z) > 1.2 || Math.abs(cam.x - last.x) > 0.6) {
          const k = this.keyLight;
          k.position.set(cam.x + 2.4, 7.5, cam.z - 4.5);
          k.target.position.set(cam.x, 0.6, cam.z - 3.5);
          k.target.updateMatrixWorld();
          k.shadow.needsUpdate = true;
          this.renderer.shadowMap.needsUpdate = true;
          this.shadowAnchor = { x: cam.x, z: cam.z };
        }
      }

      this.camera.lookAt(this.lookTarget);
      // free look layers on top of the shot the camera is framed for
      this.camera.rotateY(this.yaw);
      this.camera.rotateX(this.pitch);

      // physics: drives the trolley's spring, settles the packs, then syncs meshes
      this.physics.stepWorld(dt);
      // the shopper is a solid body too — you cannot walk through shelving
      if (this.camera.position.y < 3) {
        this.physics.resolveCircle(this.camera.position, 0.34);
      }
      if (this.mode === 'checkout') this.updateCheckout(dt);
      // wheels go quiet the moment you stop pushing
      if (this.mode === 'aisle' && !this.walkHold && !this.moveInput.f) setWalkSpeed(0);
      this.updateTrolley(dt);
      if (this.people) {
        const zb0 = this.aisleBounds.end + 2.0;
        const zb1 = this.aisleBounds.start - 1.0;
        const now = performance.now() / 1000;
        this.people.forEach((p) => {
          if (p.speed === 0) {
            p.person.userData.animate(now + p.x, 0);
            return;
          }
          p.z += p.dir * p.speed * dt;
          const lo = p.lo ?? zb0;
          const hi = p.hi ?? zb1;
          if (p.z < lo) { p.z = lo; p.dir = 1; p.group.rotation.y = 0; }
          if (p.z > hi) { p.z = hi; p.dir = -1; p.group.rotation.y = Math.PI; }
          p.group.position.z = p.z;
          p.person.userData.animate(now + p.x * 3, 1);
        });
      }

      if (this.gradePass) this.gradePass.uniforms.uTime.value = now * 0.001;
      if (this.composer) this.composer.render();
      else this.renderer.render(this.scene, this.camera);
    };
    tick();
  }
}
