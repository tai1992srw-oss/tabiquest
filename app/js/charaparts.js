// キャラの層を重ねる（2026-11-26）。体は1つで、髪型と腕（ポーズ）を別の絵で持ち、重ねてコマの絵を作る
//   絵は描き足さない。assets/chara/ の層（色番号の絵）を、決まった順に重ねるだけ：体 → 衣装（くつ下・くつ・スカート・上の胴）→ 髪 → 腕 → そで
//   衣装の番号（look.outfit）：'' ＝ 元のインナー、'u01' など ＝ parts.json の outfits の id（outfit の絵は衣装ごとに1コマ、sleeve の絵は衣装ごとに腕のコマ数ぶん）
//   parts.json：{ close:[1コマの幅, 高さ]（寄り用・360ドット）, normal（ふだん用・半分）, poses：腕のコマ数, hairs：[{ id, name }]（髪の絵のコマの順） }
//   髪型の番号（look.hair）：'' ＝ 元のごく短い髪、'h02' など ＝ hairs の id
//   顔のタイプ（look.kao）：'' ＝ キャラ1の顔、'k2' など ＝ kaos の id（目・まゆ・口だけの層。下の「顔のタイプ」）
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
    await Promise.all(['close', 'normal'].flatMap(lod => ['body', 'arms', 'hair', 'face', 'zone', ...(J.kaos?.length ? ['kao'] : [])].map(async k => { L[k + '_' + lod] = await pixels(k + '_' + lod); })));
    // 服は1着ごとに1枚の絵（wear/<番号>_close.png）。コマの順は J.wearCols（トップス・ボトムス・くつ下・くつ・装飾品）のあとに、そで（腕のコマと同じ順）
    //   色番号だけを持つ（1ドット1バイト。255＝なし）。着の数が多いので、メモリを小さくするため
    const W = {};
    await Promise.all(['close', 'normal'].flatMap(lod => (J.outfits || []).map(async u => {
      const im = await pixels('wear/' + u.id + '_' + lod), d = new Uint8Array(im.width * im.height);
      for (let i = 0; i < d.length; i++) d[i] = im.data[i * 4 + 3] > 127 ? im.data[i * 4] : 255;
      W[u.id + '_' + lod] = { d, w: im.width };
    })));
    wearIds = Object.fromEntries(WEAR_KEYS.map(k => [k, new Set((J.wear?.[k] || []).map(u => u.id))]));
    // 線の色（暗い色）の表：体型を変えるとき、細い線が消えないように優先する
    const dark = new Uint8Array(256); try { const D = await (await fetch('assets/kamakura/data.json')).json(); D.pal.chara.forEach((c, i) => { if (c[0] + c[1] + c[2] < 300) dark[i] = 1; }); } catch (e) {}
    return { J, L, W, dark, sheets: {}, tex: {} };
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
//   顔のタイプ kao があるとき（キャラ2の顔など）は、その顔だけの表情（照れ・ジト目）を足す。'' の名前は、その顔の「ふだん」
export const faceList = (P, kao = '') => { const K = kaoOf(P, kao); return [{ id: '', name: K ? 'ふだん' : 'ほほえみ' }, ...(P.J.faces || []), ...(K?.extra || [])]; };
export const lookFace = st => st?.photo?.face || '';
// 顔のタイプ（2026-11-26）：キャラごとの、目・まゆ・口の形。look.kao：'' ＝ キャラ1の顔（体の絵のまま）、'k2' ＝ キャラ2の顔。頭の形・髪・体・服は、どの顔でも同じ絵を使う
//   絵は kao_close／kao_normal（顔ごと・表情ごとのコマ。場所は parts.json の kaos[].faces）。体の絵の「顔の中だけ」を置きかえる層
export const kaoList = P => [{ id: '', name: 'キャラ1の顔' }, ...(P.J.kaos || [])];
const kaoOf = (P, kao) => (kao ? (P.J.kaos || []).find(k => k.id === kao) : null) || null;
export const charaKao = () => settings.charaKao || '';
export const lookKao = st => (st?.look ? st.look.kao || '' : charaKao());
// 表情の層のえらび方：{ img：絵, fi：表情のコマ（−1＝なし）, bi：まばたきのコマ（−1＝なし）, by：この行より上だけまばたきに替える, swap：まばたきのとき表情の層のかわりに使う（重ねない） }
function faceSel(P, lod, face, kao) {
  const K = kaoOf(P, kao), k = lod === 'close' ? 1 : .5, closed = (P.J.closed || []).includes(face);
  if (K) { const fi = K.faces[face] ?? K.faces[''] ?? -1; return { img: P.L['kao_' + lod], fi, bi: closed ? -1 : K.faces[P.J.blink] ?? -1, by: (K.blinkY ?? P.J.blinkY?.close ?? 0) * k, swap: true }; }
  const fl = P.J.faces || []; return { img: P.L['face_' + lod], fi: fl.findIndex(q => q.id === face), bi: closed ? -1 : fl.findIndex(q => q.id === P.J.blink), by: (P.J.blinkY?.close ?? 0) * k, swap: false };
}

// ---- 体型（2026-11-26）：頭の大きさ・脚の長さ・あごの長さを、絵を重ねるときに伸び縮みさせる。絵は描き足さない ----
//   look.shape：'' ＝ 元のまま、'1,-1,0' のように「頭,脚,あご」の段（−2〜2）。頭＝あごの下を軸に大きく／小さく、脚＝腰〜足首の行を足す／抜く、あご＝口の上〜あごの下の行を足す／抜く
//   背が高くなると元のコマ（寄りで 272×376）に入らないので、体型を変えた絵はコマを上へ EXT 行のばす（足もとは下のまま）。カードでは look.js の placeChara が、その分だけ絵を上へのばして置く
export const SHAPE = { head: [.88, .94, 1, 1.1, 1.2], leg: [.82, .9, 1, 1.08, 1.15], jaw: [.78, .88, 1, 1.15, 1.3] };
const EXT = { close: 40, normal: 20 };
export const shapeSteps = s => { const a = String(s || '').split(',').map(v => Math.max(-2, Math.min(2, v | 0))); return [a[0] || 0, a[1] || 0, a[2] || 0]; };
export const packShape = (h, l, j) => (h || l || j ? `${h},${l},${j}` : '');
export function shapeOf(s) { const [a, b, c] = shapeSteps(s); return a || b || c ? { h: SHAPE.head[a + 2], l: SHAPE.leg[b + 2], j: SHAPE.jaw[c + 2], key: packShape(a, b, c) } : null; }
export const charaShape = () => settings.charaShape || '';
export const lookShape = st => (st?.look ? st.look.shape || '' : charaShape());
// 立ちの体の行（寄りの絵で）：あごの下 91・口の上 73・腰 205・足首 350、首のまん中の x 138
function geom(P, lod, sh) {
  const k = lod === 'close' ? 1 : .5, [fw, fh] = P.J[lod], R = v => Math.round(v * k), NECK = R(91), JAW = R(73), HIP = R(205), ANK = R(350), ext = EXT[lod];
  const r = []; for (let y = NECK; y < HIP; y++) r.push(y);
  const ln = Math.max(1, Math.round((ANK - HIP) * sh.l)); for (let i = 0; i < ln; i++) r.push(HIP + Math.min(ANK - HIP - 1, Math.floor(i * (ANK - HIP) / ln)));
  for (let y = ANK; y < fh; y++) r.push(y);
  const FH2 = fh + ext, neckP = FH2 - r.length, dy = neckP - NECK;   // neckP：新しい絵での、あごの下の行。dy：首より上の行をずらす量
  const jn = Math.max(2, Math.round((NECK - JAW) * sh.j)), jr = []; for (let y = 0; y < JAW; y++) jr.push(y);
  for (let i = 0; i < jn; i++) jr.push(JAW + Math.min(NECK - JAW - 1, Math.floor(i * (NECK - JAW) / jn)));
  return { fw, fh, FH2, ext, NECK, r, neckP, dy, jr, jd: jn - (NECK - JAW), CX: 138 * k, h: sh.h };
}
// お着替えの画面などで、切り出す場所を合わせるための数字。ext：上へのばした行、dy：顔が元の絵の行から動いた量、up：頭のてっぺんがさらに上がる量
export function shapeInfo(P, lod, shape) {
  const sh = shapeOf(shape); if (!sh) return null; const g = geom(P, lod, sh);
  return { ext: g.ext, dy: g.dy, up: Math.round((sh.h - 1) * g.NECK * .85 + g.jd * sh.h) };
}
function sheetShape(P, hair, lod, outfit, face, sh, kao) {
  const key = hair + '|' + outfit + '|' + face + '|' + lod + '|' + sh.key + '|' + kao; if (P.sheets[key]) return P.sheets[key];
  const G = geom(P, lod, sh), { fw, fh, FH2, NECK, r, neckP, dy, jr } = G, n = P.J.poses, hi = P.J.hairs.findIndex(h => h.id === hair), W = wearOf(outfit), cols = P.J.wearCols || WEAR_KEYS;
  const ord = (P.J.over || []).includes(W.bottom) ? ['socks', 'shoes', 'top', 'bottom', 'acc'] : ['socks', 'shoes', 'bottom', 'top', 'acc'];
  const under = ord.filter(k => W[k] && P.W[W[k] + '_' + lod]).map(k => [P.W[W[k] + '_' + lod], cols.indexOf(k)]), slv = W.top ? P.W[W.top + '_' + lod] : null, sc = cols.length;
  const af = W.acc ? P.W[W.acc + '_' + lod] : null, afc = cols.indexOf('acc'), zone = P.L['zone_' + lod];
  const body = P.L['body_' + lod].data, arms = P.L['arms_' + lod].data, hairs = P.L['hair_' + lod], hw = hairs.width;
  const { img: faces, fi, bi, by, swap } = faceSel(P, lod, face, kao), src = arms.length / 4 / fh;
  // 頭の絵を先に作る（どのポーズでも同じ）。1マスを 3×3 に見て、多い色を取る。線の色は 3つ以上あれば優先
  const top0 = NECK - jr.length, cnt = new Int16Array(256), OFF = [1 / 6, .5, 5 / 6];
  const headImg = get => {
    const o = new Int16Array(fw * FH2).fill(-1);
    for (let y = 0; y < FH2; y++) for (let x = 0; x < fw; x++) {
      const seen = []; let solid = 0;
      for (const oy of OFF) { const yy = Math.floor((y + oy - neckP) / G.h + neckP) - dy, sy = yy >= NECK ? yy : (yy - top0 >= 0 ? jr[yy - top0] : -1); if (sy < 0 || sy >= fh) continue;
        for (const ox of OFF) { const sx = Math.floor((x + ox - G.CX) / G.h + G.CX); if (sx < 0 || sx >= fw) continue; const v = get(sx, sy); if (v < 0) continue; solid++; if (!cnt[v]) seen.push(v); cnt[v]++; } }
      if (solid >= 5) { let best = seen[0], bd = -1; for (const v of seen) { if (cnt[v] > cnt[best]) best = v; if (P.dark[v] && cnt[v] >= 3 && (bd < 0 || cnt[v] > cnt[bd])) bd = v; } o[y * fw + x] = bd >= 0 ? bd : best; }
      for (const v of seen) cnt[v] = 0;
    }
    return o;
  };
  const skin = headImg((x, y) => (y < NECK && body[(y * fw + x) * 4 + 3] > 127 ? body[(y * fw + x) * 4] : -1));
  const feat = blink => headImg((x, y) => {
    let v = -1;
    const bl = blink && bi >= 0 && y < by;
    if (fi >= 0 && !(bl && swap)) { const q = (y * faces.width + fi * fw + x) * 4; if (faces.data[q + 3] > 127) v = faces.data[q]; }
    if (bl) { const q = (y * faces.width + bi * fw + x) * 4; if (faces.data[q + 3] > 127) v = faces.data[q]; }
    if (hi >= 0) { const h = (y * hw + hi * fw + x) * 4; if (hairs.data[h + 3] > 127) v = hairs.data[h]; }
    return v;
  });
  const F0 = feat(false), F1 = bi >= 0 ? feat(true) : F0;
  const out = new ImageData(fw * n * 2, FH2), o = out.data, aw = fw * n * 2;
  for (let f = 0; f < n * 2; f++) { const pf = f % n, F = f >= n ? F1 : F0;
    for (let y = 0; y < FH2; y++) { const yb = y >= neckP ? r[y - neckP] : y - dy;   // 体・服・腕は、この行の元の行
      for (let x = 0; x < fw; x++) {
        let v = -1; const hk = y * fw + x;
        if (yb >= NECK) { const b = (yb * fw + x) * 4; if (body[b + 3] > 127) v = body[b]; }
        if (skin[hk] >= 0) v = skin[hk];
        if (yb >= 0) for (const [wl, i] of under) { const q = wl.d[yb * wl.w + i * fw + x]; if (q !== 255) v = q; }
        if (F[hk] >= 0) v = F[hk];
        if (yb >= 0) {
          const a = (yb * src + pf * fw + x) * 4, front = af && af.d[yb * af.w + afc * fw + x] !== 255 && zone.data[(yb * zone.width + pf * fw + x) * 4 + 3] > 127;
          if (!front && arms[a + 3] > 127) v = arms[a];
          if (slv && !front) { const q = slv.d[yb * slv.w + (sc + pf) * fw + x]; if (q !== 255) v = q; }
        }
        if (v >= 0) { const k = (y * aw + f * fw + x) * 4; o[k] = v; o[k + 3] = 255; }
      } } }
  const c = document.createElement('canvas'); c.width = aw; c.height = FH2; c.getContext('2d').putImageData(out, 0, 0);
  return (P.sheets[key] = Object.assign(c, { fw, fh: FH2, frames: n * 2, blink: n, px: out, ext: G.ext }));
}

// 髪型 hair・細かさ lod（'close'／'normal'）のコマの絵（色番号の絵。横にポーズのコマが並ぶ）
//   face：表情の番号。コマは「ポーズ n 個」のうしろに「同じポーズのまばたき n 個」（目のあたりだけ「目をとじる」の層に替える。目を閉じた表情は、まばたきなし）
export function sheet(P, hair, lod, outfit = '', face = '', shape = '', kao = '') {
  if (!kaoOf(P, kao)) kao = '';
  const sh = shapeOf(shape); if (sh) return sheetShape(P, hair, lod, outfit, face, sh, kao);
  const key = hair + '|' + outfit + '|' + face + '|' + lod + (kao ? '||' + kao : ''); if (P.sheets[key]) return P.sheets[key];
  const [fw, fh] = P.J[lod], n = P.J.poses, hi = P.J.hairs.findIndex(h => h.id === hair), W = wearOf(outfit), cols = P.J.wearCols || WEAR_KEYS;
  // 体に着せる順：くつ下 → くつ → ボトムス → トップス → 装飾品。サスペンダーやジャンパースカートのように、上に重ねるボトムス（J.over）は、トップスのあと
  const ord = (P.J.over || []).includes(W.bottom) ? ['socks', 'shoes', 'top', 'bottom', 'acc'] : ['socks', 'shoes', 'bottom', 'top', 'acc'];
  const under = ord.filter(k => W[k] && P.W[W[k] + '_' + lod]).map(k => [P.W[W[k] + '_' + lod], cols.indexOf(k)]), slv = W.top ? P.W[W.top + '_' + lod] : null, sc = cols.length;
  const af = W.acc ? P.W[W.acc + '_' + lod] : null, afc = cols.indexOf('acc'), zone = P.L['zone_' + lod];   // 装飾品は「肩〜ひじ」より前・「ひじ〜手」より後ろ。zone：ポーズごとの「肩〜ひじ」の側
  const body = P.L['body_' + lod].data, arms = P.L['arms_' + lod].data, hairs = P.L['hair_' + lod], hw = hairs.width;
  const { img: faces, fi, bi, by, swap } = faceSel(P, lod, face, kao), src = arms.length / 4 / fh;   // by：この行より上だけ、まばたきの層を使う。src：腕の絵の幅
  const out = new ImageData(fw * n * 2, fh), o = out.data, aw = fw * n * 2;
  for (let f = 0; f < n * 2; f++) for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
    const pf = f % n, k = (y * aw + f * fw + x) * 4, b = (y * fw + x) * 4, a = (y * src + pf * fw + x) * 4;
    let v = -1;
    if (body[b + 3] > 127) v = body[b];
    for (const [wl, i] of under) { const q = wl.d[y * wl.w + i * fw + x]; if (q !== 255) v = q; }
    const bl = f >= n && bi >= 0 && y < by;   // まばたきのコマの、目のあたり
    if (fi >= 0 && !(bl && swap)) { const q = (y * faces.width + fi * fw + x) * 4; if (faces.data[q + 3] > 127) v = faces.data[q]; }
    if (bl) { const q = (y * faces.width + bi * fw + x) * 4; if (faces.data[q + 3] > 127) v = faces.data[q]; }
    if (hi >= 0) { const h = (y * hw + hi * fw + x) * 4; if (hairs.data[h + 3] > 127) v = hairs.data[h]; }
    const front = af && af.d[y * af.w + afc * fw + x] !== 255 && zone.data[(y * zone.width + pf * fw + x) * 4 + 3] > 127;   // ここは装飾品が腕・そでの前（下に描いた装飾品と、その上の髪をそのまま見せる）
    if (!front && arms[a + 3] > 127) v = arms[a];
    if (slv && !front) { const q = slv.d[y * slv.w + (sc + pf) * fw + x]; if (q !== 255) v = q; }
    if (v >= 0) { o[k] = v; o[k + 3] = 255; }
  }
  const c = document.createElement('canvas'); c.width = aw; c.height = fh; c.getContext('2d').putImageData(out, 0, 0);
  return (P.sheets[key] = Object.assign(c, { fw, fh, frames: n * 2, blink: n, px: out }));
}
// カードのキャラに、その見た目（髪型）の絵を入れる。ch：card.js の makeChara の返り値。見た目が変わったときだけ絵を作り直す
export function applyParts(P, ch, st) {
  const hair = lookHair(st), outfit = lookOutfit(st), face = lookFace(st), shape = shapeOf(lookShape(st))?.key || '', kao = lookKao(st), key = hair + '|' + outfit + '|' + face + '|' + shape + '|' + kao; if (ch.partsKey === key) return; ch.partsKey = key;
  const tex = lod => { const k = key + '|' + lod; if (!P.tex[k]) { const t = new THREE.CanvasTexture(sheet(P, hair, lod, outfit, face, shape, kao)); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; P.tex[k] = t; } return P.tex[k]; };
  const size = lod => [P.J[lod][0], P.J[lod][1] + (shape ? EXT[lod] : 0)];
  ch.ext = shape ? EXT.close / P.J.close[1] : 0;   // 体型を変えた絵は、コマが上へこの割合だけ長い（placeChara が、その分だけ上へのばして置く）
  ch.setLods([{ s: 1, tex: tex('normal'), size: size('normal') }, { s: 2, tex: tex('close'), size: size('close') }]);
}
