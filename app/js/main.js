// 画面の切り替えと、一覧・設定の画面
import { PLACES, placeById, CATEGORIES, PLAIN_BG } from './places.js';
import { settings, saveSettings, book, mode, arrive, cardsOf, visited, exportBook, importBook, persist, DEBUG } from './store.js';
import { engine, snapshot, clearSnaps } from './card.js';
import { locate, here, statusOf, fmtDist, current } from './geo.js';
import { conditionsAt, renderTime, timeOfDay } from './conditions.js';
import { esc, img, toast, fmtDate, prefCity, icon } from './ui.js';
import { playArrival } from './arrival.js';
import { renderZukan, renderPlace, openViewer } from './zukan.js';
import { renderDebug } from './debug.js';
import { renderMihon } from './mihon.js';
import { renderMap } from './map.js';
import { renderGoals, checkGoals, goalList } from './goals.js';
import { renderTimeline } from './calendar.js';
import { renderHome } from './home.js';
import { PERSONAS, charaPersona, setCharaPersona, loadSerifu, pick } from './serifu.js';
import * as minatomirai from './scenes/minatomirai.js';
import * as chukagai from './scenes/chukagai.js';
import * as tokyotower from './scenes/tokyotower.js';
import * as mitsumine from './scenes/mitsumine.js';
import * as chichibu from './scenes/chichibu.js';
import * as hodosan from './scenes/hodosan.js';
import * as nagatoro from './scenes/nagatoro.js';
import * as hitsujiyama from './scenes/hitsujiyama.js';
import * as akarenga from './scenes/akarenga.js';
import * as yamashita from './scenes/yamashita.js';
import * as osanbashi from './scenes/osanbashi.js';
import * as sankeien from './scenes/sankeien.js';
import * as shomyoji from './scenes/shomyoji.js';
import * as tsurugaoka from './scenes/tsurugaoka.js';
import * as daibutsu from './scenes/daibutsu.js';
import * as hasedera from './scenes/hasedera.js';
import * as kenchoji from './scenes/kenchoji.js';
import * as engakuji from './scenes/engakuji.js';
import * as hokokuji from './scenes/hokokuji.js';
import * as enoshima from './scenes/enoshima.js';
import * as jogashima from './scenes/jogashima.js';
import * as sarushima from './scenes/sarushima.js';
import * as odawarajo from './scenes/odawarajo.js';
import * as hakonejinja from './scenes/hakonejinja.js';
import * as owakudani from './scenes/owakudani.js';
import * as ashinoko from './scenes/ashinoko.js';
import * as oyama from './scenes/oyama.js';
import * as kawasakidaishi from './scenes/kawasakidaishi.js';
import * as kamakura from './scenes/kamakura.js';
import * as photo from './scenes/photo.js';

export const VERSION = '0.10.120';
engine.register('minatomirai', minatomirai.build);
engine.register('chukagai', chukagai.build);
engine.register('tokyotower', tokyotower.build);
engine.register('mitsumine', mitsumine.build);
engine.register('chichibu', chichibu.build);
engine.register('hodosan', hodosan.build);
engine.register('nagatoro', nagatoro.build);
engine.register('hitsujiyama', hitsujiyama.build);
engine.register('akarenga', akarenga.build);
engine.register('yamashita', yamashita.build);
engine.register('osanbashi', osanbashi.build);
engine.register('sankeien', sankeien.build);
engine.register('shomyoji', shomyoji.build);
engine.register('tsurugaoka', tsurugaoka.build);
engine.register('daibutsu', daibutsu.build);
engine.register('hasedera', hasedera.build);
engine.register('kenchoji', kenchoji.build);
engine.register('engakuji', engakuji.build);
engine.register('hokokuji', hokokuji.build);
engine.register('enoshima', enoshima.build);
engine.register('jogashima', jogashima.build);
engine.register('sarushima', sarushima.build);
engine.register('odawarajo', odawarajo.build);
engine.register('hakonejinja', hakonejinja.build);
engine.register('owakudani', owakudani.build);
engine.register('ashinoko', ashinoko.build);
engine.register('oyama', oyama.build);
engine.register('kawasakidaishi', kawasakidaishi.build);
engine.register('kamakura', kamakura.build);
for (const p of PLACES) if (p.kind === 'photo') engine.register(p.scene, () => photo.build(p));
// 絵のない名所は、写真の名所のしくみに空の絵を渡して使う
for (const p of PLACES) if (p.kind === 'plain') engine.register(p.scene, () => photo.build({ ...p, photo: { src: PLAIN_BG } }));

const view = document.getElementById('view');
let closeViewer = null, lastName = '';
const ui = (() => { try { return Object.assign({ cat: 'all', seen: 'all', sort: 'near' }, JSON.parse(localStorage.getItem('tabiquest:ui') || '{}')); } catch (e) { return { cat: 'all', seen: 'all' }; } })();
const saveUi = () => { try { localStorage.setItem('tabiquest:ui', JSON.stringify(ui)); } catch (e) {} };

function header() {
  document.getElementById('pts').textContent = `${book().points}pt`;
  document.getElementById('debugBadge').hidden = mode() !== 'debug';
  document.getElementById('debugReload').hidden = !DEBUG;
}
// デバッグ版：「最新を読む」＝オフライン用の保存（Service Worker とキャッシュ）を消して、読み込み直す。記録（localStorage）は消さない
export async function reloadLatest() {
  toast('最新の版を読み込みます…');
  try { for (const r of await navigator.serviceWorker?.getRegistrations?.() || []) await r.unregister(); } catch (e) {}
  try { for (const k of await caches.keys()) await caches.delete(k); } catch (e) {}
  const u = new URL(location.href); u.searchParams.set('v', Date.now().toString(36)); location.replace(u.toString());   // アドレスを変えて、ブラウザの保存も通らないように
}
document.getElementById('debugReload').onclick = reloadLatest;

function route() {
  closeViewer?.(); closeViewer = null;
  const [name, ...args] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  if (name === 'home' || name === 'shop') {   // ホーム（前のショップは家具だけだったので、ホームへ）
    document.querySelectorAll('nav.tabs a').forEach(a => { if (a.dataset.tab === 'home') a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    header(); view.classList.remove('mapmode');
    closeViewer = renderHome(view, { header });
    window.scrollTo(0, 0); return;
  }
  const tab = ['zukan', 'place', 'card', 'preview', 'goals', 'calendar', 'timeline'].includes(name) ? 'zukan' : ['settings', 'map'].includes(name) ? name : name === 'mihon' && DEBUG ? 'settings' : 'list';
  document.querySelectorAll('nav.tabs a').forEach(a => { if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  header();
  view.classList.toggle('mapmode', tab === 'map');
  const from = lastName; lastName = name;
  if (name === 'mihon' && DEBUG) renderMihon(view);   // 見本帳（デバッグ版だけ）
  else if (tab === 'map') renderMap(view);
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
    closeViewer = openViewer({ preview: { placeId: args[0], time: args[1], weather: args[2], season: args[3] }, onClose: () => { closeViewer = null; location.hash = from === 'mihon' ? '#/mihon' : '#/settings'; } });
  } else renderZukan(view);
  if (!['card', 'preview', 'mihon'].includes(name)) window.scrollTo(0, 0);
}
addEventListener('hashchange', route);

// ---- 名所の一覧 ----
// 上に「いちばん近い名所」を大きく（カードの絵の中にキャラが立っている）。押すボタンはそこの1つだけ
// その下に、近い順のチケット（2列）。まだ行っていない名所の絵はうすい灰色にして、行ってからのお楽しみにする
// 現在地がわかっていれば「いま到着できる／近く／日帰りで／遠く」に分ける。わからなければ番号順
const RANGES = [['can', 'いま到着できます'], [2000, '近く（2km以内）'], [50000, '日帰りで行ける（50km以内）'], [Infinity, '遠く']];
// 名所の絵：行ったことがあれば最新のカード、なければいまの時間帯の絵
// noChara：カードの中のキャラを絵の外へ出して、景色だけにする（上の大きな絵では、案内役のキャラを別に立たせるため）
function placeArt(p, el, cs = cardsOf(p.id), noChara = false) {
  const off = st => noChara ? { ...st, photo: { ...(st.photo || {}), x: 9 } } : st;
  if (p.kind === 'plain' && !cs.length) el.prepend(img(PLAIN_BG, ''));
  else if (cs.length) snapshot(p.scene, off(cs.find(c => c.fav) || cs[0])).then(u => el.prepend(img(u, p.alt)));   // お気に入りのカードがあればそれ、なければいちばん新しいカード
  else if (p.kind === 'photo' && !noChara) el.prepend(img(p.photo.src, ''));
  else snapshot(p.scene, off({ time: renderTime(p, timeOfDay(new Date())), weather: 'clear' })).then(u => el.prepend(img(u, '')));
}
function renderList() {
  const pos = current(), fake = pos?.fake;
  const nowText = fake ? `デバッグ：${esc(placeById(settings.loc)?.name || 'どこでもない場所')}にいることにしています`
    : here.busy ? '現在地を確かめています…'
    : here.error ? `<span class="warn">${esc(here.error)}</span>`
    : pos ? `${here.at.getHours()}:${String(here.at.getMinutes()).padStart(2, '0')} の現在地から近い順${pos.acc > 200 ? `<br><span class="warn">誤差が約${Math.round(pos.acc)}mと大きいので、空の見える場所でもう一度確かめてください</span>` : ''}`
    : '';
  const cats = CATEGORIES.filter(c => PLACES.some(p => p.categories.includes(c)));
  let list = PLACES.filter(p => (ui.cat === 'all' || p.categories.includes(ui.cat)) && (ui.seen === 'all' || (ui.seen === 'yes') === visited(p.id)));
  const byPref = ui.sort === 'pref';   // 並べ方：近い順（現在地がわかるとき）／県ごと（県の番号順、その中は名所の番号順）
  if (byPref) list = [...list].sort((a, z) => (a.no || '') < (z.no || '') ? -1 : (a.no || '') > (z.no || '') ? 1 : 0);
  else if (pos) list = [...list].sort((a, z) => statusOf(a).d - statusOf(z).d);
  const got = PLACES.filter(p => visited(p.id)).length;
  // いちばん近い名所（現在地がわかるとき）
  const near = pos ? PLACES.reduce((a, p) => (!a || statusOf(p).d < statusOf(a).d ? p : a), null) : null, nst = near && statusOf(near);
  const say = !pos ? (here.busy ? '現在地を確かめているよ…' : '現在地を確かめると、近くの名所を案内するよ')
    : nst.inside ? '着いたよ！ここで撮ろう' : `${esc(near.name)}まで あと ${fmtDist(nst.d)}`;
  const cta = near && nst.inside ? `<button class="cta" data-arrive="${near.id}">${icon('camera', 20)}到着して カードを撮る</button>`
    : fake ? `<a class="cta sub" href="#/place/${near.id}">名所のページを見る</a>`
    : `<button class="cta${pos ? ' sub' : ''}" id="locate" ${here.busy ? 'disabled' : ''}>${icon('locate', 20)}${pos ? 'もう一度 現在地を確かめる' : '現在地を確かめる'}</button>`;
  view.innerHTML = `<div class="listwrap">
    <section class="lhero${near ? '' : ' empty'}">
      <div class="lh-art"></div><img class="lh-chara" src="ui/chara_wave.png" alt="">
      ${near ? `<a class="hit" href="#/place/${near.id}" aria-label="${esc(near.name)}を見る"></a>` : ''}
      <p class="bubble">${say}</p>
    </section>
    <section class="lh-card">
      <div class="lh-t"><small>${near ? (nst.inside ? 'いま いる場所' : 'いちばん近い名所') : 'タビクエ'}</small><b>${near ? esc(near.name) : '近くの名所をさがそう'}</b></div>
      <span class="lh-d">${near ? fmtDist(nst.d) : `${got} / ${PLACES.length}`}</span>
      ${cta}
      ${nowText ? `<p class="nowline">${nowText}</p>` : ''}
    </section>
    <div class="lhead"><h2>名所</h2><span class="prog"><b>${got}</b> / ${PLACES.length} か所 行った</span></div>
    <div class="filters">
      <div class="chips-row" role="group" aria-label="並べ方">${[['near', '近い順'], ['pref', '県ごと']].map(([v, l]) => `<button data-sort="${v}" aria-pressed="${ui.sort === v}">${l}</button>`).join('')}</div>
      <div class="chips-row" role="group" aria-label="行った／まだ">${[['all', 'ぜんぶ'], ['no', 'まだ'], ['yes', '行った']].map(([v, l]) => `<button data-seen="${v}" aria-pressed="${ui.seen === v}">${l}</button>`).join('')}<span class="sep"></span>${cats.map(c => `<button data-cat="${esc(c)}" aria-pressed="${ui.cat === c}">${esc(c)}</button>`).join('')}</div>
    </div>
    <div id="spots"></div></div>`;
  const wrap = view.querySelector('.listwrap');
  if (near) placeArt(near, wrap.querySelector('.lh-art'), undefined, true);
  wrap.querySelector('#locate')?.addEventListener('click', async () => { here.busy = true; renderList(); await locate(); renderList(); });
  wrap.querySelector('.filters').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.cat) ui.cat = ui.cat === b.dataset.cat ? 'all' : b.dataset.cat;   // カテゴリはもう一度押すと解除
    if (b.dataset.seen) ui.seen = b.dataset.seen;
    if (b.dataset.sort) ui.sort = b.dataset.sort;
    saveUi(); renderList();
  };
  const box = wrap.querySelector('#spots');
  if (!list.length) box.innerHTML = '<p class="note empty">この条件の名所はありません。</p>';
  let range = null, grid = null;
  for (const p of list) {
    const cs = cardsOf(p.id), st = statusOf(p), been = cs.length > 0;
    const r = byPref ? p.pref : pos ? RANGES.find(([k]) => k === 'can' ? st.inside : st.d <= k) : 'all';
    if (r !== range || !grid) {   // 県ごと、または距離のまとまりごとに見出しを入れる
      range = r;
      if (byPref) { const inP = PLACES.filter(x => x.pref === p.pref); box.insertAdjacentHTML('beforeend', `<h3 class="range">${esc(p.pref)}　${inP.filter(x => visited(x.id)).length} / ${inP.length}</h3>`); }
      else if (pos) box.insertAdjacentHTML('beforeend', `<h3 class="range${r[0] === 'can' ? ' can' : ''}">${r[1]}</h3>`);
      grid = document.createElement('div'); grid.className = 'tickets'; box.append(grid);
    }
    const el = document.createElement('section'); el.className = 'ticket' + (st.inside ? ' can' : '') + (been ? '' : ' yet') + (p.kind === 'plain' && !been ? ' plain' : ''); el.setAttribute('aria-label', p.name);
    el.innerHTML = `<a class="hit" href="#/place/${p.id}" aria-label="${esc(p.name)}を見る"></a>
      <div class="art">${p.kind === 'plain' && !been ? icon('place', 34) : ''}${cs.length > 1 ? `<span class="cnt">×${cs.length}</span>` : ''}${been ? '' : '<span class="yetpill">まだ</span>'}${p.kind === 'photo' || p.kind === 'plain' ? '<span class="kari-s">仮</span>' : ''}${(DEBUG || st.inside) && p !== (nst?.inside ? near : null) ? `<button class="go" data-arrive="${p.id}" aria-label="${esc(p.name)}に到着する">${icon('camera', 18)}<span>到着</span></button>` : ''}</div>
      <div class="tk-b"><b>${esc(p.name)}</b><small>${esc(p.city.replace(/[^市]*$/, '') || p.city)}${st.known ? ` ・ <span class="d">${fmtDist(st.d)}</span>` : ''}</small></div>`;
    grid.append(el);
    placeArt(p, el.querySelector('.art'), cs);
  }
  wrap.onclick = async e => {
    const btn = e.target.closest('[data-arrive]'); if (!btn) return;
    const p = placeById(btn.dataset.arrive); if (!DEBUG && !statusOf(p).inside) return;   // デバッグ版は、どこにいても到着できる
    btn.disabled = true; if (btn.classList.contains('cta')) btn.textContent = '天気を確かめています…';
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
  const last = goalList().filter(g => b.goals[g.id]).sort((x, y) => String(b.goals[y.id]).localeCompare(String(b.goals[x.id])))[0];
  const row = (tag, attrs, ic, label, sub = '') => `<${tag} class="srow" ${attrs}><span class="si">${icon(ic, 19)}</span><span class="st">${label}${sub ? `<small>${sub}</small>` : ''}</span><span class="sc" aria-hidden="true">›</span></${tag}>`;
  view.innerHTML = `<div class="phead"><h1>設定</h1>${m === 'debug' ? '<span class="prog">デバッグ用の記録</span>' : ''}</div>
    <section class="prof">
      <div class="pf-pic"><img src="ui/chara_wave.png" alt="いっしょに旅しているキャラ"></div>
      <div class="pf-b"><small>いっしょに旅しているキャラ</small><b>キャラ1</b>
        <span class="ttl">${last ? esc(last.title) : '称号はまだ'}</span>
        <div class="stats"><div><b>${b.points}</b><span>pt</span></div><div><b>${got}<small>/${PLACES.length}</small></b><span>名所</span></div><div><b>${b.cards.length}</b><span>カード</span></div><div><b>${items.length}</b><span>アイテム</span></div></div></div>
    </section>
    ${items.length ? `<p class="note pad">${items.join('　')}</p>` : ''}
    <h3 class="gh">キャラ</h3>
    <p class="note pad">キャラの見た目は、ホームの「お着替え」で変えられます。</p>
    <div class="group persona"><h2>キャラの性格</h2><p class="note">ホームのふきだしの話し方が変わります。</p>
      <div class="chips-row">${PERSONAS.map(p => `<button data-persona="${p.id}" aria-pressed="${p.id === charaPersona()}">${esc(p.name)}</button>`).join('')}</div>
      <p class="note pv"></p></div>
    <div class="srows">${row('a', 'href="#/goals"', 'star', '称号とアチーブメント')}</div>
    <h3 class="gh">記録の保存</h3>
    <div class="srows">${row('button', 'data-a="export"', 'down', 'ファイルに書き出す')}${row('button', 'data-a="import"', 'up', 'ファイルから読み込む')}</div>
    <input type="file" id="importFile" accept="application/json,.json" hidden>
    <p class="note pad">記録はこの端末の中だけにあります。機種変更やブラウザのデータ消去にそなえて、ときどきファイルに書き出してください。${m === 'debug' ? '<br><b>いまはデバッグ用の記録が対象です。</b>' : ''}</p>
    <p class="note pad" id="persist">消さないでの設定：確かめています…</p>
    <h3 class="gh">このアプリについて</h3>
    <div class="srows">
      <details class="sdet"><summary>${row('span', '', 'info', '位置情報と天気のこと')}</summary><div class="sbody">
        <p class="note">位置情報は「現在地を確かめる」を押したときだけ使います。到着したときは、天気を調べるために、だいたいの位置（約1km単位）を Open-Meteo に送ります。</p>
        <p class="note">端末で「動きを減らす」をオンにしていると、到着演出を省略します。</p>
        <p class="note">朝・昼の絵がないドット絵の名所では、いちばん近い時間帯の絵で表示します。</p></div></details>
      <details class="sdet"><summary>${row('span', '', 'photo', '写真のクレジット', '仮の名所の写真と天気のデータ')}</summary><div class="sbody">
        <ul class="credits">${PLACES.filter(p => p.kind === 'photo').map(p => `<li>${esc(p.name)}：${esc(p.photo.author)}、<a href="${esc(p.photo.page)}" target="_blank" rel="noopener">Wikimedia Commons</a>、${p.photo.license_url ? `<a href="${esc(p.photo.license_url)}" target="_blank" rel="noopener">${esc(p.photo.license)}</a>` : esc(p.photo.license)}（9:16に切り抜き）</li>`).join('')}</ul>
        <p class="note">天気：<a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>（CC BY 4.0）</p></div></details>
    </div>
    <div id="dbg"></div>
    <button class="ver" id="ver">タビクエ v${VERSION}</button>`;
  const pv = view.querySelector('.persona .pv'), sample = () => loadSerifu().then(d => { pv.textContent = `「${pick(d.places.minatomirai)[0]}」`; }).catch(() => {});
  sample();
  view.querySelectorAll('[data-persona]').forEach(bt => bt.onclick = () => { setCharaPersona(bt.dataset.persona); view.querySelectorAll('[data-persona]').forEach(x => x.setAttribute('aria-pressed', String(x === bt))); sample(); });
  const dbgBox = view.querySelector('#dbg');
  if (DEBUG) renderDebug(dbgBox, () => { header(); renderSettings(); });   // デバッグ版（?debug を付けて開いたとき）だけ
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
