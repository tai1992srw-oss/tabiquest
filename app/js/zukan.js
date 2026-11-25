// 図鑑：名所ごとのアルバム。カードは到着ごとの1枚で、時間帯や天気をあとから変えることはできない
import { PLACES, placeById, LABEL, TIMES, WEATHERS } from './places.js';
import { book, cardsOf, cardById, setPhoto } from './store.js';
import { engine, snapshot } from './card.js';
import { cardEl, img, esc, fmtDate, fmtTime, cardNo, toast } from './ui.js';

function locked(p) {
  const el = document.createElement('div'); el.className = 'card locked'; el.setAttribute('role', 'img'); el.setAttribute('aria-label', `まだ手に入れていないカード No.${p.no}`);
  el.innerHTML = `<span class="q" aria-hidden="true">？</span><span class="no">No.${esc(p.no)}</span>`; return el;
}
function mini(p, c) { const el = cardEl(p, c); snapshot(p.scene, c).then(u => el.prepend(img(u, p.alt))); return el; }

export function renderZukan(view) {
  const b = book(), got = PLACES.filter(p => cardsOf(p.id).length);
  view.innerHTML = `<h1>図鑑</h1><p class="row"><a class="btn" href="#/goals">★ アチーブメント</a><a class="btn" href="#/calendar">カレンダー</a></p><p class="count">${got.length} / ${PLACES.length} か所 ／ カード ${b.cards.length} まい</p><div class="grid"></div>`;
  const grid = view.querySelector('.grid');
  for (const p of PLACES) {
    const cs = cardsOf(p.id);
    if (!cs.length) { grid.append(locked(p)); continue; }
    const a = document.createElement('a'); a.href = `#/place/${p.id}`; a.className = 'slotlink'; a.setAttribute('aria-label', `${p.name}のアルバムを開く（${cs.length}まい）`);
    a.append(mini(p, cs[0])); if (cs.length > 1) a.insertAdjacentHTML('beforeend', `<span class="badge">×${cs.length}</span>`);
    grid.append(a);
  }
}

// 名所のアルバム
export function renderPlace(view, id) {
  const p = placeById(id); if (!p) { location.hash = '#/zukan'; return; }
  const cs = cardsOf(p.id), have = new Set(cs.map(c => c.time + '|' + c.weather));
  const tbl = `<table class="combo" aria-label="集めた時間帯と天気"><tr><th></th>${WEATHERS.map(w => `<th>${LABEL.weather[w]}</th>`).join('')}</tr>
    ${TIMES.filter(t => p.times.includes(t)).map(t => `<tr><th>${LABEL.time[t]}</th>${WEATHERS.map(w => `<td>${have.has(t + '|' + w) ? '<span class="got" aria-label="あり">●</span>' : '<span class="no" aria-label="なし">・</span>'}</td>`).join('')}</tr>`).join('')}</table>`;
  view.innerHTML = `<p><a class="back" href="#/zukan">← 図鑑</a></p>
    <h1>${esc(p.name)}</h1><p class="lead">No.${esc(p.no)} ／ ${esc(p.pref)} ${esc(p.city)} ／ ${p.categories.map(esc).join('・')}</p>
    ${p.blurb ? `<p class="note">${esc(p.blurb)}</p>` : ''}
    <div class="group"><h2>集めた時間帯と天気</h2>${tbl}<p class="note">${cs.length ? `はじめての到着 ${fmtDate(cs.at(-1).at)} ／ カード ${cs.length} まい` : 'まだ到着していません'}</p></div>
    <div class="grid three"></div>
    ${p.kind === 'photo' ? `<p class="note">仮の写真：${esc(p.photo.author)}（<a href="${esc(p.photo.page)}" target="_blank" rel="noopener">Wikimedia Commons</a>、${esc(p.photo.license)}）</p>` : ''}`;
  const grid = view.querySelector('.grid');
  if (!cs.length) grid.append(locked(p));
  for (const c of cs) { const a = document.createElement('a'); a.href = `#/card/${c.id}`; a.setAttribute('aria-label', `${cardNo(p, c)} を開く`); a.append(mini(p, c)); grid.append(a); }
}

// 1枚のカードを全画面で見る（ストーリーズのような見せ方）
//   カードは画面いっぱい。上にバー（同じ名所のカードの何枚目か）と名前・×、右に縦のボタン（撮影・文字・保存）
//   左右のタップで前後のカード、下へのスワイプで閉じる。撮影の操作はカードの上に重なるシート
//   preview は デバッグの「試し見」（記録ではない仮のカード）
export function openViewer({ cardId, preview, onClose, posing = false }) {
  const first = preview ? { ...preview, at: new Date().toISOString(), n: 0 } : cardById(cardId);
  const p0 = first && placeById(first.placeId);
  if (!p0) { onClose(); return () => {}; }
  const list = preview ? [first] : cardsOf(p0.id).slice().reverse();   // 古い順
  let idx = Math.max(0, list.findIndex(c => c.id === first.id)), card = first, p = p0, el = null, ph = null;
  const root = document.createElement('div'); root.className = 'viewer story'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
  root.innerHTML = `<div class="frame">
      <div class="stage"></div>
      <button class="tap prev" aria-label="前のカード"></button><button class="tap next" aria-label="次のカード"></button>
      <div class="top"><div class="bars"></div><div class="who"><span class="nm"></span><span class="when"></span><button class="x" data-a="close" aria-label="とじる">×</button></div></div>
      <div class="side">
        <button data-a="photo" aria-pressed="false"><i aria-hidden="true">◎</i>撮影</button>
        <button data-a="clean" aria-pressed="false"><i aria-hidden="true">Aa</i>文字</button>
        <button data-a="save"><i aria-hidden="true">↓</i>保存</button>
      </div>
      <div class="sheet" hidden>
        <p class="hint">指でなぞると動く（下へはみ出せます）。二本指で広げる・つまむと大きさ、ひねると角度が変わります</p>
        <div class="seg" role="group" aria-label="キャラの明るさ"><span class="lab">明るさ</span><button data-light="bright">明るいまま</button><button data-light="blend">景色になじませる</button></div>
        <div class="seg" role="group" aria-label="ポーズ"><span class="lab">ポーズ</span><button data-pose="0">立ち</button><button data-pose="1">喜び</button></div>
        <div class="seg"><button data-a="center">元に戻す</button>${preview ? '' : '<button class="primary" data-a="keep">この配置を残す</button>'}<button data-a="photo">とじる</button></div>
      </div>
    </div>`;
  document.body.append(root);
  const stage = root.querySelector('.stage'), sheet = root.querySelector('.sheet');
  const btn = a => root.querySelector(`.side [data-a="${a}"]`);

  function load(i) {
    idx = i; card = list[i]; p = placeById(card.placeId);
    ph = { x: 0, y: 0, s: 1, r: 0, light: 'bright', pose: 0, ...(card.photo || {}) };
    stage.innerHTML = ''; el = cardEl(p, card); stage.append(el);
    if (btn('clean').getAttribute('aria-pressed') === 'true') el.classList.add('clean');
    root.setAttribute('aria-label', `${p.name}のカード`);
    root.querySelector('.bars').innerHTML = list.map((_, j) => `<i class="${j < idx ? 'seen' : j === idx ? 'now' : ''}"></i>`).join('');
    root.querySelector('.nm').textContent = p.name;
    root.querySelector('.when').textContent = preview ? '試し見（記録には入りません）' : `${fmtDate(card.at)} ${fmtTime(card.at)}`;
    root.querySelector('.tap.prev').hidden = idx === 0; root.querySelector('.tap.next').hidden = idx === list.length - 1;
    engine.show(el, p.scene, card).then(() => { engine.canvas.setAttribute('role', 'img'); engine.canvas.setAttribute('aria-label', p.alt); });
    if (!preview && location.hash !== `#/card/${card.id}`) history.replaceState(null, '', `#/card/${card.id}`);
    setPosing(false);
  }
  const sync = () => {
    engine.setState({ ...card, photo: { ...ph } });
    sheet.querySelectorAll('[data-light]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.light === ph.light)));
    sheet.querySelectorAll('[data-pose]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.pose === ph.pose)));
  };
  function setPosing(on) {
    sheet.hidden = !on; root.classList.toggle('posing', on); btn('photo').setAttribute('aria-pressed', String(on));
    el?.classList.toggle('posing', on); if (on) sync();
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
      engine.setState({ ...card, photo: { ...ph } }); return;
    }
    if (!drag) return; const r = stage.getBoundingClientRect(), dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.moved = Math.max(drag.moved, Math.hypot(dx, dy));
    if (root.classList.contains('posing')) {
      ph.x = Math.max(-.75, Math.min(.75, drag.px + dx / r.width));   // 左右も少しカードの外へはみ出せる
      ph.y = Math.max(-1.5, Math.min(.5, drag.py - dy / r.height));   // 指の動きどおり。下はカードの外まで
      engine.setState({ ...card, photo: { ...ph } });
    } else if (dy > 0) root.style.setProperty('--pull', `${Math.min(dy, 200)}px`);
  });
  const endDrag = e => {
    pts.delete(e.pointerId); if (pts.size < 2) pinch = null;
    if (!drag) return; const dy = e.clientY - drag.y, r = stage.getBoundingClientRect(), moved = drag.moved; drag = null; root.style.removeProperty('--pull');
    if (root.classList.contains('posing')) return;
    if (dy > 90) { close(); onClose(); return; }
    if (moved < 10) { const x = (e.clientX - r.left) / r.width; if (x < .3 && idx > 0) load(idx - 1); else if (x > .7 && idx < list.length - 1) load(idx + 1); }
  };
  stage.addEventListener('pointerup', endDrag); stage.addEventListener('pointercancel', e => { pts.delete(e.pointerId); pinch = null; drag = null; root.style.removeProperty('--pull'); });
  // パソコンでは、ホイールで大きさ、Shift＋ホイールで角度を変える
  stage.addEventListener('wheel', e => { if (!root.classList.contains('posing')) return; e.preventDefault();
    if (e.shiftKey) ph.r += (e.deltaY < 0 ? 1 : -1) * .06; else ph.s = Math.max(.4, Math.min(6, ph.s * (e.deltaY < 0 ? 1.08 : 1 / 1.08)));
    engine.setState({ ...card, photo: { ...ph } }); }, { passive: false });

  async function saveImage() {
    const src = engine.canvas, k = 4, c = document.createElement('canvas'); c.width = src.width * k; c.height = src.height * k;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(src, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/png')); const name = `tabiquest-${p.id}-${fmtDate(card.at, '')}.png`;
    const file = new File([blob], name, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: p.name }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const onKey = e => { if (e.key === 'Escape') { close(); onClose(); } else if (e.key === 'ArrowLeft' && idx > 0) load(idx - 1); else if (e.key === 'ArrowRight' && idx < list.length - 1) load(idx + 1); };
  const close = () => { document.removeEventListener('keydown', onKey); engine.stop(); root.remove(); };
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.classList.contains('tap')) { if (b.classList.contains('prev') && idx > 0) load(idx - 1); else if (b.classList.contains('next') && idx < list.length - 1) load(idx + 1); return; }
    const a = b.dataset.a;
    if (a === 'close') { close(); onClose(); }
    else if (a === 'clean') b.setAttribute('aria-pressed', String(el.classList.toggle('clean')));
    else if (a === 'photo') setPosing(sheet.hidden);
    else if (a === 'save') saveImage();
    else if (b.dataset.light) { ph.light = b.dataset.light; sync(); }
    else if (b.dataset.pose) { ph.pose = +b.dataset.pose; sync(); }
    else if (a === 'center') { ph.x = 0; ph.y = 0; ph.s = 1; ph.r = 0; sync(); }
    else if (a === 'keep') { setPhoto(card.id, { ...ph }); card.photo = { ...ph }; toast('この配置をカードに残しました'); setPosing(false); }
  });
  document.addEventListener('keydown', onKey);
  load(idx);
  if (posing) setPosing(true);
  return close;
}
