// 名所データ。名所ごとに1つの設定を持つ
// kind: 'dot'＝Canva の見本を写し取ったドット絵、'photo'＝ドット絵ができるまでの仮の写真
// 緯度・経度と半径は仮の値（到着と判定する距離はまだ決めていない）
import { PHOTO_PLACES } from './photo_places.js';

export const CATEGORIES = ['神社・寺', '城・史跡', '自然・絶景', '街並み・港', '夜景', '温泉', '食・市場', 'テーマパーク・施設'];

const DOT = [
  {
    id: 'minatomirai', kind: 'dot', no: '014-01', name: 'みなとみらい', pref: '神奈川県', city: '横浜市西区',
    lat: 35.4556, lng: 139.6360, radius: 500, categories: ['街並み・港', '夜景'],
    scene: 'minatomirai', times: ['evening', 'night'],
    welcome: 'ようこそ、みなとみらいへ！',
    item: { id: 'mm-wheel', name: '観覧車のミニチュア（仮）' },
    alt: 'みなとみらいの港の遊歩道に分身キャラが立つ、動くドット絵カード',
  },
  {
    id: 'chukagai', kind: 'dot', no: '014-02', name: '横浜中華街', pref: '神奈川県', city: '横浜市中区',
    lat: 35.4437, lng: 139.6466, radius: 400, categories: ['食・市場', '街並み・港'],
    scene: 'chukagai', times: ['night', 'evening'],
    welcome: 'ようこそ、横浜中華街へ！',
    item: { id: 'ck-nikuman', name: 'ほかほか肉まん（仮）' },
    alt: '夜の横浜中華街の門の前に分身キャラが立つ、動くドット絵カード',
  },
];

// 写真の名所は、時間帯の色づけをコードで行う（形は変えない）ので4つの時間帯すべてを持つ
const PHOTO = PHOTO_PLACES.map(p => ({
  ...p, kind: 'photo', scene: 'photo:' + p.id, times: ['morning', 'day', 'evening', 'night'],
  welcome: `ようこそ、${p.name}へ！`,
  item: { id: `${p.id}-omiyage`, name: `${p.name}のおみやげ（仮）` },
  alt: `${p.name}の写真に分身キャラが立つ、仮のカード`,
}));

export const PLACES = [...DOT, ...PHOTO];
export const placeById = id => PLACES.find(p => p.id === id);

export const LABEL = {
  time: { morning: '朝', day: '昼', evening: '夕暮れ', night: '夜' },
  weather: { clear: '晴れ', cloudy: '曇り', rain: '雨', snow: '雪', unknown: '天気不明' },
  season: { spring: '春', summer: '夏', autumn: '秋', winter: '冬' },
};
export const CHIP_COLOR = { time: '#FFC857', weather: '#3ED6C4', season: '#FF9A8A' };
export const TIMES = ['morning', 'day', 'evening', 'night'];
export const WEATHERS = ['clear', 'cloudy', 'rain', 'snow'];

export function seasonOf(d = new Date()) {
  const m = d.getMonth() + 1;
  return m <= 2 || m === 12 ? 'winter' : m <= 5 ? 'spring' : m <= 8 ? 'summer' : 'autumn';
}
