// 画面の切り替えと、一覧・設定の画面
import { PLACES, placeById, CATEGORIES } from './places.js';
import { settings, saveSettings, book, mode, arrive, cardsOf, visited, exportBook, importBook, persist } from './store.js';
import { engine, snapshot } from './card.js';
import { locate, here, statusOf, fmtDist, current } from './geo.js';
import { conditionsAt, renderTime, timeOfDay } from './conditions.js';
import { esc, img, toast, fmtDate } from './ui.js';
import { playArrival } from './arrival.js';
import { renderZukan, renderPlace, openViewer } from './zukan.js';
import { renderDebug } from './debug.js';
import { renderMap } from './map.js';
import { renderGoals, checkGoals } from './goals.js';
import * as minatomirai from './scenes/minatomirai.js';
import * as chukagai from './scenes/chukagai.js';
import * as kamakura from './scenes/kamakura.js';
import * as photo from './scenes/photo.js';

export const VERSION = '0.5.0';
engine.register('minatomirai', minatomirai.build);
engine.register('chukagai', chukagai.build);
engine.register('kamakura', kamakura.build);
for (const p of PLACES) if (p.kind === 'photo') engine.register(p.scene, () => photo.build(p));

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
  const tab = ['zukan', 'place', 'card', 'preview', 'goals'].includes(name) ? 'zukan' : ['settings', 'map'].includes(name) ? name : 'list';
  document.querySelectorAll('nav.tabs a').forEach(a => { if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  header();
  view.classList.toggle('mapmode', tab === 'map');
  if (tab === 'map') renderMap(view);
  else if (tab === 'list') renderList();
  else if (tab === 'settings') renderSettings();
  else if (name === 'goals') renderGoals(view);
  else if (name === 'place') renderPlace(view, args[0]);
  else if (name === 'card') {
    const c = book().cards.find(x => x.id === args[0]);
    if (c) renderPlace(view, c.placeId); else renderZukan(view);
    closeViewer = openViewer({ cardId: args[0], onClose: () => { closeViewer = null; history.length > 1 ? history.back() : (location.hash = '#/zukan'); } });
  } else if (name === 'preview') {
    renderZukan(view);
    closeViewer = openViewer({ preview: { placeId: args[0], time: args[1], weather: args[2], season: args[3] }, onClose: () => { closeViewer = null; location.hash = '#/settings'; } });
  } else renderZukan(view);
  if (!['card', 'preview'].includes(name)) window.scrollTo(0, 0);
}
addEventListener('hashchange', route);

// ---- 名所の一覧 ----
function renderList() {
  const pos = current(), fake = pos?.fake;
  const nowText = fake ? `デバッグ：${esc(placeById(settings.loc)?.name || 'どこでもない場所')}にいることにしています`
    : here.busy ? '現在地を確かめています…'
    : here.error ? esc(here.error)
    : pos ? `現在地を確かめました（${here.at.getHours()}:${String(here.at.getMinutes()).padStart(2, '0')}、誤差 約${Math.round(pos.acc)}m）${pos.acc > 200 ? '<br><span class="warn">誤差が大きいので、空の見える場所でもう一度確かめてください</span>' : ''}`
    : 'まだ現在地を確かめていません';
  const cats = CATEGORIES.filter(c => PLACES.some(p => p.categories.includes(c)));
  let list = PLACES.filter(p => (ui.cat === 'all' || p.categories.includes(ui.cat)) && (ui.seen === 'all' || (ui.seen === 'yes') === visited(p.id)));
  if (pos) list = [...list].sort((a, z) => statusOf(a).d - statusOf(z).d);
  view.innerHTML = `<h1>名所</h1><p class="lead">名所の近くで「到着する」を押すと、そのときの時間帯と天気のカードが1枚手に入ります。</p>
    <div class="group here"><span class="now">${nowText}</span>${fake ? '' : `<div class="row"><button class="primary" id="locate" ${here.busy ? 'disabled' : ''}>現在地を確かめる</button></div>`}</div>
    <div class="filters">
      <div class="chips-row" role="group" aria-label="カテゴリ">${[['all', 'すべて'], ...cats.map(c => [c, c])].map(([v, l]) => `<button data-cat="${esc(v)}" aria-pressed="${ui.cat === v}">${esc(l)}</button>`).join('')}</div>
      <div class="chips-row" role="group" aria-label="行った／まだ">${[['all', 'ぜんぶ'], ['no', 'まだ'], ['yes', '行った']].map(([v, l]) => `<button data-seen="${v}" aria-pressed="${ui.seen === v}">${l}</button>`).join('')}<span class="count">${list.length}か所</span></div>
    </div>
    <div id="spots"></div>`;
  view.querySelector('#locate')?.addEventListener('click', async () => { here.busy = true; renderList(); await locate(); renderList(); });
  view.querySelector('.filters').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.cat) ui.cat = b.dataset.cat; if (b.dataset.seen) ui.seen = b.dataset.seen; saveUi(); renderList();
  };
  const box = view.querySelector('#spots');
  if (!list.length) box.innerHTML = '<p class="note">この条件の名所はありません。</p>';
  for (const p of list) {
    const cs = cardsOf(p.id), st = statusOf(p);
    const stText = !st.known ? '距離はまだわかりません' : st.inside ? '到着できます！' : `ここから ${fmtDist(st.d)}`;
    const el = document.createElement('section'); el.className = 'spot' + (st.inside ? ' can' : ''); el.setAttribute('aria-label', p.name);
    el.innerHTML = `<div class="thumb ${cs.length ? '' : 'dim'}">${cs.length ? '' : '<span class="lock" aria-hidden="true">？</span>'}${p.kind === 'photo' ? '<span class="kari-s">仮</span>' : ''}</div>
      <div class="body"><span class="nm">${esc(p.name)}</span><span class="sub">${esc(p.pref)} ${esc(p.city)} ／ No.${esc(p.no)}</span>
        <span class="tags">${p.categories.map(c => `<span class="tag">${esc(c)}</span>`).join('')}</span>
        <span class="st ${st.inside ? 'go' : 'far'}">${stText}</span>
        <span class="sub">${cs.length ? `カード ${cs.length}まい ／ さいごの到着 ${fmtDate(cs[0].at)}` : 'カードはまだありません'}</span>
        <div class="act row"><button class="primary" data-arrive="${p.id}" ${st.inside ? '' : 'disabled'}>到着する</button>${cs.length ? `<a class="btn" href="#/place/${p.id}">アルバム</a>` : ''}</div></div>`;
    box.append(el);
    const th = el.querySelector('.thumb');
    if (cs.length) snapshot(p.scene, cs[0]).then(u => th.prepend(img(u, p.alt)));
    else if (p.kind === 'photo') th.prepend(img(p.photo.src, ''));
    else snapshot(p.scene, { time: renderTime(p, timeOfDay(new Date())), weather: 'clear' }).then(u => th.prepend(img(u, '')));
  }
  box.onclick = async e => {
    const btn = e.target.closest('[data-arrive]'); if (!btn) return;
    const p = placeById(btn.dataset.arrive); if (!statusOf(p).inside) return;
    btn.disabled = true; btn.textContent = '天気を確かめています…';
    const v = await conditionsAt(p, current()), r = arrive(p, v); header();
    const act = await playArrival(p, r.card, r, {});
    checkGoals(); header();
    if (act === 'zukan') location.hash = `#/card/${r.card.id}`; else { renderList(); header(); }
  };
}

// ---- 設定 ----
let taps = 0, tapT = 0;
async function renderSettings() {
  const b = book(), got = PLACES.filter(p => visited(p.id)).length, m = mode();
  const items = PLACES.filter(p => b.items[p.item.id]).map(p => `${esc(p.item.name)} ×${b.items[p.item.id]}`);
  view.innerHTML = `<h1>設定</h1>
    <div class="group"><h2>きろく${m === 'debug' ? '（デバッグ用）' : ''}</h2>
      <dl class="rec"><dt>ポイント</dt><dd>${b.points}pt</dd><dt>名所</dt><dd>${got} / ${PLACES.length} か所</dd><dt>カード</dt><dd>${b.cards.length} まい</dd><dt>アイテム</dt><dd>${items.length ? items.join('<br>') : 'まだありません'}</dd></dl></div>
    <div class="group"><h2>記録の保存</h2>
      <p class="note">記録はこの端末の中だけにあります。機種変更やブラウザのデータ消去にそなえて、ときどきファイルに書き出してください。${m === 'debug' ? '<br><b>いまはデバッグ用の記録が対象です。</b>' : ''}</p>
      <p class="note" id="persist">消さないでの設定：確かめています…</p>
      <div class="row"><button data-a="export">ファイルに書き出す</button><button data-a="import">ファイルから読み込む</button><input type="file" id="importFile" accept="application/json,.json" hidden></div></div>
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
route();
