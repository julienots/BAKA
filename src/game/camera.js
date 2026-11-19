// Caméra cinématique latérale : suit Mio en douceur, cadrages par zones, tremblements, travellings
import * as THREE from 'three';
import { damp, clamp, lerp } from '../core/util.js';

export class CameraRig {
  constructor(camera) {
    this.cam = camera; this.pos = new THREE.Vector3(0, 2, 12); this.look = new THREE.Vector3();
    this.def = { dist: 11, height: 1.7, look: 1.2, fov: 34, ahead: 1.6, xOff: 0, zLook: 0 };
    this.cur = { ...this.def }; this.shakeK = 0; this.override = null; this.t = 0;
  }
  snap(target, zones) { this.update(0, target, zones, true); }
  shake(k) { this.shakeK = Math.min(1.2, this.shakeK + k); }
  update(dt, target, zones, snap = false) {
    this.t += dt;
    // zone active
    let z = this.def;
    for (const zz of zones) if (target.x >= zz.x0 && target.x < zz.x1) { z = { ...this.def, ...zz }; break; }
    if (this.override) z = { ...z, ...this.override };
    const k = snap ? 1e3 : (z.ease || 1.6);
    for (const key of ['dist', 'height', 'look', 'fov', 'ahead', 'xOff', 'zLook']) this.cur[key] = snap ? z[key] : damp(this.cur[key], z[key], k, dt);
    const c = this.cur;
    const fx = z.fixX !== undefined ? z.fixX : target.x + c.ahead * (target.facing || 1) + c.xOff;
    const ty = z.fixY !== undefined ? z.fixY : target.y;
    const desired = new THREE.Vector3(fx, ty + c.height, target.z * .35 + c.dist);
    const look = new THREE.Vector3(fx, ty + c.look, target.z * .5 + c.zLook);
    if (snap) { this.pos.copy(desired); this.look.copy(look); }
    else {
      this.pos.x = damp(this.pos.x, desired.x, 2.4, dt); this.pos.y = damp(this.pos.y, desired.y, 2.0, dt); this.pos.z = damp(this.pos.z, desired.z, 2.0, dt);
      this.look.x = damp(this.look.x, look.x, 3, dt); this.look.y = damp(this.look.y, look.y, 2.4, dt); this.look.z = damp(this.look.z, look.z, 2.4, dt);
    }
    this.shakeK = Math.max(0, this.shakeK - dt * 1.8);
    const s = this.shakeK * this.shakeK * .25, t = this.t;
    // léger mouvement « caméra à l'épaule »
    const hand = .02;
    this.cam.position.set(this.pos.x + Math.sin(t * 37) * s + Math.sin(t * .5) * hand, this.pos.y + Math.sin(t * 43 + 1) * s + Math.sin(t * .7) * hand, this.pos.z);
    this.cam.lookAt(this.look.x + Math.sin(t * 29) * s * .5, this.look.y, this.look.z);
    if (Math.abs(this.cam.fov - c.fov) > .01) { this.cam.fov = c.fov; this.cam.updateProjectionMatrix(); }
  }
}
