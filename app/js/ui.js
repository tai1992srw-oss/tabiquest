// 画面で共通に使う部品
import { LABEL, CHIP_COLOR, seasonOf, timeOf } from './places.js';
import { settings, mode } from './store.js';
import { current } from './geo.js';

export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmtDate = (iso, sep = '.') => { const d = iso ? new Date(iso) : new Date(); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join(sep); };

// いまの時間帯・天気・季節（デバッグでは手動で選べる）
export function variantNow(place) {
  const dbg = mode() === 'debug';
  const time = dbg && settings.time !== 'auto' && place.times.includes(settings.time) ? settings.time : timeOf(place);
  // 天気の取得はまだ入れていないので、本番はいつも晴れ
  const weather = dbg && settings.weather !== 'auto' ? settings.weather : 'clear';
  const pos = current();
  return { time, weather, season: seasonOf(), lat: pos?.lat ?? null, lng: pos?.lng ?? null };
}

// カードの枠（絵は engine か img をあとから先頭に入れる）
export function cardEl(place, v, { at, stamp = true, welcome = true } = {}) {
  const el = document.createElement('div'); el.className = 'card';
  const [w1, w2] = place.welcome.includes('、') ? [place.welcome.split('、')[0] + '、', place.welcome.split('、').slice(1).join('、')] : ['', place.welcome];
  const chips = [[LABEL.time[v.time], CHIP_COLOR.time], [LABEL.weather[v.weather], CHIP_COLOR.weather], [LABEL.season[v.season || seasonOf()], CHIP_COLOR.season]];
  el.innerHTML = `
    <div class="hud top"><span class="pref">${esc(place.pref)} ${esc(place.city.replace(/[^市]*$/, '') || place.city)}</span>${welcome ? `<span class="wel1">${esc(w1)}</span><span class="wel2">${esc(w2)}</span>` : ''}</div>
    ${stamp ? `<div class="stamp" aria-hidden="true"><b>到着</b><small>${fmtDate(at)}</small></div>` : ''}
    <div class="hud bot"><div><div class="place">${esc(place.name)}</div><div class="meta">No.${esc(place.no)} ／ ${fmtDate(at)}</div></div>
      <div class="chips">${chips.map(([a, c]) => `<span class="chip" style="background:${c}">${esc(a)}</span>`).join('')}</div></div>`;
  return el;
}

export function img(src, alt = '') { const i = new Image(); i.className = 'snap'; i.alt = alt; i.decoding = 'async'; i.src = src; return i; }

let tt;
export function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 2200); }
