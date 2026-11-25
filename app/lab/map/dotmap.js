// 案A：ドットの地図
// data/ の段（日本：8km・2km・1km、神奈川・東京のまわり：1km・250m・100m・50m、名所のまわりだけ 20m のマス）を、拡大の度合いに合わせて切り替えて描く
// 1マスが画面で最低 MIN_CELL px になる、いちばん細かい段を使う。色はパレットでぬる（行った市区町村・県は金色）。線路と高速道路は、ボタンで出す・消すを切り替えられる
import { LAB_PLACES } from './places_lab.js';
import { isVisited, toggleVisited, onVisitedChange, pinCanvas } from './common.js';

const MIN_CELL = 3;          // css px
const S_MIN = 0.12, S_MAX = 1200; // css px / km
export const stats = { bytes: {}, loadMs: {}, paintMs: {}, firstDrawMs: 0, draws: [], gaps: [] };

const hex = h => { const n = parseInt(h.slice(1), 16); return 0xff000000 | ((n & 255) << 16) | (n & 0xff00) | (n >> 16); }; // ABGR
const P = {
  seaA: hex('#10183E'), seaB: hex('#131C46'),
  land: ['#48685C', '#4E705F', '#44645A'].map(hex),
  landV: ['#D2A458', '#DBAE62'].map(hex),
  muni: hex('#38564F'), muniV: hex('#9A6A3A'),
  pref: hex('#B9C99A'), prefV: hex('#FFF0C0'),
  coast: hex('#A9C2B2'), coastV: hex('#FFE6A6'),
  rail: hex('#1B1628'), hw: hex('#F07850'),
  road: hex('#FFF6E0'), minor: hex('#A9C2A8'), minorV: hex('#F6E2B0'),   // 20m の段だけ（OpenStreetMap）
  park: hex('#5E9150'), parkV: hex('#BFA34A'), water: hex('#2E5096'),
};
export const PALETTE = ['#10183E', '#131C46', '#48685C', '#4E705F', '#44645A', '#D2A458', '#DBAE62', '#38564F', '#9A6A3A', '#B9C99A', '#FFF0C0', '#A9C2B2', '#FFE6A6', '#1B1628', '#F07850', '#FFF6E0', '#A9C2A8', '#F6E2B0', '#5E9150', '#BFA34A', '#2E5096'];

let meta, lv = {}, el, cv, ctx, dpr = 1, Wc = 0, Hc = 0;
let cx = 1500, cy = 1200, s = 0.17;  // 画面の真ん中（km）と拡大率（css px / km）
let dirty = true, pinRects = [], interacting = false, lastDraw = 0, sel = null;
const vPrefs = new Set(), vMunis = new Set();
export const layers = { rail: true, hw: true, minor: true };

const proj = (lng, lat) => [(lng - meta.proj.lon0) * meta.proj.kx, (meta.proj.lat0 - lat) * meta.proj.ky];

async function loadLevel(L) {
  const t0 = performance.now();
  const buf = await (await fetch('data/' + L.id + '.png')).arrayBuffer();
  stats.bytes[L.id] = buf.byteLength;
  const bmp = await createImageBitmap(new Blob([buf], { type: 'image/png' }), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const c = document.createElement('canvas'); c.width = L.W; c.height = L.H;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bmp, 0, 0);
  lv[L.id] = { L, raw: x.getImageData(0, 0, L.W, L.H).data, canvas: c, ctx: x, key: null };
  stats.loadMs[L.id] = Math.round(performance.now() - t0);
  paint(lv[L.id]); dirty = true;
}

function idAt(id, X, Y, r = 0) {
  const v = lv[id]; if (!v) return 0;
  const { L } = v, c0 = Math.floor((X - L.x0) / L.cell), r0 = Math.floor((Y - L.y0) / L.cell);
  for (let d = 0; d <= r; d++) for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
    const c = c0 + dx, rr = r0 + dy; if (c < 0 || rr < 0 || c >= L.W || rr >= L.H) continue;
    const j = (rr * L.W + c) * 4, n = (v.raw[j] << 8) | v.raw[j + 1]; if (n) return n;
  }
  return 0;
}

function updateVisited() {
  vPrefs.clear(); vMunis.clear();
  const prefCode = Object.fromEntries(Object.entries(meta.prefs).map(([k, n]) => [n, +k]));
  for (const p of LAB_PLACES) {
    if (!isVisited(p.id)) continue;
    const [X, Y] = proj(p.lng, p.lat);
    const m = idAt('kt50', X, Y, 4) || idAt('kt250', X, Y, 2);
    if (m) { vMunis.add(m); const pc = prefCode[meta.munis[m - 1].pref]; if (pc) vPrefs.add(pc); }
    else { const pc = idAt('jp1', X, Y, 3); if (pc) vPrefs.add(pc); }
  }
  Object.values(lv).forEach(paint); dirty = true;
}

function paint(v) {
  const set = v.L.kind === 'pref' ? vPrefs : vMunis, key = [...set].sort().join(',') + '|' + layers.rail + layers.hw + layers.minor;
  if (v.key === key) return;
  const t0 = performance.now(), { W, H } = v.L, r = v.raw;
  const img = v.ctx.createImageData(W, H), o = new Uint32Array(img.data.buffer);
  for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
    const j = i << 2, id = (r[j] << 8) | r[j + 1], b = r[j + 2], f = b & 3;
    let c;
    if (b & 8 && layers.hw) c = P.hw;                          // 高速道路
    else if (b & 4 && layers.rail) c = P.rail;                 // 線路（250m より細かい段だけ）
    else if (b & 16) c = P.road;                               // ここから下の道・水辺・公園は 20m の段だけ
    else if (b & 128 && layers.minor && id) c = set.has(id) ? P.minorV : P.minor;
    else if (b & 64 && id && f !== 3) c = P.water;
    else if (!id) c = ((x >> 1) + (y >> 1)) & 1 ? P.seaB : P.seaA;   // 海：2マスごとの市松で、ドットの手ざわり
    else {
      const vv = set.has(id);
      c = f === 3 ? (vv ? P.coastV : P.coast) : f === 2 ? (vv ? P.prefV : P.pref) : f === 1 ? (vv ? P.muniV : P.muni)
        : b & 32 ? (vv ? P.parkV : P.park) : vv ? P.landV[(x + y) & 1] : P.land[id % 3];
    }
    o[i] = c;
  }
  v.ctx.putImageData(img, 0, 0); v.key = key;
  stats.paintMs[v.L.id] = Math.round((performance.now() - t0) * 10) / 10;
}

// ---- 描く ----
function pickLevels() {
  const vis = id => lv[id] && lv[id].L.cell * s >= MIN_CELL;
  const jp = ['jp1', 'jp2', 'jp8'].find(vis) || (lv.jp8 ? 'jp8' : null);
  const hw = Wc / 2 / s, hh = Hc / 2 / s;
  const inView = id => { const L = lv[id].L; return cx + hw > L.x0 && cx - hw < L.x0 + L.W * L.cell && cy + hh > L.y0 && cy - hh < L.y0 + L.H * L.cell; };
  const kt = ['kt50', 'kt100', 'kt250', 'kt1000'].find(id => vis(id) && inView(id));
  const near = Object.keys(lv).filter(id => id.startsWith('near') && vis(id) && inView(id));  // 名所のまわりの 20m（いくつでも重ねる）
  return [jp, kt, ...near].filter(Boolean);
}

function blit(v, sd) {
  const { L } = v, k = L.cell * sd, Wd = cv.width, Hd = cv.height;
  const left = cx - Wd / 2 / sd, top = cy - Hd / 2 / sd;
  const c0 = Math.max(0, Math.floor((left - L.x0) / L.cell)), r0 = Math.max(0, Math.floor((top - L.y0) / L.cell));
  const c1 = Math.min(L.W, Math.ceil((left + Wd / sd - L.x0) / L.cell)), r1 = Math.min(L.H, Math.ceil((top + Hd / sd - L.y0) / L.cell));
  if (c1 <= c0 || r1 <= r0) return null;
  const dx = Math.round((L.x0 + c0 * L.cell - cx) * sd + Wd / 2), dy = Math.round((L.y0 + r0 * L.cell - cy) * sd + Hd / 2);
  ctx.drawImage(v.canvas, c0, r0, c1 - c0, r1 - r0, dx, dy, Math.round((c1 - c0) * k), Math.round((r1 - r0) * k));
  return { dx, dy, k, n: c1 - c0, m: r1 - r0 };
}

const pinCache = {};
function pinSprite(visited, px, kind) { const k = visited + ':' + px + kind; return pinCache[k] || (pinCache[k] = pinCanvas(visited, px, kind)); }

function draw(now) {
  const t0 = performance.now();
  const Wd = cv.width, Hd = cv.height, sd = s * dpr;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#10183E'; ctx.fillRect(0, 0, Wd, Hd);
  const pick = pickLevels();
  let top = null;
  for (const id of pick) top = blit(lv[id], sd) || top;
  // 1マスが大きく見えるときは、マスの間にうすい溝を入れて「ドット」らしくする
  if (top && top.k >= 7) {
    ctx.fillStyle = 'rgba(6,8,24,.22)';
    const g = Math.max(1, Math.round(dpr * 0.6));
    for (let i = 0; i <= top.n; i++) { const x = Math.round(top.dx + i * top.k); if (x >= -g && x <= Wd) ctx.fillRect(x, Math.max(0, top.dy), g, Math.min(Hd, top.m * top.k)); }
    for (let j = 0; j <= top.m; j++) { const y = Math.round(top.dy + j * top.k); if (y >= -g && y <= Hd) ctx.fillRect(Math.max(0, top.dx), y, Math.min(Wd, top.n * top.k), g); }
  }
  drawPins(sd);
  const ms = performance.now() - t0;
  if (interacting) { stats.draws.push(ms); if (lastDraw && now - lastDraw < 250) stats.gaps.push(now - lastDraw); }
  if (stats.draws.length > 120) stats.draws.shift(); if (stats.gaps.length > 120) stats.gaps.shift();
  lastDraw = now;
  hud(pick);
}

function drawPins(sd) {
  const px = Math.max(1, Math.round(3 * dpr)), w = 8 * px, h = 9 * px;
  const pts = LAB_PLACES.map(p => { const [X, Y] = proj(p.lng, p.lat); return { p, x: (X - cx) * sd + cv.width / 2, y: (Y - cy) * sd + cv.height / 2 }; });
  // 近すぎる印はまとめる（数を出す）
  const groups = [];
  for (const q of pts) {
    const g = groups.find(g => Math.hypot(g.x - q.x, g.y - q.y) < 22 * dpr);
    if (g) g.items.push(q); else groups.push({ x: q.x, y: q.y, items: [q] });
  }
  pinRects = [];
  ctx.font = `${Math.round(11 * dpr)}px DotGothic16, monospace`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  for (const g of groups) {
    const v = g.items.some(q => isVisited(q.p.id)), sp = pinSprite(v, px, g.items.every(q => q.p.kind === 'sapa') ? 'sapa' : '');
    const x = Math.round(g.x - w / 2), y = Math.round(g.y - h);
    if (x > cv.width || y > cv.height || x + w < 0 || y + h < 0) continue;
    if (sel && g.items.some(q => q.p.id === sel)) { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x - px, y - px, w + 2 * px, h + 2 * px); }
    ctx.drawImage(sp, x, y);
    if (g.items.length > 1) {
      const bx = x + w, by = y + px * 2, bw = Math.round(16 * dpr), bh = Math.round(14 * dpr);
      ctx.fillStyle = '#14122E'; ctx.fillRect(bx - bw / 2, by - bh / 2, bw, bh);
      ctx.fillStyle = '#FFFFFF'; ctx.fillText(String(g.items.length), bx, by + dpr * 0.5);
    }
    pinRects.push({ x: x / dpr, y: y / dpr, w: w / dpr, h: h / dpr, g });
  }
}

function hud(pick) {
  const id = pick[pick.length - 1]; if (!id) return;
  const L = lv[id].L, cell = L.cell >= 1 ? L.cell + 'km' : L.cell * 1000 + 'm';
  let where = '';
  const n = idAt(id, cx, cy);
  if (n) where = L.kind === 'pref' ? meta.prefs[n] : (meta.munis[n - 1].pref + ' ' + meta.munis[n - 1].name);
  el.querySelector('.dm-where').textContent = `1マス＝${cell}｜${where || '海'}`;
  const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  const g = avg(stats.gaps), d = avg(stats.draws);
  el.querySelector('.dm-perf').textContent = stats.gaps.length > 5 ? `描く ${d.toFixed(1)}ms ・ ${Math.min(60, 1000 / g).toFixed(0)}fps` : '';
}

function loop(now) { if (dirty) { dirty = false; draw(now); } requestAnimationFrame(loop); }

function resize() {
  const r = cv.parentElement.getBoundingClientRect(); if (!r.width) return; dpr = window.devicePixelRatio || 1;
  Wc = r.width; Hc = r.height; cv.width = Math.round(Wc * dpr); cv.height = Math.round(Hc * dpr);
  cv.style.width = Wc + 'px'; cv.style.height = Hc + 'px'; dirty = true;
}

// 拡大率を、いま見ている段の1マスがちょうど整数の画面ピクセルになるようにそろえる（にじみ・ムラを防ぐ）
function settle() {
  const id = pickLevels().slice(-1)[0]; if (!id) return;
  const L = lv[id].L, k = Math.max(1, Math.round(L.cell * s * dpr));
  s = Math.min(S_MAX, Math.max(S_MIN, k / dpr / L.cell));
  const sd = s * dpr, o = (L.x0 - cx) * sd + cv.width / 2, oy = (L.y0 - cy) * sd + cv.height / 2;
  cx = L.x0 - (Math.round(o) - cv.width / 2) / sd; cy = L.y0 - (Math.round(oy) - cv.height / 2) / sd;
  dirty = true;
}

function zoomAbout(px, py, f) {
  const X = cx + (px - Wc / 2) / s, Y = cy + (py - Hc / 2) / s;
  s = Math.min(S_MAX, Math.max(S_MIN, s * f));
  cx = X - (px - Wc / 2) / s; cy = Y - (py - Hc / 2) / s; dirty = true;
}

let flyAnim = 0;
export function flyTo(lng, lat, cellPx, km) {
  const [X, Y] = lng == null ? [cx, cy] : proj(lng, lat);
  const s1 = km ? Math.min(Wc, Hc) / km : cellPx;
  const a = { cx, cy, ls: Math.log(s) }, b = { cx: X, cy: Y, ls: Math.log(Math.min(S_MAX, Math.max(S_MIN, s1))) };
  const t0 = performance.now(), id = ++flyAnim, T = 650;
  interacting = true;
  const step = now => {
    if (id !== flyAnim) return;
    const t = Math.min(1, (now - t0) / T), e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    cx = a.cx + (b.cx - a.cx) * e; cy = a.cy + (b.cy - a.cy) * e; s = Math.exp(a.ls + (b.ls - a.ls) * e); dirty = true;
    if (t < 1) requestAnimationFrame(step); else { interacting = false; settle(); }
  };
  requestAnimationFrame(step);
}

// ---- 指の操作 ----
function bindInput() {
  const pts = new Map(); let tap = null, lastTap = 0, pinch = null;
  const pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  cv.addEventListener('pointerdown', e => {
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 合成のイベントなど */ } flyAnim++;
    const p = pos(e); pts.set(e.pointerId, p); interacting = true;
    tap = pts.size === 1 ? { ...p, t: performance.now(), moved: false } : null;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; }
  });
  cv.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    const p = pos(e), prev = pts.get(e.pointerId); pts.set(e.pointerId, p);
    if (tap && Math.hypot(p.x - tap.x, p.y - tap.y) > 8) tap.moved = true;
    if (pts.size === 1) { cx -= (p.x - prev.x) / s; cy -= (p.y - prev.y) / s; dirty = true; }
    else if (pts.size === 2 && pinch) {
      const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      cx -= (mx - pinch.mx) / s; cy -= (my - pinch.my) / s;
      zoomAbout(mx, my, d / pinch.d); pinch = { d, mx, my };
    }
  });
  const up = e => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (pts.size === 1) { tap = null; }
    if (pts.size === 0) {
      interacting = false;
      if (tap && !tap.moved && performance.now() - tap.t < 400) {
        const now = performance.now();
        if (!handleTap(tap.x, tap.y) && now - lastTap < 300) { zoomAbout(tap.x, tap.y, 2); lastTap = 0; }
        else lastTap = now;
      }
      settle();
    }
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { e.preventDefault(); const p = pos(e); zoomAbout(p.x, p.y, Math.exp(-e.deltaY * 0.0015)); clearTimeout(cv._wt); cv._wt = setTimeout(settle, 150); }, { passive: false });
}

function handleTap(x, y) {
  const hit = [...pinRects].reverse().find(r => x >= r.x - 6 && x <= r.x + r.w + 6 && y >= r.y - 6 && y <= r.y + r.h + 6);
  if (!hit) { showInfo(null); return false; }
  const items = hit.g.items;
  if (items.length > 1) {   // まとまった印は、寄って広げる
    const xs = items.map(q => proj(q.p.lng, q.p.lat));
    const X = xs.reduce((a, b) => a + b[0], 0) / xs.length, Y = xs.reduce((a, b) => a + b[1], 0) / xs.length;
    const span = Math.max(...xs.map(([a, b]) => Math.max(Math.abs(a - X), Math.abs(b - Y)))) * 2.6 + 2;
    const [lng, lat] = [X / meta.proj.kx + meta.proj.lon0, meta.proj.lat0 - Y / meta.proj.ky];
    flyTo(lng, lat, null, span); return true;
  }
  showInfo(items[0].p); return true;
}

function showInfo(p) {
  sel = p ? p.id : null; dirty = true;
  const box = el.querySelector('.dm-info');
  if (!p) { box.hidden = true; return; }
  const [X, Y] = proj(p.lng, p.lat), m = idAt('kt50', X, Y, 4) || idAt('kt250', X, Y, 2);
  const area = m ? meta.munis[m - 1].pref + ' ' + meta.munis[m - 1].name : '';
  const v = isVisited(p.id);
  box.innerHTML = `<b>${p.name}</b><span class="dm-tag ${v ? 'y' : ''}">${v ? '行った' : 'まだ'}</span>
    <div class="dm-sub">${p.cat}${area ? '・' + area : ''}</div>
    <div class="dm-btns"><button data-a="tog">${v ? '「まだ」に戻す' : '行ったことにする'}</button><button data-a="near">まわりを見る</button></div>`;
  box.hidden = false;
  box.querySelector('[data-a=tog]').onclick = () => { toggleVisited(p.id); };
  box.querySelector('[data-a=near]').onclick = () => flyTo(p.lng, p.lat, 12 / 0.02);
}

export async function initDotMap(root) {
  el = root; cv = el.querySelector('canvas'); ctx = cv.getContext('2d', { alpha: false });
  const t0 = performance.now();
  meta = await (await fetch('data/levels.json')).json();
  stats.bytes.levels = JSON.stringify(meta).length;
  const L = id => meta.levels.find(l => l.id === id);
  resize(); window.addEventListener('resize', resize);
  [cx, cy] = proj(137.2, 37.2); s = Math.min(Wc / 1700, Hc / 2150);
  await Promise.all(['jp8', 'jp2', 'jp1', 'kt1000', 'kt250'].map(id => loadLevel(L(id))));
  updateVisited();
  bindInput(); requestAnimationFrame(loop);
  stats.firstDrawMs = Math.round(performance.now() - t0);
  Promise.all(['kt100', 'kt50', ...meta.levels.filter(l => l.id.startsWith('near')).map(l => l.id)].map(id => loadLevel(L(id)))).then(() => { stats.allMs = Math.round(performance.now() - t0); updateVisited(); });
  onVisitedChange(() => { updateVisited(); if (sel) showInfo(LAB_PLACES.find(p => p.id === sel)); });
  el.querySelectorAll('[data-go]').forEach(b => b.onclick = () => {
    const g = b.dataset.go;
    if (g === 'jp') flyTo(137.2, 37.2, null, 2000);
    if (g === 'kanto') flyTo(139.5, 35.75, null, 190);
    if (g === 'kana') flyTo(139.35, 35.42, null, 75);
    if (g === 'spot') flyTo(139.636, 35.4556, 12 / 0.02);
  });
  el.querySelectorAll('[data-layer]').forEach(b => b.onclick = () => {
    const k = b.dataset.layer; layers[k] = !layers[k]; b.classList.toggle('on', layers[k]);
    Object.values(lv).forEach(paint); dirty = true;
  });
  el.querySelectorAll('[data-z]').forEach(b => b.onclick = () => { zoomAbout(Wc / 2, Hc / 2, b.dataset.z === '1' ? 2 : 0.5); settle(); });
  return meta;
}
export const redraw = () => { resize(); dirty = true; };

// 描く速さを測る：日本・関東・神奈川・名所のまわりで、少しずつずらしながら40回ずつ描いた平均（ms）。1点読み戻す分だけ少し重めに出る
export function bench() {
  const keep = [cx, cy, s], was = interacting, out = {};
  interacting = false;
  const views = { 日本: [137.2, 37.2, null, 2000], 関東: [139.5, 35.75, null, 190], 神奈川: [139.35, 35.42, null, 75], 名所のまわり: [139.636, 35.4556, 600] };
  for (const [name, [lng, lat, px, km]] of Object.entries(views)) {
    [cx, cy] = proj(lng, lat); s = km ? Math.min(Wc, Hc) / km : px; settle();
    const t0 = performance.now();
    for (let i = 0; i < 40; i++) { cx += 3 / s; draw(0); ctx.getImageData(0, 0, 1, 1); } // 読み戻して、描き終わるまで待つ
    out[name] = +((performance.now() - t0) / 40).toFixed(2);
  }
  [cx, cy, s] = keep; interacting = was; dirty = true;
  stats.bench = out; return out;
}
