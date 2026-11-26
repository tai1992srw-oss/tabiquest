// 見本帳（デバッグ版だけ。#/mihon）。足した名所の差分と、服・髪型・表情を、まとめて見るためのページ
//   名所：ドット絵の名所ごとに、時間帯・天気・季節の小さな絵を並べる。押すと、全画面の「パラパラ見る」が始まる（openFlip）
//   キャラ：部品（輪郭・目・まゆ・口・ほお・髪・服）の一覧。押すと、全身を大きく見る
//   「まだ見ていない」：この端末で「見た」を押していない物だけ。名所や服を足すと、何もしなくてもここに出る
//   絵は、アプリの本物の描き方（card.js の engine.snapshot、chara2.js の compose）で、その場で作る。描き足しはしない
import { PLACES, LABEL, TIMES, WEATHERS, seasonOf } from './places.js';
import { engine } from './card.js';
import { loadParts, SLOTS, NONE, has, itemName, homeLook, drawLook } from './chara2.js';
import { esc, toast } from './ui.js';

const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const DOTS = PLACES.filter(p => p.kind === 'dot');
// 見本帳を作る前（v0.10.46 まで）からあった名所。はじめて開いたとき、ここにない名所が「まだ見ていない」に出る
const OLD = DOTS.filter(p => ['minatomirai', 'chukagai', 'kamakura', 'tokyotower', 'mitsumine', 'chichibu', 'hodosan', 'nagatoro', 'hitsujiyama'].includes(p.scene)).map(p => p.id);
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const ui = Object.assign({ tab: 'place', only: 'new', axis: 'main', time: 'day', weather: 'clear', season: seasonOf() }, read('tabiquest:mihon', {}));
const seen = Object.assign({ place: OLD, wear: [], hair: [], face: [] }, read('tabiquest:mihon:seen', {}));
const saveUi = () => write('tabiquest:mihon', ui), saveSeen = () => write('tabiquest:mihon:seen', seen);
const isNew = (kind, id) => !seen[kind].includes(id);
const AXES = [['main', 'おもな差分'], ['time', '時間帯'], ['weather', '天気'], ['season', '季節'], ['all', '時間帯×天気']];

// 名所 p で並べる条件の一覧
function variants(p) {
  const T = TIMES.filter(t => p.times.includes(t)), v = (time, weather, season) => ({ time: p.times.includes(time) ? time : T[0], weather, season });
  if (ui.axis === 'time') return T.map(t => v(t, ui.weather, ui.season));
  if (ui.axis === 'weather') return WEATHERS.map(w => v(ui.time, w, ui.season));
  if (ui.axis === 'season') return SEASONS.map(s => v(ui.time, ui.weather, s));
  if (ui.axis === 'all') return T.flatMap(t => WEATHERS.map(w => v(t, w, ui.season)));
  // おもな差分：昼の四季 → 朝・夕暮れ・夜 → 曇り・雨 → 雪（昼と夜）
  return [...SEASONS.map(s => v('day', 'clear', s)), ...T.filter(t => t !== 'day').map(t => v(t, 'clear', ui.season)),
    v('day', 'cloudy', ui.season), v('day', 'rain', ui.season), v('day', 'snow', 'winter'), v('night', 'snow', 'winter')];
}

// ---- 小さな絵を順に作る（1枚ずつ。画面に入った行から） ----
const thumbs = new Map();   // 'scene|time|weather|season' → 小さな絵
let queue = [], busy = false, token = 0, scrollKeep = 0;
async function small(url) {
  const im = new Image(); im.src = url; await im.decode();
  const c = document.createElement('canvas'); c.width = 180; c.height = Math.round(180 * im.height / im.width);
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(im, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}
async function pump() {
  if (busy) return; busy = true;
  while (queue.length) {
    const job = queue.shift(); if (job.token !== token) continue;
    try {
      if (!thumbs.has(job.k)) thumbs.set(job.k, await small(await engine.snapshot(job.scene, job.st)));
      if (job.token === token) { job.el.style.backgroundImage = `url("${thumbs.get(job.k)}")`; job.el.classList.add('on'); }
    } catch (e) { job.el.classList.add('ng'); }
    await new Promise(r => setTimeout(r, 0));
  }
  busy = false;
}

function renderPlaces(box) {
  const list = DOTS.filter(p => ui.only === 'all' || isNew('place', p.id));
  const sel = (k, opts, lab) => `<label class="mh-sel">${lab}<select class="sel" data-ui="${k}">${opts.map(o => `<option value="${o}" ${ui[k] === o ? 'selected' : ''}>${LABEL[k][o]}</option>`).join('')}</select></label>`;
  const fixed = { main: ['season'], time: ['weather', 'season'], weather: ['time', 'season'], season: ['time', 'weather'], all: ['season'] }[ui.axis];
  box.innerHTML = `
    <div class="chips-row sub">${AXES.map(([v, l]) => `<button data-axis="${v}" aria-pressed="${ui.axis === v}">${l}</button>`).join('')}</div>
    ${list.length ? '<div class="mh-go"><button data-a="flip">▶ パラパラ見る（全画面）</button><small>絵を押しても始まります</small></div>' : ''}
    <div class="mh-fix">${fixed.map(k => sel(k, k === 'time' ? TIMES : k === 'weather' ? WEATHERS : SEASONS, k === 'time' ? '時間帯' : k === 'weather' ? '天気' : ui.axis === 'main' ? '季節（朝・夕暮れ・夜・曇り・雨の絵）' : '季節')).join('')}</div>
    ${list.length ? '' : '<p class="note pad">まだ見ていない名所はありません。「すべて」に切り替えると、ぜんぶ見られます。</p>'}
    ${list.map(p => `<section class="mh-p" data-place="${p.id}">
      <div class="mh-h"><b>${esc(p.name)}</b><small>${esc(p.no)}　${p.times.map(t => LABEL.time[t]).join('・')}</small><button data-seen="place:${p.id}" aria-pressed="${!isNew('place', p.id)}">${isNew('place', p.id) ? '見た' : '見た ✓'}</button></div>
      <div class="mh-row">${variants(p).map(v => `<a class="mh-t" href="#/preview/${p.id}/${v.time}/${v.weather}/${v.season}" data-v="${v.time}|${v.weather}|${v.season}"><span>${LABEL.time[v.time]}・${LABEL.weather[v.weather]}・${LABEL.season[v.season]}</span></a>`).join('')}</div>
    </section>`).join('')}`;
  const my = token;
  const io = new IntersectionObserver(es => {
    for (const e of es) if (e.isIntersecting) {
      io.unobserve(e.target); const p = DOTS.find(q => q.id === e.target.dataset.place);
      e.target.querySelectorAll('.mh-t').forEach(el => { const [time, weather, season] = el.dataset.v.split('|'); queue.push({ token: my, el, scene: p.scene, k: `${p.scene}|${el.dataset.v}`, st: { time, weather, season } }); });
      pump();
    }
  }, { rootMargin: '300px 0px' });
  box.querySelectorAll('.mh-p').forEach(s => io.observe(s));
  return () => io.disconnect();
}

// ---- キャラの部品（輪郭・目・まゆ・口・ほお・前髪・後ろ髪・服） ----
//   ふだんの見た目のうち、その部品だけを替えた絵を並べる。押すと、全身を大きく見る
function renderChara(box) {
  box.innerHTML = '<p class="note pad">読み込んでいます…</p>';
  const my = token;
  loadParts().then(P => {
    if (my !== token) return; const base = homeLook(P), key = (k, c) => `${k}/${c || 'none'}`;
    const groups = SLOTS.filter(([k]) => k !== 'hairB').map(([k, name]) => { if (k === 'hairF') name = '髪'; const all = P.ids.filter(c => has(P, k, c)).concat(NONE[k] ? [''] : []); return { k, name, total: all.length, items: all.filter(c => ui.only === 'all' || isNew('wear', key(k, c))) }; });
    const look = (k, c) => { const t = JSON.parse(JSON.stringify(base)); t[k] = c; if (k === 'hairF') t.hairB = c;   // 髪は、前髪と後ろ髪のセット
      if (k === 'rin') t.v = { ...P.J.chars[c].preset }; return t; };
    box.innerHTML = '<p class="note pad">ほかの部品は、いまのホームのお着替えのままです。絵を押すと、全身を大きく見られます。</p>' + groups.map(g => `<h3 class="gh">${g.name}（${g.items.length}${ui.only === 'all' ? '' : ` / ${g.total}`}）</h3>
      ${g.items.length ? `<div class="mh-grid">${g.items.map(c => `<div class="mh-c"><button class="mh-cv" data-open="${g.k}:${c}" aria-label="${esc(itemName(P, g.k, c))}を大きく見る"><canvas></canvas></button><b>${esc(itemName(P, g.k, c))}</b><button data-seen="wear:${key(g.k, c)}" aria-pressed="${!isNew('wear', key(g.k, c))}">${isNew('wear', key(g.k, c)) ? '見た' : '見た ✓'}</button></div>`).join('')}</div>` : '<p class="note pad">まだ見ていない物はありません。</p>'}`).join('');
    box._open = id => { const i = id.indexOf(':'), k = id.slice(0, i), c = id.slice(i + 1); openBig(P, `${k === 'hairF' ? '髪' : SLOTS.find(q => q[0] === k)[1]}：${itemName(P, k, c)}`, look(k, c)); };
    for (const g of groups) for (const c of g.items) { const cv = box.querySelector(`[data-open="${g.k}:${c}"] canvas`); if (cv) drawLook(cv, P, look(g.k, c), g.k === 'wear' ? 'body' : 'face'); }
  }).catch(() => { if (my === token) box.innerHTML = '<p class="note pad">キャラの絵を読み込めませんでした。</p>'; });
  return () => {};
}
// 全身を大きく見る
function openBig(P, name, L) {
  document.querySelector('.mh-pop')?.remove();
  const root = document.createElement('div'); root.className = 'mh-pop'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', name);
  root.innerHTML = `<div class="mh-popin"><div class="mh-h"><b>${esc(name)}</b><button data-x>とじる</button></div><div class="mh-poses one"><canvas></canvas></div></div>`;
  root.onclick = e => { if (e.target === root || e.target.closest('[data-x]')) root.remove(); };
  document.body.append(root); drawLook(root.querySelector('canvas'), P, L, 'body');
}

// ---- パラパラ見る（全画面。ストーリーズのように、押して次の差分、上下にはらって次の名所） ----
//   出すのは、動く本物のカード（題字なし）。右を押す＝次の差分、左＝前の差分、上にはらう＝次の名所、下にはらう＝前の名所
//   その名所の差分を最後まで見たら、「見た」のしるしを付ける
function openFlip(view, placeId, vi = 0) {
  const list = DOTS.filter(p => ui.only === 'all' || isNew('place', p.id)); let pi = Math.max(0, list.findIndex(p => p.id === placeId)); if (!list.length) return;
  document.querySelector('.mh-flip')?.remove();
  const root = document.createElement('div'); root.className = 'viewer story mh-flip'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'パラパラ見る');
  root.innerHTML = `<div class="frame"><div class="stage"><div class="card"></div></div>
    <div class="top"><div class="bars"></div><div class="who"><b></b><span class="when"></span><button class="x" data-a="close" aria-label="とじる">×</button></div></div>
    <div class="mh-fb"><span class="pos"></span><a class="shoot" href="#">撮影でひらく</a></div></div>`;
  document.body.append(root);
  const card = root.querySelector('.card'), bars = root.querySelector('.bars'); let shown = null, vs = [], my = 0; const looked = {};   // looked：名所ごとの、見た差分の番号
  const draw = () => {
    const p = list[pi]; if (shown !== p) { vs = variants(p); vi = Math.min(vi, vs.length - 1); }
    const v = vs[vi], st = { ...v, at: new Date().toISOString() }; (looked[p.id] ||= new Set()).add(vi);
    if (shown !== p) { shown = p; const k = ++my; engine.show(card, p.scene, st).then(() => { if (k !== my) return; const n = list[pi + 1]; if (n) engine.get(n.scene); }).catch(() => {}); }
    else engine.setState(st);
    if (looked[p.id].size === vs.length && isNew('place', p.id)) { seen.place.push(p.id); saveSeen(); }
    bars.innerHTML = vs.map((_, i) => `<i class="${i < vi ? 'seen' : i === vi ? 'now' : ''}"></i>`).join('');
    root.querySelector('.who b').textContent = p.name;
    root.querySelector('.when').textContent = `${LABEL.time[v.time]}・${LABEL.weather[v.weather]}・${LABEL.season[v.season]}`;
    root.querySelector('.pos').textContent = `${pi + 1} / ${list.length}　${isNew('place', p.id) ? '' : '見た ✓'}`;
    root.querySelector(".shoot").href = `#/preview/${p.id}/${v.time}/${v.weather}/${v.season}`;
  };
  const close = () => { document.removeEventListener('keydown', onKey); engine.stop(); root.remove(); if (location.hash.startsWith('#/mihon')) renderMihon(view); };
  const place = d => { const n = pi + d; if (n < 0) return; if (n >= list.length) { toast('さいごの名所です'); return; } pi = n; vi = 0; draw(); };
  const step = d => { const n = vi + d; if (n < 0) { if (pi > 0) { pi--; vi = 99; draw(); } return; } if (n >= vs.length) return place(1); vi = n; draw(); };
  const onKey = e => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight' || e.key === ' ') step(1); else if (e.key === 'ArrowLeft') step(-1); else if (e.key === 'ArrowDown') place(1); else if (e.key === 'ArrowUp') place(-1); else return; e.preventDefault(); };
  document.addEventListener('keydown', onKey);
  let down = null;
  root.addEventListener('pointerdown', e => { down = e.target.closest('button,a') ? null : [e.clientX, e.clientY]; });
  root.addEventListener('pointerup', e => {
    if (!down) return; const dx = e.clientX - down[0], dy = e.clientY - down[1]; down = null;
    if (Math.abs(dy) > 50 && Math.abs(dy) > Math.abs(dx)) return place(dy < 0 ? 1 : -1);
    if (Math.abs(dx) > 50) return step(dx < 0 ? 1 : -1);
    const r = root.querySelector('.frame').getBoundingClientRect(); step(e.clientX < r.left + r.width * .33 ? -1 : 1);
  });
  root.addEventListener('wheel', e => { e.preventDefault(); if (Math.abs(e.deltaY) > 20 && !root._w) { root._w = setTimeout(() => { root._w = 0; }, 350); place(e.deltaY > 0 ? 1 : -1); } }, { passive: false });
  root.querySelector('[data-a=close]').onclick = close;
  root.querySelector(".shoot").onclick = () => { document.removeEventListener('keydown', onKey); engine.stop(); root.remove(); };   // 撮影（試し見）へ。とじると見本帳にもどる
  draw();
}

// ---- ページ ----
let cleanup = null;
export function renderMihon(view) {
  cleanup?.(); token++; queue = [];
  const newN = { place: DOTS.filter(p => isNew('place', p.id)).length };
  view.innerHTML = `<div class="mihon"><div class="phead"><h1>見本帳</h1><span class="prog">デバッグ版だけ</span></div>
    <div class="chips-row"><button data-tab="place" aria-pressed="${ui.tab === 'place'}">名所の差分</button><button data-tab="chara" aria-pressed="${ui.tab === 'chara'}">キャラの部品</button>
      <span class="sep"></span><button data-only="new" aria-pressed="${ui.only === 'new'}">まだ見ていない${ui.tab === 'place' ? `（${newN.place}）` : ''}</button><button data-only="all" aria-pressed="${ui.only === 'all'}">すべて${ui.tab === 'place' ? `（${DOTS.length}）` : ''}</button></div>
    <div class="mh-body"></div>
    <div class="mh-foot"><button data-a="allseen">いま出ている物を、ぜんぶ見たことにする</button><button data-a="unseen">「見た」をぜんぶ取り消す</button><a class="btn" href="#/settings">設定へもどる</a></div></div>`;
  const body = view.querySelector('.mh-body');
  cleanup = ui.tab === 'place' ? renderPlaces(body) : renderChara(body);
  const again = () => { saveUi(); scrollKeep = 0; renderMihon(view); };
  view.querySelector('.mihon').onchange = e => { const k = e.target.dataset.ui; if (k) { ui[k] = e.target.value; again(); } };
  view.querySelector('.mihon').onclick = e => {
    const t = e.target.closest('.mh-t');
    if (t) { e.preventDefault(); scrollKeep = scrollY; const sec = t.closest('.mh-p'); return openFlip(view, sec.dataset.place, [...sec.querySelectorAll('.mh-t')].indexOf(t)); }
    const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
    if (d.tab) { ui.tab = d.tab; return again(); }
    if (d.only) { ui.only = d.only; return again(); }
    if (d.axis) { ui.axis = d.axis; return again(); }
    if (d.open) return body._open?.(d.open);
    if (d.a === 'flip') { scrollKeep = scrollY; return openFlip(view, view.querySelector('.mh-p')?.dataset.place, 0); }
    if (d.seen) {   // 「見た」の入り切り。押してもすぐには消さない（つづけて見られるように。開き直すと消える）
      const [kind, id] = d.seen.split(':'), on = isNew(kind, id);
      seen[kind] = on ? [...seen[kind], id] : seen[kind].filter(x => x !== id); saveSeen();
      b.setAttribute('aria-pressed', String(on)); b.textContent = on ? '見た ✓' : '見た'; return;
    }
    if (d.a === 'allseen') {
      view.querySelectorAll('[data-seen]').forEach(x => { const [kind, id] = x.dataset.seen.split(':'); if (isNew(kind, id)) seen[kind].push(id); });
      saveSeen(); toast('見たことにしました'); return again();
    }
    if (d.a === 'unseen') { if (confirm('「見た」のしるしを、ぜんぶ取り消しますか？')) { seen.place = []; seen.wear = []; seen.hair = []; seen.face = []; saveSeen(); again(); } }
  };
  const y = scrollKeep; requestAnimationFrame(() => window.scrollTo(0, y));
}
