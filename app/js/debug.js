// デバッグモード（くりた専用）。設定画面のバージョン表記を7回タップすると出る
import { PLACES, LABEL } from './places.js';
import { settings, saveSettings, book, dbg, mode } from './store.js';
import { variantNow, esc, toast } from './ui.js';
import { playArrival } from './arrival.js';

const pick = (k, opts) => `<div class="row" data-k="${k}">${opts.map(([v, l]) => `<button data-v="${v}" aria-pressed="${settings[k] === v}">${esc(l)}</button>`).join('')}</div>`;

export function renderDebug(box, refresh) {
  const on = mode() === 'debug', b = book('debug');
  box.className = 'group dbg';
  box.innerHTML = `<h2>デバッグモード</h2>
    <div class="row"><button data-a="toggle" aria-pressed="${on}">${on ? 'オン（デバッグ用の記録を使用中）' : 'オフ（本番の記録を使用中）'}</button></div>
    <p class="note">オンのあいだは、手に入れたものがデバッグ用の記録に入ります。本番の旅の記録には入りません。</p>
    ${on ? `
    <span class="lab">いる場所（位置の上書き）</span>${pick('loc', [['none', '上書きしない'], ...PLACES.map(p => [p.id, p.name]), ['nowhere', 'どこでもない']])}
    <span class="lab">時間帯</span>${pick('time', [['auto', '自動'], ['evening', '夕暮れ'], ['night', '夜']])}
    <span class="lab">天気</span>${pick('weather', [['auto', '自動（晴れ）'], ['clear', '晴れ'], ['rain', '雨'], ['snow', '雪']])}
    <span class="lab">到着演出の再生（記録はしない）</span>
    ${PLACES.map(p => `<div class="line"><span class="nm">${esc(p.name)}</span><button data-play="${p.id}" data-first="1">初めて</button><button data-play="${p.id}" data-first="0">再訪</button></div>`).join('')}
    <span class="lab">カード（いまの時間帯・天気で付与）</span>
    ${PLACES.map(p => { const c = b.cards[p.id]; return `<div class="line"><span class="nm">${esc(p.name)} ${c ? `（${c.visits.length}回・${c.variants.map(v => LABEL.time[v.time] + LABEL.weather[v.weather]).join('、')}）` : '（なし）'}</span><button data-grant="${p.id}">付与</button><button class="danger" data-rm="${p.id}" ${c ? '' : 'disabled'}>消す</button></div>`; }).join('')}
    <span class="lab">アイテム</span>
    ${PLACES.map(p => `<div class="line"><span class="nm">${esc(p.item.name)} ×${b.items[p.item.id] || 0}</span><button data-item="${p.item.id}" data-n="1">+1</button><button data-item="${p.item.id}" data-n="-1">−1</button></div>`).join('')}
    <span class="lab">ポイント（${b.points}pt）</span>
    <div class="row"><button data-pt="100">+100</button><button data-pt="1000">+1000</button><button data-pt="-100">−100</button><button class="danger" data-pt="zero">0にする</button></div>
    <div class="line"><button class="danger" data-a="reset">デバッグの記録を全部消す</button><button data-a="hide">デバッグを隠す</button></div>` : `<div class="row"><button data-a="hide">デバッグを隠す</button></div>`}`;

  box.onclick = async e => {
    const btn = e.target.closest('button'); if (!btn) return;
    const row = btn.closest('.row[data-k]'), d = btn.dataset;
    if (row) { settings[row.dataset.k] = d.v; saveSettings(); return refresh(); }
    if (d.a === 'toggle') { settings.debugOn = !on; saveSettings(); toast(settings.debugOn ? 'デバッグ用の記録に切り替えました' : '本番の記録に戻しました'); return refresh(); }
    if (d.a === 'hide') { settings.debugUnlocked = false; settings.debugOn = false; saveSettings(); toast('デバッグを隠しました'); return refresh(); }
    if (d.a === 'reset') { if (confirm('デバッグ用の記録（カード・アイテム・ポイント）を全部消します。本番の記録は消えません。よろしいですか？')) { dbg.reset(); toast('デバッグの記録を消しました'); refresh(); } return; }
    const P = id => PLACES.find(p => p.id === id);
    if (d.play) { const p = P(d.play), first = d.first === '1', c = b.cards[p.id];
      await playArrival(p, variantNow(p), { first, count: first ? 1 : (c ? c.visits.length + 1 : 2), points: first ? 300 : 10, item: first ? p.item : null }, { onZukan: () => { location.hash = '#/zukan'; } });
      return refresh(); }
    if (d.grant) { const r = dbg.grant(P(d.grant), variantNow(P(d.grant))); toast(r.first ? 'カードを付与しました' : '到着をもう1回記録しました'); return refresh(); }
    if (d.rm) { dbg.removeCard(d.rm); toast('カードを消しました'); return refresh(); }
    if (d.item) { dbg.item(d.item, +d.n); return refresh(); }
    if (d.pt) { dbg.points(d.pt === 'zero' ? null : +d.pt); return refresh(); }
  };
}
