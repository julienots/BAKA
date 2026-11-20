// Objets physiques de chaque chapitre : ils roulent, basculent, s'entrechoquent, flottent, et réagissent à Mio,
// aux ennemis et aux pouvoirs. Placés au hasard sur le sol praticable (jamais dans un mur).
import * as THREE from 'three';
import { getMaterials } from '../core/materials.js';
import { rr, rnd } from '../core/util.js';

function stoneGeo(r) { const g = new THREE.IcosahedronGeometry(r, 1); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + (Math.sin(p.getX(i) * 31 + p.getZ(i) * 17) * .5 + .5) * .22 - .1; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * .8, p.getZ(i) * k); } g.computeVertexNormals(); return g; }
const cyl = (r, h, n = 12) => new THREE.CylinderGeometry(r, r, h, n);

export function defineTypes(ph, P) {
  const M = getMaterials();
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x5a7060, roughness: .08, transmission: 0, transparent: true, opacity: .7, clearcoat: 1 });
  const can = new THREE.MeshStandardMaterial({ color: 0x6a5a50, roughness: .45, metalness: .8, map: M.rust.map });
  const card = new THREE.MeshStandardMaterial({ color: 0x8a7458, roughness: .95 });
  const book = [0x5a3030, 0x30405a, 0x4a5a3a].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: .8 }));
  const T = (n, o) => ph.type(n, o);
  T('stoneS', { geo: stoneGeo(.07), mat: M.stone, shape: 'ball', size: .065, radius: .07, density: 2600, surface: 'stone', bounce: .2, friction: .9, angDamp: .8, buoy: .1 });
  T('stoneM', { geo: stoneGeo(.14), mat: M.stone, shape: 'ball', size: .13, radius: .14, density: 2600, surface: 'stone', bounce: .15, friction: .9, angDamp: 1.2, buoy: .1, heavy: true });
  T('branch', { geo: cyl(.028, .9, 6), mat: M.bark, shape: 'cyl', size: [.028, .9], radius: .03, density: 600, surface: 'wood', buoy: .9, bounce: .1 });
  T('can', { geo: cyl(.035, .12), mat: can, shape: 'cyl', size: [.035, .12], radius: .04, density: 300, surface: 'metal', bounce: .3, sndThr: 1, buoy: .6 });
  T('barrel', { geo: cyl(.27, .82, 18), mat: M.iron, shape: 'cyl', size: [.27, .82], radius: .3, density: 160, surface: 'barrel', bounce: .1, heavy: true, sndThr: 40 });
  T('crateS', { geo: new THREE.BoxGeometry(.38, .38, .38), mat: M.wood, shape: 'box', size: [.38, .38, .38], radius: .2, density: 280, surface: 'wood', heavy: true, sndThr: 15, buoy: .8 });
  T('carton', { geo: new THREE.BoxGeometry(.32, .22, .26), mat: card, shape: 'box', size: [.32, .22, .26], radius: .13, density: 90, surface: 'cardboard', buoy: .7 });
  T('pipe', { geo: cyl(.045, 1.3, 10), mat: M.rust, shape: 'cyl', size: [.045, 1.3], radius: .05, density: 1500, surface: 'metal', bounce: .2, sndThr: 10 });
  T('brick', { geo: new THREE.BoxGeometry(.2, .065, .1), mat: M.stone, shape: 'box', size: [.2, .065, .1], radius: .05, density: 1900, surface: 'stone' });
  T('plank', { geo: new THREE.BoxGeometry(.9, .035, .16), mat: M.wood, shape: 'box', size: [.9, .035, .16], radius: .03, density: 450, surface: 'wood', buoy: 1.2 });
  T('bottle', { geo: cyl(.034, .24, 10), mat: glass, shape: 'cyl', size: [.034, .24], radius: .04, density: 500, surface: 'toy', bounce: .25, buoy: .9 });
  for (let i = 0; i < 4; i++) {
    T('toyCube' + i, { geo: new THREE.BoxGeometry(.16, .16, .16), mat: P.pal(i), shape: 'box', size: [.16, .16, .16], radius: .09, density: 350, surface: 'toy', bounce: .3 });
    T('toyCyl' + i, { geo: cyl(.07, .18, 12), mat: P.pal(i), shape: 'cyl', size: [.07, .18], radius: .08, density: 350, surface: 'toy', bounce: .3 });
  }
  for (let i = 0; i < 3; i++) T('book' + i, { geo: new THREE.BoxGeometry(.22, .045, .16), mat: book[i], shape: 'box', size: [.22, .045, .16], radius: .05, density: 600, surface: 'cardboard' });
}

const SETS = [
  [['stoneS', 30], ['stoneM', 12], ['branch', 20], ['can', 5]],                         // forêt
  [['barrel', 9], ['crateS', 10], ['carton', 12], ['pipe', 8], ['brick', 26], ['can', 12]], // usine
  [['book0', 6], ['book1', 6], ['book2', 6]],                                            // maison (+ jouets)
  [['plank', 16], ['bottle', 10], ['branch', 16], ['stoneS', 14]],                       // marais
  [['stoneS', 26], ['stoneM', 10], ['branch', 10]],                                      // champ
];

export function spawnDebris(g) {
  const ph = g.physics, w = g.world, P = g.props; if (!ph) return;
  const set = SETS[g.chapter] || []; const L = w.length || 150;
  const zA = Math.max(w.zMin ?? -3, -2.6), zB = Math.min(w.zMax ?? 3, 2.4);
  for (const [name, n0] of set) {
    const T = ph.types[name]; if (!T) continue;
    const n = Math.round(n0 * P.density * (L / 160));
    for (let i = 0, tries = 0; i < n && tries < n * 8; tries++) {
      const x = rr(4, L - 4), z = rr(zA, zB), r = T.radius || .1;
      // sur l'eau : seulement ce qui flotte
      const wa = (w.waters || []).find(a => x > a.x0 + .5 && x < a.x1 - .5 && z > a.z0 && z < a.z1);
      const gy = w.groundHeight(x, z, 6, r).y;
      if (wa && !(gy > wa.y)) { if ((T.buoy ?? 0) < .6) continue; ph.prop(name, x, wa.y + .1, z, { rx: Math.PI / 2 * (T.shape === 'cyl' ? 1 : 0) }); i++; continue; }
      if (!(gy > -1.5)) continue;
      if (w.overlapAny(x - r, gy + .01, z - r, x + r, gy + r * 2 + .3, z + r, 'enemy')) continue;
      const lying = T.shape === 'cyl' && (T.size[1] > T.size[0] * 3 || rnd() < .4);
      // les briques et cartons s'empilent parfois
      const stack = (name === 'brick' || name === 'carton' || name.startsWith('book')) && rnd() < .5 ? 1 + Math.floor(rnd() * 3) : 1;
      const hh = T.shape === 'ball' ? T.size : lying ? T.size[0] : T.size[1] / 2, ry = rnd() * 6.28;
      for (let k = 0; k < stack; k++) ph.prop(name, x + rr(-.02, .02), gy + hh + .02 + k * hh * 2.04, z + rr(-.02, .02), { rx: lying ? Math.PI / 2 : 0, ry: ry + rr(-.15, .15) });
      i++;
    }
  }
}
