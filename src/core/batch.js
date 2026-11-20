// Fusion statique des décors : regroupe les maillages immobiles qui partagent le même matériau
// (par tronçons de 30 m pour garder l'élimination hors champ). Divise fortement les appels de dessin.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const KEEP = ['position', 'normal', 'uv'];

export function staticBatch(scene, chunk = 30) {
  scene.updateMatrixWorld(true);
  const groups = new Map(), cand = [];
  scene.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || !o.userData.static || !o.visible || !o.geometry || Array.isArray(o.material)) return;
    const geo = o.geometry; if (!geo.attributes.position || !geo.attributes.normal) return;
    // tous les ancêtres doivent être visibles et immobiles
    let p = o.parent, ok = true; while (p && p !== scene) { if (!p.visible) { ok = false; break; } p = p.parent; } if (!ok) return;
    cand.push(o);
  });
  const box = new THREE.Box3(), c = new THREE.Vector3();
  for (const o of cand) {
    const geo = o.geometry;
    const sig = KEEP.filter(a => geo.attributes[a]).join(',') + (geo.index ? '|i' : '|n');
    box.setFromObject(o); box.getCenter(c);
    const key = [o.material.uuid, o.castShadow ? 1 : 0, o.receiveShadow ? 1 : 0, sig, Math.floor(c.x / chunk)].join('/');
    if (!groups.has(key)) groups.set(key, []); groups.get(key).push(o);
  }
  let removed = 0, created = 0;
  for (const [, list] of groups) {
    if (list.length < 2) continue;
    const geos = [];
    for (const o of list) {
      const g = o.geometry.clone();
      for (const a of Object.keys(g.attributes)) if (!KEEP.includes(a)) g.deleteAttribute(a);
      g.morphAttributes = {}; g.clearGroups();
      g.applyMatrix4(o.matrixWorld); geos.push(g);
    }
    let merged = null;
    try { merged = mergeGeometries(geos, false); } catch (e) { merged = null; }
    geos.forEach(g => g.dispose());
    if (!merged) continue;
    merged.computeBoundingSphere(); merged.computeBoundingBox();
    const m = new THREE.Mesh(merged, list[0].material); m.castShadow = list[0].castShadow; m.receiveShadow = list[0].receiveShadow; m.matrixAutoUpdate = false; m.updateMatrix();
    m.userData.batched = true; scene.add(m); created++;
    for (const o of list) { o.parent && o.parent.remove(o); removed++; }
  }
  // les objets statiques restants n'ont plus besoin de recalculer leur matrice à chaque image
  scene.traverse(o => { if (o.userData.static && o.parent) { o.updateMatrix(); o.matrixAutoUpdate = false; } });
  return { removed, created };
}

// Fusionne les enfants directs d'un groupe articulé qui partagent un matériau (repère local conservé)
export function mergeChildren(group) {
  const by = new Map();
  for (const o of [...group.children]) {
    if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || o.children.length || Array.isArray(o.material) || !o.geometry.attributes.normal) continue;
    const sig = o.material.uuid + (o.geometry.index ? 'i' : 'n') + (o.geometry.attributes.uv ? 'u' : '');
    if (!by.has(sig)) by.set(sig, []); by.get(sig).push(o);
  }
  for (const [, list] of by) {
    if (list.length < 2) continue;
    const geos = list.map(o => { o.updateMatrix(); const g = o.geometry.clone(); for (const a of Object.keys(g.attributes)) if (!KEEP.includes(a)) g.deleteAttribute(a); g.clearGroups(); g.applyMatrix4(o.matrix); return g; });
    let merged = null; try { merged = mergeGeometries(geos, false); } catch (e) { merged = null; }
    if (!merged) continue;
    const m = new THREE.Mesh(merged, list[0].material); m.castShadow = list.some(o => o.castShadow); m.receiveShadow = list[0].receiveShadow;
    group.add(m); for (const o of list) group.remove(o);
  }
}
export function mergeTree(root) { root.traverse(o => { if (o.isGroup || o.isObject3D) { if (o.children && o.children.length > 1) mergeChildren(o); } }); }
