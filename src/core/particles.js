// Système de particules (pool CPU, rendu GPU) : braises, fumée, poussière, étincelles, gouttes, feuilles
import * as THREE from 'three';
import { T } from './textures.js';

export class Particles {
  constructor(scene, max = 1500, additive = true, tex = 'soft') {
    this.max = max; this.n = 0;
    this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3);
    this.c = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.size = new Float32Array(max); this.size1 = new Float32Array(max); this.drag = new Float32Array(max); this.grav = new Float32Array(max);
    this.alpha = new Float32Array(max); this.rot = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('aCol', this.aCol); g.setAttribute('aSize', this.aSize);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { tex: { value: T[tex]() }, uScale: { value: 400 } },
      vertexShader: `attribute vec4 aCol; attribute float aSize; uniform float uScale; varying vec4 vC;
        void main(){ vC=aCol; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=min(aSize*uScale/(-mv.z), 160.); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D tex; varying vec4 vC; void main(){ vec4 t=texture2D(tex,gl_PointCoord); gl_FragColor=vec4(vC.rgb*${additive ? 't.a*vC.a' : '1.'}, ${additive ? '1.' : 't.a*vC.a'}); }`
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 10;
    g.setDrawRange(0, 0);
    scene.add(this.points);
  }
  setScale(h) { this.mat.uniforms.uScale.value = h * .9; }
  emit(o) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.p.set([o.x, o.y, o.z], i * 3); this.v.set([o.vx || 0, o.vy || 0, o.vz || 0], i * 3);
    this.c.set(o.color || [1, 1, 1], i * 3); this.life[i] = this.maxLife[i] = o.life || 1;
    this.size[i] = o.size || .1; this.size1[i] = o.size1 !== undefined ? o.size1 : this.size[i]; this.drag[i] = o.drag || 0; this.grav[i] = o.grav || 0; this.alpha[i] = o.alpha === undefined ? 1 : o.alpha;
  }
  kill(i) {
    const j = --this.n;
    if (i !== j) {
      for (const arr of [this.p, this.v, this.c]) { arr[i * 3] = arr[j * 3]; arr[i * 3 + 1] = arr[j * 3 + 1]; arr[i * 3 + 2] = arr[j * 3 + 2]; }
      for (const arr of [this.life, this.maxLife, this.size, this.size1, this.drag, this.grav, this.alpha]) arr[i] = arr[j];
    }
  }
  clear() { this.n = 0; this.points.geometry.setDrawRange(0, 0); }
  update(dt, wind = 0) {
    for (let i = this.n - 1; i >= 0; i--) {
      this.life[i] -= dt; if (this.life[i] <= 0) { this.kill(i); continue; }
      const d = Math.exp(-this.drag[i] * dt);
      this.v[i * 3] = this.v[i * 3] * d + wind * dt * .5; this.v[i * 3 + 1] = this.v[i * 3 + 1] * d - this.grav[i] * dt; this.v[i * 3 + 2] *= d;
      this.p[i * 3] += this.v[i * 3] * dt; this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt; this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
    }
    const P = this.aPos.array, C = this.aCol.array, S = this.aSize.array;
    for (let i = 0; i < this.n; i++) {
      const t = 1 - this.life[i] / this.maxLife[i];
      P[i * 3] = this.p[i * 3]; P[i * 3 + 1] = this.p[i * 3 + 1]; P[i * 3 + 2] = this.p[i * 3 + 2];
      const fade = Math.min(1, t * 8) * (1 - t) * this.alpha[i];
      C[i * 4] = this.c[i * 3]; C[i * 4 + 1] = this.c[i * 3 + 1]; C[i * 4 + 2] = this.c[i * 3 + 2]; C[i * 4 + 3] = fade;
      S[i] = this.size[i] + (this.size1[i] - this.size[i]) * t;
    }
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = true;
    this.points.geometry.setDrawRange(0, this.n);
  }
}
