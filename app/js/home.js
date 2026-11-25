// ホーム（マイルーム）：アプリを開いて最初に出る画面（Bondee・ピグのような部屋）
//   画面いっぱいに、斜め上から見た部屋（10×10マス）。横にスクロールして部屋を見わたす
//   分身キャラが部屋に立っていて、床を押すとそこまで歩く。キャラを押すとジャンプ
//   右のかべの窓：いまの時間帯・天気・季節のドット絵の名所が動いて見える（名所の絵をそのまま使う）
//   左のかべ：手に入れたカードを写真として貼る。床：家具（見本・ご当地アイテム・ショップの品）を置く
//   ボタンや文字は、ストーリーズのように部屋の上に重ねる
//   部屋と家具の絵は room_art.js でコードで描く（女の子らしい部屋。2026-11-25、マイルームはコードで描いてよいと決まった）
import { PLACES, placeById, LABEL, seasonOf } from './places.js';
import { book, mode, settings, saveBook } from './store.js';
import { engine, snapshot, reduceMotion } from './card.js';
import { current, distance } from './geo.js';
import { conditionsAt, renderTime, timeOfDay } from './conditions.js';
import { esc, img, cardEl, fmtDate, toast } from './ui.js';
import { S, N, TW, TH, OX, OY, RW, RH, P, LEFT, RIGHT, PHOTO_SLOTS, WINDOW, onWall as wallAt, buildRoom, drawGarland, furnSprite } from './room_art.js';

const DOTS = PLACES.filter(p => p.kind === 'dot');
const dayNo = d => Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);

const K = 2;      // 画面では論理の大きさの K 倍の細かさで描く
const CS = .8;   // キャラの大きさ（部屋に対して小さめに）

// 家具：w・d は床で使うマス（右向き・左向き）、h は高さ、flat は上に乗れる敷きもの
//   見本（demo-）は、絵ができるまでの部屋の感じを見るための仮の家具。いつでも置ける
const DEMO = [
  { id: 'demo-bed', name: 'ベッド', w: 3, d: 2, h: 92, art: 'bed' },
  { id: 'demo-sofa', name: 'ソファ', w: 3, d: 1, h: 62, art: 'sofa' },
  { id: 'demo-table', name: 'まるいテーブル', w: 1, d: 1, h: 34, art: 'table' },
  { id: 'demo-shelf', name: '本だな', w: 1, d: 2, h: 160, art: 'shelf' },
  { id: 'demo-vanity', name: 'ドレッサー', w: 2, d: 1, h: 176, art: 'vanity' },
  { id: 'demo-rug', name: 'まるいラグ', w: 3, d: 3, h: 3, art: 'rug', flat: true },
  { id: 'demo-plant', name: '観葉植物', w: 1, d: 1, h: 96, art: 'plant' },
  { id: 'demo-lamp', name: 'スタンドライト', w: 1, d: 1, h: 132, art: 'lamp', light: 132 },
  { id: 'demo-bear', name: 'くまのぬいぐるみ', w: 1, d: 1, h: 74, art: 'bear' },
];
// ショップの品（仮の値段）
export const SHOP = [
  { id: 'shop-frame', name: '写真立て', price: 150, w: 1, d: 1, h: 44, art: 'frame' },
  { id: 'shop-plant', name: '大きな観葉植物', price: 200, w: 1, d: 1, h: 120, art: 'plant', big: true },
  { id: 'shop-poster', name: '旅のポスター', price: 250, w: 1, d: 1, h: 74, art: 'poster' },
  { id: 'shop-lamp', name: 'ランプ', price: 300, w: 1, d: 1, h: 42, art: 'tlamp', light: 40 },
  { id: 'shop-rug', name: 'ちいさなラグ', price: 400, w: 2, d: 2, h: 3, art: 'rug', flat: true },
  { id: 'shop-globe', name: '地球儀', price: 500, w: 1, d: 1, h: 62, art: 'globe' },
  { id: 'shop-trunk', name: '旅のトランク', price: 800, w: 2, d: 1, h: 44, art: 'trunk' },
];
const DEMO_LAYOUT = [['demo-rug', 4, 4], ['demo-bed', 0, 1], ['demo-shelf', 0, 7], ['demo-vanity', 3, 0], ['demo-lamp', 6, 0], ['demo-plant', 9, 0],
  ['demo-table', 5, 5], ['demo-sofa', 4, 3], ['demo-bear', 7, 6]];
const furn = id => DEMO.find(x => x.id === id) || SHOP.find(x => x.id === id) || { id, w: 1, d: 1, h: 30, art: 'gift' };   // ご当地アイテムはリボンの箱
const itemName = id => (DEMO.find(x => x.id === id) || SHOP.find(x => x.id === id))?.name || PLACES.find(p => p.item.id === id)?.item.name.replace(/（仮）$/, '') || id;
const itemFrom = id => { if (id.startsWith('demo-')) return 'はじめからある家具'; const p = PLACES.find(x => x.item.id === id); return p ? p.name : SHOP.some(x => x.id === id) ? 'ショップ' : ''; };
const owns = (b, id) => DEMO.some(x => x.id === id) || (b.items[id] || 0) > 0;

// 部屋の記録（記録の中の room）：{ v:5, photos:[カードid×3], objects:[{ id, i, j }], me:{ i, j } }
function room(b) {
  if (!b.room || b.room.v !== 5) b.room = { v: 5, photos: (b.room?.photos || []).slice(0, 3), objects: DEMO_LAYOUT.map(([id, i, j]) => ({ id, i, j })), me: { i: 3, j: 7 } };
  const r = b.room;
  r.photos = PHOTO_SLOTS.map((_, k) => (r.photos[k] && b.cards.some(c => c.id === r.photos[k]) ? r.photos[k] : null));
  r.objects = r.objects.filter(o => owns(b, o.id) && fits(o, o.i, o.j, []));
  r.me ||= { i: 3, j: 7 };
  return r;
}
// 家具が床に収まるか、ほかの家具と重ならないか（敷きものの上には置ける）
function fits(o, i, j, others) {
  const f = furn(o.id); if (i < 0 || j < 0 || i + f.w > N || j + f.d > N) return false;
  return !others.some(x => { const g = furn(x.id); if (x === o || !!g.flat !== !!f.flat) return false; return i < x.i + g.w && x.i < i + f.w && j < x.j + g.d && x.j < j + f.d; });
}
const blocked = (r, i, j) => r.objects.some(o => { const f = furn(o.id); return !f.flat && i >= o.i && i < o.i + f.w && j >= o.j && j < o.j + f.d; });

// ---- ログインボーナス ----
const dayKey = d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const bonusOf = streak => (streak % 7 === 0 ? 100 : 20);   // 7日つづけるごとに大きく
function loginState(b, now) {
  const L = b.login || { last: null, streak: 0, days: 0 };
  const y = new Date(now); y.setDate(y.getDate() - 1);
  const got = L.last === dayKey(now), next = got ? L.streak : L.last === dayKey(y) ? L.streak + 1 : 1;
  return { L, got, next };
}
function claimLogin(b, now) {
  const { L, got, next } = loginState(b, now); if (got) return 0;
  const pts = bonusOf(next); b.login = { last: dayKey(now), streak: next, days: (L.days || 0) + 1 }; b.points += pts; saveBook(); return pts;
}

// 窓の外の景色に使うドット絵の名所：近くにあればそこ、なければ日がわりで
function homeScene(now) {
  const pos = current();
  if (pos) { const n = [...DOTS].sort((a, z) => distance(pos, a) - distance(pos, z))[0]; if (distance(pos, n) < 30000) return n; }
  return DOTS[dayNo(now) % DOTS.length];
}
const GREET = { morning: 'おはよう', day: 'こんにちは', evening: 'おつかれさま', night: 'こんばんは' };
const WEEK = '日月火水木金土';

// 分身キャラの立ち姿：カードと同じ絵（色番号の絵＋色の表）を、ふつうの色の絵にもどす
let charaImg = null;
function loadChara() {
  return charaImg || (charaImg = (async () => {
    const base = 'assets/kamakura/', D = await (await fetch(base + 'data.json')).json();
    const im = new Image(); im.src = base + 'chara.png'; await im.decode();
    const [w, h] = D.charaTex || D.chara, c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0, w, h, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h), pal = D.pal.chara;
    for (let k = 0; k < d.data.length; k += 4) { if (d.data[k + 3] < 128) { d.data[k + 3] = 0; continue; } const p = pal[d.data[k]] || [255, 0, 255]; d.data[k] = p[0]; d.data[k + 1] = p[1]; d.data[k + 2] = p[2]; d.data[k + 3] = 255; }
    x.putImageData(d, 0, 0); return c;
  })());
}

// view：表示する場所、header：上のポイント表示を新しくする関数。返す関数で、絵の動きを止める
export function renderHome(view, { header } = {}) {
  const now = new Date(), b = book(), r = room(b), dbg = mode() === 'debug';
  const scene = homeScene(now);
  const timeReal = dbg && settings.time !== 'auto' ? settings.time : timeOfDay(now);
  let wx = dbg && settings.weather !== 'auto' ? settings.weather : null;   // わかるまでは天気を書かない
  let st = { time: renderTime(scene, timeReal), timeReal, weather: wx || 'clear',
    season: dbg && settings.season && settings.season !== 'auto' ? settings.season : seasonOf(now), at: now.toISOString() };
  const lg = loginState(b, now);
  let edit = false, sel = null;   // 模様がえ中か、動かそうとしている家具

  view.classList.add('homemode');
  view.innerHTML = `
    <div class="hm-stage">
      <div class="hm-scroll"><canvas class="hm-iso" width="${RW * K}" height="${RH * K}" role="img" aria-label="マイルーム。分身キャラが部屋に立っている"></canvas></div>
      <div class="hm-ov top">
        <div class="hm-greet"><small>${now.getMonth() + 1}月${now.getDate()}日（${WEEK[now.getDay()]}）</small><b>${GREET[timeReal]}</b>
          <span class="chips"><span class="chip t">${LABEL.time[timeReal]}</span><span class="chip w"${wx ? '' : ' hidden'}>${wx ? LABEL.weather[wx] : ''}</span><span class="chip s">${LABEL.season[st.season]}</span></span></div>
        ${lg.got ? '' : `<button class="hm-bonus" data-a="login"><b>ログインボーナス</b><small>${lg.next}日め ・ +${bonusOf(lg.next)}pt を受け取る</small></button>`}
      </div>
      <div class="hm-ov side">
        <button data-a="edit" aria-pressed="false"><i aria-hidden="true">✎</i><span>模様がえ</span></button>
        <a href="#/shop"><i aria-hidden="true">¥</i><span>ショップ</span></a>
        <a href="#/zukan"><i aria-hidden="true">▦</i><span>図鑑</span></a>
        <a href="#/list"><i aria-hidden="true">◆</i><span>名所</span></a>
      </div>
      <div class="hm-ov bot"><p class="hm-tip"></p>
        <div class="hm-selbar" hidden><button data-a="remove">外す</button><button data-a="cancel">やめる</button></div></div>
      <div class="hm-engine" aria-hidden="true"></div>
    </div>`;

  const scroller = view.querySelector('.hm-scroll'), cv = view.querySelector('.hm-iso'), ctx = cv.getContext('2d');
  const tip = view.querySelector('.hm-tip'), selbar = view.querySelector('.hm-selbar');
  const setTip = () => {
    tip.textContent = !edit ? '床を押すと、そこまで歩きます。横にスクロールすると部屋を見わたせます。'
      : sel ? `「${itemName(sel.id)}」を置きたいマスを押してください。` : 'マスを押すと家具を置けます。家具を押すと動かしたり外したりできます。左のかべの枠には写真を貼れます。';
    selbar.hidden = !(edit && sel);
  };
  setTip();

  // 窓の外：名所のカードを見えないところで動かし、その上のほう（空と街）を窓に写す
  const holder = view.querySelector('.hm-engine'), card = cardEl(scene, st, { stamp: false, welcome: false }); holder.append(card);
  engine.show(card, scene.scene, st);
  if (!wx) conditionsAt(scene, null).then(v => {   // 天気は名所の位置で調べる（現在地は送らない）
    if (!view.contains(holder)) return;
    wx = v.weather === 'unknown' ? null : v.weather; st = { ...st, time: v.time, timeReal: v.timeReal, weather: v.weather }; engine.setState(st);
    const w = view.querySelector('.hm-greet .chip.w'); if (w && wx) { w.textContent = LABEL.weather[wx]; w.hidden = false; }
  });

  // 写真（左のかべ）
  const photos = PHOTO_SLOTS.map(() => null);
  const loadPhotos = () => r.photos.forEach((id, k) => { photos[k] = null; const c = b.cards.find(x => x.id === id), p = c && placeById(c.placeId); if (p) snapshot(p.scene, c).then(u => { const im = new Image(); im.onload = () => { photos[k] = im; }; im.src = u; }); });
  loadPhotos();

  // キャラ（位置は床のマスの単位）
  let chara = null; loadChara().then(c => { chara = c; }).catch(() => {});
  const me = { x: r.me.i + .5, y: r.me.j + .5, tx: null, ty: null, flip: false, jump: 0 };
  // はじめはキャラが画面のまん中に来るようにスクロール
  requestAnimationFrame(() => { const [sx] = P(me.x, me.y); scroller.scrollLeft = sx / RW * cv.clientWidth - scroller.clientWidth / 2; });

  // ---- 描く ----
  const { bg, front } = buildRoom();
  const night = () => (st.time === 'night' ? 1 : st.time === 'evening' ? .55 : 0);
  const poly = (pts, fill, stroke) => { ctx.beginPath(); pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); } };

  function drawRoom() {
    ctx.drawImage(bg, 0, 0, RW, RH);
    if (edit) { ctx.lineWidth = 1; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) poly([P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)], null, 'rgba(200,90,130,.35)'); }
    // 窓（右のかべ）：名所の景色の上のほう。そのあとで窓わくとカーテンを重ねる
    wallAt(ctx, RIGHT, WINDOW.u, WINDOW.v, WINDOW.w, WINDOW.h, (w, h) => {
      const src = engine.canvas, sw = src.width, sh = src.height * .45, sy = src.height * .04;
      const k = Math.max(w / sw, h / sh), dw = sw * k, dh = sh * k;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
      if (src.width) ctx.drawImage(src, 0, sy, sw, sh, (w - dw) / 2, 0, dw, dh);
      ctx.restore();
    });
    ctx.drawImage(front, 0, 0, RW, RH);
    // 写真（左のかべ）：白いふちとマスキングテープ
    PHOTO_SLOTS.forEach((s, k) => wallAt(ctx, LEFT, s.u, s.v, s.w, s.h, (w, h) => {
      const im = photos[k];
      if (im) {
        ctx.fillStyle = 'rgba(120,60,80,.18)'; ctx.fillRect(3, 4, w, h);
        ctx.fillStyle = '#FFFDF8'; ctx.fillRect(0, 0, w, h); const iw = w - 10, ih = h - 22, sw = im.width, sh = sw * ih / iw; ctx.drawImage(im, 0, im.height * .55 - sh / 2, sw, sh, 5, 5, iw, ih);
        ctx.fillStyle = ['rgba(249,180,200,.85)', 'rgba(195,235,220,.85)', 'rgba(220,200,242,.85)'][k]; ctx.fillRect(w / 2 - 14, -6, 28, 12);
      } else if (edit) { ctx.setLineDash([5, 4]); ctx.strokeStyle = '#C46A8C'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, w - 2, h - 2); ctx.setLineDash([]); ctx.fillStyle = '#C46A8C'; ctx.font = '400 26px DotGothic16'; ctx.textAlign = 'center'; ctx.fillText('＋', w / 2, h / 2 + 9); }
    }));
  }
  // 家具：room_art.js で描いた絵を置く
  function drawObj(o) {
    const f = furn(o.id), sp = furnSprite(f), [x, y] = P(o.i, o.j);
    if (!f.flat) { const [sx, sy] = P(o.i + f.w / 2 + .04, o.j + f.d / 2 + .04); ctx.fillStyle = 'rgba(150,80,90,.16)'; ctx.beginPath(); ctx.ellipse(sx, sy, (f.w + f.d) * TW / 4 * .9, (f.w + f.d) * TH / 4 * .9, 0, 0, Math.PI * 2); ctx.fill(); }   // 足もとのかげ
    ctx.drawImage(sp.c, x - sp.ox, y - sp.oy, sp.W, sp.H);
    if (o === sel) { ctx.lineWidth = 3; poly([P(o.i, o.j), P(o.i + f.w, o.j), P(o.i + f.w, o.j + f.d), P(o.i, o.j + f.d)], 'rgba(255,200,87,.25)', '#FFC857'); ctx.lineWidth = 1; }
    if (edit) {   // 名前（模様がえ中だけ）
      const [cx, cy] = P(o.i + f.w / 2, o.j + f.d / 2, f.h); ctx.font = '400 13px DotGothic16'; ctx.textAlign = 'center';
      const nm = itemName(o.id), tw = Math.min(ctx.measureText(nm).width, 120);
      ctx.fillStyle = 'rgba(90,40,60,.78)'; ctx.fillRect(cx - tw / 2 - 5, cy - 26, tw + 10, 18); ctx.fillStyle = '#FFF4F6'; ctx.fillText(nm, cx, cy - 12, 120);
    }
  }
  // 夜と夕方：部屋を少し暗くして、スタンドライトやランプの明かりをつける（演出）
  function drawLight(t) {
    const n = night(); if (!n) return;
    ctx.fillStyle = `rgba(40,20,70,${.28 * n})`; ctx.fillRect(0, 0, RW, RH);
    ctx.globalCompositeOperation = 'lighter';
    for (const o of r.objects) { const f = furn(o.id); if (!f.light) continue; const [x, y] = P(o.i + .5, o.j + .5, f.light - 14), rr = 150;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rr); g.addColorStop(0, `rgba(255,190,150,${.32 * n})`); g.addColorStop(1, 'rgba(255,190,150,0)'); ctx.fillStyle = g; ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
    ctx.globalCompositeOperation = 'source-over';
  }
  function drawMe(t) {
    if (!chara) return;
    const [x, y] = P(me.x, me.y), walking = me.tx != null;
    const bob = walking ? Math.abs(Math.sin(t / 90)) * 4 : (reduceMotion() ? 0 : Math.sin(t / 600) * 1.2), jy = me.jump > 0 ? Math.sin(me.jump * Math.PI) * 44 : 0;
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(x, y + 2, 24 - jy * .2, 8 - jy * .06, 0, 0, Math.PI * 2); ctx.fill();
    const w = chara.width * CS, h = chara.height * CS, top = Math.round(y - h - bob - jy);
    ctx.save(); if (me.flip) { ctx.translate(Math.round(x) * 2, 0); ctx.scale(-1, 1); }
    ctx.drawImage(chara, Math.round(x - w / 2), top, w, h); ctx.restore();
  }

  let raf = 0, last = performance.now();
  function frame(t) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(50, t - last); last = t;
    if (me.tx != null) {   // 歩く（マスの単位で）
      const dx = me.tx - me.x, dy = me.ty - me.y, dist = Math.hypot(dx, dy), sp = .0035 * dt;
      if (dist <= sp) { me.x = me.tx; me.y = me.ty; me.tx = me.ty = null; } else { me.x += dx / dist * sp; me.y += dy / dist * sp; const sx = dx - dy; if (Math.abs(sx) > .01) me.flip = sx < 0; }
    }
    if (me.jump > 0) me.jump = Math.max(0, me.jump - dt / 520);
    ctx.setTransform(K, 0, 0, K, 0, 0); ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, RW, RH); ctx.lineWidth = 1;
    drawRoom();
    drawGarland(ctx, reduceMotion() ? 0 : t, 0);
    // 敷きものを先に、そのあと奥のものから順に（家具とキャラ）
    const flats = r.objects.filter(o => furn(o.id).flat), rest = r.objects.filter(o => !furn(o.id).flat);
    flats.forEach(drawObj);
    rest.map(o => { const f = furn(o.id); return { z: o.i + f.w + o.j + f.d - 1, f: () => drawObj(o) }; }).concat([{ z: me.x + me.y, f: () => drawMe(t) }])
      .sort((a, z) => a.z - z.z).forEach(x => x.f());
    drawLight(t);
    if (night()) drawGarland(ctx, reduceMotion() ? 0 : t, night());   // 夜はガーランドの電球が光る
  }
  raf = requestAnimationFrame(frame);

  // ---- さわる ----
  const at = e => { const rc = cv.getBoundingClientRect(); return [(e.clientX - rc.left) / rc.width * RW, (e.clientY - rc.top) / rc.height * RH]; };
  const tileAt = (x, y) => { const a = (x - OX) / (TW / 2), c = (y - OY) / (TH / 2), i = Math.floor((c + a) / 2), j = Math.floor((c - a) / 2); return i >= 0 && j >= 0 && i < N && j < N ? [i, j] : null; };
  const inWall = (W, s, x, y) => { const u = x - W.x0, v = W.y0 + u * W.k - y; return u >= s.u && u <= s.u + s.w && v >= s.v && v <= s.v + s.h; };
  // 押した場所にある家具（手前のものから）。箱の上の面・横の面のどこを押してもよい
  const objAt = (x, y) => [...r.objects].sort((a, z) => (z.i + z.j) - (a.i + a.j)).find(o => {
    const f = furn(o.id); for (let z = 0; z <= f.h; z += 8) { const a = (x - OX) / (TW / 2), c = (y + z - OY) / (TH / 2), i = (c + a) / 2, j = (c - a) / 2; if (i >= o.i && i < o.i + f.w && j >= o.j && j < o.j + f.d) return true; } return false; });
  cv.addEventListener('click', e => {
    const [x, y] = at(e);
    if (!edit) {
      const [mx, my] = P(me.x, me.y);
      if (chara && Math.abs(x - mx) < 30 && y < my + 6 && y > my - chara.height * CS) { if (!me.jump) me.jump = 1; return; }
      const tl = tileAt(x, y); if (!tl || blocked(r, ...tl)) return;   // 家具のあるマスには行かない
      me.tx = tl[0] + .5; me.ty = tl[1] + .5; r.me = { i: tl[0], j: tl[1] }; saveBook(); return;
    }
    const ps = PHOTO_SLOTS.findIndex(s => inWall(LEFT, s, x, y)); if (ps >= 0) { pickPhoto(b, r, ps, () => { saveBook(); loadPhotos(); }); return; }
    const tl = tileAt(x, y);
    if (sel) {   // 動かす先のマス
      if (!tl) return; if (fits(sel, tl[0], tl[1], r.objects)) { sel.i = tl[0]; sel.j = tl[1]; saveBook(); sel = null; setTip(); } else toast('そこには置けません');
      return;
    }
    const hit = objAt(x, y); if (hit) { sel = hit; setTip(); return; }
    if (tl) pickObject(b, r, tl, () => saveBook());
  });

  const rerender = () => { cleanup(); renderHome(view, { header }); };
  view.onclick = e => {
    const t = e.target.closest('button'); if (!t) return;
    const a = t.dataset.a;
    if (a === 'login') { const pts = claimLogin(b, new Date()); if (pts) { toast(`ログインボーナス +${pts}pt`); header?.(); } t.remove(); }
    else if (a === 'edit') { edit = !edit; sel = null; t.setAttribute('aria-pressed', String(edit)); t.querySelector('span').textContent = edit ? 'できた' : '模様がえ'; setTip(); }
    else if (a === 'remove' && sel) { r.objects = r.objects.filter(o => o !== sel); toast(`「${itemName(sel.id)}」を外しました`); sel = null; saveBook(); setTip(); }
    else if (a === 'cancel') { sel = null; setTip(); }
  };
  const cleanup = () => { cancelAnimationFrame(raf); engine.stop(); view.classList.remove('homemode'); view.onclick = null; document.querySelector('.hm-pick')?.remove(); };
  return cleanup;
}

// 下から出る、選ぶシート
function sheet(title, body, { canRemove, onRemove } = {}) {
  document.querySelector('.hm-pick')?.remove();
  const el = document.createElement('div'); el.className = 'hm-pick'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', title);
  el.innerHTML = `<div class="in"><div class="hd"><b>${esc(title)}</b><button class="x" data-a="close" aria-label="とじる">×</button></div><div class="bd"></div>
    ${canRemove ? '<button class="rm" data-a="remove">外す</button>' : ''}</div>`;
  el.querySelector('.bd').append(body);
  const close = () => el.remove();
  el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-a=close]')) close(); else if (e.target.closest('[data-a=remove]')) { onRemove(); close(); } });
  document.body.append(el); el.querySelector('.x').focus({ preventScroll: true });
  return close;
}

function pickPhoto(b, r, i, done) {
  const cards = [...b.cards].sort((a, z) => z.at.localeCompare(a.at));
  const box = document.createElement('div'); box.className = 'grid3';
  if (!cards.length) box.innerHTML = '<p class="note">まだカードがありません。名所に到着すると、カードが手に入ります。</p>';
  let close;
  for (const c of cards) {
    const p = placeById(c.placeId); if (!p) continue;
    const a = document.createElement('button'); a.className = 'opt pic' + (r.photos.includes(c.id) ? ' used' : ''); a.setAttribute('aria-label', `${p.name} ${fmtDate(c.at)}`);
    a.innerHTML = `<span class="cap">${esc(p.name)}<br>${fmtDate(c.at)}</span>`; snapshot(p.scene, c).then(u => a.prepend(img(u, '')));
    a.onclick = () => { const j = r.photos.indexOf(c.id); if (j >= 0) r.photos[j] = r.photos[i]; r.photos[i] = c.id; close(); done(); };
    box.append(a);
  }
  close = sheet('かべに貼るカード', box, { canRemove: !!r.photos[i], onRemove: () => { r.photos[i] = null; done(); } });
}

// 床のマスに置く家具を選ぶ。1つの品は部屋に1つまで（置いてあるものを選ぶと、そのマスへ動かす）
function pickObject(b, r, [i, j], done) {
  const ids = [...DEMO.map(x => x.id), ...Object.keys(b.items).filter(id => b.items[id] > 0)];
  const box = document.createElement('div'); box.className = 'grid3';
  let close;
  for (const id of ids) {
    const used = r.objects.find(o => o.id === id), f = furn(id);
    const a = document.createElement('button'); a.className = 'opt obj' + (used ? ' used' : '');
    a.innerHTML = `<b>${esc(itemName(id))}</b><small>${esc(itemFrom(id))} ・ ${f.w}×${f.d}マス${used ? '<br>置いてあるものを動かす' : ''}</small><span class="kari-s">絵はまだ</span>`;
    a.onclick = () => {
      const o = used || { id, i, j }, others = r.objects.filter(x => x !== o);
      if (!fits(o, i, j, others)) { toast('そこには置けません（大きさが合いません）'); return; }
      o.i = i; o.j = j; if (!used) r.objects.push(o); close(); done();
    };
    box.append(a);
  }
  close = sheet('このマスに置く家具', box);
}

// ---- ショップ ----
export function renderShop(view, { header } = {}) {
  const b = book();
  view.innerHTML = `<div class="phead"><a class="backbtn" href="#/home" aria-label="ホームにもどる">‹</a><h1>ショップ</h1><span class="prog">いま ${b.points}pt</span></div>
    <p class="nowline">ポイントで家具を買って、マイルームに置けます。品物の絵はまだです。</p>
    <ul class="hm-goods">${SHOP.map(g => { const have = (b.items[g.id] || 0) > 0;
      return `<li><div class="t"><b>${esc(g.name)}</b><small>${g.price}pt ・ ${g.w}×${g.d}マス</small></div><span class="kari-s static">絵はまだ</span>
        ${have ? '<span class="own">持っています</span>' : `<button class="hm-btn go" data-buy="${g.id}" ${b.points < g.price ? 'disabled' : ''}>買う</button>`}</li>`; }).join('')}</ul>`;
  view.querySelector('.hm-goods').onclick = e => {
    const t = e.target.closest('[data-buy]'); if (!t) return; const g = SHOP.find(x => x.id === t.dataset.buy);
    if (!g || b.points < g.price || b.items[g.id]) return;
    if (!confirm(`「${g.name}」を ${g.price}pt で買いますか？`)) return;
    b.points -= g.price; b.items[g.id] = 1; saveBook(); header?.(); toast(`「${g.name}」を買いました。ホームの模様がえで置けます`); renderShop(view, { header });
  };
}
