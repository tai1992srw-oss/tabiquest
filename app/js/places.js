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
  {
    // 絵は Codex（昼・夜・雪の3枚）。赤レンガ倉庫を広場からななめに見る
    id: 'akarenga', kind: 'dot', no: '014-03', name: '横浜赤レンガ倉庫', pref: '神奈川県', city: '横浜市中区',
    lat: 35.4522, lng: 139.643, radius: 250, categories: ['街並み・港', '夜景', '城・史跡'],
    scene: 'akarenga', times: ['day', 'morning', 'evening', 'night'],
    blurb: '明治・大正の倉庫を使った商業施設。季節のイベント',
    welcome: 'ようこそ、横浜赤レンガ倉庫へ！',
    item: { id: 'akarenga-omiyage', name: 'レンガのキーホルダー（仮）' },
    alt: '横浜赤レンガ倉庫の広場に分身キャラが立つ、動くドット絵カード',
  },
  {
    // 絵は Codex（昼・夜・雪の3枚）。山下公園の遊歩道から氷川丸を見る
    id: 'yamashita', kind: 'dot', no: '014-04', name: '山下公園', pref: '神奈川県', city: '横浜市中区',
    lat: 35.445778, lng: 139.64975, radius: 350, categories: ['街並み・港', '自然・絶景'],
    scene: 'yamashita', times: ['day', 'morning', 'evening', 'night'],
    blurb: '海沿いの公園。氷川丸が係留されている。秋はバラ',
    welcome: 'ようこそ、山下公園へ！',
    item: { id: 'yamashita-omiyage', name: '氷川丸の模型（仮）' },
    alt: '山下公園の海ぞいの遊歩道に分身キャラが立つ、動くドット絵カード',
  },
  {
    // 絵は Codex（昼・夜・雪の3枚）。大さん橋の屋上（くじらのせなか）から、みなとみらいを見る
    id: 'osanbashi', kind: 'dot', no: '014-05', name: '大さん橋', pref: '神奈川県', city: '横浜市中区',
    lat: 35.4517, lng: 139.648, radius: 300, categories: ['街並み・港', '夜景'],
    scene: 'osanbashi', times: ['day', 'morning', 'evening', 'night'],
    blurb: '船の形の客船ターミナル。屋上から港の夜景',
    welcome: 'ようこそ、大さん橋へ！',
    item: { id: 'osanbashi-omiyage', name: '客船の模型（仮）' },
    alt: '大さん橋の屋上の板張りに分身キャラが立つ、動くドット絵カード',
  },
  {
    // 絵は Codex（昼・夜・雪の3枚）。大池ごしに三重塔を見る
    id: 'sankeien', kind: 'dot', no: '014-06', name: '三溪園', pref: '神奈川県', city: '横浜市中区',
    lat: 35.41695, lng: 139.660042, radius: 400, categories: ['自然・絶景', '城・史跡'],
    scene: 'sankeien', times: ['day', 'morning', 'evening', 'night'],
    blurb: '歴史的建造物を移した日本庭園。三重塔',
    welcome: 'ようこそ、三溪園へ！',
    item: { id: 'sankeien-omiyage', name: '三重塔の置物（仮）' },
    alt: '三溪園の大池のほとりに分身キャラが立つ、動くドット絵カード',
  },
  {
    // 絵は Codex（昼・夜・雪の3枚）。阿字ヶ池にかかる赤い反橋と金堂
    id: 'kanagawa-070', kind: 'dot', no: '014-40', name: '称名寺（金沢文庫）', pref: '神奈川県', city: '横浜市金沢区',
    lat: 35.344181, lng: 139.630392, radius: 250, categories: ['神社・寺', '自然・絶景', '城・史跡'],
    scene: 'shomyoji', times: ['day', 'morning', 'evening', 'night'],
    blurb: '鎌倉時代の浄土庭園。となりに県立金沢文庫',
    welcome: 'ようこそ、称名寺（金沢文庫）へ！',
    item: { id: 'kanagawa-070-omiyage', name: '赤い橋の置物（仮）' },
    alt: '称名寺の池のほとりに分身キャラが立つ、動くドット絵カード',
  },
  {
    // 絵は Codex（昼・夜・雪の3枚）。舞殿・大石段・本宮を正面から
    id: 'tsurugaoka', kind: 'dot', no: '014-07', name: '鶴岡八幡宮', pref: '神奈川県', city: '鎌倉市',
    lat: 35.326081, lng: 139.556417, radius: 350, categories: ['神社・寺', '城・史跡'],
    scene: 'tsurugaoka', times: ['day', 'morning', 'evening', 'night'],
    blurb: '鎌倉幕府ゆかりの神社。若宮大路の先にある',
    welcome: 'ようこそ、鶴岡八幡宮へ！',
    item: { id: 'tsurugaoka-omiyage', name: '鳩のお守り（仮）' },
    alt: '鶴岡八幡宮の舞殿の前に分身キャラが立つ、動くドット絵カード',
  },
  {
    // 絵は Codex（昼・夜・雪の3枚）。高徳院の大仏を正面から見上げる
    id: 'daibutsu', kind: 'dot', no: '014-08', name: '鎌倉大仏（高徳院）', pref: '神奈川県', city: '鎌倉市',
    lat: 35.316861, lng: 139.535722, radius: 200, categories: ['神社・寺', '城・史跡'],
    scene: 'daibutsu', times: ['day', 'morning', 'evening', 'night'],
    blurb: '高さ約11mの国宝の阿弥陀如来像',
    welcome: 'ようこそ、鎌倉大仏（高徳院）へ！',
    item: { id: 'daibutsu-omiyage', name: '大仏の置物（仮）' },
    alt: '鎌倉大仏の前に分身キャラが立つ、動くドット絵カード',
  },
  {
    // 絵は Codex（昼・夜・雪の3枚）。石段の上の観音堂と、両わきのあじさい
    id: 'kanagawa-034', kind: 'dot', no: '014-14', name: '長谷寺（鎌倉）', pref: '神奈川県', city: '鎌倉市',
    lat: 35.312464, lng: 139.532995, radius: 200, categories: ['神社・寺', '自然・絶景'],
    scene: 'hasedera', times: ['day', 'morning', 'evening', 'night'],
    blurb: '海を見下ろす寺。6月のあじさい',
    welcome: 'ようこそ、長谷寺（鎌倉）へ！',
    item: { id: 'kanagawa-034-omiyage', name: 'あじさいのしおり（仮）' },
    alt: '長谷寺の石段の下に分身キャラが立つ、動くドット絵カード',
  },
  {
    // 絵は Codex（昼・夜・雪の3枚）。建長寺の三門を正面から
    id: 'kanagawa-049', kind: 'dot', no: '014-21', name: '建長寺', pref: '神奈川県', city: '鎌倉市',
    lat: 35.331789, lng: 139.555347, radius: 300, categories: ['神社・寺'],
    scene: 'kenchoji', times: ['day', 'morning', 'evening', 'night'],
    blurb: '鎌倉五山の第一位の禅寺',
    welcome: 'ようこそ、建長寺へ！',
    item: { id: 'kanagawa-049-omiyage', name: '三門の置物（仮）' },
    alt: '建長寺の三門の前に分身キャラが立つ、動くドット絵カード',
  },
  {
    // 絵は Codex（昼・夜・雪の3枚）。石段の上の山門を木立の中から見上げる
    id: 'kanagawa-050', kind: 'dot', no: '014-22', name: '円覚寺', pref: '神奈川県', city: '鎌倉市',
    lat: 35.337704, lng: 139.547498, radius: 300, categories: ['神社・寺'],
    scene: 'engakuji', times: ['day', 'morning', 'evening', 'night'],
    blurb: '北鎌倉駅前の禅寺。国宝の舎利殿',
    welcome: 'ようこそ、円覚寺へ！',
    item: { id: 'kanagawa-050-omiyage', name: '山門の置物（仮）' },
    alt: '円覚寺の石段の下に分身キャラが立つ、動くドット絵カード',
  },
  {
    // 絵は Codex（昼・夜・雪の3枚）。報国寺の竹の庭
    id: 'kanagawa-051', kind: 'dot', no: '014-23', name: '報国寺（竹の寺）', pref: '神奈川県', city: '鎌倉市',
    lat: 35.32, lng: 139.5693, radius: 150, categories: ['神社・寺', '自然・絶景'],
    scene: 'hokokuji', times: ['day', 'morning', 'evening', 'night'],
    blurb: '竹林の庭で抹茶がいただける寺',
    welcome: 'ようこそ、報国寺（竹の寺）へ！',
    item: { id: 'kanagawa-051-omiyage', name: '竹の茶しゃく（仮）' },
    alt: '報国寺の竹林の道に分身キャラが立つ、動くドット絵カード',
  },
  {
    // 絵は Codex（昼・夜・雪の3枚）。片瀬の砂浜から江の島と灯台を見る
    id: 'enoshima', kind: 'dot', no: '014-09', name: '江の島（江島神社）', pref: '神奈川県', city: '藤沢市',
    lat: 35.299331, lng: 139.480908, radius: 600, categories: ['自然・絶景', '神社・寺', '夜景'],
    scene: 'enoshima', times: ['day', 'morning', 'evening', 'night'],
    blurb: '橋で渡れる島。江島神社と展望灯台。冬は夜のイルミネーション',
    welcome: 'ようこそ、江の島（江島神社）へ！',
    item: { id: 'enoshima-omiyage', name: '貝がらのお守り（仮）' },
    alt: '江の島を望む砂浜に分身キャラが立つ、動くドット絵カード',
  },
  {
    // 絵は Codex（昼・夜・雪の3枚）。城ヶ島の馬の背洞門
    id: 'kanagawa-054', kind: 'dot', no: '014-26', name: '城ヶ島', pref: '神奈川県', city: '三浦市',
    lat: 35.133889, lng: 139.618611, radius: 800, categories: ['自然・絶景'],
    scene: 'jogashima', times: ['day', 'morning', 'evening', 'night'],
    blurb: '三浦半島の先の島。馬の背洞門と夕日',
    welcome: 'ようこそ、城ヶ島へ！',
    item: { id: 'kanagawa-054-omiyage', name: '洞門の絵はがき（仮）' },
    alt: '城ヶ島の岩場に分身キャラが立つ、動くドット絵カード',
  },
  {
    // 絵は Codex（昼・夜・雪の3枚）。猿島の要塞跡の切通しとレンガのトンネル
    id: 'kanagawa-055', kind: 'dot', no: '014-27', name: '猿島', pref: '神奈川県', city: '横須賀市',
    lat: 35.286111, lng: 139.694167, radius: 300, categories: ['自然・絶景', '城・史跡'],
    scene: 'sarushima', times: ['day', 'morning', 'evening', 'night'],
    blurb: '東京湾の無人島。旧日本軍の要塞跡。船で渡る',
    welcome: 'ようこそ、猿島へ！',
    item: { id: 'kanagawa-055-omiyage', name: 'レンガの文鎮（仮）' },
    alt: '猿島の切通しの道に分身キャラが立つ、動くドット絵カード',
  },
  {
    // 絵は Codex（昼・夜・雪の3枚）。本丸広場から天守を見上げる
    id: 'odawarajo', kind: 'dot', no: '014-10', name: '小田原城', pref: '神奈川県', city: '小田原市',
    lat: 35.250833, lng: 139.153611, radius: 300, categories: ['城・史跡'],
    scene: 'odawarajo', times: ['day', 'morning', 'evening', 'night'],
    blurb: '北条氏の城。天守閣は1960年の再建。春は桜',
    welcome: 'ようこそ、小田原城へ！',
    item: { id: 'odawarajo-omiyage', name: '天守の置物（仮）' },
    alt: '小田原城の本丸広場に分身キャラが立つ、動くドット絵カード',
  },
  {
    // 絵は Codex（昼・夜・雪の3枚）。芦ノ湖に立つ平和の鳥居を岸から見る
    id: 'kanagawa-036', kind: 'dot', no: '014-15', name: '箱根神社', pref: '神奈川県', city: '箱根町',
    lat: 35.203889, lng: 139.025556, radius: 250, categories: ['神社・寺'],
    scene: 'hakonejinja', times: ['day', 'morning', 'evening', 'night'],
    blurb: '芦ノ湖のほとりの神社。湖に立つ「平和の鳥居」',
    welcome: 'ようこそ、箱根神社へ！',
    item: { id: 'kanagawa-036-omiyage', name: '鳥居のお守り（仮）' },
    alt: '箱根神社の平和の鳥居の前に分身キャラが立つ、動くドット絵カード',
  },
  {
    // 絵は Codex（昼・夜・雪の3枚）。大涌谷の噴気地帯
    id: 'kanagawa-037', kind: 'dot', no: '014-16', name: '大涌谷', pref: '神奈川県', city: '箱根町',
    lat: 35.241916, lng: 139.020667, radius: 400, categories: ['自然・絶景', '温泉'],
    scene: 'owakudani', times: ['day', 'morning', 'evening', 'night'],
    blurb: '噴煙が上がる火山の谷。黒たまご。火山の状態で立入規制あり',
    welcome: 'ようこそ、大涌谷へ！',
    item: { id: 'kanagawa-037-omiyage', name: '黒たまご（仮）' },
    alt: '大涌谷の展望台に分身キャラが立つ、動くドット絵カード',
  },
  {
    // 絵は Codex（昼・夜・雪の3枚）。元箱根から芦ノ湖・平和の鳥居・富士山を見る
    id: 'kanagawa-038', kind: 'dot', no: '014-17', name: '芦ノ湖（元箱根港）', pref: '神奈川県', city: '箱根町',
    lat: 35.200972, lng: 139.03, radius: 400, categories: ['自然・絶景', '街並み・港'],
    scene: 'ashinoko', times: ['day', 'morning', 'evening', 'night'],
    blurb: '箱根のカルデラ湖。海賊船の港。晴れると富士山',
    welcome: 'ようこそ、芦ノ湖（元箱根港）へ！',
    item: { id: 'kanagawa-038-omiyage', name: '海賊船の模型（仮）' },
    alt: '芦ノ湖の元箱根の湖畔に分身キャラが立つ、動くドット絵カード',
  },
  {
    // 絵は Codex（昼・夜・雪の3枚）。大山阿夫利神社の下社と大山の森
    id: 'kanagawa-052', kind: 'dot', no: '014-24', name: '大山阿夫利神社（下社）', pref: '神奈川県', city: '伊勢原市',
    lat: 35.432131, lng: 139.238074, radius: 250, categories: ['神社・寺', '自然・絶景'],
    scene: 'oyama', times: ['day', 'morning', 'evening', 'night'],
    blurb: 'ケーブルカーで行ける大山の中腹の神社。相模湾を見下ろす',
    welcome: 'ようこそ、大山阿夫利神社（下社）へ！',
    item: { id: 'kanagawa-052-omiyage', name: '大山こま（仮）' },
    alt: '大山阿夫利神社の下社の前に分身キャラが立つ、動くドット絵カード',
  },
  {
    // 絵は Codex（昼・夜・雪の3枚）。川崎大師の大本堂と八角五重塔
    id: 'kanagawa-048', kind: 'dot', no: '014-20', name: '川崎大師（平間寺）', pref: '神奈川県', city: '川崎市川崎区',
    lat: 35.533741, lng: 139.729483, radius: 300, categories: ['神社・寺', '食・市場'],
    scene: 'kawasakidaishi', times: ['day', 'morning', 'evening', 'night'],
    blurb: '厄除けで知られる寺。参道のくず餅と飴',
    welcome: 'ようこそ、川崎大師（平間寺）へ！',
    item: { id: 'kanagawa-048-omiyage', name: 'だるま（仮）' },
    alt: '川崎大師の大本堂の前に分身キャラが立つ、動くドット絵カード',
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
