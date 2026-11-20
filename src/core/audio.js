// Moteur audio 100 % procédural (Web Audio) — musique adaptative orchestrale synthétique, ambiances, bruitages spatialisés.
//  Instruments : cordes (ensemble désaccordé), chœur (formants), boîte à musique (FM + usure de bande),
//  violoncelle, trémolo dissonant, taïkos, cuivres, frappes métalliques, basse profonde.
//  États : 'calm' (nappes + boîte à musique éparse), 'silence' (ambiance seule), tension et poursuite pilotées par le danger.
const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
// Comptine originale (notes MIDI, durées en temps)
export const LULLABY = [
  [69, 1], [72, 1], [76, 1.5], [74, .5], [72, 1], [71, 1], [69, 2],
  [67, 1], [69, 1], [71, 1.5], [72, .5], [71, 1], [67, 1], [64, 2],
  [69, 1], [72, 1], [76, 1.5], [77, .5], [76, 1], [74, 1], [72, 2],
  [71, 1], [72, 1], [74, 1], [71, 1], [69, 3], [0, 1],
];
// progression mineure lente (basse + accord)
const PROG = [[45, [57, 60, 64]], [41, [57, 60, 65]], [48, [55, 60, 64]], [38, [57, 62, 65]], [45, [57, 60, 64]], [40, [55, 59, 64]], [41, [57, 60, 65]], [40, [56, 59, 64]]];
const OST = [45, 45, 48, 45, 43, 45, 40, 41]; // ostinato de poursuite

export class AudioEngine {
  constructor() { this.ctx = null; this.vol = { master: .9, music: .7, sfx: .9 }; this.state = 'silence'; this.intensity = 0; this.chase = 0; this.chapter = 0; this.listenerX = 0; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC({ latencyHint: 'interactive' });
    this.master = c.createGain(); this.master.gain.value = this.vol.master;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 3.5; comp.attack.value = .005; comp.release.value = .25;
    const limiter = c.createDynamicsCompressor(); limiter.threshold.value = -2; limiter.ratio.value = 20; limiter.attack.value = .001; limiter.release.value = .1;
    comp.connect(limiter); limiter.connect(this.master); this.master.connect(c.destination); this.comp = comp;
    this.music = c.createGain(); this.music.gain.value = this.vol.music * 1.7; this.music.connect(comp);
    this.sfx = c.createGain(); this.sfx.gain.value = this.vol.sfx; this.sfx.connect(comp);
    this.amb = c.createGain(); this.amb.gain.value = .55; this.amb.connect(comp);
    // grande réverbération (salle immense) + petite (pièce) — impulsions générées, filtrées
    this.verb = c.createConvolver(); this.verb.buffer = this.impulse(4.5, 2.2, 3500); const vg = c.createGain(); vg.gain.value = .6; this.verb.connect(vg); vg.connect(comp);
    this.room = c.createConvolver(); this.room.buffer = this.impulse(1.2, 3, 6000); const rg = c.createGain(); rg.gain.value = .35; this.room.connect(rg); rg.connect(comp);
    // écho stéréo discret pour la musique
    const dl = c.createDelay(1), fb = c.createGain(), dlf = c.createBiquadFilter(); dl.delayTime.value = .43; fb.gain.value = .28; dlf.type = 'lowpass'; dlf.frequency.value = 2200;
    dl.connect(dlf); dlf.connect(fb); fb.connect(dl); const dw = c.createGain(); dw.gain.value = .22; dlf.connect(dw); dw.connect(this.verb);
    this.delay = dl;
    this.noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate); const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.brownBuf = c.createBuffer(1, c.sampleRate * 4, c.sampleRate); const bd = this.brownBuf.getChannelData(0); let last = 0; for (let i = 0; i < bd.length; i++) { last = (last + .02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = last * 3.5; }
    // usure de bande : LFO partagé de désaccord pour la boîte à musique
    this.wobble = c.createOscillator(); this.wobble.frequency.value = .7; this.wobbleG = c.createGain(); this.wobbleG.gain.value = 9; this.wobble.connect(this.wobbleG); this.wobble.start();
    this.layers = {}; this.nextBeat = 0; this.beatIdx = 0; this.nextChord = 0; this.chordIdx = 0; this.nextHeart = 0; this.nextEvent = 0; this.nextBox = 0; this.nextBreath = 0; this.nextPulse = 0;
    this.buildLayers();
    this.setChapter(this.chapter);
  }
  impulse(sec, decay, lp) {
    const c = this.ctx, len = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let y = 0; const a = Math.exp(-2 * Math.PI * lp / c.sampleRate);
      for (let i = 0; i < len; i++) { const x = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay) * (i < c.sampleRate * .01 ? i / (c.sampleRate * .01) : 1); y = y * a + x * (1 - a); d[i] = y * 2.2; } }
    return b;
  }
  setVolumes(v) { Object.assign(this.vol, v); if (!this.ctx) return; this.master.gain.value = this.vol.master; this.music.gain.value = this.vol.music * 1.7; this.sfx.gain.value = this.vol.sfx; }
  now() { return this.ctx ? this.ctx.currentTime : 0; }
  setListener(x) { this.listenerX = x; }
  noise(brown = false) { const s = this.ctx.createBufferSource(); s.buffer = brown ? this.brownBuf : this.noiseBuf; s.loop = true; return s; }
  // sortie spatialisée (panoramique + atténuation selon la distance horizontale)
  out(x, dest = this.sfx) {
    if (x === undefined || !this.ctx.createStereoPanner) return dest;
    const p = this.ctx.createStereoPanner(), g = this.ctx.createGain(), dx = x - this.listenerX;
    p.pan.value = Math.max(-1, Math.min(1, dx / 9)); g.gain.value = 1 / (1 + Math.abs(dx) * .08);
    p.connect(g); g.connect(dest); return p;
  }
  // ---------------------------------------------------------------- couches continues
  buildLayers() {
    const c = this.ctx, L = this.layers;
    const loopNoise = (brown, type, f, q, dest) => { const n = this.noise(brown), fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = c.createGain(); g.gain.value = 0; n.connect(fl); fl.connect(g); g.connect(dest); n.start(); return { g, f: fl }; };
    // vent : deux bandes, rafales lentes
    L.wind = loopNoise(true, 'bandpass', 420, .7, this.amb); L.wind2 = loopNoise(false, 'bandpass', 1800, 4, this.amb);
    for (const [w, f, d] of [[L.wind, .06, 280], [L.wind2, .11, 900]]) { const o = c.createOscillator(), og = c.createGain(); o.frequency.value = f; og.gain.value = d; o.connect(og); og.connect(w.f.frequency); o.start(); }
    // pluie : bruissement + gouttes
    L.rain = loopNoise(false, 'highpass', 2600, .5, this.amb); L.rain2 = loopNoise(false, 'bandpass', 900, .6, this.amb);
    // ronronnement de machines (usine)
    { const g = c.createGain(); g.gain.value = 0; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220; f.connect(g); g.connect(this.amb); g.connect(this.room);
      for (const fr of [50, 100, 150.5, 201]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; const og = c.createGain(); og.gain.value = .25 / (fr / 50); o.connect(og); og.connect(f); o.start(); }
      L.hum = { g }; }
    // nappe sombre continue (drone orchestral)
    { const g = c.createGain(); g.gain.value = 0; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 280; f.Q.value = .7; f.connect(g); g.connect(this.music); g.connect(this.verb);
      this.droneOsc = []; for (const [fr, det] of [[55, -6], [55, 7], [82.4, 0], [27.5, 0]]) { const o = c.createOscillator(); o.type = fr < 30 ? 'sine' : 'sawtooth'; o.frequency.value = fr; o.detune.value = det; o.connect(f); o.start(); this.droneOsc.push(o); }
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = .05; lg.gain.value = 120; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
      L.drone = { g, f }; }
    // trémolo de cordes dissonant (tension)
    { const g = c.createGain(); g.gain.value = 0; const am = c.createGain(); am.gain.value = .5; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 1.2;
      const trem = c.createOscillator(), tg = c.createGain(); trem.frequency.value = 11; tg.gain.value = .5; trem.connect(tg); tg.connect(am.gain); trem.start();
      for (const fr of [622.3, 659.3, 698.5, 1244]) { for (const det of [-8, 8]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.detune.value = det; o.connect(am); o.start(); } }
      am.connect(f); f.connect(g); g.connect(this.music); g.connect(this.verb); L.tension = { g }; }
    // chœur grave lointain (silence inquiétant)
    { const g = c.createGain(); g.gain.value = 0; const src = c.createGain(); src.gain.value = .3;
      for (const fr of [110, 110.7, 164.8]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.connect(src); o.start(); }
      for (const [ff, gg] of [[650, .5], [1080, .3], [2650, .1]]) { const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = ff; bp.Q.value = 9; const fg = c.createGain(); fg.gain.value = gg; src.connect(bp); bp.connect(fg); fg.connect(g); }
      g.connect(this.verb); const dg = c.createGain(); dg.gain.value = .3; g.connect(dg); dg.connect(this.music); L.choirLow = { g }; }
  }
  setChapter(i) {
    this.chapter = i; if (!this.ctx) return;
    const t = this.now(), L = this.layers;
    const cfg = [
      { wind: .5, wind2: .05, rain: 0, rain2: 0, hum: 0, drone: .07 },   // forêt
      { wind: .12, wind2: .02, rain: 0, rain2: 0, hum: .04, drone: .08 }, // usine
      { wind: .06, wind2: .03, rain: 0, rain2: 0, hum: 0, drone: .065 },    // maison
      { wind: .22, wind2: .03, rain: .26, rain2: .1, hum: 0, drone: .065 }, // marais
      { wind: .3, wind2: .04, rain: 0, rain2: 0, hum: 0, drone: .04 },   // colline
      { wind: .02, wind2: 0, rain: 0, rain2: 0, hum: 0, drone: 0 },        // épilogue
    ][i] || { wind: .3, wind2: .03, rain: 0, rain2: 0, hum: 0, drone: .04 };
    for (const k of ['wind', 'wind2', 'rain', 'rain2', 'hum', 'drone']) L[k].g.gain.setTargetAtTime(cfg[k], t, 1.5);
  }
  setMood(state) { this.state = state; }
  // ---------------------------------------------------------------- briques de synthèse
  env(g, t, a, peak, d, curve = 'exp') { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); if (curve === 'lin') g.gain.linearRampToValueAtTime(peak, t + a); else g.gain.exponentialRampToValueAtTime(Math.max(peak, 1e-4), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  burst({ f = 1000, q = 1, type = 'bandpass', dur = .1, vol = .3, t = this.now(), dest, brown = false, sweep = 0, verb = 0, room = 0, a = .004, x }) {
    if (!this.ctx) return; const c = this.ctx; dest = dest || this.out(x);
    const s = this.noise(brown), fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (sweep) fl.frequency.exponentialRampToValueAtTime(Math.max(40, f * sweep), t + dur); fl.Q.value = q;
    const g = c.createGain(); s.connect(fl); fl.connect(g); g.connect(dest);
    if (verb) { const vg = c.createGain(); vg.gain.value = verb; g.connect(vg); vg.connect(this.verb); }
    if (room) { const rg = c.createGain(); rg.gain.value = room; g.connect(rg); rg.connect(this.room); }
    this.env(g, t, a, vol, dur); s.start(t, Math.random() * 1.5); s.stop(t + a + dur + .1);
  }
  tone({ f = 220, type = 'sine', dur = .3, vol = .2, t = this.now(), slide = 0, dest, verb = 0, a = .005, x, detune = 0 }) {
    if (!this.ctx) return; const c = this.ctx, o = c.createOscillator(), g = c.createGain(); dest = dest || this.out(x);
    o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune; if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
    o.connect(g); g.connect(dest); if (verb) { const vg = c.createGain(); vg.gain.value = verb; g.connect(vg); vg.connect(this.verb); }
    this.env(g, t, a, vol, dur); o.start(t); o.stop(t + a + dur + .05);
  }
  // voix humaine (souffle, effort) : bruit filtré par formants
  voice(t, dur, vol, f1, f2, x) {
    const c = this.ctx, n = this.noise(), g = c.createGain(), dest = this.out(x);
    for (const [ff, gg] of [[f1, 1], [f2, .6], [2800, .2]]) { const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = ff; bp.Q.value = 6; const fg = c.createGain(); fg.gain.value = gg; n.connect(bp); bp.connect(fg); fg.connect(g); }
    g.connect(dest); const rg = c.createGain(); rg.gain.value = .15; g.connect(rg); rg.connect(this.room);
    this.env(g, t, dur * .25, vol, dur * .75, 'lin'); n.start(t, Math.random()); n.stop(t + dur + .1);
  }
  // cordes : ensemble désaccordé + octave grave, filtre qui « respire »
  strings(midi, t, dur, vol = .02, bright = 1) {
    const c = this.ctx, f = NOTE(midi), g = c.createGain(), fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = .8;
    fl.frequency.setValueAtTime(400, t); fl.frequency.linearRampToValueAtTime(1300 * bright, t + dur * .45); fl.frequency.linearRampToValueAtTime(500, t + dur);
    fl.connect(g); g.connect(this.music); const vg = c.createGain(); vg.gain.value = .8; g.connect(vg); vg.connect(this.verb);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * .35); g.gain.setValueAtTime(vol, t + dur * .6); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const vib = c.createOscillator(), vgn = c.createGain(); vib.frequency.value = 4.8 + Math.random(); vgn.gain.value = 5; vib.connect(vgn); vib.start(t); vib.stop(t + dur + .1);
    for (const det of [-9, -3, 4, 10]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; vgn.connect(o.detune); o.connect(fl); o.start(t); o.stop(t + dur + .1); }
  }
  choir(midi, t, dur, vol = .02, vowel = 'a') {
    const c = this.ctx, f = NOTE(midi), src = c.createGain(), g = c.createGain();
    const F = vowel === 'o' ? [[450, 1], [800, .4], [2830, .1]] : vowel === 'u' ? [[325, 1], [700, .3], [2530, .08]] : [[750, 1], [1180, .55], [2650, .15]];
    for (const [ff, gg] of F) { const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = ff; bp.Q.value = 7; const fg = c.createGain(); fg.gain.value = gg; src.connect(bp); bp.connect(fg); fg.connect(g); }
    g.connect(this.verb); const dg = c.createGain(); dg.gain.value = .5; g.connect(dg); dg.connect(this.music);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * .4); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const vib = c.createOscillator(), vgn = c.createGain(); vib.frequency.value = 5.3; vgn.gain.value = 9; vib.connect(vgn); vib.start(t); vib.stop(t + dur + .1);
    for (const det of [-12, 0, 11]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; vgn.connect(o.detune); o.connect(src); o.start(t); o.stop(t + dur + .1); }
  }
  // boîte à musique : cloche FM + lame aiguë, légère usure de bande
  musicBox(midi, t, vol = .09, dest = this.music) {
    if (!this.ctx || !midi) return; const c = this.ctx, f = NOTE(midi);
    const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
    car.frequency.value = f; mod.frequency.value = f * 3.01; mg.gain.setValueAtTime(f * 2.2, t); mg.gain.exponentialRampToValueAtTime(f * .05, t + .6);
    mod.connect(mg); mg.connect(car.frequency); car.detune.value = Math.sin(t * 4.4) * 9 + Math.sin(t * 1.3) * 5;
    car.connect(g); g.connect(dest); const vg = c.createGain(); vg.gain.value = .9; g.connect(vg); vg.connect(this.verb); g.connect(this.delay);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .004); g.gain.exponentialRampToValueAtTime(vol * .3, t + .25); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
    car.start(t); mod.start(t); car.stop(t + 2.7); mod.stop(t + 2.7);
    this.tone({ f: f * 4.2, dur: .25, vol: vol * .25, t, dest, a: .002 });
    this.burst({ f: 6000, q: 2, dur: .015, vol: vol * .2, t, dest });
  }
  piano(midi, t, vol = .16, dur = 2.5) { // conservé : piano doux pour les moments d'émotion
    if (!this.ctx || !midi) return; const c = this.ctx, f = NOTE(midi);
    const g = c.createGain(); g.connect(this.music); const vg = c.createGain(); vg.gain.value = .9; g.connect(vg); vg.connect(this.verb);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .006); g.gain.exponentialRampToValueAtTime(vol * .35, t + .3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    [[1, 1], [2, .42], [3, .18], [4, .1], [5.02, .05]].forEach(([m, a], i) => { const o = c.createOscillator(), og = c.createGain(); o.frequency.value = f * m * (1 + .0007 * i); og.gain.setValueAtTime(a, t); og.gain.exponentialRampToValueAtTime(a * .04 + 1e-4, t + dur / (i + 1)); o.connect(og); og.connect(g); o.start(t); o.stop(t + dur + .1); });
  }
  cello(midi, t, dur, vol = .05) {
    const c = this.ctx, f = NOTE(midi), fl = c.createBiquadFilter(), g = c.createGain(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(1400, t); fl.frequency.exponentialRampToValueAtTime(500, t + dur); fl.Q.value = 1.5;
    fl.connect(g); g.connect(this.music); const vg = c.createGain(); vg.gain.value = .4; g.connect(vg); vg.connect(this.verb);
    this.env(g, t, .02, vol, dur);
    for (const det of [-6, 6]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(fl); o.start(t); o.stop(t + dur + .1); }
    this.burst({ f: 1800, q: 1, dur: .06, vol: vol * .3, t, dest: this.music });
  }
  taiko(t, vol = .4, low = 1) {
    this.tone({ f: 95 * low, type: 'sine', dur: .45, vol, t, slide: .45, dest: this.music, verb: .5 });
    this.burst({ f: 260 * low, q: .8, type: 'lowpass', dur: .2, vol: vol * .6, t, dest: this.music, brown: true, verb: .4 });
    this.burst({ f: 1200, q: 1, dur: .03, vol: vol * .25, t, dest: this.music });
  }
  metal(t, vol = .1, f = 220, x, dest) { // frappe métallique inharmonique
    for (const [r, a, d] of [[1, 1, 2.2], [2.76, .6, 1.4], [5.4, .4, .9], [8.93, .25, .6]]) this.tone({ f: f * r, dur: d, vol: vol * a, t, dest: dest || this.out(x), verb: .8, a: .002 });
  }
  brass(midi, t, dur, vol = .05) {
    const c = this.ctx, f = NOTE(midi), fl = c.createBiquadFilter(), g = c.createGain(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(200, t); fl.frequency.exponentialRampToValueAtTime(1600, t + .08); fl.frequency.exponentialRampToValueAtTime(350, t + dur);
    fl.connect(g); g.connect(this.music); const vg = c.createGain(); vg.gain.value = .7; g.connect(vg); vg.connect(this.verb); this.env(g, t, .03, vol, dur);
    for (const [m, det] of [[1, -5], [1, 5], [.5, 0], [1.5, 3]]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f * m; o.detune.value = det; o.connect(fl); o.start(t); o.stop(t + dur + .1); }
  }
  // ---------------------------------------------------------------- impacts physiques (k : force 0..1)
  impact(surface, k = .5, x) {
    if (!this.ctx) return; const t = this.now(), r = .85 + Math.random() * .3, v = .04 + k * .3;
    switch (surface) {
      case 'metal': this.burst({ f: 2600 * r, q: 10, dur: .05 + k * .1, vol: v * .8, x, verb: .35 }); this.metal(t, v * .09, (180 + Math.random() * 500) * (1.4 - k * .5)); if (k > .5) this.tone({ f: 70 * r, dur: .25, vol: v * .5, slide: .7, dest: this.sfx }); break;
      case 'barrel': this.burst({ f: 260 * r, q: 2, dur: .25 + k * .3, vol: v * 1.2, x, room: .5, verb: .4 }); this.metal(t, v * .06, 95 * r); this.tone({ f: 58 * r, dur: .4, vol: v * .6, slide: .8, dest: this.sfx }); break;
      case 'stone': this.burst({ f: 1300 * r, q: 2.5, dur: .04 + k * .04, vol: v, x }); this.burst({ f: 5200 * r, q: 4, dur: .02, vol: v * .3, x }); break;
      case 'toy': this.burst({ f: 1900 * r, q: 6, dur: .035, vol: v * .8, x, room: .5 }); this.tone({ f: 620 * r, type: 'triangle', dur: .05, vol: v * .25, dest: this.sfx }); break;
      case 'water': this.burst({ f: 900 * r, q: .7, dur: .3 + k * .3, vol: v * 1.3, sweep: .4, x }); this.burst({ f: 3200, q: 1, dur: .15, vol: v * .4, t: t + .04, x }); break;
      case 'cardboard': this.burst({ f: 500 * r, q: 1.2, dur: .07, vol: v * .9, x, brown: true }); break;
      default: this.burst({ f: 380 * r, q: 3, dur: .06 + k * .06, vol: v, x, room: .35 }); this.tone({ f: 130 * r, type: 'triangle', dur: .08, vol: v * .5, dest: this.sfx }); this.burst({ f: 1700 * r, q: 8, dur: .03, vol: v * .2, x });
    }
  }
  // ---------------------------------------------------------------- pas, effort
  step(surface, run) {
    if (!this.ctx) return; const t = this.now(), v = run ? .2 : .13, r = .9 + Math.random() * .2;
    const heel = (dt, k) => {
      const tt = t + dt;
      switch (surface) {
        case 'wood': this.burst({ f: 320 * r, q: 3, dur: .06, vol: v * k, t: tt, room: .3 }); this.tone({ f: 120 * r, type: 'triangle', dur: .07, vol: v * .5 * k, t: tt }); this.burst({ f: 1600, q: 8, dur: .03, vol: v * .15 * k, t: tt }); break;
        case 'metal': this.burst({ f: 2400 * r, q: 9, dur: .05, vol: v * .7 * k, t: tt, verb: .3 }); this.metal(tt, v * .05 * k, 380 * r); break;
        case 'water': this.burst({ f: 900 * r, q: .7, dur: .22, vol: v * 1.2 * k, t: tt, sweep: .4 }); this.burst({ f: 3000, q: 1, dur: .12, vol: v * .4 * k, t: tt + .03 }); break;
        case 'grass': this.burst({ f: 3600 * r, q: .5, dur: .14, vol: v * .7 * k, type: 'highpass', t: tt }); this.burst({ f: 500, q: .6, dur: .05, vol: v * .4 * k, t: tt, brown: true }); break;
        case 'concrete': this.burst({ f: 1500 * r, q: 1.5, dur: .04, vol: v * k, t: tt, room: .4 }); this.burst({ f: 4200, q: 2, dur: .025, vol: v * .3 * k, t: tt + .01 }); break;
        case 'stone': this.burst({ f: 1100 * r, q: 2, dur: .05, vol: v * k, t: tt }); this.burst({ f: 5000, q: 3, dur: .02, vol: v * .2 * k, t: tt }); break;
        default: this.burst({ f: 650 * r, q: .9, dur: .08, vol: v * k, t: tt, brown: true }); this.burst({ f: 2400 * r, q: 1, dur: .035, vol: v * .35 * k, t: tt });
      }
    };
    heel(0, 1); heel(.035 + Math.random() * .02, .45); // talon puis pointe
    this.burst({ f: 3000, q: .6, dur: .08, vol: .018, t: t + .01, type: 'highpass' }); // froissement du manteau
  }
  // ---------------------------------------------------------------- bruitages
  play(name, opt = {}) {
    if (!this.ctx) return; const t = this.now(), x = opt.x;
    switch (name) {
      case 'jump': this.voice(t, .14, .05, 600, 1100); this.burst({ f: 2500, q: .5, dur: .15, vol: .05, type: 'highpass' }); break;
      case 'land': { const k = opt.k || 1; this.burst({ f: 180, q: .7, dur: .18, vol: .26 * k, brown: true, type: 'lowpass' }); this.burst({ f: 2600, q: .6, dur: .1, vol: .05 * k, type: 'highpass' }); if (k > .8) this.voice(t, .18, .04, 500, 900); break; }
      case 'breath': this.voice(t, .5, .035, 900, 1500); break;
      case 'climb': this.voice(t + .05, .3, .06, 550, 1000); this.burst({ f: 700, q: 1, dur: .3, vol: .09, brown: true }); this.burst({ f: 3500, q: .8, dur: .2, vol: .03, t: t + .2 }); break;
      case 'grabLedge': this.burst({ f: 1400, q: 1.2, dur: .05, vol: .18 }); this.burst({ f: 400, q: 1, dur: .08, vol: .12, brown: true }); this.voice(t, .2, .05, 650, 1100); break;
      case 'ladder': this.metal(t, .03, 520 + Math.random() * 60); this.burst({ f: 1800, q: 4, dur: .04, vol: .06 }); break;
      case 'scrape': { const c = this.ctx, n = this.noise(true), bp = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain(); bp.type = 'bandpass'; bp.frequency.value = 220 + Math.random() * 120; bp.Q.value = 4; lfo.frequency.value = 18 + Math.random() * 10; lg.gain.value = .5; lfo.connect(lg); lg.connect(g.gain); n.connect(bp); bp.connect(g); g.connect(this.sfx); const rg = c.createGain(); rg.gain.value = .3; g.connect(rg); rg.connect(this.room); this.env(g, t, .03, .2, .32); n.start(t); n.stop(t + .4); lfo.start(t); lfo.stop(t + .4); break; }
      case 'lever': this.metal(t, .06, 160); this.burst({ f: 900, q: 3, dur: .12, vol: .15, room: .5 }); this.tone({ f: 90, type: 'square', dur: .1, vol: .05, slide: .7 }); break;
      case 'gate': { this.burst({ f: 160, q: 1.5, dur: 1.6, vol: .22, brown: true, verb: .7 }); for (let i = 0; i < 9; i++) this.burst({ f: 900 + Math.random() * 1500, q: 15, dur: .1, vol: .05, t: t + i * .16, verb: .4 }); this.metal(t + 1.5, .1, 110); break; }
      case 'latch': this.burst({ f: 3200 + Math.random() * 800, q: 12, dur: .05, vol: .12 }); this.metal(t, .015, 900); break;
      case 'crash': { this.burst({ f: 140, q: .5, dur: 1.6, vol: .45, brown: true, verb: .9 }); this.burst({ f: 2200, q: .5, dur: .7, vol: .15, verb: .8 }); for (let i = 0; i < 6; i++) this.metal(t + Math.random() * .4, .05, 150 + Math.random() * 400); this.tone({ f: 42, dur: 1.2, vol: .25, slide: .6, dest: this.sfx }); break; }
      case 'howl': {
        const c = this.ctx, src = c.createGain(), g = c.createGain(), dest = this.out(x); const b = 300 + Math.random() * 70;
        for (const det of [0, 9]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(b, t); o.frequency.linearRampToValueAtTime(b * 1.95, t + .8); o.frequency.linearRampToValueAtTime(b * 1.75, t + 2.1); o.frequency.linearRampToValueAtTime(b * 1.05, t + 3.2); o.detune.value = det; o.connect(src); o.start(t); o.stop(t + 3.4); }
        for (const [ff, gg] of [[620, 1], [1100, .5], [2400, .15]]) { const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 6; bp.frequency.setValueAtTime(ff * .8, t); bp.frequency.linearRampToValueAtTime(ff * 1.15, t + 1.5); bp.frequency.linearRampToValueAtTime(ff * .7, t + 3.2); const fg = c.createGain(); fg.gain.value = gg; src.connect(bp); bp.connect(fg); fg.connect(g); }
        g.connect(dest); const vv = c.createGain(); vv.gain.value = 1.4; g.connect(vv); vv.connect(this.verb);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(.12 * (opt.vol || 1), t + .5); g.gain.setValueAtTime(.1 * (opt.vol || 1), t + 2.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.3);
        break;
      }
      case 'growl': {
        const c = this.ctx, n = this.noise(true), g = c.createGain(), am = c.createOscillator(), amg = c.createGain(), dest = this.out(x);
        am.frequency.value = 26 + Math.random() * 8; amg.gain.value = .6; am.connect(amg); amg.connect(g.gain);
        for (const [ff, gg] of [[180, 1], [420, .6], [900, .2]]) { const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = ff; bp.Q.value = 5; const fg = c.createGain(); fg.gain.value = gg * 3; n.connect(bp); bp.connect(fg); fg.connect(g); }
        g.connect(dest); this.env(g, t, .08, .3, .7); n.start(t); n.stop(t + .9); am.start(t); am.stop(t + .9);
        break;
      }
      case 'pant': for (let i = 0; i < 3; i++) this.voice(t + i * .22, .14, .03, 700, 1300, x); break;
      case 'paw': this.burst({ f: 500, q: 1, dur: .05, vol: .06, brown: true, x }); break;
      case 'bite': this.burst({ f: 1800, q: 2, dur: .06, vol: .35, x }); this.burst({ f: 220, q: 1, dur: .35, vol: .3, brown: true, x }); this.play('growl', { x }); break;
      case 'death': { this.burst({ f: 400, q: .5, dur: 1.4, vol: .14, sweep: .15, verb: 1 }); this.tone({ f: 55, dur: 1.6, vol: .3, slide: .5, dest: this.sfx }); this.tone({ f: 4200, dur: 2.5, vol: .012, a: .3, dest: this.sfx }); this.choir(50, t + .1, 3, .025, 'u'); break; }
      case 'memory': [76, 79, 83, 88, 91].forEach((n, i) => this.musicBox(n, t + i * .16, .08)); this.choir(64, t, 4, .02, 'a'); this.choir(69, t + .2, 4, .015, 'o'); break;
      case 'unlock': [57, 64, 69, 72, 76, 81].forEach((n, i) => this.musicBox(n, t + i * .11, .08)); this.choir(57, t, 5, .035, 'a'); this.choir(64, t + .3, 5, .03, 'o'); this.strings(45, t, 5, .03); this.burst({ f: 5000, q: .3, dur: 2.5, vol: .05, verb: 1 }); this.tone({ f: 36, dur: 2, vol: .3, slide: .9, dest: this.sfx }); break;
      case 'lueurCharge': { this.choir(69, t, 1.2, .02, 'a'); this.tone({ f: 110, type: 'sawtooth', dur: .9, vol: .04, slide: 2.2, verb: .6 }); for (let i = 0; i < 8; i++) this.burst({ f: 3000 + Math.random() * 4000, q: 6, dur: .02, vol: .03, t: t + Math.random() * .8 }); break; }
      case 'lueur': this.tone({ f: 48, dur: 1.4, vol: .45, slide: .55, dest: this.sfx }); this.burst({ f: 120, q: .5, dur: 1.4, vol: .5, brown: true, verb: .9 }); this.burst({ f: 1800, q: .5, dur: .9, vol: .2, sweep: 3, verb: .8 }); this.burst({ f: 6000, q: .3, dur: 1.2, vol: .07, verb: 1 }); this.choir(57, t, 2.5, .03, 'a'); this.choir(64, t, 2.5, .025, 'a'); break;
      case 'souffle': this.burst({ f: 380, q: .4, dur: 1.1, vol: .5, sweep: 5, verb: .4, a: .02 }); this.burst({ f: 70, q: .7, dur: .6, vol: .35, brown: true }); this.burst({ f: 2600, q: .6, dur: .8, vol: .12, sweep: .4 }); this.tone({ f: 60, dur: .5, vol: .2, slide: .5, dest: this.sfx }); break;
      case 'echoOn': { this.burst({ f: 3000, q: .4, dur: 1.2, vol: .12, a: 1.0, sweep: .3, verb: 1 }); [88, 83, 79, 76].forEach((n, i) => this.musicBox(n, t + .9 + i * .09, .05)); this.choir(76, t + .5, 3, .02, 'u'); break; }
      case 'echoOff': this.burst({ f: 900, q: .5, dur: .6, vol: .08, sweep: 3, verb: .8 }); this.musicBox(64, t, .04); break;
      case 'dash': this.burst({ f: 2400, q: .4, dur: .35, vol: .3, sweep: .15 }); this.burst({ f: 90, q: .8, dur: .3, vol: .3, brown: true }); this.tone({ f: 70, dur: .3, vol: .2, slide: .5, dest: this.sfx }); this.burst({ f: 600, q: 4, dur: .4, vol: .06, sweep: 2.5, verb: .8 }); break;
      case 'grab': this.burst({ f: 180, q: 1, dur: .9, vol: .32, brown: true, verb: .8 }); this.tone({ f: 46, type: 'sawtooth', dur: 1.3, vol: .12, verb: .6 }); this.choir(45, t, 1.5, .03, 'u'); break;
      case 'groan': { const c = this.ctx, o = c.createOscillator(), m = c.createOscillator(), mg = c.createGain(), g = c.createGain(), f = c.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.setValueAtTime(55, t); o.frequency.linearRampToValueAtTime(42, t + 2.5); m.frequency.value = 7; mg.gain.value = 6; m.connect(mg); mg.connect(o.frequency); f.type = 'lowpass'; f.frequency.value = 400; o.connect(f); f.connect(g); g.connect(this.out(x)); const vv = c.createGain(); vv.gain.value = 1; g.connect(vv); vv.connect(this.verb); this.env(g, t, .6, .14, 2.2, 'lin'); o.start(t); m.start(t); o.stop(t + 3); m.stop(t + 3); break; }
      case 'stomp': this.tone({ f: 40, dur: .6, vol: .3, slide: .6, dest: this.sfx }); this.burst({ f: 120, q: .7, dur: .5, vol: .25, brown: true, verb: .7 }); break;
      case 'knuckles': for (let i = 0; i < 4; i++) this.burst({ f: 2500 + Math.random() * 2000, q: 10, dur: .02, vol: .1, t: t + i * .05 + Math.random() * .03, x }); break;
      case 'ghost': { this.voice(t, 1.6, .03, 400 + Math.random() * 200, 1200, x); this.tone({ f: 200 + Math.random() * 40, dur: 2, vol: .03, slide: .8, verb: 1.2, a: .5, x }); break; }
      case 'drip': this.tone({ f: 1300 + Math.random() * 700, dur: .1, vol: .05, slide: .55, verb: 1.2, x }); break;
      case 'creak': { const c = this.ctx, o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter(), am = c.createOscillator(), amg = c.createGain(); o.type = 'sawtooth'; const b = 180 + Math.random() * 200; o.frequency.setValueAtTime(b, t); o.frequency.linearRampToValueAtTime(b * (1.2 + Math.random() * .5), t + .9); am.frequency.value = 35 + Math.random() * 30; amg.gain.value = .9; am.connect(amg); amg.connect(g.gain); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 3; o.connect(f); f.connect(g); g.connect(this.out(x, this.amb)); const vv = c.createGain(); vv.gain.value = .8; g.connect(vv); vv.connect(this.verb); this.env(g, t, .2, .03, .8, 'lin'); o.start(t); am.start(t); o.stop(t + 1.1); am.stop(t + 1.1); break; }
      case 'clank': this.metal(t, .05, 120 + Math.random() * 200, x, this.amb); break;
      case 'steam': this.burst({ f: 5000, q: .4, dur: 1.4, vol: .06, type: 'highpass', a: .1, x }); break;
      case 'tick': this.burst({ f: 3500, q: 8, dur: .02, vol: .04, room: .5 }); break;
      case 'bird': { const f = 2500 + Math.random() * 1500; for (let i = 0; i < 3; i++) this.tone({ f: f * (1 + i * .08), dur: .08, vol: .02, slide: 1.3, t: t + i * .11, verb: .5 }); break; }
      case 'crow': this.voice(t, .35, .05, 900, 1500); this.voice(t + .45, .3, .04, 900, 1500); break;
      case 'splash': this.burst({ f: 700, q: .5, dur: .9, vol: .4, sweep: .3, verb: .4 }); this.burst({ f: 3000, q: .8, dur: .5, vol: .15 }); break;
      case 'chime': this.musicBox(84, t, .06); break;
      case 'thunder': this.burst({ f: 70, q: .4, dur: 4, vol: .55, brown: true, verb: 1, a: .05 }); this.burst({ f: 400, q: .4, dur: 1.5, vol: .12, verb: .8, a: .01 }); break;
    }
  }
  playLullaby(tempo = 1, loops = 99) { if (!this.ctx) return; this.lullaby = { idx: 0, next: this.now() + .3, tempo, loops }; }
  stopLullaby() { this.lullaby = null; }
  // ---------------------------------------------------------------- mise à jour : musique adaptative, cœur, souffle, ambiance
  update(dt, { danger = 0, chase = false, exert = 0 } = {}) {
    if (!this.ctx) return; const t = this.now(), L = this.layers;
    this.intensity += ((chase ? 1 : danger) - this.intensity) * Math.min(1, dt * 1.2);
    this.chase += ((chase ? 1 : 0) - this.chase) * Math.min(1, dt * (chase ? 3 : .6));
    const silent = this.state === 'silence';
    L.tension.g.gain.setTargetAtTime(Math.max(0, this.intensity - .15) * .022 * (1 - this.chase * .5), t, .5);
    L.choirLow.g.gain.setTargetAtTime(silent ? .035 + this.intensity * .03 : 0, t, 1.5);
    // --- poursuite : 136 bpm, taïkos, ostinato de violoncelle, cuivres, frappes métalliques
    if (chase) {
      const spb = 60 / 136, half = spb / 2;
      if (this.nextBeat < t - .1) this.nextBeat = t + .05;
      while (this.nextBeat < t + .15) {
        const bt = this.nextBeat, i = this.beatIdx++ % 16; // croches
        if ([0, 3, 6, 8, 11, 14].includes(i)) this.taiko(bt, i === 0 ? .5 : .32, i === 8 ? .8 : 1);
        if (i % 2 === 1) this.burst({ f: 7000, q: 1, dur: .03, vol: .025, t: bt, dest: this.music });
        this.cello(OST[i % 8] + (Math.floor(this.beatIdx / 64) % 2 ? 3 : 0), bt, half * .85, .045);
        if (i === 0 && (this.beatIdx / 16) % 2 < 1) this.brass(45, bt, spb * 2, .05);
        if (i === 12) this.metal(bt, .04, 300, undefined, this.music);
        if (i === 0) this.strings(69 + [0, 3, -2, 1][Math.floor(this.beatIdx / 16) % 4], bt, spb * 4, .012, 1.4);
        this.nextBeat += half;
      }
    } else {
      // --- tension sans poursuite : pulsation grave de violoncelle qui s'accélère
      if (this.intensity > .3 && t > this.nextPulse) { this.cello(33, t, .5, .05 * this.intensity); this.nextPulse = t + 1.3 - this.intensity * .7; }
    }
    // --- battements de cœur
    const hr = danger > .15 || chase ? .95 - Math.min(.5, danger * .5 + (chase ? .2 : 0)) : 0;
    if (hr && t > this.nextHeart) { const k = Math.min(1, danger + .3); this.tone({ f: 52, dur: .14, vol: .2 * k, t, slide: .6, dest: this.sfx }); this.burst({ f: 90, q: 1, type: 'lowpass', dur: .1, vol: .1 * k, t, brown: true, dest: this.sfx }); this.tone({ f: 46, dur: .14, vol: .14 * k, t: t + .2, slide: .6, dest: this.sfx }); this.nextHeart = t + hr; }
    // --- souffle de Mio (effort, peur)
    const breathe = Math.max(exert, danger * .8);
    if (breathe > .35 && t > this.nextBreath) { this.voice(t, .32, .025 + breathe * .02, 800, 1400); this.voice(t + .38, .4, .02 + breathe * .015, 600, 1100); this.nextBreath = t + 1.4 - breathe * .7; }
    // --- exploration : accords de cordes/chœur + fragments de boîte à musique
    const TR = [0, -2, 3, -5, 2, 0][this.chapter] || 0; // chaque chapitre a sa tonalité
    if (this.state === 'calm' && this.chase < .2 && t > this.nextChord) {
      const [b0, c0] = PROG[this.chordIdx++ % PROG.length], dur = 9, bass = b0 + TR, ch = c0.map(n => n + TR);
      this.strings(bass, t, dur, .05, .7);
      ch.forEach((n, i) => this.strings(n, t + i * .25, dur, .022, .9));
      if (this.chapter !== 1 && Math.random() < .55) this.choir(ch[2] + 12, t + 2, dur - 2, .024, this.chapter === 4 ? 'a' : 'u');
      // piano mélancolique : arpège lent sur l'accord, parfois une note de la comptine en haut
      const pat = [[0, 0], [1, .8], [2, 1.6], [1, 2.6], [0, 3.4], [2, 4.4], [3, 5.6], [1, 6.6]];
      const notes = [ch[0] - 12, ch[1] - 12, ch[2] - 12, ch[0]];
      for (const [k, dt] of pat) if (Math.random() < .85) this.piano(notes[k] + (Math.random() < .12 ? 12 : 0), t + dt + Math.random() * .06, .055 + Math.random() * .02, 3.2);
      if (Math.random() < .45) { const m = LULLABY[Math.floor(Math.random() * 21)][0]; if (m) this.piano(m + TR, t + 4.4, .05, 4); }
      this.piano(bass, t, .06, 6);
      this.nextChord = t + dur - .5 + Math.random() * 1.5;
    }
    // zone dangereuse (« silence ») : la musique ne se tait plus, elle se raréfie et devient dissonante
    if (this.state === 'silence' && this.chase < .2 && t > this.nextChord) {
      const r = 45 + TR + [0, 1, -2, 3][Math.floor(Math.random() * 4)];
      this.piano(r - 12, t, .06, 5); this.piano(r + 1, t + .9, .035, 4); if (Math.random() < .5) this.piano(r + 13, t + 2.1, .03, 4);
      this.strings(r - 12, t, 8, .03, .5);
      this.nextChord = t + 5 + Math.random() * 3;
    }
    if (this.state === 'calm' && this.chase < .2 && !this.lullaby && t > this.nextBox) {
      // quelques notes de la comptine, comme une boîte à musique lointaine qui se souvient
      const start = Math.floor(Math.random() * 3) * 7, n = 4 + Math.floor(Math.random() * 4); let tt = t;
      for (let i = 0; i < n; i++) { const [m, d] = LULLABY[start + i]; this.musicBox(m + 12 + TR, tt, .07 + Math.random() * .015); tt += d * .7; }
      this.nextBox = t + 10 + Math.random() * 8;
    }
    // --- comptine complète (moments d'émotion)
    if (this.lullaby && t > this.lullaby.next - .1) {
      const [n, d] = LULLABY[this.lullaby.idx % LULLABY.length]; const beat = .62 / this.lullaby.tempo;
      this.musicBox(n + 12, this.lullaby.next, .085); this.piano(n, this.lullaby.next, .06, d * beat * 2);
      if (this.lullaby.idx % 7 === 0) { this.strings(n - 24, this.lullaby.next, beat * 7, .014, .8); this.choir(n - 12, this.lullaby.next, beat * 6, .01, 'o'); }
      this.lullaby.next += d * beat; this.lullaby.idx++;
      if (this.lullaby.idx >= LULLABY.length * this.lullaby.loops) this.lullaby = null;
    }
    // --- évènements d'ambiance propres au lieu (spatialisés autour de l'auditeur)
    if (t > this.nextEvent) {
      const ch = this.chapter, rx = this.listenerX + (Math.random() - .5) * 24;
      const pool = [['creak', 'creak', 'crow', 'drip'], ['clank', 'clank', 'steam', 'drip', 'creak'], ['creak', 'tick', 'drip', 'ghost'], ['drip', 'creak'], ['bird', 'bird'], ['bird']][ch] || [];
      if (pool.length) { const n = pool[Math.floor(Math.random() * pool.length)]; if (n === 'tick') for (let i = 0; i < 8; i++) setTimeout(() => this.play('tick'), i * 1000); else this.play(n, { x: rx }); }
      this.nextEvent = t + (ch === 4 ? 2 : 3.5) + Math.random() * 7;
    }
  }
}
