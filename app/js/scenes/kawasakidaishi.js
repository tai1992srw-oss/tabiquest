// 川崎大師（平間寺）（2026-11-26）：川崎大師の大本堂と八角五重塔。絵は Codex（昼・夜・雪の3枚。夜と雪は昼の絵と同じ位置。実物の写真を形の見本にした）
// 動き・季節：夕暮れに提灯と灯籠が灯る、夜は灯りのついた絵
import { buildDot } from './dotscene.js';
export const build = () => buildDot({ base: 'assets/kawasakidaishi/', ground: { base: 1.02, top: 0.78, hz: 0.62, s: 2, x: 0.24 }, leaves: true });
