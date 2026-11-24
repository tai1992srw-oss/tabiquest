// 名所データ。名所ごとに1つの設定を持つ
// 緯度・経度と半径は仮の値（到着と判定する距離はまだ決めていない）
export const PLACES = [
  {
    id: 'minatomirai', no: '014-01', name: 'みなとみらい', pref: '神奈川県', city: '横浜市西区',
    lat: 35.4556, lng: 139.6360, radius: 500,
    scene: 'minatomirai', times: ['evening', 'night'], weathers: ['clear', 'rain', 'snow'],
    welcome: 'ようこそ、みなとみらいへ！',
    item: { id: 'mm-wheel', name: '観覧車のミニチュア（仮）' },
    alt: 'みなとみらいの港の遊歩道に分身キャラが立つ、動くドット絵カード',
  },
  {
    id: 'chukagai', no: '014-02', name: '横浜中華街', pref: '神奈川県', city: '横浜市中区',
    lat: 35.4437, lng: 139.6466, radius: 400,
    scene: 'chukagai', times: ['night', 'evening'], weathers: ['clear', 'rain', 'snow'],
    welcome: 'ようこそ、横浜中華街へ！',
    item: { id: 'ck-nikuman', name: 'ほかほか肉まん（仮）' },
    alt: '夜の横浜中華街の門の前に分身キャラが立つ、動くドット絵カード',
  },
];
export const placeById = id => PLACES.find(p => p.id === id);

export const LABEL = {
  time: { evening: '夕暮れ', night: '夜' },
  weather: { clear: '晴れ', rain: '雨', snow: '雪' },
  season: { spring: '春', summer: '夏', autumn: '秋', winter: '冬' },
};
export const CHIP_COLOR = { time: '#FFC857', weather: '#3ED6C4', season: '#FF9A8A' };

export function seasonOf(d = new Date()) {
  const m = d.getMonth() + 1;
  return m <= 2 || m === 12 ? 'winter' : m <= 5 ? 'spring' : m <= 8 ? 'summer' : 'autumn';
}
// 時間帯：昼の絵はまだないので、夜以外は夕暮れにしておく
export function timeOf(place, d = new Date()) {
  const h = d.getHours(), t = h >= 19 || h < 5 ? 'night' : 'evening';
  return place.times.includes(t) ? t : place.times[0];
}
