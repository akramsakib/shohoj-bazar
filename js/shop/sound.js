/* ------------------------------------------------------------------------
   Sound — synthesised, no audio files.
   A super shop is never silent: there is the plant hum, the refrigerated
   cases, the trolley wheels, the tills, and the occasional announcement.
   All of it is generated with WebAudio after the first user gesture, so it
   costs zero bytes and works offline.
   ---------------------------------------------------------------------- */

let ctx = null;
let master = null;
let ambienceGain = null;
let rumbleGain = null;
let rumbleFilter = null;
let wheelOsc = null;
let started = false;

function noiseBuffer(seconds = 3) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;   // brown-ish noise, less hissy
    d[i] = last * 3.2;
  }
  return buf;
}

function loopNoise(filterType, freq, gainValue) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(3);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = filterType;
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = gainValue;
  src.connect(f).connect(g).connect(master);
  src.start();
  return { src, f, g };
}

export function initShopSound() {
  if (started) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  started = true;

  master = ctx.createGain();
  master.gain.value = 0.0;
  master.connect(ctx.destination);
  master.gain.linearRampToValueAtTime(0.85, ctx.currentTime + 2.5);

  // room tone: air handling + lighting hum
  const air = loopNoise('lowpass', 420, 0.05);
  const hum = loopNoise('bandpass', 120, 0.035);
  hum.f.frequency.value = 118;
  hum.f.Q.value = 6;
  ambienceGain = air.g;

  // slow movement in the room tone so it does not feel like a drone
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 0.06;
  lfoGain.gain.value = 0.012;
  lfo.connect(lfoGain).connect(ambienceGain.gain);
  lfo.start();

  // trolley wheels, silent until you move
  const wheels = loopNoise('bandpass', 900, 0.0);
  wheels.f.Q.value = 0.9;
  rumbleGain = wheels.g;
  rumbleFilter = wheels.f;
  wheelOsc = ctx.createOscillator();
  wheelOsc.type = 'triangle';
  wheelOsc.frequency.value = 42;
  const wheelGain = ctx.createGain();
  wheelGain.gain.value = 0.0;
  wheelOsc.connect(wheelGain).connect(master);
  wheelOsc.start();
  rumbleGain.userData = wheelGain;

  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend();
    else ctx.resume();
  });
}

/* called every frame with the shopper's speed in m/s */
export function setWalkSpeed(v) {
  if (!ctx || !rumbleGain) return;
  const t = ctx.currentTime;
  const g = Math.min(0.10, v * 0.045);
  rumbleGain.gain.setTargetAtTime(g, t, 0.12);
  rumbleFilter.frequency.setTargetAtTime(620 + v * 420, t, 0.15);
  if (rumbleGain.userData) rumbleGain.userData.gain.setTargetAtTime(Math.min(0.05, v * 0.02), t, 0.15);
}

/* short, dry clicks for the till and the scanner */
export function beep(kind = 'pick') {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const f = kind === 'scan' ? 2200 : kind === 'error' ? 320 : 1180;
  o.type = 'square';
  o.frequency.setValueAtTime(f, t);
  if (kind === 'scan') o.frequency.exponentialRampToValueAtTime(f * 0.82, t + 0.07);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.05, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'scan' ? 0.10 : 0.16));
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.2);
}

/* the occasional store announcement — muffled, far away, unintelligible */
export function announce() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 900;
  o.type = 'sine';
  o.frequency.setValueAtTime(660, t);
  o.frequency.setValueAtTime(880, t + 0.18);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.03, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  o.connect(f).connect(g).connect(master);
  o.start(t);
  o.stop(t + 1.0);
}

export function muteSound(on) {
  if (!master) return;
  master.gain.setTargetAtTime(on ? 0 : 0.85, ctx.currentTime, 0.2);
}
