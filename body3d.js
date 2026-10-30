// 3D 인체 (Three.js). 두 가지 모양을 지원한다.
//  - toon: 기본 도형을 조립한 2.5등신 캐릭터
//  - mannequin: 데생 인형 스타일의 인체 모델(glTF, three.js 예제의 Mixamo X Bot) — 뼈대/위치로 부위를 자동 분류해 색을 입힌다
// 부위마다 진행률 색을 입히고, 탭하면 onPick(part)가 호출된다. WebGL 실패 시 window.Body3D = null → 2D(SVG) 그림으로 대체.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const MODEL_URL = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/models/gltf/Xbot.glb';
const TARGET_Y = 2.65, POLAR = 1.38;                // 시선 높이 / 고정 고도각(살짝 내려다봄)
const FIG_H = 5.25;                                  // 캐릭터 키(월드 단위) — 두 모양 모두 같은 프레이밍
const VIEW_AZ = { front: 0, side: Math.PI / 2, back: Math.PI };
const PART_NAMES = { shoulder: '어깨', chest: '가슴', back: '등', lowback: '허리', arm: '팔', abs: '복근', leg: '허벅지', calf: '종아리', cardio: '유산소' };
const REG_PARTS = [null, 'shoulder', 'chest', 'back', 'lowback', 'arm', 'abs', 'leg', 'calf']; // 마네킹 재질 인덱스 → 부위
const FONT = '"Pretendard Variable",Pretendard,-apple-system,"Noto Sans KR",sans-serif';

function create() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch (e) { return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const el = document.createElement('div');
  el.className = 'fig3d';
  el.appendChild(renderer.domElement);
  el.insertAdjacentHTML('beforeend', '<div class="hint3d">드래그해서 돌려보세요</div><div class="load3d">모델 불러오는 중…</div>');

  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;
  scene.add(new THREE.HemisphereLight(0xffffff, 0xcfe0ff, 0.85));
  const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(3, 6, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0xa9c8ff, 0.9); rim.position.set(-5, 3, -5); scene.add(rim);

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  camera.position.set(0, TARGET_Y + 12 * Math.cos(POLAR), 12 * Math.sin(POLAR));
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, TARGET_Y, 0);
  controls.enablePan = false; controls.enableZoom = false;
  controls.minPolarAngle = controls.maxPolarAngle = POLAR;
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.rotateSpeed = 0.9;
  controls.autoRotate = true; controls.autoRotateSpeed = 2.2;
  renderer.domElement.style.touchAction = 'pan-y';   // 세로 스와이프는 페이지 스크롤, 가로 드래그는 회전

  /* ---------- 재질 ---------- */
  const phys = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.45, ...o });
  const M = {
    skin: phys('#f6c7a0', { roughness: 0.7, clearcoat: 0.05 }),
    suit: phys('#2e3b55', { roughness: 0.55, clearcoat: 0.35 }),
    hair: phys('#4a3426', { roughness: 0.75, clearcoat: 0.1 }),
    shoe: phys('#ffffff', { roughness: 0.35, clearcoat: 0.6 }),
    eye: phys('#241b14', { roughness: 0.25, clearcoat: 0.8 }),
    white: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    cheek: new THREE.MeshBasicMaterial({ color: '#ff8fa0', transparent: true, opacity: 0.55 }),
    mouth: new THREE.MeshBasicMaterial({ color: '#8a3d33' }),
    mannBase: phys('#a9b4c6', { roughness: 0.5, clearcoat: 0.45 }),
    mannJoint: phys('#3a4250', { roughness: 0.45, clearcoat: 0.3 }),
  };
  const region = {};                                  // part → 공유 재질 (색만 바꾸면 두 모양 모두 해당 부위가 바뀜)
  Object.keys(PART_NAMES).forEach(p => { region[p] = phys('#eef2f8', { roughness: 0.42, clearcoat: 0.45 }); });

  /* ---------- 라벨(스프라이트) · 통증 마커 ---------- */
  // specs: [{part,pos,w,nz,pill}] nz=라벨이 향하는 면(+1 앞, -1 뒤, 0 항상) / painSpecs: {part:[x,y,z]}
  function makeLabels(specs, painSpecs) {
    const sprites = specs.map(L => {
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = L.pill ? 96 : 128;
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      sp.position.set(...L.pos); sp.scale.set(L.w, L.w * cv.height / 256, 1);
      sp.userData.part = L.part; sp.renderOrder = 5; sp.visible = false; scene.add(sp);
      return { L, cv, tex, sp, nz: L.nz };
    });
    const pains = {};
    Object.entries(painSpecs).forEach(([p, pos]) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), new THREE.MeshBasicMaterial({ color: '#ff8a1f', transparent: true }));
      m.position.set(...pos); m.visible = false; scene.add(m); pains[p] = { m, level: 0 };
    });
    return { sprites, pains };
  }
  function drawLabel({ L, cv, tex }, i) {
    const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (L.pill) {
      g.fillStyle = i.color; g.beginPath(); g.roundRect(8, 8, cv.width - 16, cv.height - 16, 40); g.fill();
      g.fillStyle = i.ink; g.font = `700 36px ${FONT}`; g.fillText(`${PART_NAMES[L.part]}  ${i.pct}`, cv.width / 2, cv.height / 2 + 2);
    } else {
      g.fillStyle = i.ink; g.font = `600 36px ${FONT}`; g.fillText(PART_NAMES[L.part], 128, 40);
      g.font = `800 62px ${FONT}`; g.fillText(i.pct, 128, 92);
    }
    tex.needsUpdate = true;
  }
  const CARDIO = { part: 'cardio', pos: [-1.35, 5.0, 0], w: 1.2, pill: true, nz: 0 };

  /* ---------- 리그 1: 귀여운 캐릭터 (도형 조립) ---------- */
  function buildToon() {
    const group = new THREE.Group(); scene.add(group);
    const meshes = [];                                // 레이캐스트 대상 (가림 판정까지 모든 메시)
    function put(geo, mat, x, y, z, { s = [1, 1, 1], r = [0, 0, 0], part } = {}) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z); m.scale.set(...s); m.rotation.set(...r);
      if (part) m.userData.part = part;
      group.add(m); meshes.push(m); return m;
    }
    const sph = (r, w = 40, h = 28) => new THREE.SphereGeometry(r, w, h);
    const cap = (r, len) => new THREE.CapsuleGeometry(r, len, 10, 28);
    // 타원체 표면에 얹는 판(타일). y0~y1 구간, phi(방위) 중심±폭. 앞=π/2, 뒤=3π/2
    function patch(part, cy, rx, ry, rz, y0, y1, phiC, phiH) {
      const t0 = Math.acos(Math.min(1, (y1 - cy) / ry)), t1 = Math.acos(Math.max(-1, (y0 - cy) / ry));
      const g = new THREE.SphereGeometry(1, 40, 24, phiC - phiH, 2 * phiH, t0, t1 - t0);
      const k = 1.03;
      return put(g, region[part], 0, cy, 0, { s: [rx * k, ry * k, rz * k], part });
    }
    const F = Math.PI / 2, B = Math.PI * 1.5;
    put(sph(1, 48, 32), M.suit, 0, 2.55, 0, { s: [0.75, 0.85, 0.5] });
    put(sph(1), M.suit, 0, 1.8, 0, { s: [0.7, 0.4, 0.48] });
    patch('chest', 2.55, 0.75, 0.85, 0.5, 2.78, 3.28, F, 1.0);
    patch('abs', 2.55, 0.75, 0.85, 0.5, 1.95, 2.7, F, 0.85);
    patch('back', 2.55, 0.75, 0.85, 0.5, 2.6, 3.3, B, 1.15);
    patch('lowback', 2.55, 0.75, 0.85, 0.5, 1.9, 2.5, B, 0.95);
    [-1, 1].forEach(sx => {
      put(cap(0.3, 0.35), region.leg, sx * 0.34, 1.25, 0, { part: 'leg' });
      put(sph(0.33), region.leg, sx * 0.3, 1.68, -0.18, { s: [1, 1, 0.92], part: 'leg' });
      put(cap(0.24, 0.25), region.calf, sx * 0.34, 0.55, 0.02, { part: 'calf' });
      put(sph(0.3), M.shoe, sx * 0.34, 0.17, 0.12, { s: [1, 0.6, 1.55] });
      put(sph(0.38), region.shoulder, sx * 0.95, 3.1, 0, { part: 'shoulder' });
      put(cap(0.26, 0.3), region.arm, sx * 1.07, 2.55, 0, { r: [0, 0, sx * 0.07], part: 'arm' });
      put(cap(0.22, 0.3), region.arm, sx * 1.12, 1.75, 0.04, { part: 'arm' });
      put(sph(0.27), M.skin, sx * 1.14, 1.27, 0.05);
    });
    put(new THREE.CylinderGeometry(0.22, 0.26, 0.4, 24), M.skin, 0, 3.5, 0);
    put(sph(0.88, 56, 40), M.skin, 0, 4.35, 0, { s: [1, 0.96, 0.97] });
    [-1, 1].forEach(sx => put(sph(0.17, 20, 16), M.skin, sx * 0.87, 4.28, 0, { s: [0.6, 1, 1] }));
    const hairCap = (th, phi0, phiLen, r) => put(new THREE.SphereGeometry(r, 48, 32, phi0, phiLen, 0, th), M.hair, 0, 4.35, 0, { s: [1, 0.96, 0.97] });
    hairCap(1.0, 0, Math.PI * 2, 0.915);
    hairCap(1.95, Math.PI - 0.5, Math.PI + 1.0, 0.905);
    [-1, 1].forEach(sx => {
      put(sph(0.105, 20, 16), M.eye, sx * 0.3, 4.3, 0.8, { s: [0.85, 1.2, 0.6] });
      put(sph(0.035, 10, 8), M.white, sx * 0.3 + 0.025, 4.35, 0.865);
      put(sph(0.16, 20, 14), M.cheek, sx * 0.52, 4.07, 0.64, { s: [1, 0.7, 0.35], r: [0, sx * 0.55, 0] });
    });
    put(new THREE.TorusGeometry(0.16, 0.03, 10, 28, Math.PI), M.mouth, 0, 4.1, 0.845, { r: [0, 0, Math.PI] });

    const lab = (part, x, y, z, w) => ({ part, pos: [x, y, z], w, nz: Math.sign(z) });
    const labels = makeLabels([
      lab('chest', 0, 3.02, 0.62, 1.15), lab('abs', 0, 2.3, 0.58, 1.15), lab('back', 0, 3.0, -0.62, 1.15), lab('lowback', 0, 2.2, -0.58, 1.05),
      lab('shoulder', 1.05, 3.28, 0.34, 0.85), lab('shoulder', 1.05, 3.28, -0.34, 0.85),
      lab('arm', 1.1, 2.3, 0.3, 0.85), lab('arm', 1.1, 2.3, -0.3, 0.85),
      lab('leg', 0.34, 1.3, 0.34, 0.95), lab('leg', 0.34, 1.0, -0.32, 0.95),
      lab('calf', 0.34, 0.58, 0.29, 0.85), lab('calf', 0.34, 0.58, -0.25, 0.85), CARDIO,
    ], { shoulder: [1.3, 3.5, 0.2], chest: [0.5, 3.2, 0.55], abs: [0.4, 2.1, 0.55], back: [0.5, 3.2, -0.55], lowback: [0.4, 2.0, -0.5], arm: [1.3, 2.6, 0.15], leg: [0.55, 1.4, 0.3], calf: [0.55, 0.7, 0.2] });
    return { group, labels, pickList: () => meshes.filter(m => m.visible), partOf: h => h.object.userData.part || null };
  }

  /* ---------- 리그 2: 마네킹 (glTF, 뼈대 기반 부위 분류) ---------- */
  const boneGroup = name => {
    const n = name.replace(/^mixamorig:?/, '').replace(/^(Left|Right)/, '');
    if (n === 'Hips') return 'hips';
    if (/^Spine/.test(n)) return 'spine';
    if (/^(Neck|Head|Eye)/.test(n) || n === 'HeadTop_End') return 'head';
    if (n === 'Shoulder') return 'clav';
    if (n === 'Arm') return 'uarm';
    if (n === 'ForeArm') return 'farm';
    if (/^Hand/.test(n)) return 'hand';
    if (n === 'UpLeg') return 'upleg';
    if (n === 'Leg') return 'leg';
    return 'foot';
  };
  async function buildMannequin() {
    const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
    const root = gltf.scene;
    let surface = null, joints = null;
    root.traverse(o => { if (o.isSkinnedMesh) { if (/Surface/i.test(o.name)) surface = o; else joints = o; } });
    if (!surface) throw new Error('mesh not found');
    const group = new THREE.Group(); group.add(root); scene.add(group);

    // 포즈: idle 애니메이션 첫 프레임에서 고정 (팔을 내린 자세)
    const idle = THREE.AnimationClip.findByName(gltf.animations, 'idle') || gltf.animations[0];
    if (idle) { const mx = new THREE.AnimationMixer(root); mx.clipAction(idle).play(); mx.update(0); }
    const geo = surface.geometry, P = geo.attributes.position, N = P.count;
    const bones = surface.skeleton.bones, bg = bones.map(b => boneGroup(b.name));
    const bind = bones.map((b, i) => new THREE.Vector3().setFromMatrixPosition(surface.skeleton.boneInverses[i].clone().invert()).applyMatrix4(surface.bindMatrixInverse));
    // Mixamo 뼈 좌표는 cm, 메시 정점은 m 인 경우가 있어 단위를 맞춘다 (10의 거듭제곱 비율로 보정)
    geo.computeBoundingBox();
    const topY = bind[bones.findIndex(b => /HeadTop_End$/.test(b.name))].y;
    const unit = Math.pow(10, Math.round(Math.log10(geo.boundingBox.max.y / topY)));
    bind.forEach(p => p.multiplyScalar(unit));
    const B = n => bind[bones.findIndex(b => b.name.replace(/^mixamorig:?/, '') === n)];
    const hips = B('Hips'), sp1 = B('Spine1'), sp2 = B('Spine2'), neck = B('Neck');
    const armPos = { L: B('LeftArm'), R: B('RightArm') }, foreArm = { L: B('LeftForeArm'), R: B('RightForeArm') };

    // 몸통 중심 z (앞/뒤 구분선)
    const vgOf = mesh => {                            // 정점 → 우세한 뼈 그룹
      const g = mesh.geometry, Si = g.attributes.skinIndex, Wt = g.attributes.skinWeight, out = new Array(g.attributes.position.count);
      for (let i = 0; i < out.length; i++) {
        const acc = {};
        for (let k = 0; k < 4; k++) { const gr = bg[Si.getComponent(i, k)]; acc[gr] = (acc[gr] || 0) + Wt.getComponent(i, k); }
        out[i] = Object.entries(acc).sort((x, y) => y[1] - x[1])[0][0];
      }
      return out;
    };
    const vg = vgOf(surface);
    let zs = 0, zn = 0;
    for (let i = 0; i < N; i++) if (vg[i] === 'spine' || vg[i] === 'hips') { zs += P.getZ(i); zn++; }
    const zc = zs / zn;
    const yChest = sp1.y + 0.45 * (sp2.y - sp1.y), yNeck = neck.y - 0.02, yGlute = hips.y - 0.07;
    const R = Object.fromEntries(REG_PARTS.map((p, i) => [p, i]));
    // 정점 → 부위. jointMode(관절 메시)는 허리 가운데(복근/허리)만 칠하고 나머지 관절은 어두운 색 그대로 둔다
    const regOf = (mesh, vgs, jointMode) => {
      const pos = mesh.geometry.attributes.position, out = new Uint8Array(pos.count), v = new THREE.Vector3();
      for (let i = 0; i < out.length; i++) {
        v.fromBufferAttribute(pos, i);
        const front = v.z > zc, g = vgs[i];
        let r = 0;
        if (jointMode) {
          if (g === 'spine' || g === 'hips') r = front ? (v.y > hips.y && v.y <= yChest ? R.abs : 0) : (v.y > yGlute && v.y <= sp1.y ? R.lowback : 0);
        } else if (g === 'uarm') {
          const side = armPos.L.x * v.x > 0 ? 'L' : 'R', a = armPos[side], f = foreArm[side];
          const ax = f.clone().sub(a), t = v.clone().sub(a).dot(ax) / ax.lengthSq();
          r = t < 0.36 ? R.shoulder : R.arm;
        } else if (g === 'farm') r = R.arm;
        else if (g === 'upleg') r = R.leg;
        else if (g === 'leg') r = R.calf;
        else if (g === 'clav' && Math.abs(v.x) > 0.13) r = R.shoulder;
        else if (g === 'spine' || g === 'hips' || g === 'clav') {
          if (front) r = v.y > yChest ? (v.y < yNeck ? R.chest : 0) : (v.y > hips.y ? R.abs : 0);
          else r = v.y > sp1.y ? (v.y < yNeck + 0.02 ? R.back : 0) : (v.y > yGlute ? R.lowback : R.leg);
        }
        out[i] = r;
      }
      return out;
    };
    // 삼각형 → 부위(다수결). 부위별로 인덱스를 모아 geometry group 으로 분리 → 재질 배열로 경계가 선명하게 칠해짐
    const applyGroups = (mesh, rg, baseMat) => {
      const g = mesh.geometry, idx = g.index.array, buckets = REG_PARTS.map(() => []);
      for (let t = 0; t < idx.length; t += 3) {
        const a = idx[t], b = idx[t + 1], c = idx[t + 2], ra = rg[a], rb = rg[b], rc = rg[c];
        buckets[ra === rb || ra === rc ? ra : rb === rc ? rb : ra].push(a, b, c);
      }
      const ni = new (idx.constructor)(idx.length); let off = 0;
      g.clearGroups();
      buckets.forEach((arr, m) => { ni.set(arr, off); if (arr.length) g.addGroup(off, arr.length, m); off += arr.length; });
      g.setIndex(new THREE.BufferAttribute(ni, 1));
      mesh.material = REG_PARTS.map(p => p ? region[p] : baseMat);
    };
    const reg = regOf(surface, vg, false);
    applyGroups(surface, reg, M.mannBase);
    if (joints) applyGroups(joints, regOf(joints, vgOf(joints), true), M.mannJoint);

    // 배치: 키를 FIG_H 로 맞추고 발을 y=0 에
    const s = FIG_H / geo.boundingBox.max.y;
    group.scale.setScalar(s); group.position.y = 0.003 * s;
    group.updateMatrixWorld(true); surface.skeleton.update();

    // 4) 라벨/통증 위치: 포즈가 반영된 정점 좌표에서 부위별 앞/뒤 대표점 계산
    const wp = new Float32Array(N * 3), tmp = new THREE.Vector3();
    for (let i = 0; i < N; i++) { surface.getVertexPosition(i, tmp); surface.localToWorld(tmp); wp.set([tmp.x, tmp.y, tmp.z], i * 3); }
    const zcW = new THREE.Vector3(0, 0, zc).applyMatrix4(surface.matrixWorld).z;
    const LAT = new Set(['shoulder', 'arm', 'leg', 'calf']);
    const anchor = (part, sign) => {
      let sx = 0, sy = 0, c = 0;
      for (let i = 0; i < N; i++) {
        if (reg[i] !== R[part]) continue;
        const x = wp[i * 3], z = wp[i * 3 + 2];
        if ((z - zcW) * sign <= 0 || (LAT.has(part) && x <= 0)) continue;
        sx += x; sy += wp[i * 3 + 1]; c++;
      }
      if (!c) return null;
      const cx = sx / c, cy = sy / c; let zz = null;
      for (let i = 0; i < N; i++) {                   // 대표점 근처 표면의 가장 바깥 z
        if (reg[i] !== R[part]) continue;
        const dx = wp[i * 3] - cx, dy = wp[i * 3 + 1] - cy;
        if (dx * dx + dy * dy > 0.04) continue;
        const z = wp[i * 3 + 2];
        if ((z - zcW) * sign > 0 && (zz === null || (z - zz) * sign > 0)) zz = z;
      }
      return zz === null ? null : [cx, cy, zz + sign * 0.07];
    };
    const W2 = { shoulder: 0.9, chest: 1.2, abs: 1.1, back: 1.2, lowback: 1.05, arm: 0.9, leg: 1.05, calf: 0.9 };
    const specs = [], painSpecs = {};
    Object.keys(W2).forEach(part => {
      [1, -1].forEach(sign => {
        if ((part === 'chest' || part === 'abs') && sign < 0) return;
        if ((part === 'back' || part === 'lowback') && sign > 0) return;
        const a = anchor(part, sign); if (!a) return;
        specs.push({ part, pos: a, w: W2[part], nz: sign });
        if (!painSpecs[part] || sign > 0) painSpecs[part] = [a[0] + (LAT.has(part) ? 0.12 : 0.28), a[1] + 0.2, a[2] + sign * 0.05];
      });
    });
    specs.push(CARDIO);
    const labels = makeLabels(specs, painSpecs);
    const pickable = [surface, joints].filter(Boolean);
    return {
      group, labels,
      pickList: () => [...pickable, ...labels.sprites.map(x => x.sp).filter(sp => sp.visible)],
      partOf: h => (h.object === surface ? REG_PARTS[h.face.materialIndex] : h.object.userData.part) || null,
    };
  }

  /* ---------- 리그 관리 / 상태 ---------- */
  const rigs = { toon: buildToon(), mannequin: null };
  let style = 'toon', lastMap = null, loading = null;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(2.1, 72), new THREE.MeshBasicMaterial({ color: '#dbe8fb' }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = -0.01; scene.add(disc);
  const sc = document.createElement('canvas'); sc.width = sc.height = 128;
  const sx2 = sc.getContext('2d'), gr = sx2.createRadialGradient(64, 64, 4, 64, 64, 62);
  gr.addColorStop(0, 'rgba(20,50,110,.38)'); gr.addColorStop(1, 'rgba(20,50,110,0)');
  sx2.fillStyle = gr; sx2.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.0), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, 0.005, 0.05); scene.add(shadow);

  function applyLabels(rig) {
    if (!rig || !lastMap) return;
    rig.labels.sprites.forEach(s => lastMap[s.L.part] && drawLabel(s, lastMap[s.L.part]));
    Object.entries(rig.labels.pains).forEach(([p, o]) => {
      const lv = lastMap[p]?.pain || 0; o.level = lv; o.m.material.color.set(lv === 2 ? '#f04452' : '#ff8a1f');
    });
  }
  function update(map) {
    lastMap = map;
    Object.entries(map).forEach(([part, i]) => {
      const m = region[part]; if (!m) return;
      m.color.set(i.color);
      m.emissive.set(i.glow ? '#ffb400' : '#000000'); m.emissiveIntensity = i.glow ? 0.35 : 0;
    });
    applyLabels(rigs.toon); applyLabels(rigs.mannequin);
  }
  const show = name => { style = name; rigs.toon.group.visible = name === 'toon'; if (rigs.mannequin) rigs.mannequin.group.visible = name === 'mannequin'; };
  show('toon');

  let tweenTo = null;
  const api = {
    el, onPick: null, update, get style() { return style; },
    setAutoRotate(v) { controls.autoRotate = v; },
    setView(v) { tweenTo = VIEW_AZ[v] ?? 0; controls.autoRotate = false; },
    screenPos(p) { const v = new THREE.Vector3(...p).project(camera), r = renderer.domElement.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; },
    async setStyle(name) {                            // 'toon' | 'mannequin' → 성공 여부
      if (name === 'toon') { show('toon'); return true; }
      if (!rigs.mannequin) {
        if (!loading) {
          el.classList.add('loading');
          loading = buildMannequin().then(r => { rigs.mannequin = r; applyLabels(r); return true; })
            .catch(e => { console.warn('mannequin load failed', e); return false; })
            .finally(() => { el.classList.remove('loading'); loading = null; });
        }
        if (!(await loading)) return false;
      }
      show('mannequin'); return true;
    },
  };
  controls.addEventListener('start', () => { controls.autoRotate = false; tweenTo = null; el.classList.add('touched'); });

  /* ---------- 상호작용 ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const hit = ev => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const rig = rigs[style];
    const h = ray.intersectObjects(rig.pickList(), false)[0];
    return h ? rig.partOf(h) : null;
  };
  let down = null, lastMove = 0;
  renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t;
    down = null;
    if (moved < 7 && dt < 500) { const p = hit(e); if (p && api.onPick) api.onPick(p); }
  });
  renderer.domElement.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || down || performance.now() - lastMove < 80) return;
    lastMove = performance.now(); renderer.domElement.style.cursor = hit(e) ? 'pointer' : 'grab';
  });

  /* ---------- 크기/루프 ---------- */
  function resize() {
    const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = Math.max(3.3 / t, 2.1 / (t * camera.aspect));
    const off = camera.position.clone().sub(controls.target).setLength(dist);
    camera.position.copy(controls.target).add(off);
  }
  new ResizeObserver(resize).observe(el);
  let visible = true;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(el);

  const clock = new THREE.Clock();
  (function loop() {
    requestAnimationFrame(loop);
    if (document.hidden || !visible || document.querySelector('dialog[open]')) return;
    const t = clock.getElapsedTime();
    if (tweenTo != null) {                           // 앞/옆/뒤 버튼: 부드럽게 회전
      let d = tweenTo - controls.getAzimuthalAngle();
      d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) < 0.01) tweenTo = null;
      else {
        const a = controls.getAzimuthalAngle() + d * 0.14, off = camera.position.clone().sub(controls.target), r = off.length();
        camera.position.set(controls.target.x + r * Math.sin(POLAR) * Math.sin(a), controls.target.y + r * Math.cos(POLAR), controls.target.z + r * Math.sin(POLAR) * Math.cos(a));
      }
    }
    controls.update();
    Object.entries(rigs).forEach(([name, rig]) => {
      if (!rig) return;
      const on = name === style;
      rig.labels.sprites.forEach(({ sp, nz }) => {   // 카메라가 바라보는 면의 라벨만 보이게
        if (!on) { sp.visible = false; return; }
        let o = 1;
        if (nz) { const to = camera.position.clone().sub(sp.position).normalize(); o = Math.min(1, Math.max(0, (to.z * nz - 0.25) / 0.45)); }
        sp.material.opacity = o; sp.visible = o > 0.02;
      });
      Object.values(rig.labels.pains).forEach(({ m, level }) => {
        m.visible = on && level > 0;
        if (m.visible) { const s = 1 + 0.35 * Math.sin(t * 5); m.scale.setScalar(s); m.material.opacity = 0.6 + 0.4 * Math.sin(t * 5); }
      });
    });
    renderer.render(scene, camera);
  })();
  return api;
}

const api = create();
window.Body3D = api;
if (api) window.dispatchEvent(new Event('body3d-ready'));
