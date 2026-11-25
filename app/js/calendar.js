// カレンダー：手に入れたカードを日付ごとに見る（#/calendar/2026-11）
// 日のマスには、その日のカードの小さな絵と枚数を出す。マスを押すと、その日のカードが下に並ぶ
import { placeById } from './places.js';
import { book } from './store.js';
import { snapshot } from './card.js';
import { img, esc, fmtTime } from './ui.js';
import { zukanTabs } from './zukan.js';
import { LABEL } from './places.js';

const pad = n => String(n).padStart(2, '0');
const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function renderCalendar(view, ym) {
  const cards = book().cards.slice().sort((a, z) => a.at < z.at ? -1 : 1);
  const byDay = new Map();
  for (const c of cards) { const k = dayKey(new Date(c.at)); if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(c); }
  // 見る月：指定がなければ、いちばん新しいカードの月（カードがなければ今月）
  const last = cards.length ? new Date(cards.at(-1).at) : new Date();
  let [y, m] = (ym && /^\d{4}-\d{2}$/.test(ym) ? ym.split('-').map(Number) : [last.getFullYear(), last.getMonth() + 1]);
  const first = new Date(y, m - 1, 1), days = new Date(y, m, 0).getDate(), lead = first.getDay();
  const prev = new Date(y, m - 2, 1), next = new Date(y, m, 1);
  const monthCards = cards.filter(c => { const d = new Date(c.at); return d.getFullYear() === y && d.getMonth() === m - 1; });
  const places = new Set(monthCards.map(c => c.placeId)).size;

  view.innerHTML = `<div class="phead"><h1>図鑑</h1><span class="prog">${monthCards.length ? `この月 ${monthCards.length} 回 ・ ${places} か所` : 'この月の到着はまだありません'}</span></div>
    ${zukanTabs('calendar')}
    <div class="calhead"><a class="btn" href="#/calendar/${prev.getFullYear()}-${pad(prev.getMonth() + 1)}" aria-label="前の月">‹</a>
      <span class="ym">${y}年${m}月</span>
      <a class="btn" href="#/calendar/${next.getFullYear()}-${pad(next.getMonth() + 1)}" aria-label="次の月">›</a></div>
    <div class="cal" role="grid" aria-label="${y}年${m}月">
      ${['日', '月', '火', '水', '木', '金', '土'].map((w, i) => `<div class="wd${i === 0 ? ' sun' : i === 6 ? ' sat' : ''}" role="columnheader">${w}</div>`).join('')}
      ${Array.from({ length: lead }, () => '<div class="day empty"></div>').join('')}
      ${Array.from({ length: days }, (_, i) => {
        const d = i + 1, k = `${y}-${pad(m)}-${pad(d)}`, cs = byDay.get(k) || [], wd = (lead + i) % 7, today = k === dayKey(new Date());
        return `<button class="day${cs.length ? ' has' : ''}${today ? ' today' : ''}${wd === 0 ? ' sun' : wd === 6 ? ' sat' : ''}" data-k="${k}" ${cs.length ? '' : 'disabled'}
          aria-label="${m}月${d}日${cs.length ? `、カード${cs.length}まい` : ''}"><span class="d">${d}</span>${cs.length > 1 ? `<span class="n">×${cs.length}</span>` : ''}</button>`;
      }).join('')}
    </div>
    <div class="calday"></div>`;

  // 日のマスに、その日の最初のカードの小さな絵を入れる
  view.querySelectorAll('.day.has').forEach(b => {
    const c = byDay.get(b.dataset.k)[0], p = placeById(c.placeId); if (!p) return;
    snapshot(p.scene, c).then(u => { const i = img(u, ''); i.className = 'thumb'; b.prepend(i); });
  });
  const out = view.querySelector('.calday');
  function showDay(k) {
    view.querySelectorAll('.day').forEach(b => b.classList.toggle('sel', b.dataset.k === k));
    const cs = byDay.get(k) || [], [yy, mm, dd] = k.split('-').map(Number);
    out.innerHTML = `<h2 class="range">${mm}月${dd}日の到着</h2><div class="dayrow"></div>`;
    const g = out.querySelector('.dayrow');
    for (const c of cs) {   // その日のカード：横長の帯で、押すとカードの画面
      const p = placeById(c.placeId); if (!p) continue;
      const a = document.createElement('a'); a.href = `#/card/${c.id}`; a.className = 'tile sm'; a.setAttribute('aria-label', `${p.name}のカードを開く`);
      a.innerHTML = `<div class="art"></div><div class="shade"></div><div class="t"><b>${esc(p.name)}</b><small>${fmtTime(c.at)} ・ ${LABEL.time[c.time] || ''}・${LABEL.weather[c.weather] || ''}</small></div><span class="go sub">見る ›</span>`;
      snapshot(p.scene, c).then(u => a.querySelector('.art').append(img(u, p.alt))); g.append(a);
    }
  }
  view.querySelector('.cal').addEventListener('click', e => { const b = e.target.closest('.day.has'); if (b) { showDay(b.dataset.k); out.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } });
  // 最初は、この月でいちばん新しい到着の日を開いておく
  if (monthCards.length) showDay(dayKey(new Date(monthCards.at(-1).at)));
}
