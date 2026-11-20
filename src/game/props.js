// Générateurs de décors procéduraux
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getMaterials } from '../core/materials.js';
import { T } from '../core/textures.js';
import { rr, rnd, fbm, hash } from '../core/util.js';

export class Props {
  constructor(game) { this.game = game; this.scene = game.scene; this.M = getMaterials(); this.anim = []; this.q = game.settings.quality; this.density = this.q === 'low' ? .45 : this.q === 'medium' ? .75 : 1; }
  // palette de matériaux partagés (fusion possible)
  pal(i) { if (!this._pal) this._pal = [0x8a4a3a, 0x4a5a7a, 0x8a7a4a, 0x5a7a5a, 0x5a4a4a].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: .85 })); return this._pal[i % this._pal.length]; }
  mesh(geo, mat, x = 0, y = 0, z = 0, o = {}) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (o.rot) m.rotation.set(...o.rot); if (o.scale) m.scale.set(...o.scale);
    m.castShadow = o.cast !== false; m.receiveShadow = o.receive !== false; m.userData.static = !o.dynamic; this.scene.add(m); return m;
  }
  // ---------------- ciel, brume, rayons, poussière ----------------
  sky(top, bottom, sunDir, sunCol, cloud = 1, sunSize = 40) {
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uTop: { value: new THREE.Color(top) }, uBot: { value: new THREE.Color(bottom) }, uSun: { value: sunDir.clone().normalize() }, uSunCol: { value: new THREE.Color(sunCol) }, uCloud: { value: cloud }, uTime: { value: 0 }, uSunSize: { value: sunSize } },
      vertexShader: `varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position.z=gl_Position.w; }`,
      fragmentShader: `uniform vec3 uTop,uBot,uSun,uSunCol; uniform float uCloud,uTime,uSunSize; varying vec3 vD;
        float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hs(i),hs(i+vec2(1,0)),f.x),mix(hs(i+vec2(0,1)),hs(i+vec2(1,1)),f.x),f.y);}
        float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*n(p);p*=2.03;a*=.5;}return s;}
        void main(){ vec3 d=normalize(vD); float h=clamp(d.y*1.6+.15,0.,1.);
          vec3 c=mix(uBot,uTop,h);
          vec2 cp=d.xz/(d.y+.25)*1.4 + vec2(uTime*.01,0.);
          float cl=fbm(cp*1.3+fbm(cp*2.)*.8);
          float md=max(dot(d,uSun),0.);
          float glow=pow(md,uSunSize)*1.6+pow(md,6.)*.35;
          c = mix(c, c*0.6, smoothstep(.45,.8,cl)*uCloud);
          c += uSunCol*glow*(1.-.6*smoothstep(.5,.85,cl)*uCloud);
          c += uSunCol*smoothstep(.9985,.9995,md)*2.5;
          gl_FragColor=vec4(c,1.); }`
    });
    const m = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), mat); m.frustumCulled = false; this.scene.add(m);
    this.anim.push((dt, t) => { mat.uniforms.uTime.value = t; m.position.copy(this.game.camera.position); });
    this.skyMat = mat;
    return mat;
  }
  fogLayer(x, y, z, w, h, color, alpha, speed = .15, scale = .12) {
    const key = [color, alpha, speed, scale].join('/'); this._fog = this._fog || {};
    if (this._fog[key]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this._fog[key]); m.position.set(x, y, z); m.renderOrder = 1; m.userData.static = true; this.scene.add(m); return m; }
    const oct = this.q === 'high' ? 4 : 3;
    const mat = this._fog[key] = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      uniforms: { uColor: { value: new THREE.Color(color) }, uA: { value: alpha }, uTime: { value: 0 }, uSpeed: { value: speed }, uScale: { value: scale } },
      vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform vec3 uColor; uniform float uA,uTime,uSpeed,uScale; varying vec2 vUv; varying vec3 vW;
        float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hs(i),hs(i+vec2(1,0)),f.x),mix(hs(i+vec2(0,1)),hs(i+vec2(1,1)),f.x),f.y);}
        float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<${oct};i++){s+=a*n(p);p*=2.02;a*=.5;}return s;}
        void main(){ vec2 p = vW.xy*uScale + vec2(uTime*uSpeed,0.);
          float f = fbm(p + vec2(n(p*.6+3.1), n(p*.6-1.7))*1.2);
          float vert = smoothstep(0.,.25,vUv.y)*smoothstep(1.,.35,vUv.y);
          float side = smoothstep(0.,.06,vUv.x)*smoothstep(1.,.94,vUv.x);
          gl_FragColor = vec4(uColor, smoothstep(.32,.85,f)*vert*side*uA); }`
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.renderOrder = 1; m.userData.static = true; this.scene.add(m);
    this.anim.push((dt, t) => { mat.uniforms.uTime.value = t; });
    return m;
  }
  shaft(x, y, z, w, h, rot, color, strength) {
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      uniforms: { uColor: { value: new THREE.Color(color) }, uStr: { value: strength }, uTime: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `uniform vec3 uColor; uniform float uStr,uTime; varying vec2 vUv;
        void main(){ float edge = smoothstep(0.,.35,vUv.x)*smoothstep(1.,.65,vUv.x); float fall = pow(vUv.y,1.4);
          float streak = .6+.4*sin(vUv.x*23.+vUv.y*2.+uTime*.3)*sin(vUv.x*7.1-1.3);
          gl_FragColor = vec4(uColor*edge*fall*streak*uStr,1.); }`
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.set(...rot); this.scene.add(m);
    this.anim.push((dt, t) => { mat.uniforms.uTime.value = t; });
    return m;
  }
  dust(x0, x1, y0, y1, z0, z1, n, color, size = .18) {
    n = Math.floor(n * this.density);
    const g = new THREE.BufferGeometry(), a = new Float32Array(n * 3), s = new Float32Array(n);
    for (let i = 0; i < n; i++) { a[i * 3] = rr(x0, x1); a[i * 3 + 1] = rr(y0, y1); a[i * 3 + 2] = rr(z0, z1); s[i] = rr(.3, 1); }
    g.setAttribute('position', new THREE.BufferAttribute(a, 3)); g.setAttribute('aS', new THREE.BufferAttribute(s, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uSize: { value: size }, uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uScale: { value: 500 } },
      vertexShader: `attribute float aS; uniform float uSize,uTime,uScale; varying float vA; void main(){ vec3 p=position; p.x+=sin(uTime*.3+p.y*2.)*.15; p.y+=sin(uTime*.2+p.x)*.1; vec4 mv=modelViewMatrix*vec4(p,1.); gl_PointSize=min(uSize*aS*uScale/(-mv.z), 7.); vA=aS*clamp(-mv.z/6.,0.,1.); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform vec3 uColor; varying float vA; void main(){ float d=length(gl_PointCoord-.5); gl_FragColor=vec4(uColor*smoothstep(.5,.0,d)*vA*.8,1.); }`
    });
    const pts = new THREE.Points(g, mat); pts.frustumCulled = false; this.scene.add(pts);
    this.anim.push((dt, t) => { mat.uniforms.uTime.value = t; mat.uniforms.uScale.value = this.game.H * .5; });
    return pts;
  }
  rain(x0, x1, n = 2500) {
    n = Math.floor(n * this.density);
    const g = new THREE.BufferGeometry(), a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = rr(-12, 12); a[i * 3 + 1] = rr(0, 14); a[i * 3 + 2] = rr(-10, 6); }
    g.setAttribute('position', new THREE.BufferAttribute(a, 3));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uScale: { value: 500 } },
      vertexShader: `uniform float uTime,uScale; uniform vec3 uCam; varying float vA; void main(){ vec3 p=position; p.y=mod(p.y-uTime*11.,14.); p.x+=uCam.x+p.y*.15; vec4 mv=modelViewMatrix*vec4(p,1.); gl_PointSize=min(.08*uScale/(-mv.z),6.); vA=clamp(-mv.z/4.,0.,1.); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying float vA; void main(){ vec2 c=gl_PointCoord-.5; float a=smoothstep(.08,0.,abs(c.x))*smoothstep(.5,.1,abs(c.y)); gl_FragColor=vec4(vec3(.55,.6,.68)*a*vA*.7,1.); }`
    });
    const pts = new THREE.Points(g, mat); pts.frustumCulled = false; this.scene.add(pts);
    this.anim.push((dt, t) => { mat.uniforms.uTime.value = t; mat.uniforms.uCam.value.copy(this.game.camera.position); mat.uniforms.uScale.value = this.game.H * .5; });
  }
  // ---------------- terrain ----------------
  terrain(x0, x1, o = {}) {
    const W = x1 - x0 + 120, D = o.depth || 160, segX = Math.floor(W / (this.q === 'low' ? 1.6 : 1)), segZ = Math.floor(D / 1.4);
    const gg = new THREE.PlaneGeometry(W, D, segX, segZ); gg.rotateX(-Math.PI / 2); gg.translate((x0 + x1) / 2, 0, -D / 2 + 30);
    const gp = gg.attributes.position, col = new Float32Array(gp.count * 3);
    const base = new THREE.Color(o.color || 0x8c847c), pathC = new THREE.Color(o.pathColor || 0xe0d0b8);
    const flatZ0 = o.flatZ0 ?? -3.2, flatZ1 = o.flatZ1 ?? 3.4;
    for (let i = 0; i < gp.count; i++) {
      const x = gp.getX(i), z = gp.getZ(i);
      const inPlay = z > flatZ0 && z < flatZ1 && x > x0 - 2 && x < x1 + 2;
      const path = Math.exp(-Math.pow((z - (o.pathZ || 0) - Math.sin(x * .12) * .5) / 1.4, 2));
      let y = inPlay ? -.02 : (fbm(x * .08, z * .08) - .5) * 2.4 * Math.min(1, Math.min(Math.abs(z - flatZ0), Math.abs(z - flatZ1)) / 4);
      if (z < -20) y += (fbm(x * .03, z * .03) - .35) * (o.hills || 4);
      if (o.heightFn) y += o.heightFn(x, z);
      if (inPlay) y += (fbm(x * .9, z * .9, 3) - .5) * .04;
      gp.setY(i, y - .01);
      const n = fbm(x * .3, z * .3, 3);
      const c = base.clone().multiplyScalar(.75 + n * .5).lerp(pathC, path * .75 * (o.path === false ? 0 : 1));
      col.set([c.r, c.g, c.b], i * 3);
    }
    gg.setAttribute('color', new THREE.BufferAttribute(col, 3)); gg.computeVertexNormals();
    const mat = o.mat || this.M.ground;
    const tex = mat.map; if (tex) tex.repeat.set(W / 8, D / 8);
    const m = new THREE.Mesh(gg, mat); m.receiveShadow = true; this.scene.add(m);
    return m;
  }
  // ---------------- forêt ----------------
  branch(start, dir, len, rad, depth, out, droop) {
    const end = start.clone().add(dir.clone().multiplyScalar(len));
    const g = new THREE.CylinderGeometry(rad * .55, rad, len, Math.max(4, 7 - (3 - depth) - (this._far ? 1 : 0)), this._far ? 1 : 2, false);
    const a = g.attributes.position;
    for (let i = 0; i < a.count; i++) { const y = a.getY(i); a.setX(i, a.getX(i) + Math.sin(y * 3 + len) * rad * .3); }
    g.translate(0, len / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()));
    g.translate(start.x, start.y, start.z);
    out.push(g);
    if (depth <= 0 || rad < .012) return;
    const n = depth > 2 ? 2 : (2 + (rnd() * 2 | 0));
    for (let i = 0; i < n; i++) {
      const s2 = start.clone().lerp(end, rr(.45, 1));
      const d2 = dir.clone().add(new THREE.Vector3(rr(-1, 1), rr(-.2, .6) - droop, rr(-1, 1)).multiplyScalar(.9)).normalize();
      this.branch(s2, d2, len * rr(.45, .7), rad * rr(.45, .62), depth - 1, out, droop);
    }
  }
  tree(x, z, h, rad, kind, mat, y = 0) {
    const parts = []; this._far = z < -25;
    if (kind === 'pine') {
      this.branch(new THREE.Vector3(0, -1, 0), new THREE.Vector3(rr(-.03, .03), 1, 0), h, rad, 0, parts, 0);
      const top = rr(.55, .95) * h;
      for (let yy = h * .25; yy < top; yy += rr(.3, .7)) { const a = rnd() * 6.28, l = (1 - yy / h) * rr(.6, 2.2) + .3; this.branch(new THREE.Vector3(0, yy, 0), new THREE.Vector3(Math.cos(a), rr(-.5, .1), Math.sin(a)), l, rad * .12, 1, parts, .4); }
    } else this.branch(new THREE.Vector3(0, -1, 0), new THREE.Vector3(rr(-.15, .15), 1, rr(-.1, .1)), h * .55, rad, this.q === 'low' || z < -32 ? 3 : 4, parts, .15);
    const m = new THREE.Mesh(mergeGeometries(parts), mat); m.position.set(x, y, z); m.rotation.y = rnd() * 6.28;
    m.castShadow = z > -20; m.receiveShadow = true; m.userData.static = true; this.scene.add(m); return m;
  }
  forest(x0, x1, o = {}) {
    const n = Math.floor((x1 - x0) * (o.density || .55) * this.density);
    for (let i = 0; i < n; i++) {
      const z = rr(o.zFar || -70, o.zNear || -12); let x = rr(x0 - 20, x1 + 20);
      this.tree(x, z, rr(12, 30), rr(.25, .55), rnd() < .6 ? 'pine' : 'oak', z < -32 ? this.M.barkFar : this.M.barkDark);
    }
    const nm = Math.floor((x1 - x0) * .12 * this.density);
    for (let i = 0; i < nm; i++) this.tree(rr(x0, x1), rr(-11, -5), rr(8, 18), rr(.18, .4), rnd() < .5 ? 'pine' : 'oak', this.M.bark);
    // premier plan (flou, occlusion)
    for (let x = x0; x < x1; x += rr(9, 18)) { if (o.clear && o.clear.some(([a, b]) => x > a && x < b)) continue; this.tree(x, rr(4.5, 7), rr(14, 22), rr(.35, .6), 'pine', this.M.barkDark); }
  }
  pylon(x, z, h, tilt, broken) {
    const parts = [], legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]], base = 1.6, top = .55;
    const at = (sx, sz, y) => { const w = base + (top - base) * (y / h); return new THREE.Vector3(sx * w, y, sz * w); };
    const beam = (a, b, t) => { const d = b.clone().sub(a), l = d.length(); const g = new THREE.BoxGeometry(t, l, t); g.translate(0, l / 2, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); g.translate(a.x, a.y, a.z); parts.push(g); };
    const hh = broken ? h * .75 : h;
    for (const [sx, sz] of legs) beam(at(sx, sz, 0), at(sx, sz, hh), .14);
    for (let y = 0; y < hh - 2.2; y += 2.2) for (let i = 0; i < 4; i++) {
      const [ax, az] = legs[i], [bx, bz] = legs[(i + 1) % 4]; if (broken && rnd() < .2) continue;
      beam(at(ax, az, y), at(bx, bz, y), .07); beam(at(ax, az, y), at(bx, bz, y + 2.2), .05); beam(at(bx, bz, y), at(ax, az, y + 2.2), .05);
    }
    if (broken) for (let i = 0; i < 5; i++) { const p0 = at(rr(-1, 1), 1, hh); beam(p0, p0.clone().add(new THREE.Vector3(rr(-1.5, 1.5), rr(-3, 1), rr(-1, 1))), .08); }
    else { beam(at(-1, 0, h * .8).setX(-3.5), at(1, 0, h * .8).setX(3.5), .1); }
    const m = new THREE.Mesh(mergeGeometries(parts), this.M.rust); m.position.set(x, -.3, z); m.rotation.set(tilt[0], rnd() * .5, tilt[1]);
    m.castShadow = true; m.receiveShadow = true; m.userData.static = true; this.scene.add(m); return m;
  }
  grass(x0, x1, z0, z1, n, height, color, cast = true) {
    n = Math.floor(n * this.density); if (n <= 0) return;
    const geo = new THREE.PlaneGeometry(1, 1); geo.translate(0, .5, 0);
    const mat = new THREE.MeshStandardMaterial({ map: T.grass(), color, alphaTest: .4, side: THREE.DoubleSide, roughness: 1 });
    // vent dans les herbes (déformation au sommet)
    mat.onBeforeCompile = sh => {
      sh.uniforms.uTime = { value: 0 }; mat.userData.sh = sh;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 wp = instanceMatrix * vec4(0.,0.,0.,1.);
        float sway = sin(uTime*1.7 + wp.x*.7 + wp.z*.3)*.12 + sin(uTime*3.1 + wp.x*2.)*.04;
        transformed.x += sway * uv.y * uv.y;`);
    };
    this.anim.push((dt, t) => { if (mat.userData.sh) mat.userData.sh.uniforms.uTime.value = t; });
    const inst = new THREE.InstancedMesh(geo, mat, n), o = new THREE.Object3D();
    for (let i = 0; i < n; i++) { o.position.set(rr(x0, x1), 0, rr(z0, z1)); o.rotation.set(0, rnd() * 3.14, 0); const s = rr(.6, 1.4) * height; o.scale.set(s * rr(.8, 1.6), s, 1); o.updateMatrix(); inst.setMatrixAt(i, o.matrix); }
    inst.receiveShadow = true; inst.castShadow = cast; this.scene.add(inst); return inst;
  }
  bush(x, y, z, r, n, color) {
    n = Math.floor(n * this.density);
    const mat = new THREE.MeshStandardMaterial({ map: T.leaf(), color, alphaTest: .5, side: THREE.DoubleSide, roughness: .8 });
    const inst = new THREE.InstancedMesh(new THREE.PlaneGeometry(.22, .22), mat, n), o = new THREE.Object3D();
    for (let i = 0; i < n; i++) { const a = rnd() * 6.28, b = rr(-.2, 1.4), rad = r * Math.sqrt(rnd()); o.position.set(x + Math.cos(a) * rad, y + b * r * .8, z + Math.sin(a) * rad * .5); o.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); o.scale.setScalar(rr(.6, 1.3)); o.updateMatrix(); inst.setMatrixAt(i, o.matrix); }
    const tw = []; for (let i = 0; i < 8; i++) this.branch(new THREE.Vector3(x, y - r * .2, z), new THREE.Vector3(rr(-.6, .6), 1, rr(-.4, .4)), r * rr(.9, 1.6), .025, 2, tw, .1);
    { const tm = new THREE.Mesh(mergeGeometries(tw), this.M.barkDark); tm.userData.static = true; this.scene.add(tm); }
    inst.castShadow = true; this.scene.add(inst); return inst;
  }
  debris(x0, x1, z0, z1, n, mat) {
    n = Math.floor(n * this.density);
    const geos = [];
    for (let i = 0; i < n; i++) { const s = rr(.05, .2); const g = new THREE.DodecahedronGeometry(s, 0); g.scale(1, .6, 1); g.rotateY(rnd() * 3); g.translate(rr(x0, x1), s * .2, rr(z0, z1)); geos.push(g); }
    if (!geos.length) return;
    const m = new THREE.Mesh(mergeGeometries(geos), mat || this.M.stone); m.castShadow = m.receiveShadow = true; m.userData.static = true; this.scene.add(m);
  }
  twigs(x0, x1, z0, z1, n) {
    const tw = [];
    for (let i = 0; i < n * this.density; i++) this.branch(new THREE.Vector3(rr(x0, x1), .02, rr(z0, z1)), new THREE.Vector3(rr(-1, 1), rr(0, .3), rr(-1, 1)), rr(.4, 1.6), .025, 2, tw, .2);
    if (tw.length) { const m = new THREE.Mesh(mergeGeometries(tw), this.M.barkDark); m.castShadow = true; m.userData.static = true; this.scene.add(m); }
  }
  log(x, y, z, len, rad, rotY = 0, rotZ = 0) { const m = this.mesh(new THREE.CylinderGeometry(rad, rad * 1.1, len, 12), this.M.bark, x, y, z, { rot: [Math.PI / 2, rotY, rotZ] }); return m; }
  // ---------------- usine ----------------
  gear(x, y, z, R, teeth, th = .25) {
    const s = new THREE.Shape();
    for (let i = 0; i < teeth * 2; i++) { const a0 = i / (teeth * 2) * Math.PI * 2, a1 = (i + 1) / (teeth * 2) * Math.PI * 2, r = i % 2 ? R : R * 1.1; if (i === 0) s.moveTo(Math.cos(a0) * r, Math.sin(a0) * r); s.lineTo(Math.cos(a0 + .02) * r, Math.sin(a0 + .02) * r); s.lineTo(Math.cos(a1 - .02) * r, Math.sin(a1 - .02) * r); }
    const hole = new THREE.Path(); hole.absarc(0, 0, R * .2, 0, Math.PI * 2, true); s.holes.push(hole);
    for (let k = 0; k < 6; k++) { const a = k / 6 * 6.28, h = new THREE.Path(); h.absarc(Math.cos(a) * R * .58, Math.sin(a) * R * .58, R * .16, 0, Math.PI * 2, true); s.holes.push(h); }
    const m = this.mesh(new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: true, bevelSize: .02, bevelThickness: .02, bevelSegments: 1, curveSegments: 6 }), this.M.iron, x, y, z);
    m.userData.static = false; const sp = rr(.05, .2) * (rnd() < .5 ? 1 : -1); this.anim.push(dt => { m.rotation.z += sp * dt; });
    return m;
  }
  chain(x, z, top, len, hook) {
    const link = new THREE.TorusGeometry(.07, .022, 6, 12); link.scale(1, 1.6, 1);
    const n = Math.floor(len / .19), inst = new THREE.InstancedMesh(link, this.M.chain, n), o = new THREE.Object3D();
    const g = new THREE.Group(); g.position.set(x, top, z); this.scene.add(g);
    for (let i = 0; i < n; i++) { o.position.set(0, -i * .19, 0); o.rotation.set(0, i % 2 ? Math.PI / 2 : 0, 0); o.updateMatrix(); inst.setMatrixAt(i, o.matrix); }
    inst.castShadow = true; g.add(inst);
    if (hook) { const h = new THREE.Mesh(new THREE.TorusGeometry(.18, .045, 8, 20, Math.PI * 1.4), this.M.chain); h.position.set(0, -n * .19 - .14, 0); h.rotation.z = Math.PI * 1.05; h.castShadow = true; g.add(h); }
    const ph = rnd() * 6; this.anim.push((dt, t) => { g.rotation.z = Math.sin(t * .6 + ph) * .02 + (this.game.world ? this.game.world.windX * .01 : 0); g.rotation.x = Math.sin(t * .4 + ph) * .015; });
    return g;
  }
  pipe(points, r) {
    const c = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'catmullrom', .05);
    this.mesh(new THREE.TubeGeometry(c, 60, r, 12), this.M.iron);
    for (let i = 1; i < 7; i++) { const t = i / 7, p = c.getPoint(t), tg = c.getTangent(t); const f = this.mesh(new THREE.CylinderGeometry(r * 1.3, r * 1.3, r * .4, 12), this.M.iron, p.x, p.y, p.z); f.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tg); }
  }
  machine(x, z, w, h, d) {
    this.mesh(new THREE.BoxGeometry(w, h, d), this.M.iron, x, h / 2, z);
    const cap = this.mesh(new THREE.CylinderGeometry(w * .3, w * .32, d * 1.02, 20), this.M.iron, x, h * .78, z); cap.rotation.x = Math.PI / 2;
    for (let i = 0; i < 3; i++) this.mesh(new THREE.BoxGeometry(.08, .3, d * .9), this.M.darkIron, x - w / 2 + .3 + i * .25, h + .15, z);
  }
  windowWall(x, y, z, w, h, figure = true) {
    const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'), s = 512;
    const gr = g.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, '#d8dde2'); gr.addColorStop(.6, '#b0b8be'); gr.addColorStop(1, '#8a9096'); g.fillStyle = gr; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${rr(.03, .1)})`; g.beginPath(); g.ellipse(rnd() * s, rnd() * s, rr(30, 110), rr(15, 45), 0, 0, 7); g.fill(); }
    if (figure) {
      g.save(); g.filter = 'blur(6px)'; g.fillStyle = 'rgba(28,30,34,.92)'; const cx = s * .48;
      g.beginPath(); g.ellipse(cx, s * .24, 26, 32, 0, 0, 7); g.fill();
      g.beginPath(); g.moveTo(cx - 35, s * .3); g.quadraticCurveTo(cx - 95, s * .34, cx - 108, s * .5); g.lineTo(cx - 120, s * .95); g.lineTo(cx - 85, s * .96); g.lineTo(cx - 75, s * .62); g.lineTo(cx - 60, s); g.lineTo(cx + 70, s); g.lineTo(cx + 80, s * .62); g.lineTo(cx + 92, s * .93); g.lineTo(cx + 125, s * .9); g.lineTo(cx + 110, s * .5); g.quadraticCurveTo(cx + 100, s * .33, cx + 35, s * .3); g.closePath(); g.fill(); g.restore();
    }
    for (let i = 0; i < 200; i++) { g.fillStyle = `rgba(60,62,58,${rr(.05, .3)})`; g.beginPath(); g.arc(rnd() * s, rnd() * s, rr(1, 7), 0, 7); g.fill(); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, fog: false }); mat.color.setScalar(1.15);
    this.mesh(new THREE.PlaneGeometry(w, h), mat, x, y, z, { cast: false });
    const mull = this.M.darkIron, cols = Math.round(w), rows = Math.round(h);
    for (let i = 0; i <= cols; i++) this.mesh(new THREE.BoxGeometry(.1, h, .15), mull, x - w / 2 + i * w / cols, y, z + .07);
    for (let j = 0; j <= rows; j++) this.mesh(new THREE.BoxGeometry(w, .1, .15), mull, x, y - h / 2 + j * h / rows, z + .07);
    this.fogLayer(x, y, z + 1.2, w * 1.6, h * 1.6, 0xc8d0d6, .5, .05, .2);
    return mat;
  }
  // ---------------- maison ----------------
  bed(x, z, o = {}) {
    const M = this.M, g = new THREE.Group(); g.position.set(x, 0, z); this.scene.add(g);
    const L = o.len || 2.6, W = o.w || 1.4, H = o.h || 1.0;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(L, .2, W), M.woodDark); frame.position.y = H; g.add(frame);
    const mat = new THREE.Mesh(new THREE.BoxGeometry(L - .1, .35, W - .1), M.fabric); mat.position.y = H + .27; g.add(mat);
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(L * .7, .1, W + .1), new THREE.MeshStandardMaterial({ color: 0x7a7a70, roughness: 1, map: T.cloth() })); sheet.position.set(L * .12, H + .46, 0); g.add(sheet);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.07, .06, H + (sx < 0 ? 1.2 : .5), 10), M.woodDark); p.position.set(sx * (L / 2 - .07), (H + (sx < 0 ? 1.2 : .5)) / 2, sz * (W / 2 - .07)); g.add(p); const k = new THREE.Mesh(new THREE.SphereGeometry(.1, 10, 8), M.woodDark); k.position.set(p.position.x, H + (sx < 0 ? 1.2 : .5) + .05, p.position.z); g.add(k); }
    const head = new THREE.Mesh(new THREE.BoxGeometry(.1, 1.1, W), M.woodDark); head.position.set(-L / 2 + .05, H + .6, 0); g.add(head);
    g.traverse(m => { if (m.isMesh) { m.castShadow = m.receiveShadow = true; } });
    return g;
  }
  wardrobe(x, z, h = 3.2, w = 1.6, d = .8) {
    const M = this.M; this.mesh(new THREE.BoxGeometry(w, h, d), M.woodDark, x, h / 2, z);
    this.mesh(new THREE.BoxGeometry(w + .2, .15, d + .2), M.woodDark, x, h + .07, z);
    this.mesh(new THREE.BoxGeometry(.02, h * .85, .02), M.boot, x, h / 2, z + d / 2 + .01);
  }
  shelf(x, z, h = 3, w = 1.2) {
    const M = this.M; this.mesh(new THREE.BoxGeometry(w, h, .4), M.woodDark, x, h / 2, z - .2);
    for (let y = .5; y < h; y += .6) for (let i = 0; i < 6; i++) if (rnd() < .7) this.mesh(new THREE.BoxGeometry(.08, rr(.25, .4), .25), this.pal(Math.floor(rnd() * 5)), x - w / 2 + .15 + i * .17, y + .17, z);
  }
  toys(x0, x1, z0, z1, n) {
    const cols = [0x8a4a3a, 0x4a5a7a, 0x8a7a4a, 0x5a7a5a];
    for (let i = 0; i < n * this.density; i++) {
      const s = rr(.12, .22), c = this.pal(i % 4);
      const kind = rnd();
      if (kind < .6) this.mesh(new THREE.BoxGeometry(s, s, s), c, rr(x0, x1), s / 2, rr(z0, z1), { rot: [0, rnd() * 3, 0] });
      else this.mesh(new THREE.CylinderGeometry(s * .5, s * .5, s * 1.2, 10), c, rr(x0, x1), s * .6, rr(z0, z1));
    }
  }
  roomShell(x0, x1, o = {}) {
    // pièce : sol parquet, mur du fond papier peint déchiré, plafond
    const M = this.M, H = o.h || 5.5, zb = o.zBack ?? -3.6;
    const f = this.mesh(new THREE.PlaneGeometry(x1 - x0, 12), M.floorWood, (x0 + x1) / 2, 0, zb + 6, { rot: [-Math.PI / 2, 0, 0], cast: false });
    M.floorWood.map.repeat.set((x1 - x0) / 3, 3);
    const wmat = M.wallpaper; wmat.map.repeat.set((x1 - x0) / 2.5, H / 2.5);
    this.mesh(new THREE.PlaneGeometry(x1 - x0, H), wmat, (x0 + x1) / 2, H / 2, zb, { cast: false });
    // lambeaux de papier peint
    const tornMat = new THREE.MeshStandardMaterial({ color: 0x4a443c, roughness: 1, side: THREE.DoubleSide });
    for (let i = 0; i < (x1 - x0) / 7; i++) { const g = new THREE.PlaneGeometry(rr(.3, .7), rr(.8, 1.8), 1, 6); const pa = g.attributes.position; for (let k = 0; k < pa.count; k++) { const y = pa.getY(k); pa.setZ(k, Math.pow(Math.max(0, -y) * 1.2, 2) * .5); } g.computeVertexNormals(); this.mesh(g, tornMat, rr(x0, x1), rr(2, H - .8), zb + .04, { rot: [0, 0, rr(-.15, .15)], cast: false }); }
    if (o.ceiling !== false) this.mesh(new THREE.PlaneGeometry(x1 - x0, 12), new THREE.MeshStandardMaterial({ color: 0x3a3a38, roughness: 1, side: THREE.DoubleSide }), (x0 + x1) / 2, H, zb + 6, { rot: [Math.PI / 2, 0, 0], cast: false });
    // plinthe
    this.mesh(new THREE.BoxGeometry(x1 - x0, .18, .05), M.woodDark, (x0 + x1) / 2, .09, zb + .03);
  }
  // ---------------- marais ----------------
  reeds(x0, x1, z0, z1, n) { return this.grass(x0, x1, z0, z1, n, 1.6, 0x5a6050); }
  pier(x0, x1, z0, z1, y) {
    const M = this.M;
    for (let x = x0; x < x1; x += .32) this.mesh(new THREE.BoxGeometry(.3, .07, z1 - z0 + rr(-.1, .1)), M.wood, x + .15, y - .035, (z0 + z1) / 2, { rot: [0, rr(-.03, .03), rr(-.02, .02)] });
    for (let x = x0; x <= x1; x += 1.6) for (const z of [z0, z1]) this.mesh(new THREE.CylinderGeometry(.07, .08, y + 2, 8), M.woodDark, x, (y - 2) / 2 + .5, z);
  }
}
