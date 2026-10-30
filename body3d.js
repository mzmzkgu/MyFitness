// 3D 캐릭터 (Three.js). 기본 도형을 조립해 만든 2.5등신 캐릭터를 드래그로 돌려볼 수 있다.
// 부위(메시)마다 진행률 색을 입히고, 탭하면 onPick(part)가 호출된다. WebGL 실패 시 window.Body3D = null → 2D(SVG) 그림으로 대체.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const TARGET_Y = 2.65, POLAR = 1.38;                // 시선 높이 / 고정 고도각(살짝 내려다봄)
const VIEW_AZ = { front: 0, side: Math.PI / 2, back: Math.PI };
const PART_NAMES = { shoulder: '어깨', chest: '가슴', back: '등', lowback: '허리', arm: '팔', abs: '복근', leg: '허벅지', calf: '종아리', cardio: '유산소' };

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
  el.insertAdjacentHTML('beforeend', '<div class="hint3d">드래그해서 돌려보세요</div>');

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
  };
  const region = {};                                  // part → 공유 재질 (색만 바꾸면 해당 부위 전체가 바뀜)
  Object.keys(PART_NAMES).forEach(p => { region[p] = phys('#eef2f8', { roughness: 0.42, clearcoat: 0.45 }); });

  /* ---------- 캐릭터 조립 ---------- */
  const body = new THREE.Group(); scene.add(body);
  const meshes = [];                                  // 레이캐스트 대상 (가림 판정까지 모든 메시)
  function put(geo, mat, x, y, z, { s = [1, 1, 1], r = [0, 0, 0], part } = {}) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.scale.set(...s); m.rotation.set(...r);
    if (part) m.userData.part = part;
    body.add(m); meshes.push(m); return m;
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

  // 몸통(타원체) + 골반
  put(sph(1, 48, 32), M.suit, 0, 2.55, 0, { s: [0.75, 0.85, 0.5] });
  put(sph(1), M.suit, 0, 1.8, 0, { s: [0.7, 0.4, 0.48] });
  patch('chest', 2.55, 0.75, 0.85, 0.5, 2.78, 3.28, F, 1.0);
  patch('abs', 2.55, 0.75, 0.85, 0.5, 1.95, 2.7, F, 0.85);
  patch('back', 2.55, 0.75, 0.85, 0.5, 2.6, 3.3, B, 1.15);
  patch('lowback', 2.55, 0.75, 0.85, 0.5, 1.9, 2.5, B, 0.95);
  // 다리 · 신발 (좌우)
  [-1, 1].forEach(sx => {
    put(cap(0.3, 0.35), region.leg, sx * 0.34, 1.25, 0, { part: 'leg' });                 // 허벅지
    put(sph(0.33), region.leg, sx * 0.3, 1.68, -0.18, { s: [1, 1, 0.92], part: 'leg' });   // 둔근
    put(cap(0.24, 0.25), region.calf, sx * 0.34, 0.55, 0.02, { part: 'calf' });            // 종아리
    put(sph(0.3), M.shoe, sx * 0.34, 0.17, 0.12, { s: [1, 0.6, 1.55] });
  });
  // 팔 · 어깨 · 손
  [-1, 1].forEach(sx => {
    put(sph(0.38), region.shoulder, sx * 0.95, 3.1, 0, { part: 'shoulder' });
    put(cap(0.26, 0.3), region.arm, sx * 1.07, 2.55, 0, { r: [0, 0, sx * 0.07], part: 'arm' });
    put(cap(0.22, 0.3), region.arm, sx * 1.12, 1.75, 0.04, { part: 'arm' });
    put(sph(0.27), M.skin, sx * 1.14, 1.27, 0.05);
  });
  // 목 · 머리
  put(new THREE.CylinderGeometry(0.22, 0.26, 0.4, 24), M.skin, 0, 3.5, 0);
  put(sph(0.88, 56, 40), M.skin, 0, 4.35, 0, { s: [1, 0.96, 0.97] });
  [-1, 1].forEach(sx => put(sph(0.17, 20, 16), M.skin, sx * 0.87, 4.28, 0, { s: [0.6, 1, 1] }));
  const hairCap = (th, phi0, phiLen, r) => put(new THREE.SphereGeometry(r, 48, 32, phi0, phiLen, 0, th), M.hair, 0, 4.35, 0, { s: [1, 0.96, 0.97] });
  hairCap(1.0, 0, Math.PI * 2, 0.915);                                  // 정수리~앞머리(이마 위)
  hairCap(1.95, Math.PI - 0.5, Math.PI + 1.0, 0.905);                   // 옆/뒤통수
  // 얼굴
  [-1, 1].forEach(sx => {
    put(sph(0.105, 20, 16), M.eye, sx * 0.3, 4.3, 0.8, { s: [0.85, 1.2, 0.6] });
    put(sph(0.035, 10, 8), M.white, sx * 0.3 + 0.025, 4.35, 0.865);
    put(sph(0.16, 20, 14), M.cheek, sx * 0.52, 4.07, 0.64, { s: [1, 0.7, 0.35], r: [0, sx * 0.55, 0] });
  });
  const smile = new THREE.TorusGeometry(0.16, 0.03, 10, 28, Math.PI);
  put(smile, M.mouth, 0, 4.1, 0.845, { r: [0, 0, Math.PI] });
  // 바닥 연출: 원형 무대 + 그림자
  const disc = new THREE.Mesh(new THREE.CircleGeometry(2.1, 72), new THREE.MeshBasicMaterial({ color: '#dbe8fb' }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = -0.01; scene.add(disc);
  const sc = document.createElement('canvas'); sc.width = sc.height = 128;
  const sx2 = sc.getContext('2d'), gr = sx2.createRadialGradient(64, 64, 4, 64, 64, 62);
  gr.addColorStop(0, 'rgba(20,50,110,.38)'); gr.addColorStop(1, 'rgba(20,50,110,0)');
  sx2.fillStyle = gr; sx2.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.0), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, 0.005, 0.05); scene.add(shadow);

  /* ---------- 라벨(스프라이트) · 통증 마커 ---------- */
  // pos: 표면 바로 앞 좌표, w: 크기, pill: 몸 밖에 띄우는 칩
  const LABELS = [
    { part: 'chest', pos: [0, 3.02, 0.62], w: 1.15 }, { part: 'abs', pos: [0, 2.3, 0.58], w: 1.15 },
    { part: 'back', pos: [0, 3.0, -0.62], w: 1.15 }, { part: 'lowback', pos: [0, 2.2, -0.58], w: 1.05 },
    { part: 'shoulder', pos: [1.05, 3.28, 0.34], w: 0.85 }, { part: 'shoulder', pos: [1.05, 3.28, -0.34], w: 0.85 },
    { part: 'arm', pos: [1.1, 2.3, 0.3], w: 0.85 }, { part: 'arm', pos: [1.1, 2.3, -0.3], w: 0.85 },
    { part: 'leg', pos: [0.34, 1.3, 0.34], w: 0.95 }, { part: 'leg', pos: [0.34, 1.0, -0.32], w: 0.95 },
    { part: 'calf', pos: [0.34, 0.58, 0.29], w: 0.85 }, { part: 'calf', pos: [0.34, 0.58, -0.25], w: 0.85 },
    { part: 'cardio', pos: [-1.35, 5.0, 0], w: 1.2, pill: true },
  ];
  const painAt = { shoulder: [1.3, 3.5, 0.2], chest: [0.5, 3.2, 0.55], abs: [0.4, 2.1, 0.55], back: [0.5, 3.2, -0.55], lowback: [0.4, 2.0, -0.5], arm: [1.3, 2.6, 0.15], leg: [0.55, 1.4, 0.3], calf: [0.55, 0.7, 0.2] };
  const sprites = LABELS.map(L => {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = L.pill ? 96 : 128;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sp.position.set(...L.pos); sp.scale.set(L.w, L.w * cv.height / 256, 1);
    sp.userData.part = L.part; sp.renderOrder = 5; scene.add(sp); meshes.push(sp);
    return { L, cv, tex, sp, nz: Math.sign(L.pos[2]) };
  });
  const FONT = '"Pretendard Variable",Pretendard,-apple-system,"Noto Sans KR",sans-serif';
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
  const pains = {};
  Object.entries(painAt).forEach(([p, pos]) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), new THREE.MeshBasicMaterial({ color: '#ff8a1f', transparent: true }));
    m.position.set(...pos); m.visible = false; scene.add(m); pains[p] = m;
  });

  /* ---------- 상태 갱신 ---------- */
  function update(map) {
    Object.entries(map).forEach(([part, i]) => {
      const m = region[part]; if (!m) return;
      m.color.set(i.color);
      m.emissive.set(i.glow ? '#ffb400' : '#000000'); m.emissiveIntensity = i.glow ? 0.35 : 0;
      if (pains[part]) { pains[part].visible = !!i.pain; pains[part].material.color.set(i.pain === 2 ? '#f04452' : '#ff8a1f'); }
    });
    sprites.forEach(s => map[s.L.part] && drawLabel(s, map[s.L.part]));
  }

  /* ---------- 상호작용 ---------- */
  const api = { el, onPick: null, update, setAutoRotate(v) { controls.autoRotate = v; }, screenPos(p) { const v = new THREE.Vector3(...p).project(camera), r = renderer.domElement.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; }, setView(v) { tweenTo = VIEW_AZ[v] ?? 0; controls.autoRotate = false; } };
  let tweenTo = null;
  controls.addEventListener('start', () => { controls.autoRotate = false; tweenTo = null; el.classList.add('touched'); });

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const hit = ev => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const h = ray.intersectObjects(meshes.filter(m => m.visible), false)[0];
    return h?.object.userData.part || null;
  };
  let down = null;
  renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t;
    down = null;
    if (moved < 7 && dt < 500) { const p = hit(e); if (p && api.onPick) api.onPick(p); }
  });
  renderer.domElement.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' && !down) renderer.domElement.style.cursor = hit(e) ? 'pointer' : 'grab'; });

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
    sprites.forEach(({ sp, nz }) => {                // 카메라가 바라보는 면의 라벨만 보이게
      if (!nz) return;
      const to = camera.position.clone().sub(sp.position).normalize();
      const o = Math.min(1, Math.max(0, (to.z * nz - 0.25) / 0.45));
      sp.material.opacity = o; sp.visible = o > 0.02;
    });
    Object.values(pains).forEach(m => { if (m.visible) { const s = 1 + 0.35 * Math.sin(t * 5); m.scale.setScalar(s); m.material.opacity = 0.6 + 0.4 * Math.sin(t * 5); } });
    renderer.render(scene, camera);
  })();
  return api;
}

const api = create();
window.Body3D = api;
if (api) window.dispatchEvent(new Event('body3d-ready'));
