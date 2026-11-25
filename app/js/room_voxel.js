// マイルームのボクセル版（ためし）：同じ部屋と家具を、小さな立方体（ボクセル）で組んで Three.js で描く
//   1マス＝V×V ボクセル（V＝20、1ボクセル≒3cm）。家具は本物の寸法（cm）で、角の丸いぷっくりした形に作る
//   ボクセルは大きな箱（Uint32Array）に入れ、見える向き（+x +y +z）の面だけを1つの形にまとめる
//   かわいく見せる工夫（fx）：アニメ塗り・すき間の影（AO）・窓からの光・光のつぶ・グロー・タップでハート。1つずつオン・オフできる
//   でんき：ライトの明かりと、部屋の明かり。夜は消すと月明かりだけになる
const THREE = window.THREE;
export const V = 20;
const TILE = 62;                          // 1マス＝62cm
const CM = V / TILE;                      // 1cm＝何ボクセルか
export const WH = Math.round(260 * CM);   // かべの高さ（ボクセル）
const NV = 10 * V;

// ---- ボクセルの箱 ----
// 部屋の箱の大きさ（家具は1つずつ小さな箱で作る）
const ROOM_BOX = { X0: -4, Y0: -8, Z0: -4, SX: NV + 8, SY: WH + 24, SZ: NV + 8 };
const cols = new Map(); const colInt = c => { let v = cols.get(c); if (v === undefined) { v = (parseInt(c.slice(1), 16) + 1) >>> 0; cols.set(c, v); } return v; };
function grid(B = ROOM_BOX) {
  const { X0, Y0, Z0, SX, SY, SZ } = B, SXS = SY * SZ, SYS = SZ;
  const g = new Uint32Array(SX * SY * SZ);
  const at = (x, y, z) => (x - X0) * SXS + (y - Y0) * SYS + (z - Z0);
  const ok = (x, y, z) => x >= X0 + 1 && x < X0 + SX - 1 && y >= Y0 + 1 && y < Y0 + SY - 1 && z >= Z0 + 1 && z < Z0 + SZ - 1;
  // 形を描く道具。k：1単位が何ボクセルか（家具は cm で書くので CM）、ox・oz：置く場所（ボクセル）
  const pen = (k = 1, ox = 0, oz = 0) => {
    const put = (x, y, z, c) => { if (!ok(x, y, z)) return; const v = typeof c === 'function' ? c(x, y, z) : c; g[at(x, y, z)] = v == null ? 0 : colInt(v); };
    const R = (a, b) => [Math.floor(a), Math.ceil(b)];
    const P = {
      k, ox, oz,
      set(x, y, z, c) { put(Math.floor(ox + x * k), Math.floor(y * k), Math.floor(oz + z * k), c); },
      box(x0, y0, z0, x1, y1, z1, c) { const [a, b] = R(ox + x0 * k, ox + x1 * k), [cc, d] = R(y0 * k, y1 * k), [e, f] = R(oz + z0 * k, oz + z1 * k);
        for (let x = a; x < b; x++) for (let y = cc; y < d; y++) for (let z = e; z < f; z++) put(x, y, z, c); },
      // 角の丸い箱（r：丸みの半径）
      rbox(x0, y0, z0, x1, y1, z1, r, c) {
        const A = [ox + x0 * k, y0 * k, oz + z0 * k], B = [ox + x1 * k, y1 * k, oz + z1 * k], rr = r * k, cl = (v, a, b) => Math.max(a, Math.min(b, v));
        for (let x = Math.floor(A[0]); x < B[0]; x++) for (let y = Math.floor(A[1]); y < B[1]; y++) for (let z = Math.floor(A[2]); z < B[2]; z++) {
          const px = x + .5, py = y + .5, pz = z + .5, dx = px - cl(px, A[0] + rr, B[0] - rr), dy = py - cl(py, A[1] + rr, B[1] - rr), dz = pz - cl(pz, A[2] + rr, B[2] - rr);
          if (dx * dx + dy * dy + dz * dz <= rr * rr) put(x, y, z, c);
        }
      },
      ell(cx, cy, cz, rx, ry, rz, c) {
        const X = ox + cx * k, Y = cy * k, Z = oz + cz * k, a = rx * k, b = ry * k, d = rz * k;
        for (let x = Math.floor(X - a); x <= X + a; x++) for (let y = Math.floor(Y - b); y <= Y + b; y++) for (let z = Math.floor(Z - d); z <= Z + d; z++)
          if (((x + .5 - X) / a) ** 2 + ((y + .5 - Y) / b) ** 2 + ((z + .5 - Z) / d) ** 2 <= 1) put(x, y, z, c);
      },
      cyl(cx, cz, y0, y1, r, c) { const X = ox + cx * k, Z = oz + cz * k, rr = r * k;
        for (let x = Math.floor(X - rr); x <= X + rr; x++) for (let z = Math.floor(Z - rr); z <= Z + rr; z++) if ((x + .5 - X) ** 2 + (z + .5 - Z) ** 2 <= rr * rr) for (let y = Math.floor(y0 * k); y < y1 * k; y++) put(x, y, z, c); },
      // ハート（板）。axis：'x'＝x が一定の面、'z'＝z が一定の面、'y'＝床と平行。a は面の位置、cu・cv は中心、s は大きさ、th は厚み（すべて同じ単位）
      heart(axis, a, cu, cv, s, c, th = 1) {
        const U = (axis === 'x' ? oz : ox) + cu * k, Vv = (axis === 'y' ? oz + cv * k : cv * k), S = s * k, A = (axis === 'x' ? ox : axis === 'z' ? oz : 0) + a * k, T = Math.max(1, Math.round(th * k));
        for (let u = Math.floor(U - S * 1.2); u <= U + S * 1.2; u++) for (let v = Math.floor(Vv - S * 1.1); v <= Vv + S; v++) {
          const Xh = (u + .5 - U) / S, Yh = (v + .5 - Vv) / S * (axis === 'y' ? -1 : 1); if (Xh * Xh + (Yh * 1.2 - Math.sqrt(Math.abs(Xh)) * .8) ** 2 > 1) continue;
          for (let t = 0; t < T; t++) { const w = Math.floor(A) + t; if (axis === 'x') put(w, v, u, c); else if (axis === 'z') put(u, v, w, c); else put(u, w, v, c); }
        }
      },
    };
    return P;
  };
  return { g, at, pen, B, SXS, SYS };
}

// ---- 家具（cm。x＝右のかべにそう向き、z＝左のかべにそう向き、y＝上。こちら向き＝ +x と +z） ----
const PINK = '#F9B2C7', PINK2 = '#F497B3', ROSE = '#EC7FA3', WHITE = '#FFF7F2', CREAM = '#FFF1DC', LAV = '#DCCBF4', MINT = '#BFEBDA', GOLD = '#F5CD74', SKY = '#CFE8F7', WOOD = '#F6DCC4';
const dots = (base, dot, step) => (x, y, z) => { const a = ((x % step) + step) % step, b = ((z % step) + step) % step; return a < 2 && b < 2 && (Math.floor(x / step) + Math.floor(z / step)) % 2 === 0 ? dot : base; };   // 上から見た水玉
const M = {
  bed(m) {   // 186×124cm。頭は x＝0（左のかべ）側。高さはふとんの上で 48cm
    m.rbox(0, 0, 3, 186, 24, 121, 4, WOOD);                                           // わく
    m.rbox(10, 18, 6, 184, 38, 118, 6, CREAM);                                         // マットレス
    m.box(0, 0, 3, 9, 112, 121, (x, y, z) => { const zl = (z + .5 - m.oz) / CM; return y / CM < 84 + 26 * Math.sqrt(Math.max(0, 1 - ((zl - 62) / 58) ** 2)) ? WHITE : null; });   // アーチのヘッドボード
    m.heart('x', 9, 62, 80, 13, PINK2, 3);
    m.rbox(16, 36, 16, 46, 46, 56, 5, LAV); m.rbox(16, 36, 68, 46, 46, 108, 5, LAV);   // まくら（小さめ）
    m.rbox(58, 28, 0, 188, 50, 124, 9, dots(PINK, '#FFFFFF', 7));                    // ふかふかの掛けぶとん
    m.ell(80, 54, 62, 10, 7, 10, '#FFFFFF'); m.heart('z', 70, 90, 60, 9, PINK2, 4);    // まくらの前のクッション
  },
  sofa(m) {   // 186×62cm。座面の高さ 42cm、せもたれ 80cm
    m.rbox(0, 0, 0, 186, 26, 62, 7, ROSE);
    m.rbox(4, 20, 0, 182, 80, 20, 10, PINK);                                           // せもたれ
    m.rbox(18, 22, 16, 93, 42, 62, 8, '#FBC6D6'); m.rbox(93, 22, 16, 168, 42, 62, 8, '#FBC6D6');   // 座面
    m.rbox(0, 20, 0, 20, 62, 62, 9, PINK); m.rbox(166, 20, 0, 186, 62, 62, 9, PINK);   // ひじかけ
    m.rbox(30, 40, 18, 66, 70, 30, 8, '#FFFFFF'); m.heart('z', 30, 48, 55, 8, PINK2, 2);   // ハートのクッション
    m.rbox(124, 40, 18, 156, 68, 30, 8, MINT);
  },
  table(m) {   // まるいテーブル（高さ 40cm）とケーキ
    m.cyl(31, 31, 0, 3, 15, WHITE); m.cyl(31, 31, 3, 36, 4, WHITE);
    m.cyl(31, 31, 35, 38, 27, PINK2); m.cyl(31, 31, 38, 41, 27, WHITE);
    m.cyl(25, 28, 41, 49, 9, CREAM); m.cyl(25, 28, 49, 52, 9, '#FFD6E2'); m.ell(25, 54, 28, 3, 3, 3, '#E8475C');   // ケーキといちご
    m.cyl(40, 40, 41, 42, 7, '#FFFFFF'); m.cyl(40, 40, 42, 49, 4.5, MINT); m.ell(45, 46, 43, 2.5, 3, 2.5, MINT);   // カップ
  },
  shelf(m) {   // 本だな（62×124cm、高さ 140cm、奥行き 40cm）
    m.rbox(0, 0, 0, 40, 140, 124, 3, WHITE);
    const C = ['#F48FB0', '#DCC8F2', '#A8DACA', '#F6D27E', '#A8C8F0', '#F9B4C8', '#FFFFFF'];
    for (const [k, y0] of [6, 40, 74, 108].entries()) {
      m.box(14, y0, 6, 40, y0 + 28, 118, null);                                         // 棚の中をくりぬく
      let z = 8; for (let n = 0; z < 112; n++) { const w = 4 + ((n * 3 + k) % 3) * 2, h = 18 + ((n * 5 + k * 3) % 4) * 2.5; if ((n + k) % 7 === 5) { z += 10; continue; } m.box(17, y0, z, 37, y0 + h, z + w, C[(n + k * 2) % C.length]); z += w + .5; }
    }
    m.cyl(20, 25, 140, 152, 9, '#F2B49A'); m.ell(20, 162, 25, 13, 12, 13, '#8CD3A6');  // 上の鉢
    m.ell(20, 150, 90, 9, 10, 9, '#E0AE80'); m.ell(20, 166, 90, 8, 7, 8, '#E0AE80'); m.ell(18, 172, 85, 3, 3, 3, '#E0AE80'); m.ell(18, 172, 95, 3, 3, 3, '#E0AE80');   // 小さなくま
  },
  vanity(m) {   // ドレッサー（124×62cm、つくえ 76cm、かがみつき）
    m.rbox(0, 0, 4, 124, 76, 58, 4, WHITE);
    for (const x0 of [8, 66]) for (const y0 of [12, 42]) { m.box(x0, y0, 57, x0 + 50, y0 + 2, 59, '#F2D0DA'); m.box(x0, y0 + 25, 57, x0 + 50, y0 + 27, 59, '#F2D0DA'); m.ell(x0 + 25, y0 + 13, 59, 3, 3, 3, GOLD); }
    for (let x = 20; x < 104; x += 1 / CM) for (let y = 76; y < 176; y += 1 / CM) {   // 楕円のかがみ
      const dx = (x - 62) / 38, dy = (y - 126) / 48, d = dx * dx + dy * dy; if (d > 1) continue;
      m.box(x, y, 0, x + 1 / CM, y + 1 / CM, d > .7 ? 7 : 4, d > .7 ? PINK : ((x - y) % 24 + 24) % 24 < 5 ? '#FFFFFF' : SKY);
    }
    for (let a = 0; a < 16; a++) { const t = a / 16 * Math.PI * 2; m.ell(62 + Math.cos(t) * 40, 126 + Math.sin(t) * 51, 7, 3, 3, 3, GOLD); }   // かがみのまわりの電球
    m.cyl(22, 30, 76, 92, 5, LAV); m.ell(22, 95, 30, 3, 3, 3, '#FFFFFF'); m.cyl(36, 36, 76, 86, 4, PINK2);   // 香水
    m.cyl(98, 30, 76, 90, 6, SKY); for (const [dx, dz, c] of [[0, 0, '#F48FB0'], [-5, 4, '#FFFFFF'], [5, -3, '#F6D27E'], [3, 6, '#F9B4C8']]) m.ell(98 + dx, 96 + Math.abs(dx), 30 + dz, 5, 5, 5, c);   // 花びん
  },
  rug(m, f) {
    const n = f.w * TILE, c = n / 2, R = c - 4;
    for (let x = 0; x < n; x += 1 / CM) for (let z = 0; z < n; z += 1 / CM) {
      const dx = x - c, dz = z - c, d = Math.hypot(dx, dz), a = Math.atan2(dz, dx), edge = R - 4 + Math.cos(a * 16) * 4;
      if (d > edge) continue;
      m.box(x, 0, z, x + 1 / CM, 1 / CM, z + 1 / CM, d > edge - 9 ? '#F7B0C6' : d > R * .66 ? '#FFE3EC' : d > R * .5 ? '#FAD0DC' : '#FFE3EC');
    }
    m.heart('y', 1 / CM, c, c, 18, '#FFFFFF', 1 / CM);
  },
  plant(m, f) {
    const s = f.big ? 1.25 : 1, top = 30 * s;
    m.cyl(31, 31, 0, top, 15, '#F2B49A'); m.cyl(31, 31, top - 5, top, 17, '#F6C6B0'); m.cyl(31, 31, top - 2, top, 13, '#8A6A55');
    const leaf = (x, y, z) => (y / CM > top + 32 * s ? '#A6E0B8' : (x + z) % 5 === 0 ? '#76C091' : '#86CC9E');
    m.ell(31, top + 24 * s, 31, 15 * s, 22 * s, 15 * s, leaf); m.ell(18, top + 34 * s, 34, 9 * s, 13 * s, 9 * s, leaf); m.ell(42, top + 38 * s, 26, 9 * s, 14 * s, 9 * s, leaf); m.ell(31, top + 50 * s, 31, 9 * s, 10 * s, 9 * s, leaf);
  },
  lamp(m) {   // スタンドライト（高さ 160cm）
    m.cyl(31, 31, 0, 3, 14, WHITE); m.cyl(31, 31, 3, 128, 2, GOLD);
    for (let y = 122; y < 160; y += 1 / CM) m.cyl(31, 31, y, y + 1 / CM, 22 - (y - 122) * .2, y < 124 || y > 157 ? '#FFFFFF' : '#FFD3E0');
  },
  bear(m) {   // すわっているくま（高さ 45cm、こちら＝ +x +z を向く）
    const br = '#E7B88E', lt = '#F8E2C6', f = .707, c = 31;
    const fw = (d, y, side = 0) => [c + d * f + side * f, y, c + d * f - side * f];
    m.ell(...fw(10, 6, -8), 6.5, 6, 6.5, br); m.ell(...fw(10, 6, 8), 6.5, 6, 6.5, br);         // 足
    m.ell(...fw(14.5, 6, -8), 2, 3.5, 3.5, lt); m.ell(...fw(14.5, 6, 8), 2, 3.5, 3.5, lt);       // 足のうら
    m.ell(c, 15, c, 11, 13, 11, br); m.ell(...fw(7, 14), 6.5, 8, 6.5, lt);                         // からだ
    m.ell(...fw(4, 17, -11), 4.5, 7, 4.5, br); m.ell(...fw(4, 17, 11), 4.5, 7, 4.5, br);           // 手
    m.ell(c, 35, c, 12, 10.5, 12, br);                                                             // 頭
    m.ell(...fw(-1, 44, -9), 4.5, 4.5, 3.5, br); m.ell(...fw(-1, 44, 9), 4.5, 4.5, 3.5, br);       // 耳
    m.ell(...fw(.5, 44.5, -9), 2.5, 2.5, 2, '#F7B8C4'); m.ell(...fw(.5, 44.5, 9), 2.5, 2.5, 2, '#F7B8C4');
    m.ell(...fw(10, 32.5), 4.5, 3.5, 4.5, lt);                                                     // 口もと
    m.ell(...fw(11.5, 37, -4.2), 1.6, 1.9, 1.6, '#3E2A20'); m.ell(...fw(11.5, 37, 4.2), 1.6, 1.9, 1.6, '#3E2A20');   // 目
    m.ell(...fw(14, 33.5), 1.6, 1.2, 1.6, '#3E2A20');                                              // 鼻
    m.ell(...fw(10, 33, -8), 2.2, 1.4, 2.2, '#F7A8B8'); m.ell(...fw(10, 33, 8), 2.2, 1.4, 2.2, '#F7A8B8');   // ほっぺ
    m.ell(...fw(8.5, 25, -3.5), 3.2, 2.6, 2.4, PINK2); m.ell(...fw(8.5, 25, 3.5), 3.2, 2.6, 2.4, PINK2); m.ell(...fw(9.5, 25), 1.8, 1.8, 1.8, ROSE);   // リボン
  },
  gift(m) {
    m.rbox(19, 0, 19, 43, 22, 43, 3, (x, y, z) => (Math.abs(x / CM % TILE - 31) < 2.5 || Math.abs(z / CM % TILE - 31) < 2.5 ? PINK2 : LAV));
    m.ell(25, 25, 31, 6, 4, 4, PINK2); m.ell(37, 25, 31, 6, 4, 4, PINK2);
  },
};

// ---- 部屋（ボクセルの単位） ----
function buildRoom(G) {
  const m = G.pen(1);
  for (let x = 0; x < NV; x++) for (let z = 0; z < NV; z++) {   // 床：パステルの木の板
    const plank = Math.floor(z / 6), seg = Math.floor((x + plank * 17) / 36), seam = (x + plank * 17) % 36 === 0 || z % 6 === 0;
    m.set(x, -1, z, seam ? '#F4D9BA' : ['#FBE4C8', '#F8DEC0', '#FCE8D0'][(plank * 7 + seg * 3) % 3]);
    if (x === NV - 1 || z === NV - 1) for (let y = -5; y < -1; y++) m.set(x, y, z, '#E9BFA0');   // 床のあつみ
  }
  // かべ：ピンクにしろい水玉、下はしろいこしかべ、上はしろいモールディング
  const wain = Math.round(90 * CM);
  const wall = (u, y) => {
    if (y >= WH - 4) return y === WH - 3 ? '#F5BFD0' : '#FFFFFF';
    if (y < wain) return y >= wain - 3 ? '#FFFFFF' : y < 3 ? '#F2C4D2' : u % 12 === 0 ? '#F7DDE5' : '#FFF4F7';
    const a = ((u % 16) + 16) % 16, b = (((y - wain) % 16) + 16) % 16, even = (Math.floor(u / 16) + Math.floor((y - wain) / 16)) % 2 === 0;
    return (a >= 6 && a < 9 && b >= 6 && b < 9 && even) ? '#FFFFFF' : '#FAD2DE';
  };
  for (let z = -1; z < NV; z++) for (let y = -5; y < WH; y++) m.set(-1, y, z, wall(NV - z, y));   // 左のかべ（x＝-1）
  for (let x = 0; x < NV; x++) for (let y = -5; y < WH; y++) m.set(x, y, -1, wall(x, y));          // 右のかべ（z＝-1）
  // 窓（右のかべ）：上がまるいアーチの穴
  const W0 = Math.round(2.8 * V), W1 = Math.round(7 * V), Y0 = Math.round(90 * CM), Y1 = Math.round(215 * CM), mid = (W0 + W1) / 2, arch = Math.round(14 * CM * 1.6);
  const inWin = (x, y) => x >= W0 && x < W1 && y >= Y0 && (y < Y1 - arch || ((x + .5 - mid) / ((W1 - W0) / 2)) ** 2 + ((y + .5 - (Y1 - arch)) / arch) ** 2 <= 1);
  for (let x = W0 - 4; x < W1 + 4; x++) for (let y = Y0 - 4; y < Y1 + 4; y++) {
    if (inWin(x, y)) { m.set(x, y, -1, Math.abs(x + .5 - mid) < 1.5 || Math.abs(y - (Y0 + Math.round((Y1 - arch - Y0) * .45))) < 1 ? '#FFFFFF' : null); }
    else if (inWin(x - 3, y) || inWin(x + 3, y) || inWin(x, y + 3) || inWin(x, y - 3)) { m.set(x, y, 0, '#FFFFFF'); m.set(x, y, 1, '#FFFFFF'); }
  }
  for (let x = W0 - 6; x < W1 + 6; x++) for (let z = 0; z < 5; z++) { m.set(x, Y0 - 4, z, '#FFFFFF'); m.set(x, Y0 - 5, z, '#F3E3E8'); }   // 窓台
  // カーテン：ひだのあるピンク、リボンでたばねる
  const cw = Math.round(28 * CM), tieY = Math.round(130 * CM);
  for (const [a, dir] of [[W0 - cw - 2, 1], [W1 + 2, -1]]) for (let k = 0; k < cw; k++) for (let y = Math.round(40 * CM); y < Y1 + 10; y++) {
    const x = a + k, kk = dir > 0 ? k : cw - 1 - k, dy = Math.abs(y - tieY), narrow = dy < 3 ? cw * .4 : dy < 18 ? cw * (.4 + dy / 30) : cw, tie = dy < 2;
    if (kk >= narrow) continue; const fold = Math.round(Math.sin(x * .9) * 1.5 + 3);
    for (let z = 1; z <= fold; z++) m.set(x, y, z, tie ? (dy < 1 ? GOLD : '#FFFFFF') : z === fold ? (x % 4 < 2 ? '#F9AEC4' : '#F59AB6') : '#F08DAB');
  }
  for (let x = W0 - cw - 6; x < W1 + cw + 6; x++) for (let y = Y1 + 8; y < Y1 + 15; y++) {   // フリルのバランス
    const scallop = y === Y1 + 8 && ((x % 8) + 8) % 8 > 5; if (scallop) continue;
    m.set(x, y, 1, y === Y1 + 9 && x % 3 === 0 ? '#FFFFFF' : '#FBC6D5'); m.set(x, y, 2, '#FBC6D5');
  }
  // 左のかべ：雲の形の棚とかざり、まるい時計
  const P = G.pen(CM, 0, 0);
  const shelfZ = 3.6 * TILE, shelfY = 150;
  P.rbox(0, shelfY, shelfZ, 14, shelfY + 4, shelfZ + 62, 2, WHITE);
  P.ell(0, shelfY + 2, shelfZ, 8, 6, 8, WHITE); P.ell(0, shelfY + 2, shelfZ + 62, 8, 6, 8, WHITE);
  P.cyl(7, shelfZ + 10, shelfY + 4, shelfY + 14, 5, MINT); P.ell(7, shelfY + 20, shelfZ + 10, 6, 7, 6, '#86CC9E');
  P.rbox(0, shelfY + 4, shelfZ + 22, 9, shelfY + 22, shelfZ + 30, 2, PINK); P.rbox(0, shelfY + 4, shelfZ + 32, 9, shelfY + 18, shelfZ + 38, 2, LAV);
  P.ell(7, shelfY + 10, shelfZ + 50, 6, 6, 6, '#E7B88E'); P.ell(7, shelfY + 19, shelfZ + 50, 5, 4.5, 5, '#E7B88E');
  for (let y = 160; y < 200; y += 1 / CM) for (let z = 0.6 * TILE; z < 0.6 * TILE + 40; z += 1 / CM) { const d = Math.hypot(y - 180, z - (0.6 * TILE + 20)); if (d > 20) continue;   // 時計
    P.box(0, y, z, d > 16 ? 4 : 3, y + 1 / CM, z + 1 / CM, d > 16 ? PINK : '#FFFFFF'); }
  P.box(3, 180, 0.6 * TILE + 19, 5, 192, 0.6 * TILE + 21, '#7A5A6A'); P.box(3, 179, 0.6 * TILE + 19, 5, 181, 0.6 * TILE + 30, '#7A5A6A');
  // 右のかべ：星のシール
  for (const [x, y] of [[8.2, 175], [8.9, 200], [9.4, 160], [7.8, 220], [1.4, 205], [0.8, 170]]) P.heart('z', 0, x * TILE, y, 5, x > 5 ? '#FFE38A' : '#FFFFFF', 2);
  // 床：ベッドのそばのスリッパ、まるいクッション
  P.rbox(3.05 * TILE, 0, 1.4 * TILE, 3.05 * TILE + 26, 6, 1.4 * TILE + 11, 4, PINK); P.rbox(3.05 * TILE, 0, 1.6 * TILE + 4, 3.05 * TILE + 26, 6, 1.6 * TILE + 15, 4, PINK);
  P.ell(3.05 * TILE + 8, 6, 1.4 * TILE + 5.5, 4, 2, 4, '#FFFFFF'); P.ell(3.05 * TILE + 8, 6, 1.6 * TILE + 9.5, 4, 2, 4, '#FFFFFF');
  P.ell(8.6 * TILE, 8, 8.4 * TILE, 26, 9, 26, '#DCCBF4'); P.ell(8.6 * TILE, 15, 8.4 * TILE, 10, 3, 10, '#EEE3FA');
  return { window: { x0: W0, x1: W1, y0: Y0, y1: Y1 } };
}

// ---- まとめて形にする：見える向き（+x・+y・+z）の、となりが空いている面だけ。AO（すき間の影）つきと、なしの色を両方つくる ----
// all：6つの向きぜんぶ（回せる家具。部屋は見える3つの向きだけ）
function mesh(G, all = false) {
  const { g, SXS, SYS } = G, { X0, Y0, Z0, SX, SY, SZ } = G.B, C = new THREE.Color(), AO = [.62, .78, .9, 1];
  const DIRS = [
    { s: SXS, u: SYS, v: 1, n: [1, 0, 0], du: [0, 1, 0], dv: [0, 0, 1] },
    { s: SYS, u: 1, v: SXS, n: [0, 1, 0], du: [0, 0, 1], dv: [1, 0, 0] },
    { s: 1, u: SXS, v: SYS, n: [0, 0, 1], du: [1, 0, 0], dv: [0, 1, 0] },
    ...(all ? [
      { s: -SXS, u: 1, v: SYS, n: [-1, 0, 0], du: [0, 0, 1], dv: [0, 1, 0] },
      { s: -SYS, u: SXS, v: 1, n: [0, -1, 0], du: [1, 0, 0], dv: [0, 0, 1] },
      { s: -1, u: SYS, v: SXS, n: [0, 0, -1], du: [0, 1, 0], dv: [1, 0, 0] },
    ] : []),
  ];
  let faces = 0; for (let i = 0; i < g.length; i++) if (g[i]) for (const d of DIRS) if (!g[i + d.s]) faces++;
  const pos = new Float32Array(faces * 12), nor = new Float32Array(faces * 12), colA = new Float32Array(faces * 12), colF = new Float32Array(faces * 12), idx = new Uint32Array(faces * 6);
  let f = 0;
  for (let x = 0, i0 = 0; x < SX; x++) for (let y = 0; y < SY; y++) for (let z = 0; z < SZ; z++, i0++) {
    const c = g[i0]; if (!c) continue; let rgb = null;
    for (const d of DIRS) {
      const o = i0 + d.s; if (g[o]) continue;
      if (!rgb) { C.setHex(c - 1); rgb = [C.r, C.g, C.b]; }
      const ao = [];
      for (let q = 0; q < 4; q++) {
        const su = q === 1 || q === 2 ? 1 : 0, sv = q >= 2 ? 1 : 0, du = su ? d.u : -d.u, dv = sv ? d.v : -d.v;
        const s1 = g[o + du] ? 1 : 0, s2 = g[o + dv] ? 1 : 0, cr = g[o + du + dv] ? 1 : 0, a = s1 && s2 ? 0 : 3 - (s1 + s2 + cr); ao.push(a);
        const b = f * 12 + q * 3, wx = x + X0 + (d.n[0] > 0 ? 1 : 0) + d.du[0] * su + d.dv[0] * sv, wy = y + Y0 + (d.n[1] > 0 ? 1 : 0) + d.du[1] * su + d.dv[1] * sv, wz = z + Z0 + (d.n[2] > 0 ? 1 : 0) + d.du[2] * su + d.dv[2] * sv;
        pos[b] = wx; pos[b + 1] = wy; pos[b + 2] = wz; nor[b] = d.n[0]; nor[b + 1] = d.n[1]; nor[b + 2] = d.n[2];
        const k = AO[a]; colA[b] = rgb[0] * k; colA[b + 1] = rgb[1] * k; colA[b + 2] = rgb[2] * k; colF[b] = rgb[0]; colF[b + 1] = rgb[1]; colF[b + 2] = rgb[2];
      }
      const v0 = f * 4, j = f * 6;   // AO がなめらかに見えるように、四角を分ける向きを選ぶ
      if (ao[0] + ao[2] >= ao[1] + ao[3]) idx.set([v0, v0 + 1, v0 + 2, v0, v0 + 2, v0 + 3], j); else idx.set([v0 + 1, v0 + 2, v0 + 3, v0 + 1, v0 + 3, v0], j);
      f++;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.BufferAttribute(colA, 3)); geo.setIndex(new THREE.BufferAttribute(idx, 1));
  return { geo, colA, colF };
}

// ---- 小さな絵（光のつぶ・グロー・ハート） ----
function spriteTex(draw, n = 64) { const c = document.createElement('canvas'); c.width = c.height = n; draw(c.getContext('2d'), n); const t = new THREE.CanvasTexture(c); return t; }
const glowTex = () => spriteTex((g, n) => { const r = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.35, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, n, n); });
const starTex = () => spriteTex((g, n) => { g.fillStyle = '#fff'; const c = n / 2; g.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? n * .1 : n * .48, a = i / 8 * Math.PI * 2; g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r); } g.closePath(); g.fill(); }, 32);
const heartTex = () => { const t = spriteTex((g, n) => { g.fillStyle = '#FF7FA8'; g.strokeStyle = '#fff'; g.lineWidth = n * .06; const s = n * .3, x = n / 2, y = n / 2; g.beginPath(); g.moveTo(x, y + s * .9); g.bezierCurveTo(x - s * 1.6, y - s * .1, x - s * .7, y - s * 1.4, x, y - s * .5); g.bezierCurveTo(x + s * .7, y - s * 1.4, x + s * 1.6, y - s * .1, x, y + s * .9); g.fill(); g.stroke(); }, 32); t.magFilter = THREE.NearestFilter; return t; };

export const FX = [['toon', 'アニメ塗り'], ['ao', 'すき間の影'], ['beam', '窓からの光'], ['sparkle', '光のつぶ'], ['glow', 'ふんわり光る'], ['heart', 'タップでハート']];

// ---- 表示 ----
// opts：{ stage, objects()（いまの家具の配列を返す）, furn, me, blocked(i,j), onMove(i,j), chara（Promise<canvas>）, engineCanvas, night(), photoSlots, fx, light, onLight(v),
//         模様がえ中の押したもの：onTapFurniture(o), onTapTile(i,j), onTapPhoto(k) }
// 家具は1つずつ別の形（furnGeo）にして、動かしても部屋ぜんたいを作り直さない
const FURN_BOX = f => ({ X0: -4, Y0: -2, Z0: -4, SX: f.w * V + 8, SY: Math.round(200 * CM), SZ: f.d * V + 8 });
const geoCache = new Map();
function furnGeo(f) {
  if (!geoCache.has(f.id)) { const G = grid(FURN_BOX(f)); (M[f.art] || M.gift)(G.pen(CM, 0, 0), f); geoCache.set(f.id, mesh(G, true)); }
  return geoCache.get(f.id);
}
export function mountVoxelRoom(opts) {
  const { stage } = opts; let fx = { ...opts.fx }, light = !!opts.light;
  const cv = document.createElement('canvas'); cv.className = 'hm-iso vox'; stage.append(cv);
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false, alpha: true });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.setPixelRatio(1);
  const scene = new THREE.Scene();

  const G = grid(); const info = buildRoom(G);
  const { geo, colA, colF } = mesh(G);
  const grad = new THREE.DataTexture(new Uint8Array([120, 120, 120, 255, 175, 175, 175, 255, 220, 220, 220, 255]), 3, 1, THREE.RGBAFormat); grad.magFilter = grad.minFilter = THREE.NearestFilter; grad.needsUpdate = true;
  const matL = new THREE.MeshLambertMaterial({ vertexColors: true }), matT = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: grad });
  const room = new THREE.Mesh(geo, matL); room.castShadow = room.receiveShadow = true; scene.add(room);

  // 窓の景色：名所のカードの上のほうを、かべの穴のうしろの板に映す
  const w = info.window, ww = w.x1 - w.x0, wh = w.y1 - w.y0;
  const wtex = new THREE.CanvasTexture(opts.engineCanvas); wtex.magFilter = THREE.NearestFilter; wtex.minFilter = THREE.LinearFilter;
  const ea = opts.engineCanvas.width / (opts.engineCanvas.height * .45), wa = ww / wh;
  wtex.repeat.set(Math.min(1, ea > wa ? wa / ea : 1), .45 * Math.min(1, wa > ea ? ea / wa : 1)); wtex.offset.set((1 - wtex.repeat.x) / 2, 1 - .04 - wtex.repeat.y);
  const wplane = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), new THREE.MeshBasicMaterial({ map: wtex }));
  wplane.position.set(w.x0 + ww / 2, w.y0 + wh / 2, -1.6); scene.add(wplane);

  // 窓からの光：窓の形が床に落ちる明るい場所と、そこまでの光の帯（昼）
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const fz0 = 30, fz1 = 30 + (w.y1 - w.y0) * .9, sh = 22;   // 床の明るい場所（z）と、ずれ（x）
  const beamGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([
    w.x0, w.y0, 0, w.x1, w.y0, 0, w.x1 + sh, .2, fz0, w.x0 + sh, .2, fz0,
    w.x0, w.y1 - 10, 0, w.x1, w.y1 - 10, 0, w.x1 + sh, .2, fz1, w.x0 + sh, .2, fz1], 3)).setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  const beam = new THREE.Mesh(beamGeo, beamMat); beam.renderOrder = 5; scene.add(beam);
  const patchMat = beamMat.clone(); const patch = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([w.x0 + sh, .3, fz0, w.x1 + sh, .3, fz0, w.x1 + sh, .3, fz1, w.x0 + sh, .3, fz1], 3)).setIndex([0, 1, 2, 0, 2, 3]), patchMat); patch.renderOrder = 4; scene.add(patch);

  // 写真（左のかべ）：しろいふちつき
  const photoMeshes = (opts.photoSlots || []).map(s => {
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), new THREE.MeshLambertMaterial({ color: 0xffffff })); pm.rotation.y = Math.PI / 2;
    pm.position.set(.1, s.y + s.h / 2, s.z - s.w / 2); pm.visible = false; pm.receiveShadow = true; scene.add(pm); return pm;
  });
  function setPhotos(imgs) {
    imgs.forEach((im, k) => { const pm = photoMeshes[k]; if (!pm) return; if (!im) { pm.visible = false; slotMarks[k] && (slotMarks[k].visible = edit); return; }
      if (slotMarks[k]) slotMarks[k].visible = false;
      const c = document.createElement('canvas'); c.width = 70; c.height = 90; const g = c.getContext('2d'); g.fillStyle = '#FFFDF8'; g.fillRect(0, 0, 70, 90);
      const iw = 60, ih = 68, sw = im.width, shh = sw * ih / iw; g.imageSmoothingEnabled = false; g.drawImage(im, 0, im.height * .55 - shh / 2, sw, shh, 5, 5, iw, ih);
      g.fillStyle = ['rgba(249,180,200,.9)', 'rgba(195,235,220,.9)', 'rgba(220,200,242,.9)'][k % 3]; g.fillRect(21, 0, 28, 8);
      const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; pm.material.map = t; pm.material.needsUpdate = true; pm.visible = true; });
  }

  // ガーランドの電球（左のかべの上）とグロー
  const GT = glowTex(), bulbCols = [0xFF9AC0, 0xFFE38A, 0xA8E6FF, 0xC9A8FF, 0xA8F0C8];
  const bulbs = Array.from({ length: 18 }, (_, k) => { const z = NV - 8 - k * 10.5, y = WH - 12 - Math.sin(((k % 4) + .5) / 4 * Math.PI) * 5;
    const b = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 2), new THREE.MeshBasicMaterial({ color: bulbCols[k % 5] })); b.position.set(1.5, y, z); scene.add(b);
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: GT, color: bulbCols[k % 5], transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); gl.scale.set(14, 14, 1); gl.position.set(3, y, z); scene.add(gl);
    return { b, gl }; });

  // 光：やわらかいパステルの光と、あたたかい日ざし
  const hemi = new THREE.HemisphereLight(0xfff3f8, 0xffd9c4, .8); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0e0, .5); sun.position.set(NV / 2 + 120, 260, NV / 2 + 70); sun.target.position.set(NV / 2, 0, NV / 2); scene.add(sun, sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -180, right: 180, top: 180, bottom: -180, near: 1, far: 700 }); sun.shadow.bias = -.0006; sun.shadow.radius = 3;
  const roomLight = new THREE.PointLight(0xfff0e6, 0, 400, 1.2); roomLight.position.set(NV * .55, WH + 30, NV * .55); scene.add(roomLight);   // 天井の明かり

  // 家具：1つずつの形。ライトには明かりとグローをつける。sync() で、いまの配置に合わせる
  const furn = new Map();   // o → { mesh, p, gl }
  function sync() {
    const list = opts.objects();
    for (const [o, e] of furn) if (!list.includes(o)) { scene.remove(e.pivot); if (e.p) scene.remove(e.p, e.gl); furn.delete(o); }
    for (const o of list) {
      const f = opts.furn(o.id); let e = furn.get(o);
      if (!e) { const g = furnGeo(f); e = { mesh: new THREE.Mesh(g.geo, fx.toon ? matT : matL), g, pivot: new THREE.Group() }; e.mesh.castShadow = e.mesh.receiveShadow = true; e.mesh.userData.o = o;
        e.mesh.position.set(-f.w * V / 2, 0, -f.d * V / 2); e.pivot.add(e.mesh); scene.add(e.pivot);   // 家具のまん中を軸に回す
        if (f.light) { e.p = new THREE.PointLight(0xffb48a, 0, 150, 2); e.gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: GT, color: 0xffc8a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); e.gl.scale.set(50, 50, 1); scene.add(e.p, e.gl); }
        furn.set(o, e); }
      const dd = opts.dims ? opts.dims(o) : f; e.pivot.position.set((o.i + dd.w / 2) * V, 0, (o.j + dd.d / 2) * V); e.pivot.rotation.y = -(o.r || 0) * Math.PI / 2;
      if (e.p) { e.p.position.set(o.i * V + 10, 140 * CM, o.j * V + 10); e.gl.position.copy(e.p.position); }
    }
  }

  // 光のつぶ（きらきら）：部屋の中をゆっくりのぼる
  const SPN = 70, spPos = new Float32Array(SPN * 3), spCol = new Float32Array(SPN * 3), spSeed = [];
  for (let k = 0; k < SPN; k++) { spSeed.push([Math.random() * NV, Math.random() * WH, Math.random() * NV, Math.random() * 6.28, .3 + Math.random() * .7]); }
  const spGeo = new THREE.BufferGeometry(); spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3)); spGeo.setAttribute('color', new THREE.BufferAttribute(spCol, 3));
  const sparkles = new THREE.Points(spGeo, new THREE.PointsMaterial({ map: starTex(), size: 5, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true })); scene.add(sparkles);

  // ハート（タップしたところから、ふわっとのぼる）
  const HT = heartTex(), hearts = [];
  function popHearts(x, y, z) { if (!fx.heart) return; for (let k = 0; k < 5; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: HT, transparent: true, depthWrite: false })); s.scale.set(11, 11, 1); s.position.set(x, y, z); scene.add(s); hearts.push({ s, t: 0, vx: (Math.random() - .5) * .06, vz: (Math.random() - .5) * .06, d: k * 90 }); } }

  // カメラ：斜め上から（2:1 に近い見え方）
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -800, 1600);
  const C = new THREE.Vector3(NV / 2 - 10, 30, NV / 2 - 10);
  cam.position.set(C.x + 300, C.y + 245, C.z + 300); cam.lookAt(C);

  // キャラ：ドット絵の板。床に影を落とす（いつもカメラのほうを向く）
  //   大きさと光は見比べて決めた（2026-11-25、くりた「3とC」）：背は 180cm（部屋の家具より少し大きめでキャラが主役に見える）、
  //   光は元の色を大事にして、時間帯とでんきの色だけ少し乗せる（部屋の光をそのまま受けると夜に暗く沈むため）
  const CV = { h: 180, lit: 'soft' };
  const CH = CV.h * CM; let chara = null, tex = null;
  const me = { x: opts.me.i + .5, z: opts.me.j + .5, tx: null, tz: null, jump: 0, flip: false };
  const rimmed = c => { const o = document.createElement('canvas'); o.width = c.width + 2; o.height = c.height + 2; const g = o.getContext('2d');
    const m = document.createElement('canvas'); m.width = c.width; m.height = c.height; const mg = m.getContext('2d'); mg.drawImage(c, 0, 0); mg.globalCompositeOperation = 'source-in'; mg.fillStyle = '#FFF6FA'; mg.fillRect(0, 0, c.width, c.height);
    for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2]]) g.drawImage(m, dx, dy); g.drawImage(c, 1, 1); return o; };
  opts.chara.then(c0 => {
    const c = CV.lit === 'rim' ? rimmed(c0) : c0;
    tex = new THREE.CanvasTexture(c); tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.wrapS = THREE.RepeatWrapping;
    const H = CH * c.height / c0.height, mat = CV.lit === 'room' ? new THREE.MeshLambertMaterial({ map: tex, alphaTest: .5, side: THREE.DoubleSide }) : new THREE.MeshBasicMaterial({ map: tex, alphaTest: .5, side: THREE.DoubleSide });
    chara = new THREE.Mesh(new THREE.PlaneGeometry(H * c.width / c.height, H).translate(0, H / 2 - (H - CH) / 2, 0), mat);
    chara.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: .5 });
    chara.castShadow = true; chara.rotation.y = Math.PI / 4; scene.add(chara);
  });
  // 足もとのまるい影（いつも。夜で日ざしの影がなくても浮いて見えないように）
  const footTex = spriteTex((g, n) => { const r = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); r.addColorStop(0, 'rgba(90,40,60,.55)'); r.addColorStop(.6, 'rgba(90,40,60,.3)'); r.addColorStop(1, 'rgba(90,40,60,0)'); g.fillStyle = r; g.fillRect(0, 0, n, n); });
  const foot = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: footTex, transparent: true, depthWrite: false }));
  foot.renderOrder = 3; foot.visible = CV.lit !== 'room'; scene.add(foot);
  // soft・rim：元の色を大事にして、時間帯とでんきの色だけ少し乗せる
  const charaTint = (n, L) => { const day = [1, .98, .96], dark = [.66, .66, .86], lamp = [1, .9, .84], k = n * (L ? .5 : 1), t = L ? lamp : dark; return day.map((d, i) => d + (t[i] - d) * k); };

  // 大きさ：ステージの高さに合わせ、横は少し広く（横にスクロール）。描く1ドット＝画面の1.5px
  //   zoom：部屋を大きく見せる倍率（1＝ステージにぴったり）。大きくすると、たて・よこにスクロールして見わたす
  const SCALE = 1.5; let zoom = opts.zoom || 1;
  function resize() {
    const H0 = stage.clientHeight, H = Math.round(H0 * zoom), W = Math.round(H0 * 1.35 * zoom);
    cv.style.height = H + 'px'; cv.style.width = W + 'px';
    renderer.setSize(Math.round(W / SCALE), Math.round(H / SCALE), false);
    const viewH = 215, viewW = viewH * W / H; Object.assign(cam, { left: -viewW / 2, right: viewW / 2, top: viewH / 2, bottom: -viewH / 2 }); cam.updateProjectionMatrix();
  }
  resize();

  function applyFx() {
    room.material = fx.toon ? matT : matL;
    geo.attributes.color.array.set(fx.ao ? colA : colF); geo.attributes.color.needsUpdate = true;
    for (const g of geoCache.values()) { g.geo.attributes.color.array.set(fx.ao ? g.colA : g.colF); g.geo.attributes.color.needsUpdate = true; }
    for (const e of furn.values()) e.mesh.material = fx.toon ? matT : matL;
  }
  sync(); applyFx();

  // 模様がえ：床のマス目、選んだ家具の足もとの金色の枠、写真の空いた枠
  let edit = false, sel = null;
  const gridPts = []; for (let k = 0; k <= 10; k++) gridPts.push(k * V, .4, 0, k * V, .4, NV, 0, .4, k * V, NV, .4, k * V);
  const gridLines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(gridPts, 3)), new THREE.LineBasicMaterial({ color: 0xe0709a, transparent: true, opacity: .45 }));
  gridLines.visible = false; scene.add(gridLines);
  const selMark = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffc857, transparent: true, opacity: .45, depthWrite: false }));
  selMark.visible = false; selMark.renderOrder = 6; scene.add(selMark);
  const plusTex = spriteTex((g, n) => { g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, 0, n, n); g.strokeStyle = '#E0709A'; g.lineWidth = 4; g.setLineDash([8, 6]); g.strokeRect(3, 3, n - 6, n - 6); g.setLineDash([]); g.fillStyle = '#E0709A'; g.fillRect(n / 2 - 3, n / 4, 6, n / 2); g.fillRect(n / 4, n / 2 - 3, n / 2, 6); }, 64);
  const slotMarks = (opts.photoSlots || []).map(s2 => { const pm = new THREE.Mesh(new THREE.PlaneGeometry(s2.w, s2.h), new THREE.MeshBasicMaterial({ map: plusTex, transparent: true })); pm.rotation.y = Math.PI / 2; pm.position.set(.12, s2.y + s2.h / 2, s2.z - s2.w / 2); pm.visible = false; scene.add(pm); return pm; });
  function showEdit() {
    gridLines.visible = edit; slotMarks.forEach((m2, k) => { m2.visible = edit && !photoMeshes[k].visible; });
    const e = sel && furn.get(sel); selMark.visible = !!e;
    if (e) { const f = opts.dims ? opts.dims(sel) : opts.furn(sel.id); selMark.scale.set(f.w * V, 1, f.d * V); selMark.position.set(sel.i * V + f.w * V / 2, .6, sel.j * V + f.d * V / 2); }
  }

  // さわる：床を押すとそこへ歩く。キャラ・くまを押すとハート、ライトを押すとでんきのオン・オフ
  const ray = new THREE.Raycaster(), floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3(), nd = new THREE.Vector2();
  cv.addEventListener('click', e => {
    const r = cv.getBoundingClientRect(); nd.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(nd, cam);
    // キャラを押したか：画面の上で、足もとから頭までの四角に入っているか
    const onChara = () => { if (!chara) return false; const p0 = new THREE.Vector3(chara.position.x, chara.position.y, chara.position.z).project(cam), p1 = new THREE.Vector3(chara.position.x, chara.position.y + CH, chara.position.z).project(cam);
      const hw = (CH * .2) / ((cam.right - cam.left) / 2); return Math.abs(nd.x - p0.x) < hw && nd.y > p0.y && nd.y < p1.y; };
    const fh = ray.intersectObjects([...furn.values()].map(e => e.mesh))[0], fo = fh?.object.userData.o, ff = fo && opts.furn(fo.id);
    if (edit) {   // 模様がえ：写真の枠 → 家具 → 床のマス
      const ph = ray.intersectObjects([...photoMeshes.filter(m2 => m2.visible), ...slotMarks.filter(m2 => m2.visible)])[0];
      if (ph) { const k = Math.max(photoMeshes.indexOf(ph.object), slotMarks.indexOf(ph.object)); opts.onTapPhoto?.(k); return; }
      if (fo && !(ff.flat && sel)) { opts.onTapFurniture?.(fo); return; }
      if (!ray.ray.intersectPlane(floor, hit)) return; const i = Math.floor(hit.x / V), j = Math.floor(hit.z / V);
      if (i >= 0 && j >= 0 && i < 10 && j < 10) opts.onTapTile?.(i, j); return;
    }
    if (onChara()) { if (!me.jump) me.jump = 1; popHearts(me.x * V, CH * 1.05, me.z * V); return; }
    if (ff?.light) { light = !light; opts.onLight?.(light); return; }
    if (ff?.art === 'bear') { popHearts(fh.point.x, fh.point.y + 10, fh.point.z); return; }
    if (!ray.ray.intersectPlane(floor, hit)) return; const i = Math.floor(hit.x / V), j = Math.floor(hit.z / V);
    if (i < 0 || j < 0 || i >= 10 || j >= 10 || opts.blocked(i, j)) return;
    me.tx = i + .5; me.tz = j + .5; opts.onMove(i, j);
  });

  let raf = 0, last = performance.now();
  function frame(t) {
    raf = requestAnimationFrame(frame); const dt = Math.min(50, t - last); last = t;
    if (me.tx != null) { const dx = me.tx - me.x, dz = me.tz - me.z, d = Math.hypot(dx, dz), sp = .0035 * dt; if (d <= sp) { me.x = me.tx; me.z = me.tz; me.tx = null; } else { me.x += dx / d * sp; me.z += dz / d * sp; if (Math.abs(dx - dz) > .01) me.flip = dx - dz < 0; } }
    if (me.jump > 0) me.jump = Math.max(0, me.jump - dt / 520);
    const bob = me.tx != null ? Math.abs(Math.sin(t / 90)) * 1.5 : Math.sin(t / 700) * .3, jy = me.jump > 0 ? Math.sin(me.jump * Math.PI) * 14 : 0;
    if (chara) { chara.position.set(me.x * V, bob + jy, me.z * V); tex.repeat.x = me.flip ? -1 : 1; tex.offset.x = me.flip ? 1 : 0; }
    // 明るさ：昼（1-n）と夜（n）、でんき（L）
    const n = opts.night(), day = 1 - n, L = light ? 1 : 0;
    foot.position.set(me.x * V, .5, me.z * V); foot.scale.setScalar(CH * .42 * (1 - jy / 40));
    if (chara && (CV.lit === 'soft' || CV.lit === 'rim')) chara.material.color.setRGB(...charaTint(n, L));
    hemi.intensity = .28 + .42 * day + .3 * L * n; sun.intensity = .48 * day;
    hemi.color.setHex(n > .7 ? (L ? 0xffe6dc : 0x9aa0e8) : n > .2 ? 0xffd8d0 : 0xfff3f8); hemi.groundColor.setHex(n > .7 && !L ? 0x504878 : 0xffd9c4);
    roomLight.intensity = .35 * L * n; for (const e of furn.values()) if (e.p) { e.p.intensity = L * (.25 + .6 * n); e.gl.visible = fx.glow && !!L; e.gl.material.opacity = .22 + .18 * n; }
    // 選んだ家具は、ふわふわ上下に動かす
    for (const [o, e] of furn) e.pivot.position.y = o === sel ? 3 + Math.sin(t / 160) * 2 : 0;
    bulbs.forEach(({ b, gl }, k) => { const on = .55 + .45 * Math.sin(t / 500 + k * 1.7); b.material.color.setHex(bulbCols[k % 5]).multiplyScalar(L ? .75 + .25 * on : .8); gl.visible = fx.glow && !!L; gl.material.opacity = (.25 + .35 * n) * on; });
    beam.visible = fx.beam && day > .3; beamMat.opacity = .045 * day;   // 光の帯はごくうすく（床の明るい場所は別に）
    patch.visible = beam.visible; patchMat.opacity = .16 * day;
    sparkles.visible = fx.sparkle;
    if (fx.sparkle) for (let k = 0; k < SPN; k++) { const s = spSeed[k], yy = (s[1] + t * .006 * s[4]) % WH, tw = Math.max(0, Math.sin(t / 380 * s[4] + s[3]));
      spPos[k * 3] = s[0] + Math.sin(t / 1500 + s[3]) * 4; spPos[k * 3 + 1] = yy; spPos[k * 3 + 2] = s[2] + Math.cos(t / 1700 + s[3]) * 4;
      const br = tw * (.45 + .4 * n); spCol[k * 3] = br; spCol[k * 3 + 1] = br * .9; spCol[k * 3 + 2] = br * (n > .5 ? 1 : .8); }
    spGeo.attributes.position.needsUpdate = spGeo.attributes.color.needsUpdate = true;
    for (let k = hearts.length - 1; k >= 0; k--) { const h = hearts[k]; h.t += dt; const a = Math.max(0, h.t - h.d); h.s.visible = a > 0; h.s.position.y += a > 0 ? .045 * dt : 0; h.s.position.x += h.vx * dt; h.s.position.z += h.vz * dt; h.s.material.opacity = Math.max(0, 1 - a / 1300); if (a > 1300) { scene.remove(h.s); h.s.material.dispose(); hearts.splice(k, 1); } }
    wtex.needsUpdate = true;
    renderer.render(scene, cam);
  }
  raf = requestAnimationFrame(frame);
  const onResize = () => resize(); addEventListener('resize', onResize);
  return {
    canvas: cv, setPhotos,
    setFx(v) { fx = { ...v }; applyFx(); },
    setLight(v) { light = !!v; },
    setEdit(v) { edit = !!v; if (!edit) sel = null; showEdit(); },
    setSelected(o) { sel = o || null; showEdit(); },
    sync() { sync(); showEdit(); },
    screenX: () => { const v = new THREE.Vector3(me.x * V, 25, me.z * V).project(cam); return (v.x + 1) / 2; },
    screenY: () => { const v = new THREE.Vector3(me.x * V, 25, me.z * V).project(cam); return (1 - v.y) / 2; },
    // 倍率を変える。見ているまん中がずれないように、スクロールの位置も合わせる
    setZoom(z) { const cx = (stage.scrollLeft + stage.clientWidth / 2) / cv.clientWidth, cy = (stage.scrollTop + stage.clientHeight / 2) / cv.clientHeight;
      zoom = z; resize(); stage.scrollLeft = cx * cv.clientWidth - stage.clientWidth / 2; stage.scrollTop = cy * cv.clientHeight - stage.clientHeight / 2; },
    stop() { cancelAnimationFrame(raf); removeEventListener('resize', onResize); renderer.dispose(); geo.dispose(); matL.dispose(); matT.dispose(); cv.remove(); },
  };
}
