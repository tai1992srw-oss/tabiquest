// 画面の切り替えと、一覧・設定の画面
import { PLACES, placeById, CATEGORIES, PLAIN_BG } from './places.js';
import { settings, saveSettings, book, mode, arrive, cardsOf, visited, exportBook, importBook, persist } from './store.js';
import { engine, snapshot } from './card.js';
import { locate, here, statusOf, fmtDist, current } from './geo.js';
import { conditionsAt, renderTime, timeOfDay } from './conditions.js';
import { esc, img, toast, fmtDate, prefCity } from './ui.js';
import { playArrival } from './arrival.js';
import { renderZukan, renderPlace, openViewer } from './zukan.js';
import { renderDebug } from './debug.js';
import { renderMap } from './map.js';
import { renderGoals, checkGoals } from './goals.js';
import { renderTimeline } from './calendar.js';
import { renderHome, renderShop } from './home.js';
import * as minatomirai from './scenes/minatomirai.js';
import * as chukagai from './scenes/chukagai.js';
import * as kamakura from './scenes/kamakura.js';
import * as photo from './scenes/photo.js';

export const VERSION = '0.8.2';
engine.register('minatomirai', minatomirai.build);
engine.register('chukagai', chukagai.build);
engine.register('kamakura', kamakura.build);
for (const p of PLACES) if (p.kind === 'photo') engine.register(p.scene, () => photo.build(p));
// 絵のない名所は、写真の名所のしくみに空の絵を渡して使う
for (const p of PLACES) if (p.kind === 'plain') engine.register(p.scene, () => photo.build({ ...p, photo: { src: PLAIN_BG } }));

const view = document.getElementById('view');
let closeViewer = null;
const ui = (() => { try { return Object.assign({ cat: 'all', seen: 'all' }, JSON.parse(localStorage.getItem('tabiquest:ui') || '{}')); } catch (e) { return { cat: 'all', seen: 'all' }; } })();
const saveUi = () => { try { localStorage.setItem('tabiquest:ui', JSON.stringify(ui)); } catch (e) {} };

function header() {
  document.getElementById('pts').textContent = `${book().points}pt`;
  document.getElementById('debugBadge').hidden = mode() !== 'debug';
}

function route() {
  closeViewer?.(); closeViewer = null;
  const [name, ...args] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  if (name === 'home' || name === 'shop') {   // ホーム（マイルーム）とショップ
    document.querySelectorAll('nav.tabs a').forEach(a => { if (a.dataset.tab === 'home') a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    header(); view.classList.remove('mapmode');
    if (name === 'home') closeViewer = renderHome(view, { header }); else renderShop(view, { header });
    window.scrollTo(0, 0); return;
  }
  const tab = ['zukan', 'place', 'card', 'preview', 'goals', 'calendar', 'timeline'].includes(name) ? 'zukan' : ['settings', 'map'].includes(name) ? name : 'list';
  document.querySelectorAll('nav.tabs a').forEach(a => { if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  header();
  view.classList.toggle('mapmode', tab === 'map');
  if (tab === 'map') renderMap(view);
  else if (tab === 'list') renderList();
  else if (tab === 'settings') renderSettings();
  else if (name === 'goals') renderGoals(view);
  else if (name === 'calendar' || name === 'timeline') renderTimeline(view);   // calendar は前の版のリンク用
  else if (name === 'place') renderPlace(view, args[0]);
  else if (name === 'card') {
    const c = book().cards.find(x => x.id === args[0]);
    if (c) renderPlace(view, c.placeId); else renderZukan(view);
    let posing = false; try { posing = sessionStorage.getItem('tabiquest:posing') === args[0]; } catch (e) {}
    closeViewer = openViewer({ cardId: args[0], posing, onClose: () => { try { sessionStorage.removeItem('tabiquest:posing'); } catch (e) {} closeViewer = null; history.length > 1 ? history.back() : (location.hash = '#/zukan'); } });
  } else if (name === 'preview') {
    renderZukan(view);
    closeViewer = openViewer({ preview: { placeId: args[0], time: args[1], weather: args[2], season: args[3] }, onClose: () => { closeViewer = null; location.hash = '#/settings'; } });
  } else renderZukan(view);
  if (!['card', 'preview'].includes(name)) window.scrollTo(0, 0);
}
addEventListener('hashchange', route);

// ---- 名所の一覧 ----
// 近い順に、名所ごとの横長の絵（タイル）を並べる。まだ行っていない名所の絵はグレーにして、行ってからのお楽しみにする
// 現在地がわかっていれば「いま到着できる／近く／日帰りで／遠く」に分ける。わからなければ番号順
const RANGES = [['can', 'いま到着できます'], [2000, '近く（2km以内）'], [50000, '日帰りで行ける（50km以内）'], [Infinity, '遠く']];
function renderList() {
  const pos = current(), fake = pos?.fake;
  const nowText = fake ? `デバッグ：${esc(placeById(settings.loc)?.name || 'どこでもない場所')}にいることにしています`
    : here.busy ? '現在地を確かめています…'
    : here.error ? `<span class="warn">${esc(here.error)}</span>`
    : pos ? `${here.at.getHours()}:${String(here.at.getMinutes()).padStart(2, '0')} の現在地から近い順${pos.acc > 200 ? `<br><span class="warn">誤差が約${Math.round(pos.acc)}mと大きいので、空の見える場所でもう一度確かめてください</span>` : ''}`
    : '現在地を確かめると、近い順に並びます';
  const cats = CATEGORIES.filter(c => PLACES.some(p => p.categories.includes(c)));
  let list = PLACES.filter(p => (ui.cat === 'all' || p.categories.includes(ui.cat)) && (ui.seen === 'all' || (ui.seen === 'yes') === visited(p.id)));
  if (pos) list = [...list].sort((a, z) => statusOf(a).d - statusOf(z).d);
  const got = PLACES.filter(p => visited(p.id)).length;
  view.innerHTML = `<div class="phead"><h1>名所</h1><span class="prog">${got} / ${PLACES.length} か所 行った</span>
      ${fake ? '' : `<button class="pillbtn" id="locate" ${here.busy ? 'disabled' : ''}>◎ ${pos ? 'もう一度' : '現在地'}</button>`}</div>
    <p class="nowline">${nowText}</p>
    <div class="filters">
      <div class="chips-row" role="group" aria-label="行った／まだ">${[['all', 'ぜんぶ'], ['no', 'まだ'], ['yes', '行った']].map(([v, l]) => `<button data-seen="${v}" aria-pressed="${ui.seen === v}">${l}</button>`).join('')}<span class="sep"></span>${cats.map(c => `<button data-cat="${esc(c)}" aria-pressed="${ui.cat === c}">${esc(c)}</button>`).join('')}</div>
    </div>
    <div id="spots"></div>`;
  view.querySelector('#locate')?.addEventListener('click', async () => { here.busy = true; renderList(); await locate(); renderList(); });
  view.querySelector('.filters').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.cat) ui.cat = ui.cat === b.dataset.cat ? 'all' : b.dataset.cat;   // カテゴリはもう一度押すと解除 if (b.dataset.seen) ui.seen = b.dataset.seen; saveUi(); renderList();
  };
  const box = view.querySelector('#spots');
  if (!list.length) box.innerHTML = '<p class="note empty">この条件の名所はありません。</p>';
  let range = null;
  for (const p of list) {
    const cs = cardsOf(p.id), st = statusOf(p), been = cs.length > 0;
    if (pos) {   // 距離のまとまりごとに見出しを入れる
      const r = RANGES.find(([k]) => k === 'can' ? st.inside : st.d <= k);
      if (r !== range) { range = r; box.insertAdjacentHTML('beforeend', `<h2 class="range${r[0] === 'can' ? ' can' : ''}">${r[1]}</h2>`); }
    }
    const el = document.createElement('section'); el.className = 'tile' + (st.inside ? ' can' : '') + (been ? '' : ' yet'); el.setAttribute('aria-label', p.name);
    const where = `${esc(prefCity(p))}${st.known ? ` ・ ここから ${fmtDist(st.d)}` : ''}`;
    const act = st.inside ? `<button class="go" data-arrive="${p.id}">到着する</button>`
      : been ? `<span class="go sub">アルバム ›</span>` : `<span class="go sub">まだ</span>`;
    el.innerHTML = `<a class="hit" href="#/place/${p.id}" aria-label="${esc(p.name)}を見る"></a><div class="art"></div><div class="shade"></div>
      ${cs.length > 1 ? `<span class="cnt">×${cs.length}</span>` : ''}${p.kind === 'photo' || p.kind === 'plain' ? '<span class="kari-s">仮</span>' : ''}
      <div class="t"><b>${esc(p.name)}</b><small>${where}</small>${been ? '' : (p.blurb ? `<small class="bl">${esc(p.blurb)}</small>` : '')}</div>${act}`;
    box.append(el);
    const art = el.querySelector('.art');
    if (been) snapshot(p.scene, cs[0]).then(u => art.append(img(u, p.alt)));
    else if (p.kind === 'photo') art.append(img(p.photo.src, ''));
    else if (p.kind === 'plain') art.append(img(PLAIN_BG, ''));
    else snapshot(p.scene, { time: renderTime(p, timeOfDay(new Date())), weather: 'clear' }).then(u => art.append(img(u, '')));
  }
  box.onclick = async e => {
    const btn = e.target.closest('[data-arrive]'); if (!btn) return;
    const p = placeById(btn.dataset.arrive); if (!statusOf(p).inside) return;
    btn.disabled = true; btn.textContent = '天気を確かめています…';
    const v = await conditionsAt(p, current()), r = arrive(p, v); header();
    const act = await playArrival(p, r.card, r, {});
    checkGoals(); header();
    // 「撮影する」：そのカードを、撮影の操作を開いた状態で出す。「あとで撮影する」：名所の一覧に戻る（図鑑からいつでも撮影できる）
    if (act === 'photo') { try { sessionStorage.setItem('tabiquest:posing', r.card.id); } catch (e) {} location.hash = `#/card/${r.card.id}`; } else { renderList(); header(); }
  };
}

// ---- 設定 ----
let taps = 0, tapT = 0;
async function renderSettings() {
  const b = book(), got = PLACES.filter(p => visited(p.id)).length, m = mode();
  const items = PLACES.filter(p => b.items[p.item.id]).map(p => `${esc(p.item.name)} ×${b.items[p.item.id]}`);
  view.innerHTML = `<div class="phead"><h1>設定</h1></div>
    <div class="group"><h2>きろく${m === 'debug' ? '（デバッグ用）' : ''}</h2>
      <div class="stats"><div><b>${b.points}</b><span>ポイント</span></div><div><b>${got}<small>/${PLACES.length}</small></b><span>行った名所</span></div><div><b>${b.cards.length}</b><span>カード</span></div><div><b>${items.length}</b><span>アイテム</span></div></div>
      ${items.length ? `<p class="note">${items.join('　')}</p>` : ''}
      <a class="wide" href="#/goals">★ 称号とアチーブメントを見る</a></div>
    <div class="group"><h2>記録の保存</h2>
      <p class="note">記録はこの端末の中だけにあります。機種変更やブラウザのデータ消去にそなえて、ときどきファイルに書き出してください。${m === 'debug' ? '<br><b>いまはデバッグ用の記録が対象です。</b>' : ''}</p>
      <p class="note" id="persist">消さないでの設定：確かめています…</p>
      <div class="col"><button data-a="export">↓ ファイルに書き出す</button><button data-a="import">↑ ファイルから読み込む</button><input type="file" id="importFile" accept="application/json,.json" hidden></div></div>
    <div class="group"><h2>このアプリについて</h2>
      <p class="note">位置情報は「現在地を確かめる」を押したときだけ使います。到着したときは、天気を調べるために、だいたいの位置（約1km単位）を Open-Meteo に送ります。</p>
      <p class="note">端末で「動きを減らす」をオンにしていると、到着演出を省略します。</p>
      <p class="note">朝・昼の絵がないドット絵の名所では、いちばん近い時間帯の絵で表示します。</p></div>
    <div class="group"><h2>写真のクレジット（仮の名所）</h2>
      <ul class="credits">${PLACES.filter(p => p.kind === 'photo').map(p => `<li>${esc(p.name)}：${esc(p.photo.author)}、<a href="${esc(p.photo.page)}" target="_blank" rel="noopener">Wikimedia Commons</a>、${p.photo.license_url ? `<a href="${esc(p.photo.license_url)}" target="_blank" rel="noopener">${esc(p.photo.license)}</a>` : esc(p.photo.license)}（9:16に切り抜き）</li>`).join('')}</ul>
      <p class="note">天気：<a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>（CC BY 4.0）</p></div>
    <div id="dbg"></div>
    <button class="ver" id="ver">タビクエ v${VERSION}</button>`;
  const dbgBox = view.querySelector('#dbg');
  if (settings.debugUnlocked) renderDebug(dbgBox, () => { header(); renderSettings(); });
  view.querySelector('#ver').addEventListener('click', () => {
    const now = Date.now(); taps = now - tapT < 1500 ? taps + 1 : 1; tapT = now;
    if (taps >= 7 && !settings.debugUnlocked) { settings.debugUnlocked = true; saveSettings(); taps = 0; toast('デバッグモードを表示しました'); renderSettings(); }
  });
  const file = view.querySelector('#importFile');
  view.querySelector('[data-a=export]').onclick = () => {
    const blob = new Blob([exportBook()], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `tabiquest-${m === 'debug' ? 'debug' : 'kiroku'}-${fmtDate(null, '')}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000); toast('記録を書き出しました');
  };
  view.querySelector('[data-a=import]').onclick = () => file.click();
  file.onchange = async () => {
    const f = file.files[0]; if (!f) return;
    try {
      const text = await f.text(), j = JSON.parse(text);
      if (j.kind && j.kind !== m && !confirm(`このファイルは${j.kind === 'debug' ? 'デバッグ用' : '本番'}の記録です。いまの${m === 'debug' ? 'デバッグ用' : '本番'}の記録に読み込みますか？`)) return;
      if (!confirm(`いまの${m === 'debug' ? 'デバッグ用' : '本番'}の記録を、ファイルの中身で置きかえます。よろしいですか？`)) return;
      const r = importBook(text); toast(`読み込みました（カード ${r.cards}まい）`); header(); renderSettings();
    } catch (e) { toast('読み込めませんでした：' + e.message, 4000); }
  };
  const ok = await persist(), pe = view.querySelector('#persist');
  if (pe) pe.textContent = ok ? '消さないでの設定：オン（ブラウザが記録を自動で消さないようにしています）' : '消さないでの設定：オフ（ホーム画面に追加すると、オンになりやすくなります）';
}

// ---- オフライン（Service Worker） ----
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker?.register('sw.js', { updateViaCache: 'none' }).then(reg => {
    reg.addEventListener('updatefound', () => {
      const w = reg.installing; w?.addEventListener('statechange', () => { if (w.state === 'activated' && navigator.serviceWorker.controller) { toast('新しい版にしました'); setTimeout(() => location.reload(), 900); } });
    });
  }).catch(() => {});
}

persist();
if (!location.hash) history.replaceState(null, '', '#/home');   // 開いたときはホーム
route();
