// タイムライン：手に入れたカードを、新しい到着から順に、日ごとにまとめて縦に並べる（#/timeline）
// 旅は毎日あるわけではなく、1日に何か所も回ることもあるので、カレンダーのマスではなく「旅をした日」だけを並べる
import { placeById, LABEL } from './places.js';
import { book } from './store.js';
import { snapshot } from './card.js';
import { img, esc, fmtTime, prefCity } from './ui.js';
import { zukanTabs } from './zukan.js';

const pad = n => String(n).padStart(2, '0');
const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const WD = ['日', '月', '火', '水', '木', '金', '土'];

// 前の旅からの間：「3日ぶり」「2か月ぶり」など
function gap(newer, older) {
  const days = Math.round((new Date(newer.getFullYear(), newer.getMonth(), newer.getDate()) - new Date(older.getFullYear(), older.getMonth(), older.getDate())) / 864e5);
  if (days < 1) return '';
  if (days === 1) return 'つぎの日も';
  if (days < 30) return `${days}日ぶり`;
  if (days < 365) return `${Math.round(days / 30)}か月ぶり`;
  return `${Math.round(days / 365)}年ぶり`;
}

export function renderTimeline(view) {
  const cards = book().cards.slice().sort((a, z) => a.at < z.at ? 1 : -1);   // 新しい順
  const days = [];
  for (const c of cards) { const d = new Date(c.at), k = dayKey(d); if (days.at(-1)?.k !== k) days.push({ k, d, cs: [] }); days.at(-1).cs.push(c); }
  const places = new Set(cards.map(c => c.placeId)).size;
  view.innerHTML = `<div class="phead"><h1>図鑑</h1><span class="prog">${days.length} 日 ・ ${places} か所 ・ ${cards.length} まい</span></div>
    ${zukanTabs('timeline')}
    ${days.length ? '<ol class="tl"></ol>' : '<p class="note empty">まだ到着していません。<br>名所で「到着する」を押すと、ここに旅の記録が並びます。</p>'}`;
  const ol = view.querySelector('.tl'); if (!ol) return;
  let month = '';
  days.forEach((day, i) => {
    const { d, cs } = day, ym = `${d.getFullYear()}年${d.getMonth() + 1}月`;
    if (ym !== month) { month = ym; ol.insertAdjacentHTML('beforeend', `<li class="tl-month">${ym}</li>`); }
    const n = new Set(cs.map(c => c.placeId)).size, g = days[i + 1] ? gap(d, days[i + 1].d) : '';
    const li = document.createElement('li'); li.className = 'tl-day';
    li.innerHTML = `<div class="tl-date"><b>${d.getDate()}</b><span class="${d.getDay() === 0 ? 'sun' : d.getDay() === 6 ? 'sat' : ''}">${WD[d.getDay()]}</span></div>
      <div class="tl-body"><p class="tl-head">${n > 1 ? `この日 ${n} か所` : '1 か所'}${g ? `<span class="gap">${g}</span>` : ''}</p></div>`;
    const body = li.querySelector('.tl-body');
    for (const c of cs.slice().reverse()) {   // 1日の中は、朝から順に
      const p = placeById(c.placeId); if (!p) continue;
      const a = document.createElement('a'); a.href = `#/card/${c.id}`; a.className = 'tile sm'; a.setAttribute('aria-label', `${p.name}のカードを開く`);
      a.innerHTML = `<div class="art"></div><div class="shade"></div><span class="tm">${fmtTime(c.at)}</span>
        <div class="t"><b>${esc(p.name)}</b><small>${LABEL.time[c.time] || ''}・${LABEL.weather[c.weather] || ''} ・ ${esc(prefCity(p))}</small></div><span class="go sub">見る ›</span>`;
      a.dataset.scene = p.scene; a.dataset.id = c.id; body.append(a);
    }
    ol.append(li);
  });
  // 絵は、画面に入ったものから作る（カードが多くても重くならないように）
  const byId = new Map(cards.map(c => [c.id, c]));
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return; io.unobserve(e.target);
    const a = e.target, c = byId.get(a.dataset.id), p = placeById(c.placeId);
    snapshot(a.dataset.scene, c).then(u => a.querySelector('.art').append(img(u, p.alt)));
  }), { rootMargin: '300px' });
  ol.querySelectorAll('a.tile').forEach(a => io.observe(a));
}
