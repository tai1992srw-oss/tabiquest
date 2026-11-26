// 新しいキャラ（2026-11-26 作り替え）：正面向きの立ち1つを、部品とアンカーで組み立てる
//   部品：輪郭（頭）・目・まゆ・口（鼻つき）・ほお・前髪・後ろ髪・服。体は共通。絵とアンカーは assets/chara2/（元は dot/chara_parts/。キャラのセッションが書き出す）
//   絵は描き足さない。部品を、アンカーが決まった位置に来るように置いて重ねるだけ
//   見た目（look）：{ rin, eye, brow, mouth, cheek, hairF, hairB, wear：部品の出どころの id（'c1' など。cheek・wear は '' ＝ なし）,
//                    v：{ eyeGap 目のはば, eyeY 目の高さ, browDy 目からまゆまで, mouthY 口の高さ, cheekGap・cheekDy ほお, hairS・hairDy・hairDx 髪の大きさ（％）・高さ・横の位置 } }
//                    colors：{ hair, skin, eye }（色変え。'#rrggbb'。ないときは元の色） }
//   v は、キャラ1を ±0 とした差（ドット）。はじめの値は、輪郭ごとのプリセット（parts.json の preset を、キャラ1との差に直した物）
//   前のキャラ（ななめ向き・6ポーズ・色変え）は archive/chara-v1/ と、git のタグ chara-v1
import { settings } from './store.js';
const THREE = window.THREE;
const BASE = 'assets/chara2/';
export const SLOTS = [['rin', '輪郭'], ['eye', '目'], ['brow', 'まゆ'], ['mouth', '口'], ['cheek', 'ほお'], ['hairF', '前髪'], ['hairB', '後ろ髪'], ['wear', '服']];
export const NONE = { cheek: 'なし', wear: 'インナー' };   // 「なし」をえらべる部品
// 動かせる値：[名前, 画面の名前, 下限, 上限, 説明]
// 値はどれも「キャラ1（1つめの輪郭）を ±0 とした差」で持つ（2026-11-26 くりた：キャラごとにすてきなバランスを作り、入れるときはキャラ1を ±0 の基準にする）
//   絵から測った数字（parts.json の preset）は、読みこむときにキャラ1との差に直す（chars.<id>.rel）。組み立てるときに、キャラ1の数字を足して元にもどす
export const VALS = [
  ['eyeGap', '目のはば', -12, 18, '左右の目の間。＋で広く'], ['eyeY', '目の高さ', -13, 13, '＋で下へ'], ['browDy', 'まゆの高さ', -11, 7, '＋で目に近く'],
  ['mouthY', '口の高さ', -8, 12, '＋で下へ'], ['cheekGap', 'ほおのはば', -15, 27, '左右のほおの赤みの間。＋で広く'], ['cheekDy', 'ほおの高さ', -7, 11, '＋で下へ'],
];
const FACE_KEYS = VALS.map(q => q[0]);
// 髪の調整（お着替えの「髪」のタブに出す）。輪郭に合わせた大きさ・位置から、どれだけ変えるか。0 ＝ 合わせたまま
export const HAIR_VALS = [
  ['hairS', '髪の大きさ', -12, 12, '％。輪郭に合わせた大きさから'], ['hairDy', '髪の高さ', -12, 12, 'ドット。小さいほど上'], ['hairDx', '髪の横の位置', -8, 8, 'ドット。小さいほど左'],
];
export const COLORS = { hair: { name: '髪の色', list: ['#a8643c', '#6b4226', '#2b2224', '#e6c070', '#f4e2a8', '#b8a898', '#f09ab8', '#e2667a', '#c8ccd8', '#8a6ce0', '#3b5fb8', '#5fb8c8', '#6fbf8a'] },
  eye: { name: '目の色', list: ['#3a6fd8', '#5fb8e8', '#2f8c5a', '#8a4cbc', '#c23a52', '#e08a2a', '#d4a22a', '#7a4a2a', '#e2667a', '#3ed6c4', '#6a7088'] },
  skin: { name: '肌の色', list: ['#ffe6d2', '#fbd9bf', '#f1c4a0', '#e4b088', '#d9a074', '#c08458', '#a86c48', '#8a5638', '#6b4330'] } };
const HAIR0 = { hairS: 0, hairDy: 0, hairDx: 0 };
// 輪郭のプリセット（顔のバランス）に替える。髪の調整は、そのまま残す
export const presetOf = (P, rin, v = {}) => ({ ...P.J.chars[rin].rel, ...Object.fromEntries(Object.keys(HAIR0).map(k => [k, v[k] ?? 0])) });
// カードの中のコマ：前のキャラと同じ 272×376（足もとが下から1行め）。新しい絵（256×384・足もと 371 行）を、足もとをそろえて入れる
export const FRAME = [272, 376], OFF = [8, 4];

let parts = null;
const image = src => new Promise((ok, ng) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ng(new Error(src)); i.src = src; });
export function loadParts() {
  return parts || (parts = (async () => {
    const J = await (await fetch(BASE + 'parts.json')).json(), IM = { body: await image(BASE + J.body) }, ids = Object.keys(J.chars);
    await Promise.all(ids.flatMap(c => { IM[c] = {}; return ['rinkaku', 'hair_front', 'hair_back', 'wear', 'wear_hide', ...Object.keys(J.chars[c].pieces)].map(async n => { IM[c][n] = await image(`${BASE}${c}/${n}.png`); }); }));
    const base = J.chars[ids[0]].preset; for (const c of ids) J.chars[c].rel = Object.fromEntries(FACE_KEYS.map(k => [k, (J.chars[c].preset[k] ?? base[k]) - base[k]]));   // キャラ1との差
    return { J, IM, ids, base, cache: new Map(), tex: new Map(), hair: new Map(), tint: new Map() };
  })().catch(e => { parts = null; throw e; }));
}
// キャラのプリセット：そのキャラの部品とバランスを、ひとそろい（色は元の色、髪の調整は 0）。名前は、ならび順に「キャラ1」「キャラ2」…
export const charaLook = (P, id) => ({ ...Object.fromEntries(SLOTS.map(([k]) => [k, k === 'cheek' && !P.J.chars[id].pieces.cheekL ? '' : id])), v: presetOf(P, id) });
export const charaName = (P, id) => `キャラ${P.ids.indexOf(id) + 1}`;
// はじめの見た目：最初の子（1つめの id）の部品とバランス
export const firstLook = P => ({ ...Object.fromEntries(SLOTS.map(([k]) => [k, P.ids[0]])), v: presetOf(P, P.ids[0]) });
// 見た目をととのえる（前のキャラの見た目や、欠けた項目は、はじめの見た目で埋める）
export function fixLook(P, L) {
  const d = firstLook(P); if (!L || !P.J.chars[L.rin]) return d;
  const o = { v: { ...HAIR0, ...P.J.chars[L.rin].rel, ...(L.v || {}) } };
  if (o.v.eyeY > 40) for (const k of FACE_KEYS) o.v[k] -= P.base[k];   // 前の形（絵の中の行・はばそのもの）で残した見た目は、キャラ1との差に直す
  for (const [k] of SLOTS) o[k] = P.J.chars[L[k]] ? L[k] : (NONE[k] && L[k] === '' ? '' : d[k]);
  if (o.cheek && !P.J.chars[o.cheek].pieces.cheekL) o.cheek = '';
  const col = Object.fromEntries(['hair', 'skin', 'eye'].filter(k => /^#[0-9a-f]{6}$/i.test(L.colors?.[k] || '')).map(k => [k, L.colors[k]])); if (Object.keys(col).length) o.colors = col;
  return o;
}
// ふだんの見た目（ホームのお着替え）と、そのカードの見た目（カードに残してあればそれ）
export const homeLook = P => fixLook(P, settings.chara2);
export const lookOf = (P, st) => { const L = st?.look?.rin ? fixLook(P, st.look) : homeLook(P), o = {}; for (const k of ['tilt', 'lean', 'wind']) if (+st?.photo?.[k]) o[k] = +st.photo[k]; return Object.keys(o).length ? { ...L, ...o } : L; };   // 首のかしげ・腰・風は、撮影の設定（photo）から
export const has = (P, k, c) => k !== 'cheek' || !!P.J.chars[c].pieces.cheekL;
export const itemName = (P, k, c) => (c === '' ? NONE[k] : k === 'wear' ? P.J.chars[c].wear : k === 'rin' ? `${P.J.chars[c].name}（${P.J.chars[c].rin}）` : P.J.chars[c].name);

// ---- 色変え（髪・肌）：絵の色を、えらんだ色に置きかえる。明るさの段（影・光）と、色あいの小さな差は、元の絵のまま残す ----
//   look.colors：{ hair:'#rrggbb', skin:'#rrggbb', eye:'#rrggbb' }（ない部位は、元の色のまま）
//   髪：その髪の絵で、いちばん多い色を「基準の色」とする。基準と色あいが大きくちがう所（リボンなどの飾り）は変えない
//   肌：輪郭の絵で、いちばん多い色が基準。体・輪郭の中の肌の色と、服の絵にまざっている「まったく同じ肌の色」だけを変える（インナーの白は変えない）
const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn), h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function hsl2rgb(h, s, l) {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q, f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}
const hueGap = (a, b) => { const d = Math.abs(a - b) % 1; return Math.min(d, 1 - d); };
const pixels = im => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0); return [c, x, x.getImageData(0, 0, c.width, c.height)]; };
// 絵の中で、いちばん多い色（まっ黒に近い線と、only に入らない色はのぞく）
function mainColor(d, only = null) {
  const n = new Map(); for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128 || d[i] + d[i + 1] + d[i + 2] < 150) continue; const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]; if (only && !only(d[i], d[i + 1], d[i + 2])) continue; n.set(k, (n.get(k) || 0) + 1); }
  let best = 0, bn = 0; for (const [k, v] of n) if (v > bn) { bn = v; best = k; } return [best >> 16, (best >> 8) & 255, best & 255];
}
const skinLike = (r, g, b) => { const [h, s, l] = rgb2hsl(r, g, b); return (h < .12 || h > .97) && s > .25 && l > .45 && l < .93; };
// 色の置きかえの式を作る。ref：基準の色、hex：えらんだ色、hi：その絵の中でいちばん明るい色の明るさ
function mapper(ref, hex, hi) {
  const R = rgb2hsl(...ref), T = rgb2hsl(...hex2rgb(hex)), rl = Math.min(.98, Math.max(.02, R[2])), gap = Math.min(.3, Math.max(0, hi - rl) * 1.15), base = Math.min(T[2], .95 - gap);
  return (r, g, b) => {
    const o = rgb2hsl(r, g, b), lit = o[2] > rl;
    const l = Math.max(0, Math.min(1, lit ? base + (o[2] - rl) * 1.15 : o[2] * base / rl));      // 影は同じ割合で暗く、光は元と同じ差だけ明るく（明るすぎる色は、土台を少し下げて差を守る）
    const s = T[1] < .08 ? T[1] + (lit ? .05 : 0) : Math.max(0, Math.min(1, R[1] > .15 ? o[1] * T[1] / R[1] : T[1]));
    let dh = o[0] - R[0]; dh -= Math.round(dh);
    return hsl2rgb((T[0] + dh + 1) % 1, s, l);
  };
}
// 絵 im の色を置きかえた絵を返す（同じ頼みは使い回す）。kind：'hair'／'skin'／'skinIn'（服の中の肌）
function tint(P, im, kind, hex, key) {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return im;
  const ck = `${key}/${kind}/${hex}`; if (P.tint.has(ck)) return P.tint.get(ck);
  const [c, x, D] = pixels(im), d = D.data, cache = new Map();
  if (!P.skin) { const [, , B] = pixels(P.IM[P.ids[0]].rinkaku); P.skin = { ref: mainColor(B.data, skinLike), set: new Set() };   // 肌の基準の色と、体・輪郭に出てくる肌の色の一覧
    for (const src of [P.IM.body, ...P.ids.map(i => P.IM[i].rinkaku)]) { const q = pixels(src)[2].data; for (let i = 0; i < q.length; i += 4) if (q[i + 3] > 127 && skinLike(q[i], q[i + 1], q[i + 2])) P.skin.set.add((q[i] << 16) | (q[i + 1] << 8) | q[i + 2]); } }
  // 目：色のついた所（黒目）だけ。白目・光・まつ毛・まぶたの線は変えない。基準は、黒目の色のうち、明るさがまん中に近い色
  const vivid = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b) >= 40;
  const eyeRef = () => { const n = new Map(); for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 127 && Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) >= 60) { const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]; n.set(k, (n.get(k) || 0) + 1); }
    let best = [128, 128, 128], bd = 9; for (const [k, v] of n) { if (v < 3) continue; const c = [k >> 16, (k >> 8) & 255, k & 255], e = Math.abs(rgb2hsl(...c)[2] - .5); if (e < bd) { bd = e; best = c; } } return best; };
  const ref = kind === 'hair' ? mainColor(d) : kind === 'eye' ? eyeRef() : P.skin.ref, rh = rgb2hsl(...ref)[0];
  const use = kind === 'eye' ? (r, g, b) => vivid(r, g, b) && hueGap(rgb2hsl(r, g, b)[0], rh) < .15
    : kind === 'hair' ? (r, g, b) => { const [h, s] = rgb2hsl(r, g, b); return s < .22 || hueGap(h, rh) < .14; }      // 髪：色あいが近い所と、色みのうすい所（線・白っぽい光）。リボンなどは変えない
    : (r, g, b) => P.skin.set.has((r << 16) | (g << 8) | b) || (kind === 'skin' && (() => { const [h, s, l] = rgb2hsl(r, g, b); return hueGap(h, rh) < .08 && s > .2 && l < .93; })());   // 肌：肌の色と、同じ色あいのこい線（輪郭の線）
  let hi = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 127 && use(d[i], d[i + 1], d[i + 2])) hi = Math.max(hi, rgb2hsl(d[i], d[i + 1], d[i + 2])[2]);
  const f = mapper(ref, hex, kind === 'skin' || kind === 'skinIn' ? rgb2hsl(...ref)[2] + .04 : hi);
  for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) continue; const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]; let v = cache.get(k);
    if (v === undefined) { v = use(d[i], d[i + 1], d[i + 2]) ? f(d[i], d[i + 1], d[i + 2]).map(Math.round) : null; cache.set(k, v); }
    if (v) { d[i] = v[0]; d[i + 1] = v[1]; d[i + 2] = v[2]; } }
  x.putImageData(D, 0, 0); if (P.tint.size > 40) P.tint.delete(P.tint.keys().next().value); P.tint.set(ck, c); return c;
}

// 髪を、輪郭の大きさに合わせる：その髪が描かれたときの頭（横はば headW・てっぺん〜あご）と、えらんだ輪郭の頭をくらべて、
//   頭のてっぺんのまん中（アンカー）を軸に、横とたてを伸び縮みさせる。ドット絵なので、1マスを 3×3 に見て、多い色を取る（こい線は 4つ以上あれば優先）
//   同じ大きさ（同じ輪郭用の髪）のときは、元の絵のまま。返り値：256×384 のキャンバス（アンカーの位置は元のまま）
function fitHair(P, id, name, rin, adj = 0, hex = '') {
  const C = P.J.chars[id], R = P.J.chars[rin], a = C.hair?.[name] || { ax: C.cx, ay: C.headTop, headW: C.headW }, im = tint(P, P.IM[id][name], 'hair', hex, `${id}/${name}`);
  const k = 1 + adj / 100, sx = R.headW / (a.headW || C.headW) * k, sy = (R.chin - R.headTop) / (C.chin - C.headTop) * k;   // adj：髪の大きさの調整（％）
  if (Math.abs(sx - 1) < .02 && Math.abs(sy - 1) < .02) return im;
  const key = `${id}/${name}/${rin}/${adj}/${hex}`; if (P.hair.has(key)) return P.hair.get(key);
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
  tx.putImageData(out, 0, 0); if (P.hair.size > 24) P.hair.delete(P.hair.keys().next().value); P.hair.set(key, t); return t;
}

// 首のかしげ：頭（後ろ髪・輪郭・顔・前髪）を、あごの下のまん中を軸に deg 度まわす（＋で、見て右に倒れる）
//   ドット絵なので、1マスを 3×3 に見て、多い色を取る（こい線は 4つ以上あれば優先）。y0〜y1 の行だけ見る（頭のあたり）
// 腰からかたむける：腰（py の行）より上を、腰のまん中を軸に deg 度まわす。まわす角度は、腰から band 行かけて 0 → deg へなめらかに（体が折れずに、しなる）
//   腰より下（脚）は動かさない
function bend(src, deg, px, py, band) {
  const W = src.width, H = src.height, sx = src.getContext('2d', { willReadFrequently: true });
  const S = new Uint32Array(sx.getImageData(0, 0, W, H).data.buffer), out = new ImageData(W, H), D = new Uint32Array(out.data.buffer), OF = [1 / 6, .5, 5 / 6], cnt = new Map();
  const dark = v => (v & 255) + ((v >> 8) & 255) + ((v >> 16) & 255) < 300;
  for (let y = 0; y < H; y++) {
    if (y >= py) { D.set(S.subarray(y * W, y * W + W), y * W); continue; }
    let t = Math.min(1, (py - y) / band); t = t * t * (3 - 2 * t); const a = deg * t * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
    for (let x = 0; x < W; x++) {
      cnt.clear(); let solid = 0;
      for (const oy of OF) for (const ox of OF) {
        const dx = x + ox - px, dy = y + oy - py, u = Math.floor(cs * dx + sn * dy + px), w = Math.floor(-sn * dx + cs * dy + py);
        if (u < 0 || u >= W || w < 0 || w >= H) continue; const v = S[w * W + u]; if ((v >>> 24) < 128) continue; solid++; cnt.set(v, (cnt.get(v) || 0) + 1);
      }
      if (solid < 5) continue;
      let best = 0, bn = 0, bd = 0, dn = 0; for (const [v, n] of cnt) { if (n > bn) { bn = n; best = v; } if (n >= 4 && dark(v) && n > dn) { dn = n; bd = v; } }
      D[y * W + x] = dn ? bd : best;
    }
  }
  const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').putImageData(out, 0, 0); return c;
}
// 風：髪を、風下へなびかせる。頭のてっぺんから下へ行くほど、横に大きくずらす（行ごとに、まるごと横へ）。f：ずらす量（＋で右へ）。top：頭のてっぺんの行、span：ずらしが f になるまでの行数
function blow(src, f, top, span) {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; const x = c.getContext('2d');
  for (let y = 0; y < src.height; y++) { const t = Math.max(0, (y - top) / span); x.drawImage(src, 0, y, src.width, 1, Math.round(f * Math.min(1.2, t ** 1.4)), y, src.width, 1); }
  return c;
}
function rotate(src, deg, px, py, y1) {
  const W = src.width, H = src.height, a = deg * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a), sx = src.getContext('2d', { willReadFrequently: true });
  const S = new Uint32Array(sx.getImageData(0, 0, W, H).data.buffer), out = new ImageData(W, H), D = new Uint32Array(out.data.buffer), OF = [1 / 6, .5, 5 / 6], cnt = new Map();
  const dark = v => (v & 255) + ((v >> 8) & 255) + ((v >> 16) & 255) < 300;
  for (let y = 0; y < Math.min(H, y1); y++) for (let x = 0; x < W; x++) {
    cnt.clear(); let solid = 0;
    for (const oy of OF) for (const ox of OF) {
      const dx = x + ox - px, dy = y + oy - py, u = Math.floor(cs * dx + sn * dy + px), w = Math.floor(-sn * dx + cs * dy + py);   // 逆にまわして、元の絵のどこかを見る
      if (u < 0 || u >= W || w < 0 || w >= H) continue; const v = S[w * W + u]; if ((v >>> 24) < 128) continue; solid++; cnt.set(v, (cnt.get(v) || 0) + 1);
    }
    if (solid < 5) continue;
    let best = 0, bn = 0, bd = 0, dn = 0; for (const [v, n] of cnt) { if (n > bn) { bn = n; best = v; } if (n >= 4 && dark(v) && n > dn) { dn = n; bd = v; } }
    D[y * W + x] = dn ? bd : best;
  }
  const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').putImageData(out, 0, 0); return c;
}

// 見た目 L の立ち絵（256×384 のキャンバス）。同じ見た目は使い回す
//   L.tilt：首のかしげ（度。−12〜12）、L.lean：腰からかたむける（度。−10〜10）、L.wind：風（−2〜2。＋で右へなびく）。どれも撮影でえらぶ。0 ＝ なし
export function compose(P, L) {
  const key = JSON.stringify(L); if (P.cache.has(key)) return P.cache.get(key);
  const { J, IM } = P, [W, H] = J.size, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true }), R = J.chars[L.rin], col = L.colors || {};
  const v = { ...L.v }; for (const k of FACE_KEYS) v[k] = P.base[k] + (L.v[k] | 0);   // キャラ1の数字を足して、絵の中の行・はばにもどす
  // 首をかしげるときは、頭の部品を別のキャンバス（hd）に描いて、あとでまわして重ねる
  const tilt = Math.max(-12, Math.min(12, +L.tilt || 0)), mk = () => { const q = document.createElement('canvas'); q.width = W; q.height = H; return q; };
  const back = tilt ? mk() : c, head = tilt ? mk() : c, bk = back.getContext('2d'), hd = head.getContext('2d');
  const put = (im, p, tx, ty) => hd.drawImage(im, p.x + Math.round(tx - p.ax), p.y + Math.round(ty - p.ay));   // 部品を、アンカーが (tx, ty) に来るように置く
  const mean = (Q, k) => (Q[k + 'L'].ay + Q[k + 'R'].ay) / 2;
  // 髪：輪郭の大きさに合わせて伸び縮みさせ（fitHair）、その髪が描かれたときの頭のてっぺんを、えらんだ輪郭のてっぺんに合わせる
  const hy = (k, n) => R.headTop - (J.chars[L[k]].hair?.[n]?.ay ?? J.chars[L[k]].headTop) + (v.hairDy | 0);
  const hx = (k, n) => Math.round(R.cx - (J.chars[L[k]].hair?.[n]?.ax ?? J.chars[L[k]].cx)) + (v.hairDx | 0);   // 横は、頭のまん中を合わせる
  // 重ねる順：後ろ髪 → 体・輪郭（服でかくす所をのぞく）→ 服 → 前髪 → ほお → 目 → まゆ → 鼻・口
  const wind = Math.max(-2, Math.min(2, +L.wind || 0)), hairOf = (k, n, f) => { const im = fitHair(P, L[k], n, L.rin, v.hairS | 0, col.hair); return wind ? blow(im, wind * f, R.headTop - hy(k, n) + 14, 110) : im; };   // 風：後ろ髪は大きく、前髪は少しだけ
  bk.drawImage(hairOf('hairB', 'hair_back', 7), hx('hairB', 'hair_back'), hy('hairB', 'hair_back'));
  if (tilt) x.drawImage(rotate(back, tilt, R.cx + .5, R.chin, H), 0, 0);
  const b = document.createElement('canvas'); b.width = W; b.height = H; const bx = b.getContext('2d'); bx.drawImage(tint(P, IM.body, 'skin', col.skin, 'body'), 0, 0); if (!tilt) bx.drawImage(tint(P, IM[L.rin].rinkaku, 'skin', col.skin, `${L.rin}/rin`), 0, 0);
  if (tilt) hd.drawImage(tint(P, IM[L.rin].rinkaku, 'skin', col.skin, `${L.rin}/rin`), 0, 0);   // かしげるときは、輪郭は頭の側に描く（体といっしょにまわさない）
  if (L.wear) { bx.globalCompositeOperation = 'destination-out'; bx.drawImage(IM[L.wear].wear_hide, 0, 0); }
  x.drawImage(b, 0, 0); if (L.wear) x.drawImage(tint(P, IM[L.wear].wear, 'skinIn', col.skin, `${L.wear}/wear`), 0, 0);
  hd.drawImage(hairOf('hairF', 'hair_front', 3.5), hx('hairF', 'hair_front'), hy('hairF', 'hair_front'));
  // 顔の部品は、輪郭のまん中から左右に同じだけはなす。左右の高さのちがい（元の絵のかたむき）は残す
  const cx = Math.round(R.cx), half = g => { const l = cx - Math.floor(g / 2); return { L: l, R: l + g }; };
  if (L.cheek) { const Q = J.chars[L.cheek].pieces, X = half(v.cheekGap); for (const s of ['L', 'R']) put(IM[L.cheek]['cheek' + s], Q['cheek' + s], X[s], v.eyeY + v.cheekDy + (Q['cheek' + s].ay - mean(Q, 'cheek'))); }
  const E = J.chars[L.eye].pieces, EX = half(v.eyeGap), B = J.chars[L.brow].pieces;
  for (const s of ['L', 'R']) {
    put(tint(P, IM[L.eye]['eye' + s], 'eye', col.eye, `${L.eye}/eye${s}`), E['eye' + s], EX[s], v.eyeY + (E['eye' + s].ay - mean(E, 'eye')));
    put(IM[L.brow]['brow' + s], B['brow' + s], EX[s] + (B['brow' + s].ax - B['eye' + s].ax), v.eyeY + v.browDy + (B['brow' + s].ay - mean(B, 'brow')));
  }
  const M = J.chars[L.mouth], MP = M.pieces;
  if (MP.nose) put(IM[L.mouth].nose, MP.nose, cx + (MP.nose.ax - M.cx), MP.nose.ay + ((v.eyeY - M.preset.eyeY) + (v.mouthY - M.preset.mouthY)) / 2);   // 鼻は、目と口のあいだに付いて動く
  put(IM[L.mouth].mouth, MP.mouth, cx + (MP.mouth.ax - M.cx), v.mouthY);
  if (tilt) x.drawImage(rotate(head, tilt, R.cx + .5, R.chin, R.chin + 40), 0, 0);
  const lean = Math.max(-10, Math.min(10, +L.lean || 0));
  if (lean) { const o = bend(c, lean, 128, 214, 40); x.clearRect(0, 0, W, H); x.drawImage(o, 0, 0); }   // 腰（214 行・体のまん中）から上を、かたむける
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
  // 色の表は 256 色まで。色が多いとき（髪の色を変えた・キャラ3のように色の多い絵）は、多く使われている色から 256 色をえらび、残りはいちばん近い色にまとめる
  //   （前は、上から見つかった順に 256 色を取っていたので、髪の色ばかりで表が埋まり、肌や服が髪の色に寄って青くなった）
  const n = new Map(); for (let q = 0; q < d.length; q += 4) if (d[q + 3] >= 128) { const k = (d[q] << 16) | (d[q + 1] << 8) | d[q + 2]; n.set(k, (n.get(k) || 0) + 1); }
  const keys = [...n.keys()].sort((a, b) => n.get(b) - n.get(a)), pal = keys.slice(0, 256).map(k => [k >> 16, (k >> 8) & 255, k & 255]), ids = new Map(keys.slice(0, 256).map((k, i) => [k, i]));
  for (const k of keys.slice(256)) { const r = k >> 16, g = (k >> 8) & 255, b = k & 255; let best = 0, bd = 1e9; pal.forEach((c, j) => { const e = 2 * (c[0] - r) ** 2 + 4 * (c[1] - g) ** 2 + 3 * (c[2] - b) ** 2; if (e < bd) { bd = e; best = j; } }); ids.set(k, best); }
  const out = new ImageData(fw * frames, fh), o = out.data;
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
    const q = (y * fw + x) * 4; if (d[q + 3] < 128) continue; const i = ids.get((d[q] << 16) | (d[q + 1] << 8) | d[q + 2]);
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
