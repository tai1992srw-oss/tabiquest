// 撮影の画面（カメラ）の小さな絵：ポーズと表情を、いまの見た目のまま切り出して見せる（2026-11-26）
//   絵は描き足さない。assets/chara/ の層を重ねた絵（charaparts.js の sheet）に、色の置きかえ（characolor.js）をかけて写すだけ（dress.js の draw と同じやり方）
import { loadParts, sheet } from './charaparts.js';
import { recolorChara } from './characolor.js';

let dataP = null;
export const loadThumbData = () => dataP || (dataP = Promise.all([loadParts(), fetch('assets/kamakura/data.json').then(r => r.json())]).then(([P, D]) => ({ P, D })).catch(e => { dataP = null; throw e; }));

// 見た目 L（{ colors, hair, outfit }）・表情 face の、f コマ目の絵から crop＝[x, y, w, h] を cv に描く
function draw(cv, { P, D }, L, face, lod, f, crop) {
  const src = sheet(P, L.hair || '', lod, L.outfit || '', face || '', '', L.kao || '').px, [fw] = P.J[lod], pal = D.pal.chara.map((c, i) => recolorChara(c, i, D, L.colors || {}));
  const [cx, cy, cw, ch] = crop; cv.width = cw; cv.height = ch;
  const x = cv.getContext('2d'), out = x.createImageData(cw, ch), o = out.data, p = src.data;
  for (let y = 0; y < ch; y++) for (let xx = 0; xx < cw; xx++) {
    const sx = cx + xx, sy = cy + y; if (sx < 0 || sx >= fw || sy < 0 || sy >= src.height) continue;
    const q = (sy * src.width + f * fw + sx) * 4, k = (y * cw + xx) * 4; if (p[q + 3] < 128) continue;
    const c = pal[p[q]] || [255, 0, 255]; o[k] = c[0]; o[k + 1] = c[1]; o[k + 2] = c[2]; o[k + 3] = 255;
  }
  x.putImageData(out, 0, 0);
}
// 顔のあたり：立ちのコマで、透明でない所の上から正方形に切る（髪型ごとに1回だけ調べる）
function faceBox(P, hair) {
  const k = 'camface_' + hair; if (P[k]) return P[k];
  const [fw, fh] = P.J.close, d = sheet(P, hair, 'close', '').px; let x0 = fw, x1 = 0, y0 = fh, y1 = 0;
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (d.data[(y * d.width + x) * 4 + 3] > 127) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const fs = Math.round((y1 - y0 + 1) * .44), mid = Math.round((x0 + x1) / 2);
  return (P[k] = [mid - Math.round(fs / 2), Math.max(0, y0 - 6), fs, fs]);
}
// ポーズ：ふだん用の絵の i コマ目をまるごと（見せる所は CSS で切る）。表情：寄り用の絵の顔のあたり
export const drawPose = (cv, env, L, face, i) => draw(cv, env, L, face, 'normal', i, [0, 0, env.P.J.normal[0], env.P.J.normal[1]]);
export const drawFace = (cv, env, L, face) => draw(cv, env, L, face, 'close', 0, faceBox(env.P, L.hair || ''));
