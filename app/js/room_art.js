// マイルームの絵（部屋と家具）：コードで描く（2026-11-25、マイルームは Codex でなくてよいと決まった）
//   女の子らしい部屋：パステルピンクのしまの かべ、明るい木の床、カーテン、ガーランドの電球
//   家具：ベッド・ソファ・まるいテーブル・本だな・ドレッサー・まるいラグ・観葉植物・スタンドライト・くまのぬいぐるみ
//   ドット絵に見えるように、半分の細かさ（S）の絵に描いてから、拡大して使う
export const S = .5;
// ---- 部屋の形（論理の大きさ） ----
export const N = 10, TW = 112, TH = 56, WALL = 300;
export const OX = 20 + N * TW / 2, OY = 40 + WALL;
export const RW = OX * 2, RH = OY + N * TH + 40;
// 床の上の点（x：右のかべにそう向き、y：左のかべにそう向き、z：高さ）→ 画面
export const P = (x, y, z = 0) => [OX + (x - y) * TW / 2, OY + (x + y) * TH / 2 - z];
// かべ：左は左の角から右上へ、右は奥の角から右下へ。u：横の位置、v：床からの高さ
export const LEFT = { x0: OX - N * TW / 2, y0: OY + N * TH / 2, k: -.5 }, RIGHT = { x0: OX, y0: OY, k: .5 };
export const PHOTO_SLOTS = [{ u: 210, v: 150, w: 70, h: 90 }, { u: 300, v: 166, w: 70, h: 90 }, { u: 390, v: 150, w: 70, h: 90 }];
export const WINDOW = { u: 150, v: 110, w: 250, h: 170 };
export const onWall = (g, W, u, v, w, h, draw) => { g.save(); g.transform(1, W.k, 0, 1, W.x0 + u, W.y0 + u * W.k - v - h); draw(w, h); g.restore(); };

const OUT = '#8A5468';   // ふちの色（こいローズ）
const C = {
  white: ['#FFF8F4', '#F2DFDC', '#E5CDCB'], pink: ['#F9B4C8', '#EB93AE', '#DC7F9C'], rose: ['#F48FB0', '#DE7095', '#CC6085'],
  lav: ['#DCC8F2', '#C6AEE4', '#B59CD8'], mint: ['#C3EBDC', '#A8DACA', '#95CBB8'], wood: ['#EDCDA4', '#D8B285', '#C9A174'],
  cream: ['#FFF1D6', '#F2DDB8', '#E6CDA4'], gold: ['#F6D27E', '#E2B95F', '#D2A851'],
};

function poly(g, pts, fill, stroke, lw = 1 / S) { g.beginPath(); pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); } }

// ---- 部屋（かべと床）。bg：いちばん後ろ、front：窓の景色より手前に重ねるもの（窓わく・カーテン） ----
export function buildRoom() {
  const mk = () => { const c = document.createElement('canvas'); c.width = Math.ceil(RW * S); c.height = Math.ceil(RH * S); const g = c.getContext('2d'); g.scale(S, S); return [c, g]; };
  const [bg, g] = mk(), [front, f] = mk();
  const L = P(0, N), R = P(N, 0), B = P(N, N), T = P(0, 0);
  // かべ：ピンクのしま
  for (const [W, a, b, base, stripe] of [[LEFT, L, T, '#F8D3DE', '#F3C2D1'], [RIGHT, T, R, '#FADCE5', '#F5CBD8']]) {
    poly(g, [a, b, [b[0], b[1] - WALL], [a[0], a[1] - WALL]], base);
    const len = N * TW / 2;
    onWall(g, W, 0, 0, len, WALL, (w, h) => {
      g.fillStyle = stripe; for (let u = 10; u < w; u += 36) g.fillRect(u, 0, 14, h);
      // 上のふち（白いモールディング）と、こしかべ
      g.fillStyle = '#FFF4F6'; g.fillRect(0, 0, w, 10); g.fillStyle = '#F2B6C8'; g.fillRect(0, 10, w, 3);
      g.fillStyle = '#FFF0F4'; g.fillRect(0, h - 70, w, 70); g.fillStyle = '#F6D9E2'; for (let u = 0; u < w; u += 28) g.fillRect(u, h - 64, 2, 50);
      g.fillStyle = '#FFFFFF'; g.fillRect(0, h - 72, w, 5); g.fillStyle = '#EBC1CF'; g.fillRect(0, h - 14, w, 14);
    });
  }
  poly(g, [T, [T[0], T[1] - WALL], [T[0], T[1] - WALL + 1]], null, '#E9B7C7');
  g.fillStyle = '#E9B7C7'; g.fillRect(T[0] - 1, T[1] - WALL, 2, WALL);   // かべの角
  // 床：明るい木の板
  poly(g, [T, R, B, L], '#EFD2AE');
  g.strokeStyle = '#DDBB92'; g.lineWidth = 1 / S;
  for (let y = .5; y < N; y += .5) { const [a, b] = [P(0, y), P(N, y)]; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke(); }
  for (let y = 0; y < N; y += .5) for (let x = ((y * 2) % 3) * .7 + .4; x < N; x += 2.1) { const a = P(x, y), b = P(x, y + .5); g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,.18)'; for (let k = 0; k < 40; k++) { const x = (k * 37 % 97) / 9.7, y = (k * 53 % 89) / 8.9, [px, py] = P(x, y); g.fillRect(px, py, 6, 2); }
  // 床の厚み
  poly(g, [L, B, [B[0], B[1] + 14], [L[0], L[1] + 14]], '#C99E86'); poly(g, [B, R, [R[0], R[1] + 14], [B[0], B[1] + 14]], '#B88C76');
  // かべのかざり：右のかべにハートのかざりとカレンダー、左のかべに小さな棚
  onWall(g, RIGHT, 452, 150, 70, 64, (w, h) => { heart(g, w / 2, h / 2 + 4, 30, '#F48FB0', OUT); heart(g, w / 2, h / 2 + 2, 18, '#FFD3E0'); });
  onWall(g, LEFT, 60, 120, 110, 14, (w, h) => { g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, w, 8); g.fillStyle = '#E6C9D2'; g.fillRect(0, 8, w, 6); });
  onWall(g, LEFT, 68, 134, 24, 30, (w, h) => { g.fillStyle = '#C3EBDC'; g.fillRect(0, 6, w, h - 6); g.fillStyle = '#8CC9A0'; g.beginPath(); g.arc(w / 2, 6, 11, 0, Math.PI * 2); g.fill(); });
  onWall(g, LEFT, 104, 134, 16, 22, (w, h) => { g.fillStyle = '#F9B4C8'; g.fillRect(0, 0, w, h); g.fillStyle = '#FFF8F4'; g.fillRect(4, 4, w - 8, 6); });
  onWall(g, LEFT, 128, 134, 30, 18, (w, h) => { g.fillStyle = '#DCC8F2'; g.fillRect(0, 0, w, h); g.fillStyle = '#B59CD8'; g.fillRect(0, h - 4, w, 4); });

  // 窓わくとカーテン（front）
  const Wn = WINDOW;
  onWall(f, RIGHT, Wn.u - 10, Wn.v - 10, Wn.w + 20, Wn.h + 20, (w, h) => {
    f.fillStyle = '#FFFFFF'; f.fillRect(0, 0, w, 10); f.fillRect(0, h - 14, w, 14); f.fillRect(0, 0, 10, h); f.fillRect(w - 10, 0, 10, h);
    f.fillRect(w / 2 - 4, 0, 8, h); f.fillRect(0, h / 2 - 4, w, 8);
    f.fillStyle = '#EED6DE'; f.fillRect(0, h - 4, w, 4);
  });
  onWall(f, RIGHT, Wn.u - 44, Wn.v - 30, Wn.w + 88, Wn.h + 54, (w, h) => {
    // カーテン：左右にたばねたピンクのカーテン
    for (const side of [0, 1]) {
      f.save(); if (side) { f.translate(w, 0); f.scale(-1, 1); }
      f.beginPath(); f.moveTo(0, 22); f.lineTo(70, 22); f.quadraticCurveTo(40, h * .55, 52, h * .6); f.quadraticCurveTo(30, h * .8, 46, h); f.lineTo(0, h); f.closePath();
      f.fillStyle = '#F7A9C0'; f.fill(); f.strokeStyle = OUT; f.lineWidth = 2; f.stroke();
      f.strokeStyle = '#E58AA6'; f.lineWidth = 3; for (const x of [14, 28, 40]) { f.beginPath(); f.moveTo(x, 26); f.quadraticCurveTo(x - 4, h * .6, x * .7, h - 2); f.stroke(); }
      f.fillStyle = '#FFF4F6'; f.fillRect(4, h * .6 - 6, 48, 10); f.fillStyle = '#F6D27E'; f.fillRect(4, h * .6 - 2, 48, 3);   // たばねるリボン
      f.restore();
    }
    // 上の飾り（フリルのバランス）
    f.fillStyle = '#FBC6D5'; f.fillRect(0, 0, w, 24); f.strokeStyle = OUT; f.lineWidth = 2; f.strokeRect(0, 0, w, 24);
    f.fillStyle = '#FBC6D5'; for (let x = 0; x < w; x += 18) { f.beginPath(); f.arc(x + 9, 24, 9, 0, Math.PI); f.fill(); f.stroke(); }
    f.fillStyle = '#FFFFFF'; for (let x = 6; x < w; x += 18) f.fillRect(x, 8, 6, 6);
    f.fillStyle = '#C9B78F'; f.fillRect(-8, -6, w + 16, 6);   // カーテンレール
  });
  return { bg, front };
}

// ガーランドの電球（左のかべの上）。毎回描いて、ちかちか光らせる（演出）
export const BULBS = Array.from({ length: 13 }, (_, k) => { const u = 30 + k * 40, v = 252 - Math.sin(((k % 4) + .5) / 4 * Math.PI) * 18; return { u, v, c: ['#FF9AC0', '#FFE38A', '#A8E6FF', '#C9A8FF', '#A8F0C8'][k % 5] }; });
export function drawGarland(g, t, night) {
  onWall(g, LEFT, 0, 0, N * TW / 2, WALL, (w, h) => {
    g.strokeStyle = '#8A6A5A'; g.lineWidth = 1.5; g.beginPath();
    BULBS.forEach((b, k) => { const y = h - b.v; k ? g.lineTo(b.u, y) : g.moveTo(b.u, y); }); g.stroke();
    BULBS.forEach((b, k) => {
      const y = h - b.v, on = .55 + .45 * Math.sin(t / 500 + k * 1.7);
      if (night) { const r = g.createRadialGradient(b.u, y + 6, 0, b.u, y + 6, 22); r.addColorStop(0, b.c + 'AA'); r.addColorStop(1, b.c + '00'); g.globalAlpha = on * night; g.fillStyle = r; g.fillRect(b.u - 22, y - 16, 44, 44); g.globalAlpha = 1; }
      g.fillStyle = b.c; g.globalAlpha = .65 + .35 * on; g.fillRect(b.u - 4, y + 2, 8, 10); g.globalAlpha = 1; g.fillStyle = '#6A5A50'; g.fillRect(b.u - 3, y - 1, 6, 4);
    });
  });
}

function heart(g, x, y, s, fill, stroke) {
  g.beginPath(); g.moveTo(x, y + s * .55);
  g.bezierCurveTo(x - s * 1.1, y - s * .1, x - s * .55, y - s * .9, x, y - s * .35);
  g.bezierCurveTo(x + s * .55, y - s * .9, x + s * 1.1, y - s * .1, x, y + s * .55); g.closePath();
  g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = 2; g.stroke(); }
}

// ---- 家具 ----
// 箱：見える3つの面（上・手前左・手前右）を描く
function box(g, q, x0, y0, z0, x1, y1, z1, [top, left, right], line = true) {
  const o = line ? OUT : null;
  poly(g, [q(x0, y1, z0), q(x1, y1, z0), q(x1, y1, z1), q(x0, y1, z1)], left, o);
  poly(g, [q(x1, y0, z0), q(x1, y1, z0), q(x1, y1, z1), q(x1, y0, z1)], right, o);
  poly(g, [q(x0, y0, z1), q(x1, y0, z1), q(x1, y1, z1), q(x0, y1, z1)], top, o);
}
// 面の上に描くための座標：faceX＝x が一定の面（手前右の面）、faceY＝y が一定の面（手前左の面）。u はマス、v は高さ
const faceX = (g, q, x) => { const [e, f] = q(x, 0, 0); g.transform(-TW / 2, TH / 2, 0, -1, e, f); };
const faceY = (g, q, y) => { const [e, f] = q(0, y, 0); g.transform(TW / 2, TH / 2, 0, -1, e, f); };
// まるい形（床と平行）：中心 (x,y,z)、半径 r マス
function disc(g, q, x, y, z, r, fill, stroke) { const [cx, cy] = q(x, y, z); g.beginPath(); g.ellipse(cx, cy, r * TW / Math.SQRT2, r * TH / Math.SQRT2, 0, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1 / S; g.stroke(); } }
function cyl(g, q, x, y, z0, z1, r, [top, side]) {
  const [cx, c0] = q(x, y, z0), [, c1] = q(x, y, z1), rx = r * TW / Math.SQRT2, ry = r * TH / Math.SQRT2;
  g.beginPath(); g.ellipse(cx, c0, rx, ry, 0, 0, Math.PI); g.lineTo(cx - rx, c1); g.ellipse(cx, c1, rx, ry, 0, Math.PI, 0, true); g.closePath(); g.fillStyle = side; g.fill(); g.strokeStyle = OUT; g.lineWidth = 1 / S; g.stroke();
  disc(g, q, x, y, z1, r, top, OUT);
}

const ART = {
  bed(g, q) {   // 3×2マス。頭は x＝0（左のかべ）側
    box(g, q, 0, 0, 0, 3, 2, 16, C.white);                                    // わく
    box(g, q, .06, .06, 16, 2.94, 1.94, 30, C.cream);                          // マットレス
    box(g, q, 0, 0, 0, .16, 2, 92, C.white);                                   // ヘッドボード
    const [hx, hy] = q(.16, 1, 66); heart(g, hx + 2, hy, 16, '#F48FB0', OUT);
    for (const y0 of [.14, 1.04]) box(g, q, .24, y0, 30, .82, y0 + .82, 44, C.lav);   // まくら
    box(g, q, 1.05, -.03, 20, 3.03, 2.03, 36, C.pink);                         // 掛けぶとん
    g.save(); faceY(g, q, 2.03); g.fillStyle = '#FFF8F4'; for (let u = 1.2; u < 3; u += .22) g.fillRect(u, 25, .06, 5); g.restore();   // 面の上は u がマスの単位なので、点は細い四角で
    g.save(); faceX(g, q, 3.03); g.fillStyle = '#FFF8F4'; for (let u = .1; u < 2; u += .22) g.fillRect(u, 25, .06, 5); g.restore();
    const [cx, cy] = q(1.5, 1, 46); heart(g, cx, cy - 6, 14, '#FFFFFF', OUT);   // ハートのクッション
  },
  sofa(g, q) {
    box(g, q, 0, 0, 0, 3, 1, 20, C.rose);
    box(g, q, 0, 0, 20, 3, .32, 62, C.pink);                                   // せもたれ
    box(g, q, 0, 0, 20, .3, 1, 40, C.pink);                                    // ひじかけ（左）
    for (let k = 0; k < 2; k++) box(g, q, .32 + k * 1.2, .34, 20, 1.5 + k * 1.2, .98, 30, C.pink);   // 座面
    const [cx, cy] = q(1.6, .5, 40); heart(g, cx, cy - 6, 13, '#FFF8F4', OUT);
    box(g, q, 2.7, 0, 20, 3, 1, 40, C.pink);                                   // ひじかけ（右）
  },
  table(g, q) {
    cyl(g, q, .5, .5, 0, 6, .22, ['#FFFFFF', '#E5CDCB']);
    box(g, q, .46, .46, 6, .54, .54, 20, C.white);
    cyl(g, q, .5, .5, 20, 26, .44, ['#FFF8F4', '#F2DFDC']);
    // ケーキとティーカップ
    cyl(g, q, .38, .45, 26, 34, .1, ['#FFF1D6', '#F9B4C8']); const [kx, ky] = q(.38, .45, 34); g.fillStyle = '#E8475C'; g.fillRect(kx - 2, ky - 6, 4, 4);
    cyl(g, q, .64, .6, 26, 32, .06, ['#C3EBDC', '#FFFFFF']);
  },
  shelf(g, q) {
    box(g, q, 0, 0, 0, 1, 2, 150, C.white);
    g.save(); faceX(g, q, 1);
    g.fillStyle = '#F2D7DE'; g.fillRect(.1, 10, 1.8, 132);
    const cols = ['#F48FB0', '#DCC8F2', '#A8DACA', '#F6D27E', '#A8C8F0', '#F9B4C8'];
    for (const [k, z] of [10, 54, 98].entries()) {
      g.fillStyle = '#FFF8F4'; g.fillRect(.1, z, 1.8, 4);
      let u = .14; for (let n = 0; u < 1.8 && n < 12; n++) { const bw = .07 + ((n * 7 + k) % 3) * .03, bh = 26 + ((n * 5 + k * 3) % 4) * 4; g.fillStyle = cols[(n + k * 2) % cols.length]; g.fillRect(u, z + 4, bw, bh); u += bw + .015; if (n === 5 + k) u += .2; }
    }
    g.fillStyle = '#FFF8F4'; g.fillRect(.1, 142, 1.8, 4);
    g.restore();
    const [px, py] = q(.5, 1.5, 150); g.fillStyle = '#C3EBDC'; g.fillRect(px - 8, py - 14, 16, 14); g.fillStyle = '#8CC9A0'; g.beginPath(); g.arc(px, py - 20, 10, 0, Math.PI * 2); g.fill();   // 上の小さな鉢
  },
  vanity(g, q) {
    // かがみ（かべ側）
    const [mx, my] = q(1, .12, 116); g.beginPath(); g.ellipse(mx, my, 42, 54, 0, 0, Math.PI * 2); g.fillStyle = '#F9B4C8'; g.fill(); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke();
    g.beginPath(); g.ellipse(mx, my, 32, 44, 0, 0, Math.PI * 2); g.fillStyle = '#D6ECF7'; g.fill(); g.fillStyle = '#FFFFFF'; g.fillRect(mx - 14, my - 26, 5, 22); g.fillRect(mx - 6, my - 30, 4, 10);
    heart(g, mx, my - 58, 10, '#F48FB0', OUT);
    box(g, q, 0, 0, 0, 2, 1, 64, C.white);
    g.save(); faceY(g, q, 1);   // ひきだし（線は細い四角で。u はマスの単位）
    for (const [u0, u1] of [[.1, .95], [1.05, 1.9]]) for (const v0 of [12, 36]) {
      g.fillStyle = '#E5BFC8'; g.fillRect(u0, v0, u1 - u0, 2); g.fillRect(u0, v0 + 18, u1 - u0, 2); g.fillRect(u0, v0, .03, 20); g.fillRect(u1 - .03, v0, .03, 20);
      g.fillStyle = '#F6D27E'; g.fillRect((u0 + u1) / 2 - .04, v0 + 8, .08, 4);
    }
    g.restore();
    cyl(g, q, .4, .5, 64, 76, .07, ['#DCC8F2', '#C6AEE4']); cyl(g, q, .6, .55, 64, 72, .06, ['#F9B4C8', '#EB93AE']);   // 香水のびん
    box(g, q, 1.3, .3, 64, 1.7, .7, 70, C.gold);
  },
  rug(g, q, w) {
    const r = w / 2 - .08, c = w / 2;
    const [cx, cy] = q(c, c, 0), rx = r * TW / Math.SQRT2, ry = r * TH / Math.SQRT2;
    g.fillStyle = '#F7B9CC'; for (let a = 0; a < Math.PI * 2; a += Math.PI / 14) { g.beginPath(); g.ellipse(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, 9, 5, 0, 0, Math.PI * 2); g.fill(); }
    disc(g, q, c, c, 0, r, '#F9C6D5', OUT); disc(g, q, c, c, 0, r * .74, '#FFE3EB'); disc(g, q, c, c, 0, r * .5, '#F9C6D5');
    const [hx, hy] = q(c, c, 0); heart(g, hx, hy, 12, '#FFFFFF');
  },
  plant(g, q, w, big) {
    const s = big ? 1.3 : 1;
    cyl(g, q, .5, .5, 0, 26 * s, .2, ['#C9876C', '#F0B69C']);
    const [cx, cy] = q(.5, .5, 26 * s); const leaves = [[0, -40, 16], [-14, -26, 14], [14, -28, 14], [-8, -54, 12], [10, -52, 12], [0, -66, 10], [-20, -44, 10], [20, -42, 10]];
    for (const [dx, dy, r] of leaves) { g.beginPath(); g.ellipse(cx + dx * s, cy + dy * s, r * s, r * .7 * s, dx * .02, 0, Math.PI * 2); g.fillStyle = dx > 0 ? '#7CC296' : '#8FD0A6'; g.fill(); g.strokeStyle = '#4E8A64'; g.lineWidth = 1.5; g.stroke(); }
  },
  lamp(g, q) {
    cyl(g, q, .5, .5, 0, 6, .2, ['#FFF8F4', '#E5CDCB']);
    box(g, q, .47, .47, 6, .53, .53, 104, C.gold, false);
    const [cx, c0] = q(.5, .5, 100), [, c1] = q(.5, .5, 132);
    g.beginPath(); g.moveTo(cx - 30, c0); g.lineTo(cx - 18, c1); g.lineTo(cx + 18, c1); g.lineTo(cx + 30, c0); g.closePath(); g.fillStyle = '#FFD3E0'; g.fill(); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#F48FB0'; g.fillRect(cx - 30, c0 - 4, 60, 4);
  },
  bear(g, q) {
    const [cx, cy] = q(.5, .5, 0), br = '#D9A577', dk = '#B8845A', OUTB = '#6A4A36';
    const ell = (x, y, rx, ry, c) => { g.beginPath(); g.ellipse(cx + x, cy + y, rx, ry, 0, 0, Math.PI * 2); g.fillStyle = c; g.fill(); g.strokeStyle = OUTB; g.lineWidth = 2; g.stroke(); };
    g.fillStyle = 'rgba(0,0,0,.15)'; g.beginPath(); g.ellipse(cx, cy, 26, 10, 0, 0, Math.PI * 2); g.fill();
    ell(-16, -6, 9, 7, br); ell(16, -6, 9, 7, br);                 // 足
    ell(0, -24, 20, 20, br); ell(0, -20, 11, 10, '#F2D4B0');         // からだ
    ell(-21, -30, 7, 9, br); ell(21, -30, 7, 9, br);               // 手
    ell(-14, -64, 8, 8, br); ell(14, -64, 8, 8, br); ell(-14, -64, 4, 4, '#F2B8A0'); ell(14, -64, 4, 4, '#F2B8A0');   // 耳
    ell(0, -52, 17, 15, br); ell(0, -47, 8, 6, '#F2D4B0');           // 顔
    g.fillStyle = OUTB; g.fillRect(cx - 8, cy - 56, 3, 4); g.fillRect(cx + 5, cy - 56, 3, 4); g.fillRect(cx - 2, cy - 50, 4, 3);
    g.fillStyle = '#F48FB0'; g.beginPath(); g.moveTo(cx, cy - 37); g.lineTo(cx - 10, cy - 42); g.lineTo(cx - 10, cy - 32); g.closePath(); g.moveTo(cx, cy - 37); g.lineTo(cx + 10, cy - 42); g.lineTo(cx + 10, cy - 32); g.closePath(); g.fill();
  },
  gift(g, q) {   // ご当地アイテム：絵ができるまでリボンのついた箱で
    box(g, q, .22, .22, 0, .78, .78, 30, C.lav);
    g.save(); faceY(g, q, .78); g.fillStyle = '#F48FB0'; g.fillRect(.46, 0, .1, 30); g.restore();
    g.save(); faceX(g, q, .78); g.fillStyle = '#F48FB0'; g.fillRect(.46, 0, .1, 30); g.restore();
    const [cx, cy] = q(.5, .5, 30); g.fillStyle = '#F48FB0'; g.beginPath(); g.ellipse(cx - 7, cy - 4, 7, 5, -.4, 0, Math.PI * 2); g.ellipse(cx + 7, cy - 4, 7, 5, .4, 0, Math.PI * 2); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.5; g.stroke();
  },
  frame(g, q) { box(g, q, .3, .35, 0, .7, .65, 10, C.white); const [cx, cy] = q(.5, .5, 10); g.fillStyle = '#F9B4C8'; g.fillRect(cx - 12, cy - 34, 24, 30); g.strokeStyle = OUT; g.lineWidth = 2; g.strokeRect(cx - 12, cy - 34, 24, 30); g.fillStyle = '#D6ECF7'; g.fillRect(cx - 8, cy - 30, 16, 22); },
  poster(g, q) { const [cx, cy] = q(.5, .5, 0); g.strokeStyle = '#C9A174'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 14, cy); g.lineTo(cx - 6, cy - 70); g.moveTo(cx + 14, cy); g.lineTo(cx + 6, cy - 70); g.stroke(); g.fillStyle = '#FFF1D6'; g.fillRect(cx - 20, cy - 74, 40, 50); g.strokeStyle = OUT; g.lineWidth = 2; g.strokeRect(cx - 20, cy - 74, 40, 50); g.fillStyle = '#A8C8F0'; g.fillRect(cx - 16, cy - 70, 32, 18); g.fillStyle = '#8CC9A0'; g.fillRect(cx - 16, cy - 52, 32, 8); g.fillStyle = '#F48FB0'; g.fillRect(cx - 10, cy - 40, 20, 4); },
  tlamp(g, q) { cyl(g, q, .5, .5, 0, 8, .16, ['#FFF8F4', '#E5CDCB']); box(g, q, .47, .47, 8, .53, .53, 24, C.gold, false); const [cx, c0] = q(.5, .5, 22), [, c1] = q(.5, .5, 42); g.beginPath(); g.moveTo(cx - 20, c0); g.lineTo(cx - 12, c1); g.lineTo(cx + 12, c1); g.lineTo(cx + 20, c0); g.closePath(); g.fillStyle = '#DCC8F2'; g.fill(); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke(); },
  globe(g, q) { cyl(g, q, .5, .5, 0, 6, .18, ['#F6D27E', '#E2B95F']); box(g, q, .48, .48, 6, .52, .52, 18, C.gold, false); const [cx, cy] = q(.5, .5, 38); g.beginPath(); g.arc(cx, cy, 20, 0, Math.PI * 2); g.fillStyle = '#A8C8F0'; g.fill(); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke(); g.fillStyle = '#8CC9A0'; g.beginPath(); g.ellipse(cx - 6, cy - 4, 8, 6, .5, 0, Math.PI * 2); g.ellipse(cx + 8, cy + 6, 6, 4, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#E2B95F'; g.beginPath(); g.arc(cx, cy, 24, -2.2, 1); g.stroke(); },
  trunk(g, q) { box(g, q, .1, .2, 0, 1.9, .8, 36, C.rose); g.save(); faceY(g, q, .8); g.fillStyle = '#C9A174'; g.fillRect(.5, 0, .12, 36); g.fillRect(1.4, 0, .12, 36); g.fillStyle = '#F6D27E'; g.fillRect(.95, 22, .12, 8); g.restore(); const [cx, cy] = q(1, .5, 36); g.strokeStyle = '#C9A174'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, 8, Math.PI, 0); g.stroke(); },
};

// 家具の絵を半分の細かさの小さなキャンバスに描いておく（id ごとに1回）。ox, oy：家具の奥の角が、絵のどこに来るか（論理の大きさ）
const cache = new Map();
export function furnSprite(f) {
  if (cache.has(f.id)) return cache.get(f.id);
  const m = 40, top = f.h + 140, ox = f.d * TW / 2 + m, oy = top;
  const W = (f.w + f.d) * TW / 2 + m * 2, H = top + (f.w + f.d) * TH / 2 + m;
  const c = document.createElement('canvas'); c.width = Math.ceil(W * S); c.height = Math.ceil(H * S);
  const g = c.getContext('2d'); g.scale(S, S); g.lineJoin = 'round';
  const q = (x, y, z = 0) => [ox + (x - y) * TW / 2, oy + (x + y) * TH / 2 - z];
  (ART[f.art] || ART.gift)(g, q, f.w, f.big);
  const sp = { c, ox, oy, W, H }; cache.set(f.id, sp); return sp;
}
