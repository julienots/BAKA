// Moteur audio entièrement procédural (Web Audio) : ambiances, musique adaptative, pas, pouvoirs.
const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
// Comptine originale (notes MIDI, durées en temps)
const LULLABY = [
  [69, 1], [72, 1], [76, 1.5], [74, .5], [72, 1], [71, 1], [69, 2],
  [67, 1], [69, 1], [71, 1.5], [72, .5], [71, 1], [67, 1], [64, 2],
  [69, 1], [72, 1], [76, 1.5], [77, .5], [76, 1], [74, 1], [72, 2],
  [71, 1], [72, 1], [74, 1], [71, 1], [69, 3], [0, 1],
];
const CHORDS = [[45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59], [40, 47, 52, 56]];

export class AudioEngine {
  constructor() { this.ctx = null; this.vol = { master: .9, music: .7, sfx: .9 }; this.state = 'silence'; this.intensity = 0; this.heart = 0; this.chapter = 0; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.vol.master; this.master.connect(c.destination);
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(this.master); this.comp = comp;
    this.music = c.createGain(); this.music.gain.value = this.vol.music; this.music.connect(comp);
    this.sfx = c.createGain(); this.sfx.gain.value = this.vol.sfx; this.sfx.connect(comp);
    this.amb = c.createGain(); this.amb.gain.value = .8; this.amb.connect(comp);
    // réverbération générée
    this.verb = c.createConvolver(); this.verb.buffer = this.impulse(3.2, 2.4); const vg = c.createGain(); vg.gain.value = .55; this.verb.connect(vg); vg.connect(comp);
    this.noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate); const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.brownBuf = c.createBuffer(1, c.sampleRate * 4, c.sampleRate); const bd = this.brownBuf.getChannelData(0); let last = 0; for (let i = 0; i < bd.length; i++) { last = (last + .02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = last * 3.5; }
    this.layers = {}; this.nextBeat = 0; this.nextNote = 0; this.noteIdx = 0; this.nextChord = 0; this.chordIdx = 0; this.nextHeart = 0; this.nextEvent = 0;
    this.buildLayers();
  }
  impulse(sec, decay) { const c = this.ctx, len = c.sampleRate * sec, b = c.createBuffer(2, len, c.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); } return b; }
  setVolumes(v) { Object.assign(this.vol, v); if (!this.ctx) return; this.master.gain.value = this.vol.master; this.music.gain.value = this.vol.music; this.sfx.gain.value = this.vol.sfx; }
  now() { return this.ctx ? this.ctx.currentTime : 0; }
  noise(brown = false) { const s = this.ctx.createBufferSource(); s.buffer = brown ? this.brownBuf : this.noiseBuf; s.loop = true; return s; }
  buildLayers() {
    const c = this.ctx;
    // vent : bruit brun filtré avec modulation lente
    const wind = this.noise(true), wf = c.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 400; wf.Q.value = .6;
    const wg = c.createGain(); wg.gain.value = 0; wind.connect(wf); wf.connect(wg); wg.connect(this.amb); wind.start();
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = .07; lg.gain.value = 260; lfo.connect(lg); lg.connect(wf.frequency); lfo.start();
    this.layers.wind = wg; this.layers.windF = wf;
    // nappe grave (drone)
    const dg = c.createGain(); dg.gain.value = 0; const df = c.createBiquadFilter(); df.type = 'lowpass'; df.frequency.value = 300; df.connect(dg); dg.connect(this.music); dg.connect(this.verb);
    this.droneOsc = [];
    for (const f of [55, 55.4, 82.4]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(df); o.start(); this.droneOsc.push(o); }
    this.layers.drone = dg; this.layers.droneF = df;
    // tension : cluster aigu dissonant
    const tg = c.createGain(); tg.gain.value = 0; const tf = c.createBiquadFilter(); tf.type = 'bandpass'; tf.frequency.value = 900; tf.Q.value = 2; tf.connect(tg); tg.connect(this.music); tg.connect(this.verb);
    for (const f of [622, 659, 698]) { const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f; const vib = c.createOscillator(), vg = c.createGain(); vib.frequency.value = 4 + Math.random(); vg.gain.value = 3; vib.connect(vg); vg.connect(o.frequency); vib.start(); o.connect(tf); o.start(); }
    this.layers.tension = tg;
    // pluie
    const rain = this.noise(), rf = c.createBiquadFilter(); rf.type = 'highpass'; rf.frequency.value = 2500; const rg = c.createGain(); rg.gain.value = 0; rain.connect(rf); rf.connect(rg); rg.connect(this.amb); rain.start();
    this.layers.rain = rg;
  }
  setChapter(i) {
    this.chapter = i; if (!this.ctx) return;
    const t = this.now(), L = this.layers;
    const cfg = [
      { wind: .5, wf: 380, drone: .045, df: 260, rain: 0 },
      { wind: .25, wf: 250, drone: .06, df: 200, rain: 0 },
      { wind: .12, wf: 600, drone: .05, df: 340, rain: 0 },
      { wind: .3, wf: 500, drone: .05, df: 280, rain: .22 },
      { wind: .35, wf: 700, drone: .025, df: 500, rain: 0 },
      { wind: .02, wf: 900, drone: 0, df: 500, rain: 0 },
    ][i] || { wind: .3, wf: 400, drone: .04, df: 300, rain: 0 };
    L.wind.gain.setTargetAtTime(cfg.wind, t, 1.5); L.windF.frequency.value = cfg.wf;
    L.drone.gain.setTargetAtTime(cfg.drone, t, 2); L.droneF.frequency.setTargetAtTime(cfg.df, t, 2);
    L.rain.gain.setTargetAtTime(cfg.rain, t, 2);
  }
  setMood(state) { this.state = state; }
  // ---------- sons ponctuels ----------
  env(g, t, a, peak, d) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  burst({ f = 1000, q = 1, type = 'bandpass', dur = .1, vol = .3, t = this.now(), dest = this.sfx, brown = false, sweep = 0, verb = 0 }) {
    if (!this.ctx) return; const c = this.ctx;
    const s = this.noise(brown), fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (sweep) fl.frequency.exponentialRampToValueAtTime(Math.max(40, f * sweep), t + dur); fl.Q.value = q;
    const g = c.createGain(); s.connect(fl); fl.connect(g); g.connect(dest); if (verb) { const vg = c.createGain(); vg.gain.value = verb; g.connect(vg); vg.connect(this.verb); }
    this.env(g, t, .005, vol, dur); s.start(t, Math.random()); s.stop(t + dur + .1);
  }
  tone({ f = 220, type = 'sine', dur = .3, vol = .2, t = this.now(), slide = 0, dest = this.sfx, verb = 0, a = .005 }) {
    if (!this.ctx) return; const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
    o.connect(g); g.connect(dest); if (verb) { const vg = c.createGain(); vg.gain.value = verb; g.connect(vg); vg.connect(this.verb); }
    this.env(g, t, a, vol, dur); o.start(t); o.stop(t + dur + a + .05);
  }
  piano(midi, t, vol = .16, dur = 2.5) {
    if (!this.ctx || !midi) return; const c = this.ctx, f = NOTE(midi);
    const g = c.createGain(); g.connect(this.music); const vg = c.createGain(); vg.gain.value = .9; g.connect(vg); vg.connect(this.verb);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .006); g.gain.exponentialRampToValueAtTime(vol * .35, t + .25); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    [[1, 1], [2, .45], [3, .2], [4, .12], [5.02, .06]].forEach(([m, a], i) => {
      const o = c.createOscillator(), og = c.createGain(); o.type = 'sine'; o.frequency.value = f * m * (1 + (i ? .0008 * i : 0)); og.gain.value = a;
      og.gain.setValueAtTime(a, t); og.gain.exponentialRampToValueAtTime(a * .05 + 1e-4, t + dur * (1 / (i + 1)));
      o.connect(og); og.connect(g); o.start(t); o.stop(t + dur + .1);
    });
    this.burst({ f: 3000, q: .7, dur: .02, vol: vol * .15, t, dest: this.music });
  }
  step(surface, run) {
    const v = run ? .2 : .12;
    switch (surface) {
      case 'wood': this.burst({ f: 380, q: 2, dur: .07, vol: v * 1.1 }); this.tone({ f: 140, type: 'triangle', dur: .05, vol: v * .4 }); break;
      case 'metal': this.burst({ f: 1800, q: 6, dur: .06, vol: v * .8, verb: .4 }); this.tone({ f: 420 + Math.random() * 60, type: 'square', dur: .05, vol: v * .12, verb: .3 }); break;
      case 'water': this.burst({ f: 900, q: .8, dur: .18, vol: v * 1.2, sweep: .5 }); break;
      case 'grass': this.burst({ f: 3200, q: .6, dur: .1, vol: v * .7, type: 'highpass' }); break;
      case 'concrete': this.burst({ f: 1200, q: 1.2, dur: .05, vol: v * .9, verb: .25 }); break;
      default: this.burst({ f: 700, q: .9, dur: .07, vol: v, brown: true }); this.burst({ f: 2500, q: 1, dur: .03, vol: v * .3 });
    }
  }
  play(name, opt = {}) {
    if (!this.ctx) return; const t = this.now();
    switch (name) {
      case 'jump': this.burst({ f: 900, q: .7, dur: .12, vol: .08 }); this.tone({ f: 300, dur: .08, vol: .02, slide: 1.4 }); break;
      case 'land': this.burst({ f: 300, q: .7, dur: .14, vol: .22 * (opt.k || 1), brown: true }); break;
      case 'breath': this.burst({ f: 1400, q: .5, dur: .5, vol: .03, sweep: .7 }); break;
      case 'climb': this.burst({ f: 600, q: 1, dur: .25, vol: .09, brown: true }); break;
      case 'scrape': this.burst({ f: 260 + Math.random() * 80, q: 3, dur: .25, vol: .12, brown: true }); break;
      case 'lever': this.tone({ f: 120, type: 'square', dur: .12, vol: .06, slide: .6, verb: .4 }); this.burst({ f: 2400, q: 8, dur: .15, vol: .1, verb: .5 }); break;
      case 'gate': this.burst({ f: 180, q: 1.5, dur: 1.2, vol: .18, brown: true, verb: .6 }); this.tone({ f: 70, type: 'sawtooth', dur: 1, vol: .05, verb: .5 }); break;
      case 'latch': this.burst({ f: 3000, q: 10, dur: .05, vol: .1 }); break;
      case 'crash': this.burst({ f: 200, q: .5, dur: 1.4, vol: .4, brown: true, verb: .8 }); this.burst({ f: 2000, q: .5, dur: .6, vol: .15, verb: .7 }); break;
      case 'howl': {
        const c = this.ctx, o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 3;
        o.type = 'sawtooth'; const b = 300 + Math.random() * 60; o.frequency.setValueAtTime(b, t); o.frequency.linearRampToValueAtTime(b * 1.9, t + .7); o.frequency.linearRampToValueAtTime(b * 1.7, t + 2); o.frequency.linearRampToValueAtTime(b * 1.1, t + 2.8);
        const vib = c.createOscillator(), vg = c.createGain(); vib.frequency.value = 5; vg.gain.value = 8; vib.connect(vg); vg.connect(o.frequency); vib.start(t); vib.stop(t + 3);
        o.connect(f); f.connect(g); g.connect(this.sfx); const vv = c.createGain(); vv.gain.value = 1.2; g.connect(vv); vv.connect(this.verb);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(.09 * (opt.vol || 1), t + .4); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.9); o.start(t); o.stop(t + 3);
        break;
      }
      case 'growl': this.burst({ f: 140, q: 4, dur: .6, vol: .2, brown: true }); this.tone({ f: 70, type: 'sawtooth', dur: .5, vol: .05 }); break;
      case 'bite': this.burst({ f: 1500, q: 2, dur: .08, vol: .3 }); this.burst({ f: 200, q: 1, dur: .3, vol: .3, brown: true }); break;
      case 'death': this.tone({ f: 220, type: 'sine', dur: 1.8, vol: .1, slide: .5, dest: this.music, verb: 1 }); this.burst({ f: 500, q: .5, dur: 1, vol: .1, sweep: .2, verb: 1 }); break;
      case 'memory': [76, 79, 83, 88].forEach((n, i) => this.piano(n, t + i * .18, .12, 3)); break;
      case 'unlock': [57, 64, 69, 72, 76].forEach((n, i) => this.piano(n, t + i * .12, .14, 4)); this.burst({ f: 4000, q: .4, dur: 2, vol: .05, verb: 1 }); break;
      case 'lueurCharge': this.tone({ f: 110, type: 'sawtooth', dur: .6, vol: .05, slide: 2, verb: .5 }); break;
      case 'lueur': this.burst({ f: 120, q: .5, dur: 1.2, vol: .5, brown: true, verb: .8 }); this.tone({ f: 330, dur: 2, vol: .08, slide: .5, verb: 1 }); this.burst({ f: 5000, q: .3, dur: .8, vol: .08, verb: .8 }); break;
      case 'souffle': this.burst({ f: 500, q: .4, dur: .9, vol: .45, sweep: 4, verb: .4 }); this.burst({ f: 80, q: .5, dur: .5, vol: .3, brown: true }); break;
      case 'echoOn': this.tone({ f: 880, dur: 2.5, vol: .05, slide: .5, verb: 1.2, a: .4 }); this.tone({ f: 1318, dur: 2, vol: .03, slide: .5, verb: 1.2, a: .3 }); break;
      case 'echoOff': this.tone({ f: 440, dur: .8, vol: .04, slide: 2, verb: 1 }); break;
      case 'dash': this.burst({ f: 2000, q: .4, dur: .3, vol: .25, sweep: .2 }); this.burst({ f: 100, q: .8, dur: .3, vol: .2, brown: true }); break;
      case 'grab': this.burst({ f: 200, q: 1, dur: .8, vol: .3, brown: true, verb: .8 }); this.tone({ f: 60, type: 'sawtooth', dur: 1.2, vol: .1, verb: .6 }); break;
      case 'ghost': this.tone({ f: 200 + Math.random() * 40, type: 'sine', dur: 2, vol: .04, slide: .8, verb: 1.2, a: .5 }); break;
      case 'drip': this.tone({ f: 1400 + Math.random() * 500, dur: .12, vol: .05, slide: .6, verb: 1.2 }); break;
      case 'creak': this.burst({ f: 500 + Math.random() * 300, q: 25, dur: .8, vol: .06, verb: .9, sweep: 1.3 }); break;
      case 'splash': this.burst({ f: 700, q: .5, dur: .8, vol: .35, sweep: .4, verb: .4 }); break;
      case 'chime': this.piano(84, t, .1, 2); break;
      case 'thunder': this.burst({ f: 90, q: .4, dur: 3.5, vol: .5, brown: true, verb: 1 }); break;
    }
  }
  playLullaby(tempo = 1, loops = 99) { if (!this.ctx) return; this.lullaby = { idx: 0, next: this.now() + .3, tempo, loops }; }
  stopLullaby() { this.lullaby = null; }
  // ---------- mise à jour (musique adaptative) ----------
  update(dt, { danger = 0, chase = false, hidden = false } = {}) {
    if (!this.ctx) return; const t = this.now(), L = this.layers;
    this.intensity += ((chase ? 1 : danger) - this.intensity) * Math.min(1, dt * 1.5);
    L.tension.gain.setTargetAtTime(this.state === 'silence' ? 0 : this.intensity * .035, t, .4);
    // percussions de poursuite
    if (chase && t > this.nextBeat - .05) {
      const bt = Math.max(t, this.nextBeat), spb = 60 / 132;
      this.tone({ f: 70, type: 'sine', dur: .25, vol: .35, slide: .5, t: bt, dest: this.music });
      this.burst({ f: 180, q: 1, dur: .18, vol: .18, brown: true, t: bt + spb * .5, dest: this.music });
      if (Math.random() < .5) this.burst({ f: 2500, q: 3, dur: .04, vol: .05, t: bt + spb * .75, dest: this.music });
      this.tone({ f: NOTE([45, 45, 48, 44][Math.floor(bt / spb) % 4]), type: 'sawtooth', dur: spb * .9, vol: .04, t: bt, dest: this.music, verb: .3 });
      this.nextBeat = bt + spb;
    } else if (!chase) this.nextBeat = Math.max(this.nextBeat, t);
    // battements de cœur selon le danger
    const hr = danger > .15 || chase ? 0.95 - Math.min(.5, danger * .5 + (chase ? .2 : 0)) : 0;
    if (hr && t > this.nextHeart) { this.tone({ f: 55, dur: .12, vol: .18 * Math.min(1, danger + .3), t, slide: .7 }); this.tone({ f: 50, dur: .12, vol: .13 * Math.min(1, danger + .3), t: t + .22, slide: .7 }); this.nextHeart = t + hr; }
    // accords lents d'exploration (pas dans le silence)
    if (this.state === 'calm' && !chase && t > this.nextChord) {
      const ch = CHORDS[this.chordIdx++ % CHORDS.length];
      ch.forEach((n, i) => this.tone({ f: NOTE(n + 12), type: 'triangle', dur: 7, vol: .016, a: 2.5, t: t + i * .05, dest: this.music, verb: .9 }));
      this.nextChord = t + 9 + Math.random() * 6;
    }
    if (this.lullaby && t > this.lullaby.next - .1) {
      const [n, d] = LULLABY[this.lullaby.idx % LULLABY.length]; const beat = .62 / this.lullaby.tempo;
      this.piano(n, this.lullaby.next, .13, d * beat * 2.2);
      if (this.lullaby.idx % 4 === 0) this.piano(n - 24, this.lullaby.next, .07, 3.5);
      this.lullaby.next += d * beat; this.lullaby.idx++;
      if (this.lullaby.idx >= LULLABY.length * (this.lullaby.loops || 99)) this.lullaby = null;
    }
    // évènements d'ambiance aléatoires
    if (t > this.nextEvent) {
      const ch = this.chapter;
      const pool = [['creak', 'drip'], ['creak', 'drip', 'creak'], ['creak', 'drip'], ['drip', 'drip'], ['breath'], []][ch] || [];
      if (pool.length) this.play(pool[Math.floor(Math.random() * pool.length)]);
      this.nextEvent = t + 4 + Math.random() * 9;
    }
  }
}
