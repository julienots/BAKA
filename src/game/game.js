// Cœur du jeu : boucle à pas fixe, chargement des chapitres, sauvegarde, mort douce, cinématiques
import * as THREE from 'three';
import { Post } from '../core/post.js';
import { NoiseFog } from '../core/fog.js';
import { Input } from '../core/input.js';
import { AudioEngine } from '../core/audio.js';
import { setSeed, clamp, damp } from '../core/util.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Powers } from './powers.js';
import { FX } from './fx.js';
import { Props } from './props.js';
import { CameraRig } from './camera.js';
import { UI } from '../ui/ui.js';
import { CHAPTERS, ALL } from '../levels/index.js';

const SAVE_KEY = 'manteau_rouge_save_v1', SET_KEY = 'manteau_rouge_settings_v1';
const STEP = 1 / 60;
export const MEMORY_IDS = ['dessin', 'boite', 'lapin', 'moufle', 'photo'];

function load(k, def) { try { return { ...def, ...JSON.parse(localStorage.getItem(k) || '{}') }; } catch (e) { return { ...def }; } }
function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } }

export class Game {
  constructor(root) {
    this.root = root;
    const touch = matchMedia('(pointer: coarse)').matches;
    this.settings = load(SET_KEY, { quality: touch ? 'medium' : 'high', master: .9, music: .75, sfx: .9, vibration: true, ctrl: 1 });
    this.save = load(SAVE_KEY, { started: false, chapter: 0, cp: 0, maxChapter: 0, memories: [], powers: [false, false, false, false] });
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace; this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    root.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(34, 16 / 9, .3, 400);
    this.rig = new CameraRig(this.camera);
    this.post = new Post(this.renderer, this.camera);
    this.input = new Input(); this.audio = new AudioEngine();
    this.chapterDefs = CHAPTERS;
    this.state = 'menu'; this.time = 0; this.acc = 0; this.enemies = [];
    this.ui = new UI(this);
    this.input.bindTouch(document.getElementById('touch'));
    this.applySettings(false);
    addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden) { if (this.state === 'play') this.pause(); if (this.audio.ctx) this.audio.ctx.suspend(); } else if (this.audio.ctx && this.state !== 'pause') this.audio.ctx.resume(); });
    const unlockAudio = () => { this.audio.init(); this.audio.setVolumes({ master: this.settings.master, music: this.settings.music, sfx: this.settings.sfx }); };
    addEventListener('pointerdown', unlockAudio); addEventListener('keydown', unlockAudio);
    this.resize();
    this.menuScene();
    this.last = performance.now();
    this.loop = this.loop.bind(this); requestAnimationFrame(this.loop);
  }
  // ------------------------------------------------------------ réglages
  applySettings(qualityChanged) {
    const s = this.settings; store(SET_KEY, s);
    this.audio.setVolumes({ master: s.master, music: s.music, sfx: s.sfx });
    this.input.vibration = s.vibration; this.ui.setCtrlSize(s.ctrl);
    if (qualityChanged) { this.resize(); if (this.chapter !== undefined && this.state !== 'menu') this.reloadChapter(); }
  }
  pixelRatio() { const d = devicePixelRatio || 1, q = this.settings.quality; let pr = q === 'low' ? Math.min(d, 1) * .7 : q === 'medium' ? Math.min(d, 1.3) : Math.min(d, 2); const maxPix = q === 'high' ? 3.2e6 : 1.6e6; const pix = innerWidth * innerHeight * pr * pr; if (pix > maxPix) pr *= Math.sqrt(maxPix / pix); return pr; }
  resize() {
    const w = innerWidth, h = innerHeight, pr = this.pixelRatio();
    this.W = w; this.H = h * pr;
    this.renderer.setPixelRatio(pr); this.renderer.setSize(w, h);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.post.setQuality(this.settings.quality, w, h, pr);
    if (this.fx) this.fx.setScale(h * pr);
    const shadow = this.settings.quality === 'low' ? 1024 : this.settings.quality === 'medium' ? 1536 : 2048;
    if (this.sun) { this.sun.shadow.mapSize.set(shadow, shadow); if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; } }
    const portrait = h > w && this.input.isTouch; this.ui.rotateHint(portrait);
  }
  // ------------------------------------------------------------ scène du menu (forêt en arrière-plan)
  menuScene() {
    this.startChapter(0, 0, false, true);
    this.state = 'menu'; this.ui.show('menu'); this.ui.touch(false);
    this.player.control = false;
    this.rig.override = { dist: 9, height: 1.2, look: 2.4, fov: 36, ahead: 0 };
  }
  newGame() {
    this.audio.init();
    this.save = { started: true, chapter: 0, cp: 0, maxChapter: 0, memories: [], powers: [false, false, false, false] }; store(SAVE_KEY, this.save);
    this.goFullscreen();
    this.startChapter(0, 0, true);
  }
  continueGame() { this.audio.init(); this.goFullscreen(); this.startChapter(this.save.chapter, this.save.cp, true); }
  goFullscreen() {
    if (!this.input.isTouch) return;
    const el = document.documentElement;
    try { const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : null; if (p) p.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => { })).catch(() => { }); } catch (e) { /* ignore */ }
  }
  toMenu() { this.ui.updateMenu(); this.menuScene(); }
  pause() { if (this.state !== 'play') return; this.state = 'pause'; this.ui.show('pause'); }
  resume() { this.ui.hideAll(); this.state = 'play'; this.input.update(); if (this.audio.ctx) this.audio.ctx.resume(); }
  // ------------------------------------------------------------ chargement
  clearScene() {
    if (this.scene) {
      this.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && !o.material.userData?.shared) { const m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach(mm => { if (mm.type === 'ShaderMaterial' || mm.type === 'PointsMaterial') mm.dispose(); }); } });
    }
    this.scene = new THREE.Scene();
    this.enemies = []; this.sun = null; this.cine = null;
  }
  startChapter(i, cp = 0, play = true, menu = false) {
    this.chapter = i; this.cpIndex = cp;
    this.clearScene(); setSeed(1337 + i * 101);
    const def = ALL[i]; this.level = def;
    this.world = new World(this); this.props = new Props(this); this.fx = new FX(this); this.fx.setScale(this.H);
    this.player = new Player(this); this.player.addTo(this.scene);
    this.powers = new Powers(this); this.powers.attach(this.scene);
    // pouvoirs déjà acquis
    const pw = this.save.powers || []; for (let k = 0; k < 4; k++) this.powers.unlocked[k] = !!pw[k] || (def.powers && def.powers[k]);
    const last = this.powers.unlocked.lastIndexOf(true); if (last >= 0) this.powers.cur = last;
    this.ui.setPower(this.powers);
    this.post.params.grade = { sat: .4, tint: new THREE.Vector3(.92, 1, 1.08), shadow: new THREE.Vector3(.025, .03, .04), contrast: 1.15, exposure: .95, warm: 0, ...def.grade };
    this.post.params.grade.tint = new THREE.Vector3(...(def.grade?.tint || [.92, 1, 1.08])); this.post.params.grade.shadow = new THREE.Vector3(...(def.grade?.shadow || [.025, .03, .04]));
    this.post.params.rays = def.rays ?? .5; this.post.params.bloom = def.bloom ?? .45; this.post.params.aperture = def.aperture ?? 16;
    this.rig.def = { dist: 11, height: 1.7, look: 1.2, fov: 34, ahead: 1.6, xOff: 0, zLook: 0, ...(def.camera || {}) };
    this.rig.override = null;
    def.build(this);
    this.world.checkpoints.unshift(def.start);
    const c = this.world.checkpoints[Math.min(cp, this.world.checkpoints.length - 1)];
    this.player.place(c.x, c.y, c.z, 1);
    this.world.checkpoints.forEach((k, idx) => k.reached = idx <= cp);
    // avance les déclencheurs déjà franchis
    for (const t of this.world.triggers) if (!t.zone && t.x < c.x - .01 && !t.persist) { t.done = true; }
    if (def.restoreAt) def.restoreAt(this, cp);
    this.snap = this.world.snapshot(); this.snapshotEnemies();
    this.rig.snap(this.camTarget(), this.world.camZones);
    this.audio.setChapter(i); this.audio.setMood('calm'); this.audio.stopLullaby();
    this.post.params.fade = 1; this.fadeTarget = 0; this.post.params.white = 0; this.post.params.echo = 0;
    if (play) {
      this.state = 'play'; this.ui.hideAll(); this.ui.touch(this.input.isTouch); this.player.control = true;
      if (!def.epilogue) { this.save.chapter = i; this.save.cp = cp; this.save.maxChapter = Math.max(this.save.maxChapter, i); store(SAVE_KEY, this.save); }
      if (cp === 0 && def.intro) def.intro(this); else if (!def.epilogue) this.ui.titleCard(['I', 'II', 'III', 'IV', 'V'][i], def.title, def.sub);
    }
  }
  startEpilogue() { this.startChapter(5, 0, true); }
  reloadChapter() { const st = this.state; this.startChapter(this.chapter, this.cpIndex, st !== 'menu', st === 'menu'); if (st === 'menu') this.menuScene(); else if (st === 'pause') { this.state = 'pause'; this.ui.show('pause'); } }
  camTarget() { const p = this.player; return { x: p.pos.x, y: p.pos.y, z: p.pos.z, facing: p.facing, vx: p.state === 'normal' ? p.vel.x : 0 }; }
  addEnemy(e) { this.enemies.push(e); return e; }
  // ------------------------------------------------------------ lumière
  setupLights(o) {
    const s = this.scene;
    s.fog = new NoiseFog(o.fog, o.fogDensity);
    s.add(new THREE.HemisphereLight(o.hemiSky, o.hemiGround, o.hemi));
    const sun = this.sun = new THREE.DirectionalLight(o.sun, o.sunI);
    this.sunOffset = new THREE.Vector3(...o.sunDir).normalize().multiplyScalar(40);
    sun.castShadow = true; const sz = this.settings.quality === 'low' ? 1024 : this.settings.quality === 'medium' ? 1536 : 2048; sun.shadow.mapSize.set(sz, sz);
    Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 12, bottom: -10, near: 1, far: 100 });
    sun.shadow.bias = -.0006; sun.shadow.normalBias = .03;
    s.add(sun, sun.target);
    if (o.fill) { const f = new THREE.DirectionalLight(o.fill, o.fillI || .8); f.position.set(-4, 5, 10); s.add(f); this.fillLight = f; }
    // lumière d'accompagnement de Mio (lisibilité)
    this.key = new THREE.PointLight(o.key || 0xaab6c4, o.keyI ?? 18, 8, 1.2); s.add(this.key);
    this.rim = new THREE.PointLight(o.rimC || 0xc0d0e0, o.rimI ?? 20, 6, 1.2); s.add(this.rim);
    this.lightDir = new THREE.Vector3(...(o.lightDir || o.sunDir)).normalize();
  }
  // ------------------------------------------------------------ évènements de jeu
  shake(k) { this.rig.shake(k); }
  onMemory(id, pos) {
    if (!this.save.memories.includes(id)) this.save.memories.push(id); store(SAVE_KEY, this.save);
    this.audio.play('memory'); this.audio.playLullaby(1, 1);
    this.ui.memory(id); this.fx.flash(pos.x, pos.y + .5, pos.z, 0xffd0a0, 8, 5, 1);
    for (let i = 0; i < 40; i++) this.fx.mote(pos.x + (Math.random() - .5), pos.y + Math.random(), pos.z + (Math.random() - .5), [1, .85, .6]);
  }
  unlockPower(i, pos) {
    this.powers.unlock(i); this.save.powers[i] = true; store(SAVE_KEY, this.save);
    this.audio.play('unlock'); this.shake(.3);
    const col = [new THREE.Color(1.2, .4, .15), new THREE.Color(.8, .85, .9), new THREE.Color(.5, .8, 1.2), new THREE.Color(.5, .4, 1.2)][i];
    this.fx.shockwave(pos.x, pos.y + 1, pos.z, 4, col, 1.6); this.fx.flash(pos.x, pos.y + 1, pos.z, col.getHex(), 30, 8, 1);
    for (let k = 0; k < 80; k++) this.fx.ember(pos.x, pos.y + 1, pos.z, 2);
    this.player.model.glow = 2;
  }
  respawn() {
    this.fadeTarget = 1;
    this.pending = () => {
      this.world.restore(this.snap);
      const cps = this.world.checkpoints, c = cps[this.cpIndex] || cps[0];
      this.player.place(c.x, c.y, c.z, 1); this.player.carrying = null; this.powers.reset();
      for (const e of this.enemies) if (e.save && this.enemyState) { /* restauré via snapshot */ }
      this.restoreEnemies();
      if (this.level.onRespawn) this.level.onRespawn(this, this.cpIndex);
      this.fx.clear(); this.rig.snap(this.camTarget(), this.world.camZones); this.fadeTarget = 0; this.player.fear = 0;
    };
  }
  snapshotEnemies() { this.enemySnap = this.enemies.map(e => e.save ? e.save() : null); }
  restoreEnemies() { if (!this.enemySnap) return; this.enemies.forEach((e, i) => { if (e.load && this.enemySnap[i]) e.load(this.enemySnap[i]); }); }
  reachCheckpoint(idx) {
    this.cpIndex = idx; this.world.checkpoints[idx].reached = true;
    this.snap = this.world.snapshot(); this.snapshotEnemies();
    this.save.cp = idx; this.save.chapter = this.chapter; store(SAVE_KEY, this.save);
  }
  endChapter() {
    if (this.ending) return; this.ending = true;
    this.fadeTarget = 1;
    setTimeout(() => {
      this.ending = false;
      if (this.chapter < CHAPTERS.length - 1) { this.save.chapter = this.chapter + 1; this.save.cp = 0; this.save.maxChapter = Math.max(this.save.maxChapter, this.chapter + 1); store(SAVE_KEY, this.save); this.startChapter(this.chapter + 1, 0, true); }
    }, 1800);
  }
  async finale() {
    this.ui.touch(false); this.state = 'credits';
    const n = this.save.memories.length;
    await this.ui.credits(`${n} / 5`);
    this.save.chapter = 0; this.save.cp = 0; store(SAVE_KEY, this.save);
    this.toMenu();
  }
  // ------------------------------------------------------------ cinématiques (scripts asynchrones)
  runCine(fn) {
    const g = this; const p = this.player; p.control = false; this.ui.touch(false);
    const token = {}; this.cine = token;
    const api = {
      wait: s => new Promise(res => { const end = g.time + s; const chk = () => { if (g.cine !== token) return; if (g.time >= end) res(); else setTimeout(chk, 30); }; chk(); }),
      until: cond => new Promise(res => { const chk = () => { if (g.cine !== token) return; if (cond()) res(); else setTimeout(chk, 30); }; chk(); }),
      walk: (mx, mz = 0, run = false) => { p.cine = { mx, mz, run }; },
      stop: () => { p.cine = { mx: 0, mz: 0 }; },
      cam: o => { g.rig.override = o; },
    };
    return fn(api).then(() => { if (g.cine !== token) return; p.cine = null; p.control = true; g.rig.override = null; g.cine = null; if (g.state === 'play') g.ui.touch(g.input.isTouch); }).catch(e => console.error(e));
  }
  // ------------------------------------------------------------ boucle
  loop(now) {
    requestAnimationFrame(this.loop);
    if (window.__freeze) { this.last = now; this.render(0); return; }
    let dt = Math.min(.1, (now - this.last) / 1000); this.last = now;
    this.acc += dt; let steps = 0;
    while (this.acc >= STEP && steps < 5) { this.step(STEP); this.acc -= STEP; steps++; }
    if (steps >= 5) this.acc = 0;
    this.render(dt);
  }
  step(dt) {
    this.input.update();
    if (this.state === 'menu' || this.state === 'pause') {
      this.ui.navigate(this.input);
      if (this.state === 'pause' && this.input.pressed('pause')) this.resume();
      if (this.state === 'pause') return;
    }
    if (this.state === 'play' && this.input.pressed('pause')) { this.pause(); return; }
    this.time += dt;
    if (this.scene.fog && this.scene.fog.isFog) this.scene.fog.near = this.time;
    const p = this.player, w = this.world;
    if (this.state === 'play' && !this.cine && this.player.state !== 'dead') this.interactions(dt);
    this.powers.update(dt, this.state === 'play' && !this.cine ? this.input : NO_INPUT);
    p.update(dt, this.state === 'play' ? this.input : NO_INPUT);
    w.update(dt, p);
    for (const e of this.enemies) e.update(dt);
    if (this.level.update) this.level.update(this, dt);
    for (const a of this.props.anim) a(dt, this.time);
    this.fx.update(dt);
    // points de passage
    const cps = w.checkpoints;
    for (let i = this.cpIndex + 1; i < cps.length; i++) if (p.pos.x >= cps[i].x && p.state !== 'dead') this.reachCheckpoint(i);
    // danger, peur, musique
    let danger = 0, chase = false;
    for (const e of this.enemies) { if (e.danger) danger = Math.max(danger, e.danger); if (e.kind === 'wolf' && e.state === 'chase' && e.danger > .05 && !(e.scared > 0)) chase = true; }
    p.fear = damp(p.fear, Math.min(1, danger * 1.2), 3, dt);
    this.audio.update(dt, { danger, chase, exert: p.exert || 0 }); this.audio.setListener(p.pos.x);
    const pp = this.post.params;
    pp.fear = damp(pp.fear, danger > .5 ? (danger - .5) * 1.6 : 0, 3, dt);
    pp.hurt = damp(pp.hurt, p.state === 'dead' ? 1 : 0, 3, dt);
    pp.echo = w.echoT;
    pp.fade = damp(pp.fade, this.fadeTarget, 3.2, dt);
    if (this.pending && pp.fade > .97) { const f = this.pending; this.pending = null; f(); }
    // lumières suivant Mio
    if (this.sun) { this.sun.target.position.copy(p.pos); this.sun.position.copy(p.pos).add(this.sunOffset); }
    if (this.key) { this.key.position.set(p.pos.x + 2.2, p.pos.y + 2.4, p.pos.z + 3.4); this.rim.position.set(p.pos.x + 1.4, p.pos.y + 1.9, p.pos.z - 1.4); }
    this.rig.update(dt, this.camTarget(), w.camZones);
    // vent ambiant
    w.windX = (this.level.wind || .3) * (1 + Math.sin(this.time * .4) * .5);
  }
  interactions(dt) {
    const p = this.player, w = this.world, inp = this.input;
    p.latching = false;
    if (p.state !== 'normal' || p.lock > 0) return;
    const e = w.nearestInteract(p);
    if (e && e.isHold) {
      if (inp.held('act')) { e.active = true; p.latching = true; const done = e.progress(dt); if (done) p.latching = false; }
      return;
    }
    if (inp.pressed('act')) {
      if (e) { const r = e.interact(p); if (r && r.anim) p.startLock(r.anim, r.time); }
      else if (p.carrying && !(this.level.onDrop && this.level.onDrop(this))) p.carrying.drop(p);
    }
  }
  render(dt) {
    if (!this.scene) return;
    const pp = this.post.params; pp.time = this.time;
    pp.focus = this.camera.position.distanceTo(this.player.pos) * .98;
    // projection de la lumière principale pour les rayons
    if (this.lightDir) { const v = this.lightDir.clone().multiplyScalar(200).add(this.camera.position).project(this.camera); pp.light.set(v.x * .5 + .5, v.y * .5 + .5); }
    // ondes de choc en espace écran
    pp.shocks = (pp.shocks || []).filter(s => (s.t += dt) < s.dur);
    const shocks = pp.shocks.map(s => { const v = new THREE.Vector3(s.wx, s.wy, s.wz).project(this.camera); return { x: v.x * .5 + .5, y: v.y * .5 + .5, r: s.t / s.dur * .45, s: (1 - s.t / s.dur) * s.s }; });
    const keep = pp.shocks; pp.shocks = shocks;
    if (pp.windFx) { pp.windFx.t += dt; const v = new THREE.Vector3(pp.windFx.wx, pp.windFx.wy, pp.windFx.wz).project(this.camera); pp.wind.set(v.x * .5 + .5, v.y * .5 + .5, pp.windFx.dir, Math.max(0, 1 - pp.windFx.t / .7)); if (pp.windFx.t > .7) pp.windFx = null; } else pp.wind.w = 0;
    this.post.render(this.scene, this.camera);
    pp.shocks = keep;
  }
  // ------------------------------------------------------------ outils de test
  simulate(seconds, inputFn) {
    const n = Math.round(seconds / STEP);
    for (let i = 0; i < n; i++) { if (inputFn) inputFn(this.input, i * STEP); this.stepNoInput(STEP); }
  }
  stepNoInput(dt) { const u = this.input.update; this.input.update = () => { this.input.prev = this.input.btn; this.input.btn = { ...this.input.botBtn }; }; this.step(dt); this.input.update = u; }
}
const NO_INPUT = { mx: 0, mz: 0, run: false, pressed: () => false, held: () => false, released: () => false, consumeSelect: () => -1 };
