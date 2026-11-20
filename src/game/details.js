// Petits détails vivants : traces de pas, buée de respiration, corbeaux qui s'envolent, habillage des pièces.
import * as THREE from 'three';
import { canvasTex } from '../core/textures.js';
import { getMaterials } from '../core/materials.js';
import { rr, rnd } from '../core/util.js';

// ------------------------------------------------------------ textures
const footTex = () => canvasTex('footprint', 128, (g, s) => {
  g.clearRect(0, 0, s, s);
  const grd = (x, y, rx, ry) => { g.save(); g.translate(x, y); g.scale(rx, ry); const r = g.createRadialGradient(0, 0, 0, 0, 0, 1); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.7, 'rgba(255,255,255,.8)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.beginPath(); g.arc(0, 0, 1, 0, 6.29); g.fill(); g.restore(); };
  grd(s * .5, s * .32, s * .2, s * .27); grd(s * .5, s * .76, s * .15, s * .17); // semelle + talon
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0,0,0,.5)';
  for (let i = 0; i < 6; i++) g.fillRect(s * .3, s * (.14 + i * .07), s * .4, s * .018); // crampons de la botte
}, [1, 1], false);
const stainTex = () => canvasTex('stain', 256, (g, s) => {
  g.clearRect(0, 0, s, s);
  for (let i = 0; i < 26; i++) { const x = s * (.3 + Math.random() * .4), y = s * (.1 + Math.random() * .5), r = s * (.06 + Math.random() * .22); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(40,32,22,.16)'); gr.addColorStop(.85, 'rgba(40,32,22,.08)'); gr.addColorStop(1, 'rgba(40,32,22,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.29); g.fill(); }
  // coulures vers le bas
  for (let i = 0; i < 14; i++) { const x = s * (.3 + Math.random() * .4), y = s * (.3 + Math.random() * .3), h = s * (.2 + Math.random() * .45); const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, 'rgba(35,28,20,.18)'); gr.addColorStop(1, 'rgba(35,28,20,0)'); g.fillStyle = gr; g.fillRect(x, y, 2 + Math.random() * 5, h); }
  // fissure
  g.strokeStyle = 'rgba(15,12,10,.55)'; g.lineWidth = 1.4; g.beginPath(); let x = s * .5, y = s * .05; g.moveTo(x, y); for (let i = 0; i < 18; i++) { x += (Math.random() - .5) * 22; y += Math.random() * 13; g.lineTo(x, y); } g.stroke();
});
const webTex = () => canvasTex('web', 256, (g, s) => {
  g.clearRect(0, 0, s, s); g.strokeStyle = 'rgba(230,230,230,.5)'; g.lineWidth = 1;
  const n = 11; for (let i = 0; i <= n; i++) { const a = i / n * Math.PI / 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * s * 1.2, Math.sin(a) * s * 1.2); g.stroke(); }
  for (let r = 18; r < s * 1.1; r += 16 + r * .08) { g.beginPath(); for (let i = 0; i <= n; i++) { const a = i / n * Math.PI / 2, rr2 = r * (1 + Math.sin(i * 2.3 + r) * .05); const px = Math.cos(a) * rr2, py = Math.sin(a) * rr2; if (i) g.quadraticCurveTo(Math.cos(a - .07) * rr2 * .93, Math.sin(a - .07) * rr2 * .93, px, py); else g.moveTo(px, py); } g.stroke(); }
}, [1, 1]);
const rugTex = () => canvasTex('rug', 256, (g, s) => {
  g.fillStyle = '#4a2a24'; g.fillRect(0, 0, s, s);
  g.strokeStyle = '#7a5a3a'; g.lineWidth = 8; g.strokeRect(14, 14, s - 28, s - 28); g.lineWidth = 3; g.strokeRect(30, 30, s - 60, s - 60);
  g.fillStyle = '#2a3a4a'; for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { g.save(); g.translate(48 + i * 40, 48 + j * 40); g.rotate(Math.PI / 4); g.fillRect(-8, -8, 16, 16); g.restore(); }
  const img = g.getImageData(0, 0, s, s); for (let i = 0; i < img.data.length; i += 4) { const n = (Math.random() - .5) * 30; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; } g.putImageData(img, 0, 0);
});
const paintTex = k => canvasTex('paint' + k, 128, (g, s) => {
  const pal = [['#3a4048', '#7a7468', '#1a1c20'], ['#4a3a30', '#8a7058', '#20180f'], ['#2a3438', '#9aa0a0', '#101418']][k % 3];
  const gr = g.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, pal[1]); gr.addColorStop(1, pal[0]); g.fillStyle = gr; g.fillRect(0, 0, s, s);
  g.fillStyle = pal[2];
  if (k % 3 === 0) { g.beginPath(); g.ellipse(s * .5, s * .45, s * .16, s * .22, 0, 0, 6.29); g.fill(); g.fillRect(s * .3, s * .62, s * .4, s * .4); } // portrait
  else if (k % 3 === 1) { g.beginPath(); g.moveTo(0, s * .7); for (let x = 0; x <= s; x += 8) g.lineTo(x, s * (.55 + Math.sin(x * .05) * .08)); g.lineTo(s, s); g.lineTo(0, s); g.fill(); } // paysage
  else { g.fillRect(s * .2, s * .3, s * .18, s * .5); g.fillRect(s * .56, s * .38, s * .14, s * .42); g.beginPath(); g.arc(s * .29, s * .26, s * .08, 0, 6.29); g.arc(s * .63, s * .33, s * .065, 0, 6.29); g.fill(); } // deux enfants
  const img = g.getImageData(0, 0, s, s); for (let i = 0; i < img.data.length; i += 4) { const n = (Math.random() - .5) * 26; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; } g.putImageData(img, 0, 0);
});

const _paint = {}, _shared = {};
const paintMat = k => _paint[k] || (_paint[k] = Object.assign(new THREE.MeshStandardMaterial({ map: paintTex(k), roughness: .5 }), { userData: { shared: true } }));

// ------------------------------------------------------------ habillage d'une pièce
export function roomDetail(P, x0, x1, H, zb) {
  const M = P.M, mesh = (...a) => P.mesh(...a);
  const W = x1 - x0, cx = (x0 + x1) / 2;
  // lambris : panneau bas, cimaise, montants
  mesh(new THREE.BoxGeometry(W, 1.05, .04), M.woodDark, cx, .55, zb + .03, { cast: false });
  mesh(new THREE.BoxGeometry(W, .06, .09), M.woodDark, cx, 1.1, zb + .05);
  for (let x = x0 + .7; x < x1 - .3; x += 1.1) mesh(new THREE.BoxGeometry(.05, .8, .06), M.woodDark, x, .58, zb + .06, { cast: false });
  // corniche
  mesh(new THREE.BoxGeometry(W, .14, .14), M.woodDark, cx, H - .07, zb + .07, { cast: false });
  // taches d'humidité et fissures
  const stain = _shared.stain || (_shared.stain = new THREE.MeshBasicMaterial({ map: stainTex(), transparent: true, depthWrite: false, fog: true, color: 0xffffff }));
  stain.userData.shared = true;
  for (let i = 0; i < W / 9; i++) { const s = rr(1.4, 2.6); const m = mesh(new THREE.PlaneGeometry(s, s * 1.3), stain, rr(x0 + 1, x1 - 1), rr(H * .45, H - .6), zb + .045, { cast: false, receive: false }); m.renderOrder = 1; }
  // toiles d'araignée dans les angles du plafond
  const web = _shared.web || (_shared.web = new THREE.MeshBasicMaterial({ map: webTex(), transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: .55 })); web.userData.shared = true;
  for (const [x, sx] of [[x0 + .02, 1], [x1 - .02, -1]]) mesh(new THREE.PlaneGeometry(1.1, 1.1), web, x + sx * .55, H - .65, zb + .06, { rot: [0, sx > 0 ? 0 : Math.PI, 0], cast: false });
  // cadres (tableaux sombres, photo de famille), légèrement de travers
  for (let i = 0; i < Math.max(1, Math.floor(W / 12)); i++) {
    const x = rr(x0 + 2, x1 - 2), y = rr(2.2, Math.min(3.4, H - 1.6)), w = rr(.5, .9), h = w * rr(.8, 1.3), tilt = rr(-.08, .08);
    mesh(new THREE.BoxGeometry(w + .1, h + .1, .04), M.woodDark, x, y, zb + .06, { rot: [0, 0, tilt] });
    mesh(new THREE.PlaneGeometry(w, h), paintMat(Math.floor(rnd() * 3)), x, y, zb + .085, { rot: [0, 0, tilt], cast: false });
  }
  // radiateur en fonte
  if (W > 20) {
    const rx = rr(x0 + 4, x1 - 4);
    for (let k = 0; k < 9; k++) mesh(new THREE.BoxGeometry(.07, .62, .14), M.iron, rx - .32 + k * .08, .5, zb + .12);
    mesh(new THREE.CylinderGeometry(.025, .025, .8, 8), M.iron, rx, .2, zb + .12, { rot: [0, 0, Math.PI / 2] });
  }
  // tapis élimé
  const rug = _shared.rug || (_shared.rug = new THREE.MeshStandardMaterial({ map: rugTex(), roughness: 1 })); rug.userData.shared = true;
  mesh(new THREE.PlaneGeometry(2.8, 1.8), rug, cx + rr(-W / 4, W / 4), .006, rr(-.6, .8), { rot: [-Math.PI / 2, 0, rr(-.2, .2)], cast: false });
  // horloge arrêtée
  if (W > 30) { const x = rr(x0 + 3, x1 - 3), y = Math.min(H - 1.2, 3.8); mesh(new THREE.CylinderGeometry(.3, .3, .06, 24), M.woodDark, x, y, zb + .06, { rot: [Math.PI / 2, 0, 0] }); mesh(new THREE.CircleGeometry(.25, 24), new THREE.MeshStandardMaterial({ color: 0xc8c0b0, roughness: .6 }), x, y, zb + .095, { cast: false }); mesh(new THREE.BoxGeometry(.02, .2, .01), M.darkIron, x + .04, y + .07, zb + .1, { rot: [0, 0, -.6] }); mesh(new THREE.BoxGeometry(.02, .14, .01), M.darkIron, x - .03, y - .04, zb + .1, { rot: [0, 0, 2.2] }); }
}

// ------------------------------------------------------------ système de détails vivants
export class Details {
  constructor(g) {
    this.g = g; this.cold = [0, 1, 3].includes(g.chapter);
    // traces de pas (tampon circulaire instancié)
    this.N = 56; this.k = 0;
    const mat = new THREE.MeshStandardMaterial({ color: 0x0c0a08, alphaMap: footTex(), transparent: true, opacity: .75, depthWrite: false, roughness: .25, polygonOffset: true, polygonOffsetFactor: -2 });
    this.prints = new THREE.InstancedMesh(new THREE.PlaneGeometry(.11, .22).rotateX(-Math.PI / 2), mat, this.N);
    this.prints.count = 0; this.prints.frustumCulled = false; this.prints.receiveShadow = true; this.prints.userData.static = false;
    g.scene.add(this.prints);
    this.breathT = 1; this.birds = []; this.spawnBirds();
  }
  footstep(pos, yaw, surface, side) {
    if (!['dirt', 'grass'].includes(surface)) return;
    const o = new THREE.Object3D(), sx = Math.sin(yaw), cz = Math.cos(yaw);
    o.position.set(pos.x + sx * .07 * side, pos.y + .012, pos.z + cz * .07 * side); o.rotation.set(0, yaw - Math.PI / 2, 0); o.updateMatrix();
    this.prints.setMatrixAt(this.k, o.matrix); this.k = (this.k + 1) % this.N; this.prints.count = Math.min(this.N, this.prints.count + 1); this.prints.instanceMatrix.needsUpdate = true;
  }
  spawnBirds() {
    const g = this.g, n = { 0: 7, 3: 6, 4: 6 }[g.chapter] || 0; if (!n) return;
    const M = getMaterials(), body = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: .5, metalness: .1 }), beak = new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: .4 });
    const bg = new THREE.SphereGeometry(.07, 10, 8).scale(1.6, 1, 1), hg = new THREE.SphereGeometry(.045, 10, 8), kg = new THREE.ConeGeometry(.016, .07, 6).rotateZ(-Math.PI / 2), tg = new THREE.BoxGeometry(.1, .01, .06);
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -.08, 0, .2, .07, 0, .17, -.05, 0, 0], 3)); wg.setIndex([0, 1, 2, 0, 3, 1]); wg.computeVertexNormals();
    const w = g.world, L = w.length || 150;
    for (let i = 0, t = 0; i < n && t < 60; t++) {
      const x = rr(8, L - 6), z = rr(-2.4, -.6), gy = w.groundHeight(x, z, 6, .1).y;
      if (!(gy > -1) || w.overlapAny(x - .15, gy + .02, z - .15, x + .15, gy + .4, z + .15, 'enemy')) continue;
      const root = new THREE.Group(); root.position.set(x, gy, z); root.rotation.y = rnd() * 6.28;
      const b = new THREE.Mesh(bg, body); b.position.y = .1; root.add(b);
      const h = new THREE.Mesh(hg, body); h.position.set(.1, .16, 0); root.add(h); const k = new THREE.Mesh(kg, beak); k.position.set(.05, 0, 0); h.add(k);
      const tl = new THREE.Mesh(tg, body); tl.position.set(-.13, .11, 0); tl.rotation.z = .3; root.add(tl);
      const wings = [1, -1].map(s => { const m = new THREE.Mesh(wg, body); m.material = body; m.scale.z = s; m.position.set(.02, .14, s * .03); m.rotation.x = s * .2; root.add(m); return m; });
      for (const c of root.children) c.castShadow = true;
      g.scene.add(root);
      this.birds.push({ root, head: h, wings, state: 'idle', t: rnd() * 5, vel: new THREE.Vector3(), peck: 0 });
      i++;
    }
  }
  scare(o, R) { for (const b of this.birds) if (b.state === 'idle' && b.root.position.distanceTo(o) < R) this.fly(b, o); }
  fly(b, from) {
    b.state = 'fly'; b.t = 0;
    const away = b.root.position.clone().sub(from); away.y = 0; away.normalize();
    b.vel.set(away.x * rr(2, 3.5) + rr(-.5, .5), rr(2.5, 3.6), away.z * 1.2 - rr(.5, 1.5));
    b.root.rotation.y = Math.atan2(-b.vel.z, b.vel.x);
    const a = this.g.audio; if (a.ctx) { const t = a.now(); for (let i = 0; i < 7; i++) a.burst({ f: 1200 + Math.random() * 800, q: 1.2, dur: .05, vol: .07, t: t + i * .06, x: b.root.position.x }); if (Math.random() < .6) a.burst({ f: 900, q: 6, dur: .25, vol: .06, t: t + .1, sweep: .6, x: b.root.position.x }); } // croassement
  }
  update(dt) {
    const g = this.g, p = g.player; if (!p) return;
    // oiseaux
    for (const b of this.birds) {
      b.t += dt;
      if (b.state === 'idle') {
        // picore, tourne la tête, sautille
        b.peck = Math.max(0, b.peck - dt * 4); if (Math.random() < dt * .8) b.peck = 1;
        b.head.position.y = .16 - Math.sin(b.peck * Math.PI) * .07; b.head.rotation.y = Math.sin(b.t * 1.3) * .5;
        if (Math.random() < dt * .15) b.root.rotation.y += rr(-1, 1);
        for (const w of b.wings) w.rotation.y = 0;
        const d = b.root.position.distanceTo(p.pos); if (d < (p.speed01 > .6 ? 4.5 : 2.6)) this.fly(b, p.pos);
        for (const e of g.enemies) if (e.pos && e.kind === 'wolf' && b.root.position.distanceTo(e.pos) < 4) this.fly(b, e.pos);
      } else if (b.state === 'fly') {
        b.vel.y += (1.2 - b.vel.y * .2) * dt; b.root.position.addScaledVector(b.vel, dt);
        const f = Math.sin(b.t * 28) * 1.1; b.wings[0].rotation.x = .2 + f; b.wings[1].rotation.x = -.2 - f;
        b.root.rotation.z = Math.min(.5, b.vel.y * .12);
        if (b.t > 6) { b.state = 'gone'; b.root.visible = false; }
      }
    }
    // buée : expiration visible dans le froid (plus rapide et plus dense après l'effort)
    if (this.cold && p.model && p.model.skin && p.state !== 'dead') {
      this.breathT -= dt;
      if (this.breathT <= 0) {
        const ex = p.exert || 0; this.breathT = 3.1 - ex * 1.9 + Math.random() * .3;
        const hd = p.model.skin.b.Head; if (hd) {
          const v = new THREE.Vector3(); hd.getWorldPosition(v);
          const yaw = p.model.yawGroup.rotation.y, fx = Math.cos(yaw), fz = -Math.sin(yaw);
          for (let i = 0; i < 3 + ex * 3; i++) g.fx.smokeP.emit({ x: v.x + fx * .12, y: v.y - .02, z: v.z + fz * .12, vx: fx * rr(.25, .5) + p.vel.x * .5, vy: rr(.02, .12), vz: fz * rr(.25, .5) + p.vel.z * .5, life: rr(.9, 1.5), size: .05, size1: .3, color: [.75, .78, .82], alpha: .2 + ex * .08, drag: 1.6 });
        }
      }
    }
  }
}
