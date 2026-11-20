// Physique réaliste des objets (moteur Rapier, WebAssembly) :
//  • corps rigides (masse, frottement, rebond, roulement, mise en veille) pour les débris, jouets, tonneaux, planches…
//  • tout le décor solide du jeu devient collision (blocs, caisses, portes, passerelles qui s'effondrent, meubles de l'Écho)
//  • Mio, les loups et la Main sont des corps cinématiques : ils bousculent ce qu'ils touchent
//  • pouvoirs : la Lueur projette tout dans un rayon, le Souffle balaie dans un cône
//  • flottaison dans l'eau (poussée d'Archimède + traînée), sons d'impact selon la matière et la force du choc
//  • rendu instancié (un appel de dessin par type d'objet) et interpolé entre deux pas de physique
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

let READY = false, initP = null;
export function initPhysics() { if (!initP) initP = RAPIER.init().then(() => { READY = true; }); return initP; }
export const physicsReady = () => READY;

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1);

export class Physics {
  constructor(game) {
    this.game = game;
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = 1 / 60;
    this.world.integrationParameters.numSolverIterations = 6;
    this.events = new RAPIER.EventQueue(true);
    this.types = {}; this.props = []; this.byHandle = new Map(); this.statics = []; this.movers = []; this.free = [];
    this.alpha = 1;
  }
  dispose() { try { this.world.free(); this.events.free(); } catch (e) { /* déjà libéré */ } for (const t of Object.values(this.types)) if (t.inst) { t.inst.removeFromParent(); t.inst.dispose(); } }

  // ------------------------------------------------------------ types d'objets
  // shape : box [sx,sy,sz] | cyl [r,h] | ball r | capsule [r,h]
  type(name, o) { if (!this.types[name]) this.types[name] = { name, ...o, list: [] }; return this.types[name]; }
  prop(typeName, x, y, z, o = {}) {
    const T = this.types[typeName]; if (!T) return null;
    const rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(o.rx ?? 0, o.ry ?? Math.random() * 6.28, o.rz ?? 0));
    const bd = RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z).setRotation(rot).setLinearDamping(.05).setAngularDamping(T.angDamp ?? .25).setCcdEnabled(!!T.ccd);
    const body = this.world.createRigidBody(bd);
    const cd = this.shapeDesc(T.shape, T.size).setDensity(T.density ?? 500).setFriction(T.friction ?? .7).setRestitution(T.bounce ?? .15)
      .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(T.sndThr ?? 4);
    const col = this.world.createCollider(cd, body);
    const p = { T, body, col, idx: T.list.length, prev: new THREE.Vector3(x, y, z), cur: new THREE.Vector3(x, y, z), qPrev: rot.clone(), qCur: rot.clone(), sndT: 0, scale: o.scale || 1, alive: true };
    T.list.push(p); this.props.push(p); this.byHandle.set(col.handle, p);
    return p;
  }
  shapeDesc(shape, s) {
    switch (shape) {
      case 'ball': return RAPIER.ColliderDesc.ball(s);
      case 'cyl': return RAPIER.ColliderDesc.roundCylinder(s[1] / 2 - .01, s[0] - .01, .01);
      case 'capsule': return RAPIER.ColliderDesc.capsule(s[1] / 2, s[0]);
      default: return RAPIER.ColliderDesc.roundCuboid(s[0] / 2 - .008, s[1] / 2 - .008, s[2] / 2 - .008, .008);
    }
  }
  // corps dynamique piloté par un mesh existant (ex. tronçon de passerelle qui tombe)
  spawnFromMesh(mesh, half, o = {}) {
    const bd = RAPIER.RigidBodyDesc.dynamic().setTranslation(mesh.position.x, mesh.position.y, mesh.position.z).setRotation(mesh.quaternion).setCcdEnabled(true).setAngularDamping(.1);
    const body = this.world.createRigidBody(bd);
    const cd = RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z).setDensity(o.density ?? 2500).setFriction(.6).setRestitution(.1)
      .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(o.sndThr ?? 300);
    const col = this.world.createCollider(cd, body);
    if (o.v) body.setLinvel(o.v, true); if (o.w) body.setAngvel(o.w, true);
    const p = { T: { surface: o.surface || 'metal', heavy: true }, body, col, mesh, prev: mesh.position.clone(), cur: mesh.position.clone(), qPrev: mesh.quaternion.clone(), qCur: mesh.quaternion.clone(), sndT: 0, alive: true };
    this.free.push(p); this.byHandle.set(col.handle, p);
    return p;
  }
  removeFree(mesh) {
    this.free = this.free.filter(p => { if (p.mesh !== mesh) return true; this.byHandle.delete(p.col.handle); this.world.removeRigidBody(p.body); return false; });
  }

  // ------------------------------------------------------------ décor : collisions cinématiques synchronisées
  finalize() {
    const w = this.game.world;
    for (const c of w.colliders) this.addStatic(c);
    // filets de sécurité devant et derrière la bande de jeu (le terrain visuel n'a pas de collision)
    for (const [z0, z1] of [[-60, w.zMin ?? -4], [w.zMax ?? 3.2, 40]]) {
      const b = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation((-50 + 400) / 2, -.55, (z0 + z1) / 2));
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(225, .5, Math.abs(z1 - z0) / 2).setFriction(.9), b);
    }
    // instanciation : un mesh par type
    for (const T of Object.values(this.types)) {
      if (!T.list.length) continue;
      const inst = new THREE.InstancedMesh(T.geo, T.mat, T.list.length);
      inst.castShadow = true; inst.receiveShadow = true; inst.frustumCulled = false; inst.userData.static = false;
      inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      T.inst = inst; this.game.scene.add(inst);
    }
    this.syncInstances(1);
  }
  colKey(c) { return c.min.x + ',' + c.min.y + ',' + c.min.z + ',' + c.max.x + ',' + c.max.y + ',' + c.max.z; }
  addStatic(c) {
    const sx = c.max.x - c.min.x, sy = c.max.y - c.min.y, sz = c.max.z - c.min.z;
    if (!(sx > .005 && sy > .005 && sz > .005) || sx > 2000) return;
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation((c.min.x + c.max.x) / 2, (c.min.y + c.max.y) / 2, (c.min.z + c.max.z) / 2));
    const col = this.world.createCollider(RAPIER.ColliderDesc.cuboid(sx / 2, sy / 2, sz / 2).setFriction(.8).setRestitution(.05), body);
    const s = { c, body, col, key: this.colKey(c), size: sx + ',' + sy + ',' + sz, on: true };
    this.statics.push(s);
  }
  syncStatics() {
    const w = this.game.world;
    for (const s of this.statics) {
      const c = s.c, on = c.active && (c.kind !== 'echo' || w.echoSolid()) && (c.blocksPlayer || c.blocksEnemy);
      if (on !== s.on) { s.col.setEnabled(on); s.on = on; if (on) this.wake(c); }
      if (!on) continue;
      const k = this.colKey(c); if (k === s.key) continue;
      s.key = k;
      const sx = c.max.x - c.min.x, sy = c.max.y - c.min.y, sz = c.max.z - c.min.z, sz2 = sx + ',' + sy + ',' + sz;
      if (sz2 !== s.size) { this.world.removeCollider(s.col, false); s.col = this.world.createCollider(RAPIER.ColliderDesc.cuboid(Math.max(.005, sx / 2), Math.max(.005, sy / 2), Math.max(.005, sz / 2)).setFriction(.8), s.body); s.size = sz2; }
      s.body.setNextKinematicTranslation({ x: (c.min.x + c.max.x) / 2, y: (c.min.y + c.max.y) / 2, z: (c.min.z + c.max.z) / 2 });
    }
  }
  wake(c) { for (const p of this.props) { const t = p.body.translation(); if (t.x > c.min.x - 1 && t.x < c.max.x + 1 && t.y > c.min.y - 1 && t.y < c.max.y + 2) p.body.wakeUp(); } }
  // personnages : capsules / sphères cinématiques qui bousculent les objets
  mover(key, shape, size) {
    let m = this.movers.find(m => m.key === key);
    if (!m) { const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased()); const col = this.world.createCollider(this.shapeDesc(shape, size).setFriction(.5), body); m = { key, body, col }; this.movers.push(m); }
    return m;
  }
  moveTo(m, x, y, z, on = true) { if (m.col.isEnabled() !== on) m.col.setEnabled(on); if (on) m.body.setNextKinematicTranslation({ x, y, z }); else m.body.setTranslation({ x, y: -100, z }, false); }

  // ------------------------------------------------------------ forces
  blast(o, R, k) {
    for (const p of this.props.concat(this.free)) {
      const t = p.body.translation(), dx = t.x - o.x, dy = t.y - o.y, dz = t.z - o.z, d = Math.hypot(dx, dy, dz);
      if (d > R || d < 1e-3) continue;
      const m = p.body.mass(), f = (1 - d / R) * k * m * 9;
      p.body.applyImpulse({ x: dx / d * f, y: (Math.max(.25, dy / d) + .55) * f, z: dz / d * f * .6 }, true);
      p.body.applyTorqueImpulse({ x: (Math.random() - .5) * f * .05, y: (Math.random() - .5) * f * .05, z: (Math.random() - .5) * f * .05 }, true);
    }
  }
  gust(o, dir, maxD, k) {
    for (const p of this.props) {
      const t = p.body.translation(), dx = t.x - o.x, dz = t.z - o.z, along = dx * dir.x + dz * dir.z;
      if (along < -.2 || along > maxD) continue;
      const lat = Math.abs(-dx * dir.z + dz * dir.x); if (lat > .7 + along * .45 || Math.abs(t.y - o.y) > 1.6) continue;
      const m = p.body.mass(), f = (1 - along / maxD) * k * m * 6;
      p.body.applyImpulse({ x: dir.x * f, y: f * .35, z: dir.z * f }, true);
      p.body.applyTorqueImpulse({ x: (Math.random() - .5) * f * .03, y: 0, z: -dir.x * f * .04 }, true);
    }
  }

  // ------------------------------------------------------------ pas de simulation
  step(dt) {
    const g = this.game, pl = g.player;
    this.syncStatics();
    if (pl) this.moveTo(this.mover('player', 'capsule', [.17, .78]), pl.pos.x, pl.pos.y + .56, pl.pos.z, pl.state !== 'dead' && !pl.ghost);
    for (const e of g.enemies) {
      if (e.kind === 'wolf' && e.pos) this.moveTo(this.mover(e, 'capsule', [.32, .5]), e.pos.x, e.pos.y + .45, e.pos.z, e.active !== false && !e.gone);
      else if (e.kind === 'hand' && e.tip) this.moveTo(this.mover(e, 'ball', .32), e.tip.x, e.tip.y, e.tip.z, !!e.active);
    }
    // flottaison
    const waters = g.world.waters || [];
    if (waters.length) for (const p of this.props) {
      if (p.body.isSleeping()) continue;
      const t = p.body.translation();
      for (const wa of waters) {
        if (t.x < wa.x0 || t.x > wa.x1 || t.z < wa.z0 || t.z > wa.z1) continue;
        const r = p.T.radius || .1, sub = THREE.MathUtils.clamp((wa.y - (t.y - r)) / (2 * r), 0, 1); if (sub <= 0) break;
        const m = p.body.mass(), v = p.body.linvel(), av = p.body.angvel(), buoy = p.T.buoy ?? .4;
        p.body.applyImpulse({ x: -v.x * m * 1.5 * sub * dt + Math.sin(g.time * .7 + t.z) * m * .06 * dt, y: (9.81 * buoy * 2 * sub - v.y * 3 * sub) * m * dt, z: -v.z * m * 1.5 * sub * dt }, true);
        p.body.applyTorqueImpulse({ x: -av.x * m * .02 * sub, y: -av.y * m * .02 * sub, z: -av.z * m * .02 * sub }, true);
        if (!p.inWater && v.y < -.6) { p.inWater = true; g.audio.impact('water', Math.min(1, -v.y / 4), t.x); if (g.fx.splash) g.fx.splash(t.x, wa.y, t.z, .4); }
        break;
      }
    }
    this.world.step(this.events);
    // sons d'impact
    const now = g.time;
    this.events.drainContactForceEvents(ev => {
      const p = this.byHandle.get(ev.collider1()) || this.byHandle.get(ev.collider2()); if (!p || now - p.sndT < .12) return;
      const f = ev.totalForceMagnitude() / Math.max(.05, p.body.mass()); if (f < 12) return;
      p.sndT = now; g.audio.impact(p.T.surface || 'wood', Math.min(1, f / (p.T.heavy ? 90 : 160)), p.body.translation().x);
    });
    // état courant (pour l'interpolation au rendu)
    for (const p of this.props) this.capture(p);
    for (const p of this.free) this.capture(p);
  }
  capture(p) {
    p.prev.copy(p.cur); p.qPrev.copy(p.qCur);
    const t = p.body.translation(), r = p.body.rotation();
    if (t.y < -40) { p.body.setTranslation({ x: t.x, y: -40, z: t.z }, false); p.body.sleep(); }
    p.cur.set(t.x, t.y, t.z); p.qCur.set(r.x, r.y, r.z, r.w);
    if (!isFinite(p.cur.x + p.cur.y + p.cur.z)) { p.cur.copy(p.prev); }
  }
  // rendu interpolé entre deux pas (alpha 0..1)
  syncInstances(alpha) {
    for (const T of Object.values(this.types)) {
      if (!T.inst) continue;
      for (const p of T.list) {
        _p.copy(p.prev).lerp(p.cur, alpha); _q.copy(p.qPrev).slerp(p.qCur, alpha); _s.setScalar(p.scale);
        _m.compose(_p, _q, _s); T.inst.setMatrixAt(p.idx, _m);
      }
      T.inst.instanceMatrix.needsUpdate = true;
    }
    for (const p of this.free) if (p.mesh) { p.mesh.position.copy(p.prev).lerp(p.cur, alpha); p.mesh.quaternion.copy(p.qPrev).slerp(p.qCur, alpha); }
  }
}
