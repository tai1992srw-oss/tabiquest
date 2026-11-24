// アチーブメント：記録から自動で数えて、達成したら称号とポイントがもらえる
import { PLACES, placeById, CATEGORIES } from './places.js';
import { book, markGoal } from './store.js';
import { esc, fmtDate, toast } from './ui.js';

const dayKey = iso => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

// 記録から数える材料
function stats(b) {
  const cs = b.cards, places = new Set(cs.map(c => c.placeId)), P = [...places].map(placeById).filter(Boolean);
  const byPref = {}, byCat = {}, perPlace = {}, perDay = {};
  for (const p of P) { byPref[p.pref] = (byPref[p.pref] || 0) + 1; for (const c of p.categories) byCat[c] = (byCat[c] || 0) + 1; }
  for (const c of cs) { perPlace[c.placeId] = (perPlace[c.placeId] || 0) + 1; const k = dayKey(c.at); (perDay[k] ||= new Set()).add(c.placeId); }
  const count = f => cs.filter(f).length;
  return { cards: cs.length, places: places.size, prefs: Object.keys(byPref).length, byPref, byCat,
    maxSame: Math.max(0, ...Object.values(perPlace)), maxDay: Math.max(0, ...Object.values(perDay).map(s => s.size)),
    time: t => count(c => c.time === t || c.timeReal === t), weather: w => count(c => c.weather === w), seasons: new Set(cs.map(c => c.season).filter(Boolean)).size };
}

// 目標の一覧。n：目標の数、get：いまの数、pts：もらえるポイント、title：称号
const CAT_TITLE = { '神社・寺': 'おまいり上手', '城・史跡': '歴史さんぽ', '自然・絶景': '絶景ハンター', '街並み・港': '街あるき名人', '夜景': '夜景ずき', '温泉': '湯めぐり', '食・市場': '食いしんぼう', 'テーマパーク・施設': 'あそびの達人' };
export function goalList() {
  const L = [
    { id: 'first', name: 'はじめての到着', desc: '名所に1回到着する', n: 1, get: s => s.cards, pts: 50, title: '旅のはじまり' },
    { id: 'places-3', name: '3か所めぐり', desc: 'ちがう名所に3か所到着する', n: 3, get: s => s.places, pts: 100, title: 'みならい旅人' },
    { id: 'places-5', name: '5か所めぐり', desc: 'ちがう名所に5か所到着する', n: 5, get: s => s.places, pts: 150, title: '旅人' },
    { id: 'places-10', name: '10か所めぐり', desc: 'ちがう名所に10か所到着する', n: 10, get: s => s.places, pts: 300, title: 'ベテラン旅人' },
    { id: 'cards-10', name: 'カード10まい', desc: 'カードを10まい集める', n: 10, get: s => s.cards, pts: 100, title: 'コレクター' },
    { id: 'prefs-2', name: '県をまたいで', desc: '2つの都道府県で到着する', n: 2, get: s => s.prefs, pts: 150, title: '県境こえ' },
    { id: 'kanagawa-5', name: '神奈川を5か所', desc: '神奈川県の名所に5か所到着する', n: 5, get: s => s.byPref['神奈川県'] || 0, pts: 150, title: '神奈川通' },
    { id: 'same-3', name: 'また来たよ', desc: '同じ名所に3回到着する', n: 3, get: s => s.maxSame, pts: 80, title: '常連さん' },
    { id: 'day-3', name: '1日3か所', desc: '1日にちがう名所を3か所めぐる', n: 3, get: s => s.maxDay, pts: 120, title: 'はしご旅' },
    { id: 'night-3', name: '夜の旅人', desc: '夜のカードを3まい集める', n: 3, get: s => s.time('night'), pts: 80, title: '夜ふかし' },
    { id: 'morning-1', name: '早起きは三文の得', desc: '朝に到着する', n: 1, get: s => s.time('morning'), pts: 80, title: '早起き' },
    { id: 'rain-1', name: '雨でも行く', desc: '雨の日に到着する', n: 1, get: s => s.weather('rain'), pts: 80, title: '雨男・雨女' },
    { id: 'snow-1', name: '雪の日の旅', desc: '雪の日に到着する', n: 1, get: s => s.weather('snow'), pts: 150, title: '雪見' },
    { id: 'seasons-4', name: '四季をめぐる', desc: '春・夏・秋・冬のカードをそろえる', n: 4, get: s => s.seasons, pts: 300, title: '四季の旅人' },
  ];
  for (const c of CATEGORIES) if (PLACES.filter(p => p.categories.includes(c)).length >= 3) L.push({ id: 'cat-' + c, name: `${c}を3か所`, desc: `カテゴリ「${c}」の名所に3か所到着する`, n: 3, get: s => s.byCat[c] || 0, pts: 120, title: CAT_TITLE[c] || c });
  return L;
}

// 到着のあとに呼ぶ：新しく達成したものを記録して、知らせる
export function checkGoals() {
  const b = book(), s = stats(b), got = [];
  for (const g of goalList()) if (g.get(s) >= g.n && markGoal(g.id, g.pts)) got.push(g);
  if (got.length) toast(`アチーブメント達成！「${got.map(g => g.name).join('」「')}」 +${got.reduce((a, g) => a + g.pts, 0)}pt`, 4200);
  return got;
}

export function renderGoals(view) {
  checkGoals();
  const b = book(), s = stats(b), L = goalList(), done = L.filter(g => b.goals[g.id]);
  const titles = done.map(g => g.title);
  view.innerHTML = `<p><a class="back" href="#/zukan">← 図鑑</a></p><h1>アチーブメント</h1>
    <p class="count">${done.length} / ${L.length} 達成</p>
    ${titles.length ? `<div class="group"><h2>手に入れた称号</h2><div class="tags">${titles.map(t => `<span class="tag gold">${esc(t)}</span>`).join('')}</div></div>` : ''}
    <ul class="goals">${L.map(g => { const v = Math.min(g.n, g.get(s)), ok = !!b.goals[g.id];
      return `<li class="${ok ? 'ok' : ''}"><div class="gl"><b>${ok ? '★' : '☆'} ${esc(g.name)}</b><span class="sub">${esc(g.desc)}</span>
        <span class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${g.n}" aria-valuenow="${v}"><i style="width:${v / g.n * 100}%"></i></span></div>
        <div class="gr"><span>${v}/${g.n}</span><span class="sub">${ok ? fmtDate(b.goals[g.id]) : `+${g.pts}pt`}</span><span class="sub">称号「${esc(g.title)}」</span></div></li>`; }).join('')}</ul>`;
}
