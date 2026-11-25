// ホーム（マイルーム）：アプリを開いて最初に出る画面
//   部屋の構成（仮の配置）：かべに窓・写真、かべの下にたな、手前に床
//     窓：いまの時間帯・天気・季節のドット絵の名所に、キャラが立って動く（名所の絵をそのまま使う）
//     写真：手に入れたカードを貼る。たな・床：手に入れたオブジェ（ご当地アイテム・ショップの品）を飾る
//   ログインボーナス：その日はじめて開いたらポイント。ショップ：ポイントでオブジェを買う
//   部屋とオブジェの絵はまだない（絵はコードで描き足さない）。かべ・床は無地の仮の面、オブジェは名前と「絵はまだ」
//   絵ができたら、.hm-room の背景と、.hm-obj の中身を絵に差し替える
import { PLACES, placeById, LABEL, seasonOf } from './places.js';
import { book, mode, settings, saveBook } from './store.js';
import { engine, snapshot } from './card.js';
import { current, distance } from './geo.js';
import { conditionsAt, renderTime, timeOfDay } from './conditions.js';
import { esc, img, cardEl, fmtDate, toast } from './ui.js';

const DOTS = PLACES.filter(p => p.kind === 'dot');
const dayNo = d => Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
const N_PHOTO = 4;
// オブジェを置ける場所：たなの上に3つ、床に3つ
const SPOTS = ['shelf', 'shelf', 'shelf', 'floor', 'floor', 'floor'];

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

// 部屋の飾りの記録（記録の中の room）。消えたカード・アイテムは外す
function room(b) {
  b.room ||= {}; const r = b.room;
  r.photos = Array.from({ length: N_PHOTO }, (_, i) => (r.photos || [])[i] ?? null).map(id => (id && b.cards.some(c => c.id === id) ? id : null));
  r.objects = SPOTS.map((_, i) => (r.objects || [])[i] ?? null).map(id => (id && b.items[id] ? id : null));
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

const objHtml = id => `<b>${esc(itemName(id))}</b><small>${esc(itemFrom(id))}</small><span class="kari-s">絵はまだ</span>`;

// view：表示する場所、header：上のポイント表示を新しくする関数。返す関数で、絵の動きを止める
export function renderHome(view, { header } = {}) {
  const now = new Date(), b = book(), r = room(b), dbg = mode() === 'debug';
  const scene = homeScene(now);
  const timeReal = dbg && settings.time !== 'auto' ? settings.time : timeOfDay(now);
  let wx = dbg && settings.weather !== 'auto' ? settings.weather : null;   // わかるまでは天気を書かない
  let st = { time: renderTime(scene, timeReal), timeReal, weather: wx || 'clear',
    season: dbg && settings.season && settings.season !== 'auto' ? settings.season : seasonOf(now), at: now.toISOString() };
  const lg = loginState(b, now), streak = lg.got ? lg.L.streak : lg.next - 1, lit = streak > 0 ? (streak - 1) % 7 + 1 : 0;
  const slot = i => { const id = r.objects[i]; return `<button class="hm-obj ${SPOTS[i]}${id ? '' : ' empty'}" data-obj="${i}" aria-label="${id ? esc(itemName(id)) + 'を変える' : 'オブジェを飾る'}">${id ? objHtml(id) : '<span class="plus">＋</span>'}</button>`; };

  view.classList.add('homemode');
  view.innerHTML = `
    <div class="hm-top"><div class="hm-greet"><small>${now.getMonth() + 1}月${now.getDate()}日（${WEEK[now.getDay()]}）</small><b>${GREET[timeReal]}</b></div>
      <span class="chips"><span class="chip t">${LABEL.time[timeReal]}</span><span class="chip w"${wx ? '' : ' hidden'}>${wx ? LABEL.weather[wx] : ''}</span><span class="chip s">${LABEL.season[st.season]}</span></span></div>
    ${lg.got ? '' : `<div class="hm-login"><div class="t"><b>ログインボーナス</b><small>${lg.next}日め ・ +${bonusOf(lg.next)}pt</small>
      <span class="week" aria-hidden="true">${Array.from({ length: 7 }, (_, i) => `<i class="${i < lit ? 'on' : ''}${i === 6 ? ' big' : ''}"></i>`).join('')}</span></div>
      <button class="hm-btn go" data-a="login">受け取る</button></div>`}
    <div class="hm-room" aria-label="マイルーム">
      <span class="hm-kari">部屋の絵はまだ（仮の配置）</span>
      <div class="hm-wall">
        <div class="hm-photos l">${[0, 1].map(i => `<button class="hm-photo${r.photos[i] ? '' : ' empty'}" data-photo="${i}" aria-label="${r.photos[i] ? '写真を変える' : '写真を貼る'}">${r.photos[i] ? '' : '<span class="plus">＋</span>'}</button>`).join('')}</div>
        <div class="hm-window"><div class="hm-card"></div><span class="hm-where">${esc(scene.name)}</span></div>
        <div class="hm-photos r">${[2, 3].map(i => `<button class="hm-photo${r.photos[i] ? '' : ' empty'}" data-photo="${i}" aria-label="${r.photos[i] ? '写真を変える' : '写真を貼る'}">${r.photos[i] ? '' : '<span class="plus">＋</span>'}</button>`).join('')}</div>
      </div>
      <div class="hm-shelf">${[0, 1, 2].map(slot).join('')}<i class="board"></i></div>
      <div class="hm-floor">${[3, 4, 5].map(slot).join('')}</div>
    </div>
    <p class="hm-hint">＋を押すと、写真やオブジェを飾れます。もう一度押すと変えたり外したりできます。</p>
    <div class="hm-menu">
      <a href="#/shop"><b>ショップ</b><small>いま ${b.points}pt</small></a>
      <a href="#/list"><b>名所</b><small>近くの名所へ到着</small></a>
      <a href="#/zukan"><b>図鑑</b><small>カード ${b.cards.length}まい</small></a>
    </div>
    ${lg.got ? `<p class="hm-streak">ログインボーナス：きょうは受け取りずみ ・ ${lg.L.streak}日つづけて来ています</p>` : ''}`;

  // 窓：動くカード（文字は重ねない）
  const holder = view.querySelector('.hm-card'), card = cardEl(scene, st, { stamp: false, welcome: false }); card.classList.add('clean'); holder.append(card);
  engine.show(card, scene.scene, st).then(() => { engine.canvas.setAttribute('role', 'img'); engine.canvas.setAttribute('aria-label', `窓の外の${scene.name}の景色に、分身キャラが立っている`); });
  // 天気は名所の位置で調べる（現在地は送らない）
  if (!wx) conditionsAt(scene, null).then(v => {
    if (!view.contains(holder)) return;
    wx = v.weather === 'unknown' ? null : v.weather; st = { ...st, time: v.time, timeReal: v.timeReal, weather: v.weather }; engine.setState(st);
    const w = view.querySelector('.hm-top .chip.w'); if (w && wx) { w.textContent = LABEL.weather[wx]; w.hidden = false; }
  });
  // かべの写真
  view.querySelectorAll('.hm-photo').forEach(el => {
    const c = b.cards.find(x => x.id === r.photos[+el.dataset.photo]), p = c && placeById(c.placeId);
    if (p) snapshot(p.scene, c).then(u => el.prepend(img(u, `${p.name}の写真`)));
  });

  const rerender = () => renderHome(view, { header });
  view.onclick = e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.a === 'login') { const pts = claimLogin(b, new Date()); if (pts) { toast(`ログインボーナス +${pts}pt`); header?.(); } rerender(); }
    else if (t.dataset.photo) pickPhoto(b, r, +t.dataset.photo, rerender);
    else if (t.dataset.obj) pickObject(b, r, +t.dataset.obj, rerender);
  };
  return () => { engine.stop(); view.classList.remove('homemode'); view.onclick = null; document.querySelector('.hm-pick')?.remove(); };
}

// 下から出る、選ぶシート
function sheet(title, body, { canRemove, onRemove }) {
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
    a.onclick = () => { const j = r.photos.indexOf(c.id); if (j >= 0) r.photos[j] = r.photos[i]; r.photos[i] = c.id; saveBook(); close(); done(); };
    box.append(a);
  }
  close = sheet('かべに貼るカード', box, { canRemove: !!r.photos[i], onRemove: () => { r.photos[i] = null; saveBook(); done(); } });
}

function pickObject(b, r, i, done) {
  const ids = Object.keys(b.items).filter(id => b.items[id] > 0);
  const box = document.createElement('div'); box.className = 'grid3';
  if (!ids.length) box.innerHTML = '<p class="note">まだオブジェがありません。はじめての名所に到着するとご当地アイテムが、ショップではポイントで品物が手に入ります。</p>';
  let close;
  for (const id of ids) {
    const a = document.createElement('button'); a.className = 'opt obj' + (r.objects.includes(id) ? ' used' : ''); a.innerHTML = objHtml(id);
    a.onclick = () => { const j = r.objects.indexOf(id); if (j >= 0) r.objects[j] = r.objects[i]; r.objects[i] = id; saveBook(); close(); done(); };
    box.append(a);
  }
  close = sheet(SPOTS[i] === 'shelf' ? 'たなに飾るオブジェ' : '床に置くオブジェ', box, { canRemove: !!r.objects[i], onRemove: () => { r.objects[i] = null; saveBook(); done(); } });
}

// ---- ショップ ----
export function renderShop(view, { header } = {}) {
  const b = book();
  view.innerHTML = `<div class="phead"><a class="backbtn" href="#/home" aria-label="ホームにもどる">‹</a><h1>ショップ</h1><span class="prog">いま ${b.points}pt</span></div>
    <p class="nowline">ポイントでオブジェを買って、マイルームに飾れます。品物の絵はまだです。</p>
    <ul class="hm-goods">${SHOP.map(g => { const have = (b.items[g.id] || 0) > 0;
      return `<li><div class="t"><b>${esc(g.name)}</b><small>${g.price}pt</small></div><span class="kari-s static">絵はまだ</span>
        ${have ? '<span class="own">持っています</span>' : `<button class="hm-btn go" data-buy="${g.id}" ${b.points < g.price ? 'disabled' : ''}>買う</button>`}</li>`; }).join('')}</ul>`;
  view.querySelector('.hm-goods').onclick = e => {
    const t = e.target.closest('[data-buy]'); if (!t) return; const g = SHOP.find(x => x.id === t.dataset.buy);
    if (!g || b.points < g.price || b.items[g.id]) return;
    if (!confirm(`「${g.name}」を ${g.price}pt で買いますか？`)) return;
    b.points -= g.price; b.items[g.id] = 1; saveBook(); header?.(); toast(`「${g.name}」を買いました。ホームに飾れます`); renderShop(view, { header });
  };
}
