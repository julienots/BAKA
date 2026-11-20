// Brouillard volumétrique global : densité qui varie avec la hauteur et un bruit 3D animé.
// Remplace les morceaux de shader « fog » de three.js pour TOUS les matériaux.
// Astuce : le brouillard se déclare à la fois Fog et FogExp2 ; three.js transmet alors
// fogNear (= temps) et fogFar (= densité) au shader, qui utilise la branche personnalisée.
import * as THREE from 'three';

const C = THREE.ShaderChunk;
C.fog_pars_vertex = `#ifdef USE_FOG
  varying vec3 vFogWorld;
#endif`;
C.fog_vertex = `#ifdef USE_FOG
  vFogWorld = transpose(mat3(viewMatrix)) * (mvPosition.xyz - viewMatrix[3].xyz);
#endif`;
C.fog_pars_fragment = `#ifdef USE_FOG
  uniform vec3 fogColor;
  varying vec3 vFogWorld;
  uniform float fogNear;
  uniform float fogFar;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #endif
  float fogHash(vec3 p){ p=fract(p*.3183099+.1); p*=17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
  float fogNoise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
    return mix(mix(mix(fogHash(i),fogHash(i+vec3(1,0,0)),f.x),mix(fogHash(i+vec3(0,1,0)),fogHash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(fogHash(i+vec3(0,0,1)),fogHash(i+vec3(1,0,1)),f.x),mix(fogHash(i+vec3(0,1,1)),fogHash(i+vec3(1,1,1)),f.x),f.y),f.z); }
#endif`;
C.fog_fragment = `#ifdef USE_FOG
  {
    vec3 fw = vFogWorld; float dist = length(fw - cameraPosition);
    float ft = fogNear; float dens = fogFar;
    vec3 q = fw * .16 + vec3(ft * .12, ft * .02, ft * .05);
    float n = fogNoise(q);
    float hf = exp(-max(fw.y, 0.) * .2);
    float d = dens * (.7 + .55 * hf) * (.75 + .55 * n);
    float fogFactor = 1. - exp(-d * d * dist * dist);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor * (.88 + .28 * n), clamp(fogFactor, 0., 1.));
  }
#endif`;

export class NoiseFog {
  constructor(color, density) {
    this.isFog = true; this.isFogExp2 = true; this.name = '';
    this.color = new THREE.Color(color); this.density = density; this.near = 0; this.far = density;
  }
  set time(t) { this.near = t; }
  setDensity(d) { this.density = d; this.far = d; }
  clone() { return new NoiseFog(this.color, this.density); }
  toJSON() { return { type: 'NoiseFog', color: this.color.getHex(), density: this.density }; }
}
