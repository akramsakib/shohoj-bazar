/* Lighting rig — a real key/fill/rim setup driven by one environment probe.

   Before this: one hemisphere light, one directional "key" that was really a
   shadow caster, and a painted environment map. Everything was lit from
   everywhere with the same colour, which is exactly the flat, papery look that
   reads as "old style" no matter how good the geometry is.

   A supermarket is actually a beautiful lighting problem:
     * warm tube lamps overhead, a hard white key high up,
     * big pale surfaces bouncing light back into every crease (fill),
     * and, near the doors, a cold daylight rim from outside.

   Real-time GI is not affordable, so we fake it honestly: the environment probe
   does the bouncing, and we keep one shadow-casting key for contact shadows.
*/

import * as THREE from '../../vendor/three.module.js';

export const PRESETS = {
  // the shop in the afternoon: warm interior, bright door light
  afternoon: {
    background: '#141712',
    fog: '#e6d9bf',
    fogDensity: 0.0135,
    hemi: { sky: '#fff3dc', ground: '#5f5a4c', intensity: 0.26 },
    key: { color: '#fff1d8', intensity: 1.05, position: [2.4, 7.5, -6] },
    rim: { color: '#cfe4ff', intensity: 0.42, position: [-3.2, 3.4, 9.0] },
    environmentIntensity: 0.9,
    exposure: 0.94,
  },
  // late in the day: everything warmer, the door light goes gold
  evening: {
    background: '#12100c',
    fog: '#dcc9a6',
    fogDensity: 0.015,
    hemi: { sky: '#ffe3b8', ground: '#4d463a', intensity: 0.3 },
    key: { color: '#ffdba8', intensity: 1.0, position: [3.2, 6.6, -5.0] },
    rim: { color: '#ffb066', intensity: 0.55, position: [-2.6, 2.6, 10.5] },
    environmentIntensity: 1.05,
    exposure: 1.0,
  },
  // first thing in the morning: cool, clean, slightly blue
  morning: {
    background: '#151a1c',
    fog: '#dfe6e2',
    fogDensity: 0.012,
    hemi: { sky: '#eaf3ff', ground: '#5a5c58', intensity: 0.28 },
    key: { color: '#eef6ff', intensity: 1.1, position: [1.6, 8.0, -6.5] },
    rim: { color: '#bcd8ff', intensity: 0.5, position: [-3.6, 3.8, 9.5] },
    environmentIntensity: 0.85,
    exposure: 0.9,
  },
};

/**
 * Build (or rebuild) the rig on a scene.
 * @returns handle with .key .rim .hemi .setPreset(name) .update(dt, cameraPosition)
 */
export function buildLighting(scene, renderer, opts = {}) {
  const hemi = new THREE.HemisphereLight(0xfff3dc, 0x5f5a4c, 0.26);
  scene.add(hemi);

  // key: the thing that casts shadows
  const key = new THREE.DirectionalLight(0xfff1d8, 1.05);
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
  scene.add(key);
  scene.add(key.target);

  // rim: cold daylight from the shopfront, separates figures from the shelving
  const rim = new THREE.DirectionalLight(0xcfe4ff, 0.42);
  rim.position.set(-3.2, 3.4, 9.0);
  rim.castShadow = false;
  scene.add(rim);
  scene.add(rim.target);

  const handle = {
    hemi, key, rim, scene, renderer,
    preset: 'afternoon',
    base: {},
    setPreset(name) {
      const p = PRESETS[name] || PRESETS.afternoon;
      handle.preset = name;
      scene.background = new THREE.Color(p.background);
      if (scene.fog) {
        scene.fog.color.set(p.fog);
        scene.fog.density = p.fogDensity;
      }
      hemi.color.set(p.hemi.sky);
      hemi.groundColor.set(p.hemi.ground);
      hemi.intensity = p.hemi.intensity;
      key.color.set(p.key.color);
      key.intensity = p.key.intensity;
      rim.color.set(p.rim.color);
      rim.intensity = p.rim.intensity;
      rim.position.set(...p.rim.position);
      scene.environmentIntensity = p.environmentIntensity;
      if (renderer) renderer.toneMappingExposure = p.exposure;
      handle.base = { key: key.intensity, rim: rim.intensity, hemi: hemi.intensity };
    },
    /* Keep the shadow frustum on the shopper, and let the key dip a little in the
       checkout hall where there is no skylight. */
    update(cameraPosition, mode) {
      const cam = cameraPosition;
      key.position.set(cam.x + 2.4, 7.5, cam.z - 4.5);
      key.target.position.set(cam.x, 0.6, cam.z - 3.5);
      key.target.updateMatrixWorld();
      const hall = mode === 'checkout' || mode === 'street';
      const k = hall ? 0.82 : 1.0;
      key.intensity = (handle.base.key ?? key.intensity) * k;
      rim.intensity = (handle.base.rim ?? rim.intensity) * (mode === 'street' ? 1.6 : 1.0);
    },
  };

  handle.setPreset(opts.preset || 'afternoon');
  return handle;
}
