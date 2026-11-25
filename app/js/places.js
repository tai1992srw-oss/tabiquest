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
  {
    // 絵は Codex（昼・夜・雪の3枚）。実物の写真を形の見本にした三ツ鳥居とオオカミの像
    id: 'saitama-014', kind: 'dot', no: '011-14', name: '三峯神社', pref: '埼玉県', city: '秩父市',
    lat: 35.925431, lng: 138.930397, radius: 400, categories: ['神社・寺'],
    scene: 'mitsumine', times: ['day', 'morning', 'evening', 'night'],
    blurb: '奥秩父の山の上の神社。三ツ鳥居とオオカミの狛犬',
    welcome: 'ようこそ、三峯神社へ！',
    title: { lines: ['三峯神社'], top: 6.6 },   // 題字：鳥居にかからないよう、1行にして木と空のところへ
    item: { id: 'saitama-014-omiyage', name: 'オオカミの置物（仮）' },
    alt: '三峯神社の三ツ鳥居の前に分身キャラが立つ、動くドット絵カード',
  },
  {
    // 絵は Codex（昼・夜・雪の3枚）。実物の写真を形の見本にした権現造の社殿。夕暮れ・夜は中から灯る
    id: 'saitama-013', kind: 'dot', no: '011-13', name: '秩父神社', pref: '埼玉県', city: '秩父市',
    lat: 35.997876, lng: 139.083999, radius: 250, categories: ['神社・寺'],
    scene: 'chichibu', times: ['day', 'morning', 'evening', 'night'],
    blurb: '秩父の総社。12月の秩父夜祭',
    welcome: 'ようこそ、秩父神社へ！',
    title: { lines: ['秩父神社'], top: 6.6 },
    item: { id: 'saitama-013-omiyage', name: '子育ての虎の置物（仮）' },
    alt: '秩父神社の社殿の前に分身キャラが立つ、動くドット絵カード',
  },
  {
    // 絵は Codex（昼・夜・雪の3枚）。実物の写真を形の見本にした、竜の彫刻と白い柱の社殿。夕暮れ・夜は灯籠が灯る
    id: 'saitama-012', kind: 'dot', no: '011-12', name: '宝登山神社', pref: '埼玉県', city: '長瀞町',
    lat: 36.093222, lng: 139.103097, radius: 300, categories: ['神社・寺'],
    scene: 'hodosan', times: ['day', 'morning', 'evening', 'night'],
    blurb: '長瀞の宝登山のふもとの神社。色あざやかな彫刻',
    welcome: 'ようこそ、宝登山神社へ！',
    title: { lines: ['宝登山神社'], top: 6.6 },
    item: { id: 'saitama-012-omiyage', name: '宝登山のお守り（仮）' },
    alt: '宝登山神社の石段の下に分身キャラが立つ、動くドット絵カード',
  },
  {
    // 絵は Codex（昼・夜・雪の3枚と、ライン下りの舟）。実物の写真を形の見本にした岩畳と対岸の崖
    id: 'saitama-011', kind: 'dot', no: '011-11', name: '長瀞の岩畳', pref: '埼玉県', city: '長瀞町',
    lat: 36.091783, lng: 139.116997, radius: 400, categories: ['自然・絶景'],
    scene: 'nagatoro', times: ['day', 'morning', 'evening', 'night'],
    blurb: '荒川ぞいに広がる岩の河原。ライン下りの舟',
    welcome: 'ようこそ、長瀞の岩畳へ！',
    title: { lines: ['長瀞の岩畳'], top: 6.6 },
    item: { id: 'saitama-011-omiyage', name: 'ライン下りの舟の模型（仮）' },
    alt: '長瀞の岩畳の上に分身キャラが立つ、動くドット絵カード',
  },
  {
    // 絵は Codex（昼・夜・雪の3枚）。実物の写真を形の見本にした芝桜の丘と武甲山。芝桜は春だけ咲く
    id: 'saitama-015', kind: 'dot', no: '011-15', name: '羊山公園', pref: '埼玉県', city: '秩父市',
    lat: 35.985556, lng: 139.08875, radius: 400, categories: ['自然・絶景'],
    scene: 'hitsujiyama', times: ['day', 'morning', 'evening', 'night'],
    blurb: '秩父の丘の公園。春は芝桜の丘',
    welcome: 'ようこそ、羊山公園へ！',
    title: { lines: ['羊山公園'], top: 6.6 },
    item: { id: 'saitama-015-omiyage', name: '芝桜のしおり（仮）' },
    alt: '羊山公園の芝桜の丘の道に分身キャラが立つ、動くドット絵カード',
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
const PLAIN = PLAIN_PLACES.filter(p => !DOT.some(d => d.id === p.id)).map(p => ({   // ドット絵ができた名所は、無地のほうを外す
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
