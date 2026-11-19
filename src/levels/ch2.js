// CHAPITRE II — L'USINE (la colère)
// Des halls immenses. La Présence fouille au projecteur derrière la grande verrière.
// Mio trouve le SOUFFLE, déplace une caisse de fonte, puis fuit sur une passerelle qui s'effondre.
import * as THREE from 'three';
import { Presence } from '../game/enemies.js';
import { rr } from '../core/util.js';

export default {
  title: "L'Usine", sub: 'la colère',
  start: { x: 2, y: 0, z: .5 },
  grade: { sat: .32, tint: [.95, 1, 1.06], shadow: [.03, .034, .04], contrast: 1.16, exposure: 1.0 },
  rays: .55, bloom: .5, aperture: 9, wind: .1,
  camera: { dist: 11, height: 1.9, look: 1.8, fov: 40, ahead: 1.4 },
  powers: [true, false, false, false],
  build(g) {
    const w = g.world, P = g.props, M = w.M, RY = 15;
    g.setupLights({ fog: 0x46505a, fogDensity: .016, hemiSky: 0x8a949e, hemiGround: 0x2a2826, hemi: 1.15, sun: 0xdce4ec, sunI: 2.2, sunDir: [6, 30, -10], lightDir: [.1, .4, -1], fill: 0x708090, fillI: .7, keyI: 22, rimI: 26 });
    P.sky(0x1a1d20, 0x46505a, new THREE.Vector3(.2, .4, -1), 0xd0d8e0, .8);
    w.length = 170;
    // ---- sol béton + murs
    w.ground(-10, 125, { surface: 'concrete' });
    P.mesh(new THREE.PlaneGeometry(140, 30), M.concrete, 55, 0, -2, { rot: [-Math.PI / 2, 0, 0], cast: false });
    M.concrete.map.repeat.set(30, 7);
    w.block(-1.5, 0, -4, -1, 8, 4, { mat: null, visible: false, climbable: false });
    P.mesh(new THREE.PlaneGeometry(200, 32), M.concreteWall, 70, 16, -14, { cast: false });
    M.concreteWall.map && M.concreteWall.map.repeat.set(30, 5);
    // poutres de toit, verrières cassées
    for (let x = -5; x < 175; x += 6) {
      P.mesh(new THREE.BoxGeometry(.3, .5, 22), M.darkIron, x, RY, -4);
      P.mesh(new THREE.BoxGeometry(.5, RY, .5), M.darkIron, x, RY / 2, -13.5);
      if (x % 12 === 1) P.chain(x + rr(1, 3), rr(-6, -1), RY, rr(6, 11), Math.random() < .5);
    }
    for (let x = 0; x < 170; x += 24) { P.shaft(x + 6, 7.5, -4, 5, 20, [0, -.4, -.18], 0xd0d8e0, .14); P.shaft(x + 8, 7.5, -2.5, 6, 20, [0, .2, -.18], 0xd0d8e0, .1); }
    // ---- HALL A (x 0-50) : caisse → plateforme → levier → rideau métallique
    P.machine(8, -6, 4, 2.4, 2.5); P.gear(5, 2.4, -4.6, 1.6, 22); P.gear(10, 3.4, -7, 2.2, 28);
    P.pipe([[-2, 7, -6], [6, 7.4, -6], [12, 6.6, -6], [14, 4, -5.5], [14, 2.5, -4.6]], .28);
    w.crate(29, -1.5, 1.15);
    w.block(34, 0, -3.2, 46, 2.6, -.4, { mat: M.iron, surface: 'metal', uvScale: [3, 1] });
    w.block(34, 2.6, -3.2, 46, 3.6, -3.0, { mat: M.darkIron });
    w.lever(43, 2.6, -1.6, { target: 'shutterA' });
    P.chain(36, -1, RY, 9, true); P.chain(40, -2, RY, 8, false);
    w.gate('shutterA', 47.6, 0, -3.2, 48.2, 4, 3.2, { style: 'shutter' });
    w.block(47.6, 4, -3.2, 48.4, RY, 3.2, { mat: M.concreteWall, climbable: false });
    P.machine(24, -8, 5, 3, 3); P.gear(22, 3, -6.2, 1.4, 18);
    w.camZone(28, 47, { dist: 12.5, height: 2.8, look: 2.2, fov: 42 });
    // ---- HALL B (x 50-95) : la Présence derrière la verrière, se cacher derrière les machines
    w.checkpoint(51, 0, .5);
    P.windowWall(70, 9, -13.9, 16, 9, false);
    for (const [x, z, wd, h] of [[57.5, -.3, 1.8, 1.7], [63.5, -.6, 2.2, 1.9], [69.5, 0, 1.6, 1.6], [75.5, -.5, 2.4, 2], [81.5, -.2, 1.8, 1.7], [87, -.4, 2, 1.8]]) {
      w.block(x - wd / 2, 0, z - .8, x + wd / 2, h, z + .8, { mat: M.iron, surface: 'metal' });
      P.mesh(new THREE.CylinderGeometry(.35, .35, .9, 14), M.darkIron, x, h + .45, z, { rot: [Math.PI / 2, 0, 0] });
      w.hide(x - wd / 2 + .1, z + .8, x + wd / 2 - .1, 2.6, { full: true });
    }
    // coins sombres (ombre) sous des établis
    w.block(60, .9, 1.2, 62, 1.05, 2.6, { mat: M.woodDark }); w.hide(60.1, 1.2, 61.9, 2.6);
    w.block(72, .9, 1.2, 74, 1.05, 2.6, { mat: M.woodDark }); w.hide(72.1, 1.2, 73.9, 2.6);
    const pres = this.presence = g.addEnemy(new Presence(g, { x0: 56, x1: 88, z: -12.6, y: 0, height: 7.5, speed: .8, targets: [[56, 0, 0], [60, 0, 2], [64, 0, -1.5], [58, 0, 1.2], [66, 0, 1.8], [62, 0, -2]] }));
    w.trigger(54, () => { pres.activate(true); g.audio.setMood('silence'); g.shake(.2); g.audio.play('grab'); });
    w.trigger(92, () => { pres.activate(false); g.audio.setMood('calm'); });
    w.camZone(52, 92, { dist: 13.5, height: 3.2, look: 2.8, fov: 44, ahead: 1 });
    // ---- SOUFFLE (x 92)
    w.checkpoint(92.5, 0, 0);
    w.shrine(1, 95, 0, -1.2, { kind: 'box' });
    P.gear(97, 2.4, -3.6, 1.2, 16);
    // ---- HALL C (x 98-124) : caisse de fonte dans un rail → plaque de pression → porte
    w.block(99, 0, -2.75, 116, .3, -2.6, { mat: M.darkIron, surface: 'metal' });
    w.block(99, 0, -1.05, 116, .3, -.9, { mat: M.darkIron, surface: 'metal' });
    w.crate(103, -1.83, 1.1, { heavy: true, id: 'heavy' });
    w.plate(113.5, -1.83, { target: 'gateC', size: 1.2 });
    w.gate('gateC', 119.6, 0, -3.2, 120.4, 4.5, 3.2, { style: 'shutter' });
    w.block(119.6, 4.5, -3.2, 120.4, RY, 3.2, { mat: M.concreteWall, climbable: false });
    w.memory('boite', 108, 0, 2.1);
    w.block(106, 0, .9, 110, 1.8, 1.5, { mat: M.iron });
    w.camZone(98, 119, { dist: 12, height: 2.6, look: 1.6, fov: 42 });
    // ---- PASSERELLE QUI S'EFFONDRE (x 124-165)
    w.checkpoint(122, 0, 0);
    w.block(123, 0, -3, 125, 1.3, 3, { mat: M.iron, surface: 'metal' });
    w.block(125, 0, -3, 127, 2.6, 3, { mat: M.iron, surface: 'metal' });
    const col = w.collapse(127, 139, -1, 1, 2.6, { speed: 3.3, id: 'cat1' });
    w.collapse(140.4, 150, -1, 1, 2.6, { speed: 3.3, id: 'cat2' });
    w.block(150, 0, -1.6, 153, 3.5, 1.6, { mat: M.iron, surface: 'metal' });
    w.collapse(153, 160, -1, 1, 3.5, { speed: 3.3, id: 'cat3' });
    w.block(160, 0, -3, 172, 3.5, 3, { mat: M.iron, surface: 'metal' });
    w.block(172, 0, -4, 173, 9, 4, { mat: null, visible: false, climbable: false });
    // garde-corps visuels
    for (let x = 127; x < 160; x += 1.2) P.mesh(new THREE.BoxGeometry(.04, .9, .04), M.darkIron, x, 3.1, -1);
    w.trigger(128.5, () => { w.byId.cat1.start(); setTimeout(() => w.byId.cat2.start(), 2900); setTimeout(() => w.byId.cat3.start(), 6600); g.audio.play('crash'); g.shake(.6); g.audio.setMood('silence'); this.chase = true; });
    w.trigger(161, () => { this.chase = false; g.audio.setMood('calm'); });
    w.camZone(124, 162, { dist: 14, height: 1.2, look: 1.2, fov: 44, ahead: 3.2 });
    w.trigger(168, () => g.endChapter());
    // fosse sous la passerelle (visuel)
    P.mesh(new THREE.PlaneGeometry(40, 30), new THREE.MeshBasicMaterial({ color: 0x050506 }), 145, -6, -2, { rot: [-Math.PI / 2, 0, 0], cast: false });
    P.dust(-5, 175, 0, 12, -10, 3, 3500, 0xd8dee4, .2);
    g.snapshotEnemies();
  },
  update(g, dt) {
    if (this.chase) {
      // la main de la Présence frappe derrière Mio
      this.smashT = (this.smashT || 0) - dt;
      if (this.smashT < 0) { this.smashT = 1.2; g.shake(.25); g.fx.sparks(g.player.pos.x - 4, 2.6, 0, 25); g.audio.play('crash'); }
    }
  },
  onRespawn(g, cp) {
    const pres = this.presence; pres.activate(false); pres.alert = 0; this.chase = false;
    g.audio.setMood('calm');
  },
};
