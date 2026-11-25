// 画面で共通に使う部品
import { LABEL, CHIP_COLOR, seasonOf } from './places.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmtDate = (iso, sep = '.') => { const d = iso ? new Date(iso) : new Date(); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join(sep); };
export const fmtTime = iso => { const d = new Date(iso); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
export const cardNo = (place, card) => `No.${place.no}${card?.n ? '-' + String(card.n).padStart(3, '0') : ''}`;
export const prefCity = place => `${place.pref} ${place.city.replace(/[^市]*$/, '') || place.city}`;

// 題字（「ようこそ、○○へ！」）：名前を大きく、段ちがいに折って絵の手前に出す
// 折り方：名所に title.lines があればそれ、なければ言葉の切れ目で自動（〜4文字は1行、〜8文字は2行、それより長ければ3行）
// 大きさ・位置の単位は cqw（カードの幅の100分の1）。名所ごとに title.size / x / top で決め打ちもできる
const seg = (() => { try { return new Intl.Segmenter('ja', { granularity: 'word' }); } catch (e) { return null; } })();
const KATA = /^[゠-ヿ]+$/, HIRA = /^[぀-ゟ]+$/, TAIL = '城寺社宮園山島湖駅前橋堤里村街港台谷川丘群屋門坂浜池岳峠滝塔館町通';
const FIXED_LINES = { '首都圏外郭放水路': '首都圏/外郭放水路', '東武動物公園': '東武/動物公園' };   // 自動ではうまく折れない名前
const wide = t => [...t].reduce((n, c) => n + (c.charCodeAt(0) < 0x2000 ? .6 : 1), 0);   // 半角は 0.6 文字ぶん
export function titleLines(place) {
  const m = (place.welcome || '').match(/^ようこそ、(.+)へ！$/);
  let name = m ? m[1] : place.name, sub = '';
  const pm = name.match(/^(.+?)（(.+)）$/); if (pm) { name = pm[1]; sub = pm[2]; }   // （ ）の中は小さく下に出す
  if (place.title?.lines) return { lines: place.title.lines, sub };
  if (FIXED_LINES[name]) return { lines: FIXED_LINES[name].split('/'), sub };
  const units = name.split(/[\s　・]+/).filter(Boolean).flatMap(part => {
    let ws = seg ? [...seg.segment(part)].map(x => x.segment) : [part];
    // カタカナどうし・ひらがなどうしは、7文字までなら1つの言葉としてつなぐ（シー＋パラダイス、ゆう＋えん＋ち）
    ws = ws.reduce((a, w) => { const p = a.at(-1), same = p && ((KATA.test(p) && KATA.test(w)) || (HIRA.test(p) && HIRA.test(w) && p !== 'の' && w !== 'の'));
      if (same && [...p + w].length <= 7) a[a.length - 1] += w; else a.push(w); return a; }, []);
    // 1文字だけの切れはし：続いていればまとめる（阿＋夫＋利）。1つだけなら、「城・寺・山・の」などは前に、それ以外（東・皇・お）は後ろにつなぐ
    ws = ws.reduce((a, w) => { const p = a.at(-1); if (p && p.one && [...w].length === 1) { p.t += w; p.run = true; } else a.push({ t: w, one: [...w].length === 1 }); return a; }, []);
    const out = [];
    ws.forEach((u, i) => {
      if (!u.one || u.run) return void out.push(u.t);
      if (out.length && (TAIL.includes(u.t) || HIRA.test(u.t) || i === ws.length - 1)) out[out.length - 1] += u.t;
      else if (ws[i + 1]) ws[i + 1] = { ...ws[i + 1], t: u.t + ws[i + 1].t, one: false };
      else out.push(u.t);
    });
    return out;
  });
  const n = wide(units.join('')), k = Math.min(units.length, n <= 4 ? 1 : n <= 8 ? 2 : 3);
  let best = null;
  const walk = (i, acc) => {   // 行の分け方をぜんぶ試して、いちばん長い行が短いもの（同じなら最後の行が短いもの）を選ぶ
    if (acc.length === k - 1) {
      const ls = [...acc, units.slice(i).join('')], sc = Math.max(...ls.map(wide)) * 100 + wide(ls.at(-1));
      if (!best || sc < best.sc) best = { ls, sc }; return;
    }
    for (let j = i + 1; j <= units.length - (k - 1 - acc.length); j++) walk(j, [...acc, units.slice(i, j).join('')]);
  };
  walk(0, []);
  return { lines: best.ls, sub };
}
const HE = 14.5, STEP = .46;   // 「へ！」の幅、段ちがいの1段ぶん（文字の大きさに対して）
function titleHTML(place) {
  const T = place.title || {}, label = esc(place.welcome);
  if (T.tate) {   // たて書きで主役の両わきに置く（東京タワーなど、主役がまん中に立つ絵）
    return `<h2 class="ttl tate" style="--ty:${T.top}cqw" aria-label="${label}"><span class="yk" style="left:${T.yk[0]}cqw;top:${T.yk[1]}cqw">ようこそ、</span>
      ${T.tate.map(([t, x, size], i) => `<span class="col" style="left:${x}cqw;font-size:${size}cqw;--i:${i}">${esc(t)}</span>`).join('')}<span class="he" style="left:${T.he[0]}cqw;top:${T.he[1]}cqw">へ！</span></h2>`;
  }
  const { lines, sub } = titleLines(place), k = lines.length, last = k - 1;
  const size = T.size || Math.min(k === 1 ? 26 : 21.5, ...lines.map((l, i) => (88 - (i === last ? HE : 0)) / (wide(l) * .975 + STEP * i)));
  const w = lines.map((l, i) => STEP * i * size + wide(l) * .975 * size + (i === last ? HE : 0));
  const left = Math.max(6, (100 - Math.max(...w)) / 2), x = T.x || lines.map((l, i) => left + STEP * i * size);
  const r = v => Math.round(v * 10) / 10;
  return `<h2 class="ttl" style="--ts:${r(size)}cqw${T.top ? `;--ty:${T.top}cqw` : ''}" aria-label="${label}"><span class="yk" style="left:${r(x[0] + .5)}cqw">ようこそ、</span>
    ${lines.map((l, i) => `<span class="ln" style="padding-left:${r(x[i])}cqw;--i:${i}">${esc(l)}${i === last ? '<span class="he">へ！</span>' : ''}</span>`).join('')}
    ${sub ? `<span class="sub" style="padding-left:${r(x[last] + .5)}cqw">${esc(sub)}</span>` : ''}</h2>`;
}

// カードの枠（絵は engine か img をあとから先頭に入れる）
// card：{ time, weather, season, at, n }（到着ごとのカード、または試し見の仮のカード）
// 上：県・市と番号の細い行、その下に題字。下：名所の名前・番号・日付と、時間帯・天気・季節
export function cardEl(place, card, { welcome = true } = {}) {
  const el = document.createElement('div'); el.className = 'card' + (place.kind === 'photo' ? ' photo' : '');
  const chips = [[LABEL.time[card.time], CHIP_COLOR.time], [LABEL.weather[card.weather] || '天気不明', CHIP_COLOR.weather], [LABEL.season[card.season || seasonOf(new Date(card.at || Date.now()))], CHIP_COLOR.season]];
  const kari = place.kind === 'plain' ? '<span class="kari" title="この名所の絵はまだです">絵はまだ</span>' : place.kind === 'photo' ? '<span class="kari" title="ドット絵ができるまでの仮の写真">仮</span>' : '';
  el.innerHTML = `
    <div class="hud top ${['evening', 'night'].includes(card.time) ? 't-dark' : 't-bright'}">${welcome ? `<div class="cap"><span class="pref">${esc(prefCity(place))}</span>${kari}<i></i><span class="no">No.${esc(place.no)}</span></div>${titleHTML(place)}` : ''}</div>
    ${place.kind === 'photo' ? `<span class="credit">写真：${esc(place.photo.author)}／${esc(place.photo.license)}</span>` : ''}
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
  hanger: '<path d="M10 6a2 2 0 1 1 3 1.7c-.6.4-1 .8-1 1.5V10"/><path d="M12 10l-9 7h18z"/>',
  gift: '<rect x="3" y="9" width="18" height="12" rx="2"/><path d="M3 13h18M12 9v12M12 9c-2-4-6-4-6-1s6 1 6 1c2-4 6-4 6-1s-6 1-6 1"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>', undo: '<path d="M5 9h9.5a5 5 0 0 1 0 10H9"/><path d="M8.5 5.5L5 9l3.5 3.5"/>',
};
export const icon = (k, size = 20) => `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k] || ''}</svg>`;

export function img(src, alt = '') { const i = new Image(); i.className = 'snap'; i.alt = alt; i.decoding = 'async'; i.src = src; return i; }

let tt;
export function toast(msg, ms = 2400) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), ms); }
