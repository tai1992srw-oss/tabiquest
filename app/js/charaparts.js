// キャラの層を重ねる（2026-11-26）。体は1つで、髪型と腕（ポーズ）を別の絵で持ち、重ねてコマの絵を作る
//   絵は描き足さない。assets/chara/ の層（色番号の絵）を、決まった順に重ねるだけ：体 → 衣装（くつ下・くつ・スカート・上の胴）→ 髪 → 腕 → そで
//   衣装の番号（look.outfit）：'' ＝ 元のインナー、'u01' など ＝ parts.json の outfits の id（outfit の絵は衣装ごとに1コマ、sleeve の絵は衣装ごとに腕のコマ数ぶん）
//   parts.json：{ close:[1コマの幅, 高さ]（寄り用・360ドット）, normal（ふだん用・半分）, poses：腕のコマ数, hairs：[{ id, name }]（髪の絵のコマの順） }
//   髪型の番号（look.hair）：'' ＝ 元のごく短い髪、'h02' など ＝ hairs の id
import { settings, saveSettings } from './store.js';
const THREE = window.THREE;
const BASE = 'assets/chara/';
let parts = null;
async function pixels(name) {
  const im = new Image(); im.src = BASE + name + '.png'; await im.decode();
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0);
  return x.getImageData(0, 0, im.width, im.height);
}
export function loadParts() {
  return parts || (parts = (async () => {
    const J = await (await fetch(BASE + 'parts.json')).json(), L = {};
    await Promise.all(['close', 'normal'].flatMap(lod => ['body', 'arms', 'hair', 'face'].map(async k => { L[k + '_' + lod] = await pixels(k + '_' + lod); })));
    // 服は1着ごとに1枚の絵（wear/<番号>_close.png）。コマの順は J.wearCols（トップス・ボトムス・くつ下・くつ・装飾品）のあとに、そで（腕のコマと同じ順）
    //   色番号だけを持つ（1ドット1バイト。255＝なし）。着の数が多いので、メモリを小さくするため
    const W = {};
    await Promise.all(['close', 'normal'].flatMap(lod => (J.outfits || []).map(async u => {
      const im = await pixels('wear/' + u.id + '_' + lod), d = new Uint8Array(im.width * im.height);
      for (let i = 0; i < d.length; i++) d[i] = im.data[i * 4 + 3] > 127 ? im.data[i * 4] : 255;
      W[u.id + '_' + lod] = { d, w: im.width };
    })));
    wearIds = Object.fromEntries(WEAR_KEYS.map(k => [k, new Set((J.wear?.[k] || []).map(u => u.id))]));
    return { J, L, W, sheets: {}, tex: {} };
  })().catch(e => { parts = null; throw e; }));
}
export const hairList = P => [{ id: '', name: 'ベリーショート' }, ...P.J.hairs];
// ふだんの髪型（ホームのお着替え）と、そのカードの髪型（カードに残した見た目があればそれ。前に撮ったカードは、髪型がなければ元の短い髪のまま）
export const charaHair = () => settings.charaHair || '';
export function setCharaHair(id) { if (id) settings.charaHair = id; else delete settings.charaHair; saveSettings(); }
export const lookHair = st => (st?.look ? st.look.hair || '' : charaHair());
export const outfitList = P => [{ id: '', name: 'インナー' }, ...(P.J.outfits || [])];
// 衣装は部位ごと（トップス・ボトムス・くつ下・くつ）。look.outfit は1つの文字：'' ＝ ぜんぶインナー、'u01' ＝ 上下そろい（セット）、'u01..u01.' のように「トップス.ボトムス.くつ下.くつ」
//   装飾品（マフラーなど）は5つめ：'c16.c16.c16.c16.c16'。その着にない部位（ワンピースのボトムスなど）は ''（インナー・なし）になる
export const WEAR_KEYS = ['top', 'bottom', 'socks', 'shoes', 'acc'];
let wearIds = null;   // 部位ごとの、ある番号（parts.json を読んだあと）
const has = (k, id) => !!id && (!wearIds || wearIds[k].has(id));
export function wearOf(outfit) { const s = outfit || '', a = s.includes('.') ? s.split('.') : WEAR_KEYS.map(() => s); return Object.fromEntries(WEAR_KEYS.map((k, i) => [k, has(k, a[i]) ? a[i] : ''])); }
export function packWear(w) {
  const ids = [...new Set(WEAR_KEYS.map(k => w[k] || '').filter(Boolean))];
  if (!ids.length) return '';
  if (ids.length === 1 && WEAR_KEYS.every(k => (w[k] || '') === (has(k, ids[0]) ? ids[0] : ''))) return ids[0];   // その着のパーツがぜんぶそろっている＝セット
  return WEAR_KEYS.map(k => w[k] || '').join('.');
}
export const charaOutfit = () => settings.charaOutfit || '';
export function setCharaOutfit(id) { if (id) settings.charaOutfit = id; else delete settings.charaOutfit; saveSettings(); }
export const lookOutfit = st => (st?.look ? st.look.outfit || '' : charaOutfit());
// 表情（目・まゆ・口だけの層）：撮影でえらぶ（st.photo.face）。'' ＝ 元のほほえみ
export const faceList = P => [{ id: '', name: 'ほほえみ' }, ...(P.J.faces || [])];
export const lookFace = st => st?.photo?.face || '';

// 髪型 hair・細かさ lod（'close'／'normal'）のコマの絵（色番号の絵。横にポーズのコマが並ぶ）
//   face：表情の番号。コマは「ポーズ n 個」のうしろに「同じポーズのまばたき n 個」（目のあたりだけ「目をとじる」の層に替える。目を閉じた表情は、まばたきなし）
export function sheet(P, hair, lod, outfit = '', face = '') {
  const key = hair + '|' + outfit + '|' + face + '|' + lod; if (P.sheets[key]) return P.sheets[key];
  const [fw, fh] = P.J[lod], n = P.J.poses, hi = P.J.hairs.findIndex(h => h.id === hair), W = wearOf(outfit), cols = P.J.wearCols || WEAR_KEYS;
  // 体に着せる順：くつ下 → くつ → ボトムス → トップス → 装飾品。サスペンダーやジャンパースカートのように、上に重ねるボトムス（J.over）は、トップスのあと
  const ord = (P.J.over || []).includes(W.bottom) ? ['socks', 'shoes', 'top', 'bottom', 'acc'] : ['socks', 'shoes', 'bottom', 'top', 'acc'];
  const under = ord.filter(k => W[k] && P.W[W[k] + '_' + lod]).map(k => [P.W[W[k] + '_' + lod], cols.indexOf(k)]), slv = W.top ? P.W[W.top + '_' + lod] : null, sc = cols.length;
  const body = P.L['body_' + lod].data, arms = P.L['arms_' + lod].data, hairs = P.L['hair_' + lod], hw = hairs.width;
  const faces = P.L['face_' + lod], fl = P.J.faces || [], fi = fl.findIndex(q => q.id === face), bi = (P.J.closed || []).includes(face) ? -1 : fl.findIndex(q => q.id === P.J.blink);
  const by = (P.J.blinkY?.close ?? 0) * (lod === 'close' ? 1 : .5), src = arms.length / 4 / fh;   // by：この行より上だけ、まばたきの層を使う。src：腕の絵の幅
  const out = new ImageData(fw * n * 2, fh), o = out.data, aw = fw * n * 2;
  for (let f = 0; f < n * 2; f++) for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
    const pf = f % n, k = (y * aw + f * fw + x) * 4, b = (y * fw + x) * 4, a = (y * src + pf * fw + x) * 4;
    let v = -1;
    if (body[b + 3] > 127) v = body[b];
    for (const [wl, i] of under) { const q = wl.d[y * wl.w + i * fw + x]; if (q !== 255) v = q; }
    if (fi >= 0) { const q = (y * faces.width + fi * fw + x) * 4; if (faces.data[q + 3] > 127) v = faces.data[q]; }
    if (f >= n && bi >= 0 && y < by) { const q = (y * faces.width + bi * fw + x) * 4; if (faces.data[q + 3] > 127) v = faces.data[q]; }
    if (hi >= 0) { const h = (y * hw + hi * fw + x) * 4; if (hairs.data[h + 3] > 127) v = hairs.data[h]; }
    if (arms[a + 3] > 127) v = arms[a];
    if (slv) { const q = slv.d[y * slv.w + (sc + pf) * fw + x]; if (q !== 255) v = q; }
    if (v >= 0) { o[k] = v; o[k + 3] = 255; }
  }
  const c = document.createElement('canvas'); c.width = aw; c.height = fh; c.getContext('2d').putImageData(out, 0, 0);
  return (P.sheets[key] = Object.assign(c, { fw, fh, frames: n * 2, blink: n, px: out }));
}
// カードのキャラに、その見た目（髪型）の絵を入れる。ch：card.js の makeChara の返り値。見た目が変わったときだけ絵を作り直す
export function applyParts(P, ch, st) {
  const hair = lookHair(st), outfit = lookOutfit(st), face = lookFace(st), key = hair + '|' + outfit + '|' + face; if (ch.partsKey === key) return; ch.partsKey = key;
  const tex = lod => { const k = key + '|' + lod; if (!P.tex[k]) { const t = new THREE.CanvasTexture(sheet(P, hair, lod, outfit, face)); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; P.tex[k] = t; } return P.tex[k]; };
  ch.setLods([{ s: 1, tex: tex('normal'), size: P.J.normal }, { s: 2, tex: tex('close'), size: P.J.close }]);
}
