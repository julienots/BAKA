// Éclairage d'environnement (IBL) généré pour chaque chapitre : un ciel en dégradé + la lueur de la source principale,
// préfiltré (PMREM). Les matériaux PBR reflètent alors le vrai ciel du niveau (flaques, métal, parquet ciré, bottes vernies).
import * as THREE from 'three';

let pmrem = null, last = null;
export const ENV = { tex: null };
export function makeEnvironment(renderer, o) {
  if (!pmrem) pmrem = new THREE.PMREMGenerator(renderer);
  const sc = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { uTop: { value: new THREE.Color(o.top) }, uHor: { value: new THREE.Color(o.horizon) }, uBot: { value: new THREE.Color(o.ground) }, uSun: { value: new THREE.Vector3(...o.sunDir).normalize() }, uSunCol: { value: new THREE.Color(o.sunCol).multiplyScalar(o.sunI ?? 2) } },
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform vec3 uTop, uHor, uBot, uSun, uSunCol; varying vec3 vD;
      void main(){ vec3 d = normalize(vD);
        vec3 c = d.y > 0. ? mix(uHor, uTop, pow(d.y, .6)) : mix(uHor, uBot, pow(-d.y, .35));
        float s = max(dot(d, uSun), 0.);
        c += uSunCol * (pow(s, 24.) * 1.2 + pow(s, 4.) * .25);
        gl_FragColor = vec4(c, 1.); }`,
  });
  sc.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), mat));
  const rt = pmrem.fromScene(sc, .02, .1, 50);
  mat.dispose(); sc.children[0].geometry.dispose();
  if (last) last.dispose();
  last = rt; ENV.tex = rt.texture;
  return rt.texture;
}
