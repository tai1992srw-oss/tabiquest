// 画面で共通に使う部品
import { LABEL, CHIP_COLOR, seasonOf } from './places.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmtDate = (iso, sep = '.') => { const d = iso ? new Date(iso) : new Date(); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join(sep); };
export const fmtTime = iso => { const d = new Date(iso); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
export const cardNo = (place, card) => `No.${place.no}${card?.n ? '-' + String(card.n).padStart(3, '0') : ''}`;
export const prefCity = place => `${place.pref} ${place.city.replace(/[^市]*$/, '') || place.city}`;

// カードの枠（絵は engine か img をあとから先頭に入れる）
// card：{ time, weather, season, at, n }（到着ごとのカード、または試し見の仮のカード）
export function cardEl(place, card, { stamp = true, welcome = true } = {}) {
  const el = document.createElement('div'); el.className = 'card' + (place.kind === 'photo' ? ' photo' : '');
  const w = place.welcome, i = w.indexOf('、'), [w1, w2] = i >= 0 ? [w.slice(0, i + 1), w.slice(i + 1)] : ['', w];
  const chips = [[LABEL.time[card.time], CHIP_COLOR.time], [LABEL.weather[card.weather] || '天気不明', CHIP_COLOR.weather], [LABEL.season[card.season || seasonOf(new Date(card.at || Date.now()))], CHIP_COLOR.season]];
  el.innerHTML = `
    <div class="hud top"><span class="pref">${esc(prefCity(place))}</span>${welcome ? `<span class="wel1">${esc(w1)}</span><span class="wel2">${esc(w2)}</span>` : ''}</div>
    ${place.kind === 'plain' ? '<span class="kari" title="この名所の絵はまだです">絵はまだ</span>' : ''}${place.kind === 'photo' ? `<span class="kari" title="ドット絵ができるまでの仮の写真">仮</span><span class="credit">写真：${esc(place.photo.author)}／${esc(place.photo.license)}</span>` : ''}
    ${stamp ? `<div class="stamp" aria-hidden="true"><b>到着</b><small>${fmtDate(card.at)}</small></div>` : ''}
    <div class="hud bot"><div><div class="place">${esc(place.name)}</div><div class="meta">${cardNo(place, card)} ／ ${fmtDate(card.at)}</div></div>
      <div class="chips">${chips.map(([a, c]) => `<span class="chip" style="background:${c}">${esc(a)}</span>`).join('')}</div></div>`;
  return el;
}

// 線のアイコン（24×24、線2px、角丸）。名前は ICONS のキー
const ICONS = {
  home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',
  place: '<path d="M12 21s-6-5.4-6-10a6 6 0 0 1 12 0c0 4.6-6 10-6 10z"/><circle cx="12" cy="11" r="2"/>',
  map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
  book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  locate: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  down: '<path d="M12 4v12M6 11l6 6 6-6M5 20h14"/>', up: '<path d="M12 20V8M6 13l6-6 6 6M5 4h14"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  photo: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.5A3.5 3.5 0 0 0 7 18z"/>',
  rain: '<path d="M7 15h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.5A3.5 3.5 0 0 0 7 15z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
  snow: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
};
export const icon = (k, size = 20) => `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k] || ''}</svg>`;

export function img(src, alt = '') { const i = new Image(); i.className = 'snap'; i.alt = alt; i.decoding = 'async'; i.src = src; return i; }

let tt;
export function toast(msg, ms = 2400) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), ms); }
