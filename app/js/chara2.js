// 新しいキャラ（2026-11-26 作り替え）：正面向きの立ち1つを、部品とアンカーで組み立てる
//   部品：輪郭（頭）・目・まゆ・口（鼻つき）・ほお・前髪・後ろ髪・服。体は共通。絵とアンカーは assets/chara2/（元は dot/chara_parts/。キャラのセッションが書き出す）
//   絵は描き足さない。部品を、アンカーが決まった位置に来るように置いて重ねるだけ
//   見た目（look）：{ top・bottom・feet：服（上下バラ）の番号, rin, eye, brow, mouth, cheek, hairF, hairB, wear：部品の出どころの id（'c1' など。cheek・wear は '' ＝ なし）,
//                    v：{ eyeGap 目のはば, eyeY 目の高さ, browDy 目からまゆまで, mouthY 口の高さ, cheekGap・cheekDy ほお, hairS・hairDy・hairDx 髪の大きさ（％）・高さ・横の位置 } }
//                    colors：{ hair, skin, eye }（色変え。'#rrggbb'。ないときは元の色） }
//   v は、キャラ1を ±0 とした差（ドット）。はじめの値は、輪郭ごとのプリセット（parts.json の preset を、キャラ1との差に直した物）
//   前のキャラ（ななめ向き・6ポーズ・色変え）は archive/chara-v1/ と、git のタグ chara-v1
import { settings } from './store.js';
const THREE = window.THREE;
const BASE = 'assets/chara2/';
export const SLOTS = [['rin', '輪郭'], ['eye', '目'], ['brow', 'まゆ'], ['mouth', '口'], ['cheek', 'ほお'], ['hairF', '前髪'], ['hairB', '後ろ髪'], ['wear', '服']];
// 服（上下バラ。parts.json の wears）：look の top・bottom・feet に、服の番号を入れる（'' ＝ なし）。どれか入っているときは、キャラの服（look.wear）は使わない
//   kind：'separate'＝トップスとボトムスを別の服と組み合わせてよい／'onepiece'＝上下つながった服（top に服ぜんぶ。着るとボトムスをはずす）
export const WEAR_PARTS = ['top', 'bottom', 'feet'];
export const WEAR_NAMES = { set: 'セット', top: 'トップス', bottom: 'ボトムス', feet: '足もと' };
const wearOf = (P, id) => P.J.wears.find(w => w.id === id);
// 服をえらぶ。kind：'set'（ひとそろい。v：'' ＝ インナー、キャラの id ＝ そのキャラの服、服の番号）／'top'・'bottom'・'feet'（その部分だけ。v：服の番号、'' ＝ なし）
export function pickWear(P, L, kind, v) {
  if (kind === 'set') { const w = wearOf(P, v); L.wear = w || !v ? '' : v; for (const k of WEAR_PARTS) L[k] = w && w.layers[k] ? v : ''; return; }
  if (L.wear) { L.wear = ''; for (const k of WEAR_PARTS) L[k] = ''; }   // キャラの服は分けられないので、ほかの部分はインナーから
  L[kind] = v;
  if (kind === 'top' && wearOf(P, v)?.kind === 'onepiece') L.bottom = '';
  if (kind === 'bottom' && v && wearOf(P, L.top)?.kind === 'onepiece') L.top = '';
}
export function wearOn(P, L, kind, v) {   // えらんでいるか
  if (kind !== 'set') return !L.wear && (L[kind] || '') === v;
  const w = wearOf(P, v); if (!w) return (L.wear || '') === v && (v || !WEAR_PARTS.some(k => L[k]));
  return !L.wear && WEAR_PARTS.every(k => (L[k] || '') === (w.layers[k] ? v : ''));
}
export const wearItems = (P, kind) => kind === 'set' ? ['', ...P.ids, ...P.J.wears.map(w => w.id)] : ['', ...P.J.wears.filter(w => w.layers[kind]).map(w => w.id)];
export const wearName = (P, kind, v) => (v === '' ? (kind === 'set' ? 'インナー' : 'なし') : P.J.chars[v] ? P.J.chars[v].wear : wearOf(P, v)?.name || v);
// 表情：口・まゆ・目の組み合わせ（2026-11-26 くりた：口とまゆは全キャラ共有、目はキャラごと）。look.face に id を入れる（'' ＝ ふだん）
//   eye：そのキャラの目の差分（chars.<c>.eyes の id）、brow：まゆの差分（chars.<c>.brows）、mouth：共有の口（shared.mouths）。ないキャラは、ふだんの物のまま
export const FACES = [
  ['', 'ふだん', {}], ['smile', '笑顔', { brow: 'gentle', mouth: 'smile' }], ['grin', 'にっこり', { eye: 'smile', brow: 'gentle', mouth: 'grin' }],
  ['close', '目をとじる', { eye: 'close', mouth: 'smile' }], ['wink', 'ウインク', { eye: 'wink', mouth: 'smirk' }], ['wow', 'おどろき', { brow: 'up', mouth: 'o' }],
  ['komari', '困り', { brow: 'trouble', mouth: 'wave' }], ['shy', '照れ', { eye: 'smile', brow: 'trouble', mouth: 'shy' }], ['smug', 'ニヤリ', { eye: 'smug', mouth: 'nyari' }],
  ['muu', 'むっ', { brow: 'angry', mouth: 'he' }],
];
const FACE = Object.fromEntries(FACES.map(([id, , f]) => [id, f]));
// 持ち物・かざり：look.items に、物の番号をならべる。同じ所（attach）に付く物は1つだけ（紙袋とぬいぐるみは、どちらも右手）
//   置き方：そのキャラの attach の点 + (絵の位置 − キャラ1での付く点)。頭に付く物（head）は、頭の大きさ（headW）に合わせて伸び縮みさせ、かしげ・向きでも頭といっしょに動く
export const itemList = P => P.J.items;
export function toggleItem(P, L, id) {
  const it = P.J.items.find(q => q.id === id); if (!it) return; const cur = L.items || [];
  L.items = cur.includes(id) ? cur.filter(q => q !== id) : [...cur.filter(q => P.J.items.find(r => r.id === q)?.attach !== it.attach), id];
  if (!L.items.length) delete L.items;
}
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
    const J = await (await fetch(BASE + 'parts.json')).json(), IM = { body: await image(BASE + J.body), w: {} }, ids = Object.keys(J.chars);
    J.wears = J.wears || []; J.wearOrder = J.wearOrder || WEAR_PARTS;
    // 表情の差分：キャラごとの目（eyes）・まゆ（brows）、共有の口（shared.mouths）
    J.shared = J.shared || {}; IM.mouths = {}; for (const c of ids) IM[c] = {};
    await Promise.all([...ids.flatMap(c => [...(J.chars[c].eyes || []).flatMap(e => ['L', 'R'].filter(q => e[q]).map(async q => { IM[c][`eye${q}_${e.id}`] = await image(`${BASE}${c}/eye${q}_${e.id}.png`); if (e[q].x2) IM[c][`eye${q}_${e.id}@2x`] = await image(`${BASE}${c}/eye${q}_${e.id}@2x.png`); })),
      ...(J.chars[c].brows || []).flatMap(e => ['L', 'R'].filter(q => e[q]).map(async q => { IM[c][`brow${q}_${e.id}`] = await image(`${BASE}${c}/brow${q}_${e.id}.png`); if (e[q].x2) IM[c][`brow${q}_${e.id}@2x`] = await image(`${BASE}${c}/brow${q}_${e.id}@2x.png`); }))]),   // 差分の2倍（<部品>_<id>@2x.png・L.x2／R.x2）もあれば読む
      ...(J.shared.mouths || []).map(async m => { IM.mouths[m.id] = await image(`${BASE}shared/mouth_${m.id}.png`); })]);
    // 持ち物・かざり（items）：<id>_front.png・<id>_back.png
    J.items = J.items || []; IM.items = {};
    await Promise.all(J.items.flatMap(it => { IM.items[it.id] = {}; return ['front', 'back'].filter(k => it[k]).map(async k => { IM.items[it.id][k] = await image(BASE + it[k].file); }); }));
    await Promise.all(J.wears.flatMap(w => { IM.w[w.id] = {}; return Object.entries(w.layers).map(async ([k, f]) => { IM.w[w.id][k] = await image(BASE + f); }); }));   // 服（上下バラ）：wear/<番号>/{top,bottom,feet}.png
    await Promise.all(ids.flatMap(c => { return ['rinkaku', 'hair_front', 'hair_back', 'wear', 'wear_hide', ...Object.keys(J.chars[c].pieces)].map(async n => { IM[c][n] = await image(`${BASE}${c}/${n}.png`); }); }));
    // 顔の部品の2倍（pieces.<部品>.x2 がある物）：<c>/<部品>@2x.png（くりた決定「顔のパーツは2倍の細かさ」。体・髪・服は 256×384 のまま）
    await Promise.all(ids.flatMap(c => Object.entries(J.chars[c].pieces).filter(([, q]) => q.x2).map(async ([n]) => { IM[c][n + '@2x'] = await image(`${BASE}${c}/${n}@2x.png`); })));
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
  for (const k of WEAR_PARTS) { const w = wearOf(P, L[k]); o[k] = w && w.layers[k] ? w.id : ''; }
  if (WEAR_PARTS.some(k => o[k])) o.wear = '';
  const its = (L.items || []).filter(id => P.J.items?.some(q => q.id === id)); if (its.length) o.items = its;
  const col = Object.fromEntries(['hair', 'skin', 'eye'].filter(k => /^#[0-9a-f]{6}$/i.test(L.colors?.[k] || '')).map(k => [k, L.colors[k]])); if (Object.keys(col).length) o.colors = col;
  return o;
}
// ふだんの見た目（ホームのお着替え）と、そのカードの見た目（カードに残してあればそれ）
export const homeLook = P => fixLook(P, settings.chara2);
export const lookOf = (P, st) => { const L = st?.look?.rin ? fixLook(P, st.look) : homeLook(P), o = {}; for (const k of ['tilt', 'turn', 'lean', 'wind']) if (+st?.photo?.[k]) o[k] = +st.photo[k]; if (FACE[st?.photo?.face] && st.photo.face) o.face = st.photo.face; return Object.keys(o).length ? { ...L, ...o } : L; };   // 首のかしげ・腰・風は、撮影の設定（photo）から
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
// 顔の向きの数字（キャラ＝輪郭ごと・左右ごと）。くりたさんと見本帳の「向きの調整」で決めていく
//   move：顔の部品を向いた側へ、near・far：手前の目・奥の目だけ さらに、eyeCut・browCut：奥の目・まゆを細くする列の数、mouth：口・鼻だけ さらに、hair：前髪（てっぺんで）、jaw：あご
//   決まった値は parts.json の chars.<id>.turn.{L,R} に入れる。見本帳でいじった値は、その端末の localStorage（tabiquest:turnTune）に入り、そちらが先
export const TURN_KEYS = [['head', '頭ぜんたい', 0, 4], ['cheekNear', '手前のほお（外へ）', 0, 5], ['cheekFar', '奥のほお（内へ）', 0, 5], ['move', '顔の部品', 0, 5], ['near', '手前の目', -3, 3], ['far', '奥の目', -3, 4], ['eyeCut', '奥の目を細く（列）', 0, 6], ['browCut', '奥のまゆを細く（列）', 0, 5], ['mouth', '口・鼻', -3, 3], ['hair', '前髪', 0, 5], ['jaw', 'あご', 0, 5]];
// 初めの値は、Codex の「少しだけ横向き」の見本（research/style/turn/）と正面をくらべて測った動きから（頭ぜんたいからの差で：目・まゆ +2、口 +1、前髪のまん中 +2・横 0、
//   手前のほおは外へ、奥のほおは内へ、あご +1〜4）
// 2026-11-26 くりたと見くらべで決めた値（キャラ1の右向き → 3キャラとも同じでよい）：口 +3・奥の目 −1（細く3列）・手前の目 +2・前髪 1・あご 3。頭ぜんたい・ほおは使わない
export const TURN_DEF = { head: 0, cheekNear: 0, cheekFar: 0, move: 2, near: 2, far: -1, eyeCut: 3, browCut: 2, mouth: 3, hair: 1, jaw: 3 };
// いちばん横を向いたとき（turn＝±1）は、上の値の 6/8 で止める（くりた「6/8で実装しよう」）
export const TURN_MAX = .75;
export const turnTune = () => { try { return JSON.parse(localStorage.getItem('tabiquest:turnTune') || '{}') || {}; } catch (e) { return {}; } };
export function turnOf(P, rin, dir) { return { ...TURN_DEF, ...(P.J.chars[rin]?.turn?.[dir] || {}), ...(turnTune()[rin]?.[dir] || {}) }; }
// 行ごとに、まるごと横へずらす（線の太さは変わらない）。f(y)：その行のずらし量（ドット）
function rowShift(src, f) {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; const x = c.getContext('2d');
  for (let y = 0; y < src.height; y++) x.drawImage(src, 0, y, src.width, 1, Math.round(f(y)), y, src.width, 1);
  return c;
}
// 輪郭を、まん中の列で左右に分けて、左半分を dl、右半分を dr ずらす（行ごと。f(y) → [dl, dr]）。分かれてあいた所は、まん中の列（はだ）でうめる
//   向き：手前のほおは外へ広がり、奥のほおは内へ寄る（顔が回って見える）。線はずらすだけなので、太さは変わらない
function splitRows(src, cx, f) {
  const W = src.width, H = src.height, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  for (let y = 0; y < H; y++) {
    const [dl, dr] = f(y).map(Math.round);
    if (!dl && !dr) { x.drawImage(src, 0, y, W, 1, 0, y, W, 1); continue; }
    x.drawImage(src, 0, y, cx, 1, dl, y, cx, 1); x.drawImage(src, cx, y, W - cx, 1, cx + dr, y, W - cx, 1);
    for (let g = cx + dl; g < cx + dr; g++) x.drawImage(src, cx, y, 1, 1, g, y, 1, 1);   // あいた所
  }
  return c;
}
// 細くする：絵を縮めず、列をぬく（線の太さが変わらない）。ぬくのは、はしの2列をのぞいた内がわで、こい線の少ない列から n 列（となりあわないように）
function narrow(im, n) {
  const [c0, x0, D] = pixels(im), d = D.data, W = D.width, H = D.height, score = [];
  for (let x = 2; x < W - 2; x++) { let k = 0; for (let y = 0; y < H; y++) { const q = (y * W + x) * 4; if (d[q + 3] > 127) k += d[q] + d[q + 1] + d[q + 2] < 300 ? 10 : 1; } score.push([k, x]); }
  score.sort((a, b) => a[0] - b[0]); const cut = new Set();
  for (const [, x] of score) { if (cut.size >= n) break; if (!cut.has(x - 1) && !cut.has(x + 1)) cut.add(x); }
  const c = document.createElement('canvas'); c.width = W - cut.size; c.height = H; const cx = c.getContext('2d'); let o = 0;
  for (let x = 0; x < W; x++) { if (cut.has(x)) continue; cx.drawImage(c0, x, 0, 1, H, o++, 0, 1, H); }
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
//   L.tilt：首のかしげ（度。−12〜12）、L.turn：顔の向き（−1〜1。小数も可）、L.lean：腰からかたむける（度。−10〜10。いまは撮影でえらべない）、L.wind：風（−2〜2。＋で右へなびく）。どれも撮影でえらぶ。0 ＝ なし
export function compose(P, L) {
  const key = JSON.stringify(L); if (P.cache.has(key)) return P.cache.get(key);
  const { J, IM } = P, [W, H] = J.size, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true }), R = J.chars[L.rin], col = L.colors || {};
  const v = { ...L.v }; for (const k of FACE_KEYS) v[k] = P.base[k] + (L.v[k] | 0);   // キャラ1の数字を足して、絵の中の行・はばにもどす
  // 首をかしげるときは、頭の部品を別のキャンバス（hd）に描いて、あとでまわして重ねる
  // 顔の向き（turn：−1・0・1。＋で見て右を向く）とかしげのときは、頭の部品（輪郭・前髪・顔）を別のキャンバスに描いて、ずらし・まわしてから重ねる
  const tilt = Math.max(-12, Math.min(12, +L.tilt || 0)), tv = Math.round(Math.max(-1, Math.min(1, +L.turn || 0)) * TURN_MAX * 8) / 8, turn = Math.sign(tv), ta = Math.abs(tv), sep = !!(tilt || turn);
  //   顔の向きは1段まで（くりた「横向きは1段階でいい」）。−1〜1 の間の小数もとれて、ぬるっと動かすときは 1/8 ずつ（tv）。前の ±2 は ±1 として出す
  const mk = () => { const q = document.createElement('canvas'); q.width = W; q.height = H; return q; };
  const back = sep ? mk() : c, rinC = sep ? mk() : null, hfC = sep ? mk() : c, head = sep ? mk() : c, bk = back.getContext('2d'), hd = head.getContext('2d');
  // 持ち物・かざりの層を描く（side：'back'／'front'、head：頭に付く物か）。頭の物は、キャラ1の頭はばとの比で伸び縮み（付く点を軸に）
  const items = (L.items || []).map(id => J.items.find(q => q.id === id)).filter(Boolean), c1 = J.chars[P.ids[0]];
  const drawItems = (g, side, head) => { for (const it of items) { if (!!it.head !== head || !it[side]) continue; const im = IM.items[it.id][side];
    const at = head ? (R.anchors?.[it.attach] || (it.attach === 'headTop' ? [R.cx, R.headTop] : [it.ax, it.ay])) : (J.anchors?.[it.attach] || [it.ax, it.ay]);
    const k = head ? R.headW / (it.refHeadW || c1.headW) : 1,   // refHeadW：その物を描いたときの頭のはば
      ox = at[0] + (head ? (v.hairDx | 0) : 0), oy = at[1] + (head ? (v.hairDy | 0) : 0);
    const dx = Math.round(ox + (it[side].x - it.ax) * k), dy = Math.round(oy + (it[side].y - it.ay) * k);
    g.imageSmoothingEnabled = false; if (k === 1) g.drawImage(im, dx, dy); else g.drawImage(im, dx, dy, Math.max(1, Math.round(im.width * k)), Math.max(1, Math.round(im.height * k))); } };
  const mean = (Q, k) => (Q[k + 'L'].ay + Q[k + 'R'].ay) / 2;
  // 髪：輪郭の大きさに合わせて伸び縮みさせ（fitHair）、その髪が描かれたときの頭のてっぺんを、えらんだ輪郭のてっぺんに合わせる
  const hy = (k, n) => R.headTop - (J.chars[L[k]].hair?.[n]?.ay ?? J.chars[L[k]].headTop) + (v.hairDy | 0);
  const hx = (k, n) => Math.round(R.cx - (J.chars[L[k]].hair?.[n]?.ax ?? J.chars[L[k]].cx)) + (v.hairDx | 0);   // 横は、頭のまん中を合わせる
  // 重ねる順：後ろ髪 → 体・輪郭（服でかくす所をのぞく）→ 服 → 前髪 → ほお → 目 → まゆ → 鼻・口
  const wind = Math.max(-2, Math.min(2, +L.wind || 0)), hairOf = (k, n, f) => { const im = fitHair(P, L[k], n, L.rin, v.hairS | 0, col.hair); return wind ? blow(im, wind * f, R.headTop - hy(k, n) + 14, 110) : im; };   // 風：後ろ髪は大きく、前髪は少しだけ
  bk.drawImage(hairOf('hairB', 'hair_back', 7), hx('hairB', 'hair_back'), hy('hairB', 'hair_back'));
  drawItems(bk, 'back', true);   // 頭の物のうしろ側（帽子のつばのうしろなど）：後ろ髪のすぐ上   // 後ろ髪は、向きでは動かさない（正面より外へはみ出さないように）   // 後ろ髪は、向く側と反対へ少し（奥にあるので）
  if (sep) x.drawImage(tilt ? rotate(back, tilt, R.cx + .5, R.chin, H) : back, Math.round(tv * (turn ? turnOf(P, L.rin, turn > 0 ? 'R' : 'L').head : 0)), 0);
  drawItems(x, 'back', false);   // 体の物のうしろ側（手にかくれた持ち手、うしろのひも）：頭・体より後ろ
  const b = document.createElement('canvas'); b.width = W; b.height = H; const bx = b.getContext('2d'); bx.drawImage(tint(P, IM.body, 'skin', col.skin, 'body'), 0, 0); (sep ? rinC.getContext('2d') : bx).drawImage(tint(P, IM[L.rin].rinkaku, 'skin', col.skin, `${L.rin}/rin`), 0, 0);   // かしげ・向きのときは、輪郭は頭の側に描く（体といっしょに動かさない）
  if (L.wear) { bx.globalCompositeOperation = 'destination-out'; bx.drawImage(IM[L.wear].wear_hide, 0, 0); }
  x.drawImage(b, 0, 0); if (L.wear) x.drawImage(tint(P, IM[L.wear].wear, 'skinIn', col.skin, `${L.wear}/wear`), 0, 0);
  else for (const k of J.wearOrder) if (L[k]) x.drawImage(tint(P, IM.w[L[k]][k], 'skinIn', col.skin, `w/${L[k]}/${k}`), 0, 0);   // 服（上下バラ）：ボトムス → 足もと → トップス
  drawItems(x, 'front', false);   // 体の物（紙袋・ポーチなど）：服の上
  hfC.getContext('2d').drawImage(hairOf('hairF', 'hair_front', 3.5), hx('hairF', 'hair_front'), hy('hairF', 'hair_front'));
  drawItems(hfC.getContext('2d'), 'front', true);   // 頭の物：前髪の上・顔の部品の下（前髪といっしょに、かしげ・向きで動く）
  // 顔の部品は、輪郭のまん中から左右に同じだけはなす。左右の高さのちがい（元の絵のかたむき）は残す
  // 向き：顔の部品を向いた側へ2ドット（左右の間はせまくしない＝目が寄って詰まらないように）。
  //   向いた側の目とまゆは、内がわ（鼻の側）から細くする（外がわのはしは輪郭に寄せたまま＝奥へ回りこんで見える）
  const T = turn ? turnOf(P, L.rin, turn > 0 ? 'R' : 'L') : TURN_DEF;
  const cx = Math.round(R.cx) + Math.round(tv * T.move), half = g => { const l = cx - Math.floor(g / 2); return { L: l, R: l + g }; };
  const far = s => (turn > 0 && s === 'R') || (turn < 0 && s === 'L');
  // 顔の部品の細かさ：使う顔の部品に2倍の絵（x2）があれば、顔の部品だけ2倍のキャンバス（fd）に描き、さいごに 2倍に広げた体・髪の上に重ねる
  const uses = [L.eye, L.brow, L.mouth, L.cheek].filter(Boolean), fk = uses.some(c => Object.values(J.chars[c].pieces).some(q => q.x2)) ? 2 : 1;
  const featC = fk === 2 ? (() => { const q = document.createElement('canvas'); q.width = W * 2; q.height = H * 2; return q; })() : head, fd = featC.getContext('2d'); fd.imageSmoothingEnabled = false;
  // 部品 p を、アンカーが (tx, ty)（256×384 での位置）に来るように置く。n：細くする列（1倍での数）、im2・p2：2倍の絵とその位置（あれば）
  const putK = (im, p, tx, ty, n = 0, dx = 0, im2 = null, p2 = null) => {
    if (fk === 1) { if (!n) return fd.drawImage(im, p.x + Math.round(tx + dx - p.ax), p.y + Math.round(ty - p.ay)); return fd.drawImage(narrow(im, n), p.x + Math.round(tx + dx - p.ax) + (turn > 0 ? n : 0), p.y + Math.round(ty - p.ay)); }
    if (im2 && p2) { const g = n ? narrow(im2, n * 2) : im2; return fd.drawImage(g, p2.x + Math.round((tx + dx) * 2 - p2.ax) + (n && turn > 0 ? n * 2 : 0), p2.y + Math.round(ty * 2 - p2.ay)); }
    const g = n ? narrow(im, n) : im; fd.drawImage(g, (p.x + Math.round(tx + dx - p.ax) + (n && turn > 0 ? n : 0)) * 2, (p.y + Math.round(ty - p.ay)) * 2, g.width * 2, g.height * 2);   // 2倍の絵がない部品（表情の差分など）は、1倍の絵を2倍に広げる
  };
  const put = (im, p, tx, ty, im2, p2) => putK(im, p, tx, ty, 0, 0, im2, p2);
  const x2 = (c, k) => (J.chars[c].pieces[k]?.x2 ? [IM[c][k + '@2x'], J.chars[c].pieces[k].x2] : [null, null]);   // n 列ぬいて、外がわのはしをそろえて置く
  if (L.cheek) { const Q = J.chars[L.cheek].pieces, X = half(v.cheekGap); for (const s of ['L', 'R']) put(IM[L.cheek]['cheek' + s], Q['cheek' + s], X[s], v.eyeY + v.cheekDy + (Q['cheek' + s].ay - mean(Q, 'cheek')), ...x2(L.cheek, 'cheek' + s)); }
  const E = J.chars[L.eye].pieces, EX = half(v.eyeGap), B = J.chars[L.brow].pieces;
  // 表情：目・まゆの差分（アンカーは、ふだんの目・まゆと同じ）。まばたき（L.blink）は「閉じる」の目
  const F = FACE[L.face] || {}, eid = L.blink && !['close', 'smile'].includes(F.eye) ? 'close' : F.eye, ev = eid && (J.chars[L.eye].eyes || []).find(q => q.id === eid), bv = F.brow && (J.chars[L.brow].brows || []).find(q => q.id === F.brow);
  for (const s of ['L', 'R']) {
    const ep = ev?.[s] ? ev[s] : E['eye' + s], ei = ev?.[s] ? IM[L.eye][`eye${s}_${eid}`] : IM[L.eye]['eye' + s];
    const [e2, ep2] = ev?.[s] ? (ev[s].x2 ? [IM[L.eye][`eye${s}_${eid}@2x`], ev[s].x2] : [null, null]) : x2(L.eye, 'eye' + s);
    putK(tint(P, ei, 'eye', col.eye, `${L.eye}/eye${s}/${ev?.[s] ? eid : ''}`), ep, EX[s], v.eyeY + (ep.ay - mean(E, 'eye')), far(s) ? Math.round(T.eyeCut * ta) : 0, Math.round(tv * (far(s) ? T.far : T.near)), e2 && tint(P, e2, 'eye', col.eye, `${L.eye}/eye${s}@2x/${ev?.[s] ? eid : ''}`), ep2);
    const bp = bv?.[s] ? bv[s] : B['brow' + s], bi = bv?.[s] ? IM[L.brow][`brow${s}_${F.brow}`] : IM[L.brow]['brow' + s];
    putK(bi, bp, EX[s] + (B['brow' + s].ax - B['eye' + s].ax), v.eyeY + v.browDy + (bp.ay - mean(B, 'brow')), far(s) ? Math.round(T.browCut * ta) : 0, Math.round(tv * (far(s) ? T.far : T.near)), ...(bv?.[s] ? (bv[s].x2 ? [IM[L.brow][`brow${s}_${F.brow}@2x`], bv[s].x2] : [null, null]) : x2(L.brow, 'brow' + s)));
  }
  const M = J.chars[L.mouth], MP = M.pieces;
  const mx = cx + Math.round(tv * T.mouth);
  if (MP.nose) put(IM[L.mouth].nose, MP.nose, mx + (MP.nose.ax - M.cx), MP.nose.ay + ((v.eyeY - M.preset.eyeY) + (v.mouthY - M.preset.mouthY)) / 2, ...x2(L.mouth, 'nose'));   // 鼻は、目と口のあいだに付いて動く
  const mv = F.mouth && (J.shared.mouths || []).find(q => q.id === F.mouth);   // 共有の口：キャラ1の絵での位置。キャラ1のふだんの口からのずれを保って置く
  if (mv) put(IM.mouths[mv.id], mv, mx + (mv.ax - J.shared.cx), v.mouthY + (mv.ay - (J.shared.refMouthAy ?? J.chars[P.ids[0]].pieces.mouth.ay)));   // refMouthAy：共有の口を描いたときのキャラ1の口の高さ
  else put(IM[L.mouth].mouth, MP.mouth, mx + (MP.mouth.ax - M.cx), v.mouthY, ...x2(L.mouth, 'mouth'));
  if (sep) {   // 頭をまとめる：輪郭 → 前髪 → 顔の部品（向きのときは、それぞれを円柱として回す。前髪は顔より少し外にある）
    const all = mk(), ax = all.getContext('2d');
    // 向き：輪郭は、目の高さから下を、あごに向かって向いた側へ（あごで2ドット）。前髪は、てっぺんで2ドット、目の少し下で 0（横の毛は、あごのあたりで後ろ髪とずれないように）
    const ramp = (y, y0, y1) => Math.max(0, Math.min(1, (y - y0) / (y1 - y0)));
    const cheek = y => { const w = ramp(y, v.eyeY - 14, v.eyeY) * (1 - .5 * ramp(y, R.chin - 6, R.chin + 2)); const n = T.cheekNear * w * ta, f = T.cheekFar * w * ta; return turn > 0 ? [-n, -f] : [f, n]; };   // 目の少し上から下で、あごの先では半分
    ax.drawImage(turn ? rowShift(splitRows(rinC, Math.round(R.cx), cheek), y => tv * T.jaw * ramp(y, v.eyeY, R.chin + 2) ** 2) : rinC, 0, 0);
    ax.drawImage(turn ? rowShift(hfC, y => tv * T.hair * (1 - ramp(y, v.eyeY - 10, v.eyeY + 12))) : hfC, 0, 0); ax.drawImage(head, 0, 0);
    x.drawImage(tilt ? rotate(all, tilt, R.cx + .5, R.chin, R.chin + 40) : all, Math.round(tv * T.head), 0);   // 頭ぜんたい（輪郭・前髪・顔）を、向いた側へ
  }
  let out = c;
  if (fk === 2) {   // 顔の部品が2倍：体・髪・服（256×384）を2倍に広げ、その上に2倍の顔の部品を、頭と同じ動き（向き・かしげ）で重ねる
    out = document.createElement('canvas'); out.width = W * 2; out.height = H * 2; const o = out.getContext('2d'); o.imageSmoothingEnabled = false; o.drawImage(c, 0, 0, W * 2, H * 2);
    o.drawImage(tilt ? rotate(featC, tilt, (R.cx + .5) * 2, R.chin * 2, (R.chin + 40) * 2) : featC, Math.round(tv * T.head) * 2, 0);
  }
  const lean = Math.max(-10, Math.min(10, +L.lean || 0));
  if (lean) { const k = out.width / W, o = bend(out, lean, 128 * k, 214 * k, 40 * k), g = out.getContext('2d'); g.clearRect(0, 0, out.width, out.height); g.drawImage(o, 0, 0); }   // 腰（214 行・体のまん中）から上を、かたむける
  if (P.cache.size > 60) P.cache.delete(P.cache.keys().next().value);
  P.cache.set(key, out); return out;   // 顔の部品が2倍のときは 512×768（それ以外は 256×384）。使う側は、幅÷256 を倍率として使う
}
// 切り出す場所：顔（輪郭のまわり）と全身。[x, y, w, h]（立ち絵の中で）
export const cropOf = (P, L, kind) => { const R = P.J.chars[L.rin]; return kind === 'face' ? [R.cx - 48, Math.max(0, R.headTop - 26), 96, 108] : [56, 0, 144, 376]; };
// 立ち絵を cv に描く（kind：'face'／'body'）
export function drawLook(cv, P, L, kind = 'body') {
  const [x, y, w, h] = cropOf(P, L, kind), im = compose(P, L), k = im.width / P.J.size[0]; cv.width = w * k; cv.height = h * k; cv.getContext('2d').drawImage(im, -x * k, -y * k); return [x, y, w, h];
}
// ホーム用：色のついたコマの絵（1コマ。fw・fh つき）
export function frameCanvas(P, L) {
  const im = compose(P, L), k = im.width / P.J.size[0], c = document.createElement('canvas'); c.width = FRAME[0] * k; c.height = FRAME[1] * k; c.getContext('2d').drawImage(im, OFF[0] * k, OFF[1] * k);
  return Object.assign(c, { fw: c.width, fh: c.height, frames: 1, k });   // 顔が2倍のときは 544×752
}
// カード用：色番号の絵（R＝番号、A＝ある・なし）と、その色の表。コマは frames 個ならべる（ポーズは1つなので、どのコマも同じ絵）
function indexed(P, L, frames) {
  const key = JSON.stringify(L) + '|' + frames; if (P.tex.has(key)) return P.tex.get(key);
  // コマ：前半＝ふだん、後半＝まばたき（目を閉じた絵）。card.js の makeChara の blink（コマの半分）と同じならび
  const half = frames > 1 ? frames >> 1 : frames, cvs = [frameCanvas(P, L), frames > 1 ? frameCanvas(P, { ...L, blink: 1 }) : null].filter(Boolean), fw = cvs[0].width, fh = cvs[0].height;
  const srcs = cvs.map(q => { if (q.width === fw) return q.getContext('2d').getImageData(0, 0, fw, fh).data; const t = document.createElement('canvas'); t.width = fw; t.height = fh; const g = t.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(q, 0, 0, fw, fh); return g.getImageData(0, 0, fw, fh).data; });
  const d = new Uint8ClampedArray(fw * fh * 4 * srcs.length); srcs.forEach((q, i) => d.set(q, i * fw * fh * 4));
  // 色の表は 256 色まで。色が多いとき（髪の色を変えた・キャラ3のように色の多い絵）は、多く使われている色から 256 色をえらび、残りはいちばん近い色にまとめる
  //   （前は、上から見つかった順に 256 色を取っていたので、髪の色ばかりで表が埋まり、肌や服が髪の色に寄って青くなった）
  const n = new Map(); for (let q = 0; q < d.length; q += 4) if (d[q + 3] >= 128) { const k = (d[q] << 16) | (d[q + 1] << 8) | d[q + 2]; n.set(k, (n.get(k) || 0) + 1); }
  const keys = [...n.keys()].sort((a, b) => n.get(b) - n.get(a)), pal = keys.slice(0, 256).map(k => [k >> 16, (k >> 8) & 255, k & 255]), ids = new Map(keys.slice(0, 256).map((k, i) => [k, i]));
  for (const k of keys.slice(256)) { const r = k >> 16, g = (k >> 8) & 255, b = k & 255; let best = 0, bd = 1e9; pal.forEach((c, j) => { const e = 2 * (c[0] - r) ** 2 + 4 * (c[1] - g) ** 2 + 3 * (c[2] - b) ** 2; if (e < bd) { bd = e; best = j; } }); ids.set(k, best); }
  const out = new ImageData(fw * frames, fh), o = out.data, N = fw * fh * 4;
  for (let f = 0; f < frames; f++) { const off = (srcs.length > 1 && f >= half ? 1 : 0) * N;
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
      const q = off + (y * fw + x) * 4; if (d[q + 3] < 128) continue; const t = (y * fw * frames + f * fw + x) * 4;
      o[t] = ids.get((d[q] << 16) | (d[q + 1] << 8) | d[q + 2]); o[t + 3] = 255;
    } }
  const c = document.createElement('canvas'); c.width = fw * frames; c.height = fh; c.getContext('2d').putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  if (P.tex.size > 12) { const k0 = P.tex.keys().next().value; P.tex.get(k0).tex.dispose(); P.tex.delete(k0); }
  const r = { tex: t, pal, size: [fw, fh] }; P.tex.set(key, r); return r;
}
// カードのキャラに、その見た目の絵を入れる。返り値：その絵の色の表（名所ごとの色づけは、呼ぶ側でかける）。ch：card.js の makeChara の返り値
export function applyParts(P, ch, st) {
  const L = lookOf(P, st), key = JSON.stringify(L);
  if (ch.partsKey !== key) { ch.partsKey = key; const r = indexed(P, L, ch.frames || 1); ch.pal2 = r.pal; ch.ext = 0; ch.setLods([{ s: 2, tex: r.tex, size: r.size }]); }
  return ch.pal2;
}
