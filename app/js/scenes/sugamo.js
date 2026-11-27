// 巣鴨地蔵通り商店街（2026-11-27）：巣鴨地蔵通り商店街から、高岩寺（とげぬき地蔵）の門を見る。額の「高岩寺」はフォントで入れた。絵は Codex（昼・夜・雪の3枚。夜と雪は昼の絵と同じ位置。実物の写真を形の見本にした）
// 動き・季節：夕暮れに街灯と門が灯る。いちょうは秋に黄色く、冬は葉を落とした色。店先のあじさいは夏だけ咲く
import { buildDot } from './dotscene.js';
export const build = () => buildDot({ base: 'assets/sugamo/', ground: { base: 1.02, top: 0.8, hz: 0.55, s: 2, x: 0.26 }, leaves: true });
