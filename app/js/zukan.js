// 図鑑：名所ごとのアルバム。カードは到着ごとの1枚で、時間帯や天気をあとから変えることはできない
import { PLACES, placeById, LABEL, TIMES, WEATHERS, PLAIN_BG } from './places.js';
// キャラのポーズ（コマの順。assets の data.json の charaPoses と同じ）
//   体は1つで、腕を差し替える（2026-11-26）。番号は前の13ポーズのまま。なくなったポーズ（ジャンプ・撮る・ながめる・歩く・ハート・地図・自撮り）のカードは、立ちで出る
const POSES = [[0, '立ち'], [1, 'ばんざい'], [2, 'ピース'], [3, '指さし'], [4, '手をふる'], [7, '持つ']];
import { loadParts as loadChara2, FACES, fixLook as fixLook2, drawLook, bigPoses } from './chara2.js';
import { book, cardsOf, cardById, setPhoto, defaultLook, shown, setFav, settings } from './store.js';
import { openDress } from './dress.js';
import { engine, snapshot, clearSnaps, RS, reduceMotion } from './card.js';
// 撮影でえらぶもの（下の列に出す。着替えは、お着替えの画面をひらく）
const MODES = [['pose', 'ポーズ'], ['face', '表情'], ['turn', '向き'], ['tilt', 'かしげ'], ['wind', '風'], ['light', '光']];   // 腰（photo.lean）は、えらべなくした（前に残したカードは、そのまま出る）   // かしげ：首をかしげる（photo.tilt）。ポーズと表情は、新しいキャラではまだない
const TURNS = [[-1, '左を向く', 'u-2'], [0, '正面', 'u0'], [1, '右を向く', 'u2']];   // 1段だけ
const LEANS = [[-8, '左に大きく', 't-2'], [-4, '左に', 't-1'], [0, 'まっすぐ', 't0'], [4, '右に', 't1'], [8, '右に大きく', 't2']];
const WINDS = [[-2, '←強い', 'w-2'], [-1, '←弱い', 'w-1'], [0, 'なし', 'w0'], [1, '弱い→', 'w1'], [2, '強い→', 'w2']];
const TILTS = [[-10, '左に大きく', 't-2'], [-5, '左に', 't-1'], [0, 'まっすぐ', 't0'], [5, '右に', 't1'], [10, '右に大きく', 't2']];   // 新しいキャラは立ち1つ・表情1つなので、ポーズと表情はまだない（前のキャラにはあった）
import { cardEl, img, esc, fmtDate, fmtTime, cardNo, toast, icon } from './ui.js';

// 図鑑・旅の記録・称号の上に出す切り替え（同じ図鑑タブの中の3つの見方）
export function zukanTabs(on) {
  return `<div class="utabs" role="tablist">${[['zukan', 'カード'], ['timeline', '旅の記録'], ['goals', '称号']].map(([k, l]) =>
    `<a role="tab" href="#/${k}" aria-selected="${k === on}">${l}</a>`).join('')}</div>`;
}
// 図鑑の見出し：画面の名前と、全体の進みぐあい（輪）
export function zukanHead(sub, ratio) {
  const c = 2 * Math.PI * 24, d = Math.max(ratio > 0 ? 3 : 0, Math.round(c * ratio * 10) / 10);
  return `<div class="zhead"><div><h1>旅の図鑑</h1><span class="prog">${sub}</span></div>
    <div class="ring" role="img" aria-label="${Math.round(ratio * 100)}%"><svg width="58" height="58" viewBox="0 0 58 58" aria-hidden="true"><circle cx="29" cy="29" r="24" fill="none" stroke="var(--line)" stroke-width="7"/><circle cx="29" cy="29" r="24" fill="none" stroke="var(--teal)" stroke-width="7" stroke-linecap="round" stroke-dasharray="${d} ${c}" transform="rotate(-90 29 29)"/></svg><span>${Math.round(ratio * 100)}%</span></div></div>`;
}

// カードの小さな絵（文字は重ねない。名前などは下に帯で出す）
function art(p, c, cls = '') {
  const el = document.createElement('div'); el.className = 'pic ' + cls;
  snapshot(p.scene, c).then(u => el.prepend(img(u, p.alt))); return el;
}
const ROT = [-3, 2, -1, 3, -2, 1], TAPE = ['rgba(255,182,206,.8)', 'rgba(150,200,255,.75)', 'rgba(255,214,107,.8)', 'rgba(190,170,255,.75)'];

// 図鑑の絞り込み（エリア・集めたものだけ）。この端末に覚えておく
const zf = (() => { try { return Object.assign({ pref: 'all', city: 'all', got: false }, JSON.parse(localStorage.getItem('tabiquest:zukan') || '{}')); } catch (e) { return { pref: 'all', city: 'all', got: false }; } })();
const saveZf = () => { try { localStorage.setItem('tabiquest:zukan', JSON.stringify(zf)); } catch (e) {} };
const cityOf = p => p.city.replace(/[^市]*$/, '') || p.city;   // 横浜市西区 → 横浜市、千代田区はそのまま

// 図鑑：ノートのページに、撮った名所はポラロイドを貼る。まだの名所は点線のわくに番号だけ
export function renderZukan(view) {
  const b = book(), prefs = [...new Set(PLACES.map(p => p.pref))];
  if (zf.pref !== 'all' && !prefs.includes(zf.pref)) { zf.pref = 'all'; zf.city = 'all'; }
  const inPref = PLACES.filter(p => zf.pref === 'all' || p.pref === zf.pref);
  const cities = zf.pref === 'all' ? [] : [...new Set(inPref.map(cityOf))];
  if (!cities.includes(zf.city)) zf.city = 'all';
  const area = inPref.filter(p => zf.city === 'all' || cityOf(p) === zf.city);
  const got = area.filter(p => cardsOf(p.id).length), allGot = PLACES.filter(p => cardsOf(p.id).length).length;
  const areaName = zf.city !== 'all' ? zf.city : zf.pref !== 'all' ? zf.pref : 'ぜんぶ', rest = area.length - got.length;
  const chip = (k, v, l, on) => `<button data-${k}="${esc(v)}" aria-pressed="${on}">${esc(l)}</button>`;
  const peek = !area.length ? '' : rest === 0 ? `${areaName === 'ぜんぶ' ? 'ぜんぶ' : areaName + 'は'}コンプリート！` : got.length ? `あと${rest}か所で<br>${areaName === 'ぜんぶ' ? 'ぜんぶ' : areaName}コンプ！` : '最初の1枚を<br>撮りに行こう！';
  view.innerHTML = `${zukanHead(`集めた名所 <b>${allGot}</b> / ${PLACES.length} ・ ${b.cards.length} まい`, allGot / PLACES.length)}
    ${zukanTabs('zukan')}
    <div class="filters">
      <div class="chips-row" role="group" aria-label="エリア">${chip('pref', 'all', 'ぜんぶ', zf.pref === 'all')}${prefs.map(x => chip('pref', x, x, zf.pref === x)).join('')}<span class="sep"></span>${chip('got', '1', '集めたものだけ', zf.got)}</div>
      ${cities.length > 1 ? `<div class="chips-row sub" role="group" aria-label="市区町村">${chip('city', 'all', '市区町村ぜんぶ', zf.city === 'all')}${cities.map(x => chip('city', x, x, zf.city === x)).join('')}</div>` : ''}
    </div>
    <section class="nbook"><div class="nb-h"><span class="nb-tag">${esc(areaName)}</span><span class="nb-n">${got.length} / ${area.length}</span></div><div class="shelf"></div>
      ${peek ? `<div class="nb-peek"><p class="bubble">${peek}</p><img src="ui/chara_heart.png" alt=""></div>` : ''}</section>`;
  view.querySelector('.filters').onclick = e => {
    const t = e.target.closest('button'); if (!t) return; const d = t.dataset;
    if (d.pref) { zf.pref = d.pref; zf.city = 'all'; } else if (d.city) zf.city = d.city; else if (d.got) zf.got = !zf.got;
    saveZf(); renderZukan(view);
  };
  const grid = view.querySelector('.shelf');
  // 手に入れた名所を先に（新しく到着した順）、まだの名所はあとに番号順で
  const order = [...got.sort((a, z) => cardsOf(z.id)[0].at.localeCompare(cardsOf(a.id)[0].at)), ...(zf.got ? [] : area.filter(p => !cardsOf(p.id).length))];
  if (!order.length) grid.outerHTML = `<p class="note empty">${zf.got ? 'このエリアで集めたカードはまだありません。' : 'このエリアの名所はありません。'}</p>`;
  order.forEach((p, i) => {
    const cs = cardsOf(p.id);
    if (!cs.length) {
      grid.insertAdjacentHTML('beforeend', `<div class="yetslot" role="img" aria-label="まだ手に入れていないカード No.${esc(p.no)}"><span class="q" aria-hidden="true">?</span><span class="no">${esc(p.no)}</span></div>`);
      return;
    }
    const a = document.createElement('a'); a.href = `#/place/${p.id}`; a.className = 'pola'; a.style.setProperty('--rot', ROT[i % ROT.length] + 'deg'); a.style.setProperty('--tape', TAPE[i % TAPE.length]);
    a.setAttribute('aria-label', `${p.name}のアルバムを開く（${cs.length}まい）`);
    const top = cs.find(c => c.fav) || cs[0];   // お気に入りのカードがあればそれ、なければいちばん新しいカード
    a.append(art(p, top)); if (top.fav) a.insertAdjacentHTML('beforeend', '<span class="favm" aria-hidden="true">★</span>');
    a.insertAdjacentHTML('afterbegin', '<span class="tape" aria-hidden="true"></span>');
    a.insertAdjacentHTML('beforeend', `${cs.length > 1 ? `<span class="cnt">×${cs.length}</span>` : ''}<span class="cap">${esc(p.name)}</span>`);
    grid.append(a);
  });
}

// 名所のページ：上に絵を大きく（カードの中にキャラが立っている）、下から重なるシートに名前・集めたカード・時間と天気のスタンプ
const WICON = { clear: 'sun', cloudy: 'cloud', rain: 'rain', snow: 'snow' };
export function renderPlace(view, id) {
  const p = placeById(id); if (!p) { location.hash = '#/zukan'; return; }
  const all = cardsOf(p.id), cs = shown(p.id), have = new Set(cs.map(c => c.time + '|' + c.weather)),   // cs：お気に入りを先頭にした並び（上の大きな絵は cs[0]）。all：新しい順
        times = TIMES.filter(t => p.times.includes(t));
  const total = times.length * WEATHERS.length, n = times.reduce((s, t) => s + WEATHERS.filter(w => have.has(t + '|' + w)).length, 0);
  const stamps = `<div class="stamps" style="--cols:${times.length}" role="table" aria-label="集めた時間帯と天気">
    <span role="columnheader"></span>${times.map(t => `<span class="th" role="columnheader">${LABEL.time[t]}</span>`).join('')}
    ${WEATHERS.map(w => `<span class="wi" role="rowheader" aria-label="${LABEL.weather[w]}" title="${LABEL.weather[w]}">${icon(WICON[w], 22)}</span>${times.map((t, i) => have.has(t + '|' + w)
      ? `<span class="sp got t-${t}" style="--r:${[-6, 5, -3, 4][i]}deg" role="cell" aria-label="${LABEL.time[t]}・${LABEL.weather[w]} あり">✓</span>`
      : `<span class="sp" role="cell" aria-label="${LABEL.time[t]}・${LABEL.weather[w]} まだ"></span>`).join('')}`).join('')}</div>`;
  const tags = [cityOf(p) === p.city ? p.city : p.city, ...p.categories];
  view.innerHTML = `<div class="pview">
    <div class="pv-hero${cs.length ? '' : ' yet'}">
      <a class="pv-back" href="#/zukan" aria-label="図鑑にもどる">${icon('back', 20)}</a>
      ${cs.length ? `<span class="pv-when">${cs[0].fav ? '★ ' : ''}${LABEL.time[cs[0].time] || ''}・${LABEL.weather[cs[0].weather] || ''}　${fmtDate(cs[0].at, '/').slice(5)}</span>
        <a class="pv-big" href="#/card/${cs[0].id}">${icon('expand', 16)}大きく見る</a>` : '<span class="pv-when">まだ到着していません</span>'}
    </div>
    <section class="pv-sheet">
      <div class="pv-top"><div class="pv-t"><span class="no">No.${esc(p.no)}</span><h1>${esc(p.name)}</h1>
        <div class="pv-tags">${tags.map(t => `<span>${esc(t)}</span>`).join('')}</div></div>
        ${cs.length ? `<a class="pv-stack" href="#/card/${cs[0].id}" aria-label="集めたカード ${cs.length}まい"><span class="n">${cs.length}まい</span></a>` : ''}</div>
      ${p.blurb ? `<p class="note blurb">${esc(p.blurb)}</p>` : ''}
      ${cs.length ? `<div class="lhead"><h2>集めたカード</h2><span class="prog">はじめての到着 ${fmtDate(all.at(-1).at)}</span></div><div class="shelf three"></div>` : ''}
      <div class="lhead"><h2>時間と天気のスタンプ</h2><span class="prog"><b>${n}</b> / ${total}</span></div>
      ${stamps}
      <p class="note tip">ちがう時間帯や天気の日に来ると、ちがうカードが手に入ります。</p>
      ${p.kind === 'photo' ? `<p class="note">仮の写真：${esc(p.photo.author)}（<a href="${esc(p.photo.page)}" target="_blank" rel="noopener">Wikimedia Commons</a>、${esc(p.photo.license)}）</p>` : ''}
    </section></div>`;
  const hero = view.querySelector('.pv-hero');
  if (cs.length) snapshot(p.scene, cs[0]).then(u => hero.prepend(img(u, p.alt)));
  else if (p.kind === 'photo') hero.prepend(img(p.photo.src, ''));
  else if (p.kind === 'plain') hero.prepend(img(PLAIN_BG, ''));
  else snapshot(p.scene, { time: 'day', weather: 'clear' }).then(u => hero.prepend(img(u, '')));
  const stack = view.querySelector('.pv-stack');
  if (stack) cs.slice(0, 3).reverse().forEach((c, i, arr) => snapshot(p.scene, c).then(u => { const im = img(u, ''); im.style.setProperty('--i', arr.length - 1 - i); stack.prepend(im); }));
  const grid = view.querySelector('.shelf');
  cs.forEach((c, i) => {
    const a = document.createElement('a'); a.href = `#/card/${c.id}`; a.className = 'pola sm'; a.style.setProperty('--rot', ROT[i % ROT.length] * .6 + 'deg'); a.setAttribute('aria-label', `${cardNo(p, c)}${c.fav ? '（お気に入り）' : ''} を開く`);
    a.append(art(p, c)); a.insertAdjacentHTML('beforeend', `${c.fav ? '<span class="favm" aria-hidden="true">★</span>' : ''}<span class="cap">${LABEL.time[c.time] || ''}・${LABEL.weather[c.weather] || ''}<br>${fmtDate(c.at, '/').slice(5)}</span>`); grid.append(a);
  });
}

// 1枚のカードを全画面で見る（ストーリーズのような見せ方）
//   カードは画面いっぱい。上にバー（同じ名所のカードの何枚目か）と名前・×、右に縦のボタン（撮影・文字・保存）
//   左右のタップで前後のカード、下へのスワイプで閉じる
//   撮影（2026-11-26 案B「カメラ」）：カードを画面の上につめ、下に暗いすける操作を置く。下から「えらぶ列（絵つき）／ポーズ・表情・光・着替え／位置を戻す・残す（丸いボタン）・保存」
//     左上の × でやめる（変えていたら確かめてから元に戻す）。カードを1回たたくと、操作をかくす・出す
//   preview は デバッグの「試し見」（記録ではない仮のカード）
export function openViewer({ cardId, preview, onClose, posing = false }) {
  const first = preview ? { ...preview, at: new Date().toISOString(), n: 0 } : cardById(cardId);
  const p0 = first && placeById(first.placeId);
  if (!p0) { onClose(); return () => {}; }
  const list = preview ? [first] : cardsOf(p0.id).slice().reverse();   // 古い順
  let idx = Math.max(0, list.findIndex(c => c.id === first.id)), card = first, p = p0, el = null, ph = null, cur = null;   // cur：この撮影の見た目（chara2.js の look。null＝ふだんの見た目）
  const root = document.createElement('div'); root.className = 'viewer story'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
  root.innerHTML = `<div class="bgblur"></div><div class="frame">
      <div class="stage"></div>
      <button class="tap prev" aria-label="前のカード"></button><button class="tap next" aria-label="次のカード"></button>
      <div class="top"><div class="bars"></div><div class="who"><span class="nm"></span><span class="when"></span><button class="x" data-a="close" aria-label="とじる">×</button></div></div>
      <div class="side">
        <button data-a="photo" aria-pressed="false"><i aria-hidden="true">◎</i>撮影</button>
        <button data-a="dress"><i aria-hidden="true">♥</i>着替え</button>
        ${preview ? '' : '<button class="fav" data-a="fav" aria-pressed="false"><i aria-hidden="true">★</i>お気に入り</button>'}
        <button data-a="clean" aria-pressed="false"><i aria-hidden="true">Aa</i>文字</button>
        <button data-a="save"><i aria-hidden="true">↓</i>保存</button>
      </div>
      <div class="camf" hidden>
        <i class="mk tl"></i><i class="mk tr"></i><i class="mk bl"></i><i class="mk br"></i>
        <button class="cx" data-a="quit" aria-label="撮影をやめる">${icon('close', 20)}</button>
        <p class="coach" role="status"><span>${matchMedia('(pointer:fine)').matches ? 'ドラッグで動かす ・ ホイールで大きさ' : '指で動かす ・ 2本指で大きさと角度'}</span></p>
      </div>
    </div>
    <div class="cam" hidden>
      <div class="strip" role="group"></div>
      <div class="modes" role="group" aria-label="えらぶもの">${MODES.map(([k, n]) => `<button data-mode="${k}" aria-pressed="false">${n}</button>`).join('')}<button data-a="dress">着替え</button></div>
      <div class="cbar">
        <button class="sb" data-a="center"><i aria-hidden="true">${icon('undo', 21)}</i>位置を戻す</button>
        <button class="shut" data-a="keep" aria-label="${preview ? '撮影をおわる（試し見なので、カードには残りません）' : 'この配置をカードに残す'}"><span>${preview ? 'OK' : '残す'}</span></button>
        <button class="sb" data-a="save"><i aria-hidden="true">${icon('down', 21)}</i>保存</button>
      </div>
    </div>
    <div class="cflash"></div>`;
  document.body.append(root);
  const stage = root.querySelector('.stage'), cam = root.querySelector('.cam'), camf = root.querySelector('.camf'), strip = cam.querySelector('.strip');
  let turnRaf = 0, mode = 'pose', snap0 = '', env = null, coachT = 0;
  const look = () => (cur ? JSON.parse(JSON.stringify(cur)) : defaultLook());
  // 下の列：ポーズと表情は、いまの見た目のままの小さな絵。光は記号（光・グロー・明るさを1列に並べる）
  const opt = (attr, v, name, inner, cls = '') => `<button class="opt ${cls}" data-${attr}="${v}" aria-pressed="false"><i aria-hidden="true">${inner}</i>${name}</button>`;
  const orbs = (attr, list) => list.map(([v, n, c]) => opt(attr, v, n, `<b class="orb ${c}"></b>`)).join('');
  function fillStrip() {
    strip.setAttribute('aria-label', MODES.find(m => m[0] === mode)[1]);
    cam.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    const row = (k, gl, list, cls) => `<span class="gl">${gl}</span>${list.map(([v, n, c]) => opt(k, v, n, `<b class="orb ${cls} ${c}"></b>`)).join('')}`;
    strip.innerHTML = mode === 'pose' ? '<span class="gl">読みこみ中</span>' : mode === 'face' ? FACES.map(([id, n]) => opt('face', id, n, '<canvas></canvas>', 'face')).join('') : mode === 'turn' ? row('turn', '顔', TURNS, 'turn') : mode === 'lean' ? row('lean', '腰', LEANS, 'lean') : mode === 'wind' ? row('wind', '風', WINDS, 'wind') : mode === 'tilt' ? `<span class="gl">首</span>${TILTS.map(([v, n, c]) => opt('tilt', v, n, `<b class="orb tilt ${c}"></b>`)).join('')}` : `<span class="gl">光</span>${orbs('rim', [[0, '無光', 'r0'], [3, '順光', 'r3'], [1, '半逆光', 'r1'], [2, '逆光', 'r2']])}<span class="gl">グロー</span>${orbs('glow', [[0, 'なし', 'g0'], [1, '弱い', 'g1'], [2, '強い', 'g2']])}<span class="gl">明るさ</span>${orbs('light', [['bright', '明るいまま', 'lb'], ['blend', 'なじませる', 'ln']])}`;
    strip.scrollLeft = 0; paint(); marks();
  }
  function paint() {   // 表情の列：いまの見た目・向き・かしげのまま、顔のあたりの小さな絵
    if (mode === 'pose') {   // ポーズの列：いまの見た目のまま、全身の小さな絵。いまの服で着られるポーズだけ
      loadChara2().then(P => { if (mode !== 'pose') return; const base = { ...fixLook2(P, look()), face: ph.face || undefined, turn: +ph.turn || undefined, tilt: +ph.tilt || undefined }, list = bigPoses(P, base);
        strip.innerHTML = list.length ? list.map(([v, n]) => opt('pose15', v, n, '<canvas></canvas>', 'pose')).join('') : '<span class="gl">この服では、ポーズはまだえらべません</span>';
        strip.querySelectorAll('.opt.pose').forEach(b => drawLook(b.querySelector('canvas'), P, { ...base, pose15: b.dataset.pose15 || undefined }, 'bust')); marks(); }).catch(() => {});
      return;
    }
    if (mode !== 'face') return;
    loadChara2().then(P => { const base = fixLook2(P, look()); strip.querySelectorAll('.opt.face').forEach(b => { const c = b.querySelector('canvas'); if (c) drawLook(c, P, { ...base, face: b.dataset.face || undefined, turn: +ph.turn || undefined, tilt: +ph.tilt || undefined }, 'face'); }); }).catch(() => {});
  }
  const marks = () => {   // えらんでいるものに印
    const on = (sel, f) => strip.querySelectorAll(sel).forEach(b => b.setAttribute('aria-pressed', String(f(b.dataset))));
    on('[data-pose15]', d => d.pose15 === (ph.pose15 || '')); on('[data-face]', d => d.face === (ph.face || '')); on('[data-light]', d => d.light === ph.light);
    on('[data-face]', d => d.face === (ph.face || ''));
    on('[data-tilt]', d => +d.tilt === (+ph.tilt || 0)); on('[data-lean]', d => +d.lean === (+ph.lean || 0)); on('[data-turn]', d => +d.turn === Math.sign(+ph.turn || 0)); on('[data-wind]', d => +d.wind === (+ph.wind || 0));
    on('[data-rim]', d => +d.rim === (ph.rim | 0)); on('[data-glow]', d => +d.glow === (ph.glow | 0));
  };
  const btn = a => root.querySelector(`.side [data-a="${a}"]`);

  function load(i) {
    idx = i; card = list[i]; p = placeById(card.placeId);
    ph = { x: 0, y: 0, s: 1, r: 0, light: 'bright', pose: 0, rim: 0, glow: 0, ...(card.photo || {}) };
    cur = card.look?.rin || card.look?.big ? JSON.parse(JSON.stringify(card.look)) : null;   // この撮影のお着替え。残すまではカードに書かない（前のキャラの見た目のカードは、ふだんの見た目で出る）
    stage.innerHTML = ''; el = cardEl(p, card); stage.append(el);
    if (btn('clean').getAttribute('aria-pressed') === 'true') el.classList.add('clean');
    btn('fav')?.setAttribute('aria-pressed', String(!!card.fav));
    root.setAttribute('aria-label', `${p.name}のカード`);
    root.querySelector('.bars').innerHTML = list.map((_, j) => `<i class="${j < idx ? 'seen' : j === idx ? 'now' : ''}"></i>`).join('');
    root.querySelector('.nm').textContent = p.name;
    root.querySelector('.when').textContent = preview ? '試し見（記録には入りません）' : `${fmtDate(card.at)} ${fmtTime(card.at)}`;
    root.querySelector('.tap.prev').hidden = idx === 0; root.querySelector('.tap.next').hidden = idx === list.length - 1;
    engine.show(el, p.scene, card).then(() => { engine.canvas.setAttribute('role', 'img'); engine.canvas.setAttribute('aria-label', p.alt); });
    if (!preview && location.hash !== `#/card/${card.id}`) history.replaceState(null, '', `#/card/${card.id}`);
    setPosing(false);
  }
  const sync = () => { engine.setState({ ...card, photo: { ...ph }, look: look() }); marks(); };
  const dirty = () => JSON.stringify([ph, cur]) !== snap0;
  function setPosing(on) {
    cam.hidden = camf.hidden = !on; root.classList.toggle('posing', on); root.classList.remove('camhide'); btn('photo').setAttribute('aria-pressed', String(on));
    el?.classList.toggle('posing', on); clearTimeout(coachT);
    if (!on) return;
    snap0 = JSON.stringify([ph, cur]); fillStrip(); sync();   // snap0：入ったときの配置（× でやめたら、ここへ戻す）
    const c = camf.querySelector('.coach'); c.hidden = false; coachT = setTimeout(() => { c.hidden = true; }, 4200);   // 動かし方は、入ったときに数秒だけ出す
    snapshot(p.scene, { ...card, photo: { x: 9 } }).then(u => { root.querySelector('.bgblur').style.backgroundImage = `url("${u}")`; }).catch(() => {});   // カードの外は、景色をぼかした色でうめる
  }

  // 指の操作：撮影中は、一本指でキャラを動かし、二本指で大きさを変える。それ以外は、下へのスワイプで閉じる
  let drag = null, pinch = null; const pts = new Map();
  const pdist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]); };
  const pang = () => { const [a, b] = [...pts.values()]; return Math.atan2(b[1] - a[1], b[0] - a[0]); };
  stage.addEventListener('pointerdown', e => {
    pts.set(e.pointerId, [e.clientX, e.clientY]); try { stage.setPointerCapture(e.pointerId); } catch (err) {}
    if (pts.size === 2 && root.classList.contains('posing')) { pinch = { d: pdist(), a: pang(), s: ph.s, r: ph.r }; drag = null; return; }
    drag = { x: e.clientX, y: e.clientY, px: ph.x, py: ph.y, moved: 0 };
  });
  stage.addEventListener('pointermove', e => {
    if (pts.has(e.pointerId)) pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && pts.size === 2) {   // 二本指：広げる・つまむで大きさ、ひねると角度（画面で右回りにひねると、キャラも右回り）
      ph.s = Math.max(.4, Math.min(6, pinch.s * pdist() / pinch.d)); ph.r = pinch.r - (pang() - pinch.a);
      engine.setState({ ...card, photo: { ...ph }, look: look() }); return;
    }
    if (!drag) return; const r = stage.getBoundingClientRect(), dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.moved = Math.max(drag.moved, Math.hypot(dx, dy));
    if (root.classList.contains('posing')) {
      ph.x = Math.max(-.75, Math.min(.75, drag.px + dx / r.width));   // 左右も少しカードの外へはみ出せる
      ph.y = Math.max(-1.5, Math.min(.5, drag.py - dy / r.height));   // 指の動きどおり。下はカードの外まで
      engine.setState({ ...card, photo: { ...ph }, look: look() });
    } else if (dy > 0) root.style.setProperty('--pull', `${Math.min(dy, 200)}px`);
  });
  const endDrag = e => {
    pts.delete(e.pointerId); if (pts.size < 2) pinch = null;
    if (!drag) return; const dy = e.clientY - drag.y, r = stage.getBoundingClientRect(), moved = drag.moved; drag = null; root.style.removeProperty('--pull');
    if (root.classList.contains('posing')) { if (moved < 8 && !pts.size) root.classList.toggle('camhide'); return; }   // 撮影中：動かさずにたたいたら、操作をかくす・出す
    if (dy > 90) { close(); onClose(); return; }
    if (moved < 10) { const x = (e.clientX - r.left) / r.width; if (x < .3 && idx > 0) load(idx - 1); else if (x > .7 && idx < list.length - 1) load(idx + 1); }
  };
  stage.addEventListener('pointerup', endDrag); stage.addEventListener('pointercancel', e => { pts.delete(e.pointerId); pinch = null; drag = null; root.style.removeProperty('--pull'); });
  // パソコンでは、ホイールで大きさ、Shift＋ホイールで角度を変える
  stage.addEventListener('wheel', e => { if (!root.classList.contains('posing')) return; e.preventDefault();
    if (e.shiftKey) ph.r += (e.deltaY < 0 ? 1 : -1) * .06; else ph.s = Math.max(.4, Math.min(6, ph.s * (e.deltaY < 0 ? 1.08 : 1 / 1.08)));
    engine.setState({ ...card, photo: { ...ph }, look: look() }); }, { passive: false });

  async function saveImage() {
    const src = engine.canvas, k = Math.max(1, Math.round(4 / RS)), c = document.createElement('canvas'); c.width = src.width * k; c.height = src.height * k;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(src, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/png')); const name = `tabiquest-${p.id}-${fmtDate(card.at, '')}.png`;
    const file = new File([blob], name, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: p.name }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  // キー：お着替えの画面が出ている間は何もしない。撮影中の Esc は撮影をやめるだけ、左右のキーは使わない
  const onKey = e => { if (document.querySelector('.dressup')) return; const posingNow = root.classList.contains('posing');
    if (e.key === 'Escape') { if (posingNow) quit(); else { close(); onClose(); } } else if (posingNow) return;
    else if (e.key === 'ArrowLeft' && idx > 0) load(idx - 1); else if (e.key === 'ArrowRight' && idx < list.length - 1) load(idx + 1); };
  const close = () => { document.removeEventListener('keydown', onKey); clearTimeout(coachT); engine.stop(); root.remove(); };
  // 撮影をやめる：変えていたら確かめてから、入ったときの配置に戻す
  function quit() { if (dirty()) { if (!confirm('この配置をやめて、とじますか？')) return; [ph, cur] = JSON.parse(snap0); sync(); } setPosing(false); }
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.classList.contains('tap')) { if (b.classList.contains('prev') && idx > 0) load(idx - 1); else if (b.classList.contains('next') && idx < list.length - 1) load(idx + 1); return; }
    const a = b.dataset.a;
    if (a === 'close') { close(); onClose(); }
    else if (a === 'clean') b.setAttribute('aria-pressed', String(el.classList.toggle('clean')));
    else if (a === 'photo') setPosing(cam.hidden);
    else if (a === 'quit') quit();
    else if (a === 'fav') {   // お気に入り：この名所で1枚だけ。図鑑・名所のページ・一覧で、いちばん上に出るカードになる
      const on = !card.fav; setFav(card.id, on); b.setAttribute('aria-pressed', String(on));
      toast(on ? 'お気に入りにしました。この名所のいちばん上に出ます' : 'お気に入りをはずしました');
    }
    else if (a === 'save') saveImage();
    else if (a === 'dress') {   // この撮影だけのお着替え。カードの画面からひらいたときは、決定でこのカードに残す。撮影の中からひらいたときは、「残す」を押すまで残さない（試し見は残さない）
      const inCam = root.classList.contains('posing'), before = look(), apply = L => { cur = L; sync(); paint(); };
      openDress({ look: before, home: defaultLook(), title: 'お着替え', note: preview ? '試し見なので、残りません' : inCam ? '「残す」を押すと、このカードに残ります' : 'この撮影だけ。ホームのお着替えは変わりません',
        onChange: apply, onSave: L => { apply(L); if (!preview && !inCam) { const k = look(); setPhoto(card.id, card.photo ?? null, k); card.look = k; clearSnaps(); toast('このカードのお着替えを残しました'); } } });
    }
    else if (b.dataset.mode) { mode = b.dataset.mode; fillStrip(); }
    else if (b.dataset.light) { ph.light = b.dataset.light; sync(); }
    else if (b.dataset.rim) { ph.rim = +b.dataset.rim; sync(); }
    else if (b.dataset.glow) { ph.glow = +b.dataset.glow; sync(); }
    else if (b.dataset.face !== undefined) { if (b.dataset.face) ph.face = b.dataset.face; else delete ph.face; sync(); }
    else if (b.dataset.turn !== undefined) {   // 顔の向き：パッと切りかえず、1/8 ずつ ぬるっと動かす（動きを減らす設定のときは、すぐ）
      const to = +b.dataset.turn, from = +ph.turn || 0; cancelAnimationFrame(turnRaf); if (to === from) return;
      if (reduceMotion()) { ph.turn = to; if (!to) delete ph.turn; sync(); paint(); return; }
      const t0 = performance.now(), dur = 260 * Math.abs(to - from);
      const step = t => { const k = Math.min(1, (t - t0) / dur), e = k * k * (3 - 2 * k); ph.turn = Math.round((from + (to - from) * e) * 8) / 8; if (!ph.turn) delete ph.turn; sync(); marks(); if (k < 1) turnRaf = requestAnimationFrame(step); else paint(); };
      turnRaf = requestAnimationFrame(step);
    }
    else if (['tilt', 'turn', 'lean', 'wind'].some(q => b.dataset[q] !== undefined)) { const k = ['tilt', 'turn', 'lean', 'wind'].find(q => b.dataset[q] !== undefined); ph[k] = +b.dataset[k]; if (!ph[k]) delete ph[k]; sync(); paint(); }
    else if (b.dataset.pose15 !== undefined) { if (b.dataset.pose15) ph.pose15 = b.dataset.pose15; else delete ph.pose15; sync(); }
    else if (b.dataset.face !== undefined) { ph.face = b.dataset.face; sync(); }
    else if (a === 'center') { ph.x = 0; ph.y = 0; ph.s = 1; ph.r = 0; sync(); }
    else if (a === 'keep') {   // まん中の丸いボタン：この配置（とお着替え）をカードに残して、撮影をおわる
      if (preview) toast('試し見なので、カードには残りません');
      else { const k = look(); setPhoto(card.id, { ...ph }, k); card.photo = { ...ph }; card.look = k; clearSnaps(); toast('この配置をカードに残しました'); }
      const f = root.querySelector('.cflash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); setPosing(false);
    }
  });
  document.addEventListener('keydown', onKey);
  load(idx);
  if (posing) setPosing(true);
  return close;
}
