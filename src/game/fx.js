// Effets visuels : particules, ondes de choc 3D, traînées fantômes, éclats de lumière
import * as THREE from 'three';
import { Particles } from '../core/particles.js';
import { rr, rnd } from '../core/util.js';

export class FX {
  constructor(game) {
    this.game = game; const s = game.scene;
    const q = game.settings.quality;
    const mul = q === 'low' ? .45 : q === 'medium' ? .75 : 1;
    this.mul = mul;
    this.add = new Particles(s, Math.floor(1800 * mul), true, 'soft');
    this.smokeP = new Particles(s, Math.floor(700 * mul), false, 'smoke');
    this.rings = [];
    this.flashes = [];
  }
  setScale(h) { this.add.setScale(h); this.smokeP.setScale(h); }
  clear() { this.add.clear(); this.smokeP.clear(); for (const r of this.rings) this.game.scene.remove(r.mesh); this.rings = []; for (const f of this.flashes) this.game.scene.remove(f.light); this.flashes = []; }
  ember(x, y, z, s = 1) {
    if (rnd() > this.mul + .1) return;
    this.add.emit({ x, y, z, vx: rr(-.3, .3), vy: rr(.4, 1.4) * s, vz: rr(-.3, .3), life: rr(.8, 2), size: rr(.03, .07), size1: .01, color: [1.6, rr(.4, .7), .12], drag: .8, grav: -.3 });
  }
  mote(x, y, z, col = [.8, .9, 1]) { this.add.emit({ x, y, z, vx: rr(-.05, .05), vy: rr(.05, .2), vz: rr(-.05, .05), life: rr(1, 2.5), size: rr(.03, .06), size1: .01, color: col, drag: .5 }); }
  dust(x, y, z, n = 3) { for (let i = 0; i < n * this.mul; i++) this.smokeP.emit({ x: x + rr(-.15, .15), y: y + .05, z: z + rr(-.15, .15), vx: rr(-.4, .4), vy: rr(.1, .4), vz: rr(-.3, .3), life: rr(.6, 1.2), size: .15, size1: .5, color: [.55, .52, .48], alpha: .35, drag: 2 }); }
  smoke(x, y, z, col = [.05, .05, .06], n = 1, size = .4) { for (let i = 0; i < n; i++) this.smokeP.emit({ x: x + rr(-.1, .1), y: y + rr(0, .8), z: z + rr(-.1, .1), vx: rr(-.3, .3), vy: rr(.1, .6), vz: rr(-.3, .3), life: rr(.5, 1.1), size, size1: size * 2.2, color: col, alpha: .7, drag: 2.5 }); }
  splash(x, y, z) { for (let i = 0; i < 40 * this.mul; i++) this.add.emit({ x, y, z, vx: rr(-1.5, 1.5), vy: rr(1, 4), vz: rr(-1.5, 1.5), life: rr(.4, .9), size: .04, size1: .02, color: [.6, .7, .8], grav: 9 }); }
  sparks(x, y, z, n = 20, col = [1.5, .9, .4]) { for (let i = 0; i < n * this.mul; i++) this.add.emit({ x, y, z, vx: rr(-3, 3), vy: rr(0, 4), vz: rr(-3, 3), life: rr(.3, .8), size: .035, size1: .005, color: col, grav: 8, drag: .5 }); }
  flash(x, y, z, color, intensity, dist, decay = 3) {
    const l = new THREE.PointLight(color, intensity, dist, 1.6); l.position.set(x, y, z); this.game.scene.add(l);
    this.flashes.push({ light: l, k: intensity, decay });
  }
  // onde de choc 3D (sphère de fresnel qui s'étend)
  shockwave(x, y, z, radius, color = new THREE.Color(1, .45, .2), dur = .9) {
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uK: { value: 0 }, uCol: { value: color }, uTime: { value: 0 } },
      vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vec4 w=modelMatrix*vec4(position,1.); vP=position; vN=normalize(mat3(modelMatrix)*normal); vV=normalize(cameraPosition-w.xyz); gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform float uK,uTime; uniform vec3 uCol; varying vec3 vN; varying vec3 vV; varying vec3 vP;
        float h(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
        void main(){ float f=pow(1.-abs(dot(vN,vV)),3.); float n=.7+.3*sin(vP.x*14.+uTime*9.)*sin(vP.y*11.-uTime*7.); float a=f*n*(1.-uK)*1.6; gl_FragColor=vec4(uCol*a,1.); }`
    });
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), mat); m.position.set(x, y, z); m.scale.setScalar(.01); m.renderOrder = 11; this.game.scene.add(m);
    // anneau au sol
    const rmat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uK: { value: 0 }, uCol: { value: color } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `uniform float uK; uniform vec3 uCol; varying vec2 vUv; void main(){ float r=length(vUv-.5)*2.; float ring=exp(-pow((r-.92)*14.,2.))+exp(-pow((r-.8)*6.,2.))*.3; gl_FragColor=vec4(uCol*ring*(1.-uK)*1.5,1.); }`
    });
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), rmat); ring.rotation.x = -Math.PI / 2; ring.position.set(x, y - .9 + .03, z); ring.scale.setScalar(.01); this.game.scene.add(ring);
    this.rings.push({ mesh: m, ring, mat, rmat, t: 0, dur, radius });
  }
  update(dt) {
    this.add.update(dt, this.game.world ? this.game.world.windX : 0);
    this.smokeP.update(dt, this.game.world ? this.game.world.windX * .5 : 0);
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]; r.t += dt; const k = Math.min(1, r.t / r.dur), e = 1 - Math.pow(1 - k, 3);
      r.mesh.scale.setScalar(.2 + e * r.radius); r.ring.scale.setScalar(.2 + e * r.radius * 1.1);
      r.mat.uniforms.uK.value = k; r.mat.uniforms.uTime.value += dt; r.rmat.uniforms.uK.value = k;
      if (k >= 1) { this.game.scene.remove(r.mesh); this.game.scene.remove(r.ring); r.mesh.geometry.dispose(); r.mat.dispose(); r.rmat.dispose(); this.rings.splice(i, 1); }
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i]; f.light.intensity *= Math.exp(-f.decay * dt);
      if (f.light.intensity < .05) { this.game.scene.remove(f.light); this.flashes.splice(i, 1); }
    }
  }
}
