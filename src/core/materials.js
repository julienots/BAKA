// Matériaux partagés
import * as THREE from 'three';
import { T } from './textures.js';

let _M = null;
export function getMaterials() {
  if (_M) return _M;
  const std = o => new THREE.MeshStandardMaterial(o);
  _M = {
    bark: std({ map: T.bark(), color: 0x6a6460, roughness: 1 }),
    barkDark: std({ map: T.bark(), color: 0x2e2a28, roughness: 1 }),
    barkFar: std({ color: 0x1c1f24, roughness: 1 }),
    rust: std({ map: T.rust(), color: 0x9a7a6a, roughness: .85, metalness: .35 }),
    ground: std({ map: T.dirt(), vertexColors: true, roughness: 1 }),
    coat: std({ map: T.cloth(), color: 0x70747e, roughness: .95 }),
    skin: std({ color: 0xe8d6c8, roughness: .6 }),
    hair: std({ color: 0x0d0d10, roughness: .5 }),
    knit: std({ map: T.knit(), color: 0xe0e2ea, roughness: 1 }),
    scarf: std({ map: T.wool(), color: 0xffffff, roughness: 1, emissive: 0x3a0505, side: THREE.DoubleSide }),
    boot: std({ color: 0x141416, roughness: .5 }),
    legs: std({ color: 0x1e1f24, roughness: .9 }),
    eye: std({ color: 0x050506, roughness: .08, metalness: .1 }),
    eyeShine: new THREE.MeshBasicMaterial({ color: 0x8a9098 }),
    leather: std({ color: 0x4a3426, roughness: .75 }),
    stone: std({ color: 0x6c6862, roughness: 1, map: T.dirt() }),
    wood: std({ map: T.plank(), color: 0xd8d0c4, roughness: .95 }),
    woodDark: std({ map: T.plank(), color: 0x7a7068, roughness: .95 }),
    concrete: std({ map: T.concrete(), color: 0x8a8c90, roughness: .7 }),
    concreteWall: std({ map: T.concrete(), color: 0x5a5e62, roughness: .95 }),
    iron: std({ map: T.rust(), color: 0x4a4644, roughness: .6, metalness: .6 }),
    darkIron: std({ color: 0x16181a, roughness: .8, metalness: .5 }),
    chain: std({ color: 0x242424, roughness: .45, metalness: .8 }),
    wallpaper: std({ map: T.wallpaper(), color: 0xc8ccd0, roughness: .95 }),
    floorWood: std({ map: T.floorWood(), color: 0xb0a89c, roughness: .8 }),
    fabric: std({ map: T.cloth(), color: 0x8a8478, roughness: 1 }),
    wolf: std({ color: 0x1a1a1c, roughness: .9 }),
    shadow: std({ color: 0x050506, roughness: 1 }),
    pale: std({ color: 0xb8b0a8, roughness: .7 }),
    redCoat: std({ map: T.wool(), color: 0xffffff, roughness: 1, emissive: 0x2a0404, side: THREE.DoubleSide }),
  };
  return _M;
}
