// ドットの地図：Natural Earth の県境データを 1マス＝約1km のドットに落としたもの（assets/map/map_jp.png）
// 色はパレットで決める（R＝県番号、G＝1:県境 2:海岸）。地図の上に名所のドットの印を載せる
import { PLACES, placeById } from './places.js';
import { cardsOf, visited } from './store.js';
import { current, statusOf, fmtDist } from './geo.js';
import { esc } from './ui.js';

let base = null;   // { meta, img: 色をつけた地図の canvas, idx: 県番号 }
const VISITED_KEY = new Set();

async function loadBase() {
  if (base) return base;
  const meta = await (await fetch('assets/map/map_jp.json')).json();
  const im = new Image(); im.src = 'assets/map/map_jp.png'; await im.decode();
  const c = document.createElement('canvas'); c.width = meta.W; c.height = meta.H;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0);
  const src = x.getImageData(0, 0, meta.W, meta.H);
  base = { meta, raw: src.data, canvas: c, ctx: x, painted: '' };
  return base;
}

// 行った県だけ色を変えるので、行った県の組み合わせが変わったときだけ塗り直す
function paint(b, visitedPrefs) {
  const key = [...visitedPrefs].sort().join(',');
  if (b.painted === key) return;
  const { W, H } = b.meta, out = b.ctx.createImageData(W, H), o = out.data, r = b.raw;
  const SEA = [[16, 24, 62], [20, 30, 72]], LAND = [[72, 104, 92], [80, 114, 98], [66, 98, 90]], LANDV = [[214, 170, 92], [226, 184, 104]];
  const BORDER = [44, 62, 66], BORDERV = [150, 104, 60], COAST = [182, 200, 186], COASTV = [255, 232, 170];
  for (let y = 0, i = 0; y < H; y++) for (let xx = 0; xx < W; xx++, i += 4) {
    const code = r[i], g = r[i + 1], v = code && visitedPrefs.has(code);
    let c;
    if (!code) c = SEA[((xx >> 1) + (y >> 1)) & 1 ? 1 : 0];          // 海：2マスごとの市松で、ドットの手ざわり
    else if (g === 2) c = v ? COASTV : COAST;
    else if (g === 1) c = v ? BORDERV : BORDER;
    else c = v ? LANDV[(xx + y) & 1] : LAND[code % 3];
    o[i] = c[0]; o[i + 1] = c[1]; o[i + 2] = c[2]; o[i + 3] = 255;
  }
  b.ctx.putImageData(out, 0, 0); b.painted = key;
}

const toMap = (m, lat, lng) => [(lng - m.lon0) * m.kx, (m.lat0 - lat) * m.ky];

// 名所の印（ドット絵風のピン）。0=透明 1=ふち 2=中 3=光
const PIN = ['..1111..', '.122221.', '12233221', '12233221', '12222221', '.122221.', '..1221..', '...11...', '...11...'];
function drawPin(ctx, x, y, s, col) {
  const pal = { 1: '#14122E', 2: col, 3: '#FFF4E0' };
  PIN.forEach((row, j) => [...row].forEach((ch, i) => { if (pal[ch]) { ctx.fillStyle = pal[ch]; ctx.fillRect(Math.round(x + (i - 4) * s), Math.round(y + (j - 9) * s), Math.ceil(s), Math.ceil(s)); } }));
}

export async function renderMap(view) {
  view.innerHTML = `<div class="mapwrap"><canvas class="map" aria-label="ドットの日本地図。名所の印を押すと情報が出ます"></canvas>
    <div class="mapctl"><button data-z="1" aria-label="拡大">＋</button><button data-z="-1" aria-label="縮小">−</button><button data-a="here" aria-label="現在地へ">◎</button></div>
    <div class="maplegend"><span><i class="lg v"></i>行った</span><span><i class="lg n"></i>まだ</span><span class="src">地図：Natural Earth</span></div>
    <div class="mapinfo" hidden></div></div>`;
  const b = await loadBase(), m = b.meta;
  const cv = view.querySelector('canvas.map'), ctx = cv.getContext('2d'), info = view.querySelector('.mapinfo'), wrap = view.querySelector('.mapwrap');
  const prefCode = Object.fromEntries(Object.entries(m.prefs).map(([k, v]) => [v.name, +k]));
  const vp = new Set(PLACES.filter(p => visited(p.id)).map(p => prefCode[p.pref]).filter(Boolean));
  paint(b, vp);

  // 表示の状態：中心（地図のマス）と倍率（1マス＝何画面px。整数にしてドットをそろえる）
  const pos = current(), start = pos ? toMap(m, pos.lat, pos.lng) : toMap(m, 35.45, 139.64);
  const st = { cx: start[0], cy: start[1], z: 10, sel: null };
  try { Object.assign(st, JSON.parse(sessionStorage.getItem('tabiquest:map') || '{}')); } catch (e) {}
  const ZMIN = 1, ZMAX = 40;
  let dpr = 1, Wc = 0, Hc = 0;
  function size() { const r = wrap.getBoundingClientRect(); dpr = Math.min(3, window.devicePixelRatio || 1); Wc = r.width; Hc = r.height; cv.width = Math.round(Wc * dpr); cv.height = Math.round(Hc * dpr); draw(); }
  const toScreen = (mx, my) => [(mx - st.cx) * st.z + Wc / 2, (my - st.cy) * st.z + Hc / 2];

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#10183E'; ctx.fillRect(0, 0, Wc, Hc);
    const z = st.z, ox = Wc / 2 - st.cx * z, oy = Hc / 2 - st.cy * z;
    ctx.drawImage(b.canvas, Math.round(ox), Math.round(oy), m.W * z, m.H * z);
    const s = Math.max(2, Math.min(4, Math.round(z / 4)));
    const order = [...PLACES].sort((a, z) => (visited(a.id) + (a.id === st.sel) * 2) - (visited(z.id) + (z.id === st.sel) * 2));
    for (const p of order) {
      const [x, y] = toScreen(...toMap(m, p.lat, p.lng)); if (x < -40 || y < -40 || x > Wc + 40 || y > Hc + 40) continue;
      drawPin(ctx, x, y, s, visited(p.id) ? '#FFC857' : p.id === st.sel ? '#3ED6C4' : '#8FA8FF');
    }
    const here = current();
    if (here) { const [x, y] = toScreen(...toMap(m, here.lat, here.lng)); const k = Math.max(3, s + 1), blink = (Date.now() >> 9) & 1;
      ctx.fillStyle = '#14122E'; ctx.fillRect(x - k - 1, y - k - 1, k * 2 + 2, k * 2 + 2); ctx.fillStyle = blink ? '#FF6B5A' : '#FFF4E0'; ctx.fillRect(x - k, y - k, k * 2, k * 2); }
    try { sessionStorage.setItem('tabiquest:map', JSON.stringify({ cx: st.cx, cy: st.cy, z: st.z })); } catch (e) {}
  }
  const zoomAt = (nz, sx = Wc / 2, sy = Hc / 2) => {
    nz = Math.max(ZMIN, Math.min(ZMAX, Math.round(nz))); if (nz === st.z) return;
    const mx = st.cx + (sx - Wc / 2) / st.z, my = st.cy + (sy - Hc / 2) / st.z;
    st.z = nz; st.cx = mx - (sx - Wc / 2) / nz; st.cy = my - (sy - Hc / 2) / nz; draw();
  };
  const step = d => (d > 0 ? (st.z < 4 ? st.z + 1 : st.z * 1.5) : (st.z <= 4 ? st.z - 1 : st.z / 1.5));

  function showInfo(p) {
    st.sel = p ? p.id : null; draw();
    if (!p) { info.hidden = true; return; }
    const cs = cardsOf(p.id), s2 = statusOf(p);
    info.hidden = false;
    info.innerHTML = `<button class="x" data-a="x" aria-label="とじる">×</button><b>${esc(p.name)}</b>${p.kind === 'photo' ? ' <span class="kari-s static">仮</span>' : ''}
      <span class="sub">${esc(p.pref)} ${esc(p.city)} ／ ${p.categories.map(esc).join('・')}</span>
      <span class="sub">${cs.length ? `カード ${cs.length}まい` : 'まだ行っていません'}${s2.known ? ` ／ ${s2.inside ? '到着できます！' : 'ここから ' + fmtDist(s2.d)}` : ''}</span>
      <div class="row">${cs.length ? `<a class="btn" href="#/place/${p.id}">アルバム</a>` : ''}<a class="btn" href="#/" data-a="list">名所の一覧へ</a></div>`;
  }
  info.addEventListener('click', e => { if (e.target.closest('[data-a=x]')) showInfo(null); });

  // 指の操作：ドラッグで移動、2本指で拡大縮小、タップで印を選ぶ
  const pts = new Map(); let pinch = null, moved = 0;
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; if (pts.size === 2) { const [a, c] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - c[0], a[1] - c[1]), z: st.z }; } });
  cv.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return; const prev = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2 && pinch) { const [a, c] = [...pts.values()], r = cv.getBoundingClientRect(); zoomAt(pinch.z * Math.hypot(a[0] - c[0], a[1] - c[1]) / pinch.d, (a[0] + c[0]) / 2 - r.left, (a[1] + c[1]) / 2 - r.top); moved = 99; return; }
    const dx = e.clientX - prev[0], dy = e.clientY - prev[1]; moved += Math.abs(dx) + Math.abs(dy);
    st.cx -= dx / st.z; st.cy -= dy / st.z; draw();
  });
  const up = e => {
    if (pts.size === 1 && moved < 8) { // タップ：近くの印を選ぶ
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; let best = null, bd = 28;
      for (const p of PLACES) { const [px, py] = toScreen(...toMap(m, p.lat, p.lng)), d = Math.hypot(px - x, py - 14 - y); if (d < bd) { bd = d; best = p; } }
      showInfo(best);
    }
    pts.delete(e.pointerId); if (pts.size < 2) pinch = null;
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', e => { pts.delete(e.pointerId); pinch = null; });
  cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(); zoomAt(step(-e.deltaY), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  view.querySelector('.mapctl').addEventListener('click', e => {
    const bt = e.target.closest('button'); if (!bt) return;
    if (bt.dataset.z) zoomAt(step(+bt.dataset.z));
    if (bt.dataset.a === 'here') { const h = current(); if (h) { [st.cx, st.cy] = toMap(m, h.lat, h.lng); st.z = Math.max(st.z, 12); draw(); } else { const el = document.getElementById('toast'); el.textContent = '名所の一覧で「現在地を確かめる」を押すと、地図にも出ます'; el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 2600); } }
  });
  const ro = new ResizeObserver(size); ro.observe(wrap);
  const tick = setInterval(() => { if (!document.body.contains(cv)) { clearInterval(tick); ro.disconnect(); return; } if (current()) draw(); }, 512);
  size();
}
