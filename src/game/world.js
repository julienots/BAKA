// Monde : physique 3D simplifiée (boîtes alignées), entités interactives, déclencheurs, points de passage
import * as THREE from 'three';
import { getMaterials } from '../core/materials.js';
import { clamp, damp, rr, rnd } from '../core/util.js';

export class Box {
  constructor(x0, y0, z0, x1, y1, z1, o = {}) {
    this.min = new THREE.Vector3(Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1));
    this.max = new THREE.Vector3(Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1));
    this.kind = o.kind || 'static'; this.surface = o.surface || 'dirt'; this.climbable = o.climbable !== false;
    this.active = o.active !== false; this.mesh = null; this.ref = o.ref || null; this.blocksPlayer = o.blocksPlayer !== false; this.blocksEnemy = o.blocksEnemy !== false;
  }
  overlaps(a0x, a0y, a0z, a1x, a1y, a1z, eps = 0) {
    return a1x > this.min.x + eps && a0x < this.max.x - eps && a1y > this.min.y + eps && a0y < this.max.y - eps && a1z > this.min.z + eps && a0z < this.max.z - eps;
  }
}

export const PLAYER = { hw: .17, hd: .15, h: 1.12 };

export class World {
  constructor(game) {
    this.game = game; this.scene = game.scene;
    this.colliders = []; this.entities = []; this.triggers = []; this.ladders = []; this.checkpoints = []; this.camZones = []; this.waters = []; this.hides = [];
    this.echoT = 0; this.windX = 0; this.time = 0; this.length = 100; this.zMin = -2.6; this.zMax = 2.4;
    this.byId = {};
    this.M = getMaterials();
    this.updaters = [];
  }
  add(c) { this.colliders.push(c); return c; }
  reg(e, id) { this.entities.push(e); if (id) this.byId[id] = e; return e; }
  // ---------- construction ----------
  block(x0, y0, z0, x1, y1, z1, o = {}) {
    const b = this.add(new Box(x0, y0, z0, x1, y1, z1, o));
    if (o.mat !== null && o.visible !== false) {
      const sx = b.max.x - b.min.x, sy = b.max.y - b.min.y, sz = b.max.z - b.min.z;
      let geo;
      if (o.rock) {
        // roche sculptée : boîte subdivisée déformée par du bruit (la collision reste une boîte)
        geo = new THREE.BoxGeometry(sx, sy, sz, Math.max(4, Math.round(sx * 3)), Math.max(3, Math.round(sy * 3)), Math.max(4, Math.round(sz * 3)));
        const pa = geo.attributes.position, v = new THREE.Vector3(), seed = b.min.x * 3.7 + b.min.z;
        for (let i = 0; i < pa.count; i++) {
          v.fromBufferAttribute(pa, i);
          const n = Math.sin(v.x * 3.1 + seed) * Math.cos(v.y * 2.7 + seed * .5) * Math.sin(v.z * 3.3 - seed) + Math.sin(v.x * 7.3 + v.y * 5.1) * .35;
          const top = v.y > sy / 2 - .01, k = top ? .03 : .14;
          const nx = Math.abs(v.x) > sx / 2 - .01 ? Math.sign(v.x) : 0, nz = Math.abs(v.z) > sz / 2 - .01 ? Math.sign(v.z) : 0;
          v.x += nx * n * k * (v.y < sy / 2 - .15 ? 1 : .3); v.z += nz * n * k; if (top) v.y += n * .04; else if (v.y > -sy / 2 + .01 && v.y < sy / 2 - .2) { v.x += (Math.sin(v.y * 9 + seed) * .03) * nx; }
          // arêtes supérieures arrondies
          if (top && (nx || nz)) v.y -= .06;
          pa.setXYZ(i, v.x, v.y, v.z);
        }
        geo.computeVertexNormals();
      } else geo = new THREE.BoxGeometry(sx, sy, sz);
      if (o.uvScale) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * o.uvScale[0], uv.getY(i) * o.uvScale[1]); }
      const m = new THREE.Mesh(geo, o.mat || this.M.concrete);
      m.position.set((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2);
      m.castShadow = o.cast !== false; m.receiveShadow = true; m.userData.static = !o.dynamic; this.scene.add(m); b.mesh = m;
    }
    return b;
  }
  ground(x0, x1, o = {}) {
    const y = o.y || 0;
    return this.block(x0, y - 2, o.z0 ?? -4, x1, y, o.z1 ?? 3.2, { ...o, mat: o.mat === undefined ? null : o.mat, visible: o.mat !== undefined, climbable: false });
  }
  wall(x0, x1, o = {}) { return this.block(x0, -1, (o.z ?? -3) - .3, x1, o.h ?? 12, (o.z ?? -3), { ...o, climbable: false }); }
  zBounds(z0, z1) { this.zMin = z0; this.zMax = z1; }
  crate(x, z, size = 1, o = {}) { return this.reg(new Crate(this, x, z, size, o), o.id); }
  gate(id, x0, y0, z0, x1, y1, z1, o = {}) { return this.reg(new Gate(this, x0, y0, z0, x1, y1, z1, o), id); }
  lever(x, y, z, o = {}) { return this.reg(new Lever(this, x, y, z, o), o.id); }
  latch(x, y, z, o = {}) { return this.reg(new Latch(this, x, y, z, o), o.id); }
  plate(x, z, o = {}) { return this.reg(new Plate(this, x, z, o), o.id); }
  hide(x0, z0, x1, z1, o = {}) { const h = { min: new THREE.Vector3(x0, o.y0 ?? -1, z0), max: new THREE.Vector3(x1, o.y1 ?? 3, z1), full: !!o.full }; this.hides.push(h); return h; }
  water(x0, x1, z0, z1, y, o = {}) { const w = new Water(this, x0, x1, z0, z1, y, o); this.waters.push(w); return this.reg(w); }
  collapse(x0, x1, z0, z1, y, o = {}) { return this.reg(new Collapse(this, x0, x1, z0, z1, y, o), o.id); }
  echoBox(x0, y0, z0, x1, y1, z1, o = {}) { return this.reg(new EchoBox(this, x0, y0, z0, x1, y1, z1, o)); }
  bramble(x, z0, z1, o = {}) { return this.reg(new Bramble(this, x, z0, z1, o), o.id); }
  fence(x, z0, z1, h = 2.2, o = {}) { return this.reg(new Fence(this, x, z0, z1, h, o), o.id); }
  memory(id, x, y, z) { return this.reg(new Memory(this, id, x, y, z), 'mem_' + id); }
  shrine(power, x, y, z, o = {}) { return this.reg(new Shrine(this, power, x, y, z, o), 'shrine_' + power); }
  item(kind, x, y, z, o = {}) { return this.reg(new Item(this, kind, x, y, z, o), o.id); }
  socket(kind, x, y, z, o = {}) { return this.reg(new Socket(this, kind, x, y, z, o), o.id); }
  // échelle posée contre la face avant d'une plate-forme (z = face) ; on grimpe en poussant vers le haut
  ladder(x, z, y0, y1, o = {}) {
    const L = { x, z, y0, y1 }; this.ladders.push(L);
    const g = new THREE.Group(), mat = o.mat || this.M.rust, h = y1 - y0 + .9;
    for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.BoxGeometry(.06, h, .06), mat); r.position.set(x + s * .24, y0 + h / 2, z + .12); r.castShadow = true; g.add(r); }
    for (let y = y0 + .28; y < y1 + .8; y += .3) { const r = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, .5, 8), mat); r.rotation.z = Math.PI / 2; r.position.set(x, y, z + .12); r.castShadow = true; g.add(r); }
    this.scene.add(g); return L;
  }
  trigger(x, fn, o = {}) { const t = { x, fn, once: o.once !== false, done: false, zone: o.zone || null, persist: !!o.persist }; this.triggers.push(t); return t; }
  checkpoint(x, y = 0, z = 0) { this.checkpoints.push({ x, y, z }); this.checkpoints.sort((a, b) => a.x - b.x); }
  camZone(x0, x1, o) { this.camZones.push({ x0, x1, ...o }); }
  // ---------- requêtes ----------
  solid(c, who = 'player') {
    if (!c.active) return false;
    if (who === 'player' && !c.blocksPlayer) return false;
    if (who === 'enemy' && !c.blocksEnemy) return false;
    if (c.kind === 'echo' && !this.echoSolid()) return false;
    if (c.kind === 'phase' && who === 'player' && this.game.player && this.game.player.ghost) return false;
    return true;
  }
  echoSolid() { return this.echoT > .5; }
  overlapAny(x0, y0, z0, x1, y1, z1, who = 'player', ignore = null) {
    for (const c of this.colliders) if (c !== ignore && this.solid(c, who) && c.overlaps(x0, y0, z0, x1, y1, z1, .001)) return c;
    return null;
  }
  groundHeight(x, z, y, r = .15) { // plus haut sol sous (x,z) en dessous de y
    let best = -Infinity, surf = 'dirt', col = null;
    for (const c of this.colliders) {
      if (!this.solid(c)) continue;
      if (x + r > c.min.x && x - r < c.max.x && z + r > c.min.z && z - r < c.max.z && c.max.y <= y + .05 && c.max.y > best) { best = c.max.y; surf = c.surface; col = c; }
    }
    return { y: best, surface: surf, col };
  }
  raySeg(a, b, who = 'enemy') { // vrai si un obstacle coupe le segment
    const d = new THREE.Vector3().subVectors(b, a);
    for (const c of this.colliders) {
      if (!this.solid(c, who) || c.kind === 'crateTop') continue;
      let t0 = 0, t1 = 1, hit = true;
      for (const ax of ['x', 'y', 'z']) {
        if (Math.abs(d[ax]) < 1e-6) { if (a[ax] < c.min[ax] || a[ax] > c.max[ax]) { hit = false; break; } }
        else { let ta = (c.min[ax] - a[ax]) / d[ax], tb = (c.max[ax] - a[ax]) / d[ax]; if (ta > tb) [ta, tb] = [tb, ta]; t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) { hit = false; break; } }
      }
      if (hit && t0 > .02 && t0 < .98) return c;
    }
    return null;
  }
  inHide(p, crouch) {
    for (const h of this.hides) if (p.x > h.min.x && p.x < h.max.x && p.z > h.min.z && p.z < h.max.z && p.y > h.min.y && p.y < h.max.y && (crouch || h.full)) return true;
    return false;
  }
  // ---------- déplacement d'une boîte (joueur, caisses, ennemis) ----------
  moveBody(b, dt, who = 'player', ignore = null) {
    // b : {pos, vel, hw, hd, h, grounded}
    const res = { hitX: null, hitZ: null, hitY: null, stepped: false };
    const box = (px, py, pz) => [px - b.hw, py, pz - b.hd, px + b.hw, py + b.h, pz + b.hd];
    const p = b.pos;
    // axe X
    if (b.vel.x) {
      const nx = p.x + b.vel.x * dt;
      const c = this.overlapAny(...box(nx, p.y, p.z), who, ignore || b.selfCol);
      if (c) {
        // marche automatique sur les petits rebords
        const step = c.max.y - p.y;
        if (b.grounded && step > 0 && step <= (b.stepH ?? .32) && !this.overlapAny(...box(nx, c.max.y + .001, p.z), who, ignore || b.selfCol)) { p.x = nx; p.y = c.max.y + .001; res.stepped = true; }
        else { p.x = b.vel.x > 0 ? c.min.x - b.hw - .0005 : c.max.x + b.hw + .0005; res.hitX = c; b.vel.x = 0; }
      } else p.x = nx;
    }
    if (b.vel.z) {
      let nz = p.z + b.vel.z * dt;
      if (b.zClamp) nz = clamp(nz, this.zMin, this.zMax);
      const c = this.overlapAny(...box(p.x, p.y, nz), who, ignore || b.selfCol);
      if (c) {
        const step = c.max.y - p.y;
        if (b.grounded && step > 0 && step <= (b.stepH ?? .32) && !this.overlapAny(...box(p.x, c.max.y + .001, nz), who, ignore || b.selfCol)) { p.z = nz; p.y = c.max.y + .001; res.stepped = true; }
        else { p.z = b.vel.z > 0 ? c.min.z - b.hd - .0005 : c.max.z + b.hd + .0005; res.hitZ = c; b.vel.z = 0; }
      } else p.z = nz;
    }
    // axe Y
    const ny = p.y + b.vel.y * dt;
    const c = this.overlapAny(...box(p.x, ny, p.z), who, ignore || b.selfCol);
    b.grounded = false;
    if (c) {
      if (b.vel.y <= 0) { p.y = c.max.y + .0005; b.grounded = true; b.groundCol = c; }
      else { p.y = c.min.y - b.h - .0005; }
      res.hitY = c; b.vel.y = 0;
    } else {
      p.y = ny;
      // collé au sol en descente
      if (b.wasGrounded && b.vel.y <= 0) {
        const below = this.overlapAny(...box(p.x, p.y - .12, p.z), who, ignore || b.selfCol);
        if (below && below.max.y <= p.y + .001) { p.y = below.max.y + .0005; b.grounded = true; b.groundCol = below; b.vel.y = 0; }
      }
    }
    b.wasGrounded = b.grounded;
    return res;
  }
  // ---------- mise à jour ----------
  update(dt, player) {
    this.time += dt;
    for (const e of this.entities) if (e.update) e.update(dt, player);
    for (const u of this.updaters) u(dt, this.time);
    for (const t of this.triggers) {
      if (t.done) continue;
      let hit = player.pos.x >= t.x;
      if (t.zone) { const z = t.zone; hit = player.pos.x > z[0] && player.pos.x < z[1] && player.pos.z > z[2] && player.pos.z < z[3]; }
      if (hit) { if (t.once) t.done = true; t.fn(this, player); }
    }
  }
  nearestInteract(player) {
    let best = null, bd = 1e9;
    for (const e of this.entities) {
      if (!e.interact || !e.canInteract || !e.canInteract(player)) continue;
      const d = Math.hypot(e.pos.x - player.pos.x, (e.pos.z - player.pos.z) * 1.3);
      if (d < (e.range || 1) && d < bd) { bd = d; best = e; }
    }
    return best;
  }
  snapshot() { return { ents: this.entities.map(e => e.save ? e.save() : null), trig: this.triggers.map(t => t.done) }; }
  restore(s) {
    this.entities.forEach((e, i) => { if (e.load && s.ents[i] !== null && s.ents[i] !== undefined) e.load(s.ents[i]); });
    this.triggers.forEach((t, i) => { if (!t.persist) t.done = s.trig[i]; });
  }
  dispose() {
    this.scene.traverse(o => { if (o.geometry && !o.userData.keep) o.geometry.dispose(); });
  }
}

// ======================= ENTITÉS =======================
class Crate {
  constructor(w, x, z, size, o) {
    this.w = w; this.size = size; this.heavy = !!o.heavy; this.climbable = true;
    this.pos = new THREE.Vector3(x, o.y || 0, z); this.vel = new THREE.Vector3(); this.hw = size / 2; this.hd = size / 2; this.h = size; this.grounded = false; this.stepH = 0;
    this.col = w.add(new Box(0, 0, 0, 1, 1, 1, { kind: 'crate', surface: 'wood' })); this.col.ref = this; this.selfCol = this.col;
    const M = w.M, g = new THREE.Group();
    const cm = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), this.heavy ? M.iron : M.wood); g.add(cm);
    const edge = this.heavy ? M.darkIron : M.woodDark, t = .08 * size;
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const e1 = new THREE.Mesh(new THREE.BoxGeometry(size + .02, t, t), edge); e1.position.set(0, a * size / 2, b * size / 2); g.add(e1);
      const e2 = new THREE.Mesh(new THREE.BoxGeometry(t, size + .02, t), edge); e2.position.set(a * size / 2, 0, b * size / 2); g.add(e2);
      const e3 = new THREE.Mesh(new THREE.BoxGeometry(t, t, size + .02), edge); e3.position.set(a * size / 2, b * size / 2, 0); g.add(e3);
    }
    if (!this.heavy) { const d = new THREE.Mesh(new THREE.BoxGeometry(size * 1.33, t * .9, t * .6), edge); d.rotation.x = 0; d.rotation.z = Math.PI / 4; d.position.z = size / 2 + .01; g.add(d); const d2 = d.clone(); d2.position.z = -size / 2 - .01; g.add(d2); }
    else { for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .02, 8), edge); r.rotation.x = Math.PI / 2; r.position.set(i % 2 ? .3 : -.3, i < 2 ? .3 : -.3, size / 2 + .01); g.add(r); } }
    g.traverse(m => { if (m.isMesh) { m.castShadow = m.receiveShadow = true; } });
    w.scene.add(g); this.mesh = g; this.init = this.pos.clone(); this.tilt = 0;
    this.syncCol();
  }
  syncCol() { const p = this.pos; this.col.min.set(p.x - this.hw, p.y, p.z - this.hd); this.col.max.set(p.x + this.hw, p.y + this.h, p.z + this.hd); this.mesh.position.set(p.x, p.y + this.h / 2, p.z); }
  tryPush(dx, dz, dt) {
    // tente de déplacer la caisse ; renvoie la distance réellement parcourue
    const before = this.pos.clone();
    this.vel.x = dx; this.vel.z = dz; const vy = this.vel.y; this.vel.y = 0;
    this.w.moveBody(this, dt, 'player');
    this.vel.y = vy; this.vel.x = 0; this.vel.z = 0;
    this.syncCol();
    const moved = Math.hypot(this.pos.x - before.x, this.pos.z - before.z);
    if (moved > .001) { this.scrapeT = (this.scrapeT || 0) - dt; if (this.scrapeT < 0) { this.w.game.audio.play('scrape'); this.scrapeT = .32; } }
    return moved;
  }
  impulse(vx, vz) { this.push = { x: vx, z: vz, t: .9 }; }
  update(dt) {
    if (this.push) {
      const k = this.push.t / .9; this.push.t -= dt;
      this.tryPush(this.push.x * k, this.push.z * k, dt);
      if (this.push.t <= 0) this.push = null;
    }
    // gravité
    this.vel.y -= 22 * dt; const vx = this.vel.x, vz = this.vel.z; this.vel.x = 0; this.vel.z = 0;
    const was = this.grounded;
    this.w.moveBody(this, dt, 'player'); this.vel.x = vx; this.vel.z = vz;
    if (this.grounded && !was && this.fallStart !== undefined && this.fallStart - this.pos.y > .4) { this.w.game.audio.play('land', { k: 2 }); this.w.game.shake(.25); }
    if (!this.grounded && was) this.fallStart = this.pos.y;
    if (this.pos.y < -20) { this.pos.copy(this.init); this.vel.set(0, 0, 0); }
    this.syncCol();
  }
  save() { return [this.pos.x, this.pos.y, this.pos.z]; }
  load(s) { this.pos.set(...s); this.vel.set(0, 0, 0); this.push = null; this.syncCol(); }
}

class Gate {
  constructor(w, x0, y0, z0, x1, y1, z1, o) {
    this.w = w; this.open = !!o.open; this.k = this.open ? 1 : 0; this.offset = new THREE.Vector3(...(o.offset || [0, (y1 - y0) * .95, 0]));
    this.col = w.block(x0, y0, z0, x1, y1, z1, { mat: null, visible: false, climbable: !!o.climbable, kind: 'gate', surface: o.surface || 'metal' });
    this.base = { min: this.col.min.clone(), max: this.col.max.clone() };
    this.pos = new THREE.Vector3((x0 + x1) / 2, y0, (z0 + z1) / 2);
    const g = this.mesh = new THREE.Group(); const sx = x1 - x0, sy = y1 - y0, sz = z1 - z0;
    if (o.style === 'shutter') {
      for (let y = 0; y < sy; y += .18) { const s = new THREE.Mesh(new THREE.BoxGeometry(sx, .16, sz), w.M.iron); s.position.set(0, y + .09 - sy / 2, 0); g.add(s); }
    } else if (o.style === 'bars') {
      const bar = w.M.darkIron;
      for (let z = -sz / 2 + .1; z <= sz / 2; z += .22) { const b = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, sy, 6), bar); b.position.set(0, 0, z); g.add(b); }
      for (const y of [-sy / 2 + .15, sy / 2 - .15, 0]) { const r = new THREE.Mesh(new THREE.BoxGeometry(.08, .06, sz), bar); r.position.y = y; g.add(r); }
    } else if (o.style === 'plank') {
      const s = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), w.M.wood); g.add(s);
    } else { const s = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), o.mat || w.M.iron); g.add(s); }
    g.traverse(m => { if (m.isMesh) { m.castShadow = m.receiveShadow = true; } });
    g.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); this.home = g.position.clone();
    if (o.rotateOpen) this.rotateOpen = o.rotateOpen;
    w.scene.add(g); this.apply();
  }
  setOpen(v) { if (v !== this.open) { this.open = v; this.w.game.audio.play('gate'); this.w.game.shake(.15); } }
  toggle() { this.setOpen(!this.open); }
  apply() {
    const k = this.k;
    if (this.rotateOpen) { // pont-levis : rotation autour du bord
      const r = this.rotateOpen; this.mesh.rotation.z = (1 - k) * r.angle;
      this.col.active = k > .95;
      return;
    }
    this.mesh.position.copy(this.home).addScaledVector(this.offset, k);
    this.col.min.copy(this.base.min).addScaledVector(this.offset, k); this.col.max.copy(this.base.max).addScaledVector(this.offset, k);
  }
  update(dt) { const t = this.open ? 1 : 0; if (this.k !== t) { this.k = clamp(this.k + Math.sign(t - this.k) * dt * 0.8, 0, 1); this.apply(); } }
  save() { return [this.open, this.k]; }
  load(s) { this.open = s[0]; this.k = s[1]; this.apply(); }
}

class Lever {
  constructor(w, x, y, z, o) {
    this.w = w; this.pos = new THREE.Vector3(x, y, z); this.on = false; this.target = o.target; this.once = o.once !== false; this.range = 1;
    const g = this.mesh = new THREE.Group(); g.position.copy(this.pos);
    const base = new THREE.Mesh(new THREE.BoxGeometry(.3, .2, .2), w.M.darkIron); base.position.y = .1; g.add(base);
    this.handle = new THREE.Group(); this.handle.position.y = .18; g.add(this.handle);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .55, 8), w.M.iron); stick.position.y = .27; this.handle.add(stick);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 8), w.M.darkIron); knob.position.y = .55; this.handle.add(knob);
    this.handle.rotation.z = .6;
    g.traverse(m => { if (m.isMesh) m.castShadow = true; });
    w.scene.add(g); this.k = 0;
  }
  canInteract() { return !(this.on && this.once); }
  interact() {
    this.on = !this.on; this.w.game.audio.play('lever'); this.w.game.input.vibrate(30);
    const t = this.w.byId[this.target]; if (t) t.setOpen ? t.setOpen(this.on) : t.trigger && t.trigger();
    if (this.onToggle) this.onToggle(this.on);
    return { anim: 'pull', time: .45 };
  }
  update(dt) { this.k = damp(this.k, this.on ? 1 : 0, 8, dt); this.handle.rotation.z = .6 - this.k * 1.2; }
  save() { return [this.on]; }
  load(s) { this.on = s[0]; const t = this.w.byId[this.target]; if (t && t.setOpen) t.open = this.on; }
}

class Latch {
  constructor(w, x, y, z, o) {
    this.w = w; this.pos = new THREE.Vector3(x, y, z); this.done = false; this.target = o.target; this.hold = o.hold || 1.2; this.p = 0; this.range = .9; this.isHold = true;
    const g = this.mesh = new THREE.Group(); g.position.copy(this.pos);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(.06, .25, .18), w.M.darkIron); g.add(plate);
    this.bolt = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .3, 8), w.M.iron); this.bolt.rotation.x = Math.PI / 2; this.bolt.position.set(.04, 0, 0); g.add(this.bolt);
    w.scene.add(g);
  }
  canInteract() { return !this.done; }
  interact() { return { hold: true }; }
  progress(dt) {
    this.p += dt / this.hold; this.bolt.position.z = -this.p * .2; this.bolt.rotation.y = Math.sin(this.p * 40) * .05;
    if (Math.random() < dt * 8) this.w.game.audio.play('latch');
    if (this.p >= 1) { this.done = true; const t = this.w.byId[this.target]; if (t) t.setOpen(true); this.w.game.input.vibrate(60); return true; }
    return false;
  }
  update(dt) { if (!this.done && this.p > 0 && !this.active) this.p = Math.max(0, this.p - dt * .5); this.active = false; }
  save() { return [this.done, this.p]; }
  load(s) { this.done = s[0]; this.p = s[1]; this.bolt.position.z = -this.p * .2; }
}

class Plate {
  constructor(w, x, z, o) {
    this.w = w; this.pos = new THREE.Vector3(x, o.y || 0, z); this.target = o.target; this.size = o.size || 1.1; this.pressed = false; this.keep = o.keep !== false; this.byPlayer = !!o.byPlayer;
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(this.size, .08, this.size), w.M.darkIron); this.mesh.position.set(x, this.pos.y + .04, z); this.mesh.receiveShadow = true; w.scene.add(this.mesh);
  }
  update(dt, player) {
    let on = false; const s = this.size / 2;
    for (const e of this.w.entities) if (e instanceof Crate && Math.abs(e.pos.x - this.pos.x) < s && Math.abs(e.pos.z - this.pos.z) < s && Math.abs(e.pos.y - this.pos.y) < .2) on = true;
    if (this.byPlayer && player && Math.abs(player.pos.x - this.pos.x) < s && Math.abs(player.pos.z - this.pos.z) < s) on = true;
    if (on !== this.pressed && (on || !this.keep)) {
      this.pressed = on; this.w.game.audio.play('lever');
      const t = this.w.byId[this.target]; if (t) t.setOpen(on);
    }
    this.mesh.position.y = this.pos.y + (this.pressed ? .01 : .04);
  }
  save() { return [this.pressed]; }
  load(s) { this.pressed = s[0]; }
}

class Water {
  constructor(w, x0, x1, z0, z1, y, o) {
    this.w = w; this.x0 = x0; this.x1 = x1; this.z0 = z0; this.z1 = z1; this.y = y; this.depth = o.depth ?? 1.5;
    const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, 1, 1); geo.rotateX(-Math.PI / 2);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uSky: { value: new THREE.Color(o.sky || 0x8a96a2) }, uDeep: { value: new THREE.Color(o.deep || 0x0a0e12) }, uRain: { value: o.rain ? 1 : 0 }, uLight: { value: new THREE.Vector3(.5, .6, -1).normalize() } }]),
      vertexShader: `varying vec3 vW;
${THREE.ShaderChunk.fog_pars_vertex}
void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vec4 mvPosition=viewMatrix*w; gl_Position=projectionMatrix*mvPosition;
${THREE.ShaderChunk.fog_vertex}
}`,
      fragmentShader: `uniform float uTime,uRain; uniform vec3 uSky,uDeep,uLight; varying vec3 vW;
${THREE.ShaderChunk.fog_pars_fragment}

        float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
        vec2 grad(vec2 p){ float e=.05; return vec2(n(p+vec2(e,0))-n(p-vec2(e,0)), n(p+vec2(0,e))-n(p-vec2(0,e)))/e; }
        void main(){ vec2 p=vW.xz;
          vec2 g = grad(p*1.3+vec2(uTime*.15,uTime*.08))*.25 + grad(p*3.7-vec2(uTime*.2,0.))*.12;
          // gouttes de pluie : anneaux concentriques
          if(uRain>0.){ for(int k=0;k<3;k++){ vec2 cell=floor(p*2.+float(k)*.37); vec2 f=fract(p*2.+float(k)*.37)-.5; float t=fract(uTime*.9+h(cell+float(k))); vec2 o=vec2(h(cell+3.1),h(cell+7.7))-.5; float d=length(f-o*.6); float ring=sin((d-t*.5)*60.)*smoothstep(.0,.05,t*.5-d+.05)*(1.-t); g+=normalize(f-o*.6+1e-4)*ring*.6; } }
          vec3 N=normalize(vec3(-g.x,1.,-g.y));
          vec3 V=normalize(cameraPosition-vW);
          float fres=.04+.96*pow(1.-max(dot(N,V),0.),5.);
          vec3 R=reflect(-V,N);
          vec3 sky=mix(uDeep*1.5,uSky,smoothstep(-.1,.6,R.y));
          float spec=pow(max(dot(R,uLight),0.),120.)*2.;
          vec3 col=mix(uDeep,sky,fres)+spec*uSky;
          gl_FragColor=vec4(col, .88+fres*.12);

${THREE.ShaderChunk.fog_fragment}
}`
    });
    this.mesh = new THREE.Mesh(geo, this.mat); this.mesh.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); this.mesh.renderOrder = 2; w.scene.add(this.mesh);
  }
  contains(p) { return p.x > this.x0 && p.x < this.x1 && p.z > this.z0 && p.z < this.z1 && p.y < this.y; }
  update(dt) { this.mat.uniforms.uTime.value = this.w.time; }
}

class Collapse {
  constructor(w, x0, x1, z0, z1, y, o) {
    this.w = w; this.segs = []; this.n = o.n || Math.ceil((x1 - x0) / 1.2); this.speed = o.speed || 3.2; this.started = false; this.t = 0; this.x0 = x0;
    const sw = (x1 - x0) / this.n;
    for (let i = 0; i < this.n; i++) {
      const sx0 = x0 + i * sw, b = w.block(sx0, y - .3, z0, sx0 + sw - .02, y, z1, { mat: o.mat || w.M.iron, surface: o.surface || 'metal', dynamic: true });
      b.mesh.userData.home = b.mesh.position.clone();
      this.segs.push({ b, fallen: false, vy: 0, rot: new THREE.Vector3(rr(-1, 1), rr(-1, 1), rr(-1, 1)), shakeT: 0 });
    }
  }
  start() { this.started = true; this.t = 0; }
  update(dt, player) {
    if (!this.started) return;
    this.t += dt;
    const front = this.x0 + this.t * this.speed; // l'effondrement poursuit le joueur
    for (const s of this.segs) {
      const sx = s.b.min.x;
      if (!s.fallen && sx < front - .6) { s.fallen = true; s.b.active = false; this.w.game.audio.play('crash'); this.w.game.shake(.4); }
      else if (!s.fallen && sx < front + .8) { s.b.mesh.position.x = s.b.mesh.userData.home.x + (Math.random() - .5) * .05; s.b.mesh.position.y = s.b.mesh.userData.home.y + (Math.random() - .5) * .04; }
      if (s.fallen && s.b.mesh.visible) {
        s.vy -= 20 * dt; s.b.mesh.position.y += s.vy * dt; s.b.mesh.rotation.x += s.rot.x * dt; s.b.mesh.rotation.z += s.rot.z * dt;
        if (s.b.mesh.position.y < -25) s.b.mesh.visible = false;
      }
    }
  }
  save() { return [this.started, this.t, this.segs.map(s => s.fallen)]; }
  load(s) {
    this.started = s[0]; this.t = s[1];
    this.segs.forEach((g, i) => { g.fallen = s[2][i]; g.b.active = !g.fallen; g.vy = 0; g.b.mesh.visible = !g.fallen; g.b.mesh.position.copy(g.b.mesh.userData.home); g.b.mesh.rotation.set(0, 0, 0); });
  }
}

const ghostMat = () => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uA: { value: 0 }, uTime: { value: 0 } },
  vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal); vV=normalize(cameraPosition-w.xyz); gl_Position=projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `uniform float uA,uTime; varying vec3 vN; varying vec3 vV; varying vec3 vW; void main(){ float f=pow(1.-abs(dot(vN,vV)),2.); float scan=.6+.4*sin(vW.y*40.-uTime*4.); vec3 c=vec3(.55,.8,1.)*(f*1.4+.15)*scan; gl_FragColor=vec4(c*uA,1.); }`
});
class EchoBox {
  constructor(w, x0, y0, z0, x1, y1, z1, o) {
    this.w = w; this.col = w.add(new Box(x0, y0, z0, x1, y1, z1, { kind: 'echo', surface: o.surface || 'wood' }));
    this.mat = ghostMat();
    const shape = o.shape || 'box';
    let geo;
    if (shape === 'books') { // pile de livres
      const parts = new THREE.Group(); const n = Math.max(2, Math.round((y1 - y0) / .18));
      for (let i = 0; i < n; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry((x1 - x0) * rr(.85, 1), (y1 - y0) / n * .92, (z1 - z0) * rr(.8, 1)), this.mat); m.position.y = -(y1 - y0) / 2 + (i + .5) * (y1 - y0) / n; m.rotation.y = rr(-.08, .08); parts.add(m); }
      this.mesh = parts;
    } else { geo = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); this.mesh = new THREE.Mesh(geo, this.mat); }
    this.mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); w.scene.add(this.mesh);
    this.hint = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), this.mat); // reflet faible hors écho
  }
  update(dt) { this.mat.uniforms.uA.value = .05 + this.w.echoT * .95 + Math.sin(this.w.time * 2 + this.col.min.x) * .02; this.mat.uniforms.uTime.value = this.w.time; }
}

class Bramble {
  constructor(w, x, z0, z1, o) {
    this.w = w; this.pos = new THREE.Vector3(x, 0, (z0 + z1) / 2); this.burnt = false; this.k = 0; this.y = o.y || 0;
    this.col = w.add(new Box(x - .4, this.y, z0, x + .4, this.y + (o.h || 2.4), z1, { kind: 'bramble', climbable: false }));
    const parts = [], M = w.M;
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: .7, emissive: 0x000000, transparent: true });
    this.mat = mat;
    for (let i = 0; i < 26; i++) {
      const pts = []; let p = new THREE.Vector3(x + rr(-.3, .3), this.y, rr(z0, z1));
      for (let k = 0; k < 6; k++) { pts.push(p.clone()); p = p.clone().add(new THREE.Vector3(rr(-.35, .35), rr(.2, .55), rr(-.35, .35))); }
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, rr(.02, .05), 5), mat); tube.castShadow = true; g.add(tube);
      for (let k = 0; k < 6; k++) { const th = new THREE.Mesh(new THREE.ConeGeometry(.015, .1, 4), mat); const q = pts[1 + (k % 4)]; th.position.copy(q).add(new THREE.Vector3(rr(-.05, .05), rr(-.1, .1), rr(-.05, .05))); th.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); g.add(th); }
    }
    w.scene.add(g); this.mesh = g;
  }
  burn() { if (this.burnt) return; this.burnt = true; this.col.active = false; }
  update(dt) {
    if (this.burnt && this.k < 1) {
      this.k = Math.min(1, this.k + dt * .7);
      this.mat.emissive.setRGB(1.5 * (1 - this.k) * Math.min(1, this.k * 5), .4 * (1 - this.k) * Math.min(1, this.k * 5), 0);
      this.mat.opacity = 1 - this.k; this.mesh.scale.y = 1 - this.k * .6;
      if (Math.random() < .7) this.w.game.fx.ember(this.pos.x + rr(-.3, .3), this.y + rr(0, 2), this.pos.z + rr(-1.5, 1.5));
      if (this.k >= 1) this.mesh.visible = false;
    }
  }
  save() { return [this.burnt, this.k]; }
  load(s) { this.burnt = s[0]; this.k = s[1]; this.col.active = !this.burnt; this.mesh.visible = this.k < 1; this.mat.opacity = 1 - this.k; this.mesh.scale.y = 1 - this.k * .6; this.mat.emissive.setRGB(0, 0, 0); }
}

class Fence {
  // grillage : bloque les loups ; traversable seulement avec « Pas d'ombre »
  constructor(w, x, z0, z1, h, o) {
    this.w = w; this.col = w.add(new Box(x - .06, o.y || 0, z0, x + .06, (o.y || 0) + h, z1, { kind: 'phase', climbable: !!o.climbable, surface: 'metal' }));
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    g.strokeStyle = '#b8b8b8'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(64, 64); g.moveTo(64, 0); g.lineTo(0, 64); g.stroke();
    const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set((z1 - z0) * 3, h * 3);
    const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: .5, color: 0x5a5a5a, metalness: .6, roughness: .5, side: THREE.DoubleSide });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(z1 - z0, h), mat); m.rotation.y = Math.PI / 2; m.position.set(x, (o.y || 0) + h / 2, (z0 + z1) / 2); m.castShadow = true; w.scene.add(m);
    for (let z = z0; z <= z1 + .01; z += Math.max(1, (z1 - z0) / 3)) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, h + .2, 8), w.M.rust); p.position.set(x, (o.y || 0) + h / 2, z); p.castShadow = true; w.scene.add(p); }
    this.mesh = m;
  }
}

class Memory {
  constructor(w, id, x, y, z) {
    this.w = w; this.id = id; this.pos = new THREE.Vector3(x, y, z); this.taken = false; this.range = 1.1;
    const g = this.mesh = new THREE.Group(); g.position.copy(this.pos); w.scene.add(g);
    const M = w.M;
    // objet-souvenir selon l'id
    if (id === 'dessin') {
      const c = document.createElement('canvas'); c.width = 128; c.height = 96; const x2 = c.getContext('2d');
      x2.fillStyle = '#e8e0d0'; x2.fillRect(0, 0, 128, 96); x2.lineWidth = 3; x2.strokeStyle = '#333';
      x2.beginPath(); x2.arc(40, 40, 10, 0, 7); x2.stroke(); x2.beginPath(); x2.moveTo(40, 50); x2.lineTo(40, 75); x2.stroke();
      x2.strokeStyle = '#c22'; x2.beginPath(); x2.arc(80, 46, 8, 0, 7); x2.stroke(); x2.fillStyle = '#c22'; x2.fillRect(74, 54, 12, 20);
      x2.strokeStyle = '#333'; x2.beginPath(); x2.moveTo(48, 60); x2.lineTo(74, 60); x2.stroke(); x2.fillStyle = '#e9b'; x2.fillRect(100, 8, 20, 20);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(.36, .27), new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 1 })); m.rotation.set(-1.2, 0, .3); m.position.y = .03; g.add(m);
    } else if (id === 'boite') {
      const b = new THREE.Mesh(new THREE.BoxGeometry(.22, .14, .16), M.woodDark); b.position.y = .07; g.add(b);
      const l = new THREE.Mesh(new THREE.BoxGeometry(.22, .02, .16), M.woodDark); l.position.set(-.0, .17, -.06); l.rotation.x = -1; g.add(l);
      const d = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .08, 8), M.pale); d.position.y = .2; g.add(d);
    } else if (id === 'lapin') {
      const b = new THREE.Mesh(new THREE.SphereGeometry(.1, 12, 10), M.pale); b.position.y = .1; b.scale.set(1, 1.1, .9); g.add(b);
      const h = new THREE.Mesh(new THREE.SphereGeometry(.075, 12, 10), M.pale); h.position.set(.02, .24, 0); g.add(h);
      for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.CapsuleGeometry(.022, .1, 4, 6), M.pale); e.position.set(0, .35, s * .035); e.rotation.x = s * .25; g.add(e); }
    } else if (id === 'moufle') {
      const m = new THREE.Mesh(new THREE.SphereGeometry(.08, 12, 10), M.redCoat); m.scale.set(1.3, .5, 1); m.position.y = .04; g.add(m);
      const th = new THREE.Mesh(new THREE.SphereGeometry(.035, 8, 6), M.redCoat); th.position.set(.06, .04, .06); g.add(th);
    } else {
      const f = new THREE.Mesh(new THREE.BoxGeometry(.2, .26, .03), M.woodDark); f.position.y = .13; f.rotation.y = .4; g.add(f);
      const c = document.createElement('canvas'); c.width = 64; c.height = 80; const x2 = c.getContext('2d'); x2.fillStyle = '#c8bca8'; x2.fillRect(0, 0, 64, 80); x2.fillStyle = '#333'; x2.beginPath(); x2.arc(22, 32, 9, 0, 7); x2.fill(); x2.fillRect(14, 42, 16, 30); x2.fillStyle = '#a22'; x2.beginPath(); x2.arc(42, 38, 7, 0, 7); x2.fill(); x2.fillRect(35, 46, 14, 26);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const ph = new THREE.Mesh(new THREE.PlaneGeometry(.16, .21), new THREE.MeshBasicMaterial({ map: t })); ph.position.set(.0, .13, .017); ph.rotation.y = .4; ph.position.x = .006; g.add(ph);
    }
    g.traverse(m => { if (m.isMesh) m.castShadow = true; });
    this.light = new THREE.PointLight(0xffd6a0, 0, 2.5, 2); this.light.position.y = .3; g.add(this.light);
  }
  canInteract() { return !this.taken; }
  interact() { this.taken = true; this.w.game.onMemory(this.id, this.pos); return { anim: 'crouch', time: .7 }; }
  update(dt) {
    if (this.taken) { if (this.mesh.visible) { this.mesh.position.y += dt * .6; this.mesh.scale.multiplyScalar(1 - dt * 1.5); if (this.mesh.scale.x < .05) this.mesh.visible = false; } return; }
    this.light.intensity = 1.2 + Math.sin(this.w.time * 2) * .5;
    if (Math.random() < dt * 4) this.w.game.fx.mote(this.pos.x + rr(-.2, .2), this.pos.y + rr(0, .3), this.pos.z + rr(-.2, .2), [1, .85, .6]);
  }
  save() { return [this.taken]; }
  load(s) { if (s[0]) { this.taken = true; this.mesh.visible = false; } }
}

class Shrine {
  // autel du souvenir : débloque un pouvoir
  constructor(w, power, x, y, z, o) {
    this.w = w; this.power = power; this.pos = new THREE.Vector3(x, y, z); this.used = false; this.range = 1.3;
    const g = this.mesh = new THREE.Group(); g.position.copy(this.pos); w.scene.add(g);
    const M = w.M;
    const kind = o.kind || 'stump';
    if (kind === 'stump') { const s = new THREE.Mesh(new THREE.CylinderGeometry(.35, .45, .6, 12), M.bark); s.position.y = .3; g.add(s); }
    else { const s = new THREE.Mesh(new THREE.BoxGeometry(.6, .7, .5), M.woodDark); s.position.y = .35; g.add(s); }
    // ruban rouge noué
    const rib = new THREE.Mesh(new THREE.TorusGeometry(.14, .03, 8, 20), M.scarf); rib.position.y = kind === 'stump' ? .68 : .78; rib.rotation.x = Math.PI / 2; g.add(rib);
    this.rib = rib;
    for (const s of [-1, 1]) { const t = new THREE.Mesh(new THREE.PlaneGeometry(.06, .3), M.scarf); t.position.set(s * .08, rib.position.y - .15, .1); t.rotation.z = s * .3; g.add(t); }
    g.traverse(m => { if (m.isMesh) { m.castShadow = m.receiveShadow = true; } });
    w.add(new Box(x - .4, y, z - .4, x + .4, y + (kind === 'stump' ? .6 : .7), z + .4, { surface: 'wood' }));
    this.light = new THREE.PointLight(0xff5530, 2, 4, 2); this.light.position.y = 1; g.add(this.light);
  }
  canInteract() { return !this.used; }
  interact() { this.used = true; this.w.game.unlockPower(this.power, this.pos); return { anim: 'cast', time: 2.2 }; }
  update(dt) {
    if (this.used) { this.light.intensity = damp(this.light.intensity, 0, 2, dt); this.rib.visible = false; return; }
    this.light.intensity = 2 + Math.sin(this.w.time * 3) * .8;
    if (Math.random() < dt * 6) this.w.game.fx.ember(this.pos.x + rr(-.2, .2), this.pos.y + .8, this.pos.z + rr(-.2, .2), .4);
  }
  save() { return [this.used]; }
  load(s) { this.used = s[0]; this.rib.visible = !this.used; }
}

class Item {
  // objet transportable (fusible, manteau rouge…)
  constructor(w, kind, x, y, z, o) {
    this.w = w; this.kind = kind; this.pos = new THREE.Vector3(x, y, z); this.home = this.pos.clone(); this.carried = false; this.placed = false; this.range = 1;
    const g = this.mesh = new THREE.Group(); w.scene.add(g); g.position.copy(this.pos);
    if (kind === 'fusible') {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .3, 12), new THREE.MeshStandardMaterial({ color: 0xc8b878, roughness: .3, metalness: .6, emissive: 0x332200 })); b.rotation.z = Math.PI / 2; b.position.y = .07; g.add(b);
      for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(.075, .075, .05, 12), w.M.darkIron); c.rotation.z = Math.PI / 2; c.position.set(s * .15, .07, 0); g.add(c); }
      this.light = new THREE.PointLight(0xffcc66, 1, 2, 2); this.light.position.y = .3; g.add(this.light);
    } else if (kind === 'manteau') {
      const coat = new THREE.Mesh(new THREE.ConeGeometry(.2, .45, 12, 1, true), w.M.redCoat); coat.position.y = .25; g.add(coat);
      for (const s of [-1, 1]) { const sl = new THREE.Mesh(new THREE.CapsuleGeometry(.04, .2, 4, 8), w.M.redCoat); sl.position.set(0, .3, s * .16); sl.rotation.x = s * .5; g.add(sl); }
      this.light = new THREE.PointLight(0xff6040, 1.5, 3, 2); this.light.position.y = .5; g.add(this.light);
    }
    g.traverse(m => { if (m.isMesh) m.castShadow = true; });
  }
  canInteract(p) { return !this.carried && !this.placed && !p.carrying; }
  interact(p) { this.carried = true; p.carrying = this; this.w.game.audio.play('chime'); return { anim: 'crouch', time: .5 }; }
  drop(p) { this.carried = false; p.carrying = null; this.pos.set(p.pos.x + p.facing * .4, p.pos.y, p.pos.z); this.mesh.position.copy(this.pos); this.mesh.rotation.set(0, 0, 0); }
  update(dt, p) {
    if (this.carried && p) {
      const s = p.model.carrySlot; const v = new THREE.Vector3(); s.getWorldPosition(v);
      this.mesh.position.copy(v); this.mesh.rotation.y = p.model.yawGroup.rotation.y; this.pos.copy(v);
    } else if (this.light && !this.placed) this.light.intensity = 1 + Math.sin(this.w.time * 3) * .4;
  }
  save() { return [this.carried, this.placed, this.pos.x, this.pos.y, this.pos.z]; }
  load(s) {
    const p = this.w.game.player;
    if (this.carried && p && p.carrying === this) p.carrying = null;
    this.carried = false; this.placed = s[1];
    if (s[0]) this.pos.copy(this.home); else this.pos.set(s[2], s[3], s[4]);
    this.mesh.position.copy(this.pos); this.mesh.visible = !this.placed || this.keepVisible;
  }
}

class Socket {
  constructor(w, kind, x, y, z, o) {
    this.w = w; this.kind = kind; this.pos = new THREE.Vector3(x, y, z); this.filled = false; this.target = o.target; this.range = 1.1; this.onFill = o.onFill;
    const g = this.mesh = new THREE.Group(); g.position.copy(this.pos); w.scene.add(g);
    if (kind === 'fusible') {
      const box = new THREE.Mesh(new THREE.BoxGeometry(.5, .6, .2), w.M.darkIron); box.position.y = .3; g.add(box);
      this.lamp = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0x331100 })); this.lamp.position.set(0, .52, .12); g.add(this.lamp);
    }
  }
  canInteract(p) { return !this.filled && p.carrying && p.carrying.kind === this.kind; }
  interact(p) {
    const it = p.carrying; it.carried = false; it.placed = true; p.carrying = null; it.mesh.visible = this.kind !== 'fusible'; this.filled = true;
    if (this.lamp) this.lamp.material.color.set(0xffaa44);
    this.w.game.audio.play('lever');
    const t = this.w.byId[this.target]; if (t) t.setOpen(true);
    if (this.onFill) this.onFill(this.w, p);
    return { anim: 'push', time: .6 };
  }
  save() { return [this.filled]; }
  load(s) { this.filled = s[0]; if (this.lamp) this.lamp.material.color.set(this.filled ? 0xffaa44 : 0x331100); }
}

export { Crate, Gate };
