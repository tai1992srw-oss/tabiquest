// スタイルの比べる場：Canva の見本を「何マスに縮めるか・何色にするか・ノイズをどこまで取るか」を変えて、
// 4つまで並べて比べる。絵を描き足すことはしない（元の絵を縮める・色を減らす・色味を寄せるだけ）。
// 雨・雪・明かりのまたたき・キャラの上下は演出としてコードで動かす。

const $ = s => document.querySelector(s);
const KEY = 'tabiquest:stylelab:v2';
const SLOTS = ['A', 'B', 'C', 'D'];
const BASE = { grid: 'box', w: 360, colors: 64, clean: 0, skyclean: 0, sat: 100, contrast: 100, cool: 0, shadow: 0, light: 0, chara: 32, outline: 0, fx: 'none' };
const DEF = {
  A: { ...BASE, name: 'いまに近い', colors: 160, chara: 40 },
  B: { ...BASE, name: 'ドットを見つける・64色', grid: 'refiner' },
  C: { ...BASE, name: '見つける＋影と光＋ふち', grid: 'refiner', colors: 48, skyclean: 2, shadow: 50, light: 40, chara: 24, outline: 1 },
  D: { ...BASE, name: '見つける・32色・影を青く', grid: 'refiner', colors: 32, clean: 1, skyclean: 2, sat: 90, cool: 40, shadow: 40, light: 30, chara: 20, outline: 1 },
};
const FIELDS = [
  ['w', '横のマス数', 120, 360, 12, v => v],  // 「見つける」ときは、この数を目安に近くのドットの並びを探す
  ['colors', '色の数', 8, 160, 4, v => v],
  ['clean', 'ノイズ取り', 0, 3, 1, v => ['なし', '弱', '中', '強'][v]],
  ['sat', '彩度', 50, 150, 5, v => v + '%'],
  ['contrast', 'コントラスト', 70, 140, 2, v => v + '%'],
  ['cool', '影を青く', 0, 100, 5, v => v + '%'],
  ['shadow', '影を暗く', 0, 100, 5, v => v + '%'],
  ['light', '真ん中に光', 0, 100, 5, v => v + '%'],
  ['skyclean', '空のノイズ取り', 0, 3, 1, v => ['なし', '弱', '中', '強'][v]],
  ['chara', 'キャラの色数', 8, 40, 2, v => v],
];
const FX = [['none', '演出なし'], ['twinkle', '明かり'], ['rain', '雨'], ['snow', '雪']];

let st = { sample: null, view: 'grid', act: 'B', slots: structuredClone(DEF) };
try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.slots) { st = { ...st, ...s, slots: structuredClone(DEF) }; for (const k of SLOTS) st.slots[k] = { ...BASE, ...DEF[k], ...(s.slots[k] || {}) }; } } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };

// ---------- 画像の読み込み ----------
const imgCache = new Map();
async function pixels(url) {
  if (imgCache.has(url)) return imgCache.get(url);
  const im = new Image(); im.src = url; await im.decode();
  const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0);
  const d = { w: c.width, h: c.height, data: x.getImageData(0, 0, c.width, c.height).data };
  imgCache.set(url, d); return d;
}

// 面積で平均して縮める（ぼかさない縮め方。透明はアルファで重みづけ）
function boxDown(src, w, h) {
  const out = new Float32Array(w * h * 4), sx = src.w / w, sy = src.h / h, s = src.data;
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
        const i = (yy * src.w + xx) * 4, al = s[i + 3] / 255; r += s[i] * al; g += s[i + 1] * al; b += s[i + 2] * al; a += al; n++;
      }
      const o = (y * w + x) * 4; out[o] = a ? r / a : 0; out[o + 1] = a ? g / a : 0; out[o + 2] = a ? b / a : 0; out[o + 3] = a / n;
    }
  }
  return out;
}

// 色味の寄せ：彩度・コントラスト・暗いところを青紫へ
function grade(px, o) {
  const sat = o.sat / 100, con = o.contrast / 100, cool = o.cool / 100;
  for (let i = 0; i < px.length; i += 4) {
    let r = px[i], g = px[i + 1], b = px[i + 2];
    const L = r * .3 + g * .59 + b * .11;
    r = L + (r - L) * sat; g = L + (g - L) * sat; b = L + (b - L) * sat;
    r = (r - 128) * con + 128; g = (g - 128) * con + 128; b = (b - 128) * con + 128;
    const k = cool * Math.pow(1 - Math.min(1, Math.max(0, L / 255)), 2) * .7;
    r += (38 - r) * k; g += (44 - g) * k; b += (112 - b) * k;
    px[i] = Math.min(255, Math.max(0, r)); px[i + 1] = Math.min(255, Math.max(0, g)); px[i + 2] = Math.min(255, Math.max(0, b));
  }
}

// 影を暗く・真ん中に光（光を当てるところだけ明るく、影は思いきって暗く）
function tone(px, w, h, o) {
  const ks = o.shadow / 100, kl = o.light / 100; if (!ks && !kl) return;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, L = px[i] * .3 + px[i + 1] * .59 + px[i + 2] * .11;
    let f = 1;
    if (ks && L < 140) f *= 1 - ks * .6 * Math.pow((140 - L) / 140, .8);
    if (kl) { const dx = (x / w - .5) * 1.4, dy = (y / h - .58), d = Math.sqrt(dx * dx + dy * dy); f *= 1 + kl * (.22 - d * .7); }
    px[i] = Math.min(255, Math.max(0, px[i] * f)); px[i + 1] = Math.min(255, Math.max(0, px[i + 1] * f)); px[i + 2] = Math.min(255, Math.max(0, px[i + 2] * f));
  }
}

// Pixel Refiner：元の絵の「見た目の1ドット」が何ピクセルかを見つけ、ドットのまん中の色で縮める
let worker = null, wid = 0; const waits = new Map(), refined = new Map();
function refine(url, src, w) {
  const key = url + '@' + w; if (refined.has(key)) return refined.get(key);
  if (!worker) { worker = new Worker('pr-worker.js', { type: 'module' }); worker.onmessage = e => { const f = waits.get(e.data.id); waits.delete(e.data.id); f && f(e.data); }; }
  const p = new Promise((ok, ng) => {
    const id = ++wid; waits.set(id, r => r.ok ? ok(r) : ng(new Error(r.err)));
    worker.postMessage({ id, w: src.w, h: src.h, data: new Uint8ClampedArray(src.data), opt: { bgRemovalScope: 'off', reduceColors: false, trimToContent: false, hintPixelsW: w, hintPixelsH: Math.round(w * 16 / 9) } });
  });
  refined.set(key, p); p.catch(() => refined.delete(key)); return p;
}

// 色を減らす：メディアンカットで分けて、k平均で少し整える
function quantize(px, k) {
  const list = [];
  for (let i = 0; i < px.length; i += 4) if (px[i + 3] >= .5) list.push(i);
  if (!list.length) return { pal: [[0, 0, 0]], idx: new Uint8Array(px.length / 4) };
  let boxes = [list];
  while (boxes.length < k) {
    let bi = -1, best = -1, ch = 0;
    boxes.forEach((bx, j) => {
      if (bx.length < 2) return;
      for (let c = 0; c < 3; c++) {
        let mn = 255, mx = 0; for (const i of bx) { const v = px[i + c]; if (v < mn) mn = v; if (v > mx) mx = v; }
        const sc = (mx - mn) * Math.sqrt(bx.length); if (sc > best) { best = sc; bi = j; ch = c; }
      }
    });
    if (bi < 0 || best <= 0) break;
    const bx = boxes[bi].sort((a, b) => px[a + ch] - px[b + ch]), m = bx.length >> 1;
    boxes.splice(bi, 1, bx.slice(0, m), bx.slice(m));
  }
  let pal = boxes.map(bx => { let r = 0, g = 0, b = 0; for (const i of bx) { r += px[i]; g += px[i + 1]; b += px[i + 2]; } return [r / bx.length, g / bx.length, b / bx.length]; });
  const near = (r, g, b) => { let bi = 0, bd = 1e9; for (let j = 0; j < pal.length; j++) { const p = pal[j], d = (p[0] - r) ** 2 * .3 + (p[1] - g) ** 2 * .59 + (p[2] - b) ** 2 * .11; if (d < bd) { bd = d; bi = j; } } return bi; };
  const idx = new Uint8Array(px.length / 4);
  for (let it = 0; it < 3; it++) {
    const cache = new Map(), sum = pal.map(() => [0, 0, 0, 0]);
    for (const i of list) {
      const key = (px[i] >> 2) << 12 | (px[i + 1] >> 2) << 6 | (px[i + 2] >> 2);
      let j = cache.get(key); if (j === undefined) { j = near(px[i], px[i + 1], px[i + 2]); cache.set(key, j); }
      idx[i / 4] = j; const s = sum[j]; s[0] += px[i]; s[1] += px[i + 1]; s[2] += px[i + 2]; s[3]++;
    }
    if (it < 2) pal = pal.map((p, j) => sum[j][3] ? [sum[j][0] / sum[j][3], sum[j][1] / sum[j][3], sum[j][2] / sum[j][3]] : p);
  }
  return { pal: pal.map(p => p.map(Math.round)), idx };
}

// ノイズ取り：まわり8マスに同じ色が少ない「浮いた1マス」を、まわりで一番多い色にする
function clean(idx, alpha, w, h, level, rows = h) {
  const lim = [0, 1, 2, 3][level];
  for (let pass = 0; pass < (level >= 3 ? 2 : 1); pass++) {
    const src = idx.slice();
    for (let y = 0; y < rows; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (!alpha[i]) continue;
      const cnt = new Map(); let same = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue; const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx; if (!alpha[j]) continue; const v = src[j];
        if (v === src[i]) same++; cnt.set(v, (cnt.get(v) || 0) + 1);
      }
      if (same < lim) { let bv = src[i], bc = 0; for (const [v, c] of cnt) if (c > bc) { bc = c; bv = v; } idx[i] = bv; }
    }
  }
}

function build(px, w, h, k, lvl, sky = 0) {
  const alpha = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) alpha[i] = px[i * 4 + 3] >= .5 ? 1 : 0;
  const q = quantize(px, k); if (lvl) clean(q.idx, alpha, w, h, lvl);
  if (sky) clean(q.idx, alpha, w, h, Math.min(3, lvl + sky), Math.round(h * .42)); // 空（上のほう）だけ強めに。つるっとしたところにざらつきを残さない
  return { w, h, pal: q.pal, idx: q.idx, alpha };
}

// ---------- 1つの見本を作る ----------
async function process(o, sample, charaUrl) {
  const src = await pixels(sample.src);
  let w = o.w, h = Math.round(w * 16 / 9), px, info = '';
  if (o.grid === 'refiner') {
    const r = await refine(sample.src, src, o.w); w = r.w; h = r.h;
    px = new Float32Array(w * h * 4); for (let i = 0; i < px.length; i++) px[i] = (i & 3) === 3 ? r.data[i] / 255 : r.data[i];
    info = `1マス＝${r.cellW.toFixed(1)}px・${w}×${h}`;
  } else { px = boxDown(src, w, h); info = `${w}×${h}`; }
  grade(px, o); tone(px, w, h, o);
  const bg = build(px, w, h, o.colors, o.clean, o.skyclean);
  const cs = await pixels(charaUrl), ch = Math.round(h * 150 / 640), cw = Math.max(1, Math.round(cs.w * ch / cs.h));
  const cp = boxDown(cs, cw, ch); grade(cp, { ...o, cool: o.cool * .4 });
  const chara = build(cp, cw, ch, o.chara, Math.min(1, o.clean));
  // キャラのいちばん外側だけ濃い色のふちにする（主役を背景に埋もれさせない）
  chara.rim = new Uint8Array(cw * ch);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const i = y * cw + x; if (!chara.alpha[i]) continue;
    if (x === 0 || y === 0 || x === cw - 1 || y === ch - 1 || !chara.alpha[i - 1] || !chara.alpha[i + 1] || !chara.alpha[i - cw] || !chara.alpha[i + cw]) chara.rim[i] = 1;
  }
  // 明かり（明るい色）を見つけておく：またたきに使う
  const lum = bg.pal.map(p => p[0] * .3 + p[1] * .59 + p[2] * .11);
  const bright = bg.pal.map((p, j) => j).filter(j => lum[j] > 175 && Math.max(...bg.pal[j]) - Math.min(...bg.pal[j]) > 40);
  return { bg, chara, bright, w, h, o, info };
}

// ---------- 描く（毎コマ。マス単位で組んでから整数倍で拡大） ----------
const RIM = [20, 18, 46];
function particles(kind, w, h, t) {
  const n = kind === 'rain' ? Math.round(w * h / 900) : Math.round(w * h / 1400), out = [];
  for (let i = 0; i < n; i++) {
    const seed = (i * 9301 + 49297) % 233280 / 233280, seed2 = (i * 7919 + 104729) % 1000 / 1000;
    if (kind === 'rain') { const sp = h * 1.6, y = ((seed * h + t * sp) % (h + 10)) - 5, x = ((seed2 * w - t * sp * .12) % w + w) % w; out.push([x, y]); }
    else { const sp = h * .12 * (0.6 + seed2), y = ((seed * h + t * sp) % (h + 4)) - 2, x = (seed2 * w + Math.sin(t * 1.3 + i) * 3 + w) % w; out.push([x, y, seed2 > .7 ? 2 : 1]); }
  }
  return out;
}
function compose(r, ctx, img, t) {
  const { bg, chara, w, h, o } = r, d = img.data;
  const pal = bg.pal.map(p => p.slice());
  if (o.fx === 'twinkle' && r.bright.length) {
    const ph = Math.floor(t * 4);
    r.bright.forEach((j, n) => { if ((ph + n * 3) % 5 === 0) { pal[j] = pal[j].map(v => Math.min(255, v * .72)); } else if ((ph + n * 2) % 7 === 0) { pal[j] = pal[j].map(v => Math.min(255, v + 40)); } });
  }
  for (let i = 0, n = w * h; i < n; i++) { const p = pal[bg.idx[i]], q = i * 4; d[q] = p[0]; d[q + 1] = p[1]; d[q + 2] = p[2]; d[q + 3] = 255; }
  if (o.fx === 'rain') { for (let i = 0; i < d.length; i += 4) { d[i] *= .78; d[i + 1] *= .8; d[i + 2] *= .88; } }
  // キャラ：下のほう中央。少しだけ上下する
  const bob = Math.floor(t * 2) % 2, cx = Math.round((w - chara.w) / 2), cy = Math.round(h * .86) - chara.h - bob;
  for (let y = 0; y < chara.h; y++) for (let x = 0; x < chara.w; x++) {
    const i = y * chara.w + x; if (!chara.alpha[i]) continue; const X = cx + x, Y = cy + y; if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
    const p = o.outline && chara.rim[i] ? RIM : chara.pal[chara.idx[i]], q = (Y * w + X) * 4; d[q] = p[0]; d[q + 1] = p[1]; d[q + 2] = p[2];
  }
  const put = (x, y, c, a) => { x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= w || y >= h) return; const q = (y * w + x) * 4; d[q] += (c[0] - d[q]) * a; d[q + 1] += (c[1] - d[q + 1]) * a; d[q + 2] += (c[2] - d[q + 2]) * a; };
  if (o.fx === 'rain') for (const [x, y] of particles('rain', w, h, t)) { const L = Math.max(2, Math.round(h / 110)); for (let k = 0; k < L; k++) put(x - k * .2, y + k, [200, 220, 255], .55); }
  if (o.fx === 'snow') for (const [x, y, s] of particles('snow', w, h, t)) { put(x, y, [255, 255, 255], .9); if (s > 1) { put(x + 1, y, [255, 255, 255], .7); put(x, y + 1, [255, 255, 255], .7); put(x + 1, y + 1, [255, 255, 255], .5); } }
  ctx.putImageData(img, 0, 0);
}

// ---------- 画面 ----------
let samples = [], charaUrl = 'src/chara.png';
const results = {}; const cells = {};
let ver = 0;

function fitCanvas(cell, r) {
  const cv = cell.querySelector('canvas'), box = cell.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  const k = Math.min(box.width * dpr / r.w, box.height * dpr / r.h), s = k >= 3 ? Math.floor(k) : k; // 大きく出せるときはドットをそろえ、小さい枠では枠いっぱいに出して比べやすくする
  cv.width = r.w; cv.height = r.h; cv.style.width = (r.w * s / dpr) + 'px'; cv.style.height = (r.h * s / dpr) + 'px';
  cell._ctx = cv.getContext('2d'); cell._img = cell._ctx.createImageData(r.w, r.h);
}

function layout() {
  const stage = $('#stage'); stage.className = 'stage ' + (st.view === 'one' ? 'one' : 'grid'); stage.innerHTML = '';
  const show = st.view === 'one' ? [st.act] : SLOTS;
  for (const s of show) {
    const c = document.createElement('div'); c.className = 'cell' + (s === st.act && st.view !== 'one' ? ' act' : '');
    c.innerHTML = `<canvas></canvas><span class="tag">${s}　${esc(st.slots[s].name || '')}</span><div class="busy">作っています…</div>`;
    c.addEventListener('click', () => { if (st.view === 'one') return; st.act = s; save(); layout(); panel(); });
    stage.appendChild(c); cells[s] = c;
    if (results[s]) { fitCanvas(c, results[s]); tagOf(s); }
  }
  $('#vOne').classList.toggle('on', st.view === 'one'); $('#vGrid').classList.toggle('on', st.view !== 'one');
  palette();
}
function tagOf(s) { const c = cells[s], r = results[s]; if (!c) return; const t = c.querySelector('.tag'); t.textContent = `${s}　${st.slots[s].name || ''}${r && r.info ? '（' + r.info + '）' : ''}`; t.title = t.textContent; }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function palette() {
  const r = results[st.act]; const el = $('#pal');
  el.innerHTML = r ? r.bg.pal.map(p => `<i style="background:rgb(${p.join(',')})"></i>`).join('') : '';
}

async function run(s) {
  const my = ++ver; const sample = samples.find(x => x.id === st.sample) || samples[0];
  const cell = cells[s]; cell && cell.classList.add('busy');
  await new Promise(r => setTimeout(r, 20));
  let r;
  try { r = await process(st.slots[s], sample, charaUrl); }
  catch (err) { const c = cells[s]; if (c) { c.classList.remove('busy'); c.querySelector('.tag').textContent = `${s}　うまく作れませんでした`; } console.error(err); return my; }
  results[s] = r; const c = cells[s];
  if (c && document.body.contains(c)) { c.classList.remove('busy'); fitCanvas(c, r); tagOf(s); }
  if (s === st.act) palette();
  return my;
}
async function runAll() { for (const s of SLOTS) await run(s); }

let deb = 0;
function panel() {
  const o = st.slots[st.act], el = $('#panel');
  el.innerHTML = `<h2>${st.act} の加工</h2>
    <div class="row"><label for="f-name">名前</label><input id="f-name" value="${esc(o.name || '')}" style="grid-column:2/4;font:inherit;font-size:14px;color:var(--text);background:#0B0E22;border:1px solid var(--line);border-radius:8px;padding:6px 8px"></div>
    ${FIELDS.map(([k, lab, mn, mx, stp, fmt]) => `<div class="row"><label for="f-${k}">${lab}</label><input type="range" id="f-${k}" min="${mn}" max="${mx}" step="${stp}" value="${o[k]}"><output id="o-${k}">${fmt(o[k])}</output></div>`).join('')}
    <div class="row"><label>縮め方</label><div class="chips" style="grid-column:2/4"><button data-grid="box" class="${o.grid === 'box' ? 'on' : ''}">ふつうに縮める</button><button data-grid="refiner" class="${o.grid === 'refiner' ? 'on' : ''}">ドットを見つける</button></div></div>
    <div class="row"><label>キャラのふち</label><div class="chips" style="grid-column:2/4"><button data-ol="0" class="${!o.outline ? 'on' : ''}">なし</button><button data-ol="1" class="${o.outline ? 'on' : ''}">外側だけ濃く</button></div></div>
    <div class="row"><label>演出</label><div class="chips" style="grid-column:2/4">${FX.map(([k, l]) => `<button data-fx="${k}" class="${o.fx === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <div class="chips" style="margin-top:6px"><button data-a="reset">${st.act} を最初の設定に戻す</button><button data-a="copy">設定を書き出す</button></div>
    <p class="note">「ドットを見つける」は Pixel Refiner（MIT ライセンス）の処理で、元の絵のドットの並びを見つけてから縮めます。横のマス数は、探すときの目安になります。最初の1回は数秒かかります。<br>縮める・色を減らす・色味を寄せるだけで、絵は描き足していません。設定はこの端末に残ります。気に入った設定は「設定を書き出す」で Claude に渡してください。</p>
    <textarea id="out" hidden readonly></textarea>`;
  el.querySelector('#f-name').addEventListener('input', e => { o.name = e.target.value; save(); const t = cells[st.act]?.querySelector('.tag'); if (t) t.textContent = `${st.act}　${o.name}`; });
  for (const [k, , , , , fmt] of FIELDS) {
    el.querySelector('#f-' + k).addEventListener('input', e => {
      o[k] = +e.target.value; el.querySelector('#o-' + k).textContent = fmt(o[k]); save();
      clearTimeout(deb); deb = setTimeout(() => run(st.act), 180);
    });
  }
  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.fx) { o.fx = b.dataset.fx; save(); if (results[st.act]) results[st.act].o = o; panel(); }
    if (b.dataset.grid) { o.grid = b.dataset.grid; save(); panel(); run(st.act); }
    if (b.dataset.ol) { o.outline = +b.dataset.ol; save(); panel(); }
    if (b.dataset.a === 'reset') { st.slots[st.act] = structuredClone(DEF[st.act]); save(); panel(); layout(); run(st.act); }
    if (b.dataset.a === 'copy') {
      const ta = el.querySelector('#out'), txt = JSON.stringify({ sample: st.sample, ...st.slots[st.act] });
      ta.hidden = false; ta.value = txt; ta.select();
      navigator.clipboard?.writeText(txt).then(() => { b.textContent = 'コピーしました'; }).catch(() => {});
    }
  });
}

async function start() {
  const j = await (await fetch('samples.json', { cache: 'no-cache' })).json();
  samples = j.samples; charaUrl = j.chara || charaUrl;
  if (!samples.find(s => s.id === st.sample)) st.sample = samples[0].id;
  const sel = $('#sample'); sel.innerHTML = samples.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join(''); sel.value = st.sample;
  sel.addEventListener('change', () => { st.sample = sel.value; save(); runAll(); });
  $('#vOne').addEventListener('click', () => { st.view = 'one'; save(); layout(); });
  $('#vGrid').addEventListener('click', () => { st.view = 'grid'; save(); layout(); });
  new ResizeObserver(() => { for (const s of SLOTS) if (cells[s] && results[s] && document.body.contains(cells[s])) fitCanvas(cells[s], results[s]); }).observe($('#stage'));
  layout(); panel();
  // 演出のための描き直し（12コマ/秒）
  let last = 0;
  const loop = now => {
    requestAnimationFrame(loop); if (now - last < 1000 / 12) return; last = now;
    const t = now / 1000;
    for (const s of SLOTS) { const c = cells[s], r = results[s]; if (c && r && c._ctx && document.body.contains(c)) { r.o = st.slots[s]; compose(r, c._ctx, c._img, t); } }
  };
  requestAnimationFrame(loop);
  await runAll();
}
start();
