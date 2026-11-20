// Post-traitement : profondeur de champ, bloom, rayons volumétriques, distorsions de pouvoirs,
// vision « Écho », peur, grain, vignettage et étalonnage par chapitre.
import * as THREE from 'three';

const VS = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`;
const LIN = `uniform float uNear,uFar; float linDepth(float d){ float z=d*2.-1.; return 2.*uNear*uFar/(uFar+uNear-z*(uFar-uNear)); }`;

export class Post {
  constructor(renderer, camera) {
    this.r = renderer; this.camera = camera;
    this.fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.fsScene = new THREE.Scene();
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); this.fsScene.add(this.quad);
    this.params = {
      focus: 10, aperture: 18, fear: 0, hurt: 0, echo: 0, fade: 0, white: 0, time: 0,
      light: new THREE.Vector2(.7, .85), rays: .5, bloom: .45,
      grade: { sat: .4, tint: new THREE.Vector3(.92, 1, 1.08), shadow: new THREE.Vector3(.025, .03, .04), contrast: 1.15, exposure: .95, warm: 0 },
      shocks: [], // {x,y (uv), r, s}
      wind: new THREE.Vector4(0, 0, 0, 0), // x,y uv origin, dirx, strength
    };
    this.quality = null;
  }
  setQuality(q, w, h, pr) {
    this.quality = q;
    this.dispose();
    const W = Math.max(2, Math.floor(w * pr)), H = Math.max(2, Math.floor(h * pr));
    this.W = W; this.H = H;
    const samples = q === 'high' ? 4 : 0;
    this.rtMain = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples });
    this.rtMain.depthTexture = new THREE.DepthTexture(W, H, THREE.FloatType);
    this.rtDof = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
    const qs = s => new THREE.WebGLRenderTarget(Math.ceil(W / s), Math.ceil(H / s), { type: THREE.HalfFloatType });
    this.rtA = qs(4); this.rtB = qs(4); this.rtRay = qs(q === 'high' ? 2 : 4); this.rtC = qs(8); this.rtD = qs(8);
    this.aoOn = q !== 'low'; this.rtAO = qs(2);
    this.aoMat = new THREE.ShaderMaterial({
      defines: { SAMPLES: q === 'high' ? 10 : 6 },
      uniforms: { tDepth: { value: this.rtMain.depthTexture }, uNear: { value: .3 }, uFar: { value: 400 }, uRes: { value: new THREE.Vector2(W, H) }, uProj: { value: 1 } },
      vertexShader: VS,
      fragmentShader: `uniform sampler2D tDepth; uniform vec2 uRes; uniform float uProj; varying vec2 vUv; ${LIN}
        float ign(vec2 p){ return fract(52.9829189*fract(dot(p,vec2(.06711056,.00583715)))); }
        void main(){ float d0=linDepth(texture2D(tDepth,vUv).x); if(d0>120.){ gl_FragColor=vec4(1.); return; }
          float rad=clamp(.55*uProj/d0, .002, .06); float ao=0.; float j=ign(gl_FragCoord.xy)*6.283;
          for(int i=0;i<SAMPLES;i++){ float fi=float(i); float a=fi*2.39996+j; float r=sqrt((fi+.5)/float(SAMPLES))*rad;
            vec2 o=vec2(cos(a),sin(a))*r*vec2(uRes.y/uRes.x,1.); float ds=linDepth(texture2D(tDepth,vUv+o).x);
            float diff=d0-ds; ao+=smoothstep(.02,.25,diff)*(1.-smoothstep(.6,1.6,diff)); }
          ao=1.-ao/float(SAMPLES)*1.15; gl_FragColor=vec4(vec3(clamp(ao,0.,1.)),1.); }`
    });
    const taps = q === 'high' ? 32 : q === 'medium' ? 12 : 0;
    const raySteps = q === 'high' ? 48 : q === 'medium' ? 24 : 0;
    this.taps = taps; this.raySteps = raySteps;
    this.dofMat = new THREE.ShaderMaterial({
      defines: { TAPS: Math.max(taps, 1) },
      uniforms: { tColor: { value: this.rtMain.texture }, tDepth: { value: this.rtMain.depthTexture }, uRes: { value: new THREE.Vector2(W, H) }, uFocus: { value: 10 }, uAp: { value: 18 }, uNear: { value: .3 }, uFar: { value: 400 }, uScale: { value: H / 900 } },
      vertexShader: VS,
      fragmentShader: `uniform sampler2D tColor,tDepth; uniform vec2 uRes; uniform float uFocus,uAp,uScale; varying vec2 vUv; ${LIN}
        float coc(vec2 uv){ float d=linDepth(texture2D(tDepth,uv).x); float c=abs(1./uFocus-1./d)*uFocus; c = d<uFocus ? c*1.8 : c; return clamp(c*uAp,0.,14.)*uScale; }
        void main(){ float c0=coc(vUv); vec3 acc=texture2D(tColor,vUv).rgb; float w=1.;
          float R=max(c0,2.*uScale);
          for(int i=1;i<TAPS;i++){ float fi=float(i); float r=sqrt(fi/float(TAPS))*R; float a=fi*2.39996;
            vec2 o=vec2(cos(a),sin(a))*r/uRes; float cs=coc(vUv+o);
            float ww = smoothstep(r-1.,r+.5,max(cs, c0*step(cs,c0)));
            ww = max(ww, smoothstep(r-1.,r, cs)*step(c0,cs));
            acc+=texture2D(tColor,vUv+o).rgb*ww; w+=ww; }
          vec3 o=acc/w; if(any(isnan(o))||any(isinf(o))) o=vec3(0.); gl_FragColor=vec4(min(o,vec3(48.)),1.); }`
    });
    this.copyMat = new THREE.ShaderMaterial({ uniforms: { tColor: { value: this.rtMain.texture } }, vertexShader: VS, fragmentShader: `uniform sampler2D tColor; varying vec2 vUv; void main(){ vec3 o=texture2D(tColor,vUv).rgb; if(any(isnan(o))||any(isinf(o))) o=vec3(0.); gl_FragColor=vec4(min(o,vec3(48.)),1.); }` });
    this.brightMat = new THREE.ShaderMaterial({
      uniforms: { tColor: { value: this.rtDof.texture }, uRes: { value: new THREE.Vector2(this.rtA.width, this.rtA.height) } }, vertexShader: VS,
      fragmentShader: `uniform sampler2D tColor; uniform vec2 uRes; varying vec2 vUv; void main(){ vec3 c=vec3(0.); for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++) c+=texture2D(tColor,vUv+vec2(x,y)*1.5/uRes).rgb; c/=9.; if(any(isnan(c))||any(isinf(c))) c=vec3(0.); c=min(c,vec3(24.)); float l=dot(c,vec3(.3,.59,.11)); gl_FragColor=vec4(c*smoothstep(.35,1.1,l),1.); }`
    });
    this.blurMat = new THREE.ShaderMaterial({
      uniforms: { tColor: { value: null }, uDir: { value: new THREE.Vector2() } }, vertexShader: VS,
      fragmentShader: `uniform sampler2D tColor; uniform vec2 uDir; varying vec2 vUv; void main(){ vec3 c=vec3(0.); float w=0.; for(int i=-10;i<=10;i++){ float fi=float(i); float g=exp(-fi*fi/45.); c+=texture2D(tColor,vUv+uDir*fi).rgb*g; w+=g; } gl_FragColor=vec4(c/w,1.); }`
    });
    this.rayMat = new THREE.ShaderMaterial({
      defines: { STEPS: Math.max(raySteps, 1) },
      uniforms: { tColor: { value: this.rtMain.texture }, tDepth: { value: this.rtMain.depthTexture }, uLight: { value: new THREE.Vector2() }, uNear: { value: .3 }, uFar: { value: 400 } }, vertexShader: VS,
      fragmentShader: `uniform sampler2D tColor,tDepth; uniform vec2 uLight; varying vec2 vUv; ${LIN}
        float occ(vec2 uv){ float d=linDepth(texture2D(tDepth,uv).x); float sky=smoothstep(30.,110.,d); vec3 c=texture2D(tColor,uv).rgb; return sky*smoothstep(.25,.9,dot(c,vec3(.33))); }
        float ign(vec2 p){ return fract(52.9829189*fract(dot(p,vec2(.06711056,.00583715)))); }
        void main(){ vec2 d=(vUv-uLight)/float(STEPS)*.9; vec2 uv=vUv-d*ign(gl_FragCoord.xy); float s=0.,dec=1.; for(int i=0;i<STEPS;i++){ uv-=d; s+=occ(uv)*dec; dec*=.972; } gl_FragColor=vec4(vec3(s/float(STEPS)),1.); }`
    });
    this.finalMat = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: this.rtDof.texture }, tBloom: { value: this.rtA.texture }, tBloom2: { value: this.rtC.texture }, tAO: { value: this.rtAO.texture }, uAO: { value: this.aoOn ? 1 : 0 }, uSharp: { value: q === 'low' ? 0 : q === 'medium' ? .25 : .35 }, tRay: { value: this.rtRay.texture }, uRays: { value: raySteps > 0 ? 1 : 0 },
        uTime: { value: 0 }, uRes: { value: new THREE.Vector2(W, H) },
        uSat: { value: .4 }, uTint: { value: new THREE.Vector3(1, 1, 1) }, uShadow: { value: new THREE.Vector3() }, uContrast: { value: 1.1 }, uExp: { value: 1 }, uWarm: { value: 0 },
        uRayS: { value: .5 }, uBloomS: { value: .45 }, uFear: { value: 0 }, uHurt: { value: 0 }, uEcho: { value: 0 }, uFade: { value: 0 }, uWhite: { value: 0 },
        uShock: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
        uWind: { value: new THREE.Vector4() },
      },
      vertexShader: VS,
      fragmentShader: `uniform sampler2D tColor,tBloom,tBloom2,tAO,tRay; uniform float uAO, uSharp; uniform float uTime,uSat,uContrast,uExp,uRayS,uBloomS,uFear,uHurt,uEcho,uFade,uWhite,uWarm,uRays;
        uniform vec3 uTint,uShadow; uniform vec2 uRes; uniform vec4 uShock[4]; uniform vec4 uWind; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
        float n2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
        vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.); }
        void main(){
          vec2 uv=vUv; float asp=uRes.x/uRes.y;
          // ondes de choc (Lueur) : réfraction annulaire
          for(int i=0;i<4;i++){ vec4 s=uShock[i]; if(s.w<=0.) continue;
            vec2 d=(uv-s.xy)*vec2(asp,1.); float l=length(d); float ring=exp(-pow((l-s.z)*18.,2.));
            uv-= normalize(d+1e-5)/vec2(asp,1.)*ring*s.w*.035; }
          // souffle : distorsion en cône chaud
          if(uWind.w>0.){ vec2 d=(uv-uWind.xy)*vec2(asp,1.); float along=d.x*sign(uWind.z); float cone=smoothstep(0.,.05,along)*smoothstep(.6,.1,along)*smoothstep(.08+along*.4,0.,abs(d.y));
            uv+=vec2(n2(uv*30.+vec2(-uTime*8.*uWind.z,0.))-.5, n2(uv*30.+11.-uTime*5.)-.5)*.02*cone*uWind.w; }
          // écho : ondulation de mémoire ; peur : distorsion
          uv += vec2(sin(uv.y*40.+uTime*3.),cos(uv.x*30.+uTime*2.))*.0025*uEcho;
          uv += (vec2(n2(uv*8.+uTime),n2(uv*8.-uTime))-.5)*.006*uFear;
          vec2 cc=uv-.5;
          float ca=(.0012+uFear*.005+uEcho*.003)*dot(cc,cc)*4.;
          vec3 col=vec3(texture2D(tColor,uv-cc*ca).r, texture2D(tColor,uv).g, texture2D(tColor,uv+cc*ca).b);
          // netteté légère (masque flou)
          vec2 px=1./uRes; vec3 nb=(texture2D(tColor,uv+vec2(px.x,0.)).rgb+texture2D(tColor,uv-vec2(px.x,0.)).rgb+texture2D(tColor,uv+vec2(0.,px.y)).rgb+texture2D(tColor,uv-vec2(0.,px.y)).rgb)*.25;
          col=max(col+(col-nb)*uSharp,0.);
          if(uAO>0.){ float ao=texture2D(tAO,uv).r; col*=mix(1.,ao,.85); }
          vec3 b1=texture2D(tBloom,uv).rgb, b2=texture2D(tBloom2,uv).rgb;
          if(any(isnan(b1))||any(isinf(b1))) b1=vec3(0.); if(any(isnan(b2))||any(isinf(b2))) b2=vec3(0.);
          col += b1*uBloomS + b2*uBloomS*.9;
          // halation : halo chaud autour des hautes lumières (pellicule)
          col += b2*vec3(.35,.12,.05)*uBloomS;
          if(uRays>0.) col += texture2D(tRay,uv).rgb*uRayS*mix(vec3(.85,.9,1.),vec3(1.1,.85,.6),uWarm);
          if(any(isnan(col))||any(isinf(col))) col=vec3(.02);
          col *= uExp;
          col = aces(col*1.15);
          float l=dot(col,vec3(.2126,.7152,.0722));
          float red=smoothstep(.2,.55,(col.r-max(col.g,col.b))/(col.r+.03));
          float sat=mix(uSat,1.05,red);
          sat*=1.-uHurt*.8;
          col=mix(vec3(l),col,sat);
          col=mix(uShadow+col*(1.-uShadow), col, smoothstep(0.,.5,l));
          col*=mix(uTint, vec3(1.12,1.0,.82), uWarm);
          col=(col-.5)*uContrast+.5;
          // vision Écho : monde bleuté, souvenirs lumineux
          vec3 echoCol=vec3(l)*vec3(.7,.95,1.25)+vec3(.02,.05,.09);
          echoCol+= (n2(uv*vec2(3.,60.)+uTime*.5)-.5)*.04;
          col=mix(col,echoCol,uEcho*.85);
          vec2 v=cc*vec2(asp,1.)*vec2(.92,1.);
          float vig=smoothstep(1.05,.35,length(v)+uFear*.15+uHurt*.25);
          vec2 b=abs(vUv-.5)*2.; float corner=pow(pow(b.x,8.)+pow(b.y,8.),1./8.);
          vig*=smoothstep(1.0,.94,corner);
          col*=mix(.08,1.,vig);
          col=mix(col, col*vec3(1.,.6,.6), uHurt*.35);
          float g=(h(vUv*uRes+fract(uTime)*91.7)+h(vUv*uRes*.5+fract(uTime*1.3)*37.1))*.5-.5; col+=g*.03*(1.1-l)*(1.-l*.5);
          col=mix(col,vec3(1.,.97,.92),uWhite);
          col*=1.-uFade;
          gl_FragColor=vec4(pow(clamp(col,0.,1.),vec3(1./2.2)),1.);
        }`
    });
  }
  // changement de définition SANS recréer textures ni shaders (aucune image noire, aucune recompilation)
  setSize(w, h, pr) {
    if (!this.rtMain) return;
    const W = Math.max(2, Math.floor(w * pr)), H = Math.max(2, Math.floor(h * pr));
    if (W === this.W && H === this.H) return;
    this.W = W; this.H = H;
    this.rtMain.setSize(W, H); this.rtDof.setSize(W, H);
    const q = (rt, s) => rt.setSize(Math.ceil(W / s), Math.ceil(H / s));
    q(this.rtA, 4); q(this.rtB, 4); q(this.rtRay, this.quality === 'high' ? 2 : 4); q(this.rtC, 8); q(this.rtD, 8); q(this.rtAO, 2);
    this.dofMat.uniforms.uRes.value.set(W, H); this.dofMat.uniforms.uScale.value = H / 900;
    this.brightMat.uniforms.uRes.value.set(this.rtA.width, this.rtA.height);
    this.aoMat.uniforms.uRes.value.set(W, H); this.finalMat.uniforms.uRes.value.set(W, H);
  }
  dispose() {
    for (const k of ['rtMain', 'rtDof', 'rtA', 'rtB', 'rtRay', 'rtC', 'rtD', 'rtAO']) if (this[k]) this[k].dispose();
    for (const k of ['dofMat', 'copyMat', 'brightMat', 'blurMat', 'rayMat', 'finalMat', 'aoMat']) if (this[k]) this[k].dispose();
  }
  pass(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.fsScene, this.fsCam); }
  render(scene, camera) {
    const p = this.params, r = this.r;
    r.setRenderTarget(this.rtMain); r.render(scene, camera);
    if (this.taps > 0) {
      const u = this.dofMat.uniforms; u.uFocus.value = p.focus; u.uAp.value = p.aperture; u.uNear.value = camera.near; u.uFar.value = camera.far;
      this.pass(this.dofMat, this.rtDof);
    } else this.pass(this.copyMat, this.rtDof);
    if (this.aoOn) { const au = this.aoMat.uniforms; au.uNear.value = camera.near; au.uFar.value = camera.far; au.uProj.value = 1 / Math.tan(camera.fov * Math.PI / 360) * .5; this.pass(this.aoMat, this.rtAO); }
    this.pass(this.brightMat, this.rtA);
    this.blurMat.uniforms.tColor.value = this.rtA.texture; this.blurMat.uniforms.uDir.value.set(1.6 / this.rtA.width, 0); this.pass(this.blurMat, this.rtB);
    this.blurMat.uniforms.tColor.value = this.rtB.texture; this.blurMat.uniforms.uDir.value.set(0, 1.6 / this.rtA.height); this.pass(this.blurMat, this.rtA);
    this.blurMat.uniforms.tColor.value = this.rtA.texture; this.blurMat.uniforms.uDir.value.set(2.2 / this.rtC.width, 0); this.pass(this.blurMat, this.rtD);
    this.blurMat.uniforms.tColor.value = this.rtD.texture; this.blurMat.uniforms.uDir.value.set(0, 2.2 / this.rtC.height); this.pass(this.blurMat, this.rtC);
    if (this.raySteps > 0) {
      const ru = this.rayMat.uniforms; ru.uLight.value.copy(p.light); ru.uNear.value = camera.near; ru.uFar.value = camera.far;
      this.pass(this.rayMat, this.rtRay);
    }
    const u = this.finalMat.uniforms, gr = p.grade;
    u.uTime.value = p.time; u.uSat.value = gr.sat; u.uTint.value.copy(gr.tint); u.uShadow.value.copy(gr.shadow); u.uContrast.value = gr.contrast; u.uExp.value = gr.exposure; u.uWarm.value = gr.warm;
    u.uRayS.value = p.rays; u.uBloomS.value = p.bloom; u.uFear.value = p.fear; u.uHurt.value = p.hurt; u.uEcho.value = p.echo; u.uFade.value = p.fade; u.uWhite.value = p.white;
    for (let i = 0; i < 4; i++) { const s = p.shocks[i]; if (s) u.uShock.value[i].set(s.x, s.y, s.r, s.s); else u.uShock.value[i].set(0, 0, 0, 0); }
    u.uWind.value.copy(p.wind);
    this.pass(this.finalMat, null);
  }
}
