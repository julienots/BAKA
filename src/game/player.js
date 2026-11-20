// Contrôleur de Mio : déplacement 3D (gauche-droite + profondeur), saut, escalade, poussée, cachette, interactions
import * as THREE from 'three';
import { MioModel } from './mio.js';
import { PLAYER } from './world.js';
import { clamp, damp, angleLerp, smooth as smoothT } from '../core/util.js';

export const TUNING = {
  walk: 1.3, run: 3.3, depthFactor: .85, accel: 16, airAccel: 7, gravity: 22, jumpV: 6.3, coyote: .12, jumpBuffer: .14,
  climbMin: .3, climbMax: 1.65, climbTime: .72, pushSpeed: .95, crouchH: .72, killY: -8,
};

export class Player {
  constructor(game) {
    this.game = game;
    this.model = new MioModel();
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.hw = PLAYER.hw; this.hd = PLAYER.hd; this.h = PLAYER.h; this.zClamp = true;
    this.facing = 1; this.yaw = 0; this.grounded = false; this.wasGrounded = false;
    this.state = 'normal'; this.anim = 'idle'; this.coyote = 0; this.jumpBuf = 0; this.landT = 0; this.fallFrom = 0;
    this.climb = null; this.lock = 0; this.lockAnim = null; this.crouch = false; this.hidden = false; this.fear = 0;
    this.carrying = null; this.surface = 'dirt'; this.stepPhase = 0; this.invuln = 0; this.dashing = 0; this.control = true;
    this.cine = null; this.speed01 = 0; this.ghost = false; this.airT = 0; this.exert = 0; this.hang = null; this.ladder = null; this.jumpCut = false;
  }
  addTo(scene) { this.model.addTo(scene); }
  place(x, y, z, facing = 1) {
    this.pos.set(x, y, z); this.vel.set(0, 0, 0); this.facing = facing; this.yaw = facing > 0 ? 0 : Math.PI; this.state = 'normal';
    this.climb = null; this.hang = null; this.ladder = null; this.lock = 0; this.crouch = false; this.dashing = 0; this.invuln = .5; this.grounded = false; this.wasGrounded = false;
    this.model.root.position.copy(this.pos); this.model.yawGroup.rotation.y = this.yaw; this.model.resetCloth(); this.fallFrom = y;
    if (this.prevPos) { this.prevPos.copy(this.pos); this.prevYaw = this.yaw; }
  }
  die(cause) {
    if (this.state === 'dead' || this.invuln > 0 || this.game.godMode) return false;
    this.state = 'dead'; this.deadT = 0; this.vel.set(0, 0, 0); this.cause = cause;
    if (this.carrying) this.carrying.drop(this);
    this.game.audio.play(cause === 'water' ? 'splash' : 'death'); this.game.input.vibrate(200); this.game.shake(.5);
    return true;
  }
  update(dt, input) {
    const w = this.game.world, T = TUNING;
    if (!this.prevPos) { this.prevPos = this.pos.clone(); this.prevYaw = this.yaw; }
    this.prevPos.copy(this.pos); this.prevYaw = this.yaw;
    this.invuln = Math.max(0, this.invuln - dt);
    this.landT = Math.max(0, this.landT - dt * 4);
    let mx = this.control ? input.mx : 0, mz = this.control ? input.mz : 0, run = this.control && input.run;
    if (this.cine) { mx = this.cine.mx || 0; mz = this.cine.mz || 0; run = !!this.cine.run; }
    const a = { state: 'idle', speed: 0, vx: this.vel.x, vz: this.vel.z, vy: this.vel.y, fear: this.fear, landT: this.landT, groundY: this.pos.y, vxLocal: 0, climbT: 0 };

    if (this.state === 'dead') {
      this.deadT += dt; this.vel.y -= T.gravity * dt; this.vel.x *= .9; this.vel.z *= .9;
      w.moveBody(this, dt, 'player');
      a.state = 'dead'; this.finishAnim(dt, a, w);
      if (this.deadT > 1.6) this.game.respawn();
      return;
    }
    if (this.state === 'wake') {
      this.wakeT = Math.min(1, this.wakeT + dt * .35); a.state = 'wake'; a.wakeT = this.wakeT; this.finishAnim(dt, a, w);
      if (this.wakeT >= 1) this.state = 'normal';
      return;
    }
    if (this.state === 'climb') {
      const c = this.climb; c.t += dt / c.dur; const t = Math.min(1, c.t);
      // trajectoire : accroche (petit temps), traction verticale (accélère puis ralentit), puis avancée sur le rebord
      const ty = smoothT(clamp((t - .12) / .58, 0, 1)), tx = smoothT(clamp((t - .5) / .45, 0, 1));
      this.pos.y = c.from.y + (c.to.y - c.from.y) * ty;
      this.pos.x = c.from.x + (c.to.x - c.from.x) * tx; this.pos.z = c.from.z + (c.to.z - c.from.z) * tx;
      a.state = 'climb'; a.climbT = t; a.ledgeH = c.h; this.exert = Math.min(1, this.exert + dt * .6);
      if (t >= 1) { this.state = 'normal'; this.vel.set(0, 0, 0); this.grounded = true; this.wasGrounded = true; this.landT = .25; }
      this.finishAnim(dt, a, w); return;
    }
    if (this.state === 'hang') {
      const hg = this.hang; hg.t += dt; this.vel.set(0, 0, 0);
      const toward = hg.dx ? mx * hg.dx > .4 : hg.dz ? mz * hg.dz > .5 : false, up = mz < -.55 && !hg.dz, jump = this.control && input.pressed('jump');
      const down = (hg.dx && mx * hg.dx < -.4) || mz > .6;
      a.state = 'hang'; a.exert = Math.min(1, hg.t * .5);
      if (hg.t > .22 && (jump || up || (toward && hg.t > .38))) { this.startClimb(hg.to, 1.28, hg.dx, hg.dz); this.game.audio.play('climb'); }
      else if (hg.t > .2 && down) { this.state = 'normal'; this.hang = null; this.vel.set(-(hg.dx || 0) * 1, 0, -(hg.dz || 0)); this.fallFrom = this.pos.y; }
      this.finishAnim(dt, a, w); return;
    }
    if (this.state === 'ladder') { this.updateLadder(dt, input, mz, a, w); return; }
    if (this.lock > 0) {
      this.lock -= dt; this.vel.x = damp(this.vel.x, 0, 12, dt); this.vel.z = damp(this.vel.z, 0, 12, dt); this.vel.y -= T.gravity * dt;
      w.moveBody(this, dt, 'player');
      a.state = this.lockAnim || 'idle'; a.castK = 1;
      this.finishAnim(dt, a, w); return;
    }

    // ---------- entrée → vitesse cible
    const pw = this.game.powers;
    const casting = pw && pw.casting;
    let maxS = (run ? T.run : T.walk) * (this.carrying ? .75 : 1) * (this.crouch ? .55 : 1) * (casting ? .35 : 1);
    const mag = Math.min(1, Math.hypot(mx, mz));
    let tx = mx * maxS, tz = mz * maxS * T.depthFactor;
    if (this.dashing > 0) { this.dashing -= dt; tx = this.dashV.x; tz = this.dashV.z; }
    const acc = this.grounded ? T.accel : T.airAccel;
    this.vel.x = damp(this.vel.x, tx, acc * (this.dashing > 0 ? 4 : 1), dt);
    this.vel.z = damp(this.vel.z, tz, acc * (this.dashing > 0 ? 4 : 1), dt);
    if (this.dashing > 0) this.vel.y = Math.max(this.vel.y, 0); else this.vel.y -= T.gravity * dt;

    // saut (tampon + temps de grâce)
    this.coyote = this.grounded ? T.coyote : this.coyote - dt;
    if (this.control && input.pressed('jump')) this.jumpBuf = T.jumpBuffer; else this.jumpBuf -= dt;
    // accroupi automatique : cachette ou plafond bas
    const ix = Math.abs(this.vel.x) > .2 ? .22 : .02, iz = Math.abs(this.vel.z) > .2 ? .22 : .02;
    const lc = w.overlapAny(this.pos.x - this.hw - ix, this.pos.y + T.crouchH, this.pos.z - this.hd - iz, this.pos.x + this.hw + ix, this.pos.y + PLAYER.h, this.pos.z + this.hd + iz, 'player');
    const lowCeil = lc && lc.min.y > this.pos.y + T.crouchH - .02;
    const wantCrouch = !!lowCeil || (w.inHide(this.pos, true) && !run && !this.carrying);
    this.crouch = wantCrouch; this.h = this.crouch ? T.crouchH : PLAYER.h;

    // escalade : on vérifie d'abord le rebord devant soi
    const dirX = Math.abs(mx) > .35 ? Math.sign(mx) : 0, dirZ = Math.abs(mz) > .55 ? Math.sign(mz) : 0;
    if (this.jumpBuf > 0 && !this.carrying && (dirX || dirZ)) { if (this.tryClimb(dirX, dirZ, true)) { this.jumpBuf = 0; this.finishAnim(dt, { ...a, state: 'climb' }, w); return; } }
    if (this.jumpBuf > 0 && this.coyote > 0 && !this.crouch) {
      this.vel.y = T.jumpV * (this.carrying ? .8 : 1); this.jumpBuf = 0; this.coyote = 0; this.grounded = false; this.game.audio.play('jump'); this.fallFrom = this.pos.y; this.jumpCut = false;
    }
    // saut à hauteur variable : relâcher tôt coupe l'élan
    if (!this.grounded && this.vel.y > 1.5 && !this.jumpCut && this.control && !input.held('jump') && this.dashing <= 0) { this.vel.y *= .55; this.jumpCut = true; }
    // échelle : pousser vers le haut (ou vers le bas depuis le haut) à côté d'une échelle
    if (!this.carrying && w.ladders) for (const L of w.ladders) {
      const nearX = Math.abs(this.pos.x - L.x) < .45, nearZ = Math.abs(this.pos.z - L.z) < .7;
      if (nearX && nearZ && mz < -.55 && this.pos.y >= L.y0 - .3 && this.pos.y < L.y1 - .2) { this.startLadder(L); this.finishAnim(dt, { ...a, state: 'ladder' }, w); return; }
      if (Math.abs(this.pos.x - L.x) < .45 && Math.abs(this.pos.z - (L.z - .55)) < .45 && Math.abs(this.pos.y - L.y1) < .1 && mz > .55 && this.grounded) { this.startLadder(L, true); this.finishAnim(dt, { ...a, state: 'ladder' }, w); return; }
    }

    // ---------- déplacement + collisions
    const before = this.pos.clone(), wasG = this.grounded;
    const res = w.moveBody(this, dt, 'player');
    // traversée des grillages pendant le Pas d'ombre
    // poussée de caisses
    let pushing = false;
    const pushCol = (res.hitX && res.hitX.kind === 'crate' && this.grounded) ? ['x', res.hitX] : (res.hitZ && res.hitZ.kind === 'crate' && this.grounded) ? ['z', res.hitZ] : null;
    if (pushCol && !this.carrying) {
      const crate = pushCol[1].ref, ax = pushCol[0];
      const wantDir = ax === 'x' ? mx : mz;
      // la caisse doit être au même niveau (pas sous les pieds)
      if (crate && Math.abs(wantDir) > .3 && crate.pos.y < this.pos.y + .5 && crate.pos.y + crate.h > this.pos.y + .2) {
        if (!crate.heavy) {
          const sp = T.pushSpeed * Math.sign(wantDir);
          const moved = crate.tryPush(ax === 'x' ? sp : 0, ax === 'z' ? sp : 0, dt);
          if (moved > 0) { if (ax === 'x') this.pos.x += moved * Math.sign(wantDir) * .98; else this.pos.z += moved * Math.sign(wantDir) * .98; }
        }
        pushing = true; this.pushDir = ax === 'x' ? Math.sign(wantDir) : 0;
      }
    }
    // escalade automatique en l'air contre un rebord
    if (!this.grounded && (res.hitX || res.hitZ) && this.vel.y < 2 && !this.carrying) {
      if (this.tryClimb(res.hitX ? Math.sign(mx || this.facing) : 0, res.hitZ ? Math.sign(mz) : 0, false)) { this.finishAnim(dt, { ...a, state: 'climb' }, w); return; }
    }
    // atterrissage
    if (this.grounded) this.airT = 0; else this.airT += dt;
    this.exert = clamp(this.exert + (this.speed01 > .7 || pushing ? dt * .12 : -dt * .08), 0, 1);
    if (this.grounded && !wasG) {
      const h = this.fallFrom - this.pos.y; this.landT = clamp(h / 1.6, .25, 1);
      this.game.audio.play('land', { k: clamp(h / 2, .3, 1.2) }); if (h > 1.2) { this.game.input.vibrate(25); this.game.shake(.08); }
      if (this.game.physics && h > .4) this.game.physics.blast(new THREE.Vector3(this.pos.x, this.pos.y, this.pos.z), .9 + h * .25, Math.min(1.5, h * .5)); // l'impact fait sauter les petits objets
    }
    if (!this.grounded && wasG) this.fallFrom = this.pos.y;
    if (!this.grounded && this.vel.y > 0) this.fallFrom = Math.max(this.fallFrom, this.pos.y);
    if (this.grounded && this.groundCol) this.surface = this.groundCol.surface;
    // eau
    for (const wa of w.waters) {
      if (wa.contains(this.pos)) { this.surface = 'water'; if (wa.y - this.pos.y > .45 && this.dashing <= 0) this.die('water'); }
    }
    if (this.pos.y < T.killY) this.die('fall');
    this.hidden = w.inHide(this.pos, this.crouch);

    // orientation (lacet) : face au mouvement, y compris en diagonale
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (mag > .15 && !pushing) {
      this.yawTarget = Math.atan2(-mz * T.depthFactor, mx);
      if (Math.abs(mx) > .2) this.facing = Math.sign(mx);
    } else if (pushing && this.pushDir) this.yawTarget = this.pushDir > 0 ? 0 : Math.PI;
    if (this.yawTarget !== undefined) this.yaw = angleLerp(this.yaw, this.yawTarget, 1 - Math.exp(-(this.grounded ? 10 : 5) * dt));

    // pas
    this.speed01 = clamp((sp - .2) / (T.run - .2), 0, 1);
    if (this.grounded && sp > .3) {
      this.stepPhase += dt * (5.5 + this.speed01 * 6) / Math.PI;
      if (this.stepPhase > 1) { this.stepPhase -= 1; this.game.audio.step(this.surface, this.speed01 > .5); this.footSide = -(this.footSide || 1); if (this.game.details) this.game.details.footstep(this.pos, this.yaw, this.surface, this.footSide); if (this.speed01 > .6 && Math.random() < .3) this.game.fx.dust(this.pos.x, this.pos.y, this.pos.z); }
    }

    // état d'animation
    if (!this.grounded) a.state = 'air';
    else if (casting) { a.state = 'cast'; a.castK = pw.castK; }
    else if (pushing) a.state = 'push';
    else if (this.latching) a.state = 'latch';
    else if (this.crouch) a.state = 'crouch';
    else if (this.carrying) a.state = 'carry';
    else if (sp > .25) a.state = 'move';
    else a.state = 'idle';
    a.speed = a.state === 'move' || a.state === 'carry' ? Math.max(.15, this.speed01) : 0;
    if (a.state === 'carry' && sp < .25) a.speed = 0;
    a.vx = this.vel.x; a.vz = this.vel.z; a.vy = this.vel.y; a.airT = this.airT; a.exert = this.exert; a.grounded = this.grounded;
    this.finishAnim(dt, a, w);
  }
  tryClimb(dx, dz, fromGround) {
    const w = this.game.world, T = TUNING;
    if (!dx && !dz) return false;
    const probe = .22;
    const px = this.pos.x + dx * (this.hw + probe), pz = this.pos.z + dz * (this.hd + probe);
    // trouver la boîte devant les mains
    let best = null;
    for (const c of w.colliders) {
      if (!w.solid(c) || !c.climbable) continue;
      if (px > c.min.x - .02 && px < c.max.x + .02 && pz > c.min.z - .02 && pz < c.max.z + .02) {
        const dh = c.max.y - this.pos.y;
        const maxH = fromGround ? T.climbMax : 2.15;
        if (dh >= T.climbMin && dh <= maxH && (!best || c.max.y > best.max.y)) best = c;
      }
    }
    if (!best) return false;
    const dh = best.max.y - this.pos.y;
    if (fromGround && !this.grounded && this.coyote <= 0 && dh > 1.1) return false;
    // destination libre ?
    const tx = dx ? clamp(this.pos.x + dx * (this.hw + .3), best.min.x + this.hw, best.max.x - this.hw) : this.pos.x;
    const tz = dz ? clamp(this.pos.z + dz * (this.hd + .3), best.min.z + this.hd, best.max.z - this.hd) : this.pos.z;
    const ty = best.max.y + .001;
    if (w.overlapAny(tx - this.hw, ty, tz - this.hd, tx + this.hw, ty + T.crouchH, tz + this.hd, 'player')) return false;
    if (best.ref && best.ref.heavy === false && dh < .35) return false;
    if (dx) this.facing = dx; this.yawTarget = dx ? (dx > 0 ? 0 : Math.PI) : (dz > 0 ? -Math.PI / 2 : Math.PI / 2);
    const to = new THREE.Vector3(tx, ty, tz);
    if (!fromGround && dh > 1.3) {
      // rebord haut : Mio s'y suspend d'abord par les mains
      this.state = 'hang'; this.hang = { t: 0, to, dx, dz }; this.vel.set(0, 0, 0);
      this.pos.y = best.max.y - 1.28; this.yaw = this.yawTarget;
      this.game.audio.play('grabLedge'); this.game.input.vibrate(15);
      return true;
    }
    this.startClimb(to, dh, dx, dz);
    this.game.audio.play('climb');
    return true;
  }
  startClimb(to, h, dx, dz) {
    this.state = 'climb'; this.hang = null; this.vel.set(0, 0, 0);
    this.climb = { t: 0, from: this.pos.clone(), to: to.clone(), h, dur: .42 + h * .3 };
  }
  startLadder(L, fromTop = false) {
    this.state = 'ladder'; this.ladder = L; this.vel.set(0, 0, 0); this.ladderP = 0;
    this.pos.x = L.x; this.pos.z = L.z + .26; if (fromTop) this.pos.y = L.y1 - .9;
    this.yaw = Math.PI / 2; this.game.audio.play('ladder');
  }
  updateLadder(dt, input, mz, a, w) {
    const L = this.ladder, jump = this.control && input.pressed('jump');
    const vy = clamp(-mz, -1, 1) * 1.45; this.yaw = Math.PI / 2;
    this.pos.y = clamp(this.pos.y + vy * dt, L.y0 - .05, L.y1 + .1);
    const before = this.ladderP; this.ladderP += vy * dt / .32 * Math.PI;
    if (Math.floor(before / Math.PI) !== Math.floor(this.ladderP / Math.PI)) this.game.audio.play('ladder');
    a.state = 'ladder'; a.ladderP = this.ladderP; a.exert = .5;
    if (vy > 0 && this.pos.y > L.y1 - 1.05) { this.startClimb(new THREE.Vector3(L.x, L.y1 + .001, L.z - .45), 1.0, 0, -1); this.ladder = null; this.yawTarget = Math.PI / 2; }
    else if ((vy < 0 && this.pos.y <= L.y0 + .01) || jump) {
      this.state = 'normal'; this.ladder = null; this.yawTarget = 0;
      if (jump) { this.vel.set(0, 3.5, 2); this.grounded = false; this.fallFrom = this.pos.y; }
    }
    this.finishAnim(dt, a, w);
  }
  startLock(anim, time) { this.lock = time; this.lockAnim = anim; }
  finishAnim(dt, a, w) {
    a.groundY = this.pos.y;
    a.vxLocal = this.vel.x * Math.cos(this.yaw) - this.vel.z * Math.sin(this.yaw);
    a.fear = this.fear;
    // le personnage est animé au rythme de l'écran (interpolé) ; en simulation pure, au rythme de la logique
    a.groundFn = this.groundFn || (this.groundFn = (x, z, y) => w.groundHeight(x, z, y, .06).y);
    // cible du regard : ennemi menaçant le plus proche, sinon objet interactif proche
    let look = null, best = 64;
    for (const e of this.game.enemies) { if (!e.pos || (e.mesh && !e.mesh.visible) || e.state === 'dormant' || e.state === 'gone') continue; const d = e.pos.distanceToSquared(this.pos); if (d < best) { best = d; look = e.kind === 'hand' && e.tip ? e.tip : e.pos; } }
    if (!look && w.nearestInteract) { const it = w.nearestInteract(this); if (it && it.pos) look = it.pos; }
    a.look = look;
    this.animA = a; this.animWind = w.windX;
    if (!this.game.animInRender) {
      this.model.root.position.copy(this.pos); this.model.yawGroup.rotation.y = this.yaw;
      this.model.animate(dt, a, w.windX);
    }
  }
}
