// ドットの地図：本物の地形データを、決まった大きさのマスに落としたもの（assets/map/dot/、作り方は lab/map/build/build_dotmap.py を DOTMAP_PROD=1 で）
//   日本全体：8km・2km・1km のマス（Natural Earth の県境）
//   神奈川・東京のまわり：1km・250m・100m・50m のマス（国土数値情報の市区町村の境）
//   名所のまわり（±2.5km）だけ 20m のマス（OpenStreetMap の道路・公園と森・水辺）
// 拡大に合わせて段を切り替え、1マスが画面でちょうど整数ピクセルになるようにそろえる。色はパレットでぬる（行った市区町村・県は金色）
// PNG：R*256+G＝番号（0＝海）、B の下2ビット＝1:市区町村の境 2:県境 3:海岸、16＝太い道 32＝公園・森 64＝水辺 128＝細い道
import { PLACES } from './places.js';
import { cardsOf, visited } from './store.js';
import { current, statusOf, fmtDist } from './geo.js';
import { esc } from './ui.js';

const DIR = 'assets/map/dot/';
const MIN_CELL = 3;               // 1マスが画面で最低これだけの css px になる、いちばん細かい段を使う
const S_MIN = 0.12, S_MAX = 1200; // 拡大率（css px / km）の範囲
const NEAR_S = 12 / 0.02;         // 「まわりを見る」：20m の1マスが 12px

const hex = h => { const n = parseInt(h.slice(1), 16); return 0xff000000 | ((n & 255) << 16) | (n & 0xff00) | (n >> 16); }; // ABGR
const P = {
  seaA: hex('#10183E'), seaB: hex('#131C46'),
  land: ['#48685C', '#4E705F', '#44645A'].map(hex), landV: ['#D2A458', '#DBAE62'].map(hex),
  muni: hex('#38564F'), muniV: hex('#9A6A3A'), pref: hex('#B9C99A'), prefV: hex('#FFF0C0'), coast: hex('#A9C2B2'), coastV: hex('#FFE6A6'),
  road: hex('#FFF6E0'), minor: hex('#A9C2A8'), minorV: hex('#F6E2B0'), park: hex('#5E9150'), parkV: hex('#BFA34A'), water: hex('#2E5096'),
};
const PIN_COL = { yes: '#FFC857', no: '#8FA8FF', sel: '#3ED6C4' };

// ---- データ（一度読んだら、地図タブを開き直しても使い回す）----
let meta = null, metaP = null;
const lv = {}, loading = {};   // 段 id → { L, raw, canvas, ctx, key }／読みかけの Promise
const vPrefs = new Set(), vMunis = new Set();
let visKey = null;

const proj = (lng, lat) => [(lng - meta.proj.lon0) * meta.proj.kx, (meta.proj.lat0 - lat) * meta.proj.ky];
const levelOf = id => meta.levels.find(l => l.id === id);

const loadLevel = L => loading[L.id] || (loading[L.id] = readLevel(L).catch(e => { delete loading[L.id]; throw e; }));
async function readLevel(L) {
  const blob = await (await fetch(DIR + L.id + '.png')).blob();
  const bmp = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const c = document.createElement('canvas'); c.width = L.W; c.height = L.H;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bmp, 0, 0);
  lv[L.id] = { L, raw: x.getImageData(0, 0, L.W, L.H).data, canvas: c, ctx: x, key: null };
  paint(lv[L.id]);
  return lv[L.id];
}

// ある地点の番号（県 or 市区町村）。境の上なら、まわり r マスまで探す
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
const muniAt = (X, Y) => idAt('kt50', X, Y, 4) || idAt('kt250', X, Y, 2);

// 行った名所から、行った市区町村・県を決める。組み合わせが変わったときだけ塗り直す
function updateVisited() {
  vPrefs.clear(); vMunis.clear();
  const prefCode = Object.fromEntries(Object.entries(meta.prefs).map(([k, n]) => [n, +k]));
  for (const p of PLACES) {
    if (!visited(p.id)) continue;
    const [X, Y] = proj(p.lng, p.lat), m = muniAt(X, Y);
    if (m) { vMunis.add(m); const pc = prefCode[meta.munis[m - 1].pref]; if (pc) vPrefs.add(pc); }
    else { const pc = idAt('jp1', X, Y, 3) || prefCode[p.pref]; if (pc) vPrefs.add(pc); }
  }
  const k = [...vPrefs].sort().join(',') + '|' + [...vMunis].sort().join(',');
  if (k !== visKey) { visKey = k; Object.values(lv).forEach(paint); }
}

function paint(v) {
  const set = v.L.kind === 'pref' ? vPrefs : vMunis, key = [...set].sort().join(',');
  if (v.key === key) return;
  const { W, H } = v.L, r = v.raw, img = v.ctx.createImageData(W, H), o = new Uint32Array(img.data.buffer);
  for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
    const j = i << 2, id = (r[j] << 8) | r[j + 1], b = r[j + 2], f = b & 3;
    let c;
    if (b & 16) c = P.road;                                          // ここから3つは 20m の段だけ（OpenStreetMap）
    else if (b & 128 && id) c = set.has(id) ? P.minorV : P.minor;
    else if (b & 64 && id && f !== 3) c = P.water;
    else if (!id) c = ((x >> 1) + (y >> 1)) & 1 ? P.seaB : P.seaA;  // 海：2マスごとの市松で、ドットの手ざわり
    else {
      const vv = set.has(id);
      c = f === 3 ? (vv ? P.coastV : P.coast) : f === 2 ? (vv ? P.prefV : P.pref) : f === 1 ? (vv ? P.muniV : P.muni)
        : b & 32 ? (vv ? P.parkV : P.park) : vv ? P.landV[(x + y) & 1] : P.land[id % 3];
    }
    o[i] = c;
  }
  v.ctx.putImageData(img, 0, 0); v.key = key;
}

async function loadAll(onMore) {
  if (!metaP) metaP = fetch(DIR + 'levels.json').then(r => r.json()).then(m => { meta = m; });
  await metaP;
  await Promise.all(['jp8', 'jp2', 'jp1', 'kt1000', 'kt250'].map(id => loadLevel(levelOf(id))));
  updateVisited();
  // くわしい段は裏で読む
  Promise.all(['kt100', 'kt50', ...meta.levels.filter(l => l.id.startsWith('near')).map(l => l.id)].map(id => loadLevel(levelOf(id))))
    .then(() => { updateVisited(); onMore(); }).catch(() => {});
}

// 名所の印（ドット絵風のピン、8×9マス）。1=ふち 2=中 3=光
const PIN = ['..1111..', '.122221.', '12233221', '12233221', '12222221', '.122221.', '..1221..', '...11...', '...11...'];
const pinCache = {};
function pinSprite(col, px) {
  const k = col + px; if (pinCache[k]) return pinCache[k];
  const c = document.createElement('canvas'); c.width = 8 * px; c.height = 9 * px;
  const x = c.getContext('2d'), pal = { 1: '#14122E', 2: col, 3: col === PIN_COL.no ? '#D8DCF4' : '#FFF4E0' };
  PIN.forEach((row, j) => [...row].forEach((ch, i) => { if (pal[ch]) { x.fillStyle = pal[ch]; x.fillRect(i * px, j * px, px, px); } }));
  return (pinCache[k] = c);
}

export async function renderMap(view) {
  view.innerHTML = `<div class="mapwrap"><canvas class="map" aria-label="ドットの地図。名所の印を押すと情報が出ます"></canvas>
    <div class="mapctl"><button data-z="1" aria-label="拡大">＋</button><button data-z="-1" aria-label="縮小">−</button><button data-a="here" aria-label="現在地へ">◎</button><button data-a="jp" aria-label="日本全体" class="jp">日本</button></div>
    <div class="maplegend"><span><i class="lg v"></i>行った</span><span><i class="lg n"></i>まだ</span></div>
    <div class="mapsrc">国土数値情報（行政区域）CC BY 4.0・Natural Earth・名所のまわりの道など © OpenStreetMap contributors</div>
    <div class="mapinfo" hidden></div></div>`;
  const wrap = view.querySelector('.mapwrap'), cv = view.querySelector('canvas.map'), ctx = cv.getContext('2d', { alpha: false }), info = view.querySelector('.mapinfo');
  let dpr = 1, Wc = 0, Hc = 0, cx = 0, cy = 0, s = 1, sel = null, pinRects = [], queued = false, ready = false;
  const alive = () => document.body.contains(cv);
  const req = () => { if (!queued && ready) { queued = true; requestAnimationFrame(() => { queued = false; if (alive()) draw(); }); } };

  await loadAll(req);
  if (!alive()) return;

  // はじめの表示：前に見ていた所、なければ現在地か横浜のあたり（神奈川が入るくらい）
  let saved = null; try { saved = JSON.parse(sessionStorage.getItem('tabiquest:dotmap') || 'null'); } catch (e) {}
  size();
  if (saved && isFinite(saved.cx) && isFinite(saved.s)) ({ cx, cy, s } = saved);
  else { const h = current(); [cx, cy] = h ? proj(h.lng, h.lat) : proj(139.45, 35.42); s = Math.min(Wc, Hc) / 70; }
  ready = true; settle();

  function size() {
    const r = wrap.getBoundingClientRect(); if (!r.width) return;
    dpr = Math.min(3, window.devicePixelRatio || 1); Wc = r.width; Hc = r.height;
    cv.width = Math.round(Wc * dpr); cv.height = Math.round(Hc * dpr); req();
  }

  // 1マスが MIN_CELL px 以上になる、いちばん細かい段（日本 → 神奈川・東京 → 名所のまわり の順に重ねる）
  function pickLevels() {
    const vis = id => lv[id] && lv[id].L.cell * s >= MIN_CELL;
    const hw = Wc / 2 / s, hh = Hc / 2 / s;
    const inView = id => { const L = lv[id].L; return cx + hw > L.x0 && cx - hw < L.x0 + L.W * L.cell && cy + hh > L.y0 && cy - hh < L.y0 + L.H * L.cell; };
    const jp = ['jp1', 'jp2', 'jp8'].find(vis) || 'jp8';
    const kt = ['kt50', 'kt100', 'kt250', 'kt1000'].find(id => vis(id) && inView(id));
    const near = Object.keys(lv).filter(id => id.startsWith('near') && vis(id) && inView(id));
    return [jp, kt, ...near].filter(id => id && lv[id]);
  }

  function blit(v, sd) {
    const { L } = v, k = L.cell * sd, Wd = cv.width, Hd = cv.height, left = cx - Wd / 2 / sd, top = cy - Hd / 2 / sd;
    const c0 = Math.max(0, Math.floor((left - L.x0) / L.cell)), r0 = Math.max(0, Math.floor((top - L.y0) / L.cell));
    const c1 = Math.min(L.W, Math.ceil((left + Wd / sd - L.x0) / L.cell)), r1 = Math.min(L.H, Math.ceil((top + Hd / sd - L.y0) / L.cell));
    if (c1 <= c0 || r1 <= r0) return null;
    const dx = Math.round((L.x0 + c0 * L.cell - cx) * sd + Wd / 2), dy = Math.round((L.y0 + r0 * L.cell - cy) * sd + Hd / 2);
    ctx.drawImage(v.canvas, c0, r0, c1 - c0, r1 - r0, dx, dy, Math.round((c1 - c0) * k), Math.round((r1 - r0) * k));
    return { dx, dy, k, n: c1 - c0, m: r1 - r0 };
  }

  function draw() {
    const Wd = cv.width, Hd = cv.height, sd = s * dpr;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#10183E'; ctx.fillRect(0, 0, Wd, Hd);
    let top = null;
    for (const id of pickLevels()) top = blit(lv[id], sd) || top;
    // 1マスが大きく見えるときは、マスの間にうすい溝を入れて「ドット」らしくする
    if (top && top.k >= 7) {
      ctx.fillStyle = 'rgba(6,8,24,.22)';
      const g = Math.max(1, Math.round(dpr * 0.6));
      for (let i = 0; i <= top.n; i++) { const x = Math.round(top.dx + i * top.k); if (x >= -g && x <= Wd) ctx.fillRect(x, Math.max(0, top.dy), g, Math.min(Hd, top.m * top.k)); }
      for (let j = 0; j <= top.m; j++) { const y = Math.round(top.dy + j * top.k); if (y >= -g && y <= Hd) ctx.fillRect(Math.max(0, top.dx), y, Math.min(Wd, top.n * top.k), g); }
    }
    drawPins(sd);
    const h = current();
    if (h) {  // 現在地（点滅する四角）
      const [X, Y] = proj(h.lng, h.lat), x = Math.round((X - cx) * sd + Wd / 2), y = Math.round((Y - cy) * sd + Hd / 2), k = Math.round(4 * dpr), blink = (Date.now() >> 9) & 1;
      ctx.fillStyle = '#14122E'; ctx.fillRect(x - k - dpr, y - k - dpr, 2 * k + 2 * dpr, 2 * k + 2 * dpr);
      ctx.fillStyle = blink ? '#FF6B5A' : '#FFF4E0'; ctx.fillRect(x - k, y - k, 2 * k, 2 * k);
    }
    try { sessionStorage.setItem('tabiquest:dotmap', JSON.stringify({ cx, cy, s })); } catch (e) {}
  }

  function drawPins(sd) {
    const px = Math.max(1, Math.round(3 * dpr)), w = 8 * px, h = 9 * px;
    const pts = PLACES.map(p => { const [X, Y] = proj(p.lng, p.lat); return { p, x: (X - cx) * sd + cv.width / 2, y: (Y - cy) * sd + cv.height / 2 }; });
    const groups = [];   // 近すぎる印はまとめて、数を出す
    for (const q of pts) {
      const g = groups.find(g => Math.hypot(g.x - q.x, g.y - q.y) < 22 * dpr);
      if (g) g.items.push(q); else groups.push({ x: q.x, y: q.y, items: [q] });
    }
    // 行った印・選んだ印を上に重ねる
    const rank = g => g.items.some(q => visited(q.p.id)) + 2 * g.items.some(q => q.p.id === sel);
    groups.sort((a, b) => rank(a) - rank(b));
    pinRects = [];
    ctx.font = `${Math.round(11 * dpr)}px DotGothic16, monospace`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    for (const g of groups) {
      const x = Math.round(g.x - w / 2), y = Math.round(g.y - h);
      if (x > cv.width || y > cv.height || x + w < 0 || y + h < 0) continue;
      const isSel = sel && g.items.some(q => q.p.id === sel), v = g.items.some(q => visited(q.p.id));
      ctx.drawImage(pinSprite(isSel ? PIN_COL.sel : v ? PIN_COL.yes : PIN_COL.no, px), x, y);
      if (g.items.length > 1) {
        const bx = x + w, by = y + px * 2, bw = Math.round(16 * dpr), bh = Math.round(14 * dpr);
        ctx.fillStyle = '#14122E'; ctx.fillRect(bx - bw / 2, by - bh / 2, bw, bh);
        ctx.fillStyle = '#FFFFFF'; ctx.fillText(String(g.items.length), bx, by + dpr * 0.5);
      }
      pinRects.push({ x: x / dpr, y: y / dpr, w: w / dpr, h: h / dpr, g });
    }
  }

  // 拡大率を、いま見ている段の1マスがちょうど整数の画面ピクセルになるようにそろえる（にじみ・ムラを防ぐ）
  function settle() {
    const id = pickLevels().slice(-1)[0]; if (!id) return;
    const L = lv[id].L, k = Math.max(1, Math.round(L.cell * s * dpr));
    s = Math.min(S_MAX, Math.max(S_MIN, k / dpr / L.cell));
    const sd = s * dpr, ox = (L.x0 - cx) * sd + cv.width / 2, oy = (L.y0 - cy) * sd + cv.height / 2;
    cx = L.x0 - (Math.round(ox) - cv.width / 2) / sd; cy = L.y0 - (Math.round(oy) - cv.height / 2) / sd;
    req();
  }
  function zoomAbout(px, py, f) {
    const X = cx + (px - Wc / 2) / s, Y = cy + (py - Hc / 2) / s;
    s = Math.min(S_MAX, Math.max(S_MIN, s * f));
    cx = X - (px - Wc / 2) / s; cy = Y - (py - Hc / 2) / s; req();
  }
  let fly = 0;
  function flyTo(X, Y, s1) {
    const a = { cx, cy, ls: Math.log(s) }, b = { cx: X, cy: Y, ls: Math.log(Math.min(S_MAX, Math.max(S_MIN, s1))) };
    const t0 = performance.now(), id = ++fly, T = 650;
    const step = now => {
      if (id !== fly || !alive()) return;
      const t = Math.min(1, (now - t0) / T), e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      cx = a.cx + (b.cx - a.cx) * e; cy = a.cy + (b.cy - a.cy) * e; s = Math.exp(a.ls + (b.ls - a.ls) * e); draw();
      if (t < 1) requestAnimationFrame(step); else settle();
    };
    requestAnimationFrame(step);
  }

  function showInfo(p) {
    sel = p ? p.id : null; req();
    if (!p) { info.hidden = true; return; }
    const cs = cardsOf(p.id), st = statusOf(p);
    info.hidden = false;
    info.innerHTML = `<button class="x" data-a="x" aria-label="とじる">×</button><b>${esc(p.name)}</b>${p.kind === 'photo' ? ' <span class="kari-s static">仮</span>' : ''}
      <span class="sub">${esc(p.pref)} ${esc(p.city)} ／ ${p.categories.map(esc).join('・')}</span>
      <span class="sub">${cs.length ? `カード ${cs.length}まい` : 'まだ行っていません'}${st.known ? ` ／ ${st.inside ? '到着できます！' : 'ここから ' + fmtDist(st.d)}` : ''}</span>
      <div class="row"><button class="btn" data-a="near">まわりを見る</button>${cs.length ? `<a class="btn" href="#/place/${p.id}">アルバム</a>` : ''}<a class="btn" href="#/">名所の一覧へ</a></div>`;
  }
  info.addEventListener('click', e => {
    if (e.target.closest('[data-a=x]')) showInfo(null);
    if (e.target.closest('[data-a=near]')) { const p = PLACES.find(q => q.id === sel); if (p) flyTo(...proj(p.lng, p.lat), NEAR_S); }
  });

  function handleTap(x, y) {
    const hit = [...pinRects].reverse().find(r => x >= r.x - 6 && x <= r.x + r.w + 6 && y >= r.y - 6 && y <= r.y + r.h + 6);
    if (!hit) { showInfo(null); return false; }
    const items = hit.g.items;
    if (items.length > 1) {   // まとまった印は、寄って広げる
      const xs = items.map(q => proj(q.p.lng, q.p.lat));
      const X = xs.reduce((a, b) => a + b[0], 0) / xs.length, Y = xs.reduce((a, b) => a + b[1], 0) / xs.length;
      const span = Math.max(...xs.map(([a, b]) => Math.max(Math.abs(a - X), Math.abs(b - Y)))) * 2.6 + 0.6;
      flyTo(X, Y, Math.min(Wc, Hc) / span); return true;
    }
    showInfo(items[0].p); return true;
  }

  // 指の操作：ドラッグで移動、2本指で拡大縮小、印をタップで情報、何もない所を2回タップで拡大
  const pts = new Map(); let tap = null, lastTap = 0, pinch = null;
  const pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  cv.addEventListener('pointerdown', e => {
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 合成のイベントなど */ } fly++;
    const p = pos(e); pts.set(e.pointerId, p);
    tap = pts.size === 1 ? { ...p, t: performance.now(), moved: false } : null;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; }
  });
  cv.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    const p = pos(e), prev = pts.get(e.pointerId); pts.set(e.pointerId, p);
    if (tap && Math.hypot(p.x - tap.x, p.y - tap.y) > 8) tap.moved = true;
    if (pts.size === 1) { cx -= (p.x - prev.x) / s; cy -= (p.y - prev.y) / s; req(); }
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
    if (pts.size === 1) tap = null;
    if (pts.size === 0) {
      if (tap && !tap.moved && performance.now() - tap.t < 400) {
        const now = performance.now();
        if (!handleTap(tap.x, tap.y) && now - lastTap < 300) { zoomAbout(tap.x, tap.y, 2); lastTap = 0; } else lastTap = now;
      }
      settle();
    }
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { e.preventDefault(); const p = pos(e); zoomAbout(p.x, p.y, Math.exp(-e.deltaY * 0.0015)); clearTimeout(cv._wt); cv._wt = setTimeout(settle, 150); }, { passive: false });

  view.querySelector('.mapctl').addEventListener('click', e => {
    const bt = e.target.closest('button'); if (!bt) return;
    if (bt.dataset.z) { zoomAbout(Wc / 2, Hc / 2, bt.dataset.z === '1' ? 2 : 0.5); settle(); }
    if (bt.dataset.a === 'jp') flyTo(...proj(137.2, 37.2), Math.min(Wc, Hc) / 2000);
    if (bt.dataset.a === 'here') {
      const h = current();
      if (h) flyTo(...proj(h.lng, h.lat), Math.max(s, Math.min(Wc, Hc) / 20));
      else { const el = document.getElementById('toast'); el.textContent = '名所の一覧で「現在地を確かめる」を押すと、地図にも出ます'; el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 2600); }
    }
  });
  const ro = new ResizeObserver(() => { size(); settle(); }); ro.observe(wrap);
  const tick = setInterval(() => { if (!alive()) { clearInterval(tick); ro.disconnect(); return; } if (current()) req(); }, 512);
}
