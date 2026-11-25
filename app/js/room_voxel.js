// マイルームのボクセル版（ためし）：同じ部屋と家具を、小さな立方体（ボクセル）で組んで Three.js で描く
//   1マス＝V×V ボクセル。かべ・床・家具はぜんぶ1つの InstancedMesh（色はボクセルごと）
//   窓には名所のカード（engine）をそのまま映す。キャラはドット絵の板（いつもこちらを向く）
//   小さめの解像度で描いて拡大し、ドット絵のように見せる
const THREE = window.THREE;
export const V = 6;
const WH = 32;   // かべの高さ（ボクセル）

// ---- ボクセルを積む道具 ----
function maker() {
  const vox = new Map();
  const key = (x, y, z) => `${x},${y},${z}`;
  const api = {
    set(x, y, z, c) { vox.set(key(x, y, z), [x, y, z, c]); },
    del(x, y, z) { vox.delete(key(x, y, z)); },
    fill(x0, y0, z0, x1, y1, z1, c) { for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) api.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c); },
    ball(cx, cy, cz, r, c) { for (let x = Math.floor(cx - r); x <= cx + r; x++) for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let z = Math.floor(cz - r); z <= cz + r; z++) if ((x + .5 - cx) ** 2 + (y + .5 - cy) ** 2 + (z + .5 - cz) ** 2 <= r * r) api.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c); },
    cyl(cx, cz, y0, y1, r, c) { for (let x = Math.floor(cx - r); x <= cx + r; x++) for (let z = Math.floor(cz - r); z <= cz + r; z++) if ((x + .5 - cx) ** 2 + (z + .5 - cz) ** 2 <= r * r) for (let y = y0; y < y1; y++) api.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c); },
    vox,
  };
  return api;
}
// ハートの形（5×4）。row 0 が上
const HEART = ['.#.#.', '#####', '.###.', '..#..'];

// ---- 家具のボクセル（ローカル座標：x＝右のかべにそう向き、z＝左のかべにそう向き、y＝上） ----
const M = {
  bed(m) {   // 3×2マス＝18×12
    m.fill(0, 0, 0, 18, 2, 12, '#FFF6F2'); m.fill(1, 2, 0, 18, 4, 12, '#FFF0D6');
    m.fill(0, 0, 0, 1, 12, 12, '#FFF6F2'); m.fill(0, 12, 1, 1, 13, 11, '#FFF6F2');
    HEART.forEach((row, r) => [...row].forEach((ch, k) => { if (ch === '#') m.set(1, 10 - r, 4 + k, '#F48FB0'); }));
    m.fill(1, 4, 1, 5, 6, 5, '#DCC8F2'); m.fill(1, 4, 7, 5, 6, 11, '#DCC8F2');
    m.fill(6, 3, 0, 18, 6, 12, (x, y, z) => (y === 5 && (x + z) % 4 === 0 ? '#FFF6F2' : y < 5 && (x === 17 || z === 11) && (x + z + y) % 3 === 0 ? '#FFF6F2' : '#F7A6BE'));
    HEART.forEach((row, r) => [...row].forEach((ch, k) => { if (ch === '#') m.set(8 + r, 6, 4 + k, '#FFFFFF'); }));
  },
  sofa(m) {   // 3×1マス＝18×6
    m.fill(0, 0, 0, 18, 3, 6, '#E0749A'); m.fill(0, 3, 0, 18, 9, 2, '#F59DB9');
    m.fill(0, 3, 0, 2, 6, 6, '#F59DB9'); m.fill(16, 3, 0, 18, 6, 6, '#F59DB9');
    m.fill(2, 3, 2, 9, 4, 6, '#F9B4C8'); m.fill(9, 3, 2, 16, 4, 6, '#F9B4C8');
    HEART.forEach((row, r) => [...row].forEach((ch, k) => { if (ch === '#') m.set(10 + k, 8 - r, 2, '#FFFFFF'); }));
  },
  table(m) {
    m.fill(2, 0, 2, 4, 3, 4, '#F2DFDC'); m.cyl(3, 3, 3, 4, 3, '#FFF8F4');
    m.fill(2, 4, 2, 3, 5, 3, '#F9B4C8'); m.set(2, 5, 2, '#E8475C'); m.set(4, 4, 3, '#A8DACA');
  },
  shelf(m) {   // 1×2マス＝6×12
    m.fill(0, 0, 0, 6, 18, 12, '#FFF6F2');
    m.fill(3, 1, 1, 6, 17, 11, null);
    const cols = ['#F48FB0', '#DCC8F2', '#A8DACA', '#F6D27E', '#A8C8F0', '#F9B4C8'];
    for (const y0 of [1, 7, 13]) { m.fill(3, y0 - 1, 1, 6, y0, 11, '#FFF6F2'); for (let z = 1; z < 11; z++) { if ((z + y0) % 5 === 4) continue; const h = 3 + ((z * 7 + y0) % 3); m.fill(3, y0, z, 5, y0 + h, z + 1, cols[(z + y0) % cols.length]); } }
    m.fill(2, 18, 4, 4, 20, 6, '#C3EBDC'); m.ball(3, 21.5, 5, 1.6, '#8CC9A0');
  },
  vanity(m) {   // 2×1マス＝12×6
    m.fill(0, 0, 0, 12, 7, 6, '#FFF6F2');
    for (const x of [1, 7]) { m.fill(x, 1, 5, x + 4, 2, 6, '#EBCBD3'); m.fill(x, 4, 5, x + 4, 5, 6, '#EBCBD3'); m.set(x + 2, 3, 6, '#F6D27E'); m.set(x + 2, 6, 6, '#F6D27E'); }
    for (let x = 2; x < 10; x++) for (let y = 7; y < 20; y++) { const dx = (x + .5 - 6) / 4, dy = (y + .5 - 13.5) / 6.5, d = dx * dx + dy * dy; if (d <= 1) m.set(x, y, 0, d > .55 ? '#F59DB9' : y > 15 && x === 4 ? '#FFFFFF' : '#CFE8F5'); }
    m.set(3, 7, 3, '#DCC8F2'); m.set(3, 8, 3, '#DCC8F2'); m.set(5, 7, 3, '#F9B4C8'); m.fill(7, 7, 2, 10, 8, 4, '#F6D27E');
  },
  rug(m, f) {
    const n = f.w * V, c = n / 2, r = c - .6;
    for (let x = 0; x < n; x++) for (let z = 0; z < n; z++) { const d = Math.hypot(x + .5 - c, z + .5 - c); if (d <= r) m.set(x, 0, z, d > r - 1.2 ? '#F7B0C6' : d > r * .72 ? '#FAD0DC' : d > r * .5 ? '#FFE6ED' : '#FAD0DC'); }
    HEART.forEach((row, rr) => [...row].forEach((ch, k) => { if (ch === '#') m.set(Math.round(c) - 2 + rr, 0, Math.round(c) - 2 + k, '#FFFFFF'); }));
  },
  plant(m, f) {
    const s = f.big ? 1.3 : 1;
    m.cyl(3, 3, 0, Math.round(4 * s), 2, '#E8A98C'); m.cyl(3, 3, Math.round(4 * s) - 1, Math.round(4 * s), 1.6, '#7A5A48');
    m.ball(3, 7.5 * s, 3, 3 * s, (x, y, z) => ((x * 3 + y * 5 + z * 7) % 4 ? '#8FD0A6' : '#6FB58A'));
    m.ball(1.5, 9 * s, 3, 1.6 * s, '#7CC296'); m.ball(4.5, 9.5 * s, 3.5, 1.6 * s, '#7CC296');
  },
  lamp(m) {
    m.cyl(3, 3, 0, 1, 2, '#FFF6F2'); m.fill(3, 1, 3, 4, 17, 4, '#E2B95F');
    for (let y = 16; y < 21; y++) m.cyl(3.5, 3.5, y, y + 1, 3.2 - (y - 16) * .3, '#FFD3E0');
  },
  bear(m) {
    const br = '#D9A577', lt = '#F2D4B0';
    m.ball(2, 1.2, 4, 1.3, br); m.ball(4, 1.2, 2, 1.3, br);
    m.ball(3, 3.5, 3, 2.3, br); m.ball(3.6, 3.4, 3.6, 1.4, lt);
    m.ball(1.4, 4, 3.6, 1, br); m.ball(3.6, 4, 1.4, 1, br);
    m.ball(3, 7, 3, 2.1, br); m.ball(4.3, 6.5, 4.3, 1.3, lt);
    m.ball(1.6, 9, 3.6, .9, br); m.ball(3.6, 9, 1.6, .9, br);
    m.set(4, 8, 3, '#5A3A2A'); m.set(3, 8, 4, '#5A3A2A'); m.set(5, 6, 5, '#5A3A2A');   // 目と鼻
    m.set(4, 5, 4, '#F48FB0'); m.set(5, 5, 3, '#F48FB0'); m.set(3, 5, 5, '#F48FB0');
  },
  gift(m) {
    m.fill(1, 0, 1, 5, 4, 5, (x, y, z) => (x === 3 || z === 3 ? '#F48FB0' : '#DCC8F2'));
    m.set(2, 4, 3, '#F48FB0'); m.set(4, 4, 3, '#F48FB0'); m.set(3, 4, 2, '#F48FB0'); m.set(3, 4, 4, '#F48FB0');
  },
};

// ---- 部屋 ----
function buildRoom(m) {
  const NV = 10 * V;
  const hash = (a, b) => ((a * 73856093) ^ (b * 19349663)) >>> 0;
  for (let x = 0; x < NV; x++) for (let z = 0; z < NV; z++) {   // 床：木の板
    const plank = Math.floor(z / 2), seam = (x + plank * 7) % 13 === 0, h = hash(plank, Math.floor((x + plank * 7) / 13)) % 3;
    m.set(x, -1, z, seam ? '#D9B48A' : ['#F0D3AE', '#EBCCA4', '#F3D8B6'][h]);
  }
  const wall = (u, y) => (y === WH - 1 ? '#FFFFFF' : y === WH - 2 ? '#F2B6C8' : y < 7 ? (y === 6 ? '#FFFFFF' : y === 0 ? '#E9B9C9' : u % 4 === 0 ? '#F4D6E0' : '#FFF0F4') : Math.floor(u / 3) % 2 ? '#F6C9D7' : '#F9D8E2');
  for (let z = -1; z < NV; z++) for (let y = -1; y < WH; y++) m.set(-1, y, z, wall(NV - z, y));          // 左のかべ（x＝-1）
  for (let x = 0; x < NV; x++) for (let y = -1; y < WH; y++) m.set(x, y, -1, wall(x, y));               // 右のかべ（z＝-1）
  // 窓の穴とわく（右のかべ）
  const W0 = 17, W1 = 42, Y0 = 11, Y1 = 26;
  for (let x = W0; x < W1; x++) for (let y = Y0; y < Y1; y++) m.del(x, y, -1);
  for (let x = W0 - 1; x <= W1; x++) { m.set(x, Y0 - 1, 0, '#FFFFFF'); m.set(x, Y1, 0, '#FFFFFF'); }
  for (let y = Y0; y < Y1; y++) { m.set(W0 - 1, y, 0, '#FFFFFF'); m.set(W1, y, 0, '#FFFFFF'); m.set(Math.floor((W0 + W1) / 2), y, -1, '#FFFFFF'); }
  for (let x = W0; x < W1; x++) m.set(x, Math.floor((Y0 + Y1) / 2), -1, '#FFFFFF');
  // カーテン
  for (const [a, b, dir] of [[W0 - 6, W0 + 1, 1], [W1, W1 + 7, -1]]) for (let x = a; x < b; x++) for (let y = 6; y < Y1 + 3; y++) {
    const pinch = y > 12 && y < 15, k = dir > 0 ? x - a : b - 1 - x; if (pinch && k > 3) continue;
    m.set(x, y, 1, pinch ? (y === 13 ? '#FFF4F6' : '#F6D27E') : (x % 2 ? '#F7A9C0' : '#EE94B0'));
  }
  for (let x = W0 - 6; x < W1 + 7; x++) { m.set(x, Y1 + 3, 1, '#FBC6D5'); m.set(x, Y1 + 2, 1, x % 3 === 0 ? '#FBC6D5' : '#FFFFFF'); m.set(x, Y1 + 4, 0, '#C9B78F'); }
  // 左のかべ：小さな棚
  for (let z = 44; z < 54; z++) { m.set(0, 14, z, '#FFFFFF'); }
  m.fill(0, 15, 51, 2, 18, 53, '#C3EBDC'); m.ball(1, 19, 52, 1.4, '#8CC9A0'); m.fill(0, 15, 47, 1, 18, 49, '#F9B4C8'); m.fill(0, 15, 45, 1, 17, 46, '#DCC8F2');
  // 右のかべ：ハート
  HEART.forEach((row, r) => [...row].forEach((ch, k) => { if (ch === '#') { m.set(48 + k, 22 - r, 0, '#F48FB0'); } }));
  return { window: { x0: W0, x1: W1, y0: Y0, y1: Y1 } };
}

// ---- 表示 ----
// opts：{ stage, objects, furn, me, blocked(i,j), onMove(i,j), chara（Promise<canvas>）, engineCanvas, night(), photos（img の配列）, photoSlots }
export function mountVoxelRoom(opts) {
  const { stage } = opts, NV = 10 * V;
  const cv = document.createElement('canvas'); cv.className = 'hm-iso vox'; stage.append(cv);
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false, alpha: true });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.setPixelRatio(1);
  const scene = new THREE.Scene();

  // ボクセルをまとめる
  const m = maker(); const info = buildRoom(m);
  for (const o of opts.objects) {
    const f = opts.furn(o.id), sub = maker(); (M[f.art] || M.gift)(sub, f);
    for (const [x, y, z, c] of sub.vox.values()) if (c) m.set(o.i * V + x, y, o.j * V + z, c);
  }
  const list = [...m.vox.values()].filter(v => v[3]);
  const geo = new THREE.BoxGeometry(1, 1, 1), mat = new THREE.MeshLambertMaterial();
  const mesh = new THREE.InstancedMesh(geo, mat, list.length); mesh.castShadow = mesh.receiveShadow = true;
  const mtx = new THREE.Matrix4(), col = new THREE.Color();
  list.forEach(([x, y, z, c], k) => { mtx.makeTranslation(x + .5, y + .5, z + .5); mesh.setMatrixAt(k, mtx); mesh.setColorAt(k, col.set(c)); });
  mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  scene.add(mesh);

  // 窓の景色：名所のカードの上のほうを、かべの穴のうしろの板に映す
  const w = info.window, ww = w.x1 - w.x0, wh = w.y1 - w.y0;
  const wtex = new THREE.CanvasTexture(opts.engineCanvas); wtex.magFilter = THREE.NearestFilter; wtex.minFilter = THREE.LinearFilter;
  const ea = opts.engineCanvas.width / (opts.engineCanvas.height * .45), wa = ww / wh;
  wtex.repeat.set(Math.min(1, ea > wa ? wa / ea : 1), .45 * Math.min(1, wa > ea ? ea / wa : 1)); wtex.offset.set((1 - wtex.repeat.x) / 2, 1 - .04 - wtex.repeat.y);
  const wplane = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), new THREE.MeshBasicMaterial({ map: wtex }));
  wplane.position.set(w.x0 + ww / 2, w.y0 + wh / 2, -1.2); scene.add(wplane);
  const sky = new THREE.PointLight(0xffffff, 0, 40);

  // 写真（左のかべ）
  const photoMeshes = (opts.photoSlots || []).map(s => {
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), new THREE.MeshLambertMaterial({ color: 0xffffff })); pm.rotation.y = Math.PI / 2;
    pm.position.set(.06, s.y + s.h / 2, s.z - s.w / 2); pm.visible = false; scene.add(pm); return pm;
  });
  function setPhotos(imgs) {
    imgs.forEach((im, k) => { const pm = photoMeshes[k]; if (!pm) return; if (!im) { pm.visible = false; return; }
      const c = document.createElement('canvas'); c.width = 70; c.height = 90; const g = c.getContext('2d'); g.fillStyle = '#FFFDF8'; g.fillRect(0, 0, 70, 90);
      const iw = 60, ih = 68, sw = im.width, sh = sw * ih / iw; g.imageSmoothingEnabled = false; g.drawImage(im, 0, im.height * .55 - sh / 2, sw, sh, 5, 5, iw, ih);
      const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; pm.material.map = t; pm.material.needsUpdate = true; pm.visible = true; });
  }

  // ガーランドの電球（左のかべ）
  const bulbCols = [0xFF9AC0, 0xFFE38A, 0xA8E6FF, 0xC9A8FF, 0xA8F0C8];
  const bulbs = Array.from({ length: 14 }, (_, k) => { const b = new THREE.Mesh(new THREE.BoxGeometry(.8, 1.2, .8), new THREE.MeshBasicMaterial({ color: bulbCols[k % 5] }));
    b.position.set(.5, 28 - Math.sin(((k % 4) + .5) / 4 * Math.PI) * 2, NV - 3 - k * 4); scene.add(b); return b; });

  // 光
  const hemi = new THREE.HemisphereLight(0xfff6fa, 0xf0c8b8, .78); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, .55); sun.position.set(NV * .9, NV * 1.4, NV * .3); sun.target.position.set(NV / 2, 0, NV / 2); scene.add(sun, sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 200 }); sun.shadow.bias = -.0015;
  const lamps = opts.objects.filter(o => opts.furn(o.id).light).map(o => { const p = new THREE.PointLight(0xffb48a, 0, 40, 1.6); p.position.set(o.i * V + 3.5, 15, o.j * V + 3.5); scene.add(p); return p; });

  // カメラ：斜め上から（2:1 に近い見え方）
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 400);
  const C = new THREE.Vector3(NV / 2 - 2, 10, NV / 2 - 2);
  cam.position.set(C.x + 100, C.y + 81.6, C.z + 100); cam.lookAt(C);

  // キャラ（ドット絵の板）
  let sprite = null; const me = { x: opts.me.i + .5, z: opts.me.j + .5, tx: null, tz: null, jump: 0 };
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.8, 16), new THREE.MeshBasicMaterial({ color: 0x8a4a5a, transparent: true, opacity: .28 })); shadow.rotation.x = -Math.PI / 2; scene.add(shadow);
  opts.chara.then(c => { const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter;
    sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: t })); sprite.center.set(.5, 0); const h = 16; sprite.scale.set(h * c.width / c.height, h, 1); scene.add(sprite); });

  // 大きさ：ステージの高さに合わせ、横は少し広く（横にスクロール）
  const SCALE = 2;   // 画面の1ドット＝2px
  function resize() {
    const H = stage.clientHeight, W = Math.round(H * 1.25);
    cv.style.height = H + 'px'; cv.style.width = W + 'px';
    renderer.setSize(Math.round(W / SCALE), Math.round(H / SCALE), false);
    const viewH = 74, viewW = viewH * W / H; Object.assign(cam, { left: -viewW / 2, right: viewW / 2, top: viewH / 2, bottom: -viewH / 2 }); cam.updateProjectionMatrix();
  }
  resize();

  // さわる：床を押すとそこへ歩く、キャラを押すとジャンプ
  const ray = new THREE.Raycaster(), floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3(), nd = new THREE.Vector2();
  cv.addEventListener('click', e => {
    const r = cv.getBoundingClientRect(); nd.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(nd, cam);
    if (sprite && ray.intersectObject(sprite).length) { if (!me.jump) me.jump = 1; return; }
    if (!ray.ray.intersectPlane(floor, hit)) return; const i = Math.floor(hit.x / V), j = Math.floor(hit.z / V);
    if (i < 0 || j < 0 || i >= 10 || j >= 10 || opts.blocked(i, j)) return;
    me.tx = i + .5; me.tz = j + .5; opts.onMove(i, j);
  });

  let raf = 0, last = performance.now();
  function frame(t) {
    raf = requestAnimationFrame(frame); const dt = Math.min(50, t - last); last = t;
    if (me.tx != null) { const dx = me.tx - me.x, dz = me.tz - me.z, d = Math.hypot(dx, dz), sp = .0035 * dt; if (d <= sp) { me.x = me.tx; me.z = me.tz; me.tx = null; } else { me.x += dx / d * sp; me.z += dz / d * sp; if (sprite && Math.abs(dx - dz) > .01) sprite.material.map.repeat.x = (dx - dz) < 0 ? -1 : 1, sprite.material.map.offset.x = (dx - dz) < 0 ? 1 : 0; } }
    if (me.jump > 0) me.jump = Math.max(0, me.jump - dt / 520);
    const bob = me.tx != null ? Math.abs(Math.sin(t / 90)) * .5 : 0, jy = me.jump > 0 ? Math.sin(me.jump * Math.PI) * 5 : 0;
    if (sprite) sprite.position.set(me.x * V, bob + jy, me.z * V); shadow.position.set(me.x * V, .05, me.z * V);
    const n = opts.night();
    hemi.intensity = .78 - .3 * n; sun.intensity = .42 - .3 * n; lamps.forEach(p => { p.intensity = 1.6 * n; });
    bulbs.forEach((b, k) => { const on = .55 + .45 * Math.sin(t / 500 + k * 1.7); b.material.color.setHex(bulbCols[k % 5]).multiplyScalar(.6 + .4 * on + .3 * n); });
    wtex.needsUpdate = true;
    renderer.render(scene, cam);
  }
  raf = requestAnimationFrame(frame);
  const onResize = () => resize(); addEventListener('resize', onResize);
  return {
    canvas: cv, setPhotos, screenX: () => { const v = new THREE.Vector3(me.x * V, 8, me.z * V).project(cam); return (v.x + 1) / 2; },
    stop() { cancelAnimationFrame(raf); removeEventListener('resize', onResize); renderer.dispose(); geo.dispose(); mat.dispose(); cv.remove(); },
  };
}
