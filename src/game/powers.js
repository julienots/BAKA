// Pouvoirs de Mio, nés des souvenirs de sa sœur (l'écharpe rouge) :
//  0 LUEUR  — maintenir pour charger, relâcher : onde de chaleur qui repousse les loups et brûle les ronces d'ombre
//  1 SOUFFLE — rafale qui projette caisses (même lourdes) et ennemis dans la direction du regard
//  2 ÉCHO   — maintenir : vision du passé, le temps ralentit, les meubles-souvenirs deviennent solides
//  3 PAS D'OMBRE — glissement instantané dans n'importe quelle direction (profondeur incluse), traverse les grillages
import * as THREE from 'three';
import { clamp, damp, rr } from '../core/util.js';
import { Crate } from './world.js';
import { getMaterials } from '../core/materials.js';

export const POWERS = [
  { id: 'lueur', name: 'Lueur', color: '#ff6a3a' },
  { id: 'souffle', name: 'Souffle', color: '#c9d6e0' },
  { id: 'echo', name: 'Écho', color: '#8fd0ff' },
  { id: 'ombre', name: "Pas d'ombre", color: '#9a8cff' },
];

export class Powers {
  constructor(game) {
    this.game = game; this.unlocked = [false, false, false, false]; this.cur = 0;
    this.casting = false; this.castK = 0; this.cool = [0, 0, 0, 0]; this.echoEnergy = 1; this.echoOn = false;
    this.light = new THREE.PointLight(0xff5a28, 0, 7, 1.6); this.light.castShadow = false;
    this.trail = []; this.afterimages = [];
  }
  attach(scene) { scene.add(this.light); this.buildAfterimages(scene); }
  buildAfterimages(scene) {
    // silhouettes fantômes pour la traînée du Pas d'ombre
    const mat = new THREE.MeshBasicMaterial({ color: 0x2a1f5a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    this.afterimages = [];
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.ConeGeometry(.24, .65, 12), mat.clone()); body.position.y = .5; g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(.23, 14, 10), body.material); head.position.y = 1.12; g.add(head);
      g.visible = false; scene.add(g); this.afterimages.push({ g, mat: body.material, t: 0 });
    }
  }
  any() { return this.unlocked.some(Boolean); }
  unlock(i) { this.unlocked[i] = true; this.cur = i; this.game.ui.setPower(this); }
  swap() {
    if (!this.any()) return;
    for (let k = 1; k <= 4; k++) { const n = (this.cur + k) % 4; if (this.unlocked[n]) { this.cur = n; break; } }
    this.game.ui.setPower(this); this.game.audio.play('chime');
  }
  reset() { this.casting = false; this.castK = 0; this.echoOn = false; this.game.world && (this.game.world.echoT = 0); this.echoEnergy = 1; this.light.intensity = 0; this.game.player.model.glow = 0; this.game.player.ghost = false; }
  update(dt, input) {
    const g = this.game, p = g.player, w = g.world, fx = g.fx;
    for (let i = 0; i < 4; i++) this.cool[i] = Math.max(0, this.cool[i] - dt);
    const sel = input.consumeSelect(); if (sel >= 0 && this.unlocked[sel]) { this.cur = sel; g.ui.setPower(this); }
    if (input.pressed('swap')) this.swap();
    const ok = p.state === 'normal' && p.lock <= 0 && p.control && !p.cine;
    const id = POWERS[this.cur].id;
    const can = this.unlocked[this.cur] && ok;

    // ---------- LUEUR
    if (id === 'lueur' && can) {
      if (input.held('power') && this.cool[0] <= 0) {
        if (!this.casting) { this.casting = true; this.castK = 0; g.audio.play('lueurCharge'); }
        this.castK = Math.min(1, this.castK + dt / .8);
        // braises aspirées vers l'écharpe
        if (Math.random() < .8) { const a = Math.random() * 6.28, r = 1.2 * (1.2 - this.castK); fx.add.emit({ x: p.pos.x + Math.cos(a) * r, y: p.pos.y + .9 + rr(-.4, .4), z: p.pos.z + Math.sin(a) * r, vx: -Math.cos(a) * r * 1.4, vy: 0, vz: -Math.sin(a) * r * 1.4, life: .6, size: .05, size1: .01, color: [1.6, .5, .15] }); }
        g.shake(.01 * this.castK);
      } else if (this.casting) {
        if (this.castK > .3) this.lueurBurst(this.castK); else g.audio.play('chime');
        this.casting = false; this.castK = 0; this.cool[0] = 1.0;
      }
    } else if (this.casting && id === 'lueur') { this.casting = false; this.castK = 0; }
    const glowT = (id === 'lueur' && this.casting ? .4 + this.castK * 1.2 : 0) + (this.echoOn ? .25 : 0);
    p.model.glow = damp(p.model.glow, glowT, 8, dt);
    this.light.position.set(p.pos.x + .1, p.pos.y + .95, p.pos.z + .2);
    this.light.intensity = damp(this.light.intensity, id === 'lueur' && this.casting ? 6 + this.castK * 22 : 0, 10, dt);

    // ---------- SOUFFLE
    if (id === 'souffle' && can && input.pressed('power') && this.cool[1] <= 0) this.souffle();

    // ---------- ÉCHO
    if (id === 'echo' && this.unlocked[2] && p.state !== 'dead' && p.control && !p.cine && input.held('power') && this.echoEnergy > .05 && this.cool[2] <= 0) {
      if (!this.echoOn) { this.echoOn = true; g.audio.play('echoOn'); }
      this.echoEnergy = Math.max(0, this.echoEnergy - dt / 7);
      if (Math.random() < .5) fx.mote(p.pos.x + rr(-3, 3), p.pos.y + rr(0, 3), p.pos.z + rr(-2, 1), [.5, .8, 1.2]);
    } else if (this.echoOn) { this.echoOn = false; g.audio.play('echoOff'); if (this.echoEnergy <= .05) this.cool[2] = 2; }
    if (!this.echoOn) this.echoEnergy = Math.min(1, this.echoEnergy + dt / 5);
    // l'écho s'estompe lentement pour laisser le temps de descendre des souvenirs
    if (w) w.echoT = this.echoOn ? Math.min(1, w.echoT + dt * 2.5) : Math.max(0, w.echoT - dt * .55);

    // ---------- PAS D'OMBRE
    if (id === 'ombre' && can && input.pressed('power') && this.cool[3] <= 0) this.dash(input);
    if (p.dashing > 0) {
      p.ghost = true;
      this.trailT = (this.trailT || 0) - dt;
      if (this.trailT <= 0) { this.trailT = .035; this.spawnAfterimage(p); }
      fx.smoke(p.pos.x, p.pos.y + .2, p.pos.z, [.04, .03, .07], 2, .35);
    } else if (p.ghost) {
      // ne pas rester coincé dans un grillage
      if (!w.overlapAny(p.pos.x - p.hw, p.pos.y, p.pos.z - p.hd, p.pos.x + p.hw, p.pos.y + p.h, p.pos.z + p.hd, 'player')) p.ghost = false;
      else { p.ghost = true; p.pos.x += p.dashV.x * dt * .5; p.pos.z += p.dashV.z * dt * .5; }
    }
    for (const a of this.afterimages) if (a.g.visible) { a.t -= dt; a.mat.opacity = Math.max(0, a.t / .45) * .55; if (a.t <= 0) a.g.visible = false; }
    g.ui.setPowerState(this);
  }
  lueurBurst(k) {
    const g = this.game, p = g.player, fx = g.fx, R = 3.5 + k * 5;
    const o = new THREE.Vector3(p.pos.x, p.pos.y + .9, p.pos.z);
    fx.shockwave(o.x, o.y, o.z, R, new THREE.Color(1.2, .45, .15), 1.0);
    fx.flash(o.x, o.y + .3, o.z, 0xff6a30, 60 * k, R * 2.2, 2.2);
    for (let i = 0; i < 120 * fx.mul; i++) { const a = Math.random() * 6.28, b = rr(-.6, .9), s = rr(2, 7) * k; fx.add.emit({ x: o.x, y: o.y, z: o.z, vx: Math.cos(a) * s, vy: b * s * .6, vz: Math.sin(a) * s * .7, life: rr(.5, 1.3), size: rr(.04, .09), size1: .01, color: [1.7, rr(.4, .8), .15], drag: 2.2, grav: -.4 }); }
    g.audio.play('lueur'); g.shake(.35 * k); g.input.vibrate(80);
    g.post.params.shocks.push({ wx: o.x, wy: o.y, wz: o.z, t: 0, dur: .8, s: 1 });
    for (const e of g.enemies) if (e.scare && e.pos.distanceTo(o) < R + .5) e.scare(o, 5 + k * 3);
    for (const e of g.world.entities) if (e.burn && Math.abs(e.pos.x - o.x) < R) e.burn();
    if (g.physics) g.physics.blast(o, R, 3 + k * 4);
    if (g.details) g.details.scare(o, R * 2);
    if (g.level.onLueur) g.level.onLueur(g, o, R);
  }
  souffle() {
    const g = this.game, p = g.player, fx = g.fx;
    const dir = new THREE.Vector3(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
    const o = new THREE.Vector3(p.pos.x, p.pos.y + .6, p.pos.z);
    this.cool[1] = 1.1; p.startLock('cast', .35);
    g.audio.play('souffle'); g.shake(.2); g.input.vibrate(50);
    // particules emportées par la rafale
    for (let i = 0; i < 90 * fx.mul; i++) {
      const s = rr(5, 11), sp = rr(-.25, .25);
      fx.add.emit({ x: o.x + dir.x * .3, y: o.y + rr(-.3, .5), z: o.z + dir.z * .3, vx: (dir.x + -dir.z * sp) * s, vy: rr(-.3, .8), vz: (dir.z + dir.x * sp) * s, life: rr(.4, .8), size: rr(.02, .05), size1: .01, color: [.75, .8, .85], drag: 2 });
    }
    for (let i = 0; i < 14 * fx.mul; i++) fx.smokeP.emit({ x: o.x + dir.x * rr(.3, 1.5), y: o.y + rr(-.4, .3), z: o.z + dir.z * rr(.3, 1.5), vx: dir.x * rr(3, 6), vy: rr(0, .4), vz: dir.z * rr(3, 6), life: rr(.5, .9), size: .3, size1: 1.2, color: [.6, .62, .65], alpha: .25, drag: 2.5 });
    g.post.params.windFx = { t: 0, dir: Math.sign(dir.x) || 1, wx: o.x, wy: o.y, wz: o.z };
    const hits = (pos, maxD) => { const d = pos.clone().sub(o); d.y = 0; const along = d.dot(dir); if (along < -.2 || along > maxD) return 0; const lat = d.clone().addScaledVector(dir, -along).length(); return lat < .6 + along * .45 ? (1 - along / maxD) : 0; };
    for (const e of g.world.entities) if (e instanceof Crate) { const k = hits(e.pos.clone().setY(o.y), 5.5); if (k > 0) e.impulse(dir.x * (2.4 + k * 3) * (e.heavy ? 1.15 : 1.4), dir.z * (2.4 + k * 3) * (e.heavy ? 1.15 : 1.4)); }
    for (const e of g.enemies) if (e.knock) { const k = hits(e.pos, 7); if (k > 0) e.knock(dir, 4 + k * 6); }
    if (g.physics) g.physics.gust(o, dir, 6.5, 4.5);
    if (g.level.onSouffle) g.level.onSouffle(g, o, dir);
  }
  dash(input) {
    const g = this.game, p = g.player;
    let dx = input.mx, dz = input.mz; const l = Math.hypot(dx, dz);
    if (l < .2) { dx = Math.cos(p.yaw); dz = -Math.sin(p.yaw); } else { dx /= l; dz /= l; }
    const sp = 14; p.dashing = .22; p.dashV = new THREE.Vector3(dx * sp, 0, dz * sp * .8); p.invuln = .4; p.ghost = true;
    this.cool[3] = .85; g.audio.play('dash'); g.input.vibrate(30); g.shake(.08);
    g.fx.smoke(p.pos.x, p.pos.y + .2, p.pos.z, [.05, .03, .09], 10, .5);
    g.fx.flash(p.pos.x, p.pos.y + 1, p.pos.z, 0x6a50ff, 8, 4, 6);
  }
  spawnAfterimage(p) {
    const a = this.afterimages.find(x => !x.g.visible) || this.afterimages[0];
    a.g.visible = true; a.t = .45; a.g.position.copy(p.pos); a.g.rotation.y = p.yaw;
  }
}
