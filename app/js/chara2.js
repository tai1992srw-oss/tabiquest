// 新しいキャラ（2026-11-26 作り替え）：正面向きの立ち1つを、部品とアンカーで組み立てる
//   部品：輪郭（頭）・目・まゆ・口（鼻つき）・ほお・前髪・後ろ髪・服。体は共通。絵とアンカーは assets/chara2/（元は dot/chara_parts/。キャラのセッションが書き出す）
//   絵は描き足さない。部品を、アンカーが決まった位置に来るように置いて重ねるだけ
//   見た目（look）：{ rin, eye, brow, mouth, cheek, hairF, hairB, wear：部品の出どころの id（'c1' など。cheek・wear は '' ＝ なし）,
//                    v：{ eyeGap 目のはば, eyeY 目の高さ, browDy 目からまゆまで, mouthY 口の高さ, cheekGap・cheekDy ほお, hairDy 髪の高さ } }
//   v のはじめの値は、輪郭ごとのプリセット（parts.json の chars.<id>.preset）。単位はドット
//   前のキャラ（ななめ向き・6ポーズ・色変え）は archive/chara-v1/ と、git のタグ chara-v1
import { settings } from './store.js';
const THREE = window.THREE;
const BASE = 'assets/chara2/';
export const SLOTS = [['rin', '輪郭'], ['eye', '目'], ['brow', 'まゆ'], ['mouth', '口'], ['cheek', 'ほお'], ['hairF', '前髪'], ['hairB', '後ろ髪'], ['wear', '服']];
export const NONE = { cheek: 'なし', wear: 'インナー' };   // 「なし」をえらべる部品
// 動かせる値：[名前, 画面の名前, 下限, 上限, 説明]
export const VALS = [
  ['eyeGap', '目のはば', 14, 44, '左右の目のまん中どうしの間'], ['eyeY', '目の高さ', 72, 98, '小さいほど上'], ['browDy', 'まゆの高さ', -26, -8, '目からまゆまで。小さいほど目からはなれる'],
  ['mouthY', '口の高さ', 92, 112, '小さいほど上'], ['cheekGap', 'ほおのはば', 14, 56, '左右のほおの赤みの間'], ['cheekDy', 'ほおの高さ', 2, 20, '目からほおまで。大きいほど下'],
  ['hairDy', '髪の高さ', -12, 12, '輪郭の頭のてっぺんに合わせた位置から。小さいほど上'],
];
// カードの中のコマ：前のキャラと同じ 272×376（足もとが下から1行め）。新しい絵（256×384・足もと 371 行）を、足もとをそろえて入れる
export const FRAME = [272, 376], OFF = [8, 4];

let parts = null;
const image = src => new Promise((ok, ng) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ng(new Error(src)); i.src = src; });
export function loadParts() {
  return parts || (parts = (async () => {
    const J = await (await fetch(BASE + 'parts.json')).json(), IM = { body: await image(BASE + J.body) }, ids = Object.keys(J.chars);
    await Promise.all(ids.flatMap(c => { IM[c] = {}; return ['rinkaku', 'hair_front', 'hair_back', 'wear', 'wear_hide', ...Object.keys(J.chars[c].pieces)].map(async n => { IM[c][n] = await image(`${BASE}${c}/${n}.png`); }); }));
    return { J, IM, ids, cache: new Map(), tex: new Map(), hair: new Map() };
  })().catch(e => { parts = null; throw e; }));
}
// はじめの見た目：最初の子（1つめの id）の部品とバランス
export const firstLook = P => ({ ...Object.fromEntries(SLOTS.map(([k]) => [k, P.ids[0]])), v: { ...P.J.chars[P.ids[0]].preset } });
// 見た目をととのえる（前のキャラの見た目や、欠けた項目は、はじめの見た目で埋める）
export function fixLook(P, L) {
  const d = firstLook(P); if (!L || !P.J.chars[L.rin]) return d;
  const o = { v: { ...P.J.chars[L.rin].preset, ...(L.v || {}) } };
  for (const [k] of SLOTS) o[k] = P.J.chars[L[k]] ? L[k] : (NONE[k] && L[k] === '' ? '' : d[k]);
  if (o.cheek && !P.J.chars[o.cheek].pieces.cheekL) o.cheek = '';
  return o;
}
// ふだんの見た目（ホームのお着替え）と、そのカードの見た目（カードに残してあればそれ）
export const homeLook = P => fixLook(P, settings.chara2);
export const lookOf = (P, st) => (st?.look?.rin ? fixLook(P, st.look) : homeLook(P));
export const has = (P, k, c) => k !== 'cheek' || !!P.J.chars[c].pieces.cheekL;
export const itemName = (P, k, c) => (c === '' ? NONE[k] : k === 'wear' ? P.J.chars[c].wear : k === 'rin' ? `${P.J.chars[c].name}（${P.J.chars[c].rin}）` : P.J.chars[c].name);

// 髪を、輪郭の大きさに合わせる：その髪が描かれたときの頭（横はば headW・てっぺん〜あご）と、えらんだ輪郭の頭をくらべて、
//   頭のてっぺんのまん中（アンカー）を軸に、横とたてを伸び縮みさせる。ドット絵なので、1マスを 3×3 に見て、多い色を取る（こい線は 4つ以上あれば優先）
//   同じ大きさ（同じ輪郭用の髪）のときは、元の絵のまま。返り値：256×384 のキャンバス（アンカーの位置は元のまま）
function fitHair(P, id, name, rin) {
  const C = P.J.chars[id], R = P.J.chars[rin], a = C.hair?.[name] || { ax: C.cx, ay: C.headTop, headW: C.headW }, im = P.IM[id][name];
  const sx = R.headW / (a.headW || C.headW), sy = (R.chin - R.headTop) / (C.chin - C.headTop);
  if (Math.abs(sx - 1) < .02 && Math.abs(sy - 1) < .02) return im;
  const key = `${id}/${name}/${rin}`; if (P.hair.has(key)) return P.hair.get(key);
  const [W, H] = P.J.size, t = document.createElement('canvas'); t.width = W; t.height = H; const tx = t.getContext('2d', { willReadFrequently: true }); tx.drawImage(im, 0, 0);
  const src = new Uint32Array(tx.getImageData(0, 0, W, H).data.buffer), out = new ImageData(W, H), dst = new Uint32Array(out.data.buffer), OF = [1 / 6, .5, 5 / 6], cnt = new Map();
  const dark = v => (v & 255) + ((v >> 8) & 255) + ((v >> 16) & 255) < 300;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    cnt.clear(); let solid = 0;
    for (const oy of OF) { const yy = Math.floor((y + oy - a.ay) / sy + a.ay); if (yy < 0 || yy >= H) continue;
      for (const ox of OF) { const xx = Math.floor((x + ox - a.ax - .5) / sx + a.ax + .5); if (xx < 0 || xx >= W) continue; const v = src[yy * W + xx]; if ((v >>> 24) < 128) continue; solid++; cnt.set(v, (cnt.get(v) || 0) + 1); } }
    if (solid < 5) continue;
    let best = 0, bn = 0, bd = 0, dn = 0; for (const [v, n] of cnt) { if (n > bn) { bn = n; best = v; } if (n >= 4 && dark(v) && n > dn) { dn = n; bd = v; } }
    dst[y * W + x] = dn ? bd : best;
  }
  tx.putImageData(out, 0, 0); P.hair.set(key, t); return t;
}

// 見た目 L の立ち絵（256×384 のキャンバス）。同じ見た目は使い回す
export function compose(P, L) {
  const key = JSON.stringify(L); if (P.cache.has(key)) return P.cache.get(key);
  const { J, IM } = P, [W, H] = J.size, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true }), v = L.v, R = J.chars[L.rin];
  const put = (im, p, tx, ty) => x.drawImage(im, p.x + Math.round(tx - p.ax), p.y + Math.round(ty - p.ay));   // 部品を、アンカーが (tx, ty) に来るように置く
  const mean = (Q, k) => (Q[k + 'L'].ay + Q[k + 'R'].ay) / 2;
  // 髪：輪郭の大きさに合わせて伸び縮みさせ（fitHair）、その髪が描かれたときの頭のてっぺんを、えらんだ輪郭のてっぺんに合わせる
  const hy = (k, n) => R.headTop - (J.chars[L[k]].hair?.[n]?.ay ?? J.chars[L[k]].headTop) + v.hairDy;
  // 重ねる順：後ろ髪 → 体・輪郭（服でかくす所をのぞく）→ 服 → 前髪 → ほお → 目 → まゆ → 鼻・口
  x.drawImage(fitHair(P, L.hairB, 'hair_back', L.rin), 0, hy('hairB', 'hair_back'));
  const b = document.createElement('canvas'); b.width = W; b.height = H; const bx = b.getContext('2d'); bx.drawImage(IM.body, 0, 0); bx.drawImage(IM[L.rin].rinkaku, 0, 0);
  if (L.wear) { bx.globalCompositeOperation = 'destination-out'; bx.drawImage(IM[L.wear].wear_hide, 0, 0); }
  x.drawImage(b, 0, 0); if (L.wear) x.drawImage(IM[L.wear].wear, 0, 0);
  x.drawImage(fitHair(P, L.hairF, 'hair_front', L.rin), 0, hy('hairF', 'hair_front'));
  // 顔の部品は、輪郭のまん中から左右に同じだけはなす。左右の高さのちがい（元の絵のかたむき）は残す
  const cx = Math.round(R.cx), half = g => { const l = cx - Math.floor(g / 2); return { L: l, R: l + g }; };
  if (L.cheek) { const Q = J.chars[L.cheek].pieces, X = half(v.cheekGap); for (const s of ['L', 'R']) put(IM[L.cheek]['cheek' + s], Q['cheek' + s], X[s], v.eyeY + v.cheekDy + (Q['cheek' + s].ay - mean(Q, 'cheek'))); }
  const E = J.chars[L.eye].pieces, EX = half(v.eyeGap), B = J.chars[L.brow].pieces;
  for (const s of ['L', 'R']) {
    put(IM[L.eye]['eye' + s], E['eye' + s], EX[s], v.eyeY + (E['eye' + s].ay - mean(E, 'eye')));
    put(IM[L.brow]['brow' + s], B['brow' + s], EX[s] + (B['brow' + s].ax - B['eye' + s].ax), v.eyeY + v.browDy + (B['brow' + s].ay - mean(B, 'brow')));
  }
  const M = J.chars[L.mouth], MP = M.pieces;
  if (MP.nose) put(IM[L.mouth].nose, MP.nose, cx + (MP.nose.ax - M.cx), MP.nose.ay + ((v.eyeY - M.preset.eyeY) + (v.mouthY - M.preset.mouthY)) / 2);   // 鼻は、目と口のあいだに付いて動く
  put(IM[L.mouth].mouth, MP.mouth, cx + (MP.mouth.ax - M.cx), v.mouthY);
  if (P.cache.size > 60) P.cache.delete(P.cache.keys().next().value);
  P.cache.set(key, c); return c;
}
// 切り出す場所：顔（輪郭のまわり）と全身。[x, y, w, h]（立ち絵の中で）
export const cropOf = (P, L, kind) => { const R = P.J.chars[L.rin]; return kind === 'face' ? [R.cx - 48, Math.max(0, R.headTop - 26), 96, 108] : [56, 0, 144, 376]; };
// 立ち絵を cv に描く（kind：'face'／'body'）
export function drawLook(cv, P, L, kind = 'body') {
  const [x, y, w, h] = cropOf(P, L, kind); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(compose(P, L), -x, -y); return [x, y, w, h];
}
// ホーム用：色のついたコマの絵（1コマ。fw・fh つき）
export function frameCanvas(P, L) {
  const c = document.createElement('canvas'); c.width = FRAME[0]; c.height = FRAME[1]; c.getContext('2d').drawImage(compose(P, L), OFF[0], OFF[1]);
  return Object.assign(c, { fw: FRAME[0], fh: FRAME[1], frames: 1 });
}
// カード用：色番号の絵（R＝番号、A＝ある・なし）と、その色の表。コマは frames 個ならべる（ポーズは1つなので、どのコマも同じ絵）
function indexed(P, L, frames) {
  const key = JSON.stringify(L) + '|' + frames; if (P.tex.has(key)) return P.tex.get(key);
  const src = frameCanvas(P, L), [fw, fh] = FRAME, d = src.getContext('2d').getImageData(0, 0, fw, fh).data;
  const out = new ImageData(fw * frames, fh), o = out.data, pal = [], ids = new Map();
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
    const q = (y * fw + x) * 4; if (d[q + 3] < 128) continue;
    const k = (d[q] << 16) | (d[q + 1] << 8) | d[q + 2]; let i = ids.get(k);
    if (i === undefined) {
      if (pal.length < 256) { i = pal.length; pal.push([d[q], d[q + 1], d[q + 2]]); ids.set(k, i); }
      else { let best = 0, bd = 1e9; pal.forEach((c, j) => { const e = (c[0] - d[q]) ** 2 + (c[1] - d[q + 1]) ** 2 + (c[2] - d[q + 2]) ** 2; if (e < bd) { bd = e; best = j; } }); i = best; ids.set(k, i); }   // 色が多すぎたら、近い色にまとめる
    }
    for (let f = 0; f < frames; f++) { const t = (y * fw * frames + f * fw + x) * 4; o[t] = i; o[t + 3] = 255; }
  }
  const c = document.createElement('canvas'); c.width = fw * frames; c.height = fh; c.getContext('2d').putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  if (P.tex.size > 12) { const k0 = P.tex.keys().next().value; P.tex.get(k0).tex.dispose(); P.tex.delete(k0); }
  const r = { tex: t, pal }; P.tex.set(key, r); return r;
}
// カードのキャラに、その見た目の絵を入れる。返り値：その絵の色の表（名所ごとの色づけは、呼ぶ側でかける）。ch：card.js の makeChara の返り値
export function applyParts(P, ch, st) {
  const L = lookOf(P, st), key = JSON.stringify(L);
  if (ch.partsKey !== key) { ch.partsKey = key; const r = indexed(P, L, ch.frames || 1); ch.pal2 = r.pal; ch.ext = 0; ch.setLods([{ s: 2, tex: r.tex, size: FRAME }]); }
  return ch.pal2;
}
