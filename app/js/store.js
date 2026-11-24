// 記録の保存（端末の中）。本番とデバッグは別の場所に保存し、本当の旅の記録を汚さない
const KEY = { real: 'tabiquest:real:v1', debug: 'tabiquest:debug:v1', settings: 'tabiquest:settings:v1' };
const POINTS = { first: 300, revisit: 10 };

const read = (k, def) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? def; } catch (e) { return def; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const empty = () => ({ cards: {}, items: {}, points: 0 });

export const settings = Object.assign({ debugUnlocked: false, debugOn: false, loc: 'none', time: 'auto', weather: 'auto' }, read(KEY.settings, {}));
export const saveSettings = () => write(KEY.settings, settings);

const books = { real: Object.assign(empty(), read(KEY.real, {})), debug: Object.assign(empty(), read(KEY.debug, {})) };
export const mode = () => (settings.debugUnlocked && settings.debugOn ? 'debug' : 'real');
export const book = (m = mode()) => books[m];
const save = m => write(KEY[m], books[m]);

const dayKey = d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

// 到着を記録する。戻り値は演出で使う
export function arrive(place, v, m = mode()) {
  const b = books[m], now = new Date(), at = now.toISOString();
  let c = b.cards[place.id], first = !c, points = 0, item = null;
  if (first) {
    c = b.cards[place.id] = { first: at, visits: [], variants: [] };
    points = POINTS.first; item = place.item; b.items[item.id] = (b.items[item.id] || 0) + 1;
  } else {
    const today = dayKey(now);
    if (!c.visits.some(x => dayKey(new Date(x.at)) === today)) points = POINTS.revisit;
  }
  c.visits.push({ at, time: v.time, weather: v.weather, season: v.season, lat: v.lat ?? null, lng: v.lng ?? null });
  if (!c.variants.some(x => x.time === v.time && x.weather === v.weather)) c.variants.push({ time: v.time, weather: v.weather, season: v.season, at });
  b.points += points; save(m);
  return { first, count: c.visits.length, points, item, card: c };
}

// ---- デバッグ用：いつもデバッグの記録だけを書き換える ----
export const dbg = {
  grant(place, v) { return arrive(place, v, 'debug'); },
  removeCard(id) { delete books.debug.cards[id]; save('debug'); },
  item(id, n) { const it = books.debug.items; it[id] = Math.max(0, (it[id] || 0) + n); if (!it[id]) delete it[id]; save('debug'); },
  points(n) { books.debug.points = n === null ? 0 : Math.max(0, books.debug.points + n); save('debug'); },
  reset() { books.debug = empty(); save('debug'); },
};
