// 名所データ。名所ごとに1つの設定を持つ
// kind: 'dot'＝Canva の見本を写し取ったドット絵、'photo'＝ドット絵ができるまでの仮の写真
// 緯度・経度と半径は仮の値（到着と判定する距離はまだ決めていない）
import { PHOTO_PLACES } from './photo_places.js';
import { PLAIN_PLACES } from './plain_places.js';

export const CATEGORIES = ['神社・寺', '城・史跡', '自然・絶景', '街並み・港', '夜景', '温泉', '食・市場', 'テーマパーク・施設'];

const DOT = [
  {
    id: 'minatomirai', kind: 'dot', no: '014-01', name: 'みなとみらい', pref: '神奈川県', city: '横浜市西区',
    lat: 35.4556, lng: 139.6360, radius: 500, categories: ['街並み・港', '夜景'],
    scene: 'minatomirai', times: ['day', 'morning', 'evening', 'night'],
    welcome: 'ようこそ、みなとみらいへ！',
    title: { lines: ['みなと', 'みらい'], size: 20, x: [35.4, 25.6] },   // 題字：ランドマークタワーにかからないよう右に寄せる（単位は cqw。ui.js の titleHTML）
    item: { id: 'mm-wheel', name: '観覧車のミニチュア（仮）' },
    alt: 'みなとみらいの海ぞいの遊歩道に分身キャラが立つ、動くドット絵カード',
  },
  {
    id: 'chukagai', kind: 'dot', no: '014-02', name: '横浜中華街', pref: '神奈川県', city: '横浜市中区',
    lat: 35.4437, lng: 139.6466, radius: 400, categories: ['食・市場', '街並み・港'],
    scene: 'chukagai', times: ['day', 'morning', 'evening', 'night'],
    welcome: 'ようこそ、横浜中華街へ！',
    title: { lines: ['横浜中華街'], top: 6.6 },   // 題字：門にかからないよう、1行にして空のところへ
    item: { id: 'ck-nikuman', name: 'ほかほか肉まん（仮）' },
    alt: '横浜中華街の門の前に分身キャラが立つ、動くドット絵カード',
  },
  {
    // 絵は Codex で作った昼の1枚（みなとみらいの絵を見本にした）。朝・夕暮れ・夜は色づけだけ
    id: 'kamakura-koukoumae', kind: 'dot', no: '014-11', name: '鎌倉高校前の踏切', pref: '神奈川県', city: '鎌倉市',
    lat: 35.3067, lng: 139.5003, radius: 250, categories: ['自然・絶景', '街並み・港'],
    scene: 'kamakura', times: ['day', 'morning', 'evening', 'night'],
    welcome: 'ようこそ、鎌倉高校前へ！',
    title: { lines: ['鎌倉', '高校前'] },
    item: { id: 'kk-signal', name: '踏切のキーホルダー（仮）' },
    alt: '海の見える鎌倉高校前の踏切の坂に分身キャラが立つ、動くドット絵カード',
  },
  {
    // 絵は Codex（昼・夜・雪の3枚）。芝生から見上げる構図。夕暮れに灯り、夜はライトアップ
    id: 'tokyotower', kind: 'dot', no: '013-01', name: '東京タワー', pref: '東京都', city: '港区',
    lat: 35.658611, lng: 139.745556, radius: 250, categories: ['夜景', '街並み・港'],
    scene: 'tokyotower', times: ['day', 'morning', 'evening', 'night'],
    blurb: '1958年にできた高さ333mの電波塔。夜のライトアップが見どころ',
    welcome: 'ようこそ、東京タワーへ！',
    title: { tate: [['東京', 13.3, 21.5], ['タワー', 63.6, 16.9]], top: 12, yk: [7.7, -11.3], he: [78.5, 42] },   // 題字：主役がまん中に立つので、たて書きで両わきに（[文字, 左, 大きさ]）
    item: { id: 'tokyotower-omiyage', name: '東京タワーの置物（仮）' },
    alt: '芝生から見上げる東京タワーの前に分身キャラが立つ、動くドット絵カード',
  },
];

// 写真の名所は、時間帯の色づけをコードで行う（形は変えない）ので4つの時間帯すべてを持つ
const PHOTO = PHOTO_PLACES.filter(p => !DOT.some(d => d.id === p.id)).map(p => ({   // ドット絵ができた名所は、写真のほうを外す
  ...p, kind: 'photo', scene: 'photo:' + p.id, times: ['morning', 'day', 'evening', 'night'],
  welcome: `ようこそ、${p.name}へ！`,
  item: { id: `${p.id}-omiyage`, name: `${p.name}のおみやげ（仮）` },
  alt: `${p.name}の写真に分身キャラが立つ、仮のカード`,
}));

// 絵も写真もまだの名所：背景は景色を描かない無地（空色の上下のぼかし）にして、時間帯の色づけだけする
export const PLAIN_BG = 'assets/photos/plain.png';
const PLAIN = PLAIN_PLACES.map(p => ({
  ...p, kind: 'plain', scene: 'plain:' + p.id, times: ['morning', 'day', 'evening', 'night'],
  welcome: `ようこそ、${p.name}へ！`,
  item: { id: `${p.id}-omiyage`, name: `${p.name}のおみやげ（仮）` },
  alt: `${p.name}の仮のカード（絵はまだ）`,
}));

export const PLACES = [...DOT, ...PHOTO, ...PLAIN];
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
