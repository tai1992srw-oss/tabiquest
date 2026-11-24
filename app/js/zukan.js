// 図鑑：名所ごとのアルバム。カードは到着ごとの1枚で、時間帯や天気をあとから変えることはできない
import { PLACES, placeById, LABEL, TIMES, WEATHERS } from './places.js';
import { book, cardsOf, cardById } from './store.js';
import { engine, snapshot } from './card.js';
import { cardEl, img, esc, fmtDate, fmtTime, cardNo } from './ui.js';

function locked(p) {
  const el = document.createElement('div'); el.className = 'card locked'; el.setAttribute('role', 'img'); el.setAttribute('aria-label', `まだ手に入れていないカード No.${p.no}`);
  el.innerHTML = `<span class="q" aria-hidden="true">？</span><span class="no">No.${esc(p.no)}</span>`; return el;
}
function mini(p, c) { const el = cardEl(p, c); snapshot(p.scene, c).then(u => el.prepend(img(u, p.alt))); return el; }

export function renderZukan(view) {
  const b = book(), got = PLACES.filter(p => cardsOf(p.id).length);
  view.innerHTML = `<h1>図鑑</h1><p class="row"><a class="btn" href="#/goals">★ アチーブメント</a></p><p class="count">${got.length} / ${PLACES.length} か所 ／ カード ${b.cards.length} まい</p><div class="grid"></div>`;
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

// 1枚のカードを全画面で見る。preview は デバッグの「試し見」（記録ではない仮のカード）
export function openViewer({ cardId, preview, onClose }) {
  const card = preview ? { ...preview, at: new Date().toISOString(), n: 0 } : cardById(cardId);
  const p = card && placeById(card.placeId);
  if (!p) { onClose(); return () => {}; }
  const root = document.createElement('div'); root.className = 'viewer'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', `${p.name}のカード`);
  const slot = document.createElement('div'); slot.className = 'slot'; root.append(slot);
  const el = cardEl(p, card); slot.append(el);
  const src = String(card.weatherSrc || ''), wsrc = src.startsWith('open-meteo') ? '天気は Open-Meteo から自動で取得' : src === 'debug' ? '天気はデバッグで指定' : src === 'none' ? '天気は取れませんでした' : '';
  const info = preview ? '試し見（デバッグ）：記録には入りません' : `${cardNo(p, card)} ／ ${fmtDate(card.at)} ${fmtTime(card.at)} に到着${wsrc ? ' ／ ' + wsrc : ''}${card.timeReal && card.timeReal !== card.time ? ` ／ 本当の時間帯は「${LABEL.time[card.timeReal]}」（その絵がまだないため${LABEL.time[card.time]}で表示）` : ''}`;
  root.insertAdjacentHTML('beforeend', `<p class="info">${esc(info)}</p><div class="row"><button data-a="clean" aria-pressed="false">文字を隠す</button><button data-a="close">もどる</button></div>`);
  document.body.append(root);
  engine.show(el, p.scene, card).then(() => { engine.canvas.setAttribute('role', 'img'); engine.canvas.setAttribute('aria-label', p.alt); });
  const onKey = e => { if (e.key === 'Escape') { close(); onClose(); } };
  const close = () => { document.removeEventListener('keydown', onKey); engine.stop(); root.remove(); };
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.a === 'clean') b.setAttribute('aria-pressed', String(el.classList.toggle('clean')));
    else if (b.dataset.a === 'close') { close(); onClose(); }
  });
  document.addEventListener('keydown', onKey);
  return close;
}
