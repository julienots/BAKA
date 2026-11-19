// MIO — modèle procédural, squelette et animation par poses mélangées + écharpe en tissu simulé
import * as THREE from 'three';
import { getMaterials } from '../core/materials.js';
import { hash, damp, clamp, lerp } from '../core/util.js';

const TAIL_N = 9;

export class MioModel {
  constructor() {
    const M = getMaterials();
    this.root = new THREE.Group();
    this.yawGroup = new THREE.Group(); this.root.add(this.yawGroup);
    const scale = new THREE.Group(); scale.scale.setScalar(1.15); this.yawGroup.add(scale);
    const body = this.body = new THREE.Group(); scale.add(body);
    this.scaleGroup = scale;
    const add = (geo, mat, parent = body, pos = [0, 0, 0], rot = [0, 0, 0], sc = [1, 1, 1]) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(...pos); m.rotation.set(...rot); m.scale.set(...sc);
      m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
    };
    // --- jambes
    this.legs = [];
    for (const side of [1, -1]) {
      const h = new THREE.Group(); h.position.set(0, .36, side * .065); body.add(h);
      add(new THREE.CapsuleGeometry(.038, .14, 4, 10), M.legs, h, [0, -.09, 0]);
      const k = new THREE.Group(); k.position.y = -.18; h.add(k);
      add(new THREE.CapsuleGeometry(.034, .12, 4, 10), M.legs, k, [0, -.08, 0]);
      const foot = new THREE.Group(); foot.position.y = -.165; k.add(foot);
      add(new THREE.SphereGeometry(.055, 14, 10), M.boot, foot, [.03, 0, 0], [0, 0, 0], [1.45, .7, 1]);
      this.legs.push({ hip: h, knee: k, foot });
    }
    // --- manteau (tour évasé avec plis)
    const prof = [[.0, .80], [.11, .79], [.14, .74], [.155, .6], [.18, .45], [.215, .3], [.235, .2], [.225, .19]];
    const coatGeo = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 32);
    const p = coatGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x);
      const fold = 1 + Math.sin(a * 7 + 1.3) * .045 * (0.8 - y) * 1.6 + Math.sin(a * 13) * .015;
      p.setXYZ(i, x * fold, y, z * fold * .88);
    }
    coatGeo.computeVertexNormals();
    this.coatBase = coatGeo.attributes.position.array.slice();
    this.coat = add(coatGeo, M.coat);
    add(new THREE.TorusGeometry(.105, .03, 8, 24), M.coat, body, [0, .79, 0], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 3; i++) add(new THREE.SphereGeometry(.012, 8, 6), M.boot, body, [.16 + i * .012, .66 - i * .11, 0]);
    // --- bras
    this.arms = [];
    for (const side of [1, -1]) {
      const s = new THREE.Group(); s.position.set(0, .74, side * .135); body.add(s);
      add(new THREE.CapsuleGeometry(.042, .14, 4, 10), M.coat, s, [0, -.09, 0]);
      const e = new THREE.Group(); e.position.y = -.18; s.add(e);
      add(new THREE.CapsuleGeometry(.04, .1, 4, 10), M.coat, e, [0, -.06, 0]);
      const hand = add(new THREE.SphereGeometry(.032, 12, 10), M.skin, e, [0, -.15, 0], [0, 0, 0], [1, 1.2, .8]);
      this.arms.push({ sh: s, el: e, side, hand });
    }
    // --- tête
    const head = this.head = new THREE.Group(); head.position.set(.01, .99, 0); body.add(head);
    add(new THREE.SphereGeometry(.2, 32, 24), M.skin, head, [0, 0, 0], [0, 0, 0], [1, 1.02, .96]);
    add(new THREE.SphereGeometry(.208, 28, 20, 0, Math.PI * 2, 0, Math.PI * .58), M.hair, head, [-.01, 0, 0], [0, 0, .35]);
    for (const s of [-1, 1]) add(new THREE.SphereGeometry(.06, 12, 10), M.hair, head, [.08, -.06, s * .16], [0, 0, 0], [1, 1.6, .6]);
    add(new THREE.SphereGeometry(.222, 32, 20, 0, Math.PI * 2, 0, Math.PI * .5), M.knit, head, [-.01, .045, 0], [0, 0, .18], [1, 1.05, 1]);
    add(new THREE.TorusGeometry(.212, .038, 10, 36), M.knit, head, [-.005, .05, 0], [Math.PI / 2, .18, 0]);
    const pom = new THREE.SphereGeometry(.072, 18, 14), pp = pom.attributes.position;
    for (let i = 0; i < pp.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(pp, i); v.multiplyScalar(1 + (hash(v.x * 90, v.y * 90 + v.z * 40) - .5) * .25); pp.setXYZ(i, v.x, v.y, v.z); }
    pom.computeVertexNormals();
    this.pom = add(pom, M.knit, head, [-.07, .29, 0]);
    this.eyes = [];
    for (const s of [-1, 1]) {
      this.eyes.push(add(new THREE.SphereGeometry(.03, 16, 12), M.eye, head, [.178, -.02, s * .075], [0, 0, 0], [.6, 1.25, 1]));
      add(new THREE.SphereGeometry(.005, 8, 6), M.eyeShine, head, [.192, -.004, s * .068]);
    }
    add(new THREE.SphereGeometry(.012, 8, 6), M.skin, head, [.2, -.07, 0]);
    // --- écharpe
    this.scarfRing = add(new THREE.TorusGeometry(.115, .042, 10, 28), M.scarf, body, [0, .815, 0], [Math.PI / 2, 0, 0], [1, 1, 1.2]);
    // --- sac à dos
    const pack = add(new THREE.BoxGeometry(.14, .2, .2, 3, 3, 3), M.leather, body, [-.16, .6, 0]);
    { const a = pack.geometry.attributes.position; for (let i = 0; i < a.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(a, i); const l = v.length(); v.normalize().multiplyScalar(l * .8 + .02); a.setXYZ(i, v.x * 1.1, v.y * 1.2, v.z * 1.15); } pack.geometry.computeVertexNormals(); }
    add(new THREE.TorusGeometry(.12, .012, 6, 20, Math.PI), M.leather, body, [-.04, .66, .1], [0, 0, 1.9]);
    // --- pans d'écharpe : chaînes verlet en espace monde
    this.tails = [0, 1].map(k => {
      const pts = [], old = [];
      for (let i = 0; i < TAIL_N; i++) { pts.push(new THREE.Vector3()); old.push(new THREE.Vector3()); }
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(TAIL_N * 2 * 3), uv = new Float32Array(TAIL_N * 2 * 2), idx = [];
      for (let i = 0; i < TAIL_N; i++) { uv.set([i / (TAIL_N - 1), 0, i / (TAIL_N - 1), 1], i * 4); if (i < TAIL_N - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx);
      const mesh = new THREE.Mesh(geo, M.scarf); mesh.castShadow = true; mesh.frustumCulled = false;
      return { pts, old, mesh, len: k ? .042 : .052, init: false, off: k ? -.05 : .05 };
    });
    // carry (objet porté)
    this.carrySlot = new THREE.Group(); this.carrySlot.position.set(.2, .55, 0); body.add(this.carrySlot);
    this.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    // état d'animation
    this.phase = 0; this.t = 0; this.blink = 0; this.pose = {};
    this.glow = 0;
  }
  addTo(scene) { scene.add(this.root); for (const t of this.tails) scene.add(t.mesh); }
  removeFrom(scene) { scene.remove(this.root); for (const t of this.tails) scene.remove(t.mesh); }
  resetCloth() { for (const t of this.tails) t.init = false; }

  // a : { state, speed(0..1 run), vx, vy, grounded, push, climbT, crouch, fear, carry, cast, latch, dead, landT, facing, lane }
  animate(dt, a, wind = 0) {
    this.t += dt;
    const P = {};
    const sp = a.speed || 0;
    this.phase += dt * (a.state === 'push' ? 4.2 : 5.5 + sp * 6) * Math.min(1, sp * 2.5 + (a.state === 'push' && Math.abs(a.vx) > .05 ? 1 : 0));
    const ph = this.phase, s = Math.sin(ph), c = Math.cos(ph);
    // pose de base : respiration
    const breath = Math.sin(this.t * (2.2 + a.fear * 3)) * (.012 + a.fear * .01);
    P.lean = 0; P.bodyY = breath; P.hipL = 0; P.hipR = 0; P.kneeL = -.05; P.kneeR = -.05;
    P.shL = .08; P.shR = -.05; P.elL = -.2; P.elR = -.2; P.armOut = .12; P.headP = 0; P.headY = 0; P.headR = 0; P.squash = 1;
    switch (a.state) {
      case 'idle': {
        P.headY = Math.sin(this.t * .4) * .25 * (1 - a.fear); P.headP = Math.sin(this.t * .3) * .05;
        P.shL = .05 + breath * 2; P.shR = -.03 - breath * 2;
        if (a.fear > .3) { P.lean = .08; P.shL = .6; P.shR = .5; P.elL = -1.6; P.elR = -1.5; P.headP = -.15; P.bodyY -= .02; P.kneeL = P.kneeR = -.2; P.hipL = P.hipR = .1; }
        break;
      }
      case 'move': {
        const amp = lerp(.38, .62, sp);
        P.hipL = s * amp; P.hipR = -s * amp;
        P.kneeL = -Math.max(0, -c) * (.5 + sp * .7) - .08; P.kneeR = -Math.max(0, c) * (.5 + sp * .7) - .08;
        P.shL = -s * (.35 + sp * .55); P.shR = s * (.35 + sp * .55);
        P.elL = -.3 - sp * .9; P.elR = -.3 - sp * .9;
        P.lean = -.05 - sp * .2; P.bodyY = Math.abs(c) * (.025 + sp * .03) - .01 * sp + breath;
        P.headP = -P.lean * .5; P.headR = s * .03;
        break;
      }
      case 'push': {
        const m = Math.abs(a.vx) > .05 || Math.abs(a.vz) > .05;
        P.lean = -.42; P.bodyY = -.05;
        P.hipL = .55 + (m ? s * .25 : 0); P.hipR = -.7 + (m ? -s * .25 : 0); P.kneeL = -.2 - (m ? Math.max(0, -c) * .4 : 0); P.kneeR = -.25 - (m ? Math.max(0, c) * .4 : 0);
        P.shL = 1.55; P.shR = 1.4; P.elL = -.15; P.elR = -.3; P.headP = .25; P.armOut = .05;
        break;
      }
      case 'pull': {
        P.lean = .3; P.hipL = .3; P.hipR = -.5; P.kneeL = -.4; P.kneeR = -.2; P.shL = 1.3; P.shR = 1.2; P.elL = -.3; P.elR = -.3; P.bodyY = -.04;
        break;
      }
      case 'air': {
        const up = clamp(a.vy / 5, -1, 1);
        P.hipL = .5 + up * .2; P.hipR = -.25; P.kneeL = -.9; P.kneeR = -.3 - (1 - up) * .2;
        P.shL = up > 0 ? 1.8 : 1.1; P.shR = up > 0 ? 1.2 : 1.5; P.armOut = .4 + (1 - up) * .2; P.elL = -.4; P.elR = -.6;
        P.lean = -.1; P.headP = -up * .1;
        break;
      }
      case 'climb': {
        const t = a.climbT;
        // accroche → traction → genou → redressement
        P.shL = lerp(2.8, .6, t); P.shR = lerp(2.7, .5, t); P.elL = lerp(-.2, -1.2, Math.sin(t * Math.PI)); P.elR = P.elL;
        P.hipL = lerp(.2, 1.3, Math.sin(t * Math.PI)); P.kneeL = -lerp(.3, 1.6, Math.sin(t * Math.PI)); P.hipR = lerp(-.1, -.3, t); P.kneeR = -.3;
        P.lean = lerp(-.1, -.5, Math.sin(t * Math.PI)); P.headP = -.2;
        break;
      }
      case 'crouch': {
        P.bodyY = -.17; P.hipL = 1.1; P.hipR = .9; P.kneeL = -2.0; P.kneeR = -1.9; P.lean = -.25; P.shL = .7; P.shR = .6; P.elL = -1.4; P.elR = -1.3; P.headP = .1;
        if (Math.abs(a.vx) > .05 || Math.abs(a.vz) > .05) { P.hipL += s * .3; P.hipR -= s * .3; }
        break;
      }
      case 'latch': {
        P.shL = 1.6 + Math.sin(this.t * 22) * .08; P.shR = 1.9 + Math.cos(this.t * 20) * .08; P.elL = -.5; P.elR = -.3; P.lean = -.2; P.hipL = .2; P.hipR = -.3; P.kneeL = -.2; P.kneeR = -.2;
        P.headP = Math.sin(this.t * 7) * .05 - .1; P.headY = Math.sin(this.t * 3) * .5 * a.fear;
        break;
      }
      case 'carry': {
        const amp = .35 * sp + .1 * (sp > 0);
        P.hipL = s * amp; P.hipR = -s * amp; P.kneeL = -Math.max(0, -c) * .5 - .08; P.kneeR = -Math.max(0, c) * .5 - .08;
        P.shL = 1.2; P.shR = 1.1; P.elL = -1.0; P.elR = -1.0; P.lean = .05; P.bodyY = Math.abs(c) * .02 * (sp > 0) + breath;
        break;
      }
      case 'cast': {
        const k = a.castK || 0;
        P.shL = 1.4 + k * .4; P.shR = 1.3 + k * .3; P.elL = -.2; P.elR = -.3; P.armOut = .5 * k; P.lean = .1 - k * .2; P.headP = -.15;
        P.hipL = .25; P.hipR = -.3; P.kneeL = -.25; P.kneeR = -.15; P.bodyY = -.02;
        break;
      }
      case 'release': {
        P.shL = 1.9; P.shR = 1.8; P.elL = -.1; P.elR = -.1; P.lean = .05; P.headP = -.3; P.armOut = .25;
        break;
      }
      case 'sit': {
        P.bodyY = -.32; P.hipL = 1.5; P.hipR = 1.5; P.kneeL = -1.5; P.kneeR = -1.5; P.shL = .4; P.shR = .4; P.elL = -.8; P.elR = -.8; P.headP = .25; P.lean = .05;
        break;
      }
      case 'dead': {
        P.bodyY = -.36; P.lean = -1.35; P.hipL = .2; P.hipR = -.1; P.kneeL = -.3; P.kneeR = -.5; P.shL = 2.6; P.shR = 2.2; P.elL = -.2; P.elR = -.1; P.headP = .3;
        break;
      }
      case 'wake': {
        const t = a.wakeT; // 0 couché -> 1 debout
        P.bodyY = lerp(-.36, 0, t); P.lean = lerp(-1.4, 0, Math.min(1, t * 1.3)); P.hipL = lerp(1.4, 0, t); P.hipR = lerp(1.2, 0, t); P.kneeL = lerp(-1.6, -.05, t); P.kneeR = lerp(-1.7, -.05, t);
        P.shL = lerp(2.0, .1, t); P.shR = lerp(.9, 0, t); P.elL = -.5; P.elR = -.8; P.headP = lerp(.4, 0, t); P.headY = Math.sin(t * 9) * .3 * t;
        break;
      }
    }
    // atterrissage : écrasement
    if (a.landT > 0) { const k = a.landT; P.bodyY -= .09 * k; P.kneeL -= .7 * k; P.kneeR -= .7 * k; P.hipL += .4 * k; P.hipR += .4 * k; P.lean -= .15 * k; }
    // tremblement de peur
    if (a.fear > .2) { const tr = (a.fear - .2) * .025; P.headR += (Math.random() - .5) * tr; P.shL += (Math.random() - .5) * tr * 2; P.shR += (Math.random() - .5) * tr * 2; }
    // lissage des articulations
    const k = a.state === 'dead' ? 6 : a.state === 'climb' ? 22 : 14;
    for (const n in P) this.pose[n] = this.pose[n] === undefined ? P[n] : damp(this.pose[n], P[n], k, dt);
    const Q = this.pose;
    this.body.rotation.z = Q.lean; this.body.position.y = Q.bodyY;
    this.legs[0].hip.rotation.z = Q.hipL; this.legs[0].knee.rotation.z = Q.kneeL; this.legs[0].foot.rotation.z = -Q.kneeL * .3 - Q.hipL * .3;
    this.legs[1].hip.rotation.z = Q.hipR; this.legs[1].knee.rotation.z = Q.kneeR; this.legs[1].foot.rotation.z = -Q.kneeR * .3 - Q.hipR * .3;
    this.arms[0].sh.rotation.set(Q.armOut * .5 + .1, 0, Q.shL); this.arms[0].el.rotation.z = Q.elL;
    this.arms[1].sh.rotation.set(-Q.armOut * .5 - .1, 0, Q.shR); this.arms[1].el.rotation.z = Q.elR;
    this.head.rotation.set(Q.headR, Q.headY, Q.headP * -1);
    // clignement des yeux
    this.blink -= dt; let eyeS = 1.25;
    if (this.blink < 0) { if (this.blink < -.12) this.blink = 2 + Math.random() * 3; else eyeS = .12; }
    for (const e of this.eyes) e.scale.y = eyeS * (1 + a.fear * .15);
    // pompon qui ballotte
    this.pom.position.y = .29 + Math.sin(ph * 2) * .006 * sp; this.pom.position.x = -.07 - Math.abs(a.vx) * .004;
    // manteau : balancement des pans selon la vitesse
    const cp = this.coat.geometry.attributes.position, base = this.coatBase, swing = clamp(-a.vxLocal * .05, -.12, .12), flap = Math.sin(ph * 2) * .015 * sp;
    for (let i = 0; i < cp.count; i++) {
      const y = base[i * 3 + 1], w = Math.max(0, (.55 - y) / .36);
      cp.array[i * 3] = base[i * 3] + (swing + flap) * w * w;
      cp.array[i * 3 + 2] = base[i * 3 + 2] * (1 + Math.sin(ph + y * 10) * .02 * sp * w);
    }
    cp.needsUpdate = true;
    // lueur de l'écharpe
    const M = getMaterials();
    M.scarf.emissive.setRGB(.23 + this.glow * 1.8, .02 + this.glow * .35, .02 + this.glow * .1);
    this.root.updateMatrixWorld(true);
    this.updateCloth(dt, wind, a);
  }
  updateCloth(dt, wind, a) {
    const anchor = new THREE.Vector3(), tmp = new THREE.Vector3(), g = -9.8;
    const yaw = this.yawGroup.rotation.y;
    const back = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
    const side = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const sdt = Math.min(dt, 1 / 30);
    for (const tl of this.tails) {
      // point d'attache : arrière du cou
      this.scarfRing.getWorldPosition(anchor);
      anchor.addScaledVector(back, .1).addScaledVector(side, tl.off);
      anchor.y -= .03;
      if (!tl.init) { for (let i = 0; i < TAIL_N; i++) { tl.pts[i].copy(anchor).addScaledVector(back, i * tl.len).y -= i * tl.len * .4; tl.old[i].copy(tl.pts[i]); } tl.init = true; }
      tl.pts[0].copy(anchor); tl.old[0].copy(anchor);
      const flutter = (.8 + Math.abs(a.vx || 0) * .25);
      for (let i = 1; i < TAIL_N; i++) {
        const p = tl.pts[i], o = tl.old[i];
        tmp.copy(p).sub(o).multiplyScalar(.96);
        o.copy(p);
        p.add(tmp);
        p.y += g * sdt * sdt * .6;
        const n = Math.sin(this.t * 7.3 + i * .9 + tl.off * 40) * flutter;
        p.x += (wind * .9 + n * .25) * sdt * sdt * 30;
        p.z += Math.cos(this.t * 5.1 + i) * .2 * sdt * sdt * 30;
        if (p.y < a.groundY + .01) p.y = a.groundY + .01;
      }
      for (let it = 0; it < 4; it++) for (let i = 1; i < TAIL_N; i++) {
        const p0 = tl.pts[i - 1], p1 = tl.pts[i];
        tmp.copy(p1).sub(p0); const d = tmp.length() || 1e-5; const diff = (d - tl.len) / d;
        if (i === 1) p1.addScaledVector(tmp, -diff); else { p0.addScaledVector(tmp, diff * .5); p1.addScaledVector(tmp, -diff * .5); }
      }
      // ruban
      const pos = tl.mesh.geometry.attributes.position.array;
      for (let i = 0; i < TAIL_N; i++) {
        const p = tl.pts[i], w = .04 * (1 - i / TAIL_N * .3);
        pos[i * 6] = p.x; pos[i * 6 + 1] = p.y + w; pos[i * 6 + 2] = p.z;
        pos[i * 6 + 3] = p.x; pos[i * 6 + 4] = p.y - w; pos[i * 6 + 5] = p.z;
      }
      tl.mesh.geometry.attributes.position.needsUpdate = true;
      tl.mesh.geometry.computeVertexNormals();
      tl.mesh.geometry.computeBoundingSphere();
    }
  }
}
