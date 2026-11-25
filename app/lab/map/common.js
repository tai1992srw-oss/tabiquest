// 案A・案B で共通：行った／まだの記録（この試作の中だけ）と、ドット絵風のピン
const KEY = 'tabiquest-lab-map-visited';
const DEFAULT = ['minatomirai', 'chukagai', 'kanagawa-033', 'tokyo-002'];
let vis;
try { vis = new Set(JSON.parse(localStorage.getItem(KEY) || 'null') || DEFAULT); } catch (e) { vis = new Set(DEFAULT); }
const subs = [];
export const isVisited = id => vis.has(id);
export function toggleVisited(id) {
  vis.has(id) ? vis.delete(id) : vis.add(id);
  try { localStorage.setItem(KEY, JSON.stringify([...vis])); } catch (e) { /* 保存できなくても動く */ }
  subs.forEach(f => f());
}
export const onVisitedChange = f => subs.push(f);
export const visitedIds = () => [...vis];

// ピン（8×9マス）。1=ふち 2=中 3=光
export const PIN = ['..1111..', '.122221.', '12233221', '12233221', '12222221', '.122221.', '..1221..', '...11...', '...11...'];
export const PIN_COL = { yes: '#FFC857', no: '#8C93C8', sapa: '#3ED6C4' };
// kind が 'sapa' のときは、まだのピンを水色にする（行ったら名所と同じ金色）
export function pinCanvas(visited, px, kind = '') {
  const c = document.createElement('canvas'); c.width = 8 * px; c.height = 9 * px;
  const x = c.getContext('2d'), pal = { 1: '#14122E', 2: visited ? PIN_COL.yes : kind === 'sapa' ? PIN_COL.sapa : PIN_COL.no, 3: visited ? '#FFF4E0' : '#D8DCF4' };
  PIN.forEach((row, j) => [...row].forEach((ch, i) => { if (pal[ch]) { x.fillStyle = pal[ch]; x.fillRect(i * px, j * px, px, px); } }));
  return c;
}
export const pinURL = (visited, kind) => pinCanvas(visited, 1, kind).toDataURL();
