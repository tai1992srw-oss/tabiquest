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

export function img(src, alt = '') { const i = new Image(); i.className = 'snap'; i.alt = alt; i.decoding = 'async'; i.src = src; return i; }

let tt;
export function toast(msg, ms = 2400) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), ms); }
