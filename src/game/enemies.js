// Créatures : les Loups (la culpabilité), la Présence (projecteur), la Main, les Ombres (souvenirs déformés)
import * as THREE from 'three';
import { getMaterials } from '../core/materials.js';
import { clamp, damp, rr, angleLerp, lerp } from '../core/util.js';
import { mergeChildren } from '../core/batch.js';

const v3 = () => new THREE.Vector3();
function eyeMat(col = 0xd8d0a0) { return new THREE.MeshBasicMaterial({ color: col }); }

// ================================================================ LOUP
export class Wolf {
  constructor(game, o) {
    this.game = game; const M = getMaterials();
    this.spawn = new THREE.Vector3(o.x, o.y || 0, o.z); this.home = this.spawn.clone();
    this.pos = this.spawn.clone(); this.vel = v3(); this.hw = .28; this.hd = .28; this.h = .8; this.stepH = .45; this.grounded = false;
    this.speed = o.speed || 3.4; this.state = o.state || 'dormant'; this.yaw = o.yaw ?? 0; this.t = Math.random() * 10; this.scared = 0; this.stun = 0;
    this.leaveOnScare = !!o.leave; this.delay = o.delay || 0; this.kind = 'wolf';
    // ---- modèle procédural (corps maigre, longues pattes)
    const g = this.mesh = new THREE.Group(); const body = this.body = new THREE.Group(); g.add(body);
    const fur = M.wolf;
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.2, .6, 6, 12), fur); torso.rotation.z = Math.PI / 2; torso.position.y = .62; torso.scale.set(1, 1, .8); body.add(torso);
    const chest = new THREE.Mesh(new THREE.SphereGeometry(.25, 14, 10), fur); chest.position.set(.32, .66, 0); chest.scale.set(1.1, 1.15, .85); body.add(chest);
    // échine osseuse
    for (let i = 0; i < 7; i++) { const s = new THREE.Mesh(new THREE.ConeGeometry(.035, .12, 5), fur); s.position.set(-.35 + i * .11, .84 + Math.sin(i * .7) * .02, 0); body.add(s); }
    const neck = this.neck = new THREE.Group(); neck.position.set(.48, .74, 0); body.add(neck);
    const nk = new THREE.Mesh(new THREE.CapsuleGeometry(.12, .2, 4, 10), fur); nk.rotation.z = -1.0; nk.position.set(.1, .05, 0); neck.add(nk);
    const head = this.head = new THREE.Group(); head.position.set(.24, .1, 0); neck.add(head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(.14, 14, 10), fur); skull.scale.set(1.1, .9, .85); head.add(skull);
    const snout = new THREE.Mesh(new THREE.ConeGeometry(.08, .3, 10), fur); snout.rotation.z = -Math.PI / 2; snout.position.set(.2, -.04, 0); head.add(snout);
    this.jaw = new THREE.Mesh(new THREE.ConeGeometry(.05, .24, 8), fur); this.jaw.rotation.z = -Math.PI / 2; this.jaw.position.set(.16, -.1, 0); head.add(this.jaw);
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(.045, .16, 6), fur); ear.position.set(-.04, .14, s * .07); ear.rotation.x = s * .2; head.add(ear);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(.018, 8, 6), eyeMat()); eye.position.set(.1, .03, s * .07); head.add(eye);
    }
    // queue
    this.tail = [];
    let parent = body; let pp = new THREE.Vector3(-.55, .7, 0);
    for (let i = 0; i < 4; i++) { const seg = new THREE.Group(); seg.position.copy(pp); parent.add(seg); const m = new THREE.Mesh(new THREE.CapsuleGeometry(.05 - i * .008, .12, 4, 6), fur); m.rotation.z = Math.PI / 2; m.position.x = -.08; seg.add(m); this.tail.push(seg); parent = seg; pp = new THREE.Vector3(-.16, 0, 0); }
    // pattes (2 segments)
    this.legs = [];
    for (const [x, s, ph] of [[.34, 1, 0], [.34, -1, Math.PI], [-.4, 1, Math.PI * .5], [-.4, -1, Math.PI * 1.5]]) {
      const hip = new THREE.Group(); hip.position.set(x, .6, s * .12); body.add(hip);
      const up = new THREE.Mesh(new THREE.CapsuleGeometry(.05, .26, 4, 8), fur); up.position.y = -.15; hip.add(up);
      const knee = new THREE.Group(); knee.position.y = -.3; hip.add(knee);
      const lo = new THREE.Mesh(new THREE.CapsuleGeometry(.035, .24, 4, 8), fur); lo.position.y = -.13; knee.add(lo);
      const paw = new THREE.Mesh(new THREE.SphereGeometry(.045, 8, 6), fur); paw.position.set(.03, -.27, 0); paw.scale.set(1.5, .6, 1); knee.add(paw);
      this.legs.push({ hip, knee, ph, front: x > 0 });
    }
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; } });
    // fusion des pièces rigides de chaque articulation (≈ 40 → 15 appels de dessin)
    const groups = []; g.traverse(o => { if (o.children.length > 1) groups.push(o); }); groups.forEach(mergeChildren);
    g.scale.setScalar(o.scale || 1.15);
    game.scene.add(g); g.visible = this.state !== 'dormant';
    this.phase = 0; this.growlT = 2;
    this.sync();
  }
  sync() { this.mesh.position.copy(this.pos); this.mesh.rotation.y = this.yaw; }
  wake(delay = 0) { if (this.state === 'dormant' || this.state === 'gone') { this.state = 'approach'; this.delay = delay; this.pos.copy(this.spawn); this.mesh.visible = true; } }
  scare(o, dur) {
    if (this.state === 'dormant' || this.state === 'gone' || this.state === 'sit') return;
    this.scared = dur; this.scareFrom = o.clone(); this.game.audio.play('growl', { x: this.pos.x });
    this.vel.y = 3;
  }
  knock(dir, f) { if (this.state === 'dormant' || this.state === 'gone') return; this.stun = .9; this.vel.x = dir.x * f; this.vel.z = dir.z * f; this.vel.y = 2.5; }
  update(dt) {
    const g = this.game, p = g.player, w = g.world;
    if (this.state === 'dormant' || this.state === 'gone') return;
    const ts = 1 - w.echoT * .72; dt *= ts; this.t += dt;
    if (this.delay > 0) { this.delay -= dt; return; }
    let tx = 0, tz = 0, sp = 0;
    const toP = v3().subVectors(p.pos, this.pos); toP.y = 0; const dist = toP.length();
    if (this.state === 'sit') {
      sp = 0;
    } else if (this.stun > 0) {
      this.stun -= dt; this.vel.x *= Math.exp(-3 * dt); this.vel.z *= Math.exp(-3 * dt);
    } else if (this.scared > 0) {
      this.scared -= dt; const away = v3().subVectors(this.pos, this.scareFrom); away.y = 0; away.normalize();
      // fuit vers le fond de l'écran
      away.z -= .8; away.normalize(); tx = away.x; tz = away.z; sp = this.speed * 1.4;
      if (this.leaveOnScare && this.pos.z < w.zMin - 4) { this.state = 'gone'; this.mesh.visible = false; return; }
    } else if (this.state === 'approach' || this.state === 'chase') {
      this.state = 'chase';
      const unreachable = p.pos.y > this.pos.y + .95 || p.state === 'climb' && p.climb.to.y > this.pos.y + .95;
      if (p.state === 'dead') { sp = 0; }
      else if (unreachable && dist < 3) {
        // tourne en rond sous le joueur en grognant
        const a = this.t * 1.3; tx = toP.x / dist + Math.cos(a) * .9; tz = toP.z / dist + Math.sin(a) * .9; sp = this.speed * .4;
        if (dist < 1) { tx = -toP.x; tz = -toP.z; }
        this.growlT -= dt; if (this.growlT < 0) { g.audio.play('growl', { x: this.pos.x }); this.growlT = 2 + Math.random() * 2; }
      } else {
        tx = toP.x / (dist || 1); tz = toP.z / (dist || 1); sp = this.speed * (dist > 6 ? 1.15 : 1);
        if (dist < 1.6 && p.invuln <= 0 && !unreachable) sp *= 1.4; // bond final
        if (dist < .75 && Math.abs(p.pos.y - this.pos.y) < .7 && !unreachable && p.invuln <= 0) {
          if (p.die('wolf')) { g.audio.play('bite', { x: this.pos.x }); this.lunge = .4; }
        }
      }
    }
    if (this.stun <= 0) {
      this.vel.x = damp(this.vel.x, tx * sp, 6, dt); this.vel.z = damp(this.vel.z, tz * sp, 6, dt);
    }
    this.vel.y -= 22 * dt;
    const res = w.moveBody(this, dt, 'enemy');
    // contournement simple des obstacles
    if ((res.hitX || res.hitZ) && sp > 0) { this.vel.z += (this.pos.z > (res.hitX ? (res.hitX.min.z + res.hitX.max.z) / 2 : 0) ? 1 : -1) * 2; }
    if (this.pos.y < -10) { this.state = 'gone'; this.mesh.visible = false; }
    // orientation & animation
    const s = Math.hypot(this.vel.x, this.vel.z);
    if (s > .2) this.yaw = angleLerp(this.yaw, Math.atan2(-this.vel.z, this.vel.x), 1 - Math.exp(-8 * dt));
    else if (dist > 0) this.yaw = angleLerp(this.yaw, Math.atan2(-toP.z, toP.x), 1 - Math.exp(-3 * dt));
    const prevPh = this.phase; this.phase += dt * (2 + s * 3.2);
    if (s > 1 && Math.floor(prevPh / Math.PI) !== Math.floor(this.phase / Math.PI)) this.game.audio.play('paw', { x: this.pos.x });
    if (this.state === 'chase' && s > 1) { this.pantT = (this.pantT || 0) - dt; if (this.pantT < 0) { this.game.audio.play('pant', { x: this.pos.x }); this.pantT = 1.5 + Math.random(); } }
    const gal = clamp(s / 4, 0, 1);
    for (const L of this.legs) {
      const a = Math.sin(this.phase + L.ph * (gal > .6 ? .5 : 1));
      L.hip.rotation.z = a * (.35 + gal * .5) * (L.front ? 1 : -1) * -1;
      L.knee.rotation.z = (L.front ? 1 : -1) * Math.max(0, -Math.cos(this.phase + L.ph)) * (.4 + gal * .6) * (L.front ? -1 : 1);
    }
    this.body.position.y = Math.abs(Math.sin(this.phase)) * .05 * gal;
    this.body.rotation.z = Math.sin(this.phase * 2) * .04 * gal + (this.state === 'sit' ? .5 : 0);
    // tête basse en chasse, saccades dérangeantes
    const twitch = Math.sin(this.t * 13) * Math.sin(this.t * 3.1) > .9 ? (Math.random() - .5) * .4 : 0;
    this.neck.rotation.z = (this.state === 'chase' ? -.45 : -.1) + twitch + (this.state === 'sit' ? -.3 : 0);
    this.jaw.rotation.z = -Math.PI / 2 - (this.lunge > 0 ? .5 : Math.max(0, Math.sin(this.t * 7)) * .15);
    if (this.lunge > 0) this.lunge -= dt;
    this.tail.forEach((t, i) => { t.rotation.z = -.25 + Math.sin(this.t * 3 + i * .7) * .12 * (1 + gal) - (this.scared > 0 ? .5 : 0); t.rotation.y = Math.sin(this.t * 2 + i) * .15; });
    this.sync();
    this.danger = this.state === 'chase' && this.scared <= 0 ? clamp(1 - dist / 12, 0, 1) : 0;
  }
  save() { return [this.state, this.pos.x, this.pos.y, this.pos.z, this.delay]; }
  load(s) { this.state = s[0]; this.pos.set(s[1], s[2], s[3]); this.delay = s[4]; this.vel.set(0, 0, 0); this.scared = 0; this.stun = 0; this.mesh.visible = !(this.state === 'dormant' || this.state === 'gone'); this.sync(); }
}

// ================================================================ LA PRÉSENCE (géant au projecteur)
export class Presence {
  constructor(game, o) {
    this.game = game; const M = getMaterials();
    this.x0 = o.x0; this.x1 = o.x1; this.z = o.z ?? -9; this.y = o.y ?? 0; this.height = o.height || 6.5;
    this.targets = o.targets; this.ti = 0; this.look = new THREE.Vector3(...o.targets[0]); this.pos = new THREE.Vector3(o.x0, this.y, this.z);
    this.alert = 0; this.active = false; this.grabT = 0; this.speed = o.speed || .9; this.wait = 0; this.kind = 'presence';
    const g = this.mesh = new THREE.Group(); game.scene.add(g); const H = this.height;
    const dark = M.shadow;
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(H * .12, H * .32, 6, 14), dark); torso.position.y = H * .62; torso.scale.set(1.2, 1, .7); g.add(torso);
    const head = this.headM = new THREE.Mesh(new THREE.SphereGeometry(H * .08, 16, 12), dark); head.position.y = H * .92; head.scale.set(.9, 1.15, .9); g.add(head);
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(H * .05, H * .4, 4, 10), dark); leg.position.set(0, H * .24, s * H * .07); g.add(leg);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(H * .035, H * .55, 4, 10), dark); arm.position.set(H * .02, H * .48, s * H * .17); arm.rotation.x = s * .12; g.add(arm);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(H * .008, 8, 6), eyeMat(0xffffff)); eye.position.set(H * .07, H * .93, s * H * .025); g.add(eye);
    }
    // le projecteur qu'elle tient
    this.spot = new THREE.SpotLight(0xf0f4ff, 0, 40, .27, .5, 1.2); this.spot.castShadow = true; this.spot.shadow.mapSize.set(1024, 1024); this.spot.shadow.bias = -.0005;
    game.scene.add(this.spot); game.scene.add(this.spot.target);
    const coneMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uA: { value: 0 }, uAlert: { value: 0 } },
      vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.); vN=normalize(mat3(modelMatrix)*normal); vV=normalize(cameraPosition-w.xyz); gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform float uA,uAlert; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float f=pow(abs(dot(vN,vV)),1.5); float a=(1.-vUv.y)*.0+vUv.y; vec3 c=mix(vec3(.75,.8,.9),vec3(1.,.5,.4),uAlert); gl_FragColor=vec4(c*f*pow(vUv.y,1.5)*uA*.07,1.); }`
    });
    this.coneLen = 16;
    const cg = new THREE.ConeGeometry(Math.tan(.25) * this.coneLen, this.coneLen, 32, 1, true); cg.translate(0, -this.coneLen / 2, 0); cg.rotateX(-Math.PI / 2);
    this.cone = new THREE.Mesh(cg, coneMat); this.coneMat = coneMat; game.scene.add(this.cone);
    // la main qui saisit
    this.grabHand = new THREE.Group();
    const palm = new THREE.Mesh(new THREE.SphereGeometry(.45, 12, 10), M.pale); palm.scale.set(1, .4, .9); this.grabHand.add(palm);
    for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.CapsuleGeometry(.06, .7, 4, 6), M.pale); f.position.set(.4, -.3, -.3 + i * .2); f.rotation.z = .9; this.grabHand.add(f); }
    const armM = new THREE.Mesh(new THREE.CapsuleGeometry(.18, 6, 4, 8), M.shadow); armM.position.y = 3.3; this.grabHand.add(armM);
    this.grabHand.visible = false; game.scene.add(this.grabHand);
    g.visible = false;
  }
  activate(v = true) { this.active = v; this.mesh.visible = v; if (!v) { this.spot.intensity = 0; this.coneMat.uniforms.uA.value = 0; } }
  scare() { } // la Lueur ne l'atteint pas
  lightPos() { return new THREE.Vector3(this.pos.x + .6, this.y + this.height * .78, this.pos.z + .6); }
  update(dt) {
    if (!this.active) return;
    const g = this.game, p = g.player, w = g.world;
    dt *= 1 - w.echoT * .7;
    // déplacement lent le long de la galerie, suit vaguement Mio
    const targetX = clamp(p.pos.x - 1, this.x0, this.x1);
    this.pos.x = damp(this.pos.x, targetX, .35, dt);
    this.groanT = (this.groanT || 4) - dt; if (this.groanT < 0) { g.audio.play('groan', { x: this.pos.x }); this.groanT = 6 + Math.random() * 6; }
    const pxp = this.pos.x; this.mesh.position.copy(this.pos); this.mesh.position.y = this.y + Math.sin(g.time * .7) * .05;
    this.mesh.rotation.y = -.35 + Math.sin(g.time * .3) * .1;
    // balayage du projecteur entre les cibles
    const tgt = new THREE.Vector3(...this.targets[this.ti]); tgt.x += this.pos.x - this.x0;
    if (this.alert > .2 && p.state !== 'dead') tgt.copy(p.pos);
    this.look.lerp(tgt, 1 - Math.exp(-this.speed * dt * (this.alert > .2 ? 2.5 : 1)));
    if (this.look.distanceTo(tgt) < .4) { this.wait += dt; if (this.wait > 1.2) { this.wait = 0; this.ti = (this.ti + 1) % this.targets.length; } }
    const lp = this.lightPos();
    this.spot.position.copy(lp); this.spot.target.position.copy(this.look); this.spot.intensity = damp(this.spot.intensity, 170, 2, dt);
    this.cone.position.copy(lp); this.cone.lookAt(this.look); this.coneMat.uniforms.uA.value = damp(this.coneMat.uniforms.uA.value, 1, 2, dt); this.coneMat.uniforms.uAlert.value = this.alert;
    // détection
    let seen = false;
    if (p.state !== 'dead' && !p.hidden) {
      const chest = p.pos.clone(); chest.y += .6;
      const d1 = chest.clone().sub(lp).normalize(), d0 = this.look.clone().sub(lp).normalize();
      if (d1.dot(d0) > Math.cos(.22)) seen = !w.raySeg(lp, chest, 'enemy');
    }
    this.alert = clamp(this.alert + (seen ? dt * 1.0 : -dt * .5), 0, 1);
    this.danger = this.alert;
    if (this.alert >= 1 && p.state !== 'dead' && !this.grab) { this.grab = { t: 0, x: p.pos.x, z: p.pos.z }; g.audio.play('grab'); }
    if (this.grab) {
      const gr = this.grab; gr.t += dt; this.grabHand.visible = true;
      const k = Math.min(1, gr.t / .55);
      this.grabHand.position.set(gr.x, lerp(9, p.pos.y + .5, k * k), gr.z); this.grabHand.rotation.z = -.4;
      if (k >= 1 && !gr.done) { gr.done = true; const near = Math.hypot(p.pos.x - gr.x, p.pos.z - gr.z) < 1.2; if (near && !p.hidden) p.die('grab'); else { g.shake(.5); g.audio.play('crash'); g.fx.dust(gr.x, 0, gr.z, 12); } }
      if (gr.t > 1.6) { this.grab = null; this.grabHand.visible = false; this.alert = 0; }
    }
  }
  save() { return [this.active, this.pos.x]; }
  load(s) { this.activate(s[0]); this.pos.x = s[1]; this.alert = 0; this.grab = null; this.grabHand.visible = false; this.ti = 0; }
}

// ================================================================ LA MAIN (chapitre 3)
export class Hand {
  constructor(game, o) {
    this.game = game; const M = getMaterials();
    this.shoulder = new THREE.Vector3(...o.shoulder); this.pts = o.points; this.pi = 0; this.tip = new THREE.Vector3(...o.points[0]); this.pos = this.tip;
    this.active = false; this.reach = 0; this.speed = o.speed || 1.1; this.wait = 0; this.kind = 'hand'; this.L1 = o.L1 || 3.2; this.L2 = o.L2 || 3.2;
    const sleeve = M.shadow, skin = new THREE.MeshStandardMaterial({ color: 0x8e8a86, roughness: .55 });
    this.up = new THREE.Mesh(new THREE.CapsuleGeometry(.3, this.L1, 6, 12), sleeve); this.lo = new THREE.Mesh(new THREE.CapsuleGeometry(.2, this.L2, 6, 12), skin);
    this.hand = new THREE.Group();
    const palm = new THREE.Mesh(new THREE.SphereGeometry(.22, 14, 10), skin); palm.scale.set(1.2, .45, 1); this.hand.add(palm);
    this.fingers = [];
    for (let i = 0; i < 5; i++) {
      const base = new THREE.Group(); base.position.set(.18, 0, -.16 + i * .08); if (i === 4) base.position.set(-.05, 0, .2); this.hand.add(base);
      let parent = base; const segs = [];
      for (let k = 0; k < 3; k++) { const s = new THREE.Group(); s.position.x = k ? .2 : 0; parent.add(s); const m = new THREE.Mesh(new THREE.CapsuleGeometry(.03 - k * .006, .18, 4, 6), skin); m.rotation.z = Math.PI / 2; m.position.x = .1; s.add(m); segs.push(s); parent = s; }
      const nail = new THREE.Mesh(new THREE.ConeGeometry(.02, .08, 5), new THREE.MeshStandardMaterial({ color: 0x2a2622 })); nail.rotation.z = -Math.PI / 2; nail.position.x = .22; parent.add(nail);
      this.fingers.push(segs);
    }
    for (const m of [this.up, this.lo]) { m.castShadow = true; game.scene.add(m); }
    this.hand.scale.setScalar(1.7); this.hand.traverse(m => { if (m.isMesh) m.castShadow = true; }); game.scene.add(this.hand);
    this.setVisible(false);
  }
  setVisible(v) { this.up.visible = this.lo.visible = this.hand.visible = v; }
  activate(v = true) { this.active = v; this.setVisible(v); if (v) this.game.audio.play('creak'); }
  scare(o) { if (!this.active) return; this.recoil = 2.5; this.game.audio.play('grab'); }
  update(dt) {
    if (!this.active) return;
    const g = this.game, p = g.player, w = g.world; dt *= 1 - w.echoT * .75;
    const t = g.time;
    let target = new THREE.Vector3(...this.pts[this.pi]);
    if (this.recoil > 0) { this.recoil -= dt; target = this.shoulder.clone().add(new THREE.Vector3(.5, -2.5, 1)); }
    // se dirige vers Mio s'il fait du bruit (course) et n'est pas caché
    const near = p.pos.distanceTo(this.tip) < 3.5 && !p.hidden && p.state !== 'dead';
    if (near && this.recoil <= 0) target = p.pos.clone().add(new THREE.Vector3(0, .25, 0));
    // mouvement saccadé, non naturel
    const jerk = Math.sin(t * 2.3) > .6 ? 2.6 : .7;
    const step = target.clone().sub(this.tip).multiplyScalar(1 - Math.exp(-this.speed * jerk * dt)); const vmax = 1.5 * jerk * dt;
    if (step.length() > vmax) step.setLength(vmax);
    this.tip.add(step);
    if (this.tip.distanceTo(target) < .3 && !near) { this.wait += dt; if (this.wait > 1.4) { this.wait = 0; this.pi = (this.pi + 1) % this.pts.length; this.game.audio.play('creak', { x: this.tip.x }); if (Math.random() < .5) this.game.audio.play('knuckles', { x: this.tip.x }); } }
    // IK deux os
    const S = this.shoulder, T = this.tip.clone(); const d = T.clone().sub(S); let dl = d.length(); const maxL = this.L1 + this.L2 - .05;
    if (dl > maxL) { T.copy(S).addScaledVector(d.normalize(), maxL); dl = maxL; }
    const a = Math.acos(clamp((this.L1 * this.L1 + dl * dl - this.L2 * this.L2) / (2 * this.L1 * dl), -1, 1));
    const dir = T.clone().sub(S).normalize(); const upv = new THREE.Vector3(0, 1, 0); const axis = new THREE.Vector3().crossVectors(dir, upv).normalize();
    const elbowDir = dir.clone().applyAxisAngle(axis, -a); const E = S.clone().addScaledVector(elbowDir, this.L1);
    const place = (m, A, B) => { m.position.copy(A).add(B).multiplyScalar(.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); };
    place(this.up, S, E); place(this.lo, E, T);
    this.hand.position.copy(T); const fd = T.clone().sub(E).normalize(); this.hand.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), fd);
    // doigts qui tâtonnent
    this.fingers.forEach((f, i) => f.forEach((s, k) => { s.rotation.z = -.25 - (Math.sin(t * 5 + i * 1.3 + k) * .5 + .5) * .5 * (near ? 1.4 : 1); }));
    if (p.state !== 'dead' && p.invuln <= 0 && !p.hidden && this.tip.distanceTo(p.pos.clone().add(new THREE.Vector3(0, .4, 0))) < .65) { p.die('grab'); g.audio.play('grab'); }
    this.danger = clamp(1 - this.tip.distanceTo(p.pos) / 5, 0, 1);
  }
  save() { return [this.active, this.pi]; }
  load(s) { this.activate(s[0]); this.pi = s[1]; this.tip.set(...this.pts[this.pi]); this.recoil = 0; }
}

// ================================================================ OMBRES (souvenirs déformés, chapitre 4)
export class Shade {
  constructor(game, o) {
    this.game = game; const M = getMaterials();
    this.home = new THREE.Vector3(o.x, o.y || 0, o.z); this.pos = this.home.clone(); this.vel = v3(); this.hw = .2; this.hd = .2; this.h = 1.8; this.stepH = .3;
    this.range = o.range || 7; this.speed = o.speed || 1.2; this.state = 'idle'; this.fade = 1; this.kind = 'shade'; this.t = Math.random() * 10;
    const g = this.mesh = new THREE.Group();
    const mat = this.mat = new THREE.MeshStandardMaterial({ color: 0x030304, roughness: 1, transparent: true });
    const body = new THREE.Mesh(new THREE.ConeGeometry(.28, 1.4, 10), mat); body.position.y = .9; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.2, 12, 10), mat); head.position.y = 1.78; head.scale.set(.9, 1.2, .9); g.add(head); this.headM = head;
    this.armsM = [];
    for (const s of [-1, 1]) { const a = new THREE.Mesh(new THREE.CapsuleGeometry(.03, 1.1, 4, 6), mat); a.position.set(0, 1.0, s * .2); g.add(a); this.armsM.push(a); const l = new THREE.Mesh(new THREE.CapsuleGeometry(.04, .7, 4, 6), mat); l.position.set(0, .35, s * .09); g.add(l); }
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.02, 6, 4), eyeMat(0xffffff)); eye.position.set(.17, 1.8, .06); g.add(eye);
    g.traverse(m => { if (m.isMesh) m.castShadow = true; });
    mergeChildren(g);
    game.scene.add(g); this.sync();
  }
  sync() { this.mesh.position.copy(this.pos); }
  scare() { this.state = 'dissolve'; this.fade = 1; this.game.audio.play('ghost'); }
  knock(dir, f) { this.vel.x = dir.x * f * .6; this.vel.z = dir.z * f * .6; this.stun = 1; }
  update(dt) {
    const g = this.game, p = g.player, w = g.world; dt *= 1 - w.echoT * .8; this.t += dt;
    if (this.state === 'dissolve') {
      this.fade -= dt * 1.5; this.mat.opacity = Math.max(0, this.fade); if (Math.random() < .6) g.fx.smoke(this.pos.x, this.pos.y + .5, this.pos.z, [.02, .02, .03], 1, .3);
      if (this.fade <= -4) { this.state = 'idle'; this.pos.copy(this.home); this.fade = 0; }
      this.sync(); return;
    }
    if (this.fade < 1) { this.fade = Math.min(1, this.fade + dt * .5); this.mat.opacity = this.fade; }
    const toP = v3().subVectors(p.pos, this.pos); toP.y = 0; const d = toP.length();
    let tx = 0, tz = 0;
    if (this.stun > 0) this.stun -= dt;
    else if (d < this.range && p.state !== 'dead' && !p.hidden && this.fade > .6) { tx = toP.x / d * this.speed; tz = toP.z / d * this.speed; this.state = 'hunt'; }
    else { const h = v3().subVectors(this.home, this.pos); h.y = 0; if (h.length() > .3) { h.normalize(); tx = h.x * .5; tz = h.z * .5; } this.state = 'idle'; }
    if (!(this.stun > 0)) { this.vel.x = damp(this.vel.x, tx, 3, dt); this.vel.z = damp(this.vel.z, tz, 3, dt); }
    this.vel.y -= 22 * dt; w.moveBody(this, dt, 'enemy');
    // démarche raide et inquiétante
    const s = Math.hypot(this.vel.x, this.vel.z);
    this.mesh.rotation.y = Math.atan2(-this.vel.z, this.vel.x || .001) * (s > .1 ? 1 : 0) + (s > .1 ? 0 : this.mesh.rotation.y);
    this.mesh.rotation.z = Math.sin(this.t * 3) * .05 * s;
    this.headM.rotation.z = Math.sin(this.t * .7) * .6 + (Math.sin(this.t * 9) > .95 ? .8 : 0);
    this.armsM.forEach((a, i) => { a.rotation.z = Math.sin(this.t * 2 + i * 3) * .2 * s + (this.state === 'hunt' ? -.9 : 0); });
    this.sync();
    if (d < .55 && Math.abs(p.pos.y - this.pos.y) < 1 && this.fade > .6) p.die('shade');
    this.danger = this.state === 'hunt' ? clamp(1 - d / this.range, 0, 1) : 0;
  }
  save() { return [this.pos.x, this.pos.y, this.pos.z]; }
  load(s) { this.pos.set(...s); this.vel.set(0, 0, 0); this.state = 'idle'; this.fade = 1; this.mat.opacity = 1; this.sync(); }
}
