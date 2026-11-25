// ホーム（マイルーム）：アプリを開いて最初に出る画面（Bondee・ピグのような部屋）
//   画面いっぱいに、斜め上から見た部屋（10×10マス）。横にスクロールして部屋を見わたす
//   分身キャラが部屋に立っていて、床を押すとそこまで歩く。キャラを押すとジャンプ
//   右のかべの窓：いまの時間帯・天気・季節のドット絵の名所が動いて見える（名所の絵をそのまま使う）
//   左のかべ：手に入れたカードを写真として貼る。床：家具（見本・ご当地アイテム・ショップの品）を置く
//   ボタンや文字は、ストーリーズのように部屋の上に重ねる
//   部屋と家具の絵はまだない（絵はコードで描き足さない）。かべ・床は無地の仮の面、家具は大きさだけの仮の箱
//   絵ができたら、drawRoom の面と drawObj の箱を絵に差し替える
import { PLACES, placeById, LABEL, seasonOf } from './places.js';
import { book, mode, settings, saveBook } from './store.js';
import { engine, snapshot, reduceMotion } from './card.js';
import { current, distance } from './geo.js';
import { conditionsAt, renderTime, timeOfDay } from './conditions.js';
import { esc, img, cardEl, fmtDate, toast } from './ui.js';

const DOTS = PLACES.filter(p => p.kind === 'dot');
const dayNo = d => Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);

// ---- 部屋の形（論理の大きさ。画面では K 倍の細かさで描く） ----
const N = 10, TW = 112, TH = 56, WALL = 300, K = 2;          // 床のマス数、マスの幅・高さ、かべの高さ
const CS = .8;                                                 // キャラの大きさ（部屋に対して小さめに）
const OX = 20 + N * TW / 2, OY = 40 + WALL;                   // 床のいちばん奥の角
const RW = OX * 2, RH = OY + N * TH + 40;                      // 部屋の絵の幅・高さ
// 床の上の点（x：右のかべにそう向き、y：左のかべにそう向き、z：高さ）→ 画面
const P = (x, y, z = 0) => [OX + (x - y) * TW / 2, OY + (x + y) * TH / 2 - z];
// かべ：左は左の角から右上へ、右は奥の角から右下へ。u：横の位置、v：床からの高さ
const LEFT = { x0: OX - N * TW / 2, y0: OY + N * TH / 2, k: -.5 }, RIGHT = { x0: OX, y0: OY, k: .5 };
const PHOTO_SLOTS = [{ u: 150, v: 150, w: 74, h: 96 }, { u: 260, v: 168, w: 74, h: 96 }, { u: 370, v: 150, w: 74, h: 96 }];
const WINDOW = { u: 150, v: 110, w: 250, h: 170 };

// 家具：w・d は床で使うマス（右向き・左向き）、h は高さ、flat は上に乗れる敷きもの
//   見本（demo-）は、絵ができるまでの部屋の感じを見るための仮の家具。いつでも置ける
const DEMO = [
  { id: 'demo-bed', name: 'ベッド', w: 2, d: 3, h: 42, c: 0 },
  { id: 'demo-sofa', name: 'ソファ', w: 3, d: 1, h: 48, c: 1 },
  { id: 'demo-table', name: 'ローテーブル', w: 1, d: 1, h: 26, c: 3 },
  { id: 'demo-shelf', name: '本だな', w: 1, d: 2, h: 160, c: 2 },
  { id: 'demo-desk', name: 'つくえ', w: 2, d: 1, h: 72, c: 3 },
  { id: 'demo-rug', name: 'ラグ', w: 3, d: 3, h: 3, c: 4, flat: true },
  { id: 'demo-plant', name: '観葉植物', w: 1, d: 1, h: 96, c: 5, thin: true },
  { id: 'demo-lamp', name: 'スタンドライト', w: 1, d: 1, h: 120, c: 3, thin: true },
  { id: 'demo-tv', name: 'テレビ台', w: 1, d: 2, h: 40, c: 6 },
];
// ショップの品（仮）。絵ができたら絵を足す
export const SHOP = [
  { id: 'shop-frame', name: '写真立て', price: 150, w: 1, d: 1, h: 30 },
  { id: 'shop-plant', name: '大きな観葉植物', price: 200, w: 1, d: 1, h: 110, thin: true },
  { id: 'shop-poster', name: '旅のポスター', price: 250, w: 1, d: 1, h: 60 },
  { id: 'shop-lamp', name: 'ランプ', price: 300, w: 1, d: 1, h: 40 },
  { id: 'shop-rug', name: 'まるいラグ', price: 400, w: 2, d: 2, h: 3, flat: true },
  { id: 'shop-globe', name: '地球儀', price: 500, w: 1, d: 1, h: 56 },
  { id: 'shop-trunk', name: '旅のトランク', price: 800, w: 2, d: 1, h: 36 },
];
const DEMO_LAYOUT = [['demo-rug', 3, 3], ['demo-bed', 0, 1], ['demo-shelf', 0, 8], ['demo-desk', 3, 0], ['demo-lamp', 6, 0], ['demo-plant', 9, 0],
  ['demo-table', 4, 4], ['demo-sofa', 3, 6], ['demo-tv', 7, 3]];
const furn = id => DEMO.find(x => x.id === id) || SHOP.find(x => x.id === id) || { id, w: 1, d: 1, h: 30 };   // ご当地アイテムは1マスの小さな箱
const itemName = id => (DEMO.find(x => x.id === id) || SHOP.find(x => x.id === id))?.name || PLACES.find(p => p.item.id === id)?.item.name.replace(/（仮）$/, '') || id;
const itemFrom = id => { if (id.startsWith('demo-')) return '見本'; const p = PLACES.find(x => x.item.id === id); return p ? p.name : SHOP.some(x => x.id === id) ? 'ショップ' : ''; };
const owns = (b, id) => id.startsWith('demo-') || (b.items[id] || 0) > 0;

// 仮の家具の色（上・左・右の面）
const BOX = [['#C98A5A', '#9C6A44', '#B47A50'], ['#6FA8A0', '#4F837C', '#5E968E'], ['#B07AB8', '#875C8E', '#9A6AA3'], ['#C9B25A', '#9C8944', '#B39E50'],
  ['#C96A6A', '#A85252', '#B85D5D'], ['#7CB26A', '#5C8A4E', '#6C9E5C'], ['#7A8FC9', '#5C6FA0', '#6B7FB4']];
const colorOf = o => { const f = furn(o.id); return BOX[f.c ?? [...o.id].reduce((s, ch) => s + ch.charCodeAt(0), 0) % BOX.length]; };

// 部屋の記録（記録の中の room）：{ v:3, photos:[カードid×3], objects:[{ id, i, j }], me:{ i, j } }
function room(b) {
  if (!b.room || b.room.v !== 3) b.room = { v: 3, photos: (b.room?.photos || []).slice(0, 3), objects: DEMO_LAYOUT.map(([id, i, j]) => ({ id, i, j })), me: { i: 6, j: 6 } };
  const r = b.room;
  r.photos = PHOTO_SLOTS.map((_, k) => (r.photos[k] && b.cards.some(c => c.id === r.photos[k]) ? r.photos[k] : null));
  r.objects = r.objects.filter(o => owns(b, o.id) && fits(o, o.i, o.j, []));
  r.me ||= { i: 6, j: 6 };
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
      <div class="hm-ov bot"><span class="hm-kari">部屋と家具の絵はまだ（仮の箱）</span><p class="hm-tip"></p>
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
  const poly = (pts, fill, stroke) => { ctx.beginPath(); pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); } };
  const onWall = (W, u, v, w, h, draw) => { ctx.save(); ctx.transform(1, W.k, 0, 1, W.x0 + u, W.y0 + u * W.k - v - h); draw(w, h); ctx.restore(); };
  const night = () => (st.time === 'night' ? 1 : st.time === 'evening' ? .5 : 0);

  function drawRoom() {
    const L = P(0, N), R = P(N, 0), B = P(N, N), T = P(0, 0);
    poly([L, T, [T[0], T[1] - WALL], [L[0], L[1] - WALL]], '#3A3F78');   // 左のかべ（仮の面）
    poly([T, R, [R[0], R[1] - WALL], [T[0], T[1] - WALL]], '#454B8A');   // 右のかべ
    poly([L, T, [T[0], T[1] - 12], [L[0], L[1] - 12]], '#2C305E'); poly([T, R, [R[0], R[1] - 12], [T[0], T[1] - 12]], '#353A70');   // はばき
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) poly([P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)], (i + j) % 2 ? '#5A4E86' : '#615592', edit ? 'rgba(255,200,87,.3)' : null);
    poly([L, B, [B[0], B[1] + 14], [L[0], L[1] + 14]], '#2A2450'); poly([B, R, [R[0], R[1] + 14], [B[0], B[1] + 14]], '#221D42');   // 床の厚み
    // 窓（右のかべ）：名所の景色の上のほう
    const Wn = WINDOW;
    onWall(RIGHT, Wn.u - 8, Wn.v - 8, Wn.w + 16, Wn.h + 16, (w, h) => { ctx.fillStyle = '#C9B78F'; ctx.fillRect(0, 0, w, h); });
    onWall(RIGHT, Wn.u, Wn.v, Wn.w, Wn.h, (w, h) => {
      const src = engine.canvas, sw = src.width, sh = src.height * .45, sy = src.height * .04;
      const k = Math.max(w / sw, h / sh), dw = sw * k, dh = sh * k;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
      if (src.width) ctx.drawImage(src, 0, sy, sw, sh, (w - dw) / 2, 0, dw, dh);
      ctx.restore(); ctx.fillStyle = '#C9B78F'; ctx.fillRect(w / 2 - 3, 0, 6, h); ctx.fillRect(0, h / 2 - 3, w, 6);
    });
    // 写真（左のかべ）
    PHOTO_SLOTS.forEach((s, k) => onWall(LEFT, s.u, s.v, s.w, s.h, (w, h) => {
      const im = photos[k];
      if (im) { ctx.fillStyle = '#F4EBD8'; ctx.fillRect(0, 0, w, h); const iw = w - 10, ih = h - 22, sw = im.width, sh = sw * ih / iw; ctx.drawImage(im, 0, im.height * .55 - sh / 2, sw, sh, 5, 5, iw, ih); }
      else if (edit) { ctx.setLineDash([5, 4]); ctx.strokeStyle = '#8E88C8'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, w - 2, h - 2); ctx.setLineDash([]); ctx.fillStyle = '#8E88C8'; ctx.font = '400 26px DotGothic16'; ctx.textAlign = 'center'; ctx.fillText('＋', w / 2, h / 2 + 9); }
    }));
  }
  // 仮の家具：大きさだけの箱（細いものは、まん中に細い箱）
  function drawObj(o) {
    const f = furn(o.id), [top, left, right] = colorOf(o), pad = f.thin ? .3 : .06;
    const x0 = o.i + pad, y0 = o.j + pad, x1 = o.i + f.w - pad, y1 = o.j + f.d - pad, h = f.h;
    if (!f.flat) { ctx.fillStyle = 'rgba(0,0,0,.22)'; poly([P(x0 - .04, y0 - .04), P(x1 + .08, y0 - .04), P(x1 + .08, y1 + .08), P(x0 - .04, y1 + .08)], 'rgba(0,0,0,.22)'); }
    poly([P(x0, y1), P(x1, y1), P(x1, y1, h), P(x0, y1, h)], left);    // 手前・左の面
    poly([P(x1, y0), P(x1, y1), P(x1, y1, h), P(x1, y0, h)], right);   // 手前・右の面
    poly([P(x0, y0, h), P(x1, y0, h), P(x1, y1, h), P(x0, y1, h)], top, o === sel ? '#FFC857' : null);
    if (o === sel) { ctx.lineWidth = 3; poly([P(x0, y0, h), P(x1, y0, h), P(x1, y1, h), P(x0, y1, h)], null, '#FFC857'); ctx.lineWidth = 1; }
    if (edit) {   // 名前（模様がえ中だけ）
      const [cx, cy] = P((x0 + x1) / 2, (y0 + y1) / 2, h); ctx.font = '400 13px DotGothic16'; ctx.textAlign = 'center';
      const nm = itemName(o.id), tw = Math.min(ctx.measureText(nm).width, 120);
      ctx.fillStyle = 'rgba(10,12,30,.75)'; ctx.fillRect(cx - tw / 2 - 5, cy - 26, tw + 10, 18); ctx.fillStyle = '#FFF4E0'; ctx.fillText(nm, cx, cy - 12, 120);
    }
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
    // 敷きものを先に、そのあと奥のものから順に（家具とキャラ）
    const flats = r.objects.filter(o => furn(o.id).flat), rest = r.objects.filter(o => !furn(o.id).flat);
    flats.forEach(drawObj);
    rest.map(o => { const f = furn(o.id); return { z: o.i + f.w + o.j + f.d - 1, f: () => drawObj(o) }; }).concat([{ z: me.x + me.y, f: () => drawMe(t) }])
      .sort((a, z) => a.z - z.z).forEach(x => x.f());
    if (night()) { ctx.fillStyle = `rgba(10,8,40,${.14 * night()})`; ctx.fillRect(0, 0, RW, RH); }
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
