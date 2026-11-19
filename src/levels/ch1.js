// CHAPITRE I — LA FORÊT MORTE (le déni)
// Mio se réveille seul. Il apprend à marcher dans la profondeur, à grimper, à pousser.
// Les loups surgissent du fond de l'écran. Un vieux ruban rouge lui donne la LUEUR.
import * as THREE from 'three';
import { Wolf } from '../game/enemies.js';
import { forestDecor, coatBearer } from './common.js';
import { rr } from '../core/util.js';

export default {
  title: 'La Forêt morte', sub: 'le déni',
  start: { x: 2, y: 0, z: .3 },
  grade: { sat: .45, tint: [.92, 1, 1.08], shadow: [.025, .03, .04], contrast: 1.18, exposure: .92 },
  rays: .55, bloom: .45, aperture: 20, wind: .5,
  camera: { dist: 11.2, height: 1.6, look: 1.4, fov: 34, ahead: 1.6 },
  build(g) {
    const w = g.world, P = g.props, M = w.M;
    g.setupLights({ fog: 0x5c6670, fogDensity: .0125, hemiSky: 0x7a8490, hemiGround: 0x2a2622, hemi: 1.1, sun: 0xb8c6d6, sunI: 2.6, sunDir: [22, 30, -34], fill: 0x8090a0, fillI: 1, keyI: 20, rimI: 28 });
    P.sky(0x262b33, 0x5c6670, new THREE.Vector3(.55, .5, -1), 0xb8c4d0, 1);
    forestDecor(g, -10, 185, { clear: [[38, 50], [96, 116], [140, 168]] });
    w.length = 175;
    // ---- sol & limites
    w.ground(-10, 185, { surface: 'dirt' });
    w.block(-1.5, 0, -4, -1, 6, 4, { mat: null, visible: false, climbable: false });
    w.block(176, 0, -4, 177, 8, 4, { mat: null, visible: false, climbable: false });
    // ---- départ : pylône effondré au premier plan, rochers
    P.pylon(-3.5, -9, 34, [0, .05], false); P.pylon(4.8, -16, 40, [-.04, -.03], false); P.pylon(-16, -24, 38, [0, .02], false);
    P.bush(-2.4, .2, 6.4, .8, 380, 0x6a7a6c); P.bush(4.4, -.1, 7.2, .8, 300, 0x46524a);
    // ---- x14 : grand tronc couché qui barre l'avant → passer par le fond (apprentissage de la profondeur)
    P.log(15, 1.05, .9, 3.4, 1.05, 0, 0); P.log(15.3, .7, -3.6, 1.6, .5, .3, 0);
    w.block(13.9, 0, -.7, 16.1, 2.2, 3.3, { mat: null, visible: false, climbable: false });
    P.mesh(new THREE.DodecahedronGeometry(.9, 1), M.stone, 15, .4, -.9, { scale: [1, .5, .6] });
    // ---- x24 : petit rocher, x28 : rebord à escalader
    w.block(23.6, 0, -2.8, 24.6, .45, 2.6, { mat: M.stone, surface: 'stone', rock: true });
    w.block(28, 0, -3, 33.5, 1.25, 2.8, { mat: M.stone, surface: 'stone', uvScale: [2, 1], rock: true });
    w.block(28.5, 1.25, -3, 31, 1.5, -1.5, { mat: M.stone, surface: 'stone', rock: true });
    // ---- x41 : caisse à pousser contre la falaise (x46) pour l'escalader
    w.crate(40.5, .2, 1.1);
    w.block(46, 0, -3.2, 60, 2.45, 3, { mat: M.stone, surface: 'stone', uvScale: [4, 1], rock: true });
    P.tree(53, -2.8, 16, .4, 'oak', M.bark, 2.45);
    // ---- souvenir : le dessin, derrière un arbre au fond (secret)
    w.checkpoint(62, 0, 0);
    w.block(65.4, 0, -2.9, 66.6, .45, -1.9, { mat: M.bark, surface: 'wood' });
    w.memory('dessin', 66, .45, -2.35);
    P.tree(64.2, -1.2, 18, .45, 'pine', M.barkDark);
    // ---- hautes herbes (cachette symbolique)
    P.grass(68, 80, -2.6, 2.4, 900, 1.15, 0x7a7466);
    w.hide(68, -2.6, 80, 2.4, { y1: 1.2 });
    // ---- x84 : les loups surgissent du fond ; grille à loquet à x100
    const wolves = [];
    for (const [x, z, d] of [[80, -22, 0], [92, -26, .7], [70, -18, .3]]) wolves.push(g.addEnemy(new Wolf(g, { x, z, delay: d })));
    this.wolves1 = wolves;
    w.trigger(83, (W) => { g.audio.play('howl'); g.shake(.2); wolves.forEach((wf, i) => wf.wake(.6 + i * .5)); g.audio.setMood('silence'); });
    // la clôture et sa grille
    w.fence(100, -3.2, -1.1, 2.6, { climbable: false });
    w.fence(100, 1.1, 3.2, 2.6, { climbable: false });
    w.gate('gate1', 99.95, 0, -1.1, 100.05, 2.4, 1.1, { style: 'bars', offset: [0, 0, 2.15] });
    w.latch(99.6, .9, .7, { target: 'gate1', hold: 1.2 });
    w.trigger(101.6, () => { const gt = w.byId.gate1; gt.setOpen(false); g.audio.setMood('calm'); setTimeout(() => wolves.forEach(wf => { if (wf.state === 'chase') wf.scare(new THREE.Vector3(105, 0, 0), 8); wf.leaveOnScare = true; }), 2500); });
    w.checkpoint(102.5, 0, 0);
    // ---- x112 : le ruban rouge → LUEUR
    w.shrine(0, 112, 0, -.6, { kind: 'stump' });
    P.tree(110.5, -2.3, 20, .5, 'oak', M.bark);
    w.checkpoint(115, 0, 0);
    // ---- x120 : deux loups surgissent ; ronces d'ombre à x132 → utiliser la Lueur
    const w2 = [g.addEnemy(new Wolf(g, { x: 128, z: -16 })), g.addEnemy(new Wolf(g, { x: 136, z: -20, delay: .5 }))];
    this.wolves2 = w2;
    w.trigger(119, () => { g.audio.play('howl'); w2.forEach((wf, i) => { wf.wake(i * .6); wf.leaveOnScare = true; }); });
    w.bramble(132, -3.2, 3.2, { h: 2.6 });
    // ---- x140-160 : pylône effondré à gravir
    P.pylon(150, -6, 22, [.1, -.55], true);
    w.block(142, 0, -3, 145, .9, 1, { mat: M.rust, surface: 'metal' });
    w.block(145, 0, -3, 149, 1.9, 1, { mat: M.rust, surface: 'metal' });
    w.block(149, 0, -3, 157, 1.0, 3, { mat: M.rust, surface: 'metal' });
    w.checkpoint(146, .9, -1);
    // plate-forme de pylône : échelle rouillée, puis mur à escalader
    w.block(158, 0, -3, 164, 3, -.5, { mat: M.rust, surface: 'metal' });
    w.ladder(160.5, -.5, 0, 3);
    w.block(164, 0, -3.2, 165, 4, 3.2, { mat: M.rust, surface: 'metal' });
    // ---- fin : vue sur l'usine au loin
    P.pylon(18, -30, 42, [0, -.02], false); P.pylon(70, -28, 40, [0, .02], false); P.pylon(125, -32, 44, [0, 0], false); P.pylon(165, -26, 38, [.05, 0], false);
    const fac = new THREE.Group(); for (const [x, h] of [[0, 14], [4, 22], [9, 18], [14, 26]]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(.8, 1, h, 10), M.barkFar); c.position.set(x, h / 2, 0); fac.add(c); } const b = new THREE.Mesh(new THREE.BoxGeometry(24, 9, 6), M.barkFar); b.position.set(7, 4.5, 0); fac.add(b); fac.position.set(185, 0, -60); g.scene.add(fac);
    w.trigger(172, () => g.endChapter());
    // ---- cadrages
    w.camZone(-5, 10, { dist: 9.5, height: 1.4, look: 1.6, fov: 34 });
    w.camZone(12, 18, { dist: 12, height: 2.2, look: 1.4 });
    w.camZone(80, 101, { dist: 13.5, height: 2.4, look: 1.6, fov: 38, ahead: 2.6 });
    w.camZone(108, 116, { dist: 8.5, height: 1.4, look: 1.2, fov: 32 });
    w.camZone(118, 136, { dist: 13, height: 2.2, look: 1.5, fov: 38 });
    w.camZone(160, 180, { dist: 15, height: 3, look: 3, fov: 40, ahead: 3 });
    // ---- ambiance
    for (let x = 0; x < 180; x += 40) { P.shaft(x + 6, 14, -12, 5, 40, [0, 0, .5], 0xa8b8c8, .35); P.shaft(x + 18, 14, -20, 7, 40, [0, 0, .5], 0xa8b8c8, .25); }
    P.dust(-5, 180, 0, 6, -4, 3, 3000, 0xc8d0d8);
    this.bearer = coatBearer(g, 30, -22);
    g.snapshotEnemies();
  },
  intro(g) {
    const p = g.player;
    p.state = 'wake'; p.wakeT = 0; p.control = false;
    g.runCine(async c => {
      c.cam({ dist: 4.5, height: .6, look: .4, fov: 30, ahead: 0, ease: 4 });
      g.audio.setMood('silence');
      await c.wait(1.2);
      p.state = 'wake'; p.wakeT = 0;
      await c.until(() => p.state === 'normal');
      await c.wait(.4);
      // il regarde au loin : une silhouette emporte un petit manteau rouge
      c.cam({ dist: 13, height: 2.5, look: 3, fov: 40, ahead: 6, xOff: 8, ease: .8 });
      g.audio.playLullaby(.8, 1);
      await c.wait(4.5);
      c.cam(null);
      g.ui.titleCard('I', 'La Forêt morte', 'le déni');
      g.audio.setMood('calm');
    });
  },
  update(g, dt) {
    if (this.bearer && this.bearer.visible) {
      this.bearer.position.x += dt * 2.2; this.bearer.rotation.z = Math.sin(g.time * 3) * .04;
      if (this.bearer.position.x > 70) this.bearer.visible = false;
    }
  },
  onRespawn(g, cp) {
    // remet les loups dans l'état attendu selon le point de passage
    const W1 = this.wolves1, W2 = this.wolves2;
    const reset = (wf, state) => { wf.state = state; wf.pos.copy(wf.spawn); wf.vel.set(0, 0, 0); wf.scared = 0; wf.delay = 0; wf.mesh.visible = state !== 'dormant' && state !== 'gone'; wf.sync(); };
    W1.forEach(wf => reset(wf, cp >= 3 ? 'gone' : 'dormant'));
    W2.forEach(wf => reset(wf, 'dormant'));
    if (cp <= 2) { g.world.byId.gate1.open = false; g.world.byId.gate1.k = 0; g.world.byId.gate1.apply(); }
    g.audio.setMood('calm');
  },
};
