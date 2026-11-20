// Sol mouillé : flaques et humidité procédurales en espace monde, pour les surfaces horizontales.
// Les flaques sont presque lisses (elles reflètent le ciel du niveau via l'IBL) et plus sombres ;
// le reste du sol garde une humidité légère. Un parquet peut être « ciré » (reflets doux partout).
import * as THREE from 'three';

export const WET = { value: 0 };     // intensité globale, réglée par chapitre
export const RAIN = { value: 0 };    // anneaux de pluie dans les flaques
export const TIME = { value: 0 };

export function makeWet(mat, { polish = 0 } = {}) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.uWet = WET; sh.uniforms.uRain = RAIN; sh.uniforms.uWTime = TIME;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uWet, uRain, uWTime;
float wHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(wHash(i), wHash(i + vec2(1, 0)), f.x), mix(wHash(i + vec2(0, 1)), wHash(i + vec2(1, 1)), f.x), f.y); }
// anneaux de gouttes : une goutte par cellule, rayon qui grandit et s'efface
vec2 wRipple(vec2 p){ vec2 acc = vec2(0.);
  for (int k = 0; k < 2; k++) { vec2 q = p * (k == 0 ? 3.1 : 4.7) + float(k) * 7.3; vec2 c = floor(q), f = fract(q) - .5;
    vec2 o = vec2(wHash(c), wHash(c + 3.7)) - .5; float t = fract(uWTime * .9 + wHash(c + 1.3));
    vec2 d = f - o * .6; float r = length(d); float ring = sin((r - t * .45) * 70.) * smoothstep(.1, 0., abs(r - t * .45)) * (1. - t);
    acc += normalize(d + 1e-4) * ring; }
  return acc; }`)
      .replace('#include <lights_physical_fragment>', `
#ifdef USE_FOG
{
  vec3 wN = inverseTransformDirection(nonPerturbedNormal, viewMatrix);
  float up = smoothstep(.55, .92, wN.y);
  vec2 wp = vFogWorld.xz;
  float m = wNoise(wp * .42) * .62 + wNoise(wp * 1.6 + 3.1) * .28 + wNoise(wp * 5.3) * .1;
  float pud = smoothstep(.56, .62, m) * up * uWet;
  float damp = up * uWet * (.45 + .55 * smoothstep(.3, .56, m));
  diffuseColor.rgb *= 1. - .38 * damp - .2 * pud;
  roughnessFactor = mix(roughnessFactor, roughnessFactor * .55, damp);
  roughnessFactor = mix(roughnessFactor, .045, pud);
  ${polish ? `roughnessFactor = mix(roughnessFactor, .22 + .15 * wNoise(wp * 2.3), ${polish.toFixed(2)} * up);` : ''}
  vec3 nFlat = nonPerturbedNormal;
  if (uRain > 0. && pud > .01) { vec2 rp = wRipple(wp) * .35 * uRain; nFlat = normalize(nFlat + (viewMatrix * vec4(rp.x, 0., rp.y, 0.)).xyz); }
  normal = normalize(mix(normal, nFlat, max(pud, ${polish ? (polish * .5).toFixed(2) : '0.'} * up)));
}
#endif
#include <lights_physical_fragment>`);
  };
  mat.customProgramCacheKey = () => 'wet' + polish;
  mat.needsUpdate = true;
  return mat;
}
