// キャラの層を重ねる（2026-11-26）。体は1つで、髪型と腕（ポーズ）を別の絵で持ち、重ねてコマの絵を作る
//   絵は描き足さない。assets/chara/ の層（色番号の絵）を、決まった順に重ねるだけ：体 → 髪 → 腕
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
    await Promise.all(['close', 'normal'].flatMap(lod => ['body', 'arms', 'hair'].map(async k => { L[k + '_' + lod] = await pixels(k + '_' + lod); })));
    return { J, L, sheets: {}, tex: {} };
  })().catch(e => { parts = null; throw e; }));
}
export const hairList = P => [{ id: '', name: 'ベリーショート' }, ...P.J.hairs];
// ふだんの髪型（ホームのお着替え）と、そのカードの髪型（カードに残した見た目があればそれ。前に撮ったカードは、髪型がなければ元の短い髪のまま）
export const charaHair = () => settings.charaHair || '';
export function setCharaHair(id) { if (id) settings.charaHair = id; else delete settings.charaHair; saveSettings(); }
export const lookHair = st => (st?.look ? st.look.hair || '' : charaHair());

// 髪型 hair・細かさ lod（'close'／'normal'）のコマの絵（色番号の絵。横にポーズのコマが並ぶ）
export function sheet(P, hair, lod) {
  const key = hair + '|' + lod; if (P.sheets[key]) return P.sheets[key];
  const [fw, fh] = P.J[lod], n = P.J.poses, hi = P.J.hairs.findIndex(h => h.id === hair);
  const body = P.L['body_' + lod].data, arms = P.L['arms_' + lod].data, hairs = P.L['hair_' + lod], hw = hairs.width;
  const out = new ImageData(fw * n, fh), o = out.data, aw = fw * n;
  for (let f = 0; f < n; f++) for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
    const k = (y * aw + f * fw + x) * 4, b = (y * fw + x) * 4, a = (y * aw + f * fw + x) * 4;
    let v = -1;
    if (body[b + 3] > 127) v = body[b];
    if (hi >= 0) { const h = (y * hw + hi * fw + x) * 4; if (hairs.data[h + 3] > 127) v = hairs.data[h]; }
    if (arms[a + 3] > 127) v = arms[a];
    if (v >= 0) { o[k] = v; o[k + 3] = 255; }
  }
  const c = document.createElement('canvas'); c.width = aw; c.height = fh; c.getContext('2d').putImageData(out, 0, 0);
  return (P.sheets[key] = Object.assign(c, { fw, fh, frames: n, px: out }));
}
// カードのキャラに、その見た目（髪型）の絵を入れる。ch：card.js の makeChara の返り値。見た目が変わったときだけ絵を作り直す
export function applyParts(P, ch, st) {
  const hair = lookHair(st); if (ch.partsKey === hair) return; ch.partsKey = hair;
  const tex = lod => { const k = hair + '|' + lod; if (!P.tex[k]) { const t = new THREE.CanvasTexture(sheet(P, hair, lod)); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; P.tex[k] = t; } return P.tex[k]; };
  ch.setLods([{ s: 1, tex: tex('normal'), size: P.J.normal }, { s: 2, tex: tex('close'), size: P.J.close }]);
}
