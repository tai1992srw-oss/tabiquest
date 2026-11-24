// 図鑑：手に入れたカードを並べて眺める。開くと動くドット絵を全画面で見られる
import { PLACES, placeById, LABEL } from './places.js';
import { book, mode } from './store.js';
import { engine, snapshot } from './card.js';
import { cardEl, img, esc, fmtDate } from './ui.js';

export function renderZukan(view) {
  const b = book(), got = PLACES.filter(p => b.cards[p.id]);
  view.innerHTML = `<h1>図鑑</h1><p class="count">${got.length} / ${PLACES.length} まい</p><div class="grid"></div>`;
  const grid = view.querySelector('.grid');
  for (const p of PLACES) {
    const c = b.cards[p.id];
    if (!c) {
      const el = document.createElement('div'); el.className = 'card locked'; el.setAttribute('role', 'img'); el.setAttribute('aria-label', `まだ手に入れていないカード No.${p.no}`);
      el.innerHTML = `<span class="q" aria-hidden="true">？</span><span class="no">No.${esc(p.no)}</span>`; grid.append(el); continue;
    }
    const v = c.variants[0], a = document.createElement('a'); a.href = `#/card/${p.id}`; a.setAttribute('aria-label', `${p.name}のカードを開く`);
    const el = cardEl(p, v, { at: c.first }); a.append(el); grid.append(a);
    snapshot(p.scene, v).then(u => el.prepend(img(u, p.alt)));
  }
}

export function openViewer(id, { onClose }) {
  const p = placeById(id), c = book().cards[id];
  if (!p || !c) { onClose(); return () => {}; }
  // デバッグでは、まだ手に入れていない時間帯・天気も見られる
  const vars = mode() === 'debug' ? p.times.flatMap(time => p.weathers.map(weather => ({ time, weather, season: c.variants[0].season, at: c.first }))) : c.variants;
  let vi = 0;
  const root = document.createElement('div'); root.className = 'viewer'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', `${p.name}のカード`);
  const slot = document.createElement('div'); slot.className = 'slot'; root.append(slot);
  const info = document.createElement('p'); info.className = 'info';
  info.textContent = `はじめての到着 ${fmtDate(c.first)} ／ 到着 ${c.visits.length}回`;
  const ctl = document.createElement('div'); ctl.style.display = 'contents';
  ctl.innerHTML = `${vars.length > 1 ? `<div class="row vars" role="group" aria-label="時間帯と天気">${vars.map((v, i) => `<button data-i="${i}">${LABEL.time[v.time]}・${LABEL.weather[v.weather]}</button>`).join('')}</div>` : ''}
    <div class="row"><button data-a="clean" aria-pressed="false">文字を隠す</button><button data-a="close">もどる</button></div>`;
  root.append(info, ctl);
  document.body.append(root);

  function show() {
    const v = vars[vi], el = cardEl(p, v, { at: v.at || c.first });
    if (slot.firstChild?.classList.contains('clean')) el.classList.add('clean');
    slot.replaceChildren(el);
    engine.show(el, p.scene, v).then(() => { engine.canvas.setAttribute('role', 'img'); engine.canvas.setAttribute('aria-label', p.alt); });
    ctl.querySelectorAll('[data-i]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.i === vi)));
  }
  show();
  const close = () => { document.removeEventListener('keydown', onKey); engine.stop(); root.remove(); };
  ctl.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.i) { vi = +b.dataset.i; show(); }
    else if (b.dataset.a === 'clean') { const on = slot.firstChild.classList.toggle('clean'); b.setAttribute('aria-pressed', String(on)); }
    else if (b.dataset.a === 'close') { close(); onClose(); }
  });
  const onKey = e => { if (e.key === 'Escape') { close(); onClose(); } };
  document.addEventListener('keydown', onKey);
  return close;
}
