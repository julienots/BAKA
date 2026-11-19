// Aides partagées par les niveaux
import * as THREE from 'three';
import { rr, rnd } from '../core/util.js';

export function forestDecor(g, x0, x1, o = {}) {
  const P = g.props;
  P.terrain(x0 - 10, x1 + 10, { color: o.ground || 0x8c847c, pathColor: o.path || 0xe8d8c0 });
  P.forest(x0, x1, { density: o.density || .5, clear: o.clear });
  P.grass(x0, x1, -14, -3.2, (x1 - x0) * 45, 1, o.grassFar || 0x8a8470);
  P.grass(x0, x1, 3.6, 5, (x1 - x0) * 4, .4, 0x6a6658, false);
  P.grass(x0, x1, -3, -2.5, (x1 - x0) * 6, .5, 0x7a7466);
  P.debris(x0, x1, -3, 2.6, (x1 - x0) * 3);
  P.twigs(x0, x1, -3, 2.6, (x1 - x0) * .6);
  for (let x = x0; x < x1; x += 30) {
    P.fogLayer(x + 15, 1.6, -4.5, 38, 4, o.fogCol || 0x7d8690, .28, .15);
    P.fogLayer(x + 15, 3.5, -9, 50, 8, o.fogCol || 0x7d8690, .38, .18);
    P.fogLayer(x + 15, 6.4, -16, 70, 14, o.fogCol || 0x7d8690, .45, .2);
    P.fogLayer(x + 15, 9, -30, 120, 22, o.fogCol || 0x7d8690, .45, .12);
  }
  // mur de brume à l'horizon
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(800, 40), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false,
    uniforms: { c: { value: new THREE.Color(o.horizon || 0x66707a) } }, vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform vec3 c; varying vec2 vUv; void main(){ gl_FragColor=vec4(c, smoothstep(.75,.42,vUv.y)); }` }));
  wall.position.set((x0 + x1) / 2, 0, -95); g.scene.add(wall);
}

// Silhouette qui emporte le manteau rouge au loin (fil narratif)
export function coatBearer(g, x, z) {
  const M = g.world.M, grp = new THREE.Group();
  const body = new THREE.Mesh(new THREE.ConeGeometry(.5, 3.4, 10), M.shadow); body.position.y = 1.8; grp.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.32, 12, 10), M.shadow); head.position.y = 3.7; head.scale.y = 1.3; grp.add(head);
  const arm = new THREE.Mesh(new THREE.CapsuleGeometry(.07, 1.8, 4, 6), M.shadow); arm.position.set(.4, 2.4, .2); arm.rotation.z = -.5; grp.add(arm);
  const coat = new THREE.Mesh(new THREE.ConeGeometry(.3, .7, 10, 1, true), M.redCoat); coat.position.set(.95, 1.55, .25); grp.add(coat);
  grp.position.set(x, 0, z); g.scene.add(grp);
  return grp;
}

export function lights(g, o) { g.setupLights(o); }
