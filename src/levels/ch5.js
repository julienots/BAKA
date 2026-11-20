// CHAPITRE V — LA COLLINE (l'acceptation)
// L'aube se lève à mesure que Mio monte. Les loups ne chassent plus : ils attendent.
// Au sommet, le petit manteau rouge. Mio le laisse partir dans le vent.
import * as THREE from 'three';
import { Wolf } from '../game/enemies.js';
import { rr, clamp, lerp, smooth } from '../core/util.js';
import { getMaterials } from '../core/materials.js';

const H = x => Math.pow(clamp((x - 8) / 82, 0, 1), 1.15) * 6;

export default {
  title: 'La Colline', sub: "l'acceptation",
  start: { x: 2, y: 0, z: 0 },
  grade: { sat: .5, tint: [.95, .98, 1.04], shadow: [.02, .02, .025], contrast: 1.2, exposure: .9, warm: 0 },
  rays: .4, bloom: .4, aperture: 16, wind: .9,
  camera: { dist: 11.5, height: 1.8, look: 1.4, fov: 36, ahead: 2 },
  powers: [true, true, true, true],
  build(g) {
    const w = g.world, P = g.props, M = w.M;
    g.setupLights({ fog: 0x8a7a68, fogDensity: .005, hemiSky: 0x9aa4b0, hemiGround: 0x3a342c, hemi: 1.2, sun: 0xffd6a8, sunI: 2.2, sunDir: [40, 8, -40], lightDir: [.7, .12, -1], fill: 0x8090a0, fillI: .8, keyI: 18, rimI: 30, rimC: 0xffd0a0 });
    this.skyMat = P.sky(0x3a4452, 0x9a8470, new THREE.Vector3(.7, .06, -1), 0xffb070, .7, 30);
    w.length = 120;
    // ---- pente : marches invisibles + terrain visuel
    w.block(-1.5, 0, -4, -1, 8, 4, { mat: null, visible: false, climbable: false });
    w.ground(-10, 8, { surface: 'grass' });
    for (let x = 8; x < 90; x += .5) w.block(x, -2, -4, x + .5, H(x + .25), 3.2, { mat: null, visible: false, surface: 'grass', climbable: false });
    w.block(90, -2, -4, 116, 6, 3.2, { mat: null, visible: false, surface: 'grass', climbable: false });
    w.block(116, -2, -4, 117, 12, 4, { mat: null, visible: false, climbable: false }); // bord de falaise (on ne tombe pas)
    const gmat = new THREE.MeshStandardMaterial({ map: M.ground.map, vertexColors: true, roughness: 1 });
    P.terrain(-10, 130, { color: 0x9a8a68, pathColor: 0xc8b088, heightFn: (x, z) => (x < 116.5 ? H(Math.min(x, 90)) : -30 + (x - 116) * -.2), hills: 8, mat: gmat });
    // herbes dorées, ondulant au vent
    const grassH = (x0, x1, z0, z1, n, h, col) => { const inst = P.grass(x0, x1, z0, z1, n, h, col); if (!inst) return; const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); for (let i = 0; i < inst.count; i++) { inst.getMatrixAt(i, m); m.decompose(p, q, s); p.y = x0 >= 0 ? H(Math.min(p.x, 90)) : 0; m.compose(p, q, s); inst.setMatrixAt(i, m); } inst.instanceMatrix.needsUpdate = true; };
    grassH(0, 116, -14, -3, 4000, 1.1, 0xc8b078); grassH(0, 116, -3, 2.6, 1200, .32, 0xb8a070); grassH(0, 116, 3.6, 6, 700, .5, 0xa89060);
    for (let i = 0; i < 40 * P.density; i++) { const x = rr(-5, 116), z = rr(-40, -8); P.tree(x, z, rr(5, 12), rr(.12, .3), 'oak', M.bark, H(Math.min(x, 90)) - .5); }
    for (let x = 0; x < 120; x += 6) P.bush(x + rr(0, 4), H(Math.min(x, 90)) + .2, rr(4, 6.5), rr(.5, .9), 200, 0x7a8a5a);
    for (let x = 0; x < 130; x += 30) { P.fogLayer(x + 15, H(Math.min(x + 15, 90)) + 1, -6, 40, 3, 0xe8d8c0, .25, .1); P.fogLayer(x + 15, -2, -40, 120, 20, 0xe8c8a0, .45, .05); }
    // l'usine, loin dans la vallée (ce qu'il laisse derrière lui)
    const fac = new THREE.Group(); for (const [x, h] of [[0, 14], [4, 22], [9, 18]]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(.8, 1, h, 10), M.barkFar); c.position.set(x, h / 2, 0); fac.add(c); } fac.position.set(150, -12, -90); g.scene.add(fac);
    P.dust(0, 120, 0, 10, -5, 4, 2500, 0xffe0b0, .22);
    // ---- x 35-45 : les loups assis au milieu du chemin
    this.wolves = [];
    for (const [x, z, yaw] of [[38.5, -1.2, Math.PI], [40, .6, Math.PI * .9], [41.5, -.2, Math.PI * 1.1]]) { const wf = g.addEnemy(new Wolf(g, { x, z, y: H(x), state: 'sit', yaw })); wf.yaw = yaw; this.wolves.push(wf); }
    this.barrier = w.block(43.5, 0, -4, 44, 12, 4, { mat: null, visible: false, blocksEnemy: false });
    w.checkpoint(30, H(30), 0);
    // ---- x 55-66 : l'Écho montre deux enfants qui jouent ; un rocher où repose une photo
    this.ghosts = [];
    const gm = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uA: { value: 0 } },
      vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 w=modelMatrix*vec4(position,1.); vN=normalize(mat3(modelMatrix)*normal); vV=normalize(cameraPosition-w.xyz); gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform float uA; varying vec3 vN; varying vec3 vV; void main(){ float f=pow(1.-abs(dot(vN,vV)),2.); gl_FragColor=vec4(vec3(.6,.85,1.2)*(f*1.3+.15)*uA,1.); }` });
    this.ghostMat = gm;
    for (const [x, z, s] of [[58, -1.4, 1], [59.6, -1.1, .82]]) { const gr = new THREE.Group(); const b = new THREE.Mesh(new THREE.ConeGeometry(.24 * s, .7 * s, 12), gm); b.position.y = .45 * s; gr.add(b); const hd = new THREE.Mesh(new THREE.SphereGeometry(.2 * s, 14, 10), gm); hd.position.y = 1.0 * s; gr.add(hd); gr.position.set(x, H(x), z); g.scene.add(gr); this.ghosts.push(gr); }
    w.block(63.5, 0, -3, 65.5, H(64.5) + 2.6, -1.6, { mat: M.stone, surface: 'stone', rock: true });
    w.echoBox(61.2, 0, -2.9, 62.2, H(61.7) + 1.1, -1.7, {});
    w.echoBox(62.4, 0, -2.9, 63.4, H(62.9) + 1.9, -1.7, { shape: 'books' });
    w.memory('photo', 64.5, H(64.5) + 2.6, -2.3);
    w.checkpoint(70, H(70), 0);
    // ---- x 80 : rochers à gravir
    w.block(80, 0, -3, 84, H(82) + 1.2, 3.2, { mat: M.stone, surface: 'stone', rock: true });
    w.block(84, 0, -3, 88, H(86) + 2.0, 3.2, { mat: M.stone, surface: 'stone', rock: true });
    w.checkpoint(92, 6, 0);
    // ---- sommet : le manteau rouge accroché à un arbre mort
    const tr = P.tree(99.5, -1.6, 7, .22, 'oak', M.bark, 6);
    this.coat = w.item('manteau', 99, 6, -.6, { id: 'coat' });
    this.coat.keepVisible = true;
    w.camZone(-5, 30, { dist: 11, height: 1.6, look: 1.6, fov: 36 });
    w.camZone(36, 46, { dist: 9.5, height: 1.4, look: 1.2, fov: 34, ahead: .5 });
    w.camZone(94, 120, { dist: 12.5, height: 1.6, look: 2.2, fov: 40, ahead: 3.5 });
    g.snapshotEnemies();
  },
  update(g, dt) {
    const p = g.player, k = smooth(clamp((p.pos.x - 5) / 105, 0, 1));
    // l'aube progresse avec Mio
    const gr = g.post.params.grade; gr.warm = lerp(.1, .7, k) + (this.dawn || 0) * .25; gr.sat = lerp(.55, .85, k); gr.exposure = lerp(.85, .98, k) + (this.dawn || 0) * .2;
    if (g.sun) { g.sun.intensity = lerp(1.6, 3.6, k); }
    if (this.skyMat) { this.skyMat.uniforms.uSun.value.set(.7, lerp(.02, .16, k), -1).normalize(); this.skyMat.uniforms.uTop.value.setHSL(.6, .25, lerp(.16, .38, k)); this.skyMat.uniforms.uBot.value.setHSL(.07, .45, lerp(.4, .6, k)); }
    if (g.scene.fog) g.scene.fog.color.setHSL(.07, .3, lerp(.38, .55, k));
    g.lightDir.set(.7, lerp(.06, .14, k), -1).normalize();
    // fantômes du passé (Écho)
    if (this.ghostMat) { this.ghostMat.uniforms.uA.value = g.world.echoT; this.ghosts.forEach((gh, i) => { gh.position.x += Math.sin(g.time * 1.3 + i * 2) * .01; gh.position.y = H(gh.position.x) + Math.abs(Math.sin(g.time * 4 + i)) * .3; }); }
    // les loups regardent Mio passer
    for (const wf of this.wolves) if (wf.state === 'sit') wf.yaw = Math.atan2(-(p.pos.z - wf.pos.z), p.pos.x - wf.pos.x);
    if (this.dissolving) {
      for (const wf of this.wolves) if (wf.fadeT !== undefined && wf.state !== 'gone') {
        wf.fadeT -= dt; wf.mesh.scale.setScalar(1.15 * Math.max(.01, wf.fadeT / 2)); wf.pos.y += dt * .3;
        for (let i = 0; i < 3; i++) g.fx.ember(wf.pos.x + rr(-.4, .4), wf.pos.y + rr(.2, .9), wf.pos.z + rr(-.3, .3), .5);
        if (wf.fadeT <= 0) { wf.state = 'gone'; wf.mesh.visible = false; }
      }
      if (this.wolves.every(wf => wf.state === 'gone')) { this.barrier.active = false; this.dissolving = false; g.audio.setMood('calm'); }
    }
    if (this.release) this.updateRelease(g, dt);
  },
  // La Lueur près des loups : ils se dissolvent en lumière (la culpabilité s'apaise)
  onLueur(g, o, R) {
    const near = this.wolves.filter(wf => wf.state === 'sit' && wf.pos.distanceTo(o) < R + 1);
    if (!near.length) return;
    near.forEach((wf, i) => { wf.state = 'dissolve'; wf.fadeT = 2 + i * .4; });
    this.dissolving = true; g.audio.playLullaby(1, 1);
  },
  onDrop(g) {
    const p = g.player;
    if (!p.carrying || p.carrying.kind !== 'manteau' || p.pos.x < 106) return false;
    this.startRelease(g); return true;
  },
  startRelease(g) {
    const p = g.player, coat = p.carrying; coat.carried = false; coat.placed = true; p.carrying = null;
    this.release = { t: 0, coat, from: coat.mesh.position.clone() };
    g.audio.stopLullaby(); g.audio.setMood('silence');
    g.runCine(async c => {
      p.startLock('release', 7);
      c.cam({ dist: 13, height: 1.2, look: 2.6, fov: 42, ahead: 4, ease: .6 });
      await c.wait(.8); g.audio.playLullaby(.85);
      await c.wait(7.5);
      this.dawn = 1;
      g.fadeTarget = 0; const pp = g.post.params; const t0 = g.time;
      await c.until(() => { pp.white = Math.min(1, (g.time - t0) / 4); return pp.white >= 1; });
      await c.wait(.6);
      g.startEpilogue();
    });
  },
  updateRelease(g, dt) {
    const r = this.release; r.t += dt; const m = r.coat.mesh;
    if (r.t < .9) { m.position.lerp(new THREE.Vector3(g.player.pos.x + .3, g.player.pos.y + 1.6, g.player.pos.z), dt * 4); return; }
    // le vent emporte le manteau vers le soleil
    const t = r.t - .9;
    m.position.x += dt * (1.6 + t * .5); m.position.y += dt * (.7 + Math.sin(t * 2) * .5); m.position.z -= dt * .6;
    m.rotation.z = Math.sin(t * 3) * .6; m.rotation.x = Math.sin(t * 2.3) * .5; m.rotation.y += dt;
    if (Math.random() < .7) g.fx.ember(m.position.x, m.position.y, m.position.z, .3);
    if (r.coat.light) r.coat.light.intensity = 2 + Math.sin(t * 5) * .5;
  },
  onRespawn(g, cp) {
    for (const wf of this.wolves) { if (cp < 2) { wf.state = 'sit'; wf.pos.copy(wf.spawn); wf.mesh.visible = true; wf.mesh.scale.setScalar(1.15); wf.fadeT = undefined; wf.sync(); } }
    if (cp < 2) { this.barrier.active = true; this.dissolving = false; }
    else { this.barrier.active = false; this.wolves.forEach(wf => { wf.state = 'gone'; wf.mesh.visible = false; }); }
  },
  restoreAt(g, cp) { if (cp >= 2) this.onRespawn(g, cp); },
};

// ÉPILOGUE — une vraie chambre, le matin. Un lit vide.
export const EPILOGUE = {
  title: '', sub: '', start: { x: 0, y: 0, z: 0 }, epilogue: true,
  grade: { sat: .75, tint: [1.04, 1, .94], shadow: [.04, .035, .03], contrast: 1.05, exposure: 1.1, warm: .55 },
  rays: .8, bloom: .6, aperture: 22, wind: 0,
  camera: { dist: 5.5, height: 1.1, look: .9, fov: 34, ahead: .6 },
  powers: [false, false, false, false],
  build(g) {
    const w = g.world, P = g.props, M = getMaterials();
    g.setupLights({ wet: 0, fog: 0xc8b8a0, fogDensity: .01, hemiSky: 0xfff0dc, hemiGround: 0x6a5a48, hemi: 1.6, sun: 0xffd8a8, sunI: 4, sunDir: [6, 6, -8], lightDir: [.5, .3, -1], fill: 0xffe8d0, fillI: 1, keyI: 14, rimI: 20, rimC: 0xffd0a0 });
    w.ground(-10, 10, { surface: 'wood' });
    w.block(-1.6, 0, .9, .4, .45, 1.9, { mat: null, visible: false, surface: 'wood' });
    w.block(-3.2, 0, -4, -3, 6, 4, { mat: null, visible: false }); w.block(4.5, 0, -4, 4.7, 6, 4, { mat: null, visible: false });
    P.roomShell(-6, 8, { h: 4, zBack: -2.4 });
    const M2 = getMaterials(); M2.wallpaper.color.setHex(0xf0e6d8);
    // fenêtre : lumière du matin
    P.mesh(new THREE.PlaneGeometry(1.8, 1.8), new THREE.MeshBasicMaterial({ color: 0xfff2dc, fog: false }), 2.2, 2.2, -2.38, { cast: false });
    P.shaft(1.6, 1.2, -1.2, 2.4, 4.5, [0, 0, .6], 0xffe0b0, .5);
    // le lit vide (taille réelle : Mio est un enfant normal ici)
    P.bed(-.6, -1.3, { len: 2.0, w: 1.0, h: .45 });
    P.bed(-.6, 1.4, { len: 2.0, w: 1.0, h: .45 });
    const pillow = P.mesh(new THREE.BoxGeometry(.4, .12, .7), new THREE.MeshStandardMaterial({ color: 0xf0ece4, roughness: 1 }), -1.35, .82, 1.4);
    // dessin au mur
    const c = document.createElement('canvas'); c.width = 256; c.height = 192; const x2 = c.getContext('2d'); x2.fillStyle = '#efe6d0'; x2.fillRect(0, 0, 256, 192); x2.lineWidth = 4; x2.strokeStyle = '#333'; x2.beginPath(); x2.arc(90, 70, 18, 0, 7); x2.stroke(); x2.strokeStyle = '#c42a20'; x2.beginPath(); x2.arc(160, 80, 14, 0, 7); x2.stroke(); x2.fillStyle = '#c42a20'; x2.fillRect(150, 94, 22, 40); x2.fillStyle = '#e0b030'; x2.beginPath(); x2.arc(220, 30, 18, 0, 7); x2.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    P.mesh(new THREE.PlaneGeometry(.7, .52), new THREE.MeshStandardMaterial({ map: t, roughness: 1 }), -.6, 1.7, -2.36, { rot: [0, 0, .04] });
    // petite table de nuit et, si tous les souvenirs sont réunis, la photo et la moufle
    P.mesh(new THREE.BoxGeometry(.45, .5, .4), M.woodDark, .9, .25, .2);
    if (g.save.memories.length >= 5) {
      const f = P.mesh(new THREE.BoxGeometry(.18, .24, .03), M.woodDark, .85, .62, .15, { rot: [0, -.5, 0] });
      const mf = P.mesh(new THREE.SphereGeometry(.07, 10, 8), M.redCoat, 1.02, .53, .3, { scale: [1.3, .5, 1] });
    }
    P.dust(-3, 4, 0, 3, -2, 2, 500, 0xfff0d0, .1);
    // Mio (taille réelle d'enfant)
    g.player.model.scaleGroup.scale.setScalar(.85);
  },
  intro(g) {
    const p = g.player; p.place(.1, .46, 1.3, 1); p.yaw = -.6;
    g.post.params.white = 1; g.post.params.fade = 0; g.fadeTarget = 0;
    g.runCine(async c => {
      p.startLock('sit', 999); p.pos.y = .45;
      c.cam({ dist: 4.2, height: .7, look: .6, fov: 32, ahead: 0, xOff: -.2, ease: 1 });
      const pp = g.post.params, t0 = g.time;
      g.audio.setChapter(5); g.audio.playLullaby(.75, 1);
      await c.until(() => { pp.white = Math.max(0, 1 - (g.time - t0) / 3.5); return pp.white <= 0; });
      await c.wait(3);
      c.cam({ dist: 3.2, height: .6, look: .7, fov: 30, ahead: 0, xOff: .4, ease: .5 });
      await c.wait(6);
      g.fadeTarget = 1; await c.wait(2.5);
      g.finale();
    });
  },
};
