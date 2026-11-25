// キャラの色の置き換え（肌・服・目・髪）。2026-11-25
// キャラの色番号は部位ごとにまとまっている（data.json の charaRegions：{ skin:[最初, 最後], cloth, eye, hair }）。
// 選んだ色に合わせて、その部位の色だけを書き換える。明るさの段（影・光）は元の絵のまま残す。
// 絵は描き足さない。パレットの色を変えるだけ。
import { settings, saveSettings } from './store.js';
import { loadParts, sheet, hairList, charaHair, setCharaHair, outfitList, charaOutfit, setCharaOutfit } from './charaparts.js';

export const PARTS = [
  { k: 'skin', name: '肌', presets: ['#f7d6bf', '#f1c4a0', '#d9a074', '#a86c48', '#6b4330'] },
  { k: 'cloth', name: '服', presets: ['#f2f2f4', '#2a2c38', '#26345e', '#f3a6bf', '#9fd8c4', '#f4d36b'] },
  { k: 'eye', name: '目', presets: ['#3a6fd8', '#7a4a2a', '#2f8c5a', '#8a4cbc', '#c23a52', '#d4a22a'] },
  { k: 'hair', name: '髪', presets: ['#a8643c', '#2b2224', '#e6c070', '#f09ab8', '#c8ccd8', '#3b5fb8'] },
];

export const charaColors = () => settings.charaColors || {};
// そのカードの色：カードに残した見た目（look）があればそれ、なければホームで決めたふだんの色
export const lookColors = st => st?.look?.colors || charaColors();
export function setCharaColor(k, hex) {
  const c = { ...(settings.charaColors || {}) };
  if (hex) c[k] = hex; else delete c[k];
  settings.charaColors = c; saveSettings();
}

const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
function rgb2hsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function hsl2rgb([h, s, l]) {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

// D：その名所の data.json。c：元の色、i：色番号。colors：{ skin:'#rrggbb', ... }（選んでいない部位は元のまま）
export function recolorChara(c, i, D, colors = charaColors()) {
  const R = D.charaRegions, F = D.charaRef; if (!R || !F) return c;
  for (const k of ['skin', 'cloth', 'eye', 'hair', 'brow']) {
    const ck = k === 'brow' ? 'hair' : k;          // まゆ毛は髪の色に合わせる
    const r = R[k]; if (!r || i < r[0] || i > r[1] || !colors[ck] || !F[k]) continue;
    const o = rgb2hsl(c), ref = rgb2hsl(F[k]), t = rgb2hsl(hex2rgb(colors[ck]));
    const s = Math.max(0, Math.min(1, ref[1] > .15 && ref[2] < .85 ? o[1] * t[1] / ref[1] : t[1]));
    // 明るさは「基準の色（いちばん多い色）→ 選んだ色」に合わせて、影は同じ割合で暗く、光は同じ割合で明るく（明暗の順番を変えない）
    const rl = Math.min(.98, Math.max(.02, ref[2]));
    const l = Math.max(0, Math.min(1, o[2] <= rl ? o[2] * t[2] / rl : t[2] + (o[2] - rl) * (1 - t[2]) / (1 - rl) * .35));   // 基準より明るい光は、少しだけ明るく（白い服の光が白いまま残らないように）
    return hsl2rgb([t[0], s, l]);
  }
  return c;
}

// ---- 設定画面の「キャラの色」 ----
// box に、キャラの見本（寄り用の絵、立ち）と、部位ごとの色えらびを出す
let sample = null;
async function loadSample() {
  if (!sample) sample = (async () => {
    const D = await (await fetch('assets/kamakura/data.json')).json();
    const P = await loadParts(), [fw, fh] = P.J.close;   // 見本は、いまの髪型で重ねた立ちの絵（寄り用）
    return { D, P, fw, fh };
  })();
  return sample;
}
function drawSample(cv, S) {
  const pal = S.D.pal.chara.map((c, i) => recolorChara(c, i, S.D));
  const src = sheet(S.P, charaHair(), 'close', charaOutfit()).px, p = src.data, out = new ImageData(S.fw, S.fh), o = out.data;
  for (let y = 0; y < S.fh; y++) for (let x = 0; x < S.fw; x++) { const q = (y * src.width + x) * 4, k = (y * S.fw + x) * 4; if (p[q + 3] < 128) continue; const c = pal[p[q]] || [255, 0, 255]; o[k] = c[0]; o[k + 1] = c[1]; o[k + 2] = c[2]; o[k + 3] = 255; }
  const t = document.createElement('canvas'); t.width = S.fw; t.height = S.fh; t.getContext('2d').putImageData(out, 0, 0);
  const z = Math.max(1, Math.floor(260 / S.fh)) || 1, x = cv.getContext('2d');
  cv.width = S.fw * z; cv.height = S.fh * z; x.imageSmoothingEnabled = false; x.drawImage(t, 0, 0, cv.width, cv.height);
}
export async function renderCharaColors(box, onChange) {
  const cur = charaColors();
  box.innerHTML = `<h2>キャラの髪型・衣装・色（ふだんのお着替え）</h2>
    <div class="chcol"><canvas class="chprev" aria-label="キャラの見本"></canvas>
      <div class="chrows"><div class="chrow chhair"><span class="lab">髪型</span></div><div class="chrow chwear"><span class="lab">衣装</span></div>${PARTS.map(p => `<div class="chrow" data-k="${p.k}"><span class="lab">${p.name}</span>
        ${p.presets.map(h => `<button class="sw" data-c="${h}" style="background:${h}" aria-label="${p.name}を ${h} に" aria-pressed="${cur[p.k] === h}"></button>`).join('')}
        <label class="pick" aria-label="${p.name}の色を自由にえらぶ"><input type="color" value="${cur[p.k] || p.presets[0]}"></label>
        <button class="reset" data-c="" aria-pressed="${!cur[p.k]}">元の色</button></div>`).join('')}</div></div>
    <p class="note">ふだんのお着替えです。ホームのキャラと、これから手に入れるカードに使います。前に撮ったカードは、そのときの色のまま残ります。</p>`;
  const cv = box.querySelector('.chprev');
  // 髪型：絵のある髪型をならべる。えらぶと、見本とホームのキャラ・これからのカードに使う
  loadParts().then(P => {
    const row = box.querySelector('.chhair'); row.insertAdjacentHTML('beforeend', hairList(P).map(h => `<button class="hairbtn" data-hair="${h.id}" aria-pressed="${h.id === charaHair()}">${h.name}</button>`).join(''));
    row.querySelectorAll('[data-hair]').forEach(b => b.onclick = () => { setCharaHair(b.dataset.hair); row.querySelectorAll('[data-hair]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); loadSample().then(S => drawSample(cv, S)).catch(() => {}); onChange?.(); });
    const wr = box.querySelector('.chwear'); wr.insertAdjacentHTML('beforeend', outfitList(P).map(u => `<button class="hairbtn" data-wear="${u.id}" aria-pressed="${u.id === charaOutfit()}">${u.name}</button>`).join(''));
    wr.querySelectorAll('[data-wear]').forEach(b => b.onclick = () => { setCharaOutfit(b.dataset.wear); wr.querySelectorAll('[data-wear]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); loadSample().then(S => drawSample(cv, S)).catch(() => {}); onChange?.(); });
  }).catch(() => {});
  try { drawSample(cv, await loadSample()); } catch (e) { cv.replaceWith(Object.assign(document.createElement('p'), { className: 'note', textContent: 'キャラの見本を読みこめませんでした' })); }
  const set = (k, hex) => {
    setCharaColor(k, hex); const row = box.querySelector(`.chrow[data-k="${k}"]`);
    row.querySelectorAll('[data-c]').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.c || '') === (hex || ''))));
    loadSample().then(S => drawSample(cv, S)).catch(() => {}); onChange?.();
  };
  box.querySelectorAll('.chrow[data-k]').forEach(row => {
    const k = row.dataset.k;
    row.querySelectorAll('[data-c]').forEach(b => b.onclick = () => set(k, b.dataset.c || null));
    row.querySelector('input[type=color]').oninput = e => set(k, e.target.value);
  });
}
