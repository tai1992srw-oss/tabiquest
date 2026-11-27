// 表参道（2026-11-27）：歩道橋の上から、表参道のけやき並木を見る。絵は Codex（昼・夜・雪の3枚。夜と雪は昼の絵と同じ位置。実物の写真を形の見本にした）
// 動き・季節：けやきは秋に黄色〜茶色に色づき、冬は葉を落とした色。夜は街灯の絵
import { buildDot } from './dotscene.js';
export const build = () => buildDot({ base: 'assets/omotesando/', ground: { base: 1.02, top: 0.82, hz: 0.48, s: 2, x: 0.22 }, leaves: true });
