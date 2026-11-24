// 記録の保存（端末の中）。本番とデバッグは別の場所に保存し、本当の旅の記録を汚さない
// v2：カードは「到着ごとに撮る1枚」。そのときの時間帯・天気・季節・日時・位置を固定して持つ
const KEY = { real: 'tabiquest:real:v1', debug: 'tabiquest:debug:v1', settings: 'tabiquest:settings:v1' };
const POINTS = { first: 300, revisit: 10 };
export const VERSION_DATA = 2;

const read = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const empty = () => ({ v: VERSION_DATA, cards: [], items: {}, points: 0, seq: {}, goals: {} });

// v1（名所ごとに visits と variants を持つ形）から v2 へ移す
export function migrate(b) {
  if (!b || typeof b !== 'object') return empty();
  if (b.v === VERSION_DATA && Array.isArray(b.cards)) return Object.assign(empty(), b);
  const out = empty(); out.items = b.items || {}; out.points = b.points || 0;
  for (const [placeId, c] of Object.entries(b.cards || {})) {
    const visits = (c.visits && c.visits.length) ? c.visits : (c.variants || []).map(x => ({ at: x.at || c.first, time: x.time, weather: x.weather, season: x.season }));
    visits.sort((a, z) => (a.at < z.at ? -1 : 1)).forEach(x => {
      const n = (out.seq[placeId] || 0) + 1; out.seq[placeId] = n;
      out.cards.push({ id: `${placeId}-${n}`, placeId, n, at: x.at || c.first, time: x.time || 'evening', timeReal: x.time || null, weather: x.weather || 'clear', weatherSrc: 'v1', season: x.season || null, lat: x.lat ?? null, lng: x.lng ?? null, pose: null, friends: [] });
    });
  }
  return out;
}

export const settings = Object.assign({ debugUnlocked: false, debugOn: false, loc: 'none', time: 'auto', weather: 'auto' }, read(KEY.settings) || {});
export const saveSettings = () => write(KEY.settings, settings);

const books = { real: migrate(read(KEY.real)), debug: migrate(read(KEY.debug)) };
write(KEY.real, books.real); write(KEY.debug, books.debug);
export const mode = () => (settings.debugUnlocked && settings.debugOn ? 'debug' : 'real');
export const book = (m = mode()) => books[m];
const save = m => write(KEY[m], books[m]);

const dayKey = d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
export const cardsOf = (placeId, m = mode()) => books[m].cards.filter(c => c.placeId === placeId).sort((a, z) => z.n - a.n);
export const cardById = (id, m = mode()) => books[m].cards.find(c => c.id === id);
export const visited = (placeId, m = mode()) => books[m].cards.some(c => c.placeId === placeId);

// 到着を記録して、新しいカードを1枚つくる。v：時間帯・天気・季節・位置
export function arrive(place, v, m = mode()) {
  const b = books[m], now = new Date(), at = now.toISOString();
  const before = b.cards.filter(c => c.placeId === place.id), first = !before.length;
  let points = 0, item = null;
  if (first) { points = POINTS.first; item = place.item; b.items[item.id] = (b.items[item.id] || 0) + 1; }
  else if (!before.some(c => dayKey(new Date(c.at)) === dayKey(now))) points = POINTS.revisit;
  const n = (b.seq[place.id] || 0) + 1; b.seq[place.id] = n;
  const card = { id: `${place.id}-${n}`, placeId: place.id, n, at, time: v.time, timeReal: v.timeReal ?? v.time, weather: v.weather, weatherSrc: v.weatherSrc || null, season: v.season,
    lat: v.lat ?? null, lng: v.lng ?? null, pose: null, friends: [] };
  b.cards.push(card); b.points += points; save(m);
  return { first, count: before.length + 1, points, item, card };
}

// アチーブメントの達成を記録する（1回だけ）。ポイントも足す
export function markGoal(id, pts, m = mode()) {
  const b = books[m]; if (b.goals[id]) return false;
  b.goals[id] = new Date().toISOString(); b.points += pts; save(m); return true;
}

// ---- 書き出しと読み込み ----
export function exportBook(m = mode()) {
  return JSON.stringify({ app: 'tabiquest', kind: m, exportedAt: new Date().toISOString(), book: books[m] }, null, 1);
}
export function importBook(text, m = mode()) {
  const j = JSON.parse(text);
  if (!j || j.app !== 'tabiquest' || !j.book) throw new Error('タビクエの記録のファイルではありません');
  const b = migrate(j.book); if (!Array.isArray(b.cards)) throw new Error('記録の中身が読めません');
  books[m] = b; save(m); return { kind: j.kind, cards: b.cards.length };
}

// ---- デバッグ用：いつもデバッグの記録だけを書き換える ----
export const dbg = {
  grant(place, v) { return arrive(place, v, 'debug'); },
  removeCards(placeId) { books.debug.cards = books.debug.cards.filter(c => c.placeId !== placeId); save('debug'); },
  item(id, n) { const it = books.debug.items; it[id] = Math.max(0, (it[id] || 0) + n); if (!it[id]) delete it[id]; save('debug'); },
  points(n) { books.debug.points = n === null ? 0 : Math.max(0, books.debug.points + n); save('debug'); },
  reset() { books.debug = empty(); save('debug'); },
};

// ブラウザに「この記録は消さないで」と頼む
export async function persist() {
  try { if (navigator.storage?.persisted && await navigator.storage.persisted()) return true; return navigator.storage?.persist ? await navigator.storage.persist() : false; } catch (e) { return false; }
}
