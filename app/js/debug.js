// デバッグモード（くりた専用）。設定画面のバージョン表記を7回つづけてタップすると出る
import { PLACES, LABEL, TIMES, WEATHERS, seasonOf } from './places.js';
import { settings, saveSettings, book, cardsOf, dbg, mode } from './store.js';
import { conditionsAt } from './conditions.js';
import { current } from './geo.js';
import { esc, toast } from './ui.js';
import { playArrival } from './arrival.js';

const pick = (k, opts) => `<div class="row" data-k="${k}">${opts.map(([v, l]) => `<button data-v="${v}" aria-pressed="${settings[k] === v}">${esc(l)}</button>`).join('')}</div>`;
let pv = { place: PLACES[0].id, time: 'evening', weather: 'clear', season: seasonOf() };
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

export function renderDebug(box, refresh) {
  const on = mode() === 'debug', b = book('debug');
  const pp = PLACES.find(p => p.id === pv.place); if (!pp.times.includes(pv.time)) pv.time = pp.times[0];
  box.className = 'group dbg';
  box.innerHTML = `<h2>デバッグモード</h2>
    <div class="row"><button data-a="toggle" aria-pressed="${on}">${on ? 'オン（デバッグ用の記録を使用中）' : 'オフ（本番の記録を使用中）'}</button></div>
    <p class="note">オンのあいだは、手に入れたものがデバッグ用の記録に入ります。本番の旅の記録には入りません。</p>
    ${on ? `
    <span class="lab">いる場所（位置の上書き）</span>
    <select class="sel" data-sel="loc"><option value="none">上書きしない</option>${PLACES.map(p => `<option value="${p.id}" ${settings.loc === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}<option value="nowhere" ${settings.loc === 'nowhere' ? 'selected' : ''}>どこでもない</option></select>
    <span class="lab">到着したときの時間帯（自動＝時刻と日の出・日の入りから）</span>${pick('time', [['auto', '自動'], ...TIMES.map(t => [t, LABEL.time[t]])])}
    <span class="lab">到着したときの季節（自動＝今日の日付から）</span>${pick('season', [['auto', '自動'], ...SEASONS.map(s => [s, LABEL.season[s]])])}
    <span class="lab">到着したときの天気（自動＝Open-Meteo から）</span>${pick('weather', [['auto', '自動'], ...WEATHERS.map(w => [w, LABEL.weather[w]]), ['unknown', '不明']])}
    <span class="lab">到着演出の再生（記録はしない）</span>
    <div class="line"><select class="sel" data-play-place>${PLACES.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select><button data-play="1">初めて</button><button data-play="0">再訪</button></div>
    <span class="lab">試し見（すべての時間帯・天気を見る。記録はしない）</span>
    <div class="line"><select class="sel" data-pv="place">${PLACES.map(p => `<option value="${p.id}" ${pv.place === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
      <select class="sel" data-pv="time">${pp.times.map(t => `<option value="${t}" ${pv.time === t ? 'selected' : ''}>${LABEL.time[t]}</option>`).join('')}</select>
      <select class="sel" data-pv="weather">${WEATHERS.map(w => `<option value="${w}" ${pv.weather === w ? 'selected' : ''}>${LABEL.weather[w]}</option>`).join('')}</select>
      <select class="sel" data-pv="season">${SEASONS.map(s => `<option value="${s}" ${pv.season === s ? 'selected' : ''}>${LABEL.season[s]}</option>`).join('')}</select>
      <button data-a="preview">見る</button></div>
    <span class="lab">スタイル研究（見本の加工を変えて4つ並べて比べる）</span>
    <div class="line"><a class="btn" href="lab/style/">スタイルの比べる場をひらく</a></div>
    <span class="lab">カード（付与＝いまの設定で到着を1回記録）</span>
    ${PLACES.map(p => { const n = cardsOf(p.id, 'debug').length; return `<div class="line"><span class="nm">${esc(p.name)}（${n}まい）</span><button data-grant="${p.id}">付与</button><button class="danger" data-rm="${p.id}" ${n ? '' : 'disabled'}>全部消す</button></div>`; }).join('')}
    <span class="lab">アイテム</span>
    ${PLACES.filter(p => b.items[p.item.id]).map(p => `<div class="line"><span class="nm">${esc(p.item.name)} ×${b.items[p.item.id]}</span><button data-item="${p.item.id}" data-n="1">+1</button><button data-item="${p.item.id}" data-n="-1">−1</button></div>`).join('') || '<p class="note">まだありません（カードを付与するともらえます）</p>'}
    <span class="lab">ポイント（${b.points}pt）</span>
    <div class="row"><button data-pt="100">+100</button><button data-pt="1000">+1000</button><button data-pt="-100">−100</button><button class="danger" data-pt="zero">0にする</button></div>
    <div class="line"><button class="danger" data-a="reset">デバッグの記録を全部消す</button><button data-a="hide">デバッグを隠す</button></div>` : `<div class="row"><button data-a="hide">デバッグを隠す</button></div>`}`;

  box.onchange = e => {
    const s = e.target;
    if (s.dataset.sel) { settings[s.dataset.sel] = s.value; saveSettings(); refresh(); }
    else if (s.dataset.pv) { pv[s.dataset.pv] = s.value; refresh(); }
  };
  box.onclick = async e => {
    const btn = e.target.closest('button'); if (!btn) return;
    const row = btn.closest('.row[data-k]'), d = btn.dataset, P = id => PLACES.find(p => p.id === id);
    if (row) { settings[row.dataset.k] = d.v; saveSettings(); return refresh(); }
    if (d.a === 'toggle') { settings.debugOn = !on; saveSettings(); toast(settings.debugOn ? 'デバッグ用の記録に切り替えました' : '本番の記録に戻しました'); return refresh(); }
    if (d.a === 'hide') { settings.debugUnlocked = false; settings.debugOn = false; saveSettings(); toast('デバッグを隠しました'); return refresh(); }
    if (d.a === 'reset') { if (confirm('デバッグ用の記録（カード・アイテム・ポイント）を全部消します。本番の記録は消えません。よろしいですか？')) { dbg.reset(); toast('デバッグの記録を消しました'); refresh(); } return; }
    if (d.a === 'preview') { location.hash = `#/preview/${pv.place}/${pv.time}/${pv.weather}/${pv.season}`; return; }
    if (d.play) {
      const p = P(box.querySelector('[data-play-place]').value), first = d.play === '1', n = cardsOf(p.id, 'debug').length;
      btn.disabled = true; const v = await conditionsAt(p, current()); btn.disabled = false;
      const card = { ...v, placeId: p.id, at: new Date().toISOString(), n: first ? 1 : n + 1 };
      await playArrival(p, card, { first, count: first ? 1 : n + 1, points: first ? 300 : 10, item: first ? p.item : null }, {});
      return refresh();
    }
    if (d.grant) { btn.disabled = true; const p = P(d.grant), r = dbg.grant(p, await conditionsAt(p, current())); toast(`${r.card.id} を付与しました（${LABEL.time[r.card.time]}・${LABEL.weather[r.card.weather]}）`); return refresh(); }
    if (d.rm) { if (confirm('この名所のデバッグ用のカードを全部消しますか？')) { dbg.removeCards(d.rm); toast('カードを消しました'); refresh(); } return; }
    if (d.item) { dbg.item(d.item, +d.n); return refresh(); }
    if (d.pt) { dbg.points(d.pt === 'zero' ? null : +d.pt); return refresh(); }
  };
}
