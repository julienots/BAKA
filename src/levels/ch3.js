// CHAPITRE III — LA MAISON (le marchandage)
// La maison d'enfance, déformée et immense. Une main interminable fouille la chambre.
// Dans la chambre de sa sœur, Mio reçoit l'ÉCHO : il voit les meubles du passé et peut s'y appuyer.
import * as THREE from 'three';
import { Hand } from '../game/enemies.js';
import { rr } from '../core/util.js';

export default {
  title: 'La Maison', sub: 'le marchandage',
  start: { x: 2, y: 0, z: .4 },
  grade: { sat: .62, tint: [.98, 1, 1.03], shadow: [.035, .035, .042], contrast: 1.12, exposure: 1.35 },
  rays: .45, bloom: .55, aperture: 12, wind: 0,
  camera: { dist: 10.5, height: 1.7, look: 1.6, fov: 38, ahead: 1.3 },
  powers: [true, true, false, false],
  build(g) {
    const w = g.world, P = g.props, M = w.M;
    g.setupLights({ fog: 0x22262a, fogDensity: .01, hemiSky: 0x9aa6b4, hemiGround: 0x3a3430, hemi: 2.0, sun: 0xc8d4e4, sunI: 1.6, sunDir: [6, 20, 10], lightDir: [.3, .3, -1], fill: 0x8090a0, fillI: 1.0, keyI: 26, rimI: 28 });
    // clair de lune entrant par les fenêtres
    for (const [x, i] of [[12, 120], [50, 260], [80, 140], [125, 160]]) { const sp = new THREE.SpotLight(0xd0dcec, i, 22, .55, .6, 1.2); sp.position.set(x + 2, 6, -3.2); sp.target.position.set(x - 1, 0, 1.5); sp.castShadow = x === 50; if (sp.castShadow) sp.shadow.mapSize.set(1024, 1024); g.scene.add(sp, sp.target); }
    P.sky(0x1a1e24, 0x30363c, new THREE.Vector3(.3, .4, -1), 0xc0ccd8, .5);
    w.length = 150;
    w.ground(-10, 160, { surface: 'wood' });
    w.block(-1.5, 0, -4, -1, 8, 4, { mat: null, visible: false, climbable: false });
    w.block(148, 0, -4, 149, 8, 4, { mat: null, visible: false, climbable: false });
    w.zBounds(-2.9, 2.4);
    // ---- COULOIR (x 0-30) : chaise → table → levier → porte
    P.roomShell(-3, 30, { h: 6.5, zBack: -3.6 });
    for (let x = 3; x < 28; x += 5) { const fr = P.mesh(new THREE.BoxGeometry(.9, 1.2, .05), M.woodDark, x, 3.4 + rr(-.3, .4), -3.55, { rot: [0, 0, rr(-.15, .15)] }); }
    P.mesh(new THREE.BoxGeometry(.25, 4, .15), M.woodDark, 10, 2, -3.5); // cadre de porte du fond
    w.block(19.85, 0, -1.4, 20.85, .9, -.2, { mat: M.woodDark, surface: 'wood' });
    P.mesh(new THREE.BoxGeometry(.12, 1.3, 1.2), M.woodDark, 19.91, 1.55, -.8);
    w.block(21, 1.5, -2.2, 26, 1.7, .4, { mat: M.woodDark, surface: 'wood' });
    for (const [x, z] of [[21.15, -2.05], [25.85, -2.05], [21.15, .25], [25.85, .25]]) w.block(x - .12, 0, z - .12, x + .12, 1.5, z + .12, { mat: M.woodDark });
    w.lever(25.2, 1.7, -1.2, { target: 'doorA' });
    w.gate('doorA', 29.6, 0, -3.2, 30.2, 4.2, 3.2, { style: 'plank', offset: [0, 0, -6.6] });
    w.block(29.6, 4.2, -3.6, 30.4, 6.5, 3.2, { mat: M.woodDark, climbable: false });
    w.camZone(14, 29, { dist: 11.5, height: 2.6, look: 2.2, fov: 40 });
    // ---- CHAMBRE DES ENFANTS (x 30-66) : la Main
    w.checkpoint(32, 0, .5);
    P.roomShell(30, 66, { h: 6.5, zBack: -3.6 });
    // fenêtre lumineuse d'où vient la main
    this.window(g, 50, 4.4, 3, 3.6); this.window(g, 12, 3.6, 1.6, 2.4); this.window(g, 80, 4, 2.2, 3); this.window(g, 125, 3.8, 2, 2.6);
    // lit (on peut se glisser dessous)
    P.bed(39.8, -.1, { len: 3.6, w: 1.9, h: 1.0 });
    w.block(38, 1.0, -1.05, 41.6, 1.48, .85, { mat: null, visible: false, surface: 'wood' });
    w.hide(38.1, -1.05, 41.5, .85, { full: true });
    // coffre à jouets
    w.block(49.3, 0, -1.4, 50.7, .9, -.2, { mat: M.woodDark, surface: 'wood' });
    w.hide(49.2, -.25, 50.8, 1, {});
    // petite table
    w.block(56, 1.0, -1, 58.4, 1.12, 1, { mat: M.woodDark, surface: 'wood' });
    for (const [x, z] of [[56.1, -.9], [58.3, -.9], [56.1, .9], [58.3, .9]]) P.mesh(new THREE.BoxGeometry(.08, 1, .08), M.woodDark, x, .5, z);
    w.hide(56.1, -1, 58.3, 1, { full: true });
    P.wardrobe(62, -2.8); P.shelf(34, -3.1); P.toys(31, 64, -2.6, 2.4, 40);
    P.mesh(new THREE.BoxGeometry(.9, .7, .6), M.woodDark, 45, .35, -2.9);
    const hand = this.hand = g.addEnemy(new Hand(g, { shoulder: [50, 6.6, -3.4], L1: 4.9, L2: 4.9, speed: 1.0, points: [[44, .3, 0], [47, .3, 1.6], [53, .3, -1.6], [55, .3, .8], [46, .3, -2], [52, .3, 1.8], [49, .3, .2]] }));
    w.trigger(36, () => { hand.activate(true); g.shake(.3); g.audio.setMood('silence'); });
    w.trigger(64, () => { hand.activate(false); g.audio.setMood('calm'); });
    w.camZone(31, 64, { dist: 12.5, height: 2.6, look: 2.2, fov: 44, ahead: 1 });
    // ---- COULOIR → CHAMBRE DE LA SŒUR : l'ÉCHO
    w.checkpoint(66.5, 0, 0);
    P.roomShell(66, 106, { h: 7, zBack: -3.6 });
    w.shrine(2, 74, 0, -1.5, { kind: 'box' });
    const lamp = new THREE.PointLight(0xffc070, 6, 6, 1.6); lamp.position.set(74, 1.4, -1.2); g.scene.add(lamp);
    // meubles-souvenirs (n'existent que dans l'Écho)
    w.echoBox(82.4, 0, -1.6, 83.8, .9, .4, { shape: 'books' });
    w.echoBox(84.05, 0, -1.6, 85.4, 1.8, .4);
    w.echoBox(85.65, 0, -1.6, 87, 2.7, .4, { shape: 'books' });
    w.block(87.25, 0, -3.2, 106, 3.6, 2.6, { mat: M.woodDark, surface: 'wood', uvScale: [4, 1] });
    w.memory('lapin', 96, 3.6, -1.2);
    P.mesh(new THREE.BoxGeometry(2, 1.2, .1), M.wood, 80, 3, -3.5); // dessin d'enfant au mur (cadre)
    w.camZone(70, 104, { dist: 12, height: 2.4, look: 2.4, fov: 42 });
    // ---- CUISINE (x 106-148) : deuxième main, table sous laquelle se cacher
    w.checkpoint(107, 0, 0);
    P.roomShell(104, 150, { h: 6.5, zBack: -3.6 });
    w.block(119, 1.5, -1.4, 124, 1.66, 1.4, { mat: M.woodDark, surface: 'wood' });
    for (const [x, z] of [[119.1, -1.3], [123.9, -1.3], [119.1, 1.3], [123.9, 1.3]]) P.mesh(new THREE.BoxGeometry(.12, 1.5, .12), M.woodDark, x, .75, z);
    w.hide(119.1, -1.4, 123.9, 1.4, { full: true });
    w.block(110, 0, -3.3, 116, 2.2, -2.4, { mat: M.woodDark }); // buffet
    w.block(127, .9, -1, 129, 1.0, 1.2, { mat: M.woodDark }); w.hide(127.1, -1, 128.9, 1.2, { full: true });
    for (const [x, z] of [[127.1, -.9], [128.9, -.9], [127.1, 1.1], [128.9, 1.1]]) P.mesh(new THREE.BoxGeometry(.08, .9, .08), M.woodDark, x, .45, z);
    const hand2 = this.hand2 = g.addEnemy(new Hand(g, { shoulder: [125.5, 6.6, -3.4], L1: 5.6, L2: 5.6, speed: 1.1, points: [[131, .3, 1], [126, .3, -1.8], [118, .3, 0], [122, .3, 1.8], [133, .3, -1], [120, .3, -1], [125, .3, .5]] }));
    w.trigger(110, () => { hand2.activate(true); g.audio.setMood('silence'); });
    w.trigger(139, () => { hand2.activate(false); g.audio.setMood('calm'); });
    P.mesh(new THREE.PlaneGeometry(2.4, 4), new THREE.MeshBasicMaterial({ color: 0x9aa6b4, fog: false }), 144, 2.2, -3.55, { cast: false });
    w.camZone(108, 140, { dist: 12.5, height: 2.6, look: 2.2, fov: 44 });
    w.trigger(145, () => g.endChapter());
    P.dust(-3, 150, 0, 6, -3.5, 2.5, 2500, 0xd8dee4, .16);
    for (let x = 0; x < 150; x += 26) P.fogLayer(x + 13, 3, -3.2, 30, 6, 0x6a737c, .18, .05);
    g.snapshotEnemies();
  },
  // fenêtre lumineuse : vitre, croisillons, rideaux déchirés, faisceau de lune
  window(g, x, y, w, h) {
    const P = g.props, M = g.world.M;
    P.mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0xe4ecf4, fog: false }), x, y, -3.56, { cast: false });
    P.mesh(new THREE.BoxGeometry(w + .3, .16, .2), M.woodDark, x, y - h / 2, -3.5); P.mesh(new THREE.BoxGeometry(w + .3, .16, .2), M.woodDark, x, y + h / 2, -3.5);
    P.mesh(new THREE.BoxGeometry(.08, h, .1), M.woodDark, x, y, -3.5); P.mesh(new THREE.BoxGeometry(w, .08, .1), M.woodDark, x, y, -3.5);
    for (const s of [-1, 1]) P.mesh(new THREE.PlaneGeometry(.6, h + .6), new THREE.MeshStandardMaterial({ color: 0x6a6460, roughness: 1, side: THREE.DoubleSide, transparent: true, opacity: .92 }), x + s * (w / 2 + .1), y, -3.45, { rot: [0, s * .25, 0] });
    P.shaft(x + 1.2, y - 1.6, -1.6, w * 1.1, 7, [-.5, 0, .55], 0xd8e2ec, .22);
  },
  onRespawn(g, cp) {
    this.hand.activate(false); this.hand2.activate(false); g.audio.setMood('calm');
  },
};
