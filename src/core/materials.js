// Matériaux partagés
import * as THREE from 'three';
import { T, normalOf } from './textures.js';
import { makeWet } from './wet.js';

let _M = null;
export function getMaterials() {
  if (_M) return _M;
  const std = o => new THREE.MeshStandardMaterial(o);
  const phys = o => new THREE.MeshPhysicalMaterial(o);
  const nS = v => new THREE.Vector2(v, v);
  _M = {
    bark: std({ map: T.bark(), normalMap: normalOf('bark', 6), normalScale: nS(1.4), color: 0x6a6460, roughness: .95 }),
    barkDark: std({ map: T.bark(), normalMap: normalOf('bark', 6), normalScale: nS(1.4), color: 0x2e2a28, roughness: .95 }),
    barkFar: std({ color: 0x1c1f24, roughness: 1 }),
    rust: std({ map: T.rust(), normalMap: normalOf('rust', 5), normalScale: nS(1.2), color: 0x9a7a6a, roughness: .8, metalness: .4 }),
    ground: std({ map: T.dirt(), normalMap: normalOf('dirt', 5), normalScale: nS(1.3), vertexColors: true, roughness: .97 }),
    coat: phys({ map: T.cloth(), normalMap: normalOf('cloth', 8), normalScale: nS(.8), color: 0x8a8e98, roughness: .9, sheen: .6, sheenColor: new THREE.Color(0x9aa0b0), sheenRoughness: .6, side: THREE.DoubleSide }),
    skin: phys({ color: 0xead2c2, roughness: .55, sheen: .4, sheenColor: new THREE.Color(0xffb8a0), sheenRoughness: .4, emissive: 0x2a120c, clearcoat: .08, clearcoatRoughness: .6 }),
    hair: phys({ color: 0x0c0c0f, roughness: .45, sheen: 1, sheenColor: new THREE.Color(0x40404a), sheenRoughness: .3 }),
    knit: phys({ map: T.knit(), normalMap: normalOf('knit', 4), normalScale: nS(1.6), color: 0xd8dae4, roughness: 1, sheen: 1, sheenColor: new THREE.Color(0x9aa0b0), sheenRoughness: .8 }),
    scarf: phys({ map: T.wool(), normalMap: normalOf('wool', 4), normalScale: nS(1.4), color: 0xffffff, roughness: 1, sheen: 1, sheenColor: new THREE.Color(0xff5040), sheenRoughness: .7, emissive: 0x3a0505, side: THREE.DoubleSide }),
    boot: phys({ color: 0x1c1a1a, roughness: .38, clearcoat: .5, clearcoatRoughness: .35 }),
    legs: phys({ map: T.knit(), normalMap: normalOf('knit', 3), color: 0x3a3c44, roughness: .9, sheen: .5, sheenColor: new THREE.Color(0x6a6c78) }),
    eye: std({ color: 0x050506, roughness: .08, metalness: .1 }),
    eyeShine: new THREE.MeshBasicMaterial({ color: 0x8a9098 }),
    leather: phys({ map: T.cloth(), normalMap: normalOf('cloth', 4), color: 0x7a5640, roughness: .62, clearcoat: .2, clearcoatRoughness: .5 }),
    stone: std({ color: 0x6c6862, roughness: .95, map: T.dirt(), normalMap: normalOf('dirt', 7), normalScale: nS(1.6) }),
    wood: std({ map: T.plank(), normalMap: normalOf('plank', 5), normalScale: nS(1.2), color: 0xd8d0c4, roughness: .9 }),
    woodDark: std({ map: T.plank(), normalMap: normalOf('plank', 5), normalScale: nS(1.2), color: 0x7a7068, roughness: .88 }),
    concrete: std({ map: T.concrete(), normalMap: normalOf('concrete', 4), normalScale: nS(1), color: 0x8a8c90, roughness: .62 }),
    concreteWall: std({ map: T.concrete(), normalMap: normalOf('concrete', 4), normalScale: nS(1), color: 0x5a5e62, roughness: .92 }),
    iron: std({ map: T.rust(), normalMap: normalOf('rust', 5), normalScale: nS(1), color: 0x4a4644, roughness: .55, metalness: .65 }),
    darkIron: std({ color: 0x16181a, roughness: .8, metalness: .5 }),
    chain: std({ color: 0x242424, roughness: .45, metalness: .8 }),
    wallpaper: std({ map: T.wallpaper(), normalMap: normalOf('wallpaper', 2), normalScale: nS(.6), color: 0xc8ccd0, roughness: .92 }),
    floorWood: std({ map: T.floorWood(), normalMap: normalOf('floorWood', 5), normalScale: nS(1.2), color: 0xb0a89c, roughness: .7 }),
    fabric: phys({ map: T.cloth(), normalMap: normalOf('cloth', 6), color: 0x8a8478, roughness: 1, sheen: .8, sheenColor: new THREE.Color(0xa09888) }),
    wolf: phys({ map: T.bark(), normalMap: normalOf('bark', 8), normalScale: nS(.9), color: 0x2a2a2c, roughness: .85, sheen: 1, sheenColor: new THREE.Color(0x5a5c66), sheenRoughness: .5 }),
    shadow: std({ color: 0x050506, roughness: 1 }),
    pale: std({ color: 0xb8b0a8, roughness: .7 }),
    redCoat: phys({ map: T.wool(), normalMap: normalOf('wool', 4), color: 0xffffff, roughness: 1, sheen: 1, sheenColor: new THREE.Color(0xff6050), emissive: 0x2a0404, side: THREE.DoubleSide }),
    hairCard: new THREE.MeshStandardMaterial({ map: T.hair(), color: 0xffffff, alphaTest: .35, side: THREE.DoubleSide, roughness: .45 }),
    rib: phys({ map: T.knit(), normalMap: normalOf('rib', 3), normalScale: nS(2), color: 0xd0d2dc, roughness: 1, sheen: 1, sheenColor: new THREE.Color(0x9aa0b0), sheenRoughness: .8 }),
    sclera: phys({ color: 0x8c8884, roughness: .25, clearcoat: 1, clearcoatRoughness: .05 }),
    iris: phys({ color: 0x0a0806, roughness: .1, clearcoat: 1, clearcoatRoughness: .02 }),
  };
  // les cartes de relief suivent la répétition des textures couleur
  for (const k in _M) { const m = _M[k]; if (m.normalMap && m.map && m.normalMap.userData.follow) m.normalMap.repeat = m.map.repeat; }
  // sols mouillés (flaques qui reflètent le ciel) et parquet ciré
  for (const k of ['ground', 'stone', 'concrete', 'wood', 'rust', 'iron']) makeWet(_M[k]);
  makeWet(_M.floorWood, { polish: .65 });
  return _M;
}
