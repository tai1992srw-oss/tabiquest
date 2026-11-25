// ホーム（マイルーム）：アプリを開いて最初に出る画面
//   斜め上から見た小さな部屋に、分身キャラが立っている。床をタップするとそこまで歩く（Bondee・ピグのような部屋）
//   右のかべの窓：いまの時間帯・天気・季節のドット絵の名所が動いて見える（名所の絵をそのまま使う）
//   左のかべ：手に入れたカードを写真として貼る。床：手に入れたオブジェ（ご当地アイテム・ショップの品）を好きなマスに置く
//   ログインボーナス：その日はじめて開いたらポイント。ショップ：ポイントでオブジェを買う
//   部屋と家具の絵はまだない（絵はコードで描き足さない）。かべ・床は無地の仮の面、家具は名前を書いた仮の箱
//   絵ができたら、drawRoom の面と drawObj の箱を絵に差し替える
import { PLACES, placeById, LABEL, seasonOf } from './places.js';
import { book, mode, settings, saveBook } from './store.js';
import { engine, snapshot, reduceMotion } from './card.js';
import { current, distance } from './geo.js';
import { conditionsAt, renderTime, timeOfDay } from './conditions.js';
import { esc, img, cardEl, fmtDate, toast } from './ui.js';

const DOTS = PLACES.filter(p => p.kind === 'dot');
const dayNo = d => Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);

// ---- 部屋の形（論理の大きさ。画面では2倍の細かさで描く） ----
const RW = 540, RH = 560, K = 2, N = 6;           // 部屋の絵の幅・高さ、細かさ、床のマス数（N×N）
const TW = 80, TH = 40, OX = 270, OY = 250, WALL = 220;   // マスの幅・高さ、床のいちばん奥の角、かべの高さ
const iso = (i, j) => [OX + (i - j) * TW / 2, OY + (i + j) * TH / 2 + TH / 2];   // マス(i,j)のまん中
// かべの上の場所：左のかべは左の角から右上へ、右のかべは奥の角から右下へ
const LEFT = { x0: OX - N * TW / 2, y0: OY + N * TH / 2, k: -.5 }, RIGHT = { x0: OX, y0: OY, k: .5 };
const PHOTO_SLOTS = [{ u: 28, v: 105, w: 52, h: 68 }, { u: 96, v: 118, w: 52, h: 68 }, { u: 164, v: 105, w: 52, h: 68 }];   // 左のかべ
const WINDOW = { u: 56, v: 86, w: 128, h: 112 };   // 右のかべ

// ショップの品（仮）。絵ができたら絵を足す
export const SHOP = [
  { id: 'shop-frame', name: '写真立て', price: 150 },
  { id: 'shop-plant', name: '観葉植物', price: 200 },
  { id: 'shop-poster', name: '旅のポスター', price: 250 },
  { id: 'shop-lamp', name: 'ランプ', price: 300 },
  { id: 'shop-rug', name: 'まるいラグ', price: 400 },
  { id: 'shop-globe', name: '地球儀', price: 500 },
  { id: 'shop-trunk', name: '旅のトランク', price: 800 },
];
const itemName = id => SHOP.find(x => x.id === id)?.name || PLACES.find(p => p.item.id === id)?.item.name || id;
const itemFrom = id => { const p = PLACES.find(x => x.item.id === id); return p ? p.name : SHOP.some(x => x.id === id) ? 'ショップ' : ''; };

// 部屋の記録（記録の中の room）：{ v:2, photos:[カードid×3], objects:[{ id, i, j }], me:{ i, j } }
function room(b) {
  if (!b.room || b.room.v !== 2) b.room = { v: 2, photos: [], objects: [], me: { i: 3, j: 3 } };
  const r = b.room;
  r.photos = PHOTO_SLOTS.map((_, k) => (r.photos[k] && b.cards.some(c => c.id === r.photos[k]) ? r.photos[k] : null));
  r.objects = r.objects.filter(o => b.items[o.id] && o.i >= 0 && o.i < N && o.j >= 0 && o.j < N);
  r.me ||= { i: 3, j: 3 };
  return r;
}

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

// 分身キャラの立ち姿：カードの寄りと同じ絵（色番号の絵＋色の表）を、ふつうの色の絵にもどす
let charaImg = null;
function loadChara() {
  return charaImg || (charaImg = (async () => {
    const base = 'assets/kamakura/', D = await (await fetch(base + 'data.json')).json();
    const big = (D.charaLods || []).find(l => l.file === 'chara_close');   // 寄り用（240ドット）があればそれを使う
    const im = new Image(); im.src = base + (big ? big.file : 'chara') + '.png'; await im.decode();
    const [w, h] = big ? big.size : D.charaTex || D.chara, c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0, w, h, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h), pal = D.pal.chara;
    for (let k = 0; k < d.data.length; k += 4) { if (d.data[k + 3] < 128) { d.data[k + 3] = 0; continue; } const p = pal[d.data[k]] || [255, 0, 255]; d.data[k] = p[0]; d.data[k + 1] = p[1]; d.data[k + 2] = p[2]; d.data[k + 3] = 255; }
    x.putImageData(d, 0, 0); return c;
  })());
}

// 仮の家具の色（品ごとに決まった色。絵ができるまでの見分け用）
const BOX = [['#C98A5A', '#A86E44', '#E0A97C'], ['#6FA8A0', '#558A83', '#92C7BF'], ['#B07AB8', '#90609A', '#CFA0D6'], ['#C9B25A', '#A89344', '#E3CF84'], ['#7A8FC9', '#6073A8', '#A0B2E3'], ['#C96A6A', '#A85252', '#E39494']];
const boxOf = id => BOX[[...id].reduce((s, ch) => s + ch.charCodeAt(0), 0) % BOX.length];

// view：表示する場所、header：上のポイント表示を新しくする関数。返す関数で、絵の動きを止める
export function renderHome(view, { header } = {}) {
  const now = new Date(), b = book(), r = room(b), dbg = mode() === 'debug';
  const scene = homeScene(now);
  const timeReal = dbg && settings.time !== 'auto' ? settings.time : timeOfDay(now);
  let wx = dbg && settings.weather !== 'auto' ? settings.weather : null;   // わかるまでは天気を書かない
  let st = { time: renderTime(scene, timeReal), timeReal, weather: wx || 'clear',
    season: dbg && settings.season && settings.season !== 'auto' ? settings.season : seasonOf(now), at: now.toISOString() };
  const lg = loginState(b, now), streak = lg.got ? lg.L.streak : lg.next - 1, lit = streak > 0 ? (streak - 1) % 7 + 1 : 0;
  let edit = false;

  view.classList.add('homemode');
  view.innerHTML = `
    <div class="hm-top"><div class="hm-greet"><small>${now.getMonth() + 1}月${now.getDate()}日（${WEEK[now.getDay()]}）</small><b>${GREET[timeReal]}</b></div>
      <span class="chips"><span class="chip t">${LABEL.time[timeReal]}</span><span class="chip w"${wx ? '' : ' hidden'}>${wx ? LABEL.weather[wx] : ''}</span><span class="chip s">${LABEL.season[st.season]}</span></span></div>
    ${lg.got ? '' : `<div class="hm-login"><div class="t"><b>ログインボーナス</b><small>${lg.next}日め ・ +${bonusOf(lg.next)}pt</small>
      <span class="week" aria-hidden="true">${Array.from({ length: 7 }, (_, i) => `<i class="${i < lit ? 'on' : ''}${i === 6 ? ' big' : ''}"></i>`).join('')}</span></div>
      <button class="hm-btn go" data-a="login">受け取る</button></div>`}
    <div class="hm-room">
      <canvas class="hm-iso" width="${RW * K}" height="${RH * K}" role="img" aria-label="マイルーム。分身キャラが部屋に立っている"></canvas>
      <span class="hm-kari">部屋と家具の絵はまだ（仮）</span>
      <div class="hm-tools"><button class="hm-btn" data-a="edit" aria-pressed="false">模様がえ</button><a class="hm-btn" href="#/shop">ショップ</a></div>
      <p class="hm-tip"></p>
      <div class="hm-engine" aria-hidden="true"></div>
    </div>
    <div class="hm-menu">
      <a href="#/list"><b>名所</b><small>近くの名所へ到着</small></a>
      <a href="#/zukan"><b>図鑑</b><small>カード ${b.cards.length}まい</small></a>
      <a href="#/shop"><b>ショップ</b><small>いま ${b.points}pt</small></a>
    </div>
    ${lg.got ? `<p class="hm-streak">ログインボーナス：きょうは受け取りずみ ・ ${lg.L.streak}日つづけて来ています</p>` : ''}`;

  const cv = view.querySelector('.hm-iso'), ctx = cv.getContext('2d'), tip = view.querySelector('.hm-tip');
  const setTip = () => { tip.textContent = edit ? '床のマスを押すと家具を置けます。置いた家具を押すと外せます。左のかべの枠には写真を貼れます。' : '床を押すと、そこまで歩きます。キャラを押すとジャンプします。'; };
  setTip();

  // 窓の外：名所のカードを見えないところで動かし、その上のほう（空と街）を窓に写す
  const holder = view.querySelector('.hm-engine'), card = cardEl(scene, st, { stamp: false, welcome: false }); holder.append(card);
  engine.show(card, scene.scene, st);
  if (!wx) conditionsAt(scene, null).then(v => {   // 天気は名所の位置で調べる（現在地は送らない）
    if (!view.contains(holder)) return;
    wx = v.weather === 'unknown' ? null : v.weather; st = { ...st, time: v.time, timeReal: v.timeReal, weather: v.weather }; engine.setState(st);
    const w = view.querySelector('.hm-top .chip.w'); if (w && wx) { w.textContent = LABEL.weather[wx]; w.hidden = false; }
  });

  // 写真（左のかべ）
  const photos = r.photos.map(() => null);
  r.photos.forEach((id, k) => { const c = b.cards.find(x => x.id === id), p = c && placeById(c.placeId); if (p) snapshot(p.scene, c).then(u => { const im = new Image(); im.onload = () => { photos[k] = im; }; im.src = u; }); });

  // キャラ
  let chara = null; loadChara().then(c => { chara = c; }).catch(() => {});
  const me = { x: iso(r.me.i, r.me.j)[0], y: iso(r.me.i, r.me.j)[1], tx: null, ty: null, flip: false, jump: 0 };

  // ---- 描く ----
  const wallQuad = (W, u, v, w, h) => { const p = (uu, vv) => [W.x0 + uu, W.y0 + uu * W.k - vv]; return [p(u, v), p(u + w, v), p(u + w, v + h), p(u, v + h)]; };
  const poly = (pts, fill, stroke) => { ctx.beginPath(); pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); } };
  const onWall = (W, u, v, w, h, draw) => { ctx.save(); ctx.transform(1, W.k, 0, 1, W.x0 + u, W.y0 + u * W.k - v - h); draw(w, h); ctx.restore(); };
  const night = st.time === 'night' ? 1 : st.time === 'evening' ? .5 : 0;

  function drawRoom(t) {
    const L = [OX - N * TW / 2, OY + N * TH / 2], R = [OX + N * TW / 2, OY + N * TH / 2], B = [OX, OY + N * TH];
    // かべ（無地の仮の面）
    poly([L, [OX, OY], [OX, OY - WALL], [L[0], L[1] - WALL]], '#3A3F78');
    poly([[OX, OY], R, [R[0], R[1] - WALL], [OX, OY - WALL]], '#454B8A');
    poly([L, [OX, OY], [OX, OY - 10], [L[0], L[1] - 10]], '#2C305E'); poly([[OX, OY], R, [R[0], R[1] - 10], [OX, OY - 10]], '#353A70');   // はばき
    // 床（市松の仮の面）
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const [x, y] = iso(i, j);
      poly([[x, y - TH / 2], [x + TW / 2, y], [x, y + TH / 2], [x - TW / 2, y]], (i + j) % 2 ? '#5A4E86' : '#615592', edit ? 'rgba(255,200,87,.35)' : null);
    }
    poly([L, B, [B[0], B[1] + 12], [L[0], L[1] + 12]], '#2A2450'); poly([B, R, [R[0], R[1] + 12], [B[0], B[1] + 12]], '#221D42');   // 床の厚み
    // 窓（右のかべ）：名所の景色の上のほう
    const Wn = WINDOW;
    onWall(RIGHT, Wn.u - 6, Wn.v - 6, Wn.w + 12, Wn.h + 12, (w, h) => { ctx.fillStyle = '#C9B78F'; ctx.fillRect(0, 0, w, h); });
    onWall(RIGHT, Wn.u, Wn.v, Wn.w, Wn.h, (w, h) => {
      const src = engine.canvas, sw = src.width, sh = src.height * .5, sx = 0, sy = src.height * .04;
      const k = Math.max(w / sw, h / sh), dw = sw * k, dh = sh * k;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
      if (src.width) ctx.drawImage(src, sx, sy, sw, sh, (w - dw) / 2, 0, dw, dh);
      ctx.restore(); ctx.fillStyle = '#C9B78F'; ctx.fillRect(w / 2 - 2, 0, 4, h); ctx.fillRect(0, h / 2 - 2, w, 4);
    });
    // 写真（左のかべ）
    PHOTO_SLOTS.forEach((s, k) => onWall(LEFT, s.u, s.v, s.w, s.h, (w, h) => {
      const im = photos[k];
      if (im) { ctx.fillStyle = '#F4EBD8'; ctx.fillRect(0, 0, w, h); const iw = w - 8, ih = h - 16, sw = im.width, sh = sw * ih / iw; ctx.drawImage(im, 0, im.height * .55 - sh / 2, sw, sh, 4, 4, iw, ih); }
      else if (edit) { ctx.setLineDash([4, 3]); ctx.strokeStyle = '#8E88C8'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, w - 2, h - 2); ctx.setLineDash([]); ctx.fillStyle = '#8E88C8'; ctx.font = '400 22px DotGothic16'; ctx.textAlign = 'center'; ctx.fillText('＋', w / 2, h / 2 + 8); }
    }));
    // 夜は部屋を少し暗く、窓の明かりの代わりに天井の明かりをつけたように少しだけ（演出）
    if (night) { ctx.fillStyle = `rgba(10,8,40,${.12 * night})`; ctx.fillRect(0, 0, RW, RH); }
  }
  function drawObj(o) {
    const [x, y] = iso(o.i, o.j), [top, side, lt] = boxOf(o.id), h = 34, w = TW * .36, d = TH * .36;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x, y + 2, w + 4, d + 2, 0, 0, Math.PI * 2); ctx.fill();
    poly([[x - w, y], [x, y + d], [x, y + d - h], [x - w, y - h]], side);
    poly([[x, y + d], [x + w, y], [x + w, y - h], [x, y + d - h]], lt);
    poly([[x - w, y - h], [x, y - d - h], [x + w, y - h], [x, y + d - h]], top);
    ctx.font = '400 11px DotGothic16'; ctx.textAlign = 'center'; const nm = itemName(o.id).replace(/（仮）$/, ''), tw = Math.min(ctx.measureText(nm).width, 96);
    ctx.fillStyle = 'rgba(10,12,30,.72)'; ctx.fillRect(x - tw / 2 - 4, y - h - d - 22, tw + 8, 15); ctx.fillStyle = '#FFF4E0'; ctx.fillText(nm, x, y - h - d - 11, 96);
  }
  function drawMe(t) {
    if (!chara) return;
    const walking = me.tx != null, bob = walking ? Math.abs(Math.sin(t / 90)) * 4 : (reduceMotion() ? 0 : Math.sin(t / 600) * 1.2), jy = me.jump > 0 ? Math.sin(me.jump * Math.PI) * 40 : 0;
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(me.x, me.y + 2, 22 - jy * .2, 7 - jy * .06, 0, 0, Math.PI * 2); ctx.fill();
    const w = chara.width, h = chara.height, top = Math.round(me.y - h - bob - jy);
    ctx.save(); if (me.flip) { ctx.translate(Math.round(me.x) * 2, 0); ctx.scale(-1, 1); }
    ctx.drawImage(chara, Math.round(me.x - w / 2), top); ctx.restore();
  }

  let raf = 0, last = performance.now();
  function frame(t) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(50, t - last); last = t;
    if (me.tx != null) {   // 歩く
      const dx = me.tx - me.x, dy = me.ty - me.y, dist = Math.hypot(dx, dy), sp = .12 * dt;
      if (dist <= sp) { me.x = me.tx; me.y = me.ty; me.tx = me.ty = null; } else { me.x += dx / dist * sp; me.y += dy / dist * sp; if (Math.abs(dx) > 1) me.flip = dx < 0; }
    }
    if (me.jump > 0) me.jump = Math.max(0, me.jump - dt / 520);
    ctx.setTransform(K, 0, 0, K, 0, 0); ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, RW, RH); ctx.lineWidth = 1;
    drawRoom(t);
    // 奥のものから順に（家具とキャラ）
    const things = r.objects.map(o => ({ z: iso(o.i, o.j)[1], f: () => drawObj(o) })).concat([{ z: me.y + .5, f: () => drawMe(t) }]);
    things.sort((a, z) => a.z - z.z).forEach(x => x.f());
  }
  raf = requestAnimationFrame(frame);

  // ---- さわる ----
  const at = e => { const rc = cv.getBoundingClientRect(); return [(e.clientX - rc.left) / rc.width * RW, (e.clientY - rc.top) / rc.height * RH]; };
  const tileAt = (x, y) => { const dx = (x - OX) / (TW / 2), dy = (y - OY) / (TH / 2), i = Math.floor((dy + dx) / 2), j = Math.floor((dy - dx) / 2); return i >= 0 && j >= 0 && i < N && j < N ? [i, j] : null; };
  const inWall = (W, s, x, y) => { const u = x - W.x0, v = W.y0 + u * W.k - y; return u >= s.u && u <= s.u + s.w && v >= s.v && v <= s.v + s.h; };
  const done = () => { saveBook(); };
  cv.addEventListener('click', e => {
    const [x, y] = at(e);
    if (chara && !edit && Math.abs(x - me.x) < 32 && y < me.y + 6 && y > me.y - chara.height) { if (!me.jump) me.jump = 1; return; }
    if (edit) {
      const ps = PHOTO_SLOTS.findIndex(s => inWall(LEFT, s, x, y)); if (ps >= 0) { pickPhoto(b, r, ps, () => { done(); rerenderPhotos(); }); return; }
      // 家具の箱を押した（箱は上にのびているので、マスの少し上も見る）
      const hit = [...r.objects].sort((a, z) => iso(z.i, z.j)[1] - iso(a.i, a.j)[1]).find(o => { const [ox, oy] = iso(o.i, o.j); return Math.abs(x - ox) < TW * .4 && y < oy + TH * .4 && y > oy - 60; });
      if (hit) { r.objects = r.objects.filter(o => o !== hit); done(); toast(`「${itemName(hit.id)}」を外しました`); return; }
      const tl = tileAt(x, y); if (!tl) return;
      pickObject(b, r, tl, () => done());
      return;
    }
    const tl = tileAt(x, y); if (!tl || r.objects.some(o => o.i === tl[0] && o.j === tl[1])) return;   // 家具のあるマスには行かない
    const [tx, ty] = iso(...tl); me.tx = tx; me.ty = ty; r.me = { i: tl[0], j: tl[1] }; done();
  });
  function rerenderPhotos() { r.photos.forEach((id, k) => { photos[k] = null; const c = b.cards.find(x => x.id === id), p = c && placeById(c.placeId); if (p) snapshot(p.scene, c).then(u => { const im = new Image(); im.onload = () => { photos[k] = im; }; im.src = u; }); }); }

  const rerender = () => renderHome(view, { header });
  view.onclick = e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.a === 'login') { const pts = claimLogin(b, new Date()); if (pts) { toast(`ログインボーナス +${pts}pt`); header?.(); } cleanup(); rerender(); }
    else if (t.dataset.a === 'edit') { edit = !edit; t.setAttribute('aria-pressed', String(edit)); t.textContent = edit ? 'できた' : '模様がえ'; setTip(); }
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

// 床のマスに置くオブジェを選ぶ。1つの品は部屋に1つまで（持っている数まで置けるようにするのは、絵ができてから）
function pickObject(b, r, [i, j], done) {
  const ids = Object.keys(b.items).filter(id => b.items[id] > 0);
  const box = document.createElement('div'); box.className = 'grid3';
  if (!ids.length) box.innerHTML = '<p class="note">まだ家具がありません。はじめての名所に到着するとご当地アイテムが、ショップではポイントで品物が手に入ります。</p>';
  let close;
  for (const id of ids) {
    const used = r.objects.some(o => o.id === id);
    const a = document.createElement('button'); a.className = 'opt obj' + (used ? ' used' : '');
    a.innerHTML = `<b>${esc(itemName(id))}</b><small>${esc(itemFrom(id))}${used ? '<br>置いてあるものを動かす' : ''}</small><span class="kari-s">絵はまだ</span>`;
    a.onclick = () => { r.objects = r.objects.filter(o => o.id !== id && !(o.i === i && o.j === j)); r.objects.push({ id, i, j }); close(); done(); };
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
      return `<li><div class="t"><b>${esc(g.name)}</b><small>${g.price}pt</small></div><span class="kari-s static">絵はまだ</span>
        ${have ? '<span class="own">持っています</span>' : `<button class="hm-btn go" data-buy="${g.id}" ${b.points < g.price ? 'disabled' : ''}>買う</button>`}</li>`; }).join('')}</ul>`;
  view.querySelector('.hm-goods').onclick = e => {
    const t = e.target.closest('[data-buy]'); if (!t) return; const g = SHOP.find(x => x.id === t.dataset.buy);
    if (!g || b.points < g.price || b.items[g.id]) return;
    if (!confirm(`「${g.name}」を ${g.price}pt で買いますか？`)) return;
    b.points -= g.price; b.items[g.id] = 1; saveBook(); header?.(); toast(`「${g.name}」を買いました。ホームの模様がえで置けます`); renderShop(view, { header });
  };
}
