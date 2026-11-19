// CHAPITRE IV — LE MARAIS (la tristesse)
// Pluie, eau noire, pontons brisés. Le PAS D'OMBRE permet de franchir le vide et les grillages.
// Les Ombres — souvenirs déformés — rôdent. Au bout du pont, une petite silhouette en manteau rouge.
import * as THREE from 'three';
import { Wolf, Shade } from '../game/enemies.js';
import { rr } from '../core/util.js';
import { coatBearer } from './common.js';

export default {
  title: 'Le Marais', sub: 'la tristesse',
  start: { x: 2, y: 0, z: 0 },
  grade: { sat: .4, tint: [.9, .98, 1.08], shadow: [.025, .03, .038], contrast: 1.15, exposure: .95 },
  rays: .35, bloom: .45, aperture: 14, wind: .7,
  camera: { dist: 11.5, height: 2.0, look: 1.3, fov: 36, ahead: 1.8 },
  powers: [true, true, true, false],
  build(g) {
    const w = g.world, P = g.props, M = w.M;
    g.setupLights({ fog: 0x3a444c, fogDensity: .019, hemiSky: 0x7a8894, hemiGround: 0x20242a, hemi: 1.1, sun: 0xb0c0d0, sunI: 2.0, sunDir: [-10, 25, -30], lightDir: [-.3, .5, -1], fill: 0x7a8a9a, fillI: .8, keyI: 20, rimI: 26 });
    P.sky(0x1c2128, 0x46505a, new THREE.Vector3(-.4, .5, -1), 0x9aa8b6, 1.2);
    w.length = 170;
    // ---- sols et eau
    w.ground(-10, 14, { surface: 'dirt' });
    w.ground(14, 131, { y: -1.6, surface: 'water' });
    w.ground(131, 185, { surface: 'dirt' });
    w.block(-1.5, 0, -4, -1, 8, 4, { mat: null, visible: false, climbable: false });
    w.block(172, 0, -4, 173, 8, 4, { mat: null, visible: false, climbable: false });
    w.water(14, 131, -40, 8, -.05, { rain: true, sky: 0x7a8894, deep: 0x06090c });
    P.terrain(-20, 14, { color: 0x6a665e, path: false });
    const far = P.terrain(131, 200, { color: 0x6a665e, path: false });
    // arbres morts noyés au loin
    for (let i = 0; i < 70 * P.density; i++) { const z = rr(-60, -8); P.tree(rr(-10, 180), z, rr(8, 22), rr(.2, .45), Math.random() < .5 ? 'pine' : 'oak', z < -30 ? M.barkFar : M.barkDark, -1); }
    P.reeds(-5, 14, -6, -2.8, 500); P.reeds(14, 131, -12, -3.4, 1200); P.reeds(131, 175, -6, -2.8, 400);
    for (let x = 0; x < 175; x += 30) { P.fogLayer(x + 15, 1, -5, 40, 3, 0x6a747e, .35, .2); P.fogLayer(x + 15, 4, -14, 60, 10, 0x6a747e, .45, .15); }
    P.rain(0, 175, 3500);
    P.dust(0, 175, 0, 4, -4, 3, 1200, 0xb8c4d0, .12);
    // ---- rive : autel du PAS D'OMBRE (arrêt de bus englouti)
    w.shrine(3, 8, 0, -1, { kind: 'box' });
    P.mesh(new THREE.BoxGeometry(.12, 3.2, .12), M.rust, 6.6, 1.6, -1.6); P.mesh(new THREE.BoxGeometry(2.4, .1, 1.4), M.rust, 7.6, 3.2, -1.4);
    w.checkpoint(11, 0, 0);
    // ---- pontons
    const pier = (x0, x1, z0, z1, y = .3) => { w.block(x0, -1.6, z0, x1, y, z1, { mat: null, visible: false, surface: 'wood' }); P.pier(x0, x1, z0, z1, y); };
    pier(14, 22, -.6, .8);
    pier(24.2, 31, 1.3, 2.4);
    pier(32.6, 42, -2.4, -.4);
    pier(44, 60, -.8, 1);
    w.fence(51, -3.4, 3.4, 2.8, { y: .3 });
    w.checkpoint(45, .3, 0);
    pier(62, 84, -2.6, 2.4);
    // ---- grand ponton : loups et Ombres
    w.checkpoint(62.5, .3, 0);
    const wolves = this.wolves = [g.addEnemy(new Wolf(g, { x: 80, z: -2.2, y: .3 })), g.addEnemy(new Wolf(g, { x: 81, z: -1.0, y: .3 }))];
    w.trigger(64, () => { g.audio.play('howl'); wolves.forEach((wf, i) => { wf.wake(.8 + i * .25); wf.leaveOnScare = true; }); });
    this.shades = [g.addEnemy(new Shade(g, { x: 72, z: 1.6, y: .3, range: 5 })), g.addEnemy(new Shade(g, { x: 77, z: -1.5, y: .3, range: 5 })), g.addEnemy(new Shade(g, { x: 81.5, z: .6, y: .3, range: 5 }))];
    w.memory('moufle', 82.6, .3, -2.1);
    // ---- le pont, brisé au milieu
    w.checkpoint(86.5, .5, 0);
    const bridge = (x0, x1) => { w.block(x0, -1.6, -1, x1, .5, 1, { mat: null, visible: false, surface: 'wood' }); P.pier(x0, x1, -1, 1, .5); for (let x = x0; x < x1; x += 1.6) for (const z of [-1, 1]) P.mesh(new THREE.BoxGeometry(.06, 1, .06), M.woodDark, x, 1, z); P.mesh(new THREE.BoxGeometry(x1 - x0, .06, .06), M.woodDark, (x0 + x1) / 2, 1.45, -1); P.mesh(new THREE.BoxGeometry(x1 - x0, .06, .06), M.woodDark, (x0 + x1) / 2, 1.45, 1); };
    bridge(85.5, 108); bridge(110.6, 131.5);
    w.block(107.9, -1.6, -1.2, 108, 3, 1.2, { mat: null, visible: false, blocksPlayer: false });
    const bw = this.bridgeWolves = [g.addEnemy(new Wolf(g, { x: 87, z: 0, y: .5 })), g.addEnemy(new Wolf(g, { x: 86, z: -.5, y: .5, delay: .8 }))];
    w.trigger(94, () => { g.audio.play('howl'); g.shake(.3); bw.forEach((wf, i) => wf.wake(i * .7)); });
    w.trigger(111, () => { setTimeout(() => bw.forEach(wf => { wf.leaveOnScare = true; wf.scare(new THREE.Vector3(112, 0, 0), 10); }), 1500); });
    w.checkpoint(112, .5, 0);
    // la sœur au bout du pont
    this.sister = coatBearer(g, 129, -.2); this.sister.scale.setScalar(.38); this.sister.children[0].visible = true; this.sister.visible = false;
    w.trigger(113, () => { this.sister.visible = true; this.sisterA = 1; g.audio.playLullaby(.7, 1); g.audio.setMood('silence'); });
    w.trigger(165, () => g.endChapter());
    // ---- cadrages
    w.camZone(12, 44, { dist: 12.5, height: 3, look: .8, fov: 40, ahead: 2.2 });
    w.camZone(62, 85, { dist: 13, height: 3, look: 1, fov: 42 });
    w.camZone(112, 132, { dist: 9, height: 1.3, look: 1.2, fov: 32, ahead: 3 });
    w.camZone(140, 172, { dist: 16, height: 3.5, look: 2.5, fov: 42 });
    g.snapshotEnemies();
    this.thunderT = 6;
  },
  update(g, dt) {
    this.thunderT -= dt;
    if (this.thunderT < 0) { this.thunderT = 9 + Math.random() * 12; g.fx.flash(g.player.pos.x + 10, 30, -30, 0xc8d8ff, 400, 200, 7); setTimeout(() => g.audio.play('thunder'), 600 + Math.random() * 800); }
    if (this.sister && this.sister.visible) {
      // elle s'efface quand Mio approche
      const d = this.sister.position.x - g.player.pos.x;
      if (d < 7) {
        if (!this.sisterCloned) { this.sisterCloned = true; this.sister.traverse(o => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; } }); }
        this.sister.traverse(o => { if (o.material) o.material.opacity = Math.max(0, (d - 2) / 5); }); if (d < 2.2) { this.sister.visible = false; for (let i = 0; i < 40; i++) g.fx.mote(129 + Math.random() - .5, .5 + Math.random() * 1.2, -.2, [1, .5, .4]); g.audio.setMood('calm'); } }
    }
  },
  onRespawn(g, cp) {
    const reset = (wf, st) => { wf.state = st; wf.pos.copy(wf.spawn); wf.vel.set(0, 0, 0); wf.scared = 0; wf.delay = 0; wf.mesh.visible = st !== 'dormant' && st !== 'gone'; wf.sync(); };
    this.wolves.forEach(wf => reset(wf, cp >= 4 ? 'gone' : 'dormant'));
    this.bridgeWolves.forEach(wf => reset(wf, cp >= 5 ? 'gone' : 'dormant'));
    this.shades.forEach(s => s.load([s.home.x, s.home.y, s.home.z]));
    g.audio.setMood('calm');
  },
};
