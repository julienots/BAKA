// MIO — modèle procédural sculpté + animation par ressorts physiques (aucune pose figée) + écharpe en tissu simulé
//
// Principes d'animation :
//  • chaque articulation suit sa cible avec un ressort critique (inertie, dépassement léger, aucun à-coup) ;
//  • la foulée est synchronisée sur la distance parcourue (pas de glissement des pieds) ;
//  • marche ↔ course se mélangent en continu selon la vitesse ;
//  • bassin (rebond, roulis, torsion), contre-rotation des épaules, inclinaison dans les virages et à l'accélération ;
//  • mouvements secondaires : pans du manteau, pompon, sac à dos, écharpe, paupières, regard.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getMaterials } from '../core/materials.js';
import { hash, clamp, lerp, smooth } from '../core/util.js';
import { MioSkin, mioSkinReady, loadMioSkin } from './mioSkin.js';

const TAIL_N = 10;
const TAU = Math.PI * 2;

class Spring {
  constructor(v = 0, k = 180, z = .9) { this.v = v; this.vel = 0; this.k = k; this.z = z; }
  step(target, dt, k = this.k, z = this.z) {
    const d = 2 * Math.sqrt(k) * z;
    const n = dt > 1 / 90 ? 2 : 1, h = dt / n;
    for (let i = 0; i < n; i++) { const a = k * (target - this.v) - d * this.vel; this.vel += a * h; this.v += this.vel * h; }
    return this.v;
  }
}
const gauss = (d, r) => Math.exp(-(d * d) / (r * r));

export class MioModel {
  constructor() {
    const M = getMaterials();
    this.root = new THREE.Group();
    this.yawGroup = new THREE.Group(); this.root.add(this.yawGroup);
    const scale = this.scaleGroup = new THREE.Group(); scale.scale.setScalar(1.15); this.yawGroup.add(scale);
    const add = (geo, mat, parent, pos = [0, 0, 0], rot = [0, 0, 0], sc = [1, 1, 1]) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(...pos); m.rotation.set(...rot); m.scale.set(...sc);
      m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
    };
    // ---------------- hiérarchie : bassin → colonne → buste → cou → tête
    const pelvis = this.pelvis = new THREE.Group(); pelvis.position.y = .37; scale.add(pelvis);
    const spine = this.spine = new THREE.Group(); pelvis.add(spine);
    const chest = this.chest = new THREE.Group(); chest.position.y = .2; spine.add(chest);
    // ---------------- jambes (collants + bottes à semelle)
    this.legs = [];
    for (const side of [1, -1]) {
      const hip = new THREE.Group(); hip.position.set(0, -.01, side * .068); pelvis.add(hip);
      add(new THREE.CapsuleGeometry(.042, .13, 6, 12), M.legs, hip, [0, -.085, 0]);
      const knee = new THREE.Group(); knee.position.y = -.18; hip.add(knee);
      add(new THREE.CapsuleGeometry(.036, .12, 6, 12), M.legs, knee, [0, -.075, 0]);
      const ankle = new THREE.Group(); ankle.position.y = -.158; knee.add(ankle);
      // botte : tige + pied arrondi + semelle + bout renforcé
      add(new THREE.CylinderGeometry(.046, .042, .07, 14), M.boot, ankle, [0, .005, 0]);
      add(new THREE.SphereGeometry(.05, 16, 12), M.boot, ankle, [.035, -.025, 0], [0, 0, 0], [1.55, .62, .95]);
      add(new THREE.BoxGeometry(.165, .018, .085), M.darkIron || M.boot, ankle, [.03, -.052, 0]);
      add(new THREE.TorusGeometry(.044, .008, 6, 16), M.leather, ankle, [0, .035, 0], [Math.PI / 2, 0, 0]);
      this.legs.push({ hip, knee, ankle, side });
    }
    // ---------------- manteau long (tour à 48 côtés, plis, patte de boutonnage, col, poches)
    const prof = [[.0, .81], [.1, .805], [.135, .77], [.15, .7], [.158, .6], [.178, .47], [.205, .35], [.228, .24], [.24, .19], [.232, .175]];
    const coatGeo = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 48);
    {
      const p = coatGeo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x);
        const low = Math.max(0, .62 - y);
        const fold = 1 + Math.sin(a * 6 + 1.3) * .055 * low * 1.6 + Math.sin(a * 11 + .4) * .02 * low + Math.sin(a * 3) * .012;
        p.setXYZ(i, x * fold * 1.02, y, z * fold * .86);
      }
      coatGeo.translate(0, -.37, 0); coatGeo.computeVertexNormals();
    }
    this.coatBase = coatGeo.attributes.position.array.slice();
    this.coat = add(coatGeo, M.coat, spine);
    // patte de boutonnage et brandebourgs (boutons-bûchettes)
    add(new THREE.BoxGeometry(.02, .5, .05), M.coat, spine, [.168, .17 - .37 + .3, .0], [0, 0, -.06]);
    for (let i = 0; i < 4; i++) {
      const y = .7 - i * .12 - .37;
      add(new THREE.CapsuleGeometry(.009, .035, 4, 8), M.woodDark, spine, [.165 + i * .013, y, 0], [Math.PI / 2, 0, 0]);
      add(new THREE.TorusGeometry(.016, .003, 4, 10), M.boot, spine, [.162 + i * .013, y, .022], [0, Math.PI / 2, 0]);
    }
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(.09, .07, .012), M.coat, spine, [.09, .38 - .37, s * .17], [0, s * -.5, 0]);
    // col montant replié
    add(new THREE.TorusGeometry(.11, .034, 10, 32), M.coat, chest, [0, .6 - .57, 0], [Math.PI / 2, 0, 0], [1, 1, 1.25]);
    // ---------------- bras (manches à revers) + mains (paume, doigts, pouce)
    this.arms = [];
    for (const side of [1, -1]) {
      const sh = new THREE.Group(); sh.position.set(0, .745 - .57, side * .14); chest.add(sh);
      add(new THREE.SphereGeometry(.05, 12, 10), M.coat, sh, [0, 0, 0]);
      add(new THREE.CapsuleGeometry(.045, .13, 6, 12), M.coat, sh, [0, -.085, 0]);
      const el = new THREE.Group(); el.position.y = -.175; sh.add(el);
      add(new THREE.CapsuleGeometry(.042, .1, 6, 12), M.coat, el, [0, -.06, 0]);
      add(new THREE.TorusGeometry(.044, .012, 8, 16), M.coat, el, [0, -.12, 0], [Math.PI / 2, 0, 0]);
      const wrist = new THREE.Group(); wrist.position.y = -.135; el.add(wrist);
      add(new THREE.SphereGeometry(.03, 12, 10), M.skin, wrist, [0, -.02, 0], [0, 0, 0], [.8, 1.1, 1.2]);
      const fingers = new THREE.Group(); fingers.position.y = -.045; wrist.add(fingers);
      for (let f = 0; f < 4; f++) add(new THREE.CapsuleGeometry(.0085, .03, 4, 6), M.skin, fingers, [.006 * (f - 1.5), -.016, (f - 1.5) * .0105]);
      const thumb = new THREE.Group(); thumb.position.set(.015, -.02, side * .022); wrist.add(thumb);
      add(new THREE.CapsuleGeometry(.009, .024, 4, 6), M.skin, thumb, [0, -.012, 0]);
      thumb.rotation.x = side * .6;
      this.arms.push({ sh, el, wrist, fingers, thumb, side });
    }
    // ---------------- tête sculptée
    const neck = this.neck = new THREE.Group(); neck.position.y = .79 - .57; chest.add(neck);
    add(new THREE.CylinderGeometry(.04, .045, .06, 12), M.skin, neck, [0, .02, 0]);
    const head = this.head = new THREE.Group(); head.position.y = .2; neck.add(head);
    const hg = new THREE.SphereGeometry(.2, 56, 42), hp = hg.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < hp.count; i++) {
      v.fromBufferAttribute(hp, i); const n = v.clone().normalize();
      let r = 1;
      if (n.y < -.25) r *= 1 - .2 * Math.min(1, (-n.y - .25) / .7) * (1 - Math.max(0, n.x) * .4); // mâchoire qui s'affine
      r += .055 * gauss(n.distanceTo(new THREE.Vector3(.55, -.3, .55).normalize()), .38) + .055 * gauss(n.distanceTo(new THREE.Vector3(.55, -.3, -.55).normalize()), .38); // joues rondes
      r -= .045 * gauss(n.distanceTo(new THREE.Vector3(.85, .05, .38).normalize()), .2) + .045 * gauss(n.distanceTo(new THREE.Vector3(.85, .05, -.38).normalize()), .2); // orbites
      r += .055 * gauss(n.distanceTo(new THREE.Vector3(1, -.18, 0).normalize()), .13); // nez
      r += .025 * gauss(n.distanceTo(new THREE.Vector3(.95, -.42, 0).normalize()), .14); // menton
      r += .018 * gauss(n.distanceTo(new THREE.Vector3(.8, .3, 0).normalize()), .4); // front
      if (n.x < 0) r *= 1.03;
      v.copy(n).multiplyScalar(.2 * r); v.z *= .95; v.y *= 1.03;
      hp.setXYZ(i, v.x, v.y, v.z);
    }
    hg.computeVertexNormals();
    this.headMesh = add(hg, M.skin, head);
    // bouche
    add(new THREE.CapsuleGeometry(.004, .03, 3, 6), M.eye, head, [.186, -.105, 0], [Math.PI / 2, 0, 0]);
    // yeux : sclérotique, grande pupille sombre brillante, paupières
    this.lids = [];
    this.eyes = [];
    for (const s of [-1, 1]) {
      const eg = new THREE.Group(); eg.position.set(.142, .0, s * .074); head.add(eg);
      add(new THREE.SphereGeometry(.033, 20, 16), M.sclera, eg, [0, 0, 0]);
      const iris = add(new THREE.SphereGeometry(.031, 20, 16), M.iris, eg, [.01, 0, 0], [0, 0, 0], [.72, 1.1, 1.02]);
      add(new THREE.SphereGeometry(.0055, 8, 6), M.eyeShine, eg, [.036, .012, -s * .008]);
      this.eyes.push({ g: eg, iris });
      const lid = new THREE.Group(); lid.position.copy(eg.position); head.add(lid);
      add(new THREE.SphereGeometry(.037, 20, 12, 0, Math.PI * 2, 0, Math.PI * .5), M.skin, lid, [0, 0, 0], [0, 0, -.25]);
      add(new THREE.SphereGeometry(.036, 20, 10, 0, Math.PI * 2, Math.PI * .72, Math.PI * .28), M.skin, eg, [0, 0, 0]);
      this.lids.push(lid);
    }
    // oreilles (sous le bonnet)
    for (const s of [-1, 1]) add(new THREE.SphereGeometry(.035, 12, 10), M.skin, head, [-.01, -.03, s * .19], [0, 0, 0], [.6, 1, .35]);
    // cheveux : calotte + mèches (cartes texturées)
    add(new THREE.SphereGeometry(.207, 32, 22, 0, Math.PI * 2, 0, Math.PI * .6), M.hair, head, [-.012, -.0, 0], [0, 0, .32]);
    const card = (w, h, pos, rot) => { const g = new THREE.PlaneGeometry(w, h, 1, 4); const a = g.attributes.position; for (let i = 0; i < a.count; i++) { const y = a.getY(i); a.setZ(i, Math.pow((h / 2 - y) / h, 2) * .03); } g.translate(0, -h / 2, 0); const m = add(g, M.hairCard, head, pos, rot); m.castShadow = false; return m; };
    for (let i = -3; i <= 3; i++) card(.07, .13, [.17 - Math.abs(i) * .012, .1, i * .035], [0, Math.PI / 2 + i * .12, .38]);
    for (const s of [-1, 1]) { card(.08, .17, [.08, .03, s * .19], [0, s > 0 ? 0 : Math.PI, s * .1]); card(.07, .15, [-.05, .02, s * .2], [0, s > 0 ? -.2 : Math.PI + .2, 0]); }
    for (let i = -2; i <= 2; i++) card(.08, .14, [-.19, .03, i * .055], [0, -Math.PI / 2 + i * .15, -.1]);
    // bonnet tricoté un peu « avachi » + revers côtelé + pompon
    const bg = new THREE.SphereGeometry(.224, 40, 24, 0, Math.PI * 2, 0, Math.PI * .52), bp = bg.attributes.position;
    for (let i = 0; i < bp.count; i++) { v.fromBufferAttribute(bp, i); const k = Math.max(0, v.y / .224); v.x -= k * k * .04; v.y *= 1.08; bp.setXYZ(i, v.x, v.y, v.z); }
    bg.computeVertexNormals();
    add(bg, M.knit, head, [-.012, .045, 0], [0, 0, .2]);
    add(new THREE.TorusGeometry(.212, .042, 14, 48), M.rib, head, [-.004, .055, 0], [Math.PI / 2, .2, 0], [1, 1, .9]);
    const pomG = new THREE.IcosahedronGeometry(.075, 4), pp = pomG.attributes.position;
    for (let i = 0; i < pp.count; i++) { v.fromBufferAttribute(pp, i); v.multiplyScalar(1 + (hash(v.x * 140, v.y * 140 + v.z * 60) - .5) * .32); pp.setXYZ(i, v.x, v.y, v.z); }
    pomG.computeVertexNormals();
    this.pomPivot = new THREE.Group(); this.pomPivot.position.set(-.08, .27, 0); head.add(this.pomPivot);
    add(pomG, M.knit, this.pomPivot, [0, .03, 0]);
    // ---------------- écharpe (anneau épais tricoté)
    this.scarfRing = add(new THREE.TorusGeometry(.112, .046, 12, 32), M.scarf, chest, [0, .815 - .57, 0], [Math.PI / 2, 0, 0], [1, 1, 1.25]);
    add(new THREE.SphereGeometry(.05, 12, 10), M.scarf, chest, [-.1, .235, .06], [0, 0, 0], [1, .8, 1]); // nœud
    // ---------------- sac à dos (rabat, sangles) sur un ressort
    const packPivot = this.packPivot = new THREE.Group(); packPivot.position.set(-.155, .62 - .57, 0); chest.add(packPivot);
    const pg = new THREE.BoxGeometry(.13, .2, .21, 4, 4, 4); { const a = pg.attributes.position; for (let i = 0; i < a.count; i++) { v.fromBufferAttribute(a, i); const l = v.length(); v.normalize().multiplyScalar(l * .78 + .022); a.setXYZ(i, v.x * 1.08, v.y * 1.18, v.z * 1.12); } pg.computeVertexNormals(); }
    add(pg, M.leather, packPivot, [-.02, 0, 0]);
    add(new THREE.BoxGeometry(.06, .1, .2), M.leather, packPivot, [-.075, .07, 0], [0, 0, .25]);
    add(new THREE.BoxGeometry(.012, .03, .02), M.chain, packPivot, [-.105, .02, 0]);
    for (const s of [-1, 1]) add(new THREE.TorusGeometry(.13, .011, 6, 20, Math.PI * 1.1), M.leather, chest, [-.03, .07, s * .085], [0, 0, 1.85]);
    // emplacement d'objet porté
    this.carrySlot = new THREE.Group(); this.carrySlot.position.set(.2, .02, 0); chest.add(this.carrySlot);
    // ---------------- pans d'écharpe (verlet en espace monde)
    this.tails = [0, 1].map(k => {
      const pts = [], old = []; for (let i = 0; i < TAIL_N; i++) { pts.push(new THREE.Vector3()); old.push(new THREE.Vector3()); }
      const geo = new THREE.BufferGeometry(); const pos = new Float32Array(TAIL_N * 2 * 3), uv = new Float32Array(TAIL_N * 2 * 2), idx = [];
      for (let i = 0; i < TAIL_N; i++) { uv.set([i / (TAIL_N - 1) * 3, 0, i / (TAIL_N - 1) * 3, 1], i * 4); if (i < TAIL_N - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx);
      const mesh = new THREE.Mesh(geo, M.scarf); mesh.castShadow = true; mesh.frustumCulled = false;
      return { pts, old, mesh, len: k ? .044 : .054, init: false, off: k ? -.045 : .045 };
    });
    // frange au bout des pans
    this.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    // ---------------- état d'animation
    this.t = 0; this.phase = 0; this.blinkT = 2; this.blink = 0; this.glow = 0;
    this.S = {}; // ressorts
    this.prevPos = new THREE.Vector3(); this.prevVel = new THREE.Vector3(); this.acc = new THREE.Vector3(); this.first = true;
    this.hem = { x: new Spring(0, 60, .35), z: new Spring(0, 60, .35) };
    this.pom = { x: new Spring(0, 90, .25), z: new Spring(0, 90, .25) };
    this.pack = new Spring(0, 140, .3);
    this.idleT = 0; this.lookYaw = new Spring(0, 40, .9); this.lookPitch = new Spring(0, 40, .9);
    this.prevYaw = 0; this.turnRate = 0;
    // modèle réaliste (Tripo) : branché dès qu'il est chargé, sinon on garde la version procédurale
    const g = mioSkinReady(); if (g) this.attachSkin(g); else loadMioSkin().then(gl => { if (gl && !this.skin) this.attachSkin(gl); });
  }
  attachSkin(gltf) {
    try {
      this.skin = new MioSkin(gltf);
      this.yawGroup.add(this.skin.holder);
      this.scaleGroup.visible = false; // le squelette procédural reste calculé, mais invisible
    } catch (e) { console.warn('Mio GLB : échec du branchement', e); this.skin = null; this.scaleGroup.visible = true; }
  }
  addTo(scene) { scene.add(this.root); for (const t of this.tails) scene.add(t.mesh); }
  removeFrom(scene) { scene.remove(this.root); for (const t of this.tails) scene.remove(t.mesh); }
  resetCloth() { for (const t of this.tails) t.init = false; this.first = true; }
  sp(name, target, dt, k = 170, z = .85) {
    let s = this.S[name]; if (!s) s = this.S[name] = new Spring(target, k, z);
    return s.step(target, dt, k, z);
  }

  // a : { state, vx, vz, vy, speed01, fear, landT, climbT, ledgeH, ladderP, wakeT, castK, groundY, grounded, airT }
  animate(dt, a, wind = 0) {
    dt = Math.min(dt, 1 / 30);
    this.t += dt;
    const t = this.t, fear = a.fear || 0;
    // --- accélération monde (pour l'inertie des vêtements et l'inclinaison)
    const wp = this.root.position;
    if (this.first) { this.prevPos.copy(wp); this.prevVel.set(0, 0, 0); this.first = false; }
    const vel = wp.clone().sub(this.prevPos).divideScalar(Math.max(dt, 1e-4)); this.prevPos.copy(wp);
    this.acc.lerp(vel.clone().sub(this.prevVel).divideScalar(Math.max(dt, 1e-4)), .25); this.prevVel.copy(vel);
    const yaw = this.yawGroup.rotation.y;
    const fwd = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const accF = clamp(this.acc.dot(fwd), -25, 25);
    let dy = yaw - this.prevYaw; while (dy > Math.PI) dy -= TAU; while (dy < -Math.PI) dy += TAU; this.prevYaw = yaw;
    this.turnRate = lerp(this.turnRate, dy / Math.max(dt, 1e-4), .2);
    const hs = Math.hypot(a.vx || 0, a.vz || 0); // vitesse horizontale m/s
    const run = clamp((hs - 1.9) / 1.8, 0, 1);
    // --- foulée synchronisée sur la distance parcourue
    const stride = lerp(1.0, 1.75, run);
    const moving = (a.state === 'move' || a.state === 'carry' || a.state === 'crouch') && hs > .08;
    if (moving) this.phase += hs * dt / stride * TAU * (a.state === 'crouch' ? 1.4 : 1);
    else if (a.state === 'push' && hs > .05) this.phase += hs * dt / .55 * TAU;
    const ph = this.phase, s = Math.sin(ph), c = Math.cos(ph);
    const breath = Math.sin(t * (1.9 + fear * 3.5 + (a.exert || 0) * 2.5));

    // ================= POSE CIBLE =================
    const P = {
      pelY: 0, pelRoll: 0, pelTwist: 0, lean: 0, side: 0, chestTwist: 0, chestPitch: breath * .02,
      hipL: 0, hipR: 0, kneeL: -.06, kneeR: -.06, ankL: 0, ankR: 0, hipOutL: 0, hipOutR: 0,
      shL: .05, shR: .05, shOutL: .1, shOutR: .1, elL: -.25, elR: -.25, gripL: .4, gripR: .4,
      neckP: 0, headP: 0, headY: 0, headR: 0,
    };
    const st = a.state;
    if (st === 'idle') {
      this.idleT += dt;
      const shift = Math.sin(t * .55) * .5 + .5; // transfert de poids
      P.side = (shift - .5) * .03; P.pelRoll = (shift - .5) * .06;
      P.hipL = .02; P.hipR = -.02; P.kneeL = -.05 - (1 - shift) * .12; P.kneeR = -.05 - shift * .12;
      P.shL = .05 + breath * .02; P.shR = .03 - breath * .02; P.elL = -.22; P.elR = -.3;
      P.pelY = breath * .004 - .004;
      // regarde autour de lui, puis se frotte les bras (il a froid)
      const cyc = this.idleT % 14;
      P.headY = Math.sin(t * .35) * .35 + (cyc > 3 && cyc < 5 ? Math.sin((cyc - 3) * Math.PI) * .7 : 0);
      P.headP = Math.sin(t * .23) * .06;
      if (cyc > 8 && cyc < 11.5) { const r = Math.sin(t * 9) * .08; P.shL = .9 + r; P.shR = .85 - r; P.shOutL = -.35; P.shOutR = -.35; P.elL = -1.9; P.elR = -1.9; P.headP = .15; P.lean = -.04; P.chestPitch += Math.sin(t * 18) * .01; }
      if (fear > .3) {
        const k = clamp((fear - .3) / .5, 0, 1);
        P.pelY = lerp(P.pelY, -.07, k); P.kneeL = lerp(P.kneeL, -.6, k); P.kneeR = lerp(P.kneeR, -.55, k); P.hipL = lerp(P.hipL, .35, k); P.hipR = lerp(P.hipR, .3, k);
        P.lean = lerp(P.lean, -.12, k); P.shL = lerp(P.shL, 1.2, k); P.shR = lerp(P.shR, 1.1, k); P.elL = lerp(P.elL, -2.0, k); P.elR = lerp(P.elR, -1.95, k); P.shOutL = P.shOutR = lerp(.1, -.3, k);
        P.headP = lerp(P.headP, .2, k); P.headY = Math.sin(t * 2.3) * .6 * k;
      }
    } else this.idleT = 0;
    if (st === 'move' || st === 'carry') {
      const A = lerp(.42, .78, run), K = lerp(.85, 1.65, run);
      P.hipL = s * A; P.hipR = -s * A;
      // genou : flexion en phase d'envol + amorti à l'appui
      P.kneeL = -(Math.max(0, -c) * K + Math.max(0, s) * .18 * (1 - run) + .1);
      P.kneeR = -(Math.max(0, c) * K + Math.max(0, -s) * .18 * (1 - run) + .1);
      P.ankL = Math.max(0, -s) * .35 - Math.max(0, s) * .2; P.ankR = Math.max(0, s) * .35 - Math.max(0, -s) * .2;
      // bassin : rebond deux fois par cycle, roulis, torsion ; buste en contre-rotation
      P.pelY = (lerp(.022, .05, run) * Math.abs(Math.cos(ph)) - lerp(.012, .045, run));
      P.pelRoll = s * lerp(.05, .03, run); P.pelTwist = s * lerp(.12, .16, run); P.chestTwist = -s * lerp(.2, .28, run);
      P.lean = -lerp(.04, .24, run) - clamp(accF * .012, -.15, .2);
      const AA = lerp(.42, 1.05, run);
      P.shL = -Math.sin(ph - .25) * AA + .05; P.shR = Math.sin(ph - .25) * AA + .05;
      P.elL = -lerp(.3, 1.45, run) - Math.max(0, Math.sin(ph - .25)) * .25; P.elR = -lerp(.3, 1.45, run) - Math.max(0, -Math.sin(ph - .25)) * .25;
      P.shOutL = P.shOutR = lerp(.12, .2, run);
      P.headP = -P.lean * .6 + Math.cos(ph * 2) * .02; P.headR = -P.pelRoll * .5;
      P.gripL = P.gripR = lerp(.4, .9, run);
      if (st === 'carry') { P.shL = 1.15; P.shR = 1.05; P.elL = -1.05; P.elR = -1.05; P.shOutL = P.shOutR = -.15; P.lean = .04; P.chestTwist *= .3; P.gripL = P.gripR = 1; }
    }
    if (st === 'crouch') {
      P.pelY = -.15; P.hipL = 1.05 + s * .35 * (hs > .08); P.hipR = .95 - s * .35 * (hs > .08); P.kneeL = -1.9; P.kneeR = -1.85; P.ankL = .7; P.ankR = .7;
      P.lean = -.35; P.shL = .75; P.shR = .65; P.elL = -1.45; P.elR = -1.35; P.headP = .25 - P.lean * .4; P.headY = Math.sin(t * .8) * .3;
    }
    if (st === 'push') {
      const m = hs > .05, strain = Math.sin(t * 23) * .015;
      P.lean = -.55; P.pelY = -.06;
      P.hipL = .6 + (m ? s * .3 : 0); P.hipR = -.75 + (m ? -s * .3 : 0); P.kneeL = -.35 - (m ? Math.max(0, -c) * .5 : 0); P.kneeR = -.18 - (m ? Math.max(0, c) * .5 : 0);
      P.ankL = .3; P.ankR = .45;
      P.shL = 1.5 + strain; P.shR = 1.38 - strain; P.elL = -.35; P.elR = -.45; P.shOutL = P.shOutR = -.05; P.headP = .35; P.gripL = P.gripR = .2;
    }
    if (st === 'pull') { P.lean = .3; P.hipL = .35; P.hipR = -.5; P.kneeL = -.45; P.kneeR = -.2; P.shL = 1.35; P.shR = 1.25; P.elL = -.35; P.elR = -.35; P.pelY = -.05; P.gripL = P.gripR = 1; }
    if (st === 'air') {
      const up = clamp(a.vy / 5, -1, 1), longFall = clamp(((a.airT || 0) - .55) / .4, 0, 1);
      P.hipL = .55 + up * .25; P.hipR = -.2 + up * .1; P.kneeL = -1.0 - up * .2; P.kneeR = -.35 - (1 - up) * .25;
      P.ankL = .2; P.ankR = -.1;
      P.shL = up > 0 ? 2.0 : 1.2; P.shR = up > 0 ? 1.3 : 1.7; P.shOutL = P.shOutR = .45 + (1 - up) * .25; P.elL = -.45; P.elR = -.6;
      P.lean = -.12 - up * .05; P.headP = -up * .15;
      if (longFall > 0) { const f = Math.sin(t * 14); P.shL += f * .5 * longFall; P.shR -= f * .5 * longFall; P.hipL += f * .3 * longFall; P.hipR -= f * .3 * longFall; P.headP = -.3; }
      P.gripL = P.gripR = .8;
    }
    if (st === 'climb') {
      // accroche → traction → genou sur le rebord → redressement
      const k = a.climbT, h = clamp(a.ledgeH || 1, .3, 1.7);
      const reach = smooth(clamp(k / .22, 0, 1)), pull = smooth(clamp((k - .2) / .38, 0, 1)), knee = smooth(clamp((k - .55) / .28, 0, 1)), stand = smooth(clamp((k - .82) / .18, 0, 1));
      const armUp = lerp(1.3, 2.95, clamp(h / 1.2, 0, 1));
      P.shL = lerp(lerp(.2, armUp, reach), .7, pull * .7 + stand * .3); P.shR = lerp(lerp(.2, armUp - .1, reach), .65, pull * .7 + stand * .3);
      P.elL = -lerp(.1, 1.9, pull) * (1 - stand) - .2; P.elR = -lerp(.1, 1.8, pull) * (1 - stand) - .2;
      P.shOutL = P.shOutR = .15;
      P.hipL = lerp(.2, 1.55, knee) * (1 - stand) + Math.sin(t * 16) * .15 * (1 - pull);
      P.kneeL = -lerp(.3, 2.1, knee) * (1 - stand) - .05; P.hipR = lerp(-.25, -.1, knee) - Math.sin(t * 16) * .15 * (1 - pull); P.kneeR = -lerp(.5, .8, pull) * (1 - stand);
      P.lean = -lerp(.05, .7, knee) * (1 - stand) + reach * .08 * (1 - pull); P.pelY = -stand * .0;
      P.headP = lerp(-.35, .2, knee) * (1 - stand); P.gripL = P.gripR = 1;
    }
    if (st === 'hang') {
      const sw = Math.sin(t * 2.6) * .12;
      P.shL = 2.95; P.shR = 2.9; P.elL = -.15 - (a.exert || 0) * .4; P.elR = -.2; P.shOutL = P.shOutR = .2;
      P.hipL = .15 + sw; P.hipR = -.05 - sw; P.kneeL = -.35; P.kneeR = -.2; P.lean = .05; P.headP = -.3; P.gripL = P.gripR = 1;
    }
    if (st === 'ladder') {
      const lp = a.ladderP || 0, ls = Math.sin(lp), lc = Math.cos(lp);
      P.shL = 2.75 + ls * .3; P.shR = 2.75 - ls * .3; P.elL = -.5 - Math.max(0, -ls) * .7; P.elR = -.5 - Math.max(0, ls) * .7; P.shOutL = P.shOutR = .38;
      P.hipL = .7 + ls * .45; P.hipR = .7 - ls * .45; P.kneeL = -1.2 - Math.max(0, ls) * .5; P.kneeR = -1.2 - Math.max(0, -ls) * .5; P.ankL = P.ankR = .3;
      P.lean = -.05; P.headP = -.2 + lc * .05; P.gripL = P.gripR = 1;
    }
    if (st === 'latch') {
      const j = Math.sin(t * 24) * .07;
      P.shL = 1.6 + j; P.shR = 1.95 - j; P.elL = -.55; P.elR = -.3; P.lean = -.22; P.hipL = .25; P.hipR = -.35; P.kneeL = -.25; P.kneeR = -.25;
      P.headP = Math.sin(t * 7) * .05 - .1; P.headY = Math.sin(t * 2.7) * .9 * fear; P.gripL = P.gripR = 1;
    }
    if (st === 'cast') {
      const k = a.castK || 0, tr = Math.sin(t * 30) * .03 * k;
      P.shL = 1.35 + k * .45 + tr; P.shR = 1.25 + k * .35 - tr; P.elL = -.25; P.elR = -.35; P.shOutL = P.shOutR = .55 * k; P.lean = .12 - k * .22; P.headP = -.2;
      P.hipL = .3; P.hipR = -.35; P.kneeL = -.35; P.kneeR = -.2; P.pelY = -.03 - k * .02; P.gripL = P.gripR = 0;
    }
    if (st === 'release') { P.shL = 2.1; P.shR = 2.0; P.elL = -.08; P.elR = -.08; P.lean = .08; P.headP = -.35; P.shOutL = P.shOutR = .3; P.gripL = P.gripR = 0; P.chestPitch = .06; }
    if (st === 'sit') { P.pelY = -.33; P.hipL = 1.55; P.hipR = 1.5; P.kneeL = -1.55; P.kneeR = -1.5; P.shL = .45; P.shR = .4; P.elL = -.85; P.elR = -.8; P.headP = .25 + Math.sin(t * .3) * .05; P.headY = Math.sin(t * .2) * .25 - .2; P.lean = .06; }
    if (st === 'dead') { P.pelY = -.35; P.lean = -1.38; P.hipL = .3; P.hipR = -.05; P.kneeL = -.45; P.kneeR = -.65; P.shL = 2.7; P.shR = 2.2; P.elL = -.25; P.elR = -.1; P.headP = .35; P.headY = .4; P.gripL = P.gripR = .2; }
    if (st === 'wake') {
      const k = a.wakeT;
      P.pelY = lerp(-.36, 0, smooth(k)); P.lean = lerp(-1.45, 0, smooth(Math.min(1, k * 1.25))); P.hipL = lerp(1.4, 0, k); P.hipR = lerp(1.25, 0, k); P.kneeL = lerp(-1.6, -.06, k); P.kneeR = lerp(-1.75, -.06, k);
      P.shL = lerp(2.0, .05, k); P.shR = lerp(.9, 0, k); P.elL = -.55; P.elR = -.85; P.headP = lerp(.45, 0, k); P.headY = Math.sin(k * 9) * .35 * k;
    }
    // regard : la tête suit ce qui l'inquiète ou l'intéresse (ennemi proche, objet)
    let lkY = 0, lkP = 0;
    if (a.look && !['climb', 'ladder', 'dead', 'hang', 'wake'].includes(st)) {
      const hx = a.look.x - wp.x, hz = a.look.z - wp.z, hy = a.look.y - (wp.y + 1.1);
      let ly = Math.atan2(-hz, hx) - yaw; while (ly > Math.PI) ly -= TAU; while (ly < -Math.PI) ly += TAU;
      if (Math.abs(ly) < 2.2) { lkY = clamp(ly, -1.1, 1.1); lkP = clamp(Math.atan2(hy, Math.hypot(hx, hz)), -.5, .5); P.headY += lkY * .85; P.chestTwist += clamp(ly, -1, 1) * .15; P.headP -= lkP * .7; }
    }
    this.lookYaw.step(lkY, dt); this.lookPitch.step(lkP, dt);
    const bankT = clamp(-this.turnRate * hs * .045, -.22, .22);
    this.bankV = (this.bankV || 0) + (bankT - (this.bankV || 0)) * Math.min(1, dt * 6);
    this.leanV = (this.leanV || 0) + (clamp(-accF * .012, -.15, .15) - (this.leanV || 0)) * Math.min(1, dt * 5);
    // inertie des bras : ils traînent quand Mio accélère, partent en avant quand il freine
    if (st === 'move' || st === 'idle') { const k = clamp(-accF * .018, -.35, .35); P.shL += k; P.shR += k; P.elL -= Math.abs(k) * .5; P.elR -= Math.abs(k) * .5; }
    // inclinaison dans les virages
    if (a.grounded !== false) P.pelRoll += clamp(-this.turnRate * hs * .045, -.25, .25);
    // atterrissage (amortisseur)
    if (a.landT > 0) { const k = a.landT; P.pelY -= .1 * k; P.kneeL -= .8 * k; P.kneeR -= .8 * k; P.hipL += .45 * k; P.hipR += .45 * k; P.ankL += .4 * k; P.ankR += .4 * k; P.lean -= .2 * k; P.shOutL += .3 * k; P.shOutR += .3 * k; }
    // tremblement de peur
    if (fear > .25) { const tr = (fear - .25) * .03; P.headR += (hash(t * 37, 1) - .5) * tr; P.shL += (hash(t * 41, 2) - .5) * tr * 2; P.shR += (hash(t * 43, 3) - .5) * tr * 2; }

    // ================= RESSORTS =================
    const K = st === 'climb' || st === 'ladder' ? 420 : st === 'dead' ? 70 : st === 'air' ? 160 : 230;
    const Z = st === 'dead' ? .55 : .82;
    const S = (n, k = K, z = Z) => this.sp(n, P[n], dt, k, z);
    this.pelvis.position.y = .37 + S('pelY', K * 1.3, .7); this.pelvis.position.z = S('side', 60, .9);
    this.pelvis.rotation.set(S('pelRoll'), S('pelTwist'), 0);
    this.spine.rotation.set(0, S('chestTwist') * .5, S('lean', K * .8, .75));
    this.chest.rotation.set(0, this.S.chestTwist.v * .5, S('chestPitch', 120));
    const L = this.legs, A = this.arms;
    L[0].hip.rotation.set(S('hipOutL', 120), 0, S('hipL')); L[0].knee.rotation.z = Math.min(0, S('kneeL')); L[0].ankle.rotation.z = S('ankL');
    L[1].hip.rotation.set(-S('hipOutR', 120), 0, S('hipR')); L[1].knee.rotation.z = Math.min(0, S('kneeR')); L[1].ankle.rotation.z = S('ankR');
    // les pieds restent à plat : compensation de l'orientation jambe + bassin
    for (const l of L) l.ankle.rotation.z += -(l.hip.rotation.z + l.knee.rotation.z) * .55 - this.spine.rotation.z * 0;
    A[0].sh.rotation.set(S('shOutL', 160) + .05, 0, S('shL')); A[0].el.rotation.z = Math.min(0, S('elL'));
    A[1].sh.rotation.set(-S('shOutR', 160) - .05, 0, S('shR')); A[1].el.rotation.z = Math.min(0, S('elR'));
    for (const [i, arm] of A.entries()) { const g = S(i ? 'gripR' : 'gripL', 200); arm.fingers.rotation.z = -g * 1.3; arm.thumb.rotation.z = -g * .6; arm.wrist.rotation.z = -arm.el.rotation.z * .15; }
    // tête : stabilisation + regard
    this.neck.rotation.z = -S('neckP', 140) * .3;
    this.head.rotation.set(S('headR', 150), S('headY', 90, .85), -S('headP', 150) - this.pelvis.rotation.x * .2 + this.spine.rotation.z * -.25);
    // clignements (paupières qui descendent vraiment)
    this.blinkT -= dt; if (this.blinkT < 0) { this.blink = 1; this.blinkT = 1.8 + Math.random() * 3.5 - fear * 1.2; }
    this.blink = Math.max(0, this.blink - dt * 7);
    const lidK = (this.blink > 0 ? Math.sin(this.blink * Math.PI) : 0) + (st === 'dead' ? 1 : 0) + (st === 'sit' ? .25 : 0);
    for (const lid of this.lids) lid.rotation.z = lerp(-.15, -1.45, clamp(lidK, 0, 1)) + fear * .25;
    for (const e of this.eyes) { e.iris.position.y = this.head.rotation.x * .0; e.iris.position.z = clamp(-this.S.headY.v * .01, -.008, .008); }
    // ================= SECONDAIRES =================
    // pans du manteau : ressort entraîné par l'accélération locale (inertie)
    const accL = new THREE.Vector3(this.acc.x * Math.cos(yaw) - this.acc.z * Math.sin(yaw), 0, this.acc.x * Math.sin(yaw) + this.acc.z * Math.cos(yaw));
    const hx = this.hem.x.step(clamp(-accL.x * .006 - hs * .022 * (moving ? 1 : 0), -.16, .16), dt), hz = this.hem.z.step(clamp(-accL.z * .006 + Math.sin(ph) * .015 * hs, -.1, .1), dt);
    if (this.skin) {
      this.skin.holder.scale.setScalar(this.skin.k * this.scaleGroup.scale.x / 1.15);
      this.skin.apply(this.S, this.glow, { dt, state: st, rootY: this.root.position.y, groundFn: a.groundFn, hs, vy: a.vy || 0, fear, ladderP: a.ladderP, climbT: a.climbT, lookYaw: this.lookYaw.v, lookPitch: this.lookPitch.v, bank: this.bankV, leanAdd: this.leanV });
    }
    const cp = this.coat.geometry.attributes.position, base = this.coatBase;
    if (!this.skin) {
    const legL = this.legs[0].hip.rotation.z, legR = this.legs[1].hip.rotation.z;
    for (let i = 0; i < cp.count; i++) {
      const y = base[i * 3 + 1] + .37, z0 = base[i * 3 + 2], w = Math.max(0, (.55 - y) / .38), w2 = w * w;
      const legPush = (z0 > 0 ? legL : legR) * .07 * w2; // les jambes poussent le tissu
      cp.array[i * 3] = base[i * 3] + (hx + legPush) * w2 + (st === 'air' ? -this.prevVel.y * .004 * w2 : 0);
      cp.array[i * 3 + 1] = base[i * 3 + 1] + (st === 'air' ? clamp(-a.vy * .01, -.04, .05) * w2 : 0);
      cp.array[i * 3 + 2] = z0 + hz * w2 * Math.sign(z0) * .5;
    }
    cp.needsUpdate = true; this.coat.geometry.computeVertexNormals();
    }
    // pompon & sac
    this.pomPivot.rotation.z = this.pom.x.step(clamp(accL.x * .01 + this.prevVel.y * -.02, -.6, .6), dt);
    this.pomPivot.rotation.x = this.pom.z.step(clamp(-accL.z * .01, -.5, .5), dt);
    this.packPivot.position.y = .05 + this.pack.step(clamp(-this.prevVel.y * .004 - (this.pelvis.position.y - .37) * .5, -.03, .03), dt);
    // lueur de l'écharpe
    const Mt = getMaterials();
    Mt.scarf.emissive.setRGB(.23 + this.glow * 1.8, .02 + this.glow * .35, .02 + this.glow * .1);
    this.root.updateMatrixWorld(true);
    this.updateCloth(dt, wind, a);
  }
  updateCloth(dt, wind, a) {
    const anchor = new THREE.Vector3(), tmp = new THREE.Vector3(), g = -9.8;
    const yaw = this.yawGroup.rotation.y;
    const back = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw)), side = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const sdt = Math.min(dt, 1 / 30);
    // avec le vrai modèle, l'écharpe s'accroche à l'os du cou animé (et suit l'orientation du buste)
    let neck = null;
    if (this.skin && this.skin.b.Neck) {
      const sk = this.skin, nb = sk.b.Neck, sp = sk.b.Spine2 || nb;
      neck = new THREE.Vector3(); nb.getWorldPosition(neck);
      const rootQ = new THREE.Quaternion(); sk.root.getWorldQuaternion(rootQ);
      const restW = rootQ.clone().multiply(sk.rest[sp === nb ? 'Neck' : 'Spine2'].model);
      const curW = new THREE.Quaternion(); sp.getWorldQuaternion(curW);
      const delta = curW.multiply(restW.invert());
      back.set(0, 0, -1).applyQuaternion(rootQ).applyQuaternion(delta).normalize();
      side.set(1, 0, 0).applyQuaternion(rootQ).applyQuaternion(delta).normalize();
    }
    for (const tl of this.tails) {
      if (neck) { anchor.copy(neck).addScaledVector(back, .085).addScaledVector(side, tl.off * .8); anchor.y -= .035; }
      else { this.scarfRing.getWorldPosition(anchor); anchor.addScaledVector(back, .11).addScaledVector(side, tl.off); anchor.y -= .03; }
      // si l'ancre a sauté (téléportation, réapparition), on replace le tissu au lieu de l'étirer
      if (tl.init && tl.pts[0].distanceTo(anchor) > .5) tl.init = false;
      if (!tl.init) { for (let i = 0; i < TAIL_N; i++) { tl.pts[i].copy(anchor).addScaledVector(back, i * tl.len * .6); tl.pts[i].y -= i * tl.len * .8; tl.old[i].copy(tl.pts[i]); } tl.init = true; }
      tl.pts[0].copy(anchor); tl.old[0].copy(anchor);
      for (let i = 1; i < TAIL_N; i++) {
        const p = tl.pts[i], o = tl.old[i];
        tmp.copy(p).sub(o).multiplyScalar(.965); o.copy(p); p.add(tmp);
        p.y += g * sdt * sdt * .55;
        const n = Math.sin(this.t * 6.1 + i * .8 + tl.off * 50) + Math.sin(this.t * 13.7 + i * 1.7) * .4;
        p.x += (wind * .25 + n * .12) * sdt * sdt * 28;
        p.addScaledVector(back, .35 * sdt * sdt * 28 * (i / TAIL_N));
        p.z += (Math.cos(this.t * 4.3 + i * 1.1) * .12) * sdt * sdt * 28;
        if (p.y < a.groundY + .01) p.y = a.groundY + .01;
      }
      for (let it = 0; it < 5; it++) for (let i = 1; i < TAIL_N; i++) {
        const p0 = tl.pts[i - 1], p1 = tl.pts[i];
        tmp.copy(p1).sub(p0); const d = tmp.length() || 1e-5; const diff = (d - tl.len) / d;
        if (i === 1) p1.addScaledVector(tmp, -diff); else { p0.addScaledVector(tmp, diff * .5); p1.addScaledVector(tmp, -diff * .5); }
      }
      // ruban orienté perpendiculairement au mouvement (largeur plus naturelle)
      const pos = tl.mesh.geometry.attributes.position.array;
      for (let i = 0; i < TAIL_N; i++) {
        const p = tl.pts[i], q = tl.pts[Math.min(TAIL_N - 1, i + 1)], r = tl.pts[Math.max(0, i - 1)];
        tmp.copy(q).sub(r); const dir = tmp.normalize();
        const wv = new THREE.Vector3().crossVectors(dir, side).normalize().multiplyScalar(.042 * (1 - i / TAIL_N * .25));
        if (!isFinite(wv.x)) wv.set(0, .042, 0);
        pos[i * 6] = p.x + wv.x; pos[i * 6 + 1] = p.y + wv.y; pos[i * 6 + 2] = p.z + wv.z;
        pos[i * 6 + 3] = p.x - wv.x; pos[i * 6 + 4] = p.y - wv.y; pos[i * 6 + 5] = p.z - wv.z;
      }
      if (!isFinite(pos[0] + pos[pos.length - 1])) { tl.init = false; continue; }
      tl.mesh.geometry.attributes.position.needsUpdate = true;
      tl.mesh.geometry.computeVertexNormals(); tl.mesh.geometry.computeBoundingSphere();
    }
  }
}
