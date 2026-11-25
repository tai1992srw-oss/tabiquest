// マイルームのボクセル版（ためし）：同じ部屋と家具を、小さな立方体（ボクセル）で組んで Three.js で描く
//   1マス＝V×V ボクセル。家具は角の丸いぷっくりした形（rbox・楕円体）で、かわいく
//   見える面だけを1つの形にまとめ、すき間にやわらかい影（AO）をつける
//   窓には名所のカード（engine）をそのまま映す。キャラはドット絵の板だが、部屋と同じ光を受けて床に影を落とす
//   小さめの解像度で描いて拡大し、ドット絵のように見せる
const THREE = window.THREE;
export const V = 12;
export const WH = 60;   // かべの高さ（ボクセル）
const NV = 10 * V;

// ---- ボクセルを積む道具（座標はボクセル。c は色か、(x,y,z)→色 の関数。null で穴をあける） ----
function maker() {
  const vox = new Map();
  const K = (x, y, z) => ((x + 16) * 1024 + (y + 16)) * 1024 + (z + 16);
  const put = (x, y, z, c) => { const v = typeof c === 'function' ? c(x, y, z) : c; if (v == null) vox.delete(K(x, y, z)); else vox.set(K(x, y, z), [x, y, z, v]); };
  const api = {
    K, vox,
    has: (x, y, z) => vox.has(K(x, y, z)),
    set: (x, y, z, c) => put(x, y, z, c),
    box(x0, y0, z0, x1, y1, z1, c) { for (let x = Math.floor(x0); x < x1; x++) for (let y = Math.floor(y0); y < y1; y++) for (let z = Math.floor(z0); z < z1; z++) put(x, y, z, c); },
    // 角の丸い箱（r：丸みの半径）
    rbox(x0, y0, z0, x1, y1, z1, r, c) {
      const cl = (v, a, b) => Math.max(a, Math.min(b, v));
      for (let x = Math.floor(x0); x < x1; x++) for (let y = Math.floor(y0); y < y1; y++) for (let z = Math.floor(z0); z < z1; z++) {
        const px = x + .5, py = y + .5, pz = z + .5, dx = px - cl(px, x0 + r, x1 - r), dy = py - cl(py, y0 + r, y1 - r), dz = pz - cl(pz, z0 + r, z1 - r);
        if (dx * dx + dy * dy + dz * dz <= r * r) put(x, y, z, c);
      }
    },
    ell(cx, cy, cz, rx, ry, rz, c) {
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let z = Math.floor(cz - rz); z <= cz + rz; z++)
        if (((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 + ((z + .5 - cz) / rz) ** 2 <= 1) put(x, y, z, c);
    },
    cyl(cx, cz, y0, y1, r, c) { for (let x = Math.floor(cx - r); x <= cx + r; x++) for (let z = Math.floor(cz - r); z <= cz + r; z++) if ((x + .5 - cx) ** 2 + (z + .5 - cz) ** 2 <= r * r) for (let y = y0; y < y1; y++) put(x, y, z, c); },
    // ハート（板）。axis：'x'＝x が一定の面（右手前を向く）、'z'＝z が一定の面（左手前を向く）、'y'＝床と平行
    heart(axis, a, cu, cv, s, c, th = 1) {
      for (let u = Math.floor(cu - s * 1.2); u <= cu + s * 1.2; u++) for (let v = Math.floor(cv - s * 1.1); v <= cv + s; v++) {
        const X = (u + .5 - cu) / s, Y = (v + .5 - cv) / s, q = X * X + (Y * 1.2 - Math.sqrt(Math.abs(X)) * .8) ** 2;
        if (q > 1) continue;
        for (let t = 0; t < th; t++) { if (axis === 'x') put(a + t, v, u, c); else if (axis === 'z') put(u, v, a + t, c); else put(u, a + t, v, c); }
      }
    },
  };
  return api;
}

// ---- 家具（ローカル座標：x＝右のかべにそう向き、z＝左のかべにそう向き、y＝上。こちら向き＝ +x と +z） ----
const PINK = '#F9B2C7', PINK2 = '#F497B3', ROSE = '#EC7FA3', WHITE = '#FFF7F2', CREAM = '#FFF1DC', LAV = '#DCCBF4', MINT = '#BFEBDA', GOLD = '#F5CD74', SKY = '#CFE8F7';
const dots = (base, dot, step = 6) => (x, y, z) => (((x % step) + step) % step < 2 && ((z % step) + step) % step < 2 && (Math.floor(x / step) + Math.floor(z / step)) % 2 === 0 ? dot : base);
const M = {
  bed(m) {   // 3×2マス＝36×24。頭は x＝0（左のかべ）側
    m.rbox(0, 0, 0, 36, 9, 24, 2.5, '#FBE9E1');                                     // わく
    m.rbox(3, 7, 1, 35, 15, 23, 3, CREAM);                                          // マットレス
    m.box(0, 0, 1, 5, 40, 23, (x, y, z) => (y < 26 + 9 * Math.sqrt(Math.max(0, 1 - ((z + .5 - 12) / 11) ** 2)) ? WHITE : null));   // アーチのヘッドボード
    m.heart('x', 5, 12, 27, 5.5, PINK2, 1);
    m.ell(10, 17, 7, 4.5, 3, 5.5, LAV); m.ell(10, 17, 17, 4.5, 3, 5.5, LAV);        // まくら
    m.rbox(14, 11, -1, 37, 20, 25, 4.5, dots(PINK, '#FFFFFF', 6));                 // ふかふかの掛けぶとん
    m.heart('z', 18, 24, 23, 3.5, '#FFFFFF', 2);                                    // ハートのクッション
  },
  sofa(m) {   // 3×1マス＝36×12
    m.rbox(0, 0, 0, 36, 10, 12, 3, ROSE);
    m.rbox(0, 6, 0, 36, 27, 6, 4.5, PINK);                                          // せもたれ
    m.rbox(0, 6, 0, 6, 19, 12, 3, PINK); m.rbox(30, 6, 0, 36, 19, 12, 3, PINK);     // ひじかけ
    m.rbox(5, 8, 4, 18.5, 14, 12, 2.5, '#FBC6D6'); m.rbox(17.5, 8, 4, 31, 14, 12, 2.5, '#FBC6D6');   // 座面
    m.heart('z', 7, 24, 20, 3.5, '#FFFFFF', 2);
  },
  table(m) {
    m.cyl(6, 6, 0, 1, 3.5, WHITE); m.cyl(6, 6, 1, 9, 1.3, WHITE);
    m.cyl(6, 6, 8, 9, 5.8, PINK2); m.cyl(6, 6, 9, 11, 5.8, WHITE);
    m.cyl(4.5, 5.5, 11, 14, 2, CREAM); m.cyl(4.5, 5.5, 14, 15, 2, '#FFD6E2'); m.set(4, 15, 5, '#E8475C');   // ケーキ
    m.cyl(8, 8, 11, 13, 1.3, MINT); m.set(9, 12, 9, MINT);                          // カップ
  },
  shelf(m) {   // 1×2マス＝12×24
    m.rbox(0, 0, 0, 12, 42, 24, 1.5, WHITE);
    const cols = ['#F48FB0', '#DCC8F2', '#A8DACA', '#F6D27E', '#A8C8F0', '#F9B4C8', '#FFFFFF'];
    for (const [k, y0] of [2, 15, 28].entries()) {
      m.box(5, y0, 2, 12, y0 + 11, 22, null);                                       // 棚の中をくりぬく
      let z = 3; for (let n = 0; z < 21; n++) { const w = 1 + (n * 3 + k) % 2, h = 7 + (n * 5 + k * 3) % 4; if ((n + k) % 6 === 4) { z += 3; continue; } m.box(6, y0, z, 11, y0 + h, z + w, cols[(n + k * 2) % cols.length]); z += w; }
    }
    m.ell(6, 44, 6, 3, 2.5, 3, '#8CD3A6'); m.cyl(6, 6, 42, 44, 2, '#F2B49A');      // 上の小さな鉢
    m.ell(6, 45, 17, 2.6, 3, 2.6, '#D9A577'); m.ell(6, 49.5, 17, 2.2, 2, 2.2, '#D9A577'); m.set(8, 49, 18, '#5A3A2A');   // 小さなくま
  },
  vanity(m) {   // 2×1マス＝24×12
    m.rbox(0, 0, 0, 24, 17, 12, 2, WHITE);
    for (const x0 of [2, 13]) for (const y0 of [3, 10]) { m.box(x0, y0, 12, x0 + 9, y0 + 1, 13, '#F2D0DA'); m.set(x0 + 4, y0 + 3, 12, GOLD); }
    for (let x = 3; x < 21; x++) for (let y = 17; y < 46; y++) {                   // 楕円のかがみ
      const dx = (x + .5 - 12) / 9, dy = (y + .5 - 31) / 14, d = dx * dx + dy * dy; if (d > 1) continue;
      m.box(x, y, 0, x + 1, y + 1, d > .62 ? 2 : 1, d > .62 ? PINK : (x - y + 40) % 9 === 0 || (x - y + 40) % 9 === 1 ? '#FFFFFF' : SKY);
    }
    for (let a = 0; a < 12; a++) { const t = a / 12 * Math.PI * 2; m.set(Math.round(12 + Math.cos(t) * 9.6), Math.round(31 + Math.sin(t) * 14.8), 2, GOLD); }   // かがみのまわりの電球
    m.cyl(5, 7, 17, 21, 1.2, LAV); m.set(5, 21, 7, '#FFFFFF'); m.cyl(8, 8, 17, 20, 1, PINK2); m.rbox(15, 17, 5, 21, 19, 10, .8, GOLD);
  },
  rug(m, f) {
    const n = f.w * V, c = n / 2, R = c - 1;
    for (let x = 0; x < n; x++) for (let z = 0; z < n; z++) {
      const dx = x + .5 - c, dz = z + .5 - c, d = Math.hypot(dx, dz), a = Math.atan2(dz, dx), edge = R - 1.2 + Math.cos(a * 14) * 1.2;
      if (d > edge) continue;
      m.set(x, 0, z, d > edge - 2.5 ? '#F7B0C6' : d > R * .68 ? '#FFE3EC' : d > R * .5 ? '#FAD0DC' : '#FFE3EC');
    }
    m.heart('y', 1, c, c, 5, '#FFFFFF', 1);
  },
  plant(m, f) {
    const s = f.big ? 1.25 : 1, top = Math.round(10 * s);
    m.cyl(6, 6, 0, top, 4.2, '#F2B49A'); m.cyl(6, 6, top - 2, top, 4.8, '#F6C6B0'); m.cyl(6, 6, top - 1, top, 3.6, '#8A6A55');
    const leaf = (x, y, z) => (y > top + 10 * s ? '#A6E0B8' : '#86CC9E');
    m.ell(6, top + 9 * s, 6, 5 * s, 7 * s, 5 * s, leaf); m.ell(2.5, top + 13 * s, 7, 3 * s, 4 * s, 3 * s, leaf); m.ell(9, top + 14 * s, 5, 3 * s, 4.5 * s, 3 * s, leaf); m.ell(6, top + 18 * s, 6, 3 * s, 3 * s, 3 * s, leaf);
  },
  lamp(m) {
    m.cyl(6, 6, 0, 2, 3.5, WHITE); m.cyl(6, 6, 2, 34, .9, GOLD);
    for (let y = 30; y < 42; y++) m.cyl(6, 6, y, y + 1, 6.5 - (y - 30) * .22, y === 30 || y === 41 ? '#FFFFFF' : '#FFD3E0');
  },
  bear(m) {   // すわっているくま（こちら＝ +x +z を向く）
    const br = '#E0AE80', lt = '#F7DDBE', f = .707, c = 6;
    const fw = (d, y, side = 0) => [c + d * f + side * f, y, c + d * f - side * f];
    m.ell(...fw(3.2, 2.2, -2.6), 2.4, 2.2, 2.4, br); m.ell(...fw(3.2, 2.2, 2.6), 2.4, 2.2, 2.4, br);   // 足
    m.ell(c, 7, c, 4.6, 5, 4.6, br); m.ell(...fw(2.6, 6.5), 2.8, 3.2, 2.8, lt);                         // からだ
    m.ell(...fw(1, 8, -4.4), 1.8, 2.6, 1.8, br); m.ell(...fw(1, 8, 4.4), 1.8, 2.6, 1.8, br);           // 手
    m.ell(c, 15.5, c, 4.8, 4.4, 4.8, br);                                                              // 頭
    m.ell(...fw(-.5, 19.5, -3.6), 1.8, 1.8, 1.8, br); m.ell(...fw(-.5, 19.5, 3.6), 1.8, 1.8, 1.8, br); // 耳
    m.ell(...fw(4, 14.2), 1.9, 1.5, 1.9, lt);                                                          // 口もと
    const pt = (d, y, side, col) => { const [x, yy, z] = fw(d, y, side); m.set(Math.floor(x), Math.floor(yy), Math.floor(z), col); };
    pt(4.6, 16.2, -1.6, '#4A3426'); pt(4.6, 16.2, 1.6, '#4A3426'); pt(5.5, 14.6, 0, '#4A3426');         // 目と鼻
    pt(4.3, 14.8, -3, '#F7A8B8'); pt(4.3, 14.8, 3, '#F7A8B8');                                         // ほっぺ
    m.ell(...fw(3.4, 11.2, -1.6), 1.4, 1.2, 1.4, PINK2); m.ell(...fw(3.4, 11.2, 1.6), 1.4, 1.2, 1.4, PINK2);   // リボン
  },
  gift(m) {
    m.rbox(2, 0, 2, 10, 8, 10, 1.2, (x, y, z) => (x === 5 || x === 6 || z === 5 || z === 6 ? PINK2 : LAV));
    m.ell(4.5, 9, 6, 1.8, 1.3, 1.3, PINK2); m.ell(7.5, 9, 6, 1.8, 1.3, 1.3, PINK2);
  },
};

// ---- 部屋 ----
function buildRoom(m) {
  for (let x = 0; x < NV; x++) for (let z = 0; z < NV; z++) {   // 床：パステルの木の板
    const plank = Math.floor(z / 4), seg = Math.floor((x + plank * 11) / 22), seam = (x + plank * 11) % 22 === 0 || z % 4 === 0;
    m.set(x, -1, z, seam ? '#F4D9BA' : ['#FBE4C8', '#F8DEC0', '#FCE8D0'][(plank * 7 + seg * 3) % 3]);
    if (x === NV - 1 || z === NV - 1) for (let y = -4; y < -1; y++) m.set(x, y, z, '#E9BFA0');   // 床のあつみ
  }
  // かべ：ピンクにしろい水玉、下はしろいこしかべ
  const wall = (u, y) => {
    if (y >= WH - 3) return y === WH - 2 ? '#F5BFD0' : '#FFFFFF';
    if (y < 16) return y === 15 || y === 14 ? '#FFFFFF' : y < 2 ? '#F2C4D2' : u % 8 === 0 ? '#F7DDE5' : '#FFF4F7';
    return ((u % 10 + 10) % 10 < 2 && ((y % 10) + 10) % 10 < 2 && (Math.floor(u / 10) + Math.floor(y / 10)) % 2 === 0) ? '#FFFFFF' : '#FAD2DE';
  };
  for (let z = -2; z < NV; z++) for (let y = -4; y < WH; y++) { m.set(-1, y, z, wall(NV - z, y)); m.set(-2, y, z, '#E9B7C7'); }   // 左のかべ
  for (let x = 0; x < NV; x++) for (let y = -4; y < WH; y++) { m.set(x, y, -1, wall(x, y)); m.set(x, y, -2, '#E9B7C7'); }          // 右のかべ
  // 窓（右のかべ）：上がまるいアーチの穴
  const W0 = 34, W1 = 84, Y0 = 20, Y1 = 50, mid = (W0 + W1) / 2;
  const inWin = (x, y) => x >= W0 && x < W1 && y >= Y0 && (y < Y1 - 6 || ((x + .5 - mid) / ((W1 - W0) / 2)) ** 2 + ((y + .5 - (Y1 - 6)) / 7) ** 2 <= 1);
  for (let x = W0 - 2; x < W1 + 2; x++) for (let y = Y0 - 2; y < Y1 + 3; y++) {
    if (inWin(x, y)) { m.set(x, y, -1, null); m.set(x, y, -2, null); if (Math.abs(x + .5 - mid) < 1 || y === Y0 + 13) m.set(x, y, -1, '#FFFFFF'); }
    else if (inWin(x - 2, y) || inWin(x + 2, y) || inWin(x, y + 2) || inWin(x, y - 2)) m.set(x, y, 0, '#FFFFFF');
  }
  for (let x = W0 - 3; x < W1 + 3; x++) { m.set(x, Y0 - 3, 0, '#FFFFFF'); m.set(x, Y0 - 3, 1, '#FFFFFF'); m.set(x, Y0 - 3, 2, '#FFFFFF'); }   // 窓台
  // カーテン：ひだのあるピンク、リボンでたばねる
  for (const [a, dir] of [[W0 - 12, 1], [W1 + 1, -1]]) for (let k = 0; k < 11; k++) for (let y = 10; y < Y1 + 8; y++) {
    const x = a + k, tie = y >= 27 && y < 30, narrow = y > 30 && y < 38 ? 6 : y >= 24 && y <= 30 ? 5 : 11, kk = dir > 0 ? k : 10 - k;
    if (kk >= narrow) continue; const fold = Math.round(Math.sin((x + y * .05) * 1.1) * 1.2 + 2);
    for (let z = 1; z <= fold; z++) m.set(x, y, z, tie ? (y === 28 ? GOLD : '#FFFFFF') : z === fold ? (k % 3 ? '#F9AEC4' : '#F59AB6') : '#F08DAB');
  }
  for (let x = W0 - 14; x < W1 + 14; x++) for (let y = Y1 + 6; y < Y1 + 10; y++) m.set(x, y, 1, y === Y1 + 6 ? ((x % 4) < 2 ? '#FFFFFF' : '#FBC6D5') : '#FBC6D5');   // フリル
  // 左のかべ：小さな棚とかざり
  for (let z = 80; z < 102; z++) { m.set(0, 30, z, WHITE); m.set(1, 30, z, WHITE); m.set(0, 29, z, '#E7CCD4'); }
  m.cyl(1.5, 98, 31, 35, 2, MINT); m.ell(1.5, 37, 98, 2.2, 2.4, 2.2, '#86CC9E'); m.rbox(0, 31, 88, 3, 37, 92, .8, PINK); m.rbox(0, 31, 83, 3, 35, 86, .8, LAV);
  // 右のかべ：ハートのかざり
  m.heart('z', 0, 98, 40, 7, PINK2, 1); m.heart('z', 1, 98, 40, 4.5, '#FFD3E0', 1);
  return { window: { x0: W0, x1: W1, y0: Y0, y1: Y1 } };
}

// ---- まとめて形にする：見える向き（+x・+y・+z）の、となりが空いている面だけ。すき間には AO の影 ----
function mesh(m) {
  const pos = [], nor = [], col = [], idx = [];
  const C = new THREE.Color(), AO = [.68, .8, .9, 1];
  const DIRS = [
    { n: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] },
    { n: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0] },
    { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  ];
  for (const [x, y, z, c] of m.vox.values()) {
    C.set(c);
    for (const d of DIRS) {
      const ox = x + d.n[0], oy = y + d.n[1], oz = z + d.n[2]; if (m.has(ox, oy, oz)) continue;
      const base = pos.length / 3, ao = [];
      for (const [su, sv] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
        const du = su ? 1 : -1, dv = sv ? 1 : -1;
        const s1 = m.has(ox + d.u[0] * du, oy + d.u[1] * du, oz + d.u[2] * du), s2 = m.has(ox + d.v[0] * dv, oy + d.v[1] * dv, oz + d.v[2] * dv);
        const cr = m.has(ox + d.u[0] * du + d.v[0] * dv, oy + d.u[1] * du + d.v[1] * dv, oz + d.u[2] * du + d.v[2] * dv);
        const a = s1 && s2 ? 0 : 3 - (s1 + s2 + cr); ao.push(a);
        const px = x + (d.n[0] > 0 ? 1 : 0) + d.u[0] * su + d.v[0] * sv, py = y + (d.n[1] > 0 ? 1 : 0) + d.u[1] * su + d.v[1] * sv, pz = z + (d.n[2] > 0 ? 1 : 0) + d.u[2] * su + d.v[2] * sv;
        pos.push(px, py, pz); nor.push(...d.n); const k = AO[a]; col.push(C.r * k, C.g * k, C.b * k);
      }
      // AO がなめらかに見えるように、四角を分ける向きを選ぶ（u×v＝n の順で表になる）
      if (ao[0] + ao[2] >= ao[1] + ao[3]) idx.push(base, base + 1, base + 2, base, base + 2, base + 3); else idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  return g;
}

// ---- 表示 ----
// opts：{ stage, objects, furn, me, blocked(i,j), onMove(i,j), chara（Promise<canvas>）, engineCanvas, night(), photoSlots }
export function mountVoxelRoom(opts) {
  const { stage } = opts;
  const cv = document.createElement('canvas'); cv.className = 'hm-iso vox'; stage.append(cv);
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false, alpha: true });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.setPixelRatio(1);
  const scene = new THREE.Scene();

  const m = maker(); const info = buildRoom(m);
  for (const o of opts.objects) {
    const f = opts.furn(o.id), sub = maker(); (M[f.art] || M.gift)(sub, f);
    for (const [x, y, z, c] of sub.vox.values()) m.set(o.i * V + x, y, o.j * V + z, c);
  }
  const geo = mesh(m), mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const room = new THREE.Mesh(geo, mat); room.castShadow = room.receiveShadow = true; scene.add(room);

  // 窓の景色：名所のカードの上のほうを、かべの穴のうしろの板に映す
  const w = info.window, ww = w.x1 - w.x0, wh = w.y1 - w.y0 + 2;
  const wtex = new THREE.CanvasTexture(opts.engineCanvas); wtex.magFilter = THREE.NearestFilter; wtex.minFilter = THREE.LinearFilter;
  const ea = opts.engineCanvas.width / (opts.engineCanvas.height * .45), wa = ww / wh;
  wtex.repeat.set(Math.min(1, ea > wa ? wa / ea : 1), .45 * Math.min(1, wa > ea ? ea / wa : 1)); wtex.offset.set((1 - wtex.repeat.x) / 2, 1 - .04 - wtex.repeat.y);
  const wplane = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), new THREE.MeshBasicMaterial({ map: wtex }));
  wplane.position.set(w.x0 + ww / 2, w.y0 + wh / 2, -2.5); scene.add(wplane);

  // 写真（左のかべ）：しろいふちつき
  const photoMeshes = (opts.photoSlots || []).map(s => {
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), new THREE.MeshLambertMaterial({ color: 0xffffff })); pm.rotation.y = Math.PI / 2;
    pm.position.set(.08, s.y + s.h / 2, s.z - s.w / 2); pm.visible = false; pm.receiveShadow = true; scene.add(pm); return pm;
  });
  function setPhotos(imgs) {
    imgs.forEach((im, k) => { const pm = photoMeshes[k]; if (!pm) return; if (!im) { pm.visible = false; return; }
      const c = document.createElement('canvas'); c.width = 70; c.height = 90; const g = c.getContext('2d'); g.fillStyle = '#FFFDF8'; g.fillRect(0, 0, 70, 90);
      const iw = 60, ih = 68, sw = im.width, sh = sw * ih / iw; g.imageSmoothingEnabled = false; g.drawImage(im, 0, im.height * .55 - sh / 2, sw, sh, 5, 5, iw, ih);
      g.fillStyle = ['rgba(249,180,200,.9)', 'rgba(195,235,220,.9)', 'rgba(220,200,242,.9)'][k % 3]; g.fillRect(21, 0, 28, 8);
      const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; pm.material.map = t; pm.material.needsUpdate = true; pm.visible = true; });
  }

  // ガーランドの電球（左のかべの上）
  const bulbCols = [0xFF9AC0, 0xFFE38A, 0xA8E6FF, 0xC9A8FF, 0xA8F0C8];
  const bulbs = Array.from({ length: 16 }, (_, k) => { const b = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2, 1.4), new THREE.MeshBasicMaterial({ color: bulbCols[k % 5] }));
    b.position.set(1, WH - 7 - Math.sin(((k % 4) + .5) / 4 * Math.PI) * 3, NV - 5 - k * 7); scene.add(b); return b; });

  // 光：やわらかいパステルの光と、あたたかい日ざし（影はうすめ）
  const hemi = new THREE.HemisphereLight(0xfff3f8, 0xffd9c4, .8); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0e0, .5); sun.position.set(NV / 2 + 70, 150, NV / 2 + 40); sun.target.position.set(NV / 2, 0, NV / 2); scene.add(sun, sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 1, far: 400 }); sun.shadow.bias = -.0008; sun.shadow.radius = 3;
  const lamps = opts.objects.filter(o => opts.furn(o.id).light).map(o => { const p = new THREE.PointLight(0xffb48a, 0, 90, 1.4); p.position.set(o.i * V + 6, 34, o.j * V + 6); scene.add(p); return p; });

  // カメラ：斜め上から（2:1 に近い見え方）
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -400, 800);
  const C = new THREE.Vector3(NV / 2 - 6, 16, NV / 2 - 6);
  cam.position.set(C.x + 200, C.y + 163, C.z + 200); cam.lookAt(C);

  // キャラ：ドット絵の板。部屋と同じ光で照らされ、床に影を落とす（いつもカメラのほうを向く）
  const CH = 30; let chara = null, tex = null;
  const me = { x: opts.me.i + .5, z: opts.me.j + .5, tx: null, tz: null, jump: 0, flip: false };
  opts.chara.then(c => {
    tex = new THREE.CanvasTexture(c); tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.wrapS = THREE.RepeatWrapping;
    const mtl = new THREE.MeshLambertMaterial({ map: tex, alphaTest: .5, side: THREE.DoubleSide });
    chara = new THREE.Mesh(new THREE.PlaneGeometry(CH * c.width / c.height, CH).translate(0, CH / 2, 0), mtl);
    chara.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: .5 });
    chara.castShadow = true; chara.rotation.y = Math.PI / 4; scene.add(chara);
  });

  // 大きさ：ステージの高さに合わせ、横は少し広く（横にスクロール）
  const SCALE = 2;   // 画面の2px＝描く1ドット
  function resize() {
    const H = stage.clientHeight, W = Math.round(H * 1.35);
    cv.style.height = H + 'px'; cv.style.width = W + 'px';
    renderer.setSize(Math.round(W / SCALE), Math.round(H / SCALE), false);
    const viewH = 132, viewW = viewH * W / H; Object.assign(cam, { left: -viewW / 2, right: viewW / 2, top: viewH / 2, bottom: -viewH / 2 }); cam.updateProjectionMatrix();
  }
  resize();

  // さわる：床を押すとそこへ歩く、キャラを押すとジャンプ
  const ray = new THREE.Raycaster(), floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3(), nd = new THREE.Vector2();
  cv.addEventListener('click', e => {
    const r = cv.getBoundingClientRect(); nd.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(nd, cam);
    if (chara && ray.intersectObject(chara).length) { if (!me.jump) me.jump = 1; return; }
    if (!ray.ray.intersectPlane(floor, hit)) return; const i = Math.floor(hit.x / V), j = Math.floor(hit.z / V);
    if (i < 0 || j < 0 || i >= 10 || j >= 10 || opts.blocked(i, j)) return;
    me.tx = i + .5; me.tz = j + .5; opts.onMove(i, j);
  });

  let raf = 0, last = performance.now();
  function frame(t) {
    raf = requestAnimationFrame(frame); const dt = Math.min(50, t - last); last = t;
    if (me.tx != null) { const dx = me.tx - me.x, dz = me.tz - me.z, d = Math.hypot(dx, dz), sp = .0035 * dt; if (d <= sp) { me.x = me.tx; me.z = me.tz; me.tx = null; } else { me.x += dx / d * sp; me.z += dz / d * sp; if (Math.abs(dx - dz) > .01) me.flip = dx - dz < 0; } }
    if (me.jump > 0) me.jump = Math.max(0, me.jump - dt / 520);
    const bob = me.tx != null ? Math.abs(Math.sin(t / 90)) * 1 : 0, jy = me.jump > 0 ? Math.sin(me.jump * Math.PI) * 9 : 0;
    if (chara) { chara.position.set(me.x * V, bob + jy, me.z * V); tex.repeat.x = me.flip ? -1 : 1; tex.offset.x = me.flip ? 1 : 0; }
    const n = opts.night();
    hemi.intensity = .8 - .4 * n; sun.intensity = .5 - .38 * n; lamps.forEach(p => { p.intensity = 1.5 * n; });
    hemi.color.setHex(n > .7 ? 0xc8c0ff : n > .2 ? 0xffd8d0 : 0xfff3f8);
    bulbs.forEach((b, k) => { const on = .55 + .45 * Math.sin(t / 500 + k * 1.7); b.material.color.setHex(bulbCols[k % 5]).multiplyScalar(.7 + .3 * on + .2 * n); });
    wtex.needsUpdate = true;
    renderer.render(scene, cam);
  }
  raf = requestAnimationFrame(frame);
  const onResize = () => resize(); addEventListener('resize', onResize);
  return {
    canvas: cv, setPhotos, screenX: () => { const v = new THREE.Vector3(me.x * V, 15, me.z * V).project(cam); return (v.x + 1) / 2; },
    stop() { cancelAnimationFrame(raf); removeEventListener('resize', onResize); renderer.dispose(); geo.dispose(); mat.dispose(); cv.remove(); },
  };
}
