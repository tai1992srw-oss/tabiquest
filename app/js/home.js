// ホーム（マイルーム）：アプリを開いて最初に出る画面（Bondee・ピグのような部屋）
//   画面いっぱいに、斜め上から見た部屋（10×10マス）。横にスクロールして部屋を見わたす
//   分身キャラが部屋に立っていて、床を押すとそこまで歩く。キャラを押すとジャンプ
//   右のかべの窓：いまの時間帯・天気・季節のドット絵の名所が動いて見える（名所の絵をそのまま使う）
//   左のかべ：手に入れたカードを写真として貼る。床：家具（見本・ご当地アイテム・ショップの品）を置く
//   ボタンや文字は、ストーリーズのように部屋の上に重ねる
//   部屋と家具は room_voxel.js でボクセルの立体としてコードで作る（女の子らしい部屋。2026-11-25、マイルームはコードで描いてよい・全部ボクセルでいくと決まった）
import { PLACES, placeById, LABEL, seasonOf } from './places.js';
import { book, mode, settings, saveBook } from './store.js';
import { engine, snapshot, reduceMotion } from './card.js';
import { recolorChara } from './characolor.js';
import { current, distance } from './geo.js';
import { conditionsAt, renderTime, timeOfDay } from './conditions.js';
import { esc, img, cardEl, fmtDate, toast } from './ui.js';
import { mountVoxelRoom, V as VOX, WH as VWH, FX } from './room_voxel.js';

const DOTS = PLACES.filter(p => p.kind === 'dot');
const dayNo = d => Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);

const N = 10;   // 部屋は 10×10 マス
// 左のかべの写真の枠（3つ）。z は部屋の奥からの位置、y は床からの高さ（ボクセルの単位）
const PHOTO_SLOTS = [[210, 150], [300, 166], [390, 150]].map(([u, v]) => { const k = N * VOX / 560, vy = VWH / 300; return { z: N * VOX - u * k, w: 70 * k, y: v * vy, h: 90 * vy }; });

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
// 置いた向き（o.r：0〜3、90度ずつ）。横むき（1・3）のときは、使うマスのたて・よこが入れかわる
const dims = o => { const f = furn(o.id); return (o.r || 0) % 2 ? { ...f, w: f.d, d: f.w } : f; };
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
  const f = dims(o); if (i < 0 || j < 0 || i + f.w > N || j + f.d > N) return false;
  return !others.some(x => { const g = dims(x); if (x === o || !!g.flat !== !!f.flat) return false; return i < x.i + g.w && x.i < i + f.w && j < x.j + g.d && x.j < j + f.d; });
}
const blocked = (r, i, j) => r.objects.some(o => { const f = dims(o); return !f.flat && i >= o.i && i < o.i + f.w && j >= o.j && j < o.j + f.d; });

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
    const d = x.getImageData(0, 0, w, h), pal = D.pal.chara.map((c, i) => recolorChara(c, i, D));   // 設定の「キャラの色」を反映
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
  // かわいく見せる工夫のオン・オフ（この端末に覚えておく）と、でんき（夕方と夜は、はじめからつける）
  const vfx = (() => { try { return Object.assign(Object.fromEntries(FX.map(([k]) => [k, true])), JSON.parse(localStorage.getItem('tabiquest:voxfx') || '{}')); } catch (e) { return Object.fromEntries(FX.map(([k]) => [k, true])); } })();
  let vlight = timeReal === 'night' || timeReal === 'evening';
  // 部屋の倍率（この端末に覚えておく）。ボタンで 1 → 1.4 → 1.8 → 1 と切りかえる
  const ZOOMS = [1, 1.4, 1.8];
  let zoom = (() => { try { const z = +localStorage.getItem('tabiquest:roomzoom'); return ZOOMS.includes(z) ? z : 1.4; } catch (e) { return 1.4; } })();

  view.classList.add('homemode');
  view.innerHTML = `
    <div class="hm-stage vox${st.time === 'night' ? ' night' : ''}">
      <div class="hm-scroll" role="img" aria-label="マイルーム。分身キャラが部屋に立っている"></div>
      <div class="hm-ov top">
        <div class="hm-greet"><small>${now.getMonth() + 1}月${now.getDate()}日（${WEEK[now.getDay()]}）</small><b>${GREET[timeReal]}</b>
          <span class="chips"><span class="chip t">${LABEL.time[timeReal]}</span><span class="chip w"${wx ? '' : ' hidden'}>${wx ? LABEL.weather[wx] : ''}</span><span class="chip s">${LABEL.season[st.season]}</span></span></div>
        ${lg.got ? '' : `<button class="hm-bonus" data-a="login"><b>ログインボーナス</b><small>${lg.next}日め ・ +${bonusOf(lg.next)}pt を受け取る</small></button>`}
      </div>
      <div class="hm-ov side">
        <button data-a="edit" aria-pressed="false"><i aria-hidden="true">✎</i><span>模様がえ</span></button>
        <button data-a="zoom"><i aria-hidden="true">⊕</i><span>ズーム</span></button>
        <button data-a="light" aria-pressed="${vlight}"><i aria-hidden="true">💡</i><span>でんき</span></button>
        <button data-a="fx"><i aria-hidden="true">✿</i><span>工夫</span></button>
        <a href="#/shop"><i aria-hidden="true">¥</i><span>ショップ</span></a>
        <a href="#/zukan"><i aria-hidden="true">▦</i><span>図鑑</span></a>
        <a href="#/list"><i aria-hidden="true">◆</i><span>名所</span></a>
      </div>
      <div class="hm-ov bot"><p class="hm-tip"></p>
        <div class="hm-selbar" hidden><button data-a="rotate">回す</button><button data-a="remove">外す</button><button data-a="cancel">やめる</button></div></div>
      <div class="hm-engine" aria-hidden="true"></div>
    </div>`;

  const scroller = view.querySelector('.hm-scroll');
  const tip = view.querySelector('.hm-tip'), selbar = view.querySelector('.hm-selbar');
  const setTip = () => {
    tip.textContent = !edit ? '床を押すと歩きます。ライトを押すとでんき、キャラやくまを押すとハート。横にスクロールすると部屋を見わたせます。'
      : sel ? `「${itemName(sel.id)}」を置きたいマスを押してください。` : 'マスを押すと家具を置けます。家具を押すと動かしたり回したり外したりできます。左のかべの枠には写真を貼れます。';
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
  let vox = null;
  const photos = PHOTO_SLOTS.map(() => null);
  const loadPhotos = () => r.photos.forEach((id, k) => { photos[k] = null; const c = b.cards.find(x => x.id === id), p = c && placeById(c.placeId); if (p) snapshot(p.scene, c).then(u => { const im = new Image(); im.onload = () => { photos[k] = im; vox?.setPhotos(photos); }; im.src = u; }); });

  // 部屋（Three.js のボクセル）。模様がえ：家具を押して選ぶ → マスを押して動かす。空いたマスで家具を置く。左のかべの枠で写真
  vox = mountVoxelRoom({ stage: scroller, objects: () => r.objects, furn, dims, me: r.me, blocked: (i, j) => blocked(r, i, j), onMove: (i, j) => { r.me = { i, j }; saveBook(); },
    chara: loadChara(), engineCanvas: engine.canvas, night: () => (st.time === 'night' ? 1 : st.time === 'evening' ? .55 : 0),
    onTapFurniture: o => { sel = sel === o ? null : o; vox.setSelected(sel); setTip(); },
    onTapTile: (i, j) => {
      if (sel) { if (fits(sel, i, j, r.objects)) { sel.i = i; sel.j = j; saveBook(); sel = null; vox.sync(); vox.setSelected(null); setTip(); } else toast('そこには置けません'); return; }
      pickObject(b, r, [i, j], () => { saveBook(); vox.sync(); });
    },
    onTapPhoto: k => pickPhoto(b, r, k, () => { saveBook(); loadPhotos(); vox.setPhotos(photos); }),
    fx: vfx, light: vlight, onLight: v => { vlight = v; view.querySelector('[data-a=light]')?.setAttribute('aria-pressed', String(v)); },
    photoSlots: PHOTO_SLOTS, zoom });
  loadPhotos(); vox.setPhotos(photos);
  // はじめはキャラが画面のまん中に来るようにスクロール
  requestAnimationFrame(() => { scroller.scrollLeft = vox.screenX() * vox.canvas.clientWidth - scroller.clientWidth / 2; scroller.scrollTop = vox.screenY() * vox.canvas.clientHeight - scroller.clientHeight * .6; });

  view.onclick = e => {
    const t = e.target.closest('button'); if (!t) return;
    const a = t.dataset.a;
    if (a === 'login') { const pts = claimLogin(b, new Date()); if (pts) { toast(`ログインボーナス +${pts}pt`); header?.(); } t.remove(); }
    else if (a === 'edit') { edit = !edit; sel = null; t.setAttribute('aria-pressed', String(edit)); t.querySelector('span').textContent = edit ? 'できた' : '模様がえ'; vox.setEdit(edit); setTip(); }
    else if (a === 'remove' && sel) { r.objects = r.objects.filter(o => o !== sel); toast(`「${itemName(sel.id)}」を外しました`); sel = null; saveBook(); vox.sync(); vox.setSelected(null); setTip(); }
    else if (a === 'rotate' && sel) {   // 90度ずつ回す。回したら入らないときは、もとにもどす
      const old = sel.r || 0; sel.r = (old + 1) % 4;
      if (!fits(sel, sel.i, sel.j, r.objects)) { sel.r = old; toast('ここでは回せません（まわりに場所がありません）'); }
      else { saveBook(); vox.sync(); vox.setSelected(sel); }
    }
    else if (a === 'cancel') { sel = null; vox.setSelected(null); setTip(); }
    else if (a === 'zoom') { zoom = ZOOMS[(ZOOMS.indexOf(zoom) + 1) % ZOOMS.length]; try { localStorage.setItem('tabiquest:roomzoom', String(zoom)); } catch (err) {} vox.setZoom(zoom); toast(`ズーム ${zoom}倍`); }
    else if (a === 'light') { vlight = !vlight; vox.setLight(vlight); t.setAttribute('aria-pressed', String(vlight)); }
    else if (a === 'fx') {   // かわいく見せる工夫を、1つずつオン・オフして見比べる
      const box = document.createElement('div'); box.className = 'hm-fx';
      const draw = () => { box.innerHTML = FX.map(([k, l]) => `<button data-k="${k}" aria-pressed="${!!vfx[k]}">${l}</button>`).join('') + '<p class="note">押すと、その工夫を外した見え方になります。ライトやくま、キャラを押してみてください。</p>'; };
      draw(); box.onclick = e => { const b = e.target.closest('[data-k]'); if (!b) return; vfx[b.dataset.k] = !vfx[b.dataset.k]; try { localStorage.setItem('tabiquest:voxfx', JSON.stringify(vfx)); } catch (err) {} vox.setFx(vfx); draw(); };
      sheet('かわいく見せる工夫', box);
    }
  };
  const cleanup = () => { vox.stop(); engine.stop(); view.classList.remove('homemode'); view.onclick = null; document.querySelector('.hm-pick')?.remove(); };
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
    a.innerHTML = `<b>${esc(itemName(id))}</b><small>${esc(itemFrom(id))} ・ ${f.w}×${f.d}マス${used ? '<br>置いてあるものを動かす' : ''}</small>`;
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
    <p class="nowline">ポイントで家具を買って、マイルームに置けます。</p>
    <ul class="hm-goods">${SHOP.map(g => { const have = (b.items[g.id] || 0) > 0;
      return `<li><div class="t"><b>${esc(g.name)}</b><small>${g.price}pt ・ ${g.w}×${g.d}マス</small></div>
        ${have ? '<span class="own">持っています</span>' : `<button class="hm-btn go" data-buy="${g.id}" ${b.points < g.price ? 'disabled' : ''}>買う</button>`}</li>`; }).join('')}</ul>`;
  view.querySelector('.hm-goods').onclick = e => {
    const t = e.target.closest('[data-buy]'); if (!t) return; const g = SHOP.find(x => x.id === t.dataset.buy);
    if (!g || b.points < g.price || b.items[g.id]) return;
    if (!confirm(`「${g.name}」を ${g.price}pt で買いますか？`)) return;
    b.points -= g.price; b.items[g.id] = 1; saveBook(); header?.(); toast(`「${g.name}」を買いました。ホームの模様がえで置けます`); renderShop(view, { header });
  };
}
