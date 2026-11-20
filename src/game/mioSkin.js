// Mio « réel » : modèle 3D créé avec Tripo (GLB riggé Mixamo).
// Le squelette procédural de mio.js continue de calculer toutes les poses (ressorts, foulée, escalade…) ;
// ce module les retransmet chaque image sur les os Mixamo du modèle.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const URL = './models/mio_anim.glb';
let cache = null, promise = null;
export function loadMioSkin() {
  if (!promise) promise = new GLTFLoader().loadAsync(URL).then(g => { cache = g; return g; }).catch(e => { console.warn('Modèle Mio indisponible, version procédurale utilisée', e); return null; });
  return promise;
}
export function mioSkinReady() { return cache; }

const AX = { X: new THREE.Vector3(1, 0, 0), nX: new THREE.Vector3(-1, 0, 0), Y: new THREE.Vector3(0, 1, 0), Z: new THREE.Vector3(0, 0, 1) };
const qa = (axis, ang) => new THREE.Quaternion().setFromAxisAngle(axis, ang);
const HEIGHT = 1.42; // taille de Mio dans le monde (m)

export class MioSkin {
  constructor(gltf) {
    this.root = SkeletonUtils.clone(gltf.scene);
    // le modèle Tripo regarde +Z : on le tourne pour qu'il regarde +X comme le squelette procédural
    const box = new THREE.Box3().setFromObject(this.root); const h = box.max.y - box.min.y || 1;
    this.k = HEIGHT / h;
    this.holder = new THREE.Group(); this.holder.rotation.y = Math.PI / 2; this.holder.scale.setScalar(this.k); this.holder.add(this.root);
    this.root.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
        const m = o.material; if (m) { m.envMapIntensity = .6; if (m.roughness !== undefined) m.roughness = Math.max(.55, m.roughness); }
      }
    });
    // os et poses de repos (dans le repère du modèle)
    this.b = {};
    this.root.traverse(o => { if (o.isBone) this.b[o.name.replace(/^mixamorig[:_]?/, '')] = o; });
    this.root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    this.rest = {};
    for (const n in this.b) {
      const bone = this.b[n], mw = new THREE.Matrix4().multiplyMatrices(inv, bone.matrixWorld), q = new THREE.Quaternion();
      mw.decompose(new THREE.Vector3(), q, new THREE.Vector3());
      this.rest[n] = { local: bone.quaternion.clone(), model: q, pos: bone.position.clone() };
    }
    const hips = this.b.Hips;
    if (hips && hips.parent) { const s = new THREE.Vector3(); const pm = new THREE.Matrix4().multiplyMatrices(inv, hips.parent.matrixWorld); pm.decompose(new THREE.Vector3(), new THREE.Quaternion(), s); this.hipScale = s.y || 1; } else this.hipScale = 1;
    this.tmp = new THREE.Quaternion();
    // hauteur de la cheville au repos (pour poser les pieds pile sur le sol)
    const fl = this.b.LeftFoot; if (fl) { const wp = new THREE.Vector3(); fl.getWorldPosition(wp); wp.applyMatrix4(inv); this.ankle0 = wp.y - box.min.y; } else this.ankle0 = .08;
    this.legState = { Left: { lock: null, step: null, w: 0 }, Right: { lock: null, step: null, w: 0 } };
    this.ikW = 0; this.hipDrop = 0;
    this.V = Array.from({ length: 10 }, () => new THREE.Vector3()); this.Q = Array.from({ length: 6 }, () => new THREE.Quaternion());
    this.setupClips(gltf.animations);
  }
  // applique une rotation exprimée dans le repère du personnage (X = gauche, Y = haut, Z = avant)
  set(name, qModel) {
    const bone = this.b[name], r = this.rest[name]; if (!bone) return;
    // q_local = repos_local · (repos_modèle⁻¹ · q · repos_modèle)
    this.tmp.copy(r.model).invert().multiply(qModel).multiply(r.model);
    bone.quaternion.copy(r.local).multiply(this.tmp);
  }
  // ------------------------------------------------------------------ animations capturées (Tripo / Mixamo)
  setupClips(clips) {
    if (!clips || !clips.length) return;
    this.mixer = new THREE.AnimationMixer(this.root); this.acts = {}; this.w = {};
    for (const c of clips) {
      const name = c.name.replace(/\.\d+$/, '');
      // on garde les rotations + la translation du bassin (pas d'échelle, pas de dérive des autres os)
      const tracks = c.tracks.filter(t => t.name.endsWith('.quaternion') || (/Hips\.position$/.test(t.name)));
      const clip = new THREE.AnimationClip(name, c.duration, tracks);
      const a = this.mixer.clipAction(clip); a.play(); a.setEffectiveWeight(0); a.enabled = true;
      this.acts[name] = a; this.w[name] = 0;
    }
    // vitesse « au sol » de chaque animation de déplacement → lecture calée sur la vitesse réelle (pieds sans glissement)
    this.locoSpeed = {};
    for (const n of ['walk', 'run', 'flee_01']) if (this.acts[n]) this.locoSpeed[n] = this.measureSpeed(this.acts[n]);
    for (const n in this.acts) { const a = this.acts[n]; a.setEffectiveWeight(0); }
    this.phase = 0; this.procW = 1; this.deadT = 0; this.prevState = '';
  }
  measureSpeed(action) {
    const foot = this.b.LeftFoot, hips = this.b.Hips; if (!foot || !hips) return 1;
    for (const n in this.acts) this.acts[n].setEffectiveWeight(n === action.getClip().name ? 1 : 0);
    const dur = action.getClip().duration, N = 90, pts = [];
    const inv = new THREE.Matrix4(); const p = new THREE.Vector3();
    for (let i = 0; i <= N; i++) {
      for (const n in this.acts) this.acts[n].time = i / N * dur;
      this.mixer.update(0); this.root.updateMatrixWorld(true);
      inv.copy(this.root.matrixWorld).invert(); foot.getWorldPosition(p); p.applyMatrix4(inv);
      pts.push({ y: p.y, z: p.z });
    }
    const minY = Math.min(...pts.map(q => q.y)); const v = [];
    for (let i = 1; i < pts.length; i++) if (pts[i].y < minY + .025 && pts[i - 1].y < minY + .025) v.push(-(pts[i].z - pts[i - 1].z) / (dur / N));
    v.sort((a, b) => a - b); const med = v.length ? v[Math.floor(v.length / 2)] : 0;
    return Math.max(.2, Math.abs(med)) * this.k; // m/s dans le monde
  }
  // choix et fondu des animations selon l'état du jeu
  driveClips(ctx) {
    const dt = Math.min(ctx.dt || 1 / 60, 1 / 20), st = ctx.state, A = this.acts, T = {};
    const has = n => !!A[n];
    let proc = 0;
    if (st === 'idle') { if (ctx.fear > .35 && has('scared_01')) T.scared_01 = 1; else T.idle = 1; }
    else if (st === 'move' || st === 'carry') {
      const sp = ctx.hs || 0, panic = ctx.fear > .45 && has('flee_01');
      const wr = Math.min(1, Math.max(0, (sp - 1.6) / 1.0));
      if (sp < .3) { T.idle = 1 - sp / .3; T.walk = sp / .3; } else { T.walk = 1 - wr; T[panic ? 'flee_01' : 'run'] = wr; }
      // phase commune avancée selon la distance parcourue (vitesses de référence des animations, calibrées)
      const cyc = n => A[n].getClip().duration, REF = { walk: .75, run: 2.6, flee_01: 2.4 };
      const rn = panic ? 'flee_01' : 'run';
      const rW = Math.min(2, Math.max(.55, sp / REF.walk)), rR = Math.min(1.55, Math.max(.7, sp / REF[rn]));
      const rate = (1 - wr) * rW / cyc('walk') + wr * rR / cyc(rn);
      this.phase = (this.phase + dt * Math.max(rate, .1)) % 1;
      for (const n of ['walk', 'run', 'flee_01']) if (A[n]) A[n].time = this.phase * cyc(n);
      if (st === 'carry') proc = 0; // bras gérés par le masque « porter »
    }
    else if (st === 'air') { if (ctx.vy > .8 && has('jump')) { T.jump = 1; A.jump.time = A.jump.getClip().duration * .38; } else T[has('fall') ? 'fall' : 'jump'] = 1; }
    else if (st === 'climb' && has('climb') && window.__climbClip) { T.climb = 1; A.climb.time = Math.min(.999, ctx.climbT || 0) * A.climb.getClip().duration; }
    else if (st === 'dead' && has('defeat_02')) { if (this.prevState !== 'dead') { A.defeat_02.time = 0; } T.defeat_02 = 1; }
    else proc = 1; // pousser, s'accroupir, escalader un rebord, se suspendre, lancer un pouvoir… : squelette procédural
    this.prevState = st;
    // poids normalisés, fondus doux
    let sum = 0; for (const n in T) sum += T[n];
    for (const n in A) {
      const tgt = sum > 0 ? (T[n] || 0) / sum : 0;
      this.w[n] += (tgt - this.w[n]) * Math.min(1, dt * 9);
      if (tgt === 0 && this.w[n] < .002) this.w[n] = 0;
    }
    let tot = 0; for (const n in A) tot += this.w[n];
    for (const n in A) A[n].setEffectiveWeight(tot > 0 ? this.w[n] / tot : 0);
    // clips à vitesse propre (repos, chute, mort, peur) : le mixeur avance ; les autres sont pilotés à la main
    for (const n of ['idle', 'fall', 'scared_01', 'look_around', 'defeat_02', 'lift_heavy']) if (A[n]) A[n].timeScale = 1;
    for (const n of ['walk', 'run', 'flee_01', 'jump', 'climb']) if (A[n]) A[n].timeScale = 0;
    if (A.defeat_02 && A.defeat_02.time > A.defeat_02.getClip().duration - .05) A.defeat_02.time = A.defeat_02.getClip().duration - .05;
    this.mixer.update(dt);
    this.procW += (proc - this.procW) * Math.min(1, dt * 10);
    if (tot === 0) this.procW = 1;
  }
  apply(S, glow, ctx) {
    if (!this.mixer || !ctx) { this.applyFK(S); this.finish(S, ctx); return; }
    this.driveClips(ctx);
    const pw = this.procW;
    if (pw > .002) {
      // pose capturée → mémorisée, pose procédurale → calculée, puis mélange os par os
      if (!this.bonesArr) this.bonesArr = Object.values(this.b);
      const cq = this.bonesArr.map(b => b.quaternion.clone()), hp = this.b.Hips ? this.b.Hips.position.clone() : null;
      this.applyFK(S);
      this.bonesArr.forEach((b, i) => { if (pw < .998) b.quaternion.copy(cq[i].slerp(b.quaternion, pw)); });
      if (hp && pw < .998) this.b.Hips.position.copy(hp.lerp(this.b.Hips.position, pw));
    } else if (ctx.state === 'carry') {
      // porter : bras procéduraux sur une marche capturée
      const arms = ['LeftArm', 'LeftForeArm', 'RightArm', 'RightForeArm'].map(n => this.b[n]).filter(Boolean);
      this.applyFK(S, true);
    }
    // couches additives : regard, inclinaison dans les virages, penché à l'accélération
    if (pw < .999) {
      const k = 1 - pw;
      const H = this.b.Head, S2 = this.b.Spine2, HP = this.b.Hips;
      if (H) H.quaternion.multiply(this.addLocal('Head', qa(AX.Y, (ctx.lookYaw || 0) * .8 * k).multiply(qa(AX.nX, -(ctx.lookPitch || 0) * .6 * k))));
      if (S2) S2.quaternion.multiply(this.addLocal('Spine2', qa(AX.Y, (ctx.lookYaw || 0) * .2 * k)));
      if (HP) HP.quaternion.multiply(this.addLocal('Hips', qa(AX.Z, (ctx.bank || 0) * k).multiply(qa(AX.nX, (ctx.leanAdd || 0) * k))));
    }
    this.finish(S, ctx);
  }
  // rotation exprimée dans le repère du personnage → rotation locale additive de l'os
  addLocal(name, qModel) { const r = this.rest[name]; return this.tmp.copy(r.model).invert().multiply(qModel).multiply(r.model).clone(); }
  // S : ressorts du squelette procédural (valeurs .v)
  applyFK(S, armsOnly = false) {
    const v = n => (S[n] ? S[n].v : 0);
    if (armsOnly) {
      for (const [side, s, sg] of [['Left', 'L', 1], ['Right', 'R', -1]]) {
        const down = qa(AX.Z, sg * (-Math.PI / 2 + .14 + v('shOut' + s) * .9));
        this.set(side + 'Arm', qa(AX.nX, v('sh' + s)).multiply(down));
        this.set(side + 'ForeArm', qa(AX.Y, -sg * Math.abs(Math.min(0, v('el' + s)))));
      }
      return;
    }
    // bassin : hauteur, balancement latéral, roulis, torsion
    const hips = this.b.Hips, hr = this.rest.Hips;
    if (hips) {
      hips.position.copy(hr.pos);
      hips.position.y += v('pelY') * 1.15 / this.k / this.hipScale;
      hips.position.x += v('side') * 1.15 / this.k / this.hipScale;
      this.set('Hips', qa(AX.Y, v('pelTwist')).multiply(qa(AX.Z, v('pelRoll'))));
    }
    // colonne : inclinaison avant/arrière répartie sur 3 vertèbres + contre-rotation des épaules
    const lean = v('lean'), twist = v('chestTwist');
    for (const [n, k] of [['Spine', .35], ['Spine1', .35], ['Spine2', .3]]) this.set(n, qa(AX.Y, twist * k).multiply(qa(AX.nX, lean * k + (n === 'Spine2' ? v('chestPitch') : 0))));
    // tête et cou
    this.set('Neck', qa(AX.nX, -v('neckP') * .3));
    this.set('Head', qa(AX.Y, v('headY')).multiply(qa(AX.Z, v('headR'))).multiply(qa(AX.nX, -v('headP'))));
    // jambes : hanche (avant/arrière + écart), genou, cheville
    for (const [side, s] of [['Left', 'L'], ['Right', 'R']]) {
      const out = v('hipOut' + s) * (side === 'Left' ? 1 : -1);
      this.set(side + 'UpLeg', qa(AX.nX, v('hip' + s)).multiply(qa(AX.Z, out)));
      this.set(side + 'Leg', qa(AX.nX, Math.min(0, v('knee' + s))));
      this.set(side + 'Foot', qa(AX.nX, v('ank' + s) * .6));
    }
    // bras : la pose de repos Mixamo est en T ; on les abaisse le long du corps puis on applique les mouvements
    for (const [side, s, sg] of [['Left', 'L', 1], ['Right', 'R', -1]]) {
      const down = qa(AX.Z, sg * (-Math.PI / 2 + .14 + v('shOut' + s) * .9));
      this.set(side + 'Arm', qa(AX.nX, v('sh' + s)).multiply(down));
      const flex = Math.abs(Math.min(0, v('el' + s)));
      this.set(side + 'ForeArm', qa(AX.Y, -sg * flex));
      // doigts : prise selon l'état (escalade, poussée, course)
      const g = Math.max(0, Math.min(1.2, v('grip' + s)));
      for (const f of ['Index', 'Middle', 'Ring', 'Pinky']) for (let i = 1; i <= 3; i++) this.set(`${side}Hand${f}${i}`, qa(AX.Z, -sg * g * (i === 1 ? .55 : .75)));
      for (let i = 2; i <= 3; i++) this.set(`${side}HandThumb${i}`, qa(AX.Y, -sg * g * .35));
    }
  }
  finish(S, ctx) {
    if (ctx) {
      // sauvegarde de la pose avant IK : si un calcul dégénère (NaN), on la restaure → jamais de triangle fou à l'écran
      const legs = ['Hips', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'].map(n => this.b[n]).filter(Boolean);
      const saved = legs.map(b => [b.quaternion.clone(), b.position.clone()]);
      try { this.legIK(ctx); } catch (e) { /* on garde la pose sans IK */ }
      const bad = legs.some(b => !isFinite(b.quaternion.x + b.quaternion.y + b.quaternion.z + b.quaternion.w + b.position.x + b.position.y + b.position.z));
      if (bad) { legs.forEach((b, i) => { b.quaternion.copy(saved[i][0]); b.position.copy(saved[i][1]); }); for (const k in this.legState) { this.legState[k].lock = null; this.legState[k].step = null; } this.hipDrop = 0; }
    }
  }
  // ------------------------------------------------------------------ IK des jambes
  // Les pieds se posent exactement sur le sol (marches, pentes, caisses), restent verrouillés pendant l'appui
  // (aucun glissement), et Mio fait de petits pas de réajustement quand il pivote sur place.
  legIK(ctx) {
    const dt = Math.min(ctx.dt || 1 / 60, 1 / 20), on = IK_STATES.has(ctx.state);
    this.ikW += ((on ? 1 : 0) - this.ikW) * Math.min(1, dt * 12);
    const allowLock = !this.mixer || this.procW > .5 || ctx.state === 'idle';
    if (this.ikW < .02) { for (const k in this.legState) { this.legState[k].lock = null; this.legState[k].step = null; } this.hipDrop = 0; return; }
    const hips = this.b.Hips; if (!hips) return;
    const sc = this.holder.scale.x, ankleH = this.ankle0 * sc, rootY = ctx.rootY;
    this.holder.updateWorldMatrix(true, true);
    const [a, bk, c, t, d1, d2, d3] = this.V;
    const tg = {};
    let drop = 0;
    for (const side of ['Left', 'Right']) {
      const up = this.b[side + 'UpLeg'], low = this.b[side + 'Leg'], foot = this.b[side + 'Foot']; if (!up || !low || !foot) return;
      up.getWorldPosition(a); low.getWorldPosition(bk); foot.getWorldPosition(c);
      let gy = ctx.groundFn ? ctx.groundFn(c.x, c.z, rootY + .45) : rootY; if (!isFinite(gy) || gy < rootY - .6) gy = rootY;
      const L = this.legState[side];
      const target = new THREE.Vector3(c.x, Math.max(c.y + (gy - rootY), gy + ankleH), c.z);
      const planted = c.y - rootY - ankleH < .035;
      if (L.step) {
        L.step.t += dt / .2; const k = Math.min(1, L.step.t), e = k * k * (3 - 2 * k);
        target.x = L.step.fx + (c.x - L.step.fx) * e; target.z = L.step.fz + (c.z - L.step.fz) * e; target.y = Math.max(target.y, gy + ankleH + Math.sin(k * Math.PI) * .07);
        if (k >= 1) { L.step = null; L.lock = { x: c.x, z: c.z }; }
      } else if (planted && allowLock) {
        if (!L.lock) L.lock = { x: c.x, z: c.z };
        const err = Math.hypot(L.lock.x - c.x, L.lock.z - c.z);
        if (err > (ctx.state === 'idle' ? .09 : .16)) {
          if (ctx.state === 'idle' && !this.legState[side === 'Left' ? 'Right' : 'Left'].step) { L.step = { fx: L.lock.x, fz: L.lock.z, t: 0 }; target.x = L.lock.x; target.z = L.lock.z; }
          L.lock = null;
        } else { target.x = L.lock.x; target.z = L.lock.z; }
      } else L.lock = null;
      // mélange avec la pose d'origine selon le poids de l'IK
      target.sub(c).multiplyScalar(this.ikW).add(c);
      const lab = a.distanceTo(bk), lcb = bk.distanceTo(c), reach = a.distanceTo(target), max = (lab + lcb) * .985;
      if (reach > max) drop = Math.max(drop, Math.min(.3, (reach - max) * .9));
      tg[side] = { up, low, foot, target, planted: planted || !!L.lock, lab, lcb };
    }
    // abaisser le bassin si un pied doit descendre (marche, pente)
    this.hipDrop += (drop - this.hipDrop) * Math.min(1, dt * 14);
    if (this.hipDrop > .001) {
      const pw = new THREE.Vector3(); hips.getWorldPosition(pw); pw.y -= this.hipDrop;
      hips.parent.worldToLocal(pw); hips.position.copy(pw); this.holder.updateWorldMatrix(true, true);
    }
    for (const side of ['Left', 'Right']) {
      const T = tg[side]; this.solve(T.up, T.low, T.foot, T.target);
      // pied à plat pendant l'appui
      const fr = this.rest[side + 'Foot']; if (!fr) continue;
      const rootQ = this.Q[0]; this.root.getWorldQuaternion(rootQ);
      const want = this.Q[1].copy(rootQ).multiply(fr.model), pq = this.Q[2]; T.foot.parent.getWorldQuaternion(pq);
      const local = this.Q[3].copy(pq).invert().multiply(want);
      T.foot.quaternion.slerp(local, (T.planted ? .85 : .25) * this.ikW);
    }
  }
  // IK analytique à deux os (hanche → genou → cheville)
  solve(up, low, foot, t) {
    const [a, b, c, , ac, ab, ba, bc, at] = this.V;
    up.getWorldPosition(a); low.getWorldPosition(b); foot.getWorldPosition(c);
    const lab = a.distanceTo(b), lcb = b.distanceTo(c), lat = Math.min(Math.max(a.distanceTo(t), .01), (lab + lcb) * .999);
    const cl = v => Math.min(1, Math.max(-1, v));
    ac.subVectors(c, a).normalize(); ab.subVectors(b, a).normalize(); ba.subVectors(a, b).normalize(); bc.subVectors(c, b).normalize(); at.subVectors(t, a).normalize();
    const ac0 = Math.acos(cl(ac.dot(ab))), ba0 = Math.acos(cl(ba.dot(bc)));
    const ac1 = Math.acos(cl((lcb * lcb - lab * lab - lat * lat) / (-2 * lab * lat))), ba1 = Math.acos(cl((lat * lat - lab * lab - lcb * lcb) / (-2 * lab * lcb)));
    const axis0 = new THREE.Vector3().crossVectors(ac, ab); if (axis0.lengthSq() < 1e-8) return; axis0.normalize();
    const axis1 = new THREE.Vector3().crossVectors(ac, at); const acat = Math.acos(cl(ac.dot(at)));
    const r0 = qa(axis0, ac1 - ac0), r1 = qa(axis0, ba1 - ba0), r2 = axis1.lengthSq() > 1e-10 ? qa(axis1.normalize(), acat) : new THREE.Quaternion();
    const agr = new THREE.Quaternion(), bgr = new THREE.Quaternion(); up.getWorldQuaternion(agr); low.getWorldQuaternion(bgr);
    up.quaternion.multiply(agr.clone().invert().multiply(r2.multiply(r0)).multiply(agr));
    low.quaternion.multiply(bgr.clone().invert().multiply(r1).multiply(bgr));
    up.updateWorldMatrix(false, true);
  }
}
const IK_STATES = new Set(['idle', 'move', 'carry', 'push', 'pull', 'crouch', 'latch', 'cast', 'release', 'sit']);
