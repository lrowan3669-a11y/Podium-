let ctx = null;

export function unlockAudio() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  ctx = new AC();
  // Silent blip to fully unlock on iOS/Safari.
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  g.gain.value = 0;
  o.connect(g).connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + 0.01);
  return ctx;
}

function envGain(t0, attack, decay, peak = 0.6) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + attack + decay);
  return g;
}

function noiseBuffer(duration) {
  const size = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

// Hamilton — engine rev: rising sawtooth sweep
function playEngineRev() {
  const t0 = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(90, t0);
  o.frequency.exponentialRampToValueAtTime(420, t0 + 0.45);
  o.frequency.exponentialRampToValueAtTime(260, t0 + 0.65);
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.setValueAtTime(800, t0);
  filt.frequency.linearRampToValueAtTime(2200, t0 + 0.45);
  const g = envGain(t0, 0.05, 0.7, 0.5);
  o.connect(filt).connect(g).connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + 0.75);
}

// Charlton — crowd roar: filtered noise swell
function playCrowdRoar() {
  const t0 = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(1.1);
  const filt = ctx.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.value = 900;
  filt.Q.value = 0.6;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(0.45, t0 + 0.25);
  g.gain.linearRampToValueAtTime(0.3, t0 + 0.6);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 1.1);
  src.connect(filt).connect(g).connect(ctx.destination);
  src.start(t0);
}

// Fury / Sweet Science — boxing bell
function playBell() {
  const t0 = ctx.currentTime;
  [1, 2.4, 4.1].forEach((mult, i) => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = 880 * mult;
    const g = envGain(t0, 0.005, 1.3 - i * 0.2, i === 0 ? 0.5 : 0.15);
    o.connect(g).connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + 1.3);
  });
}

// The Power — dartboard thud
function playDartThud() {
  const t0 = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(160, t0);
  o.frequency.exponentialRampToValueAtTime(50, t0 + 0.18);
  const g = envGain(t0, 0.002, 0.22, 0.7);
  o.connect(g).connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + 0.25);

  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(0.05);
  const filt = ctx.createBiquadFilter();
  filt.type = 'highpass';
  filt.frequency.value = 2000;
  const ng = envGain(t0, 0.001, 0.05, 0.3);
  src.connect(filt).connect(ng).connect(ctx.destination);
  src.start(t0);
}

const CUES = {
  fury: playBell,
  hamilton: playEngineRev,
  charlton: playCrowdRoar,
  sweet_science: playBell,
  the_power: playDartThud,
};

export function playCue(classId) {
  if (!ctx) return;
  const fn = CUES[classId];
  if (fn) fn();
}
