// 画面の切り替えと、一覧・設定の画面
import { PLACES, placeById, LABEL } from './places.js';
import { settings, saveSettings, book, mode, arrive } from './store.js';
import { engine, snapshot } from './card.js';
import { locate, here, statusOf, fmtDist, current } from './geo.js';
import { variantNow, esc, img, toast } from './ui.js';
import { playArrival } from './arrival.js';
import { renderZukan, openViewer } from './zukan.js';
import { renderDebug } from './debug.js';
import * as minatomirai from './scenes/minatomirai.js';
import * as chukagai from './scenes/chukagai.js';

const VERSION = '0.1.0';
engine.register('minatomirai', minatomirai.build);
engine.register('chukagai', chukagai.build);

const view = document.getElementById('view');
let closeViewer = null;

function header() {
  document.getElementById('pts').textContent = `${book().points}pt`;
  document.getElementById('debugBadge').hidden = mode() !== 'debug';
}

function route() {
  closeViewer?.(); closeViewer = null;
  const h = location.hash.replace(/^#\/?/, ''), [name, arg] = h.split('/');
  const tab = name === 'zukan' || name === 'card' ? 'zukan' : name === 'settings' ? 'settings' : 'list';
  document.querySelectorAll('nav.tabs a').forEach(a => { if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  header();
  if (tab === 'list') renderList();
  else if (tab === 'zukan') { renderZukan(view); if (name === 'card') closeViewer = openViewer(arg, { onClose: () => { closeViewer = null; location.hash = '#/zukan'; } }); }
  else renderSettings();
  if (name !== 'card') window.scrollTo(0, 0);
}
addEventListener('hashchange', route);

// ---- 名所の一覧 ----
function renderList() {
  const pos = current(), fake = pos?.fake;
  const nowText = fake ? `デバッグ：${esc(placeById(settings.loc)?.name || 'どこでもない場所')}にいることにしています`
    : here.busy ? '現在地を確かめています…'
    : here.error ? esc(here.error)
    : pos ? `現在地を確かめました（${here.at.getHours()}:${String(here.at.getMinutes()).padStart(2, '0')}、誤差 約${Math.round(pos.acc)}m）`
    : 'まだ現在地を確かめていません';
  view.innerHTML = `<h1>名所</h1><p class="lead">名所の近くで「到着する」を押すと、カードが手に入ります。</p>
    <div class="group here"><span class="now">${nowText}</span>${fake ? '' : `<div class="row"><button class="primary" id="locate" ${here.busy ? 'disabled' : ''}>現在地を確かめる</button></div>`}</div>
    <div id="spots"></div>`;
  view.querySelector('#locate')?.addEventListener('click', async () => { here.busy = true; renderList(); await locate(); renderList(); });
  const box = view.querySelector('#spots'), b = book();
  for (const p of PLACES) {
    const c = b.cards[p.id], st = statusOf(p);
    const stText = !st.known ? '距離はまだわかりません' : st.inside ? '到着できます！' : `ここから ${fmtDist(st.d)}`;
    const el = document.createElement('section'); el.className = 'spot' + (st.inside ? ' can' : ''); el.setAttribute('aria-label', p.name);
    el.innerHTML = `<div class="thumb ${c ? '' : 'dim'}">${c ? '' : '<span class="lock" aria-hidden="true">？</span>'}</div>
      <div class="body"><span class="nm">${esc(p.name)}</span><span class="sub">${esc(p.pref)} ${esc(p.city)} ／ No.${esc(p.no)}</span>
        <span class="st ${st.inside ? 'go' : 'far'}">${stText}</span>
        <span class="sub">${c ? `カード入手ずみ・到着 ${c.visits.length}回` : 'カードはまだありません'}</span>
        <div class="act row"><button class="primary" data-arrive="${p.id}" ${st.inside ? '' : 'disabled'}>到着する</button>${c ? `<a class="btn" href="#/card/${p.id}">カードを見る</a>` : ''}</div></div>`;
    box.append(el);
    const v = c ? c.variants[0] : { time: variantNow(p).time, weather: 'clear' };
    snapshot(p.scene, v).then(u => el.querySelector('.thumb').prepend(img(u, c ? p.alt : '')));
  }
  box.onclick = async e => {
    const btn = e.target.closest('[data-arrive]'); if (!btn) return;
    const p = placeById(btn.dataset.arrive); if (!statusOf(p).inside) return;
    const v = variantNow(p), r = arrive(p, v); header();
    await playArrival(p, v, r, { onZukan: () => { location.hash = `#/card/${p.id}`; } });
    if (location.hash.startsWith('#/card/')) return; renderList(); header();
  };
}

// ---- 設定 ----
let taps = 0, tapT = 0;
function renderSettings() {
  const b = book(), got = PLACES.filter(p => b.cards[p.id]).length;
  const items = PLACES.filter(p => b.items[p.item.id]).map(p => `${esc(p.item.name)} ×${b.items[p.item.id]}`);
  view.innerHTML = `<h1>設定</h1>
    <div class="group"><h2>きろく${mode() === 'debug' ? '（デバッグ用）' : ''}</h2>
      <dl class="rec"><dt>ポイント</dt><dd>${b.points}pt</dd><dt>カード</dt><dd>${got} / ${PLACES.length} まい</dd><dt>アイテム</dt><dd>${items.length ? items.join('<br>') : 'まだありません'}</dd></dl></div>
    <div class="group"><h2>このアプリについて</h2>
      <p class="note">記録はこの端末の中だけに保存しています。位置情報は「現在地を確かめる」を押したときだけ使います。</p>
      <p class="note">端末で「視差効果を減らす（動きを減らす）」をオンにしていると、到着演出を省略します。</p>
      <p class="note">いまは昼の絵がないため、夜（19時〜5時）以外は夕暮れのカードになります。天気はまだ取得していないので、いつも晴れです。</p></div>
    <div id="dbg"></div>
    <button class="ver" id="ver">タビクエ v${VERSION}</button>`;
  const dbgBox = view.querySelector('#dbg');
  if (settings.debugUnlocked) renderDebug(dbgBox, () => { header(); renderSettings(); });
  view.querySelector('#ver').addEventListener('click', () => {
    const now = Date.now(); taps = now - tapT < 1500 ? taps + 1 : 1; tapT = now;
    if (taps >= 7 && !settings.debugUnlocked) { settings.debugUnlocked = true; saveSettings(); taps = 0; toast('デバッグモードを表示しました'); renderSettings(); }
  });
}

route();
