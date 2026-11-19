// Mio « réel » : modèle 3D créé avec Tripo (GLB riggé Mixamo).
// Le squelette procédural de mio.js continue de calculer toutes les poses (ressorts, foulée, escalade…) ;
// ce module les retransmet chaque image sur les os Mixamo du modèle.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const URL = './models/mio.glb';
let cache = null, promise = null;
export function loadMioSkin() {
  if (!promise) promise = new GLTFLoader().loadAsync(URL).then(g => { cache = g; return g; }).catch(e => { console.warn('Modèle Mio indisponible, version procédurale utilisée', e); return null; });
  return promise;
}
export function mioSkinReady() { return cache; }

const AX = { X: new THREE.Vector3(1, 0, 0), nX: new THREE.Vector3(-1, 0, 0), Y: new THREE.Vector3(0, 1, 0), Z: new THREE.Vector3(0, 0, 1) };
const qa = (axis, ang) => new THREE.Quaternion().setFromAxisAngle(axis, ang);
const HEIGHT = 1.42; // taille de Mio dans le monde (m)

export class MioSkin {
  constructor(gltf) {
    this.root = SkeletonUtils.clone(gltf.scene);
    // le modèle Tripo regarde +Z : on le tourne pour qu'il regarde +X comme le squelette procédural
    const box = new THREE.Box3().setFromObject(this.root); const h = box.max.y - box.min.y || 1;
    this.k = HEIGHT / h;
    this.holder = new THREE.Group(); this.holder.rotation.y = Math.PI / 2; this.holder.scale.setScalar(this.k); this.holder.add(this.root);
    this.root.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
        const m = o.material; if (m) { m.envMapIntensity = .6; if (m.roughness !== undefined) m.roughness = Math.max(.55, m.roughness); }
      }
    });
    // os et poses de repos (dans le repère du modèle)
    this.b = {};
    this.root.traverse(o => { if (o.isBone) this.b[o.name.replace(/^mixamorig[:_]?/, '')] = o; });
    this.root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    this.rest = {};
    for (const n in this.b) {
      const bone = this.b[n], mw = new THREE.Matrix4().multiplyMatrices(inv, bone.matrixWorld), q = new THREE.Quaternion();
      mw.decompose(new THREE.Vector3(), q, new THREE.Vector3());
      this.rest[n] = { local: bone.quaternion.clone(), model: q, pos: bone.position.clone() };
    }
    const hips = this.b.Hips;
    if (hips && hips.parent) { const s = new THREE.Vector3(); const pm = new THREE.Matrix4().multiplyMatrices(inv, hips.parent.matrixWorld); pm.decompose(new THREE.Vector3(), new THREE.Quaternion(), s); this.hipScale = s.y || 1; } else this.hipScale = 1;
    this.tmp = new THREE.Quaternion();
  }
  // applique une rotation exprimée dans le repère du personnage (X = gauche, Y = haut, Z = avant)
  set(name, qModel) {
    const bone = this.b[name], r = this.rest[name]; if (!bone) return;
    // q_local = repos_local · (repos_modèle⁻¹ · q · repos_modèle)
    this.tmp.copy(r.model).invert().multiply(qModel).multiply(r.model);
    bone.quaternion.copy(r.local).multiply(this.tmp);
  }
  // S : ressorts du squelette procédural (valeurs .v)
  apply(S, glow) {
    const v = n => (S[n] ? S[n].v : 0);
    // bassin : hauteur, balancement latéral, roulis, torsion
    const hips = this.b.Hips, hr = this.rest.Hips;
    if (hips) {
      hips.position.copy(hr.pos);
      hips.position.y += v('pelY') * 1.15 / this.k / this.hipScale;
      hips.position.x += v('side') * 1.15 / this.k / this.hipScale;
      this.set('Hips', qa(AX.Y, v('pelTwist')).multiply(qa(AX.Z, v('pelRoll'))));
    }
    // colonne : inclinaison avant/arrière répartie sur 3 vertèbres + contre-rotation des épaules
    const lean = v('lean'), twist = v('chestTwist');
    for (const [n, k] of [['Spine', .35], ['Spine1', .35], ['Spine2', .3]]) this.set(n, qa(AX.Y, twist * k).multiply(qa(AX.nX, lean * k + (n === 'Spine2' ? v('chestPitch') : 0))));
    // tête et cou
    this.set('Neck', qa(AX.nX, -v('neckP') * .3));
    this.set('Head', qa(AX.Y, v('headY')).multiply(qa(AX.Z, v('headR'))).multiply(qa(AX.nX, -v('headP'))));
    // jambes : hanche (avant/arrière + écart), genou, cheville
    for (const [side, s] of [['Left', 'L'], ['Right', 'R']]) {
      const out = v('hipOut' + s) * (side === 'Left' ? 1 : -1);
      this.set(side + 'UpLeg', qa(AX.nX, v('hip' + s)).multiply(qa(AX.Z, out)));
      this.set(side + 'Leg', qa(AX.nX, Math.min(0, v('knee' + s))));
      this.set(side + 'Foot', qa(AX.nX, v('ank' + s) * .6));
    }
    // bras : la pose de repos Mixamo est en T ; on les abaisse le long du corps puis on applique les mouvements
    for (const [side, s, sg] of [['Left', 'L', 1], ['Right', 'R', -1]]) {
      const down = qa(AX.Z, sg * (-Math.PI / 2 + .14 + v('shOut' + s) * .9));
      this.set(side + 'Arm', qa(AX.nX, v('sh' + s)).multiply(down));
      const flex = Math.abs(Math.min(0, v('el' + s)));
      this.set(side + 'ForeArm', qa(AX.Y, -sg * flex));
      // doigts : prise selon l'état (escalade, poussée, course)
      const g = Math.max(0, Math.min(1.2, v('grip' + s)));
      for (const f of ['Index', 'Middle', 'Ring', 'Pinky']) for (let i = 1; i <= 3; i++) this.set(`${side}Hand${f}${i}`, qa(AX.Z, -sg * g * (i === 1 ? .55 : .75)));
      for (let i = 2; i <= 3; i++) this.set(`${side}HandThumb${i}`, qa(AX.Y, -sg * g * .35));
    }
  }
}
